import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { REGRAS_MOVIMENTO_PARES } from "@/dominio/constantes/regras-movimento";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import {
  finalizarTemporada,
  iniciarProximaTemporada,
} from "@/aplicacao/casos-de-uso/temporada";
import {
  serializarCarreira,
  hidratarCarreira,
} from "@/infraestrutura/persistencia/carreira-persistida";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import {
  aplicarMovimentoPar,
  contagemClubesPorLiga,
} from "@/simulacao/mundo/promocao-rebaixamento";
import { resolverPlayoffAcesso } from "@/simulacao/mundo/playoff-divisao";
import { obterZonaClassificacao } from "@/dominio/constantes/zonas-classificacao";
import type {
  EstadoCarreira,
  LinhaClassificacao,
  Temporada,
} from "@/dominio/entidades/modelos";

function linha(
  clubeId: string,
  posicao: number,
  pontos: number,
): LinhaClassificacao {
  return {
    clubeId,
    posicao,
    jogos: 38,
    pontos,
    vitorias: Math.floor(pontos / 3),
    empates: pontos % 3,
    derrotas: 0,
    golsPro: 40,
    golsContra: 20,
    saldo: 20,
  };
}

function forcarClassificacao(t: Temporada, idsOrdenados: string[]) {
  t.classificacao = idsOrdenados.map((id, i) =>
    linha(id, i + 1, (idsOrdenados.length - i) * 3),
  );
  t.classificacaoBase = t.classificacao.map((l) => ({ ...l }));
  t.rodadaAtual = t.totalRodadas;
  // Não marcar encerrada aqui — finalizarTemporada precisa arquivar.
}

function carreiraPar(
  superiorId: string,
  inferiorId: string,
  seed: string,
  nSup?: number,
  nInf?: number,
) {
  const superior = LIGAS_SUPORTADAS.find((l) => l.id === superiorId)!;
  const inferior = LIGAS_SUPORTADAS.find((l) => l.id === inferiorId)!;
  const qs = nSup ?? Math.min(superior.quantidadeClubes, 8);
  const qi = nInf ?? Math.min(inferior.quantidadeClubes, 8);
  const clubesSup = gerarClubesDemonstracao(superior).slice(0, qs);
  const clubesInf = gerarClubesDemonstracao(inferior).slice(0, qi);
  return criarCarreira({
    identidade: {
      nome: "Kaue",
      sobrenome: "Divisao",
      nacionalidade: "Brasil",
      idade: 18,
      posicao: "MEI",
      posicaoSecundaria: "MC",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "criador",
    },
    liga: superior,
    clubes: clubesSup,
    clubeId: clubesSup[0]!.id,
    origem: "demonstracao",
    seed,
    dataInicio: "2026-01-05",
    ligasMundo: [inferior],
    clubesMundo: clubesInf,
  });
}

function idsDaLiga(c: EstadoCarreira, ligaId: string) {
  return c.clubes.filter((cl) => cl.ligaId === ligaId).map((cl) => cl.id);
}

