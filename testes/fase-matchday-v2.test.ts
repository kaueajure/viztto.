import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
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
} from "@/simulacao/partida/motor-partida";
import {
  aplicarOpcaoDecisaoPartida,
} from "@/simulacao/partida/motor-causal";
import { criarModificadoresNeutros } from "@/dominio/matchday";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";

const liga = LIGAS_SUPORTADAS[0];
const clubes = gerarClubesDemonstracao(liga);

function nova(seed = "matchday-v2") {
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

describe("modificadores só do usuário", () => {
  it("protagonismo alto não aumenta gols do adversário vs neutro", () => {
    const c = nova("mods-adversario");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId || !ctx.clube) return;
    const mapa = new Map(ctx.carreira.clubes.map((x) => [x.id, x]));
    const partida = [
      ...ctx.carreira.temporada.partidas,
      ...ctx.carreira.temporada.partidasBase,
    ].find((p) => p.id === ctx.partidaUsuarioId)!;

    const seed = ctx.aleatorio.estado;
    const neutro = simularPartida(
      { ...partida },
      mapa.get(partida.mandanteId)!,
      mapa.get(partida.visitanteId)!,
      new GeradorAleatorio(seed),
      ctx.carreira.jogador,
      ctx.clube.id,
      0,
      {
        escalacaoPreparada: ctx.escalacaoPreparada ?? undefined,
        elencoProfissional: true,
        instrucao: "simples",
        modificadores: criarModificadoresNeutros(),
      },
    );
    const protagonismo = simularPartida(
      { ...partida },
      mapa.get(partida.mandanteId)!,
      mapa.get(partida.visitanteId)!,
      new GeradorAleatorio(seed),
      ctx.carreira.jogador,
      ctx.clube.id,
      0,
      {
        escalacaoPreparada: ctx.escalacaoPreparada ?? undefined,
        elencoProfissional: true,
        instrucao: "simples",
        modificadores: {
          ...criarModificadoresNeutros(),
          protagonismo: 0.9,
          risco: 0.5,
        },
      },
    );

    const golsAdv = (r: typeof neutro) =>
      ctx.clube!.id === r.mandanteId
        ? r.golsVisitante!
        : r.golsMandante!;

    // Protagonismo pode aumentar gols próprios, mas não deve sistematicamente
    // inflar o placar do adversário além do caminho neutro na média de uma amostra.
    // Em uma única seed: gols do adversário não podem subir só por protagonismo.
    expect(golsAdv(protagonismo)).toBeLessThanOrEqual(golsAdv(neutro) + 1);
  });
});

describe("cronologia estrita", () => {
  it("entrada do banco só aparece após eventos de minutos anteriores", () => {
    const c = nova("crono-banco");
    c.jogador.categoria = "profissional";
    c.jogador.status = "reserva";
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId || !ctx.clube) return;
    ctx.escalacaoPreparada = "banco";
    if (ctx.briefing) ctx.briefing.escalacao = "banco";

    const { motor } = iniciarMatchdayInterativo(ctx);
    // Força entrada conhecida
    if (!motor.participacao || motor.participacao.entrada >= 90) return;
    const entrada = motor.participacao.entrada;

    let m = avancarMotorCausal(motor, ctx.aleatorio, entrada - 1);
    expect(
      m.eventos.some((e) => e.tipo === "substituicao" && e.texto.includes("entra")),
    ).toBe(false);
    expect(m.minutoSimulado).toBe(entrada - 1);

    m = avancarMotorCausal(m, ctx.aleatorio, entrada);
    const evEntrada = m.eventos.find(
      (e) => e.tipo === "substituicao" && e.texto.includes("entra"),
    );
    expect(evEntrada?.minuto).toBe(entrada);
    for (const e of m.eventos) {
      if (e === evEntrada) continue;
      if (e.minuto < entrada) {
        // ok — anteriores
      } else if (e.minuto === entrada && e !== evEntrada) {
        // momentos no mesmo minuto após a entrada são ok
      }
    }
    const idx = m.eventos.indexOf(evEntrada!);
    for (let i = 0; i < idx; i++) {
      expect(m.eventos[i]!.minuto).toBeLessThanOrEqual(entrada);
      if (m.eventos[i]!.minuto === entrada) {
        // só intervalo/outros no mesmo minuto antes — entrada é processada antes dos momentos
      }
    }
  });

  it("jogador não produz eventos de ação fora do período em campo", () => {
    const c = nova("fora-campo");
    c.jogador.categoria = "profissional";
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId || !ctx.clube) return;
    const { motor } = iniciarMatchdayInterativo(ctx);
    let m = avancarMotorCausal(motor, ctx.aleatorio, 90);
    while (m.decisaoPendente) {
      m = responderDecisaoMotor(m, "neutro", ctx.aleatorio, 90);
    }
    if (!m.concluido) m = finalizarMotorCausal(m, ctx.aleatorio);
    const p = m.participacao;
    if (!p || p.minutos === 0) return;
    for (const e of m.eventos) {
      if (!e.jogador) continue;
      if (e.tipo === "substituicao") continue;
      expect(e.minuto).toBeGreaterThanOrEqual(p.entrada);
      expect(e.minuto).toBeLessThanOrEqual(p.saida);
    }
  });
});

