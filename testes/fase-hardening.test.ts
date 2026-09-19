import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  lerDadosLiga,
  salvarDadosLiga,
  definirDiretorioImportacao,
  obterDiretorioImportacao,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  tornarAgenteLivre,
  estaSemClube,
} from "@/simulacao/carreira/agente-livre";
import {
  responderProposta,
  efetivarPreContratos,
} from "@/simulacao/transferencias/mercado";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import {
  avaliarDisponibilidadeObjetivo,
  escolherObjetivo,
  rotuloObjetivo,
  atualizarObjetivoPessoal,
} from "@/simulacao/carreira/acompanhamento";
import { clubesDePaisesDiferentes } from "@/simulacao/transferencias/pais-clube";
import {
  ajustarClubePeloJogador,
  aproximarReservaEntrante,
} from "@/simulacao/partida/motor-partida";
import {
  hidratarElencoClube,
  criarJogadorMundo,
} from "@/dominio/jogador-mundo";
import { categoriaPartidaDaSemana } from "@/simulacao/base/formacao";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import {
  serializarCarreira,
  hidratarCarreira,
} from "@/infraestrutura/persistencia/carreira-persistida";
import { criarAtributosUniformes } from "@/dominio/regras/jogador";
import type {
  Clube,
  Jogador,
  JogadorExterno,
  JogadorMundo,
} from "@/dominio/entidades/modelos";
import { somarDias } from "@/utilitarios/formatacao";

const dirOriginal = obterDiretorioImportacao();
const limpeza: string[] = [];

afterEach(async () => {
  definirDiretorioImportacao(dirOriginal);
  for (const d of limpeza.splice(0))
    await rm(d, { recursive: true, force: true });
});

function clubeMin(ligaId: string, n: number, elenco?: JogadorExterno[]): Clube {
  const j =
    elenco?.[0] ??
    ({
      id: `p${n}`,
      idExterno: n,
      idTransfermarkt: String(n),
      nome: `J${n}`,
      dataNascimento: "1999-01-01",
      idade: 26,
      nacionalidade: ["Brasil"],
      posicao: "Centre-Forward",
      grupoPosicao: "ATA",
      peDominante: "direito",
      altura: 180,
      numero: 9,
      valorMercado: 1_000_000,
      contratoAte: null,
      joinedOn: null,
      signedFrom: null,
      foto: "",
    } as JogadorExterno);
  return {
    id: `${ligaId}-${n}`,
    idExterno: n,
    idTransfermarkt: String(n),
    ligaId,
    nome: `Clube ${n}`,
    nomeCurto: `C${n}`,
    nomeOficial: `Clube ${n}`,
    codigo: `C${n}`,
    pais: "Brasil",
    fundacao: 1900,
    escudo: "",
    estadio: "A",
    capacidadeEstadio: 1,
    tamanhoElenco: 1,
    idadeMedia: 25,
    valorElenco: 1,
    registroTransferencias: null,
    formacaoPreferida: "4-3-3",
    goleiroTitularId: null,
    titularesIds: [],
    bancoIds: [],
    reputacao: 70,
    forcaGeral: 70,
    forcaAtaque: 70,
    forcaMeio: 70,
    forcaDefesa: 70,
    qualidadeBase: 60,
    poderFinanceiro: 50,
    orcamento: 1,
    forma: 70,
    moral: 70,
    fadiga: 10,
    dadosBrutos: null,
    elenco: [j],
  } as unknown as Clube;
}

async function salvarOficial(
  dir: string,
  ligaId: string,
  enriquecido: boolean,
) {
  const agora = new Date().toISOString();
  const elenco = [
    {
      ...clubeMin(ligaId, 1).elenco[0]!,
      overall: 75,
      potencial: 80,
      ...(enriquecido
        ? {
            ratingMetadata: {
              source: "external",
              confidence: "high",
              minutes: 2000,
              appearances: 30,
              season: "1",
            },
          }
        : {}),
    },
  ];
  await salvarDadosLiga(
    {
      ligaId,
      temporada: 2026,
      temporadaTransfermarkt: "2025",
      inicio: "2026-01-28",
      importadoEm: agora,
      atualizadoEm: agora,
      status: "completo",
      progresso: { total: 2, importados: 2, falhas: 0, clubeAtual: null },
      erros: [],
      clubes: [
        { ...clubeMin(ligaId, 1), elenco: elenco as never },
        clubeMin(ligaId, 2),
      ],
    },
    dir,
  );
}