describe("regras de movimento (config)", () => {
  it("define pares para os 6 países do catálogo", () => {
    expect(REGRAS_MOVIMENTO_PARES.map((p) => p.id).sort()).toEqual([
      "alemanha",
      "brasil",
      "espanha",
      "franca",
      "inglaterra",
      "italia",
    ]);
  });

  it("Espanha/Itália/França: regras configuradas (acesso + playoff)", () => {
    const es = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "espanha")!;
    expect(es.rebaixamentoDireto).toBe(3);
    expect(es.promocaoDireta).toBe(2);
    expect(es.playoffAcesso?.posicoes).toEqual([3, 4, 5, 6]);

    const it = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "italia")!;
    expect(it.rebaixamentoDireto).toBe(3);
    expect(it.promocaoDireta).toBe(2);
    expect(it.playoffAcesso?.chave).toBe("chave_4");
    expect(it.nota).toMatch(/simplificação/i);

    const fr = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "franca")!;
    expect(fr.rebaixamentoDireto).toBe(2);
    expect(fr.playoffRebaixamentoPosicoes).toEqual([16]);
    expect(fr.playoffAcesso?.chave).toBe("chave_3");
    expect(fr.playoffInterdivisional?.adversarioInferior).toBe("playoff");
  });

  it("Série B não rebaixa para divisão inexistente", () => {
    const br = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "brasil")!;
    expect(br.divisaoInferiorId).toBe("brasileirao-b");
    // Não há par brasileirao-b → série C no catálogo
    expect(
      REGRAS_MOVIMENTO_PARES.some((p) => p.divisaoSuperiorId === "brasileirao-b"),
    ).toBe(false);
  });

  it("zonas de UI derivam rebaixamento/acesso das regras de movimento", () => {
    const opts = {
      temporadaEncerrada: false,
      ligasNoUniverso: LIGAS_SUPORTADAS.map((l) => l.id),
    };
    expect(obterZonaClassificacao("brasileirao", 18, opts).tipo).toBe(
      "rebaixamento",
    );
    expect(obterZonaClassificacao("brasileirao-b", 3, opts).tipo).toBe(
      "acesso",
    );
    expect(obterZonaClassificacao("championship", 4, opts).tipo).toBe(
      "playoff_acesso",
    );
    expect(obterZonaClassificacao("bundesliga", 16, opts).tipo).toBe(
      "playoff_rebaixamento",
    );
  });
});

describe("Brasil — 4 rebaixados / 4 promovidos", () => {
  it("troca 4 clubes atomicamente e preserva contagens", () => {
    let c = carreiraPar("brasileirao", "brasileirao-b", "br-mov-1", 8, 8);
    const idsA = idsDaLiga(c, "brasileirao");
    const idsB = idsDaLiga(c, "brasileirao-b");
    forcarClassificacao(c.temporada, idsA);
    forcarClassificacao(c.temporadasExternas["brasileirao-b"]!, idsB);
    c.temporadasExternas["brasileirao-b"]!.encerrada = true;
    c.temporadasExternas["brasileirao-b"]!.rodadaAtual =
      c.temporadasExternas["brasileirao-b"]!.totalRodadas;
    c = finalizarTemporada(c);

    const rebaixados = idsA.slice(-4);
    const promovidos = idsB.slice(0, 4);

    c = iniciarProximaTemporada(c);

    for (const id of rebaixados) {
      expect(c.clubes.find((x) => x.id === id)!.ligaId).toBe("brasileirao-b");
    }
    for (const id of promovidos) {
      expect(c.clubes.find((x) => x.id === id)!.ligaId).toBe("brasileirao");
    }
    const cont = contagemClubesPorLiga(c);
    expect(cont["brasileirao"]).toBe(8);
    expect(cont["brasileirao-b"]).toBe(8);
    expect(new Set(c.clubes.map((x) => x.id)).size).toBe(c.clubes.length);
  });
});

describe("Inglaterra — playoff Championship", () => {
  it("promove 2 diretos + 1 playoff e rebaixa 3", () => {
    let c = carreiraPar("premier-league", "championship", "en-mov-1", 8, 8);
    const idsPL = idsDaLiga(c, "premier-league");
    const idsCh = idsDaLiga(c, "championship");
    forcarClassificacao(c.temporada, idsPL);
    forcarClassificacao(c.temporadasExternas.championship!, idsCh);
    c.temporadasExternas.championship!.encerrada = true;
    c.temporadasExternas.championship!.rodadaAtual =
      c.temporadasExternas.championship!.totalRodadas;
    c = finalizarTemporada(c);
    const antes = structuredClone(c);
    c = iniciarProximaTemporada(c);

    const naPL = idsDaLiga(c, "premier-league");
    expect(naPL).toHaveLength(8);
    // Dois primeiros da Championship sobem com certeza
    expect(naPL).toContain(idsCh[0]);
    expect(naPL).toContain(idsCh[1]);
    // Três últimos da PL descem
    for (const id of idsPL.slice(-3)) {
      expect(c.clubes.find((x) => x.id === id)!.ligaId).toBe("championship");
    }
    // Playoff determinístico
    const a = iniciarProximaTemporada(structuredClone(antes));
    const b = iniciarProximaTemporada(structuredClone(antes));
    expect(idsDaLiga(a, "premier-league").sort()).toEqual(
      idsDaLiga(b, "premier-league").sort(),
    );
    expect(a.estadoAleatorio).toBe(b.estadoAleatorio);
  });
});

