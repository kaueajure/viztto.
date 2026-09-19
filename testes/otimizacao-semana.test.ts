import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import {
  prepararSemana,
  simularRodadaCompleta,
  finalizarSemana,
} from "@/aplicacao/casos-de-uso/fases-semana";
import {
  iniciarAvancoComMatchday,
  limparSessaoMatchday,
  simularMatchdayInstantaneo,
  simularAvancoSemana,
} from "@/aplicacao/casos-de-uso/sessao-matchday";
import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import { responderProposta } from "@/simulacao/transferencias/mercado";
import { sortearHistoria } from "@/dominio/historia-formacao";
import { clonarCarreiraParaAvanco } from "@/simulacao/carreira/clonar-avanco";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";

const SNAPSHOT: Record<string, string> = {
  brasileirao: "brasileirao.json",
  "brasileirao-b": "brasileirao-b.json",
  "premier-league": "premier-league.json",
  championship: "championship.json",
  "la-liga": "la-liga.json",
  "la-liga-2": "la-liga-2.json",
  "serie-a": "serie-a.json",
  "serie-b": "serie-b.json",
  bundesliga: "bundesliga.json",
  "bundesliga-2": "bundesliga-2.json",
  "ligue-1": "ligue-1.json",
  "ligue-2": "ligue-2.json",
};

function carreiraMundoCompleto(seed: string): EstadoCarreira {
  const packs = LIGAS_SUPORTADAS.map((l) => {
    const arq = SNAPSHOT[l.id];
    if (!arq) return null;
    const dados = JSON.parse(
      readFileSync(join(process.cwd(), "src/dados/futebol", arq), "utf8"),
    );
    return { liga: l, clubes: dados.clubes, inicio: dados.inicio as string };
  }).filter(Boolean) as {
    liga: (typeof LIGAS_SUPORTADAS)[number];
    clubes: unknown[];
    inicio: string;
  }[];

  const principal = packs.find((p) => p.liga.id === "brasileirao")!;
  const outras = packs.filter((p) => p !== principal);
  const posicao = "MEI" as const;
  const historia = Object.fromEntries(
    Object.entries(sortearHistoria(seed, posicao)).map(([k, v]) => [
      k,
      v[0]!.id,
    ]),
  ) as Record<"origem" | "destaque" | "dificuldade" | "chegada", string>;

  const carreira = criarCarreira({
    identidade: {
      nome: "Bench",
      sobrenome: "Mundo",
      nacionalidade: "Brasil",
      idade: 18,
      posicao,
      posicaoSecundaria: "MC",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "criador",
    },
    liga: principal.liga,
    clubes: principal.clubes as never,
    clubeId: (principal.clubes[0] as { id: string }).id,
    origem: "api",
    seed,
    dataInicio: principal.inicio,
    historia,
    ligasMundo: outras.map((o) => o.liga),
    clubesMundo: outras.flatMap((o) => o.clubes) as never,
  });
  carreira.jogador.categoria = "profissional";
  carreira.jogador.status = "titular";
  return carreira;
}

function carreiraDuasLigas(seed: string): EstadoCarreira {
  const liga = LIGAS_SUPORTADAS[0]!;
  const externa = LIGAS_SUPORTADAS.find((l) => l.id === "premier-league")!;
  const clubesBr = gerarClubesDemonstracao(liga).slice(0, 4);
  const clubesEn = gerarClubesDemonstracao(externa).slice(0, 6);
  return criarCarreira({
    identidade: {
      nome: "Ordem",
      sobrenome: "Clone",
      nacionalidade: "Brasil",
      idade: 18,
      posicao: "MEI",
      posicaoSecundaria: "MC",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "criador",
    },
    liga,
    clubes: clubesBr,
    clubeId: clubesBr[0]!.id,
    origem: "demonstracao",
    seed,
    dataInicio: "2026-01-05",
    ligasMundo: [externa],
    clubesMundo: clubesEn,
  });
}