describe("Hardening — agente livre / objetivos / semana", () => {
  it("renovação pendente não aceita após virar agente livre", () => {
    const { carreira } = exemploCarreira();
    carreira.propostas.push({
      id: "ren-1",
      clubeId: carreira.clubeAtualId!,
      tipo: "renovacao",
      status: "pendente",
      etapa: "proposta_jogador",
      salario: carreira.jogador.contrato.salario,
      validade: somarDias(carreira.dataAtual, 28),
      anosContrato: 3,
    } as never);
    tornarAgenteLivre(carreira);
    expect(estaSemClube(carreira)).toBe(true);
    expect(carreira.propostas.find((p) => p.id === "ren-1")!.status).toBe(
      "expirada",
    );
    expect(() => responderProposta(carreira, "ren-1", true)).toThrow();
  });

  it("objetivos impossíveis bloqueados e transferencia reconhece novo-clube", () => {
    const { carreira } = exemploCarreira();
    tornarAgenteLivre(carreira);
    expect(avaliarDisponibilidadeObjetivo(carreira, "titular").disponivel).toBe(
      false,
    );
    expect(
      avaliarDisponibilidadeObjetivo(carreira, "transferencia").disponivel,
    ).toBe(true);
    expect(rotuloObjetivo(carreira, "transferencia")).toMatch(/clube/i);
    expect(() => escolherObjetivo(carreira, "renovacao")).toThrow();
    const c2 = escolherObjetivo(carreira, "transferencia");
    c2.eventos.push({
      id: "e1",
      tipo: "novo-clube",
      data: c2.dataAtual,
      titulo: "Assinou",
      texto: "x",
      autor: "Agente",
      importante: false,
    } as never);
    atualizarObjetivoPessoal(c2);
    expect(c2.acompanhamento.objetivoPessoal?.concluido).toBe(true);
  });

  it("acordo futuro efetivado antes do treino na mesma semana", () => {
    const { carreira } = exemploCarreira();
    const destino = carreira.clubes.find(
      (c) => c.id !== carreira.clubeAtualId,
    )!;
    destino.orcamento = 50_000_000;
    const dataChegada = somarDias(carreira.dataAtual, 7);
    carreira.propostas.push({
      id: "fut-1",
      clubeId: destino.id,
      clubeOrigemId: carreira.clubeAtualId!,
      tipo: "transferencia",
      status: "aceita",
      etapa: "acordo_futuro",
      salario: 3000,
      validade: dataChegada,
      efetivarEm: dataChegada,
      duracaoAnos: 3,
      acordoFuturo: true,
      valorTransferencia: 100_000,
      papelPrometido: "rotacao",
    } as never);
    const depois = avancarSemana(carreira);
    expect(depois.clubeAtualId).toBe(destino.id);
  });

  it("pré-contrato internacional compara país, não liga", () => {
    const a = { pais: "Inglaterra", ligaId: "premier-league" } as Clube;
    const b = { pais: "Inglaterra", ligaId: "championship" } as Clube;
    const c = { pais: "Espanha", ligaId: "la-liga" } as Clube;
    expect(clubesDePaisesDiferentes(a, b)).toBe(false);
    expect(clubesDePaisesDiferentes(a, c)).toBe(true);
  });
});