describe("Alemanha — playoff interdivisional", () => {
  it("2 rebaixamentos diretos e playoff 16º × 3º", () => {
    const regras = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "alemanha")!;
    let c = carreiraPar("bundesliga", "bundesliga-2", "de-mov-1", 8, 8);
    const ids1 = idsDaLiga(c, "bundesliga");
    const ids2 = idsDaLiga(c, "bundesliga-2");
    forcarClassificacao(c.temporada, ids1);
    forcarClassificacao(c.temporadasExternas["bundesliga-2"]!, ids2);
    c.temporada.encerrada = true;
    c.temporadasExternas["bundesliga-2"]!.encerrada = true;

    const aleatorio = new GeradorAleatorio(c.estadoAleatorio);
    aplicarMovimentoPar(c, regras, aleatorio);

    // 17º e 18º (índices 6 e 7 em tabela de 8) rebaixados
    expect(c.clubes.find((x) => x.id === ids1[6])!.ligaId).toBe(
      "bundesliga-2",
    );
    expect(c.clubes.find((x) => x.id === ids1[7])!.ligaId).toBe(
      "bundesliga-2",
    );
    // 1º e 2º da 2.BL sobem
    expect(c.clubes.find((x) => x.id === ids2[0])!.ligaId).toBe("bundesliga");
    expect(c.clubes.find((x) => x.id === ids2[1])!.ligaId).toBe("bundesliga");
    // 16º (índice 5) e 3º da 2.BL: um sobe, um fica — troca ou permanece
    const p16 = c.clubes.find((x) => x.id === ids1[5])!;
    const p3 = c.clubes.find((x) => x.id === ids2[2])!;
    expect(
      (p16.ligaId === "bundesliga" && p3.ligaId === "bundesliga-2") ||
        (p16.ligaId === "bundesliga-2" && p3.ligaId === "bundesliga"),
    ).toBe(true);
  });
});

describe("clube do jogador muda de liga", () => {
  it("promove o clube do jogador e atualiza carreira.liga", () => {
    let c = carreiraPar("brasileirao", "brasileirao-b", "jog-sobe-1", 8, 8);
    // Jogador no 1º da Série B
    const idsB = idsDaLiga(c, "brasileirao-b");
    const idsA = idsDaLiga(c, "brasileirao");
    c.clubeAtualId = idsB[0]!;
    // Swap temporadas para o jogador estar na B
    const tempB = c.temporadasExternas["brasileirao-b"]!;
    c.temporadasExternas[c.liga.id] = c.temporada;
    c.temporada = tempB;
    delete c.temporadasExternas["brasileirao-b"];
    c.liga = c.ligas.find((l) => l.id === "brasileirao-b")!;

    forcarClassificacao(c.temporada, idsB);
    forcarClassificacao(c.temporadasExternas.brasileirao!, idsA);
    // Liga externa também precisa estar encerrada antes do movimento atômico
    c.temporadasExternas.brasileirao!.encerrada = true;
    c.temporadasExternas.brasileirao!.rodadaAtual =
      c.temporadasExternas.brasileirao!.totalRodadas;
    c = finalizarTemporada(c);
    c = iniciarProximaTemporada(c);

    expect(c.liga.id).toBe("brasileirao");
    expect(c.clubes.find((x) => x.id === idsB[0])!.ligaId).toBe("brasileirao");
    expect(
      c.temporada.classificacao.every((l) =>
        c.clubes.find((cl) => cl.id === l.clubeId)?.ligaId === "brasileirao",
      ),
    ).toBe(true);
    expect(
      c.temporadasAnteriores.some(
        (t) => t.ligaId === "brasileirao-b" && t.ano === 2026,
      ),
    ).toBe(true);
  });

  it("rebaixa o clube do jogador", () => {
    let c = carreiraPar("brasileirao", "brasileirao-b", "jog-desce-1", 8, 8);
    const idsA = idsDaLiga(c, "brasileirao");
    const idsB = idsDaLiga(c, "brasileirao-b");
    c.clubeAtualId = idsA[idsA.length - 1]!;
    forcarClassificacao(c.temporada, idsA);
    forcarClassificacao(c.temporadasExternas["brasileirao-b"]!, idsB);
    c.temporadasExternas["brasileirao-b"]!.encerrada = true;
    c.temporadasExternas["brasileirao-b"]!.rodadaAtual =
      c.temporadasExternas["brasileirao-b"]!.totalRodadas;
    c = finalizarTemporada(c);
    c = iniciarProximaTemporada(c);
    expect(c.liga.id).toBe("brasileirao-b");
    expect(
      c.clubes.find((x) => x.id === idsA[idsA.length - 1])!.ligaId,
    ).toBe("brasileirao-b");
  });
});