function transferirParaLiga(c: EstadoCarreira, ligaId: string): EstadoCarreira {
  const destino = c.clubes.find((cl) => cl.ligaId === ligaId)!;
  c.propostas.push({
    id: "troca-ordem-clone",
    clubeId: destino.id,
    tipo: "transferencia",
    salario: 2000,
    duracaoAnos: 3,
    papelPrometido: "rotacao",
    etapa: "proposta_jogador",
    data: c.dataAtual,
    validade: "2030-12-31",
    status: "pendente",
  });
  const resultado = responderProposta(c, "troca-ordem-clone", true);
  resultado.propostas = [];
  return resultado;
}

function idsClubes(c: EstadoCarreira): string[] {
  return c.clubes.map((cl) => cl.id);
}

function snapshotDeterministico(c: EstadoCarreira) {
  const partidas = [
    ...c.temporada.partidas,
    ...c.temporada.partidasBase,
  ].filter((p) => p.rodada === c.temporada.rodadaAtual);
  const ultima = partidas.find((p) => p.id === c.ultimaPartidaId);
  return {
    estadoAleatorio: c.estadoAleatorio,
    rodada: c.temporada.rodadaAtual,
    ultimaPartidaId: c.ultimaPartidaId,
    placar: ultima
      ? [ultima.golsMandante, ultima.golsVisitante]
      : null,
    participacao: ultima?.participacao ?? null,
    classificacao: c.temporada.classificacao.slice(0, 5).map((x) => ({
      id: x.clubeId,
      pts: x.pontos,
      sg: x.saldo,
    })),
    transferencias: c.transferenciasRecentes?.length ?? 0,
    overallUsuario: c.jogador.overall,
    formaUsuario: c.jogador.forma,
    ordemClubes: idsClubes(c),
    ligasExternas: Object.keys(c.temporadasExternas)
      .sort()
      .map((id) => ({
        id,
        rodada: c.temporadasExternas[id]!.rodadaAtual,
        top: c.temporadasExternas[id]!.classificacao[0]?.clubeId ?? null,
      })),
  };
}

describe("clonarCarreiraParaAvanco — ordem dos clubes", () => {
  it("preserva a ordem original de clubes no clone", () => {
    const base = carreiraDuasLigas("ordem-clone-v1");
    const ordemAntes = idsClubes(base);
    const clone = clonarCarreiraParaAvanco(base);
    expect(idsClubes(clone)).toEqual(ordemAntes);
    expect(idsClubes(base)).toEqual(ordemAntes);
  });

  it("preserva ordem após transferência para liga que não está no início do array", () => {
    let c = carreiraDuasLigas("ordem-transfer-v1");
    const ordemOriginal = idsClubes(c);
    // Clubes da Premier estão depois dos brasileiros no array.
    const idxPremier = c.clubes.findIndex(
      (cl) => cl.ligaId === "premier-league",
    );
    expect(idxPremier).toBeGreaterThan(0);

    c = transferirParaLiga(c, "premier-league");
    expect(c.liga.id).toBe("premier-league");
    expect(idsClubes(c)).toEqual(ordemOriginal);

    const clone = clonarCarreiraParaAvanco(c);
    expect(idsClubes(clone)).toEqual(ordemOriginal);

    // Liga atual clonada; clubes da antiga liga principal compartilhados.
    const clonados = clone.clubes.filter((cl) => cl.ligaId === c.liga.id);
    const compartilhados = clone.clubes.filter(
      (cl) => cl.ligaId !== c.liga.id,
    );
    for (const cl of clonados) {
      const orig = c.clubes.find((x) => x.id === cl.id)!;
      expect(cl).not.toBe(orig);
    }
    for (const cl of compartilhados) {
      const orig = c.clubes.find((x) => x.id === cl.id)!;
      expect(cl).toBe(orig);
    }
  });

  it("avanço semanal não altera a ordem dos clubes e não muta a carreira original", () => {
    const base = carreiraDuasLigas("ordem-avanco-v1");
    const ordemAntes = idsClubes(base);
    const externo = base.clubes.find((cl) => cl.ligaId !== base.liga.id)!;
    const formaExternaAntes = externo.forma;

    const depois = avancarSemana(base);
    expect(idsClubes(depois)).toEqual(ordemAntes);
    expect(idsClubes(base)).toEqual(ordemAntes);
    expect(externo.forma).toBe(formaExternaAntes);
    expect(depois.clubes.find((cl) => cl.id === externo.id)).not.toBe(externo);
  });

  it("determinismo estável com mesma seed após transferência de liga", () => {
    const seed = "ordem-det-transfer-v1";
    const avancarTransferido = () => {
      let c = carreiraDuasLigas(seed);
      c = transferirParaLiga(c, "premier-league");
      c.jogador.categoria = "profissional";
      c.jogador.status = "titular";
      return avancarSemana(c);
    };
    const a = avancarTransferido();
    const b = avancarTransferido();
    expect(a.estadoAleatorio).toBe(b.estadoAleatorio);
    expect(idsClubes(a)).toEqual(idsClubes(b));
    expect(snapshotDeterministico(a)).toEqual(snapshotDeterministico(b));
  });
});

