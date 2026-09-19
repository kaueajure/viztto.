import { gerarContextoSemana, avisarConcorrencia } from "@/simulacao/decisoes/contexto";
import { registrarResumoSemanal } from "@/simulacao/carreira/acompanhamento";
import { avaliarBase, relacionadoProfissional } from "@/simulacao/base/formacao";
import { avaliarHierarquia, bonusPromessa } from "@/simulacao/elenco/hierarquia";
import { atualizarCompromissos } from "@/simulacao/elenco/treinador";
import type {
  EstadoCarreira,
  Partida,
  Clube,
  Escalacao,
  Categoria,
} from "@/dominio/entidades/modelos";
import type { BriefingMatchday } from "@/dominio/matchday";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import {
  simularPartida,
  type OpcoesMotorCausal,
} from "@/simulacao/partida/motor-partida";
import {
  iniciarMotorCausal,
  avancarMotorCausal,
  responderDecisaoMotor,
  finalizarMotorCausal,
  type EstadoMotorCausal,
} from "@/simulacao/partida/motor-causal";
import {
  montarBriefingMatchday,
  montarContextoPosJogo,
} from "@/simulacao/partida/matchday";
import { escalacaoUsuarioDoClube } from "@/simulacao/partida/escalacao";
import {
  processarTreinamento,
} from "@/simulacao/treinamento/treinamento";
import { aplicarAutoTreinoSemana } from "@/simulacao/treinamento/aplicar-sessao";
import {
  aplicarDeclinio,
} from "@/simulacao/evolucao/evolucao";
import {
  avaliarMercado,
  efetivarPreContratos,
  calcularValorMercado,
} from "@/simulacao/transferencias/mercado";
import {
  registrarEvento,
  atualizarObjetivos,
} from "@/simulacao/eventos/eventos";
import { calcularClassificacao } from "@/simulacao/temporada/classificacao";
import { finalizarTemporada } from "@/aplicacao/casos-de-uso/temporada";
import { processarPlayoffsCalendario } from "@/simulacao/mundo/playoffs-calendario";
import {
  escalarElencoCompleto,
  aplicarEscalacaoAoClube,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
} from "@/simulacao/elenco/escalacao-elenco";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import {
  evoluirJogadoresMundo,
  podeAposentar,
} from "@/simulacao/elenco/evolucao-mundo";
import { avancarLigasExternas } from "@/simulacao/mundo/avancar-ligas";
import {
  clonarCarreiraParaAvanco,
  materializarClubesExternos,
  materializarTemporadasExternas,
} from "@/simulacao/carreira/clonar-avanco";
import { gerarDecisoesSemana } from "@/simulacao/decisoes/decisoes";
import {
  estaSemClube,
  tornarAgenteLivre,
  processarSemanaAgenteLivre,
} from "@/simulacao/carreira/agente-livre";
import { aplicarDesempenho, avaliarPromocao } from "@/simulacao/carreira/desempenho";
import { gerarCenasSemana } from "@/simulacao/cenas/motor-cenas";

export type ContextoSemana = {
  estadoOriginal: EstadoCarreira;
  carreira: EstadoCarreira;
  aleatorio: GeradorAleatorio;
  hierarquiaAntes: ReturnType<typeof avaliarHierarquia>;
  livre: boolean;
  clube?: Clube;
  motivoParticipacao: string;
  categoriaSemana: Categoria;
  incluirUsuarioNoProfissional: boolean;
  escalacaoPreparada: Escalacao | null;
  estavaLesionado: boolean;
  rodada: number;
  treinadorAntes: number;
  partidaUsuarioId: string | null;
  briefing: BriefingMatchday | null;
};