describe("playoff determinístico", () => {
  it("mesma seed → mesmo campeão de playoff chave_4", () => {
    const clubes = gerarClubesDemonstracao(
      LIGAS_SUPORTADAS.find((l) => l.id === "championship")!,
    ).slice(0, 6);
    const fmt = REGRAS_MOVIMENTO_PARES.find((p) => p.id === "inglaterra")!
      .playoffAcesso!;
    const a = resolverPlayoffAcesso(
      clubes,
      fmt,
      new GeradorAleatorio(42),
      "2026-05-01",
    );
    const b = resolverPlayoffAcesso(
      clubes,
      fmt,
      new GeradorAleatorio(42),
      "2026-05-01",
    );
    expect(a).toBe(b);
  });
});

describe("persistência após movimento", () => {
  it("serializa e hidrata carreira pós-promoção", () => {
    let c = carreiraPar("brasileirao", "brasileirao-b", "save-mov-1", 6, 6);
    forcarClassificacao(c.temporada, idsDaLiga(c, "brasileirao"));
    forcarClassificacao(
      c.temporadasExternas["brasileirao-b"]!,
      idsDaLiga(c, "brasileirao-b"),
    );
    c.temporadasExternas["brasileirao-b"]!.encerrada = true;
    c.temporadasExternas["brasileirao-b"]!.rodadaAtual =
      c.temporadasExternas["brasileirao-b"]!.totalRodadas;
    c = finalizarTemporada(c);
    c = iniciarProximaTemporada(c);
    const persistido = serializarCarreira(c);
    const clubesCatalogo = gerarClubesDemonstracao(
      LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!,
    )
      .slice(0, 6)
      .concat(
        gerarClubesDemonstracao(
          LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao-b")!,
        ).slice(0, 6),
      );
    const restaurado = hidratarCarreira(persistido, {
      ligas: LIGAS_SUPORTADAS.filter((l) =>
        c.ligas.some((x) => x.id === l.id),
      ),
      clubes: clubesCatalogo,
    });
    expect(contagemClubesPorLiga(restaurado)).toEqual(
      contagemClubesPorLiga(c),
    );
    expect(restaurado.liga.id).toBe(c.liga.id);
  });
});

describe("agente livre + próxima temporada", () => {
  it("não quebra com clubeAtualId null (t.nome)", () => {
    let c = carreiraPar("bundesliga", "bundesliga-2", "livre-null", 8, 8);
    c.clubeAtualId = null;
    c.agenteLivreDesde = c.dataAtual;
    const ids1 = idsDaLiga(c, "bundesliga");
    const ids2 = idsDaLiga(c, "bundesliga-2");
    forcarClassificacao(c.temporada, ids1);
    forcarClassificacao(c.temporadasExternas["bundesliga-2"]!, ids2);
    c.temporadasExternas["bundesliga-2"]!.encerrada = true;
    c.temporadasExternas["bundesliga-2"]!.rodadaAtual =
      c.temporadasExternas["bundesliga-2"]!.totalRodadas;
    c = finalizarTemporada(c);
    expect(() => iniciarProximaTemporada(c)).not.toThrow();
    const prox = iniciarProximaTemporada(c);
    expect(prox.clubeAtualId).toBeNull();
    expect(prox.temporada.encerrada).toBe(false);
  });
});