describe("otimização avanço semanal (mundo completo)", () => {
  it("mantém determinismo entre duas carreiras com a mesma seed", () => {
    const seed = "otim-det-mundo-v1";
    const a = avancarSemana(carreiraMundoCompleto(seed));
    const b = avancarSemana(carreiraMundoCompleto(seed));
    expect(snapshotDeterministico(a)).toEqual(snapshotDeterministico(b));
    expect(serializarCarreira(a)).toEqual(serializarCarreira(b));
  }, 60_000);

  it("Matchday acompanhado e simulação instantânea convergem no mesmo estado", () => {
    const seed = "otim-matchday-paridade-v1";
    limparSessaoMatchday();
    const baseA = carreiraMundoCompleto(seed);
    const baseB = carreiraMundoCompleto(seed);

    const instantaneo = simularAvancoSemana(baseA);

    limparSessaoMatchday();
    const r = iniciarAvancoComMatchday(baseB);
    expect(r.tipo).toBe("matchday");
    const acompanhado = simularMatchdayInstantaneo();
    limparSessaoMatchday();

    expect(snapshotDeterministico(acompanhado)).toEqual(
      snapshotDeterministico(instantaneo),
    );
  }, 60_000);

  it("clone seletivo não muta clubes externos do estado original até finalizar", () => {
    const base = carreiraMundoCompleto("otim-cow-v1");
    const externo = base.clubes.find((c) => c.ligaId !== base.liga.id)!;
    const overallAntes = externo.elenco[0]!.overall;
    const formaAntes = externo.forma;
    const tempExtAntes = base.temporadasExternas;
    const rodadaExtAntes =
      Object.values(tempExtAntes)[0]?.rodadaAtual ?? 0;
    const ordemAntes = idsClubes(base);

    const ctx = prepararSemana(base);
    expect(idsClubes(ctx.carreira)).toEqual(ordemAntes);
    expect(externo.elenco[0]!.overall).toBe(overallAntes);
    expect(externo.forma).toBe(formaAntes);

    const compartilhado = ctx.carreira.clubes.find((c) => c.id === externo.id)!;
    expect(compartilhado).toBe(externo);
    expect(ctx.carreira.temporadasExternas).toBe(tempExtAntes);

    simularRodadaCompleta(ctx);
    finalizarSemana(ctx);

    expect(idsClubes(ctx.carreira)).toEqual(ordemAntes);
    expect(externo.elenco[0]!.overall).toBe(overallAntes);
    expect(externo.forma).toBe(formaAntes);
    expect(Object.values(tempExtAntes)[0]?.rodadaAtual).toBe(rodadaExtAntes);
    expect(ctx.carreira.clubes.find((c) => c.id === externo.id)).not.toBe(
      externo,
    );
    expect(ctx.carreira.temporadasExternas).not.toBe(tempExtAntes);
  }, 60_000);
});
