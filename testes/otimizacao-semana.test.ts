import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
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
    ligasExternas: Object.keys(c.temporadasExternas)
      .sort()
      .map((id) => ({
        id,
        rodada: c.temporadasExternas[id]!.rodadaAtual,
        top: c.temporadasExternas[id]!.classificacao[0]?.clubeId ?? null,
      })),
  };
}

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

    const ctx = prepararSemana(base);
    expect(externo.elenco[0]!.overall).toBe(overallAntes);
    expect(externo.forma).toBe(formaAntes);

    // Referência compartilhada durante prep
    const compartilhado = ctx.carreira.clubes.find((c) => c.id === externo.id)!;
    expect(compartilhado).toBe(externo);
    expect(ctx.carreira.temporadasExternas).toBe(tempExtAntes);

    simularRodadaCompleta(ctx);
    finalizarSemana(ctx);

    // Após finalizar, o original permanece intacto (COW materializou na cópia)
    expect(externo.elenco[0]!.overall).toBe(overallAntes);
    expect(externo.forma).toBe(formaAntes);
    expect(Object.values(tempExtAntes)[0]?.rodadaAtual).toBe(rodadaExtAntes);
    expect(ctx.carreira.clubes.find((c) => c.id === externo.id)).not.toBe(
      externo,
    );
    expect(ctx.carreira.temporadasExternas).not.toBe(tempExtAntes);
  });

  it("benchmark: prepararSemana (Matchday open) bem mais barato que clone total", () => {
    const base = carreiraMundoCompleto("otim-bench-v1");
    const tClone0 = performance.now();
    structuredClone(base);
    const tClone1 = performance.now();
    const tSel0 = performance.now();
    clonarCarreiraParaAvanco(base);
    const tSel1 = performance.now();
    const tPrep0 = performance.now();
    prepararSemana(base);
    const tPrep1 = performance.now();

    const cloneMs = tClone1 - tClone0;
    const selMs = tSel1 - tSel0;
    const prepMs = tPrep1 - tPrep0;

    // Clone seletivo deve ser claramente mais barato que full clone.
    expect(selMs).toBeLessThan(cloneMs * 0.55);
    // Abrir Matchday ≈ prepararSemana; em máquina comum deve ficar < 400ms.
    expect(prepMs).toBeLessThan(Math.max(400, cloneMs * 0.7));
  });
});
