import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import {
  prepararSemana,
  simularRodadaCompleta,
  finalizarSemana,
  iniciarMatchdayInterativo,
  avancarMotorCausal,
  responderDecisaoMotor,
  finalizarMotorCausal,
  aplicarResultadoMatchday,
} from "@/aplicacao/casos-de-uso/fases-semana";
import {
  simularPartida,
  ajustarClubePeloJogador,
} from "@/simulacao/partida/motor-partida";
import {
  aplicarOpcaoDecisaoPartida,
} from "@/simulacao/partida/motor-causal";
import { criarModificadoresNeutros } from "@/dominio/matchday";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { gerarCenasSemana } from "@/simulacao/cenas/motor-cenas";
import { responderDecisao } from "@/simulacao/decisoes/decisoes";
import { criarHistoricoCenas } from "@/dominio/cenas";
import { criarAtributosUniformes } from "@/dominio/regras/jogador";

const liga = LIGAS_SUPORTADAS[0];
const clubes = gerarClubesDemonstracao(liga);

function nova(seed = "fase-matchday-causal") {
  return criarCarreira({
    identidade: {
      nome: "Kauê",
      sobrenome: "Silva",
      nacionalidade: "Brasil",
      idade: 18,
      posicao: "PD",
      posicaoSecundaria: "CA",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "velocista",
    },
    liga,
    clubes,
    clubeId: clubes[0].id,
    origem: "demonstracao",
    seed,
    dataInicio: "2026-01-05",
  });
}