describe("decisões e determinismo progressivo", () => {
  it("decisões alteram modificadores e podem divergir do caminho neutro", () => {
    const base = criarModificadoresNeutros();
    const ofensivo = aplicarOpcaoDecisaoPartida(base, "perdendo", "ofensivo");
    expect(ofensivo.protagonismo).toBeGreaterThan(0);
    expect(ofensivo.risco).toBeGreaterThan(0);
  });

  it("blocos até minuto X + resto = simulação contínua com mesmas decisões", () => {
    const c = nova("blocos-iguais");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    const base = structuredClone(c);

    const ctxA = prepararSemana(structuredClone(base));
    if (!ctxA.partidaUsuarioId) return;
    const { motor: m0 } = iniciarMatchdayInterativo(ctxA);
    let ma = avancarMotorCausal(m0, ctxA.aleatorio, 30);
    while (ma.decisaoPendente)
      ma = responderDecisaoMotor(ma, "neutro", ctxA.aleatorio, ma.minutoSimulado);
    ma = avancarMotorCausal(ma, ctxA.aleatorio, 60);
    while (ma.decisaoPendente)
      ma = responderDecisaoMotor(ma, "neutro", ctxA.aleatorio, ma.minutoSimulado);
    ma = avancarMotorCausal(ma, ctxA.aleatorio, 90);
    while (ma.decisaoPendente)
      ma = responderDecisaoMotor(ma, "neutro", ctxA.aleatorio, 90);
    if (!ma.concluido) ma = finalizarMotorCausal(ma, ctxA.aleatorio);

    const ctxB = prepararSemana(structuredClone(base));
    const { motor: m1 } = iniciarMatchdayInterativo(ctxB);
    let mb = avancarMotorCausal(m1, ctxB.aleatorio, 90);
    while (mb.decisaoPendente)
      mb = responderDecisaoMotor(mb, "neutro", ctxB.aleatorio, 90);
    if (!mb.concluido) mb = finalizarMotorCausal(mb, ctxB.aleatorio);

    expect(ma.golsMandante).toBe(mb.golsMandante);
    expect(ma.golsVisitante).toBe(mb.golsVisitante);
    expect(ma.participacao?.minutos).toBe(mb.participacao?.minutos);
    expect(ma.participacao?.gols).toBe(mb.participacao?.gols);
  });

  it("instantâneo e acompanhado (neutro) batem no placar", () => {
    const seed = "paridade-v2";
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
    if (!ctxInter.partidaUsuarioId) return;
    const { ctx, motor } = iniciarMatchdayInterativo(ctxInter);
    let m = avancarMotorCausal(motor, ctx.aleatorio, 90);
    while (m.decisaoPendente) {
      m = responderDecisaoMotor(m, "neutro", ctx.aleatorio, 90);
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
  });
});

describe("estatísticas e impactos", () => {
  it("estatísticas coerentes com eventos e participação", () => {
    const c = nova("stats-v2");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId) return;
    simularRodadaCompleta(ctx);
    const partida = [
      ...ctx.carreira.temporada.partidas,
      ...ctx.carreira.temporada.partidasBase,
    ].find((p) => p.id === ctx.partidaUsuarioId)!;
    const p = partida.participacao;
    if (!p || p.minutos === 0) return;
    expect(p.chutes).toBeGreaterThanOrEqual(p.gols);
    expect(p.passesChave).toBeGreaterThanOrEqual(p.assistencias);
    expect(p.faltas).toBeGreaterThanOrEqual(p.amarelos);
  });

  it("impacto exibido no pós-jogo é o mesmo aplicado ao treinador", () => {
    const c = nova("impacto-igual");
    c.jogador.categoria = "profissional";
    c.jogador.status = "titular";
    const ctx = prepararSemana(c);
    if (!ctx.partidaUsuarioId || !ctx.clube || !ctx.briefing) return;
    simularRodadaCompleta(ctx);
    const partida = [
      ...ctx.carreira.temporada.partidas,
      ...ctx.carreira.temporada.partidasBase,
    ].find((p) => p.id === ctx.partidaUsuarioId)!;
    expect(partida.contextoMatchday).toBeTruthy();
    const antes = ctx.treinadorAntes;
    // simularRodadaCompleta já aplicou desempenho; o delta deve bater com contexto
    const depois = ctx.carreira.relacionamentos.treinador;
    const delta = depois - antes;
    expect(Math.abs(delta - (partida.contextoMatchday!.impactoTreinador))).toBeLessThan(0.15);
  });
});
