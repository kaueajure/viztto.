import type { EventoPartida, Partida } from "@/dominio/entidades/modelos";
import type { BriefingMatchday, DecisaoPartidaPendente, FaseMatchday } from "@/dominio/matchday";
import type { EstadoMotorCausal } from "@/simulacao/partida/motor-causal";
import {
  type ContextoSemana,
  prepararSemana,
  simularRodadaCompleta,
  finalizarSemana,
  iniciarMatchdayInterativo,
  aplicarResultadoMatchday,
  avancarMotorCausal,
  responderDecisaoMotor,
  finalizarMotorCausal,
} from "@/aplicacao/casos-de-uso/fases-semana";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";

export type SessaoMatchdayUI = {
  fase: FaseMatchday;
  briefing: BriefingMatchday;
  eventosVisiveis: EventoPartida[];
  decisao: DecisaoPartidaPendente | null;
  partida: Partida | null;
  minutoAtual: number;
  golsMandante: number;
  golsVisitante: number;
};

type SessaoInterna = {
  ctx: ContextoSemana;
  motor: EstadoMotorCausal | null;
  ui: SessaoMatchdayUI;
};

let sessao: SessaoInterna | null = null;

export function obterSessaoMatchdayUI(): SessaoMatchdayUI | null {
  return sessao?.ui ?? null;
}

export function limparSessaoMatchday(): void {
  sessao = null;
}

export function temSessaoMatchday(): boolean {
  return sessao !== null;
}

/**
 * Prepara a semana. Se houver partida do usuário, abre Matchday (pre).
 * Caso contrário, conclui a semana e devolve a carreira.
 */
export function iniciarAvancoComMatchday(
  estado: EstadoCarreira,
):
  | { tipo: "semana"; carreira: EstadoCarreira }
  | { tipo: "matchday"; ui: SessaoMatchdayUI } {
  if (estado.temporada.encerrada) {
    return { tipo: "semana", carreira: estado };
  }
  const ctx = prepararSemana(estado);
  if (!ctx.briefing || !ctx.partidaUsuarioId) {
    simularRodadaCompleta(ctx);
    return { tipo: "semana", carreira: finalizarSemana(ctx) };
  }
  sessao = {
    ctx,
    motor: null,
    ui: {
      fase: "pre",
      briefing: ctx.briefing,
      eventosVisiveis: [],
      decisao: null,
      partida: null,
      minutoAtual: 0,
      golsMandante: 0,
      golsVisitante: 0,
    },
  };
  return { tipo: "matchday", ui: sessao.ui };
}

/** Simula a rodada inteira de uma vez (mesmas decisões neutras do motor). */
export function simularMatchdayInstantaneo(): EstadoCarreira {
  if (!sessao) throw new Error("Matchday não iniciado.");
  simularRodadaCompleta(sessao.ctx);
  const carreira = finalizarSemana(sessao.ctx);
  const partida = [
    ...carreira.temporada.partidas,
    ...carreira.temporada.partidasBase,
  ].find((p) => p.id === carreira.ultimaPartidaId) ?? null;
  sessao.ui = {
    ...sessao.ui,
    fase: "pos",
    partida,
    eventosVisiveis: partida?.eventos ?? [],
    decisao: null,
    minutoAtual: 90,
    golsMandante: partida?.golsMandante ?? 0,
    golsVisitante: partida?.golsVisitante ?? 0,
  };
  const resultado = carreira;
  // Mantém UI de pós até fechar; limpa contexto pesado parcialmente
  sessao.ctx = { ...sessao.ctx, carreira };
  return resultado;
}

export function comecarPartidaMatchday(): SessaoMatchdayUI {
  if (!sessao) throw new Error("Matchday não iniciado.");
  const { ctx, motor } = iniciarMatchdayInterativo(sessao.ctx);
  sessao.ctx = ctx;
  let m = avancarMotorCausal(motor, ctx.aleatorio, 90);
  sessao.motor = m;
  sessao.ui = {
    ...sessao.ui,
    fase: "ao-vivo",
    eventosVisiveis: [...m.eventos],
    decisao: m.decisaoPendente,
    minutoAtual: m.eventos.at(-1)?.minuto ?? 0,
    partida: m.concluido ? m.partida : null,
    golsMandante: m.golsMandante,
    golsVisitante: m.golsVisitante,
  };
  if (m.concluido) {
    return concluirMotorNoPos();
  }
  return sessao.ui;
}

/** Continua após decisão ou avança se não houver pausa. */
export function responderDecisaoMatchday(opcaoId: string): SessaoMatchdayUI {
  if (!sessao?.motor) throw new Error("Partida não iniciada.");
  let m = responderDecisaoMotor(sessao.motor, opcaoId, sessao.ctx.aleatorio);
  sessao.motor = m;
  sessao.ui = {
    ...sessao.ui,
    eventosVisiveis: [...m.eventos],
    decisao: m.decisaoPendente,
    minutoAtual: m.eventos.at(-1)?.minuto ?? sessao.ui.minutoAtual,
    partida: m.concluido ? m.partida : null,
    golsMandante: m.golsMandante,
    golsVisitante: m.golsVisitante,
  };
  if (m.concluido) return concluirMotorNoPos();
  return sessao.ui;
}

function concluirMotorNoPos(): SessaoMatchdayUI {
  if (!sessao?.motor) throw new Error("Motor ausente.");
  let m = sessao.motor;
  if (!m.concluido) {
    m = finalizarMotorCausal(m, sessao.ctx.aleatorio);
    sessao.motor = m;
  }
  aplicarResultadoMatchday(sessao.ctx, m.partida);
  const carreira = finalizarSemana(sessao.ctx);
  sessao.ctx = { ...sessao.ctx, carreira };
  sessao.ui = {
    ...sessao.ui,
    fase: "pos",
    partida: m.partida,
    eventosVisiveis: m.partida.eventos,
    decisao: null,
    minutoAtual: 90,
    golsMandante: m.partida.golsMandante ?? 0,
    golsVisitante: m.partida.golsVisitante ?? 0,
  };
  return sessao.ui;
}

/** Carreira final após fechar o pós-jogo. */
export function obterCarreiraAposMatchday(): EstadoCarreira {
  if (!sessao) throw new Error("Matchday não iniciado.");
  return sessao.ctx.carreira;
}

export function fecharMatchday(): EstadoCarreira {
  const carreira = obterCarreiraAposMatchday();
  limparSessaoMatchday();
  return carreira;
}