describe("Hardening — substituições e hydrate", () => {
  function userSetorial(
    posicao: Jogador["posicao"],
    overall: number,
    attrsExtra?: Partial<ReturnType<typeof criarAtributosUniformes>>,
  ): Jogador {
    const atributos = criarAtributosUniformes(overall);
    Object.assign(atributos, attrsExtra);
    return {
      posicao,
      overall,
      atributos,
      forma: 70,
      moral: 70,
      condicionamento: 90,
      fadiga: 10,
    } as Jogador;
  }

  function clubeForcas(base = 70): Clube {
    return {
      forcaAtaque: base,
      forcaMeio: base,
      forcaDefesa: base,
      forcaGeral: base,
      elenco: [],
      bancoIds: [],
      titularesIds: [],
      goleiroTitularId: null,
    } as unknown as Clube;
  }

  it("1) titular 90' ignora reserva (ajuste só qualidade×overall)", () => {
    const user = userSetorial("CA", 80, { finalizacao: 90 });
    const clube = clubeForcas(70);
    const semReserva = ajustarClubePeloJogador(clube, user, 90, true);
    const comReservaFraca = ajustarClubePeloJogador(clube, user, 90, true, {
      overall: 40,
      posicao: "CA",
    });
    expect(semReserva.forcaAtaque).toBe(comReservaFraca.forcaAtaque);
    expect(semReserva.forcaAtaque).toBeGreaterThan(clube.forcaAtaque);
  });

  it("2) titular 60' + reserva 30' cobre o slot restante", () => {
    const user = userSetorial("CA", 80, { finalizacao: 88 });
    const clube = clubeForcas(70);
    const semCobertura = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 1,
      posicao: "CA",
    });
    const comReserva = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 78,
      posicao: "CA",
    });
    expect(comReserva.forcaAtaque).toBeGreaterThan(semCobertura.forcaAtaque);
  });

  it("3) titular 30' + reserva 60' depende mais da reserva", () => {
    const user = userSetorial("CA", 70, { finalizacao: 70 });
    const clube = clubeForcas(70);
    const reservaFraca = ajustarClubePeloJogador(clube, user, 30, true, {
      overall: 50,
      posicao: "CA",
    });
    const reservaForte = ajustarClubePeloJogador(clube, user, 30, true, {
      overall: 90,
      posicao: "CA",
    });
    expect(reservaForte.forcaAtaque).toBeGreaterThan(reservaFraca.forcaAtaque);
    const delta30 = reservaForte.forcaAtaque - reservaFraca.forcaAtaque;
    const reservaFraca60 = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 50,
      posicao: "CA",
    });
    const reservaForte60 = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 90,
      posicao: "CA",
    });
    const delta60 = reservaForte60.forcaAtaque - reservaFraca60.forcaAtaque;
    expect(delta30).toBeGreaterThan(delta60);
  });

  it("4) entrada do banco remove contribuição do titular substituído", () => {
    const user = userSetorial("CA", 80, { finalizacao: 90 });
    const clube = clubeForcas(70);
    const fraco = ajustarClubePeloJogador(clube, user, 30, false, {
      overall: 78,
      posicao: "CA",
    });
    const forte = ajustarClubePeloJogador(
      clube,
      userSetorial("CA", 88, { finalizacao: 95 }),
      30,
      false,
      { overall: 70, posicao: "CA" },
    );
    expect(forte.forcaAtaque).toBeGreaterThan(fraco.forcaAtaque);
  });

  it("5) reserva melhor/pior melhora/piora o restante do titular", () => {
    const user = userSetorial("MEI", 75);
    const clube = clubeForcas(72);
    const pior = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 55,
      posicao: "MEI",
    });
    const melhor = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: 88,
      posicao: "MEI",
    });
    expect(melhor.forcaMeio).toBeGreaterThan(pior.forcaMeio);
  });

  it("6) goleiro titular que sai cedo recebe cobertura defensiva da reserva", () => {
    const gk = userSetorial("GOL", 78);
    const clube = clubeForcas(70);
    const reservaFraca = ajustarClubePeloJogador(clube, gk, 60, true, {
      overall: 50,
      posicao: "GOL",
    });
    const reservaForte = ajustarClubePeloJogador(clube, gk, 60, true, {
      overall: 86,
      posicao: "GOL",
    });
    expect(reservaForte.forcaDefesa).toBeGreaterThan(reservaFraca.forcaDefesa);
  });

  it("7) sem reserva ideal usa fallback seguro (forcaGeral)", () => {
    const user = userSetorial("CA", 80);
    const clube = clubeForcas(70);
    const viaNull = ajustarClubePeloJogador(clube, user, 60, true, null);
    const viaMedia = ajustarClubePeloJogador(clube, user, 60, true, {
      overall: clube.forcaGeral,
      posicao: "CA",
    });
    expect(viaNull.forcaAtaque).toBe(viaMedia.forcaAtaque);
    expect(aproximarReservaEntrante(clube, "CA")).toBeNull();
  });

  it("8) entrada do banco não faz double-counting do titular", () => {
    const user = userSetorial("CA", 70, { finalizacao: 70 });
    const clube = clubeForcas(70);
    const mesmoNivel = ajustarClubePeloJogador(clube, user, 30, false, {
      overall: 70,
      posicao: "CA",
    });
    // Qualidade≈overall → delta pequeno; double-count deixaria o ataque bem abaixo.
    expect(Math.abs(mesmoNivel.forcaAtaque - clube.forcaAtaque)).toBeLessThan(
      4,
    );
    const titularForteSai = ajustarClubePeloJogador(clube, user, 30, false, {
      overall: 92,
      posicao: "CA",
    });
    expect(titularForteSai.forcaAtaque).toBeLessThan(mesmoNivel.forcaAtaque);
  });

  it("aproximarReservaEntrante prioriza posição principal no banco", () => {
    const ca = {
      id: "ca1",
      posicaoPrincipal: "CA",
      posicoesSecundarias: [],
      overall: 71,
    } as unknown as JogadorMundo;
    const mei = {
      id: "mei1",
      posicaoPrincipal: "MEI",
      posicoesSecundarias: ["CA"],
      overall: 80,
    } as unknown as JogadorMundo;
    const clube = {
      ...clubeForcas(),
      elenco: [mei, ca],
      bancoIds: ["mei1", "ca1"],
    } as Clube;
    const escolhido = aproximarReservaEntrante(clube, "CA");
    expect(escolhido?.overall).toBe(71);
    const soSec = {
      ...clubeForcas(),
      elenco: [mei],
      bancoIds: ["mei1"],
    } as Clube;
    expect(aproximarReservaEntrante(soSec, "CA")?.overall).toBe(80);
  });

  it("hidrata snapshot enriquecido preservando overall/potencial/atributos", () => {
    const liga = LIGAS_SUPORTADAS[0]!;
    const attrs = criarAtributosUniformes(72);
    attrs.finalizacao = 85;
    const bruto = {
      id: "x1",
      idExterno: 1,
      idTransfermarkt: "1",
      nome: "Rico",
      idade: 24,
      numero: 9,
      posicao: "Centre-Forward",
      grupoPosicao: "ATA" as const,
      nacionalidade: ["Brasil"],
      altura: 180,
      peDominante: "direito",
      valorMercado: 5_000_000,
      dataNascimento: "2000-01-01",
      contratoAte: null,
      joinedOn: null,
      signedFrom: null,
      foto: "",
      overall: 79,
      potencial: 84,
      atributos: attrs,
      ratingMetadata: {
        source: "external",
        confidence: "high",
        minutes: 2000,
        appearances: 30,
        season: "1",
      },
    };
    const out = hidratarElencoClube(
      [bruto as never],
      { id: "c", reputacao: 80, forcaGeral: 75 },
      liga,
    );
    expect(out[0]!.overall).toBe(79);
    expect(out[0]!.potencial).toBe(84);
    expect(out[0]!.atributos?.finalizacao).toBe(85);
    expect(out[0]!.posicaoPrincipal).toBe("CA");
    expect(Array.isArray(out[0]!.posicoesSecundarias)).toBe(true);
    expect(typeof out[0]!.forma).toBe("number");
    expect(typeof out[0]!.moral).toBe("number");
    const criado = criarJogadorMundo(bruto as never, {
      clubeId: "c",
      reputacaoClube: 80,
      reputacaoLiga: 85,
      forcaClube: 75,
      indiceNoElenco: 0,
      tamanhoElenco: 1,
    });
    expect(criado.atributos?.finalizacao).toBe(85);
  });

  it("base convocada ao pro: identidade promessa, partida profissional (sem Sub-20)", () => {
    const { carreira } = exemploCarreira();
    carreira.jogador.categoria = "base";
    carreira.jogador.idade = 18;
    carreira.jogador.confianca = 75;
    carreira.jogador.overall = 72;
    const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!;
    carreira.jogador.overall = Math.max(
      carreira.jogador.overall,
      clube.forcaGeral - 5,
    );
    const colega = clube.elenco.find(
      (n) => n.posicaoPrincipal === carreira.jogador.posicao,
    );
    if (colega) {
      colega.lesionado = true;
    } else {
      clube.elenco[0]!.posicaoPrincipal = carreira.jogador.posicao;
      clube.elenco[0]!.lesionado = true;
    }
    carreira.acompanhamento.base = {
      ...carreira.acompanhamento.base,
      conviteAte: somarDias(carreira.dataAtual, 14),
      treinosProfissional: 3,
    };

    const ehDaBase = carreira.jogador.categoria === "base";
    const categoriaPartida = categoriaPartidaDaSemana(carreira);
    const jogaBaseNestaSemana = categoriaPartida === "base";

    expect(ehDaBase).toBe(true);
    expect(categoriaPartida).toBe("profissional");
    expect(jogaBaseNestaSemana).toBe(false);
    // UI: rótulo de identidade vs confronto
    expect(ehDaBase ? "PROMESSA DA BASE" : "SEU JOGADOR").toBe(
      "PROMESSA DA BASE",
    );
    expect(jogaBaseNestaSemana ? " / Sub-20" : "").toBe("");
  });

  it("save round-trip preserva agente livre", () => {
    const { carreira, catalogo } = exemploCarreira();
    tornarAgenteLivre(carreira);
    const s = serializarCarreira(carreira);
    const h = hidratarCarreira(s, catalogo);
    expect(h.clubeAtualId).toBeNull();
    expect(estaSemClube(h)).toBe(true);
  });
});