describe("motor causal", () => {
  it("é determinístico com o mesmo seed de RNG", () => {
    const c = nova();
    const partida = c.temporada.partidas.find((p) => p.rodada === 1)!;
    const mandante = c.clubes.find((x) => x.id === partida.mandanteId)!;
    const visitante = c.clubes.find((x) => x.id === partida.visitanteId)!;
    const a = simularPartida(
      { ...partida, golsMandante: null, golsVisitante: null, eventos: [] },
      mandante,
      visitante,
      new GeradorAleatorio(42),
    );
    const b = simularPartida(
      { ...partida, golsMandante: null, golsVisitante: null, eventos: [] },
      mandante,
      visitante,
      new GeradorAleatorio(42),
    );
    expect(a.golsMandante).toBe(b.golsMandante);
    expect(a.golsVisitante).toBe(b.golsVisitante);
    expect(a.eventos.map((e) => e.texto)).toEqual(b.eventos.map((e) => e.texto));
  });

  it("atributos ofensivos aumentam gols esperados do clube ajustado", () => {
    const base = clubes[0];
    const fraco = {
      ...nova().jogador,
      atributos: criarAtributosUniformes(40),
      overall: 40,
      posicao: "CA" as const,
    };
    const forte = {
      ...fraco,
      atributos: { ...criarAtributosUniformes(40), finalizacao: 95, posicionamento: 90, compostura: 88 },
      overall: 78,
    };
    const clubeFraco = ajustarClubePeloJogador(base, fraco, 90, false);
    const clubeForte = ajustarClubePeloJogador(base, forte, 90, false);
    expect(clubeForte.forcaAtaque).toBeGreaterThan(clubeFraco.forcaAtaque);
  });

  it("estatísticas do jogador são coerentes com os eventos", () => {
    const c = nova("stats-coerentes");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    let carreira = c;
    for (let i = 0; i < 4; i++) carreira = avancarSemana(carreira);
    const partida = [
      ...carreira.temporada.partidas,
      ...carreira.temporada.partidasBase,
    ].find((p) => p.id === carreira.ultimaPartidaId);
    if (!partida?.participacao || partida.participacao.minutos === 0) return;
    const p = partida.participacao;
    expect(p.chutes).toBeGreaterThanOrEqual(p.gols);
    expect(p.passesChave).toBeGreaterThanOrEqual(p.assistencias);
    const golsEvento = partida.eventos.filter(
      (e) => e.tipo === "gol" && e.jogador && e.texto.includes("Gol de Kauê"),
    ).length;
    expect(p.gols).toBe(golsEvento);
  });

  it("decisão agressiva após amarelo altera modificadores", () => {
    const base = criarModificadoresNeutros();
    const agres = aplicarOpcaoDecisaoPartida(base, "amarelo", "agressivo");
    const calmo = aplicarOpcaoDecisaoPartida(base, "amarelo", "neutro");
    expect(agres.agressividade).toBeGreaterThan(calmo.agressividade);
    expect(agres.risco).toBeGreaterThan(calmo.risco);
  });

  it("decisões durante a partida podem alterar o placar vs caminho neutro", () => {
    const c = nova("decisao-altera");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    c.jogador.fadiga = 80;
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId || !ctx.clube) return;

    const mapa = new Map(ctx.carreira.clubes.map((x) => [x.id, x]));
    const partida = [
      ...ctx.carreira.temporada.partidas,
      ...ctx.carreira.temporada.partidasBase,
    ].find((p) => p.id === ctx.partidaUsuarioId)!;

    const rngA = new GeradorAleatorio(ctx.aleatorio.estado);
    const neutro = simularPartida(
      { ...partida },
      mapa.get(partida.mandanteId)!,
      mapa.get(partida.visitanteId)!,
      rngA,
      ctx.carreira.jogador,
      ctx.clube.id,
      0,
      {
        escalacaoPreparada: ctx.escalacaoPreparada ?? undefined,
        elencoProfissional: true,
        instrucao: ctx.briefing?.instrucao,
        decisoesAplicadas: [{ tipo: "fadiga", opcao: "neutro" }],
      },
    );

    const rngB = new GeradorAleatorio(ctx.aleatorio.estado);
    const arriscado = simularPartida(
      { ...partida },
      mapa.get(partida.mandanteId)!,
      mapa.get(partida.visitanteId)!,
      rngB,
      ctx.carreira.jogador,
      ctx.clube.id,
      0,
      {
        escalacaoPreparada: ctx.escalacaoPreparada ?? undefined,
        elencoProfissional: true,
        instrucao: ctx.briefing?.instrucao,
        decisoesAplicadas: [
          { tipo: "fadiga", opcao: "sair" },
          { tipo: "perdendo", opcao: "protagonismo" },
          { tipo: "intervalo-ruim", opcao: "risco" },
        ],
        modificadores: aplicarOpcaoDecisaoPartida(
          criarModificadoresNeutros(),
          "perdendo",
          "protagonismo",
        ),
      },
    );

    // Podem coincidir em placar raro; ao menos a participação/minutos deve divergir com pedir saída
    const divergiu =
      neutro.golsMandante !== arriscado.golsMandante ||
      neutro.golsVisitante !== arriscado.golsVisitante ||
      neutro.participacao?.minutos !== arriscado.participacao?.minutos ||
      neutro.participacao?.gols !== arriscado.participacao?.gols;
    expect(divergiu).toBe(true);
  });
});

