import type { Atributo, EstadoCarreira, Posicao } from '@/dominio/entidades/modelos';
import { NOMES_ATRIBUTOS } from '@/dominio/entidades/modelos';
import type { MudancaElencoSemana, ObjetivoPessoalTipo } from '@/dominio/desenvolvimento';
import { criarCooldownsTreinador, DIAS_COOLDOWN_OBJETIVO_PESSOAL } from '@/dominio/desenvolvimento';
import { PESOS_POSICOES } from '@/dominio/regras/jogador';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import { avaliarHierarquia } from '../elenco/hierarquia';
import { registrarEvento } from '../eventos/eventos';
import { limitar, somarDias } from '@/utilitarios/formatacao';

export const OBJETIVOS_PESSOAIS: Record<ObjetivoPessoalTipo,string> = {
  titular:'Virar titular',
  minutos:'Ganhar mais minutos',
  tecnica:'Evoluir tecnicamente',
  emprestimo:'Conseguir empréstimo',
  transferencia:'Buscar transferência',
  renovacao:'Renovar contrato',
};

/** Atributos técnicos relevantes por posição (meta "Evoluir tecnicamente"). */
export const ATRIBUTOS_TECNICA_POSICAO: Record<Posicao, Atributo[]> = {
  GOL: ['reflexos', 'defesaGoleiro', 'posicionamentoGoleiro'],
  ZAG: ['marcacao', 'desarme', 'antecipacao'],
  LD: ['cruzamento', 'desarme', 'velocidade'],
  LE: ['cruzamento', 'desarme', 'aceleracao'],
  VOL: ['desarme', 'marcacao', 'passeCurto'],
  MC: ['passeCurto', 'visao', 'dominio'],
  MEI: ['visao', 'passeCurto', 'dominio'],
  PD: ['drible', 'finalizacao', 'velocidade'],
  PE: ['drible', 'finalizacao', 'compostura'],
  CA: ['finalizacao', 'compostura', 'posicionamento'],
};