describe("playoffs no calendário", () => {
  it("agenda partidas de playoff quando o clube do jogador está em 4º", async () => {
    const { processarPlayoffsCalendario } = await import(
      "@/simulacao/mundo/playoffs-calendario"
    );
    let c = carreiraPar("premier-league", "championship", "po-cal-1", 8, 8);
    // Jogador na Championship em 4º
    const idsCh = idsDaLiga(c, "championship");
    const idsPL = idsDaLiga(c, "premier-league");
    c.clubeAtualId = idsCh[3]!;
    const tempCh = c.temporadasExternas.championship!;
    c.temporadasExternas[c.liga.id] = c.temporada;
    c.temporada = tempCh;
    delete c.temporadasExternas.championship;
    c.liga = c.ligas.find((l) => l.id === "championship")!;

    forcarClassificacao(c.temporada, idsCh);
    forcarClassificacao(c.temporadasExternas["premier-league"]!, idsPL);
    c.temporadasExternas["premier-league"]!.encerrada = true;
    c.temporada.rodadaAtual = c.temporada.totalRodadas;

    const ok = processarPlayoffsCalendario(
      c,
      new GeradorAleatorio(c.estadoAleatorio),
    );
    expect(ok).toBe(true);
    const playoffs = c.temporada.partidas.filter(
      (p) => p.fase === "playoff" || p.id.startsWith("playoff-"),
    );
    expect(playoffs.length).toBeGreaterThan(0);
    expect(
      playoffs.some((p) =>
        [p.mandanteId, p.visitanteId].includes(c.clubeAtualId!),
      ),
    ).toBe(true);
    expect(c.temporada.encerrada).toBe(false);
    expect(c.temporada.totalRodadas).toBeGreaterThan(c.temporada.rodadaAtual);
  });
});

describe("múltiplas temporadas", () => {
  it("5 temporadas sem duplicar/perder clubes", () => {
    let c = carreiraPar("brasileirao", "brasileirao-b", "multi-5", 8, 8);
    const total = c.clubes.length;
    for (let ano = 0; ano < 5; ano++) {
      const a = idsDaLiga(c, "brasileirao").sort();
      const b = idsDaLiga(c, "brasileirao-b").sort();
      if (c.liga.id === "brasileirao") {
        forcarClassificacao(c.temporada, a);
        forcarClassificacao(c.temporadasExternas["brasileirao-b"]!, b);
        c.temporadasExternas["brasileirao-b"]!.encerrada = true;
        c.temporadasExternas["brasileirao-b"]!.rodadaAtual =
          c.temporadasExternas["brasileirao-b"]!.totalRodadas;
      } else {
        forcarClassificacao(c.temporada, b);
        forcarClassificacao(c.temporadasExternas.brasileirao!, a);
        c.temporadasExternas.brasileirao!.encerrada = true;
        c.temporadasExternas.brasileirao!.rodadaAtual =
          c.temporadasExternas.brasileirao!.totalRodadas;
      }
      c = finalizarTemporada(c);
      c = iniciarProximaTemporada(c);
      expect(c.clubes.length).toBe(total);
      expect(new Set(c.clubes.map((x) => x.id)).size).toBe(total);
      const cont = contagemClubesPorLiga(c);
      expect(cont["brasileirao"]).toBe(8);
      expect(cont["brasileirao-b"]).toBe(8);
      expect(c.temporada.encerrada).toBe(false);
      expect(c.temporada.classificacao).toHaveLength(8);
    }
  }, 60_000);
});