function prepararClubesRodada(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
  incluirUsuarioNoProfissional: boolean,
): Escalacao | null {
  const j = carreira.jogador;
  let escalacaoUsuario: Escalacao | null = null;
  for (const c of carreira.clubes) {
    if (c.ligaId !== carreira.liga.id) continue;
    const candidatos = c.elenco.map(jogadorMundoComoCandidato);
    if (c.id === carreira.clubeAtualId && incluirUsuarioNoProfissional) {
      candidatos.push(jogadorUsuarioComoCandidato(j, bonusPromessa(carreira)));
    }
    const resultado = escalarElencoCompleto(
      candidatos,
      c.formacaoPreferida,
      c.treinador,
    );
    aplicarEscalacaoAoClube(c, resultado);
    sincronizarForcaClube(
      c,
      c.id === carreira.clubeAtualId && incluirUsuarioNoProfissional ? j : undefined,
    );
    if (c.id === carreira.clubeAtualId && incluirUsuarioNoProfissional) {
      escalacaoUsuario =
        resultado.escalacaoUsuario === "lesionado" ||
        resultado.escalacaoUsuario === "suspenso"
          ? resultado.escalacaoUsuario
          : escalacaoUsuarioDoClube(c) ?? "nao relacionado";
    }
    if (c.id !== carreira.clubeAtualId) {
      evoluirJogadoresMundo(c.elenco, aleatorio, true);
      c.elenco = c.elenco.filter((jog) => !podeAposentar(jog, aleatorio));
    } else {
      evoluirJogadoresMundo(c.elenco, aleatorio, true);
    }
  }
  return escalacaoUsuario;
}

