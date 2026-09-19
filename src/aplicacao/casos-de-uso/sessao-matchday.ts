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
  /** Pressão aproximada 0–100 a partir de chances/gols recentes. */
  pressaoMandante: number;
  pressaoVisitante: number;
  pausado: boolean;
};

type SessaoInterna = {
  ctx: ContextoSemana;
  motor: EstadoMotorCausal | null;
  ui: SessaoMatchdayUI;
};

let sessao: SessaoInterna | null = null;

function pressaoDeEventos(
  eventos: EventoPartida[],
  mandanteId: string,
  visitanteId: string,
): { mandante: number; visitante: number } {
  const recentes = eventos
    .filter((e) => ["chance", "gol", "defesa", "passe-chave"].includes(e.tipo))
    .slice(-8);
  let m = 40;
  let v = 40;
  for (const e of recentes) {
    const peso = e.tipo === "gol" ? 12 : e.tipo === "chance" ? 7 : 4;
    if (e.clubeId === mandanteId) m += peso;
    else if (e.clubeId === visitanteId) v += peso;
  }
  const soma = m + v || 1;
  return {
    mandante: Math.round((m / soma) * 100),
    visitante: Math.round((v / soma) * 100),
  };
}

function sincronizarUiDoMotor(m: EstadoMotorCausal): void {
  if (!sessao) return;
  const pressao = pressaoDeEventos(
    m.eventos,
    m.mandante.id,
    m.visitante.id,
  );
  sessao.ui = {
    ...sessao.ui,
    fase: m.concluido ? "pos" : "ao-vivo",
    eventosVisiveis: [...m.eventos],
    decisao: m.decisaoPendente,
    minutoAtual: m.minutoSimulado,
    partida: m.concluido ? m.partida : null,
    golsMandante: m.golsMandante,
    golsVisitante: m.golsVisitante,
    pressaoMandante: pressao.mandante,
    pressaoVisitante: pressao.visitante,
    pausado: !!m.decisaoPendente,
  };
}

export function obterSessaoMatchdayUI(): SessaoMatchdayUI | null {
  return sessao?.ui ?? null;
}

export function limparSessaoMatchday(): void {
  sessao = null;
}

export function temSessaoMatchday(): boolean {
  return sessao !== null;
}

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
      pressaoMandante: 50,
      pressaoVisitante: 50,
      pausado: false,
    },
  };
  return { tipo: "matchday", ui: sessao.ui };
}

export function simularMatchdayInstantaneo(): EstadoCarreira {
  if (!sessao) throw new Error("Matchday não iniciado.");
  simularRodadaCompleta(sessao.ctx);
  const carreira = finalizarSemana(sessao.ctx);
  const partida =
    [
      ...carreira.temporada.partidas,
      ...carreira.temporada.partidasBase,
    ].find((p) => p.id === carreira.ultimaPartidaId) ?? null;
  const pressao = partida
    ? pressaoDeEventos(
        partida.eventos,
        partida.mandanteId,
        partida.visitanteId,
      )
    : { mandante: 50, visitante: 50 };
  sessao.ui = {
    ...sessao.ui,
    fase: "pos",
    partida,
    eventosVisiveis: partida?.eventos ?? [],
    decisao: null,
    minutoAtual: 90,
    golsMandante: partida?.golsMandante ?? 0,
    golsVisitante: partida?.golsVisitante ?? 0,
    pressaoMandante: pressao.mandante,
    pressaoVisitante: pressao.visitante,
    pausado: false,
  };
  sessao.ctx = { ...sessao.ctx, carreira };
  return carreira;
}

/** Inicia o motor sem avançar — a UI controla o ritmo. */
export function comecarPartidaMatchday(): SessaoMatchdayUI {
  if (!sessao) throw new Error("Matchday não iniciado.");
  const { ctx, motor } = iniciarMatchdayInterativo(sessao.ctx);
  sessao.ctx = ctx;
  sessao.motor = motor;
  sincronizarUiDoMotor(motor);
  sessao.ui = { ...sessao.ui, fase: "ao-vivo", minutoAtual: 0, pausado: false };
  return sessao.ui;
}

/**
 * Avança a partida acompanhada até `ateMinuto` (blocos de 3–6' na UI).
 * Pausa automaticamente se surgir decisão.
 */
export function avancarMatchdayAte(ateMinuto: number): SessaoMatchdayUI {
  if (!sessao?.motor) throw new Error("Partida não iniciada.");
  if (sessao.motor.decisaoPendente || sessao.motor.concluido) {
    sincronizarUiDoMotor(sessao.motor);
    return sessao.ui;
  }
  const m = avancarMotorCausal(
    sessao.motor,
    sessao.ctx.aleatorio,
    Math.min(90, ateMinuto),
  );
  sessao.motor = m;
  sincronizarUiDoMotor(m);
  if (m.concluido) return concluirMotorNoPos();
  return sessao.ui;
}

export function pularMatchdayParaOFim(): SessaoMatchdayUI {
  return avancarMatchdayAte(90);
}

export function responderDecisaoMatchday(opcaoId: string): SessaoMatchdayUI {
  if (!sessao?.motor) throw new Error("Partida não iniciada.");
  // Após a escolha, permanece no minuto atual — a UI retoma o avanço.
  const m = responderDecisaoMotor(
    sessao.motor,
    opcaoId,
    sessao.ctx.aleatorio,
    sessao.motor.minutoSimulado,
  );
  sessao.motor = m;
  sincronizarUiDoMotor(m);
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
  const pressao = pressaoDeEventos(
    m.partida.eventos,
    m.mandante.id,
    m.visitante.id,
  );
  sessao.ui = {
    ...sessao.ui,
    fase: "pos",
    partida: m.partida,
    eventosVisiveis: m.partida.eventos,
    decisao: null,
    minutoAtual: 90,
    golsMandante: m.partida.golsMandante ?? 0,
    golsVisitante: m.partida.golsVisitante ?? 0,
    pressaoMandante: pressao.mandante,
    pressaoVisitante: pressao.visitante,
    pausado: false,
  };
  return sessao.ui;
}

export function obterCarreiraAposMatchday(): EstadoCarreira {
  if (!sessao) throw new Error("Matchday não iniciado.");
  return sessao.ctx.carreira;
}

export function fecharMatchday(): EstadoCarreira {
  const carreira = obterCarreiraAposMatchday();
  limparSessaoMatchday();
  return carreira;
}