describe("Matchday instantâneo vs interativo", () => {
  it("produz o mesmo placar quando nenhuma decisão extra é tomada", () => {
    const seed = "matchday-paridade";
    const c1 = nova(seed);
    c1.jogador.categoria = "profissional";
    c1.jogador.status = "titular";

    const ctxInstant = prepararSemana(structuredClone(c1));
    simularRodadaCompleta(ctxInstant);
    const fimInstant = finalizarSemana(ctxInstant);
    const pInstant = [
      ...fimInstant.temporada.partidas,
      ...fimInstant.temporada.partidasBase,
    ].find((p) => p.id === fimInstant.ultimaPartidaId);

    const ctxInter = prepararSemana(structuredClone(c1));
    if (!ctxInter.partidaUsuarioId) {
      expect(pInstant).toBeTruthy();
      return;
    }
    const { ctx, motor } = iniciarMatchdayInterativo(ctxInter);
    let m = avancarMotorCausal(motor, ctx.aleatorio, 90);
    while (m.decisaoPendente) {
      m = responderDecisaoMotor(m, "neutro", ctx.aleatorio);
    }
    if (!m.concluido) m = finalizarMotorCausal(m, ctx.aleatorio);
    aplicarResultadoMatchday(ctx, m.partida);
    const fimInter = finalizarSemana(ctx);
    const pInter = [
      ...fimInter.temporada.partidas,
      ...fimInter.temporada.partidasBase,
    ].find((p) => p.id === fimInter.ultimaPartidaId);

    expect(pInstant?.golsMandante).toBe(pInter?.golsMandante);
    expect(pInstant?.golsVisitante).toBe(pInter?.golsVisitante);
    expect(pInstant?.participacao?.minutos).toBe(pInter?.participacao?.minutos);
    expect(pInstant?.participacao?.escalacao).toBe(pInter?.participacao?.escalacao);
  });

  it("respeita titular, banco e fora da lista na participação", () => {
    const c = nova("escalacao-status");
    c.jogador.categoria = "profissional";
    for (const esc of ["titular", "banco", "nao relacionado"] as const) {
      const ctx = prepararSemana(structuredClone(c));
      if (!ctx.partidaUsuarioId || !ctx.clube) continue;
      ctx.escalacaoPreparada = esc;
      if (ctx.briefing) ctx.briefing.escalacao = esc;
      simularRodadaCompleta(ctx);
      const partida = [
        ...ctx.carreira.temporada.partidas,
        ...ctx.carreira.temporada.partidasBase,
      ].find((p) => p.id === ctx.partidaUsuarioId);
      expect(partida?.participacao?.escalacao).toBe(esc);
      if (esc === "nao relacionado") {
        expect(partida?.participacao?.minutos).toBe(0);
      }
    }
  });
});

describe("Career Scene Engine", () => {
  it("não repete cena do mesmo tipo dentro do cooldown", () => {
    const c = nova("cenas-cooldown");
    c.acompanhamento.cenas = criarHistoricoCenas();
    c.acompanhamento.cenas.cooldowns["elogio-sequencia"] = c.dataAtual;
    c.jogador.notasRecentes = [7.5, 7.8, 8.0];
    const antes = structuredClone(c);
    const rng = new GeradorAleatorio(9);
    gerarCenasSemana(c, antes, rng);
    expect(
      c.decisoes.some((d) => d.tipo === "cena:elogio-sequencia" && !d.resolvida),
    ).toBe(false);
  });

  it("dispara marco de sequência e aplica consequência perceptível", () => {
    const c = nova("cenas-gatilho");
    c.jogador.notasRecentes = [7.5, 7.6, 7.7];
    c.acompanhamento.cenas = criarHistoricoCenas();
    c.decisoes = [];
    const antes = structuredClone(c);
    // Força prioridade alta sem depender de RNG baixo: várias tentativas
    let achou = false;
    for (let seed = 1; seed < 40; seed++) {
      const clone = structuredClone(c);
      gerarCenasSemana(clone, antes, new GeradorAleatorio(seed));
      const dec = clone.decisoes.find(
        (d) => d.tipo === "cena:elogio-sequencia" && !d.resolvida,
      );
      if (dec) {
        const rel = clone.relacionamentos.treinador;
        const depois = responderDecisao(clone, dec.id, "humilde");
        expect(depois.relacionamentos.treinador).toBeGreaterThan(rel);
        achou = true;
        break;
      }
    }
    expect(achou).toBe(true);
  });
});

describe("avancarSemana com motor causal", () => {
  it("mantém determinismo do avanço semanal", () => {
    const a = nova("semana-det");
    const b = nova("semana-det");
    const ra = avancarSemana(a);
    const rb = avancarSemana(b);
    expect(ra.estadoAleatorio).toBe(rb.estadoAleatorio);
    expect(ra.temporada.rodadaAtual).toBe(rb.temporada.rodadaAtual);
    expect(ra.ultimaPartidaId).toBe(rb.ultimaPartidaId);
  });
});