/** Fase 1: treino, contratos, hierarquia, incrementa rodada — antes das partidas. */
export function prepararSemana(estado: EstadoCarreira): ContextoSemana {
  if (estado.aposentado)
    throw new Error(
      "Esta carreira está aposentada. Você pode consultar o histórico, mas não avançar como jogador ativo.",
    );
  if (estado.temporada.encerrada) {
    return {
      estadoOriginal: estado,
      carreira: estado,
      aleatorio: new GeradorAleatorio(estado.estadoAleatorio),
      hierarquiaAntes: avaliarHierarquia(estado),
      livre: true,
      motivoParticipacao: "",
      categoriaSemana: estado.jogador.categoria,
      incluirUsuarioNoProfissional: false,
      escalacaoPreparada: null,
      estavaLesionado: !!estado.jogador.lesao,
      rodada: estado.temporada.rodadaAtual,
      treinadorAntes: estado.relacionamentos?.treinador ?? 50,
      partidaUsuarioId: null,
      briefing: null,
    };
  }

  const hierarquiaAntes = avaliarHierarquia(estado);
  let carreira = clonarCarreiraParaAvanco(estado);
  const aleatorio = new GeradorAleatorio(carreira.estadoAleatorio);
  let j = carreira.jogador;
  if (!carreira.relacionamentos)
    carreira.relacionamentos = { treinador: 50, diretoria: 50, agente: 60 };
  if (!carreira.decisoes) carreira.decisoes = [];
  if (!carreira.transferenciasRecentes) carreira.transferenciasRecentes = [];
  if (!carreira.ligas?.length) carreira.ligas = [carreira.liga];
  if (!carreira.temporadasExternas) carreira.temporadasExternas = {};
  if (!carreira.historicoContratos) carreira.historicoContratos = [];
  if (carreira.agenteLivreDesde === undefined) carreira.agenteLivreDesde = null;
  if (carreira.ultimoClubeId === undefined) carreira.ultimoClubeId = null;

  const treinadorAntes = carreira.relacionamentos.treinador;

  carreira = aplicarAutoTreinoSemana(carreira);
  j = carreira.jogador;

  carreira.dataAtual = somarDias(carreira.dataAtual, 7);
  carreira.ultimaPartidaId = null;

  carreira = efetivarPreContratos(carreira);
  j = carreira.jogador;

  if (
    !estaSemClube(carreira) &&
    j.contrato.dataTermino < carreira.dataAtual
  ) {
    if (j.categoria === "base") {
      j.contrato.dataTermino = somarDias(carreira.dataAtual, 365);
    } else {
      if (carreira.mercado.emprestimo) delete carreira.mercado.emprestimo;
      if (
        !estaSemClube(carreira) &&
        j.contrato.dataTermino < carreira.dataAtual
      ) {
        tornarAgenteLivre(carreira);
      }
    }
  }

  const livre = estaSemClube(carreira);
  const clube = livre
    ? undefined
    : carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
  if (!livre && !clube)
    throw new Error("Clube atual não encontrado na carreira.");

  if (j.lesao) {
    j.lesao.diasRecuperacao = Math.max(0, j.lesao.diasRecuperacao - 7);
    if (j.lesao.diasRecuperacao === 0) {
      j.lesao = null;
      registrarEvento(
        carreira,
        "retorno",
        "Liberado pelo departamento médico",
        "Você pode voltar aos treinos e à disputa por uma vaga.",
        "Departamento médico",
      );
    } else j.confianca = limitar(j.confianca - 0.5);
  }
  const estavaLesionado = !!j.lesao;
  const sessoesCentro = j.preparacao.centro?.semana.sessoes.length ?? 0;
  processarTreinamento(
    j,
    carreira.focoTreino,
    clube ?? null,
    carreira.dataAtual,
    aleatorio,
  );
  aplicarDeclinio(j);
  if (livre) processarSemanaAgenteLivre(carreira);

  let motivoParticipacao = "Sem clube nesta semana.";
  let convocado = false;
  let categoriaSemana = j.categoria;
  let incluirUsuarioNoProfissional = false;
  let escalacaoPreparada: Escalacao | null = null;

  if (!livre && clube) {
    avaliarBase(carreira, sessoesCentro);
    convocado = relacionadoProfissional(carreira);
    motivoParticipacao = avaliarHierarquia(carreira).motivo;
    categoriaSemana = convocado ? "profissional" : j.categoria;
    incluirUsuarioNoProfissional =
      j.categoria === "profissional" || convocado;
    if (convocado)
      registrarEvento(
        carreira,
        "base-relacionado",
        "Relacionado para o profissional",
        "A comissão chamou você para suprir uma ausência na sua posição. O vínculo com a base permanece.",
        "Treinador",
        false,
      );
    escalacaoPreparada = prepararClubesRodada(
      carreira,
      aleatorio,
      incluirUsuarioNoProfissional,
    );
  } else {
    for (const c of carreira.clubes.filter(
      (x) => x.ligaId === carreira.liga.id,
    )) {
      const candidatos = c.elenco.map(jogadorMundoComoCandidato);
      const resultado = escalarElencoCompleto(
        candidatos,
        c.formacaoPreferida,
        c.treinador,
      );
      aplicarEscalacaoAoClube(c, resultado);
      sincronizarForcaClube(c);
      evoluirJogadoresMundo(c.elenco, aleatorio, true);
      c.elenco = c.elenco.filter((jog) => !podeAposentar(jog, aleatorio));
    }
  }

  const rodada = ++carreira.temporada.rodadaAtual;

  let partidaUsuarioId: string | null = null;
  let briefing: BriefingMatchday | null = null;
  if (!livre && clube) {
    const partidaUsuario = [
      ...carreira.temporada.partidas,
      ...carreira.temporada.partidasBase,
    ].find(
      (p) =>
        p.rodada === rodada &&
        p.categoria === categoriaSemana &&
        [p.mandanteId, p.visitanteId].includes(clube.id) &&
        p.golsMandante === null,
    );
    if (partidaUsuario && escalacaoPreparada !== null) {
      partidaUsuarioId = partidaUsuario.id;
      // Briefing consome RNG para instrução/objetivos — mesma ordem no instantâneo.
      briefing = montarBriefingMatchday(
        carreira,
        partidaUsuario,
        escalacaoPreparada,
        aleatorio,
      );
    } else if (partidaUsuario) {
      partidaUsuarioId = partidaUsuario.id;
      const esc =
        escalacaoPreparada ??
        (j.lesao ? "lesionado" : j.suspensao > 0 ? "suspenso" : "nao relacionado");
      briefing = montarBriefingMatchday(carreira, partidaUsuario, esc, aleatorio);
    }
  }

  return {
    estadoOriginal: estado,
    carreira,
    aleatorio,
    hierarquiaAntes,
    livre,
    clube,
    motivoParticipacao,
    categoriaSemana,
    incluirUsuarioNoProfissional,
    escalacaoPreparada,
    estavaLesionado,
    rodada,
    treinadorAntes,
    partidaUsuarioId,
    briefing,
  };
}