export function atributosTecnicaPosicao(posicao: Posicao): Atributo[] {
  return ATRIBUTOS_TECNICA_POSICAO[posicao] ??
    (Object.entries(PESOS_POSICOES[posicao]) as [Atributo, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a);
}

const minutos = (c: EstadoCarreira) => c.registros.reduce((s, r) => s + r.estatisticas.minutos, 0);
export function somaTecnica(c: EstadoCarreira): number {
  return atributosTecnicaPosicao(c.jogador.posicao).reduce((s, a) => s + c.jogador.atributos[a], 0);
}

export function objetivoBloqueadoPorCooldown(
  c: EstadoCarreira,
  tipo: ObjetivoPessoalTipo,
): { bloqueado: boolean; disponivelEm: string | null } {
  const ultimo = [...c.acompanhamento.historicoObjetivos]
    .reverse()
    .find((h) => h.tipo === tipo);
  if (!ultimo) return { bloqueado: false, disponivelEm: null };
  const disponivelEm = somarDias(ultimo.concluidoEm, DIAS_COOLDOWN_OBJETIVO_PESSOAL);
  return {
    bloqueado: disponivelEm > c.dataAtual,
    disponivelEm: disponivelEm > c.dataAtual ? disponivelEm : null,
  };
}

export function escolherObjetivo(estado: EstadoCarreira, tipo: ObjetivoPessoalTipo): EstadoCarreira {
  if (!Object.hasOwn(OBJETIVOS_PESSOAIS, tipo)) throw new Error('Escolha um objetivo válido.');
  if (estado.aposentado) throw new Error('Esta carreira já foi encerrada.');
  const atual = estado.acompanhamento.objetivoPessoal;
  if (atual && !atual.concluido && atual.tipo === tipo) return estado;

  const bloqueio = objetivoBloqueadoPorCooldown(estado, tipo);
  if (bloqueio.bloqueado) {
    throw new Error(
      `Você já alcançou "${OBJETIVOS_PESSOAIS[tipo]}". Poderá reativá-lo após ${bloqueio.disponivelEm}.`,
    );
  }

  const c = structuredClone(estado);
  const cicloId = `${tipo}-${c.dataAtual}-${c.acompanhamento.historicoObjetivos.length + 1}`;
  c.acompanhamento.objetivoPessoal = {
    tipo,
    inicio: c.dataAtual,
    referencia:
      tipo === 'minutos' ? minutos(c)
        : tipo === 'tecnica' ? somaTecnica(c)
          : tipo === 'renovacao' ? Date.parse(c.jogador.contrato.dataTermino)
            : 0,
    progresso: 0,
    concluido: false,
    cicloId,
  };
  registrarEvento(
    c,
    'objetivo-pessoal',
    `Seu foco: ${OBJETIVOS_PESSOAIS[tipo]}`,
    'Seu agente acompanhará esse caminho. A escolha orienta os próximos passos, sem alterar seus atributos.',
    'Agente',
    false,
  );
  return c;
}

export function atualizarObjetivoPessoal(c: EstadoCarreira): void {
  const o = c.acompanhamento.objetivoPessoal;
  if (!o || o.concluido) return;
  const h = avaliarHierarquia(c);
  o.progresso = limitar(
    o.tipo === 'titular' ? (h.titular ? 100 : h.ordem === 2 ? 65 : 25)
      : o.tipo === 'minutos' ? (minutos(c) - o.referencia) / 270 * 100
        : o.tipo === 'tecnica' ? (somaTecnica(c) - o.referencia) / 3 * 100
          : o.tipo === 'emprestimo' ? (c.mercado.emprestimo ? 100 : c.mercado.disponivelParaEmprestimo ? 40 : 0)
            : o.tipo === 'transferencia'
              ? (c.eventos.some((e) => e.tipo === 'transferencia' && e.data >= o.inicio) ? 100
                : c.mercado.statusPedidoSaida === 'aceito' ? 35 : 0)
              : Date.parse(c.jogador.contrato.dataTermino) > o.referencia ? 100 : 0,
  );
  if (o.progresso >= 100) {
    o.concluido = true;
    c.jogador.moral = limitar(c.jogador.moral + 2);
    c.acompanhamento.historicoObjetivos = [
      ...c.acompanhamento.historicoObjetivos.slice(-39),
      { tipo: o.tipo, concluidoEm: c.dataAtual, cicloId: o.cicloId },
    ];
    registrarEvento(
      c,
      'objetivo-pessoal',
      `Objetivo alcançado: ${OBJETIVOS_PESSOAIS[o.tipo]}`,
      'Seu trabalho trouxe resultado. Defina seu próximo foco quando quiser.',
      'Agente',
      false,
    );
  }
}

export function detectarMudancaElenco(
  antes: EstadoCarreira,
  depois: EstadoCarreira,
): MudancaElencoSemana | null {
  if (antes.clubeAtualId !== depois.clubeAtualId) return null;
  const ha = avaliarHierarquia(antes);
  const hd = avaliarHierarquia(depois);
  const motivos: MudancaElencoSemana['motivos'] = [];
  const partes: string[] = [];

  if (hd.ordem < ha.ordem) {
    motivos.push('hierarquia');
    partes.push(`Você subiu para ${hd.rotulo}.`);
  } else if (hd.ordem > ha.ordem) {
    motivos.push('hierarquia');
    partes.push(`Você desceu para ${hd.rotulo}.`);
  }

  if (ha.papelEscalacao !== hd.papelEscalacao) {
    motivos.push('escalacao');
    partes.push(
      hd.papelEscalacao === 'titular' ? 'Você entrou como titular na avaliação da comissão.'
        : hd.papelEscalacao === 'banco' ? 'Seu papel na escalação passou a ser o banco.'
          : `Sua escalação mudou para ${hd.papelEscalacao}.`,
    );
  }

  if (ha.chance !== hd.chance) {
    motivos.push('chance');
    partes.push(`Chance de participar: ${ha.chance} → ${hd.chance}.`);
  }

  if (antes.jogador.status !== depois.jogador.status) {
    motivos.push('papel');
    partes.push(`O treinador alterou seu papel para ${depois.jogador.status}.`);
  }

  const idsAntes = new Set(ha.concorrentes.filter((x) => !x.usuario).map((x) => x.id));
  const idsDepois = hd.concorrentes.filter((x) => !x.usuario);
  const novo = idsDepois.find((x) => !idsAntes.has(x.id));
  if (novo) {
    motivos.push('concorrente');
    partes.push(`Novo concorrente: ${novo.nome}.`);
  }
  const lesionou = idsDepois.find((x) => {
    if (!idsAntes.has(x.id)) return false;
    const ant = ha.concorrentes.find((a) => a.id === x.id);
    return ant?.disponivel === true && x.disponivel === false;
  });
  if (lesionou) {
    motivos.push('concorrente');
    partes.push(`${lesionou.nome} está indisponível.`);
  }

  if (!motivos.length) return null;
  return { texto: partes.join(' '), motivos };
}

export function registrarResumoSemanal(
  c: EstadoCarreira,
  antes: EstadoCarreira,
  motivoParticipacao?: string,
): void {
  const j = c.jogador;
  const evolucoes = (Object.keys(NOMES_ATRIBUTOS) as Atributo[]).flatMap((atributo) =>
    Math.floor(j.atributos[atributo]) > Math.floor(antes.jogador.atributos[atributo])
      ? [{ atributo, antes: Math.floor(antes.jogador.atributos[atributo]), depois: Math.floor(j.atributos[atributo]) }]
      : [],
  );
  const ultimo = [...c.temporada.partidas, ...c.temporada.partidasBase].find((p) => p.id === c.ultimaPartidaId)?.participacao;
  const h = avaliarHierarquia(c);
  let feedback = !ultimo
    ? 'Semana sem participação em partida. O trabalho no treino segue contando para seu desenvolvimento.'
    : ultimo.minutos === 0
      ? `Você não entrou nesta partida. ${motivoParticipacao ?? h.motivo} ${h.proximoPasso}`
      : ultimo.vermelhos
        ? 'A expulsão prejudicou a equipe. Trabalhe a disciplina para preservar a confiança da comissão.'
        : ultimo.gols > 0
          ? `Você contribuiu com ${ultimo.gols} gol(s) em ${ultimo.minutos} minutos. A comissão valorizou sua presença nas jogadas decisivas.`
          : ultimo.assistencias > 0 || ultimo.passesChave >= 3
            ? `Seus ${ultimo.passesChave} passes-chave e ${ultimo.assistencias} assistência(s) ajudaram a criar oportunidades. Continue oferecendo opções ao time.`
            : j.posicao === 'GOL'
              ? `Você participou com ${ultimo.defesas} defesa(s). A comissão acompanhará sua segurança e regularidade.`
              : ultimo.desarmes >= 4
                ? `Você recuperou bolas com ${ultimo.desarmes} desarmes e ajudou a proteger a equipe.`
                : ultimo.minutos < 30
                  ? `Você teve ${ultimo.minutos} minutos para mostrar serviço. Continue bem nos treinos para ampliar sua participação.`
                  : `Você cumpriu ${ultimo.minutos} minutos. O próximo passo é participar mais das ações decisivas da sua função.`;
  const treino = j.preparacao.historico.at(-1);
  const textoTreino = treino
    ? `${treino.avaliacao}. ${treino.progresso > 0 ? 'Progresso acumulado nos atributos trabalhados.' : 'Recuperação física priorizada.'} Confiança ${treino.confianca >= 0 ? '+' : ''}${treino.confianca.toFixed(1)}.`
    : 'Sem avaliação de treino nesta semana.';
  const mudancaElenco = detectarMudancaElenco(antes, c);
  c.acompanhamento.resumoSemanal = {
    data: c.dataAtual,
    treino: textoTreino,
    feedback,
    evolucoes,
    overallAntes: antes.jogador.overall,
    overallDepois: j.overall,
    mudancaElenco,
  };
  if (evolucoes.length)
    registrarEvento(c, 'evolucao', 'Seu trabalho começou a aparecer', evolucoes.map((e) => `${NOMES_ATRIBUTOS[e.atributo]}: ${e.antes} → ${e.depois}`).join(' · '), 'Treinador', false);
  if (j.overall > antes.jogador.overall)
    registrarEvento(c, 'overall', 'Seu nível geral subiu', `${antes.jogador.overall} → ${j.overall}. A evolução reflete os atributos da sua posição.`, 'Treinador');
  atualizarObjetivoPessoal(c);
  if (!h.titular && h.ordem >= 3 && j.personalidade.ambicao >= 70 && (ultimo?.minutos ?? 0) === 0)
    j.moral = limitar(j.moral - (j.personalidade.ambicao - 65) * 0.04);
  else if (h.titular && j.personalidade.ambicao >= 60)
    j.moral = limitar(j.moral + 0.3);
}

/** Compromissos pertencem à comissão; histórico continua preservado após mudar de clube. */
export function atualizarVinculoAcompanhamento(c: EstadoCarreira, paisAnterior?: string): void {
  const a = c.acompanhamento, j = c.jogador;
  if (a.promessa?.status === 'ativa') {
    a.promessa.status = 'encerrada';
    registrarEvento(c, 'promessa', 'Compromisso com a comissão anterior encerrado', 'A mudança de clube encerrou a promessa anterior. Converse com seu novo treinador.', 'Treinador', false);
  }
  a.adaptacao = null;
  a.cooldownsTreinador = criarCooldownsTreinador();
  a.papelAceito = null;
  a.proximoPedidoContrato = null;
  a.base = { ultimaAvaliacao: null, texto: null, treinosProfissional: 0, conviteAte: null };
  if (estaSemClube(c)) {
    atualizarObjetivoPessoal(c);
    return;
  }
  const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId);
  if (!clube) {
    atualizarObjetivoPessoal(c);
    return;
  }
  if (paisAnterior && paisAnterior !== clube.pais) {
    const custo = (100 - j.personalidade.adaptabilidade) * .04;
    j.moral = limitar(j.moral - custo);
    j.forma = limitar(j.forma - custo);
    registrarEvento(c, 'adaptacao', 'Um novo país, uma nova rotina', j.personalidade.adaptabilidade >= 65 ? 'Sua facilidade de adaptação ajuda a enfrentar a mudança.' : 'A mudança de ambiente pede paciência e regularidade nos primeiros treinos.', 'Agente', false);
  }
  atualizarObjetivoPessoal(c);
}