function opcoesUsuario(
  ctx: ContextoSemana,
  extras?: OpcoesMotorCausal,
): OpcoesMotorCausal | undefined {
  if (!ctx.incluirUsuarioNoProfissional && !ctx.escalacaoPreparada) {
    return extras;
  }
  return {
    escalacaoPreparada: ctx.escalacaoPreparada ?? "nao relacionado",
    elencoProfissional: true,
    instrucao: ctx.briefing?.instrucao,
    objetivos: ctx.briefing?.objetivos,
    ...extras,
  };
}

/** Simula todas as partidas da rodada (usuário incluso, modo instantâneo). */
export function simularRodadaCompleta(ctx: ContextoSemana): ContextoSemana {
  const { carreira, aleatorio, livre, clube, categoriaSemana, rodada } = ctx;
  const j = carreira.jogador;
  const mapa = new Map(carreira.clubes.map((c) => [c.id, c]));

  const simularUma = (partida: Partida): Partida => {
    if (partida.golsMandante !== null) return partida;
    const pertence =
      !livre &&
      !!clube &&
      partida.categoria === categoriaSemana &&
      [partida.mandanteId, partida.visitanteId].includes(clube.id);
    const resultado = simularPartida(
      partida,
      mapa.get(partida.mandanteId)!,
      mapa.get(partida.visitanteId)!,
      aleatorio,
      pertence ? j : undefined,
      pertence && clube ? clube.id : undefined,
      pertence ? bonusPromessa(carreira) : 0,
      pertence ? opcoesUsuario(ctx) : undefined,
    );
    if (pertence && clube && ctx.briefing) {
      resultado.contextoMatchday = montarContextoPosJogo(
        ctx.briefing,
        resultado,
        carreira,
        ctx.treinadorAntes,
      );
    }
    if (pertence && clube) {
      carreira.ultimaPartidaId = resultado.id;
      aplicarDesempenho(carreira, resultado, clube, aleatorio);
    }
    return resultado;
  };

  // Partida do usuário primeiro — mesma ordem do Matchday interativo (RNG).
  if (ctx.partidaUsuarioId) {
    for (const chave of ["partidas", "partidasBase"] as const) {
      carreira.temporada[chave] = carreira.temporada[chave].map((partida) =>
        partida.id === ctx.partidaUsuarioId ? simularUma(partida) : partida,
      );
    }
  }

  for (const chave of ["partidas", "partidasBase"] as const) {
    carreira.temporada[chave] = carreira.temporada[chave].map((partida) => {
      if (partida.rodada !== rodada) return partida;
      if (partida.id === ctx.partidaUsuarioId) return partida;
      return simularUma(partida);
    });
  }
  return ctx;
}

/**
 * Inicia o motor causal só da partida do usuário (Matchday interativo).
 * Demais partidas da rodada ainda não foram simuladas.
 */
export function iniciarMatchdayInterativo(
  ctx: ContextoSemana,
): { ctx: ContextoSemana; motor: EstadoMotorCausal } {
  if (!ctx.partidaUsuarioId || !ctx.clube) {
    throw new Error("Nenhuma partida do usuário nesta rodada.");
  }
  const mapa = new Map(ctx.carreira.clubes.map((c) => [c.id, c]));
  const partida = [
    ...ctx.carreira.temporada.partidas,
    ...ctx.carreira.temporada.partidasBase,
  ].find((p) => p.id === ctx.partidaUsuarioId)!;

  const motor = iniciarMotorCausal(
    partida,
    mapa.get(partida.mandanteId)!,
    mapa.get(partida.visitanteId)!,
    ctx.aleatorio,
    ctx.carreira.jogador,
    ctx.clube.id,
    bonusPromessa(ctx.carreira),
    {
      ...opcoesUsuario(ctx),
      interativo: true,
    },
  );
  return { ctx, motor };
}

export function aplicarResultadoMatchday(
  ctx: ContextoSemana,
  partidaUsuario: Partida,
): ContextoSemana {
  const { carreira, aleatorio, clube, rodada } = ctx;
  if (!clube) return ctx;

  if (ctx.briefing) {
    partidaUsuario.contextoMatchday = montarContextoPosJogo(
      ctx.briefing,
      partidaUsuario,
      carreira,
      ctx.treinadorAntes,
    );
  }

  const mapa = new Map(carreira.clubes.map((c) => [c.id, c]));
  for (const chave of ["partidas", "partidasBase"] as const) {
    carreira.temporada[chave] = carreira.temporada[chave].map((partida) => {
      if (partida.id === partidaUsuario.id) return partidaUsuario;
      if (partida.rodada !== rodada) return partida;
      if (partida.golsMandante !== null) return partida;
      return simularPartida(
        partida,
        mapa.get(partida.mandanteId)!,
        mapa.get(partida.visitanteId)!,
        aleatorio,
      );
    });
  }
  carreira.ultimaPartidaId = partidaUsuario.id;
  aplicarDesempenho(carreira, partidaUsuario, clube, aleatorio);
  return ctx;
}

/** Após partidas: forma dos clubes, ligas externas, mercado, cenas, etc. */
export function finalizarSemana(ctx: ContextoSemana): EstadoCarreira {
  const {
    carreira,
    aleatorio,
    estadoOriginal,
    hierarquiaAntes,
    livre,
    clube,
    motivoParticipacao,
    incluirUsuarioNoProfissional,
    estavaLesionado,
    rodada,
  } = ctx;
  const j = carreira.jogador;

  for (const c of carreira.clubes.filter(
    (x) => x.ligaId === carreira.liga.id,
  )) {
    const partida = carreira.temporada.partidas.find(
      (p) =>
        p.rodada === rodada && [p.mandanteId, p.visitanteId].includes(c.id),
    );
    if (!partida || partida.golsMandante === null) continue;
    const saldo =
      c.id === partida.mandanteId
        ? partida.golsMandante! - partida.golsVisitante!
        : partida.golsVisitante! - partida.golsMandante!;
    c.forma = limitar(
      c.forma * 0.8 + (saldo > 0 ? 75 : saldo === 0 ? 50 : 25) * 0.2,
    );
    c.moral = limitar(c.moral + Math.sign(saldo) * 3);
    c.fadiga = aleatorio.inteiro(10, 30);
    sincronizarForcaClube(
      c,
      !livre &&
        clube &&
        c.id === clube.id &&
        incluirUsuarioNoProfissional
        ? j
        : undefined,
    );
  }

  // Ligas externas eram compartilhadas no clone seletivo — materializa antes de mutar.
  materializarClubesExternos(carreira);
  materializarTemporadasExternas(carreira);
  avancarLigasExternas(carreira, aleatorio);

  const ids = carreira.clubes
      .filter((c) => c.ligaId === carreira.liga.id)
      .map((c) => c.id),
    regras = carreira.liga.regras;
  carreira.temporada.classificacao = calcularClassificacao(
    ids,
    carreira.temporada.partidas,
    regras.pontosVitoria,
    regras.pontosEmpate,
  );
  carreira.temporada.classificacaoBase = calcularClassificacao(
    ids,
    carreira.temporada.partidasBase,
    regras.pontosVitoria,
    regras.pontosEmpate,
  );
  if (!estavaLesionado && j.lesao)
    registrarEvento(
      carreira,
      "lesao",
      `${j.nome} ficará afastado`,
      `${j.lesao.tipo}. Retorno previsto para ${j.lesao.dataPrevistaRetorno}.`,
      "Departamento médico",
    );
  const idadeInicial = carreira.identidadeInicial.idade;
  j.idade =
    idadeInicial +
    Math.floor(
      (Date.parse(carreira.dataAtual) - Date.parse(carreira.dataInicio)) /
        31557600000,
    );
  if (!livre && clube) {
    avaliarPromocao(carreira, clube);
    if (j.categoria === "profissional") {
      const anterior = j.status;
      const candidatos = [
        ...clube.elenco.map(jogadorMundoComoCandidato),
        jogadorUsuarioComoCandidato(j, bonusPromessa(carreira)),
      ];
      const esc = escalarElencoCompleto(
        candidatos,
        clube.formacaoPreferida,
        clube.treinador,
      );
      aplicarEscalacaoAoClube(clube, esc);
      sincronizarForcaClube(clube, j);
      j.status =
        esc.escalacaoUsuario === "titular"
          ? j.confianca > 90 && j.overall > clube.forcaGeral + 5
            ? "estrela do time"
            : j.confianca > 82
              ? "jogador importante"
              : "titular"
          : esc.escalacaoUsuario === "banco"
            ? "rotacao"
            : "reserva";
      if (
        ["titular", "jogador importante", "estrela do time"].includes(anterior) &&
        ["reserva", "rotacao"].includes(j.status)
      )
        registrarEvento(
          carreira,
          "espaco",
          "Seu espaço no elenco diminuiu",
          "A comissão vai observar seu desempenho nas próximas semanas.",
          "Treinador",
        );
    }
    atualizarCompromissos(carreira);
    const hierarquiaDepois = avaliarHierarquia(carreira);
    if (
      hierarquiaDepois.ordem < hierarquiaAntes.ordem ||
      (!hierarquiaAntes.titular && hierarquiaDepois.titular)
    )
      registrarEvento(
        carreira,
        "hierarquia",
        hierarquiaDepois.titular
          ? "Você conquistou a vaga"
          : "Você subiu na hierarquia",
        `Agora você está em ${hierarquiaDepois.rotulo}. ${hierarquiaDepois.motivo}`,
        "Treinador",
        false,
      );
  }
  atualizarObjetivos(carreira);
  j.valorMercado = calcularValorMercado(j, carreira.liga, carreira.dataAtual);
  avaliarMercado(carreira, aleatorio);
  if (!livre) {
    avisarConcorrencia(carreira, estadoOriginal);
    gerarCenasSemana(carreira, estadoOriginal, aleatorio);
    gerarContextoSemana(carreira, aleatorio);
    gerarDecisoesSemana(carreira, aleatorio);
  }

  registrarResumoSemanal(carreira, estadoOriginal, motivoParticipacao);
  carreira.estadoAleatorio = aleatorio.estado;
  let resultado = carreira;
  if (rodada >= carreira.temporada.totalRodadas) {
    // Playoffs de acesso (ex.: 3º–6º) entram no calendário antes do encerramento.
    if (processarPlayoffsCalendario(carreira, aleatorio)) {
      carreira.estadoAleatorio = aleatorio.estado;
      resultado = carreira;
    } else {
      resultado = finalizarTemporada(carreira);
    }
  }
  resultado = efetivarPreContratos(resultado);
  if (
    !estaSemClube(resultado) &&
    resultado.jogador.categoria === "profissional" &&
    resultado.jogador.contrato.dataTermino < resultado.dataAtual
  ) {
    if (resultado.mercado.emprestimo) delete resultado.mercado.emprestimo;
    tornarAgenteLivre(resultado);
  }
  return resultado;
}

export {
  avancarMotorCausal,
  responderDecisaoMotor,
  finalizarMotorCausal,
};
