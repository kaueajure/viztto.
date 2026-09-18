import { calcularOverall } from "@/dominio/regras/jogador";
import { resolverHistoria } from "@/dominio/historia-formacao";
import type { EstadoCarreira, Posicao } from '@/dominio/entidades/modelos';
import type { AcaoTreinador, CategoriaConversaTreinador, CooldownsTreinador } from '@/dominio/desenvolvimento';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import { avaliarHierarquia, posicoesPlausiveis } from './hierarquia';
import { registrarEvento } from '../eventos/eventos';
import { limitar, somarDias, formatarData } from '@/utilitarios/formatacao';

export const ACOES_TREINADOR: Record<AcaoTreinador, string> = {
  motivo: 'Por que não estou jogando?',
  oportunidade: 'Pedir mais oportunidades',
  melhorar: 'O que preciso melhorar?',
  papel: 'Conversar sobre meu papel',
  posicao: 'Pedir teste em outra posição',
  aceitar: 'Aceitar meu papel atual',
  reclamar: 'Reclamar da falta de minutos',
  cobrar: 'Cobrar promessa não cumprida',
};

export const CATEGORIA_ACAO_TREINADOR: Record<AcaoTreinador, CategoriaConversaTreinador> = {
  motivo: 'informativa',
  melhorar: 'informativa',
  papel: 'informativa',
  aceitar: 'informativa',
  oportunidade: 'pedido',
  reclamar: 'reclamacao',
  cobrar: 'cobranca',
  posicao: 'posicional',
};

/** Dias de espera por categoria — informativas são curtas para não bloquear pedidos. */
export const DIAS_COOLDOWN_TREINADOR: Record<CategoriaConversaTreinador, number> = {
  informativa: 3,
  pedido: 14,
  reclamacao: 14,
  cobranca: 7,
  posicional: 7,
};

export const DIAS_ADAPTACAO_PRINCIPAL = 112;

export function semanasAdaptacaoSecundaria(adaptabilidade: number): number {
  return adaptabilidade >= 60 ? 8 : 10;
}

export function cooldownTreinadorAtivo(cooldowns: CooldownsTreinador, categoria: CategoriaConversaTreinador, dataAtual: string): string | null {
  const ate = cooldowns[categoria];
  return ate && ate > dataAtual ? ate : null;
}

export function acaoTreinadorBloqueada(estado: EstadoCarreira, acao: AcaoTreinador): string | null {
  return cooldownTreinadorAtivo(estado.acompanhamento.cooldownsTreinador, CATEGORIA_ACAO_TREINADOR[acao], estado.dataAtual);
}

export function avaliarProgressoAdaptacao(c: EstadoCarreira) {
  const adaptacao = c.acompanhamento.adaptacao;
  if (!adaptacao) return null;
  const j = c.jogador;
  const semanasAlvo = semanasAdaptacaoSecundaria(j.personalidade.adaptabilidade);
  const prazoPrincipal = somarDias(adaptacao.inicio, DIAS_ADAPTACAO_PRINCIPAL);
  const overallPosicao = calcularOverall(j.atributos, adaptacao.posicao);
  const overallOk = overallPosicao >= j.overall - 2;
  const tempoOk = c.dataAtual >= prazoPrincipal;
  const fase = adaptacao.status === 'ativa' ? 1 as const : 2 as const;
  const podePrincipal = adaptacao.status === 'secundaria' && tempoOk && overallOk;
  let motivoBloqueioPrincipal: string | null = null;
  if (adaptacao.status === 'ativa') {
    motivoBloqueioPrincipal = `Ainda estamos na fase 1: conquistar ${adaptacao.posicao} como posição secundária (cerca de ${semanasAlvo} semanas de treino).`;
  } else if (!tempoOk) {
    motivoBloqueioPrincipal = `A fase 2 exige cerca de ${DIAS_ADAPTACAO_PRINCIPAL} dias desde o início do teste (prazo aproximado ${formatarData(prazoPrincipal)}).`;
  } else if (!overallOk) {
    motivoBloqueioPrincipal = `Seu nível como ${adaptacao.posicao} (${overallPosicao}) ainda não está próximo o bastante do overall atual (${j.overall}) para assumir a principal.`;
  }
  const rotuloStatus = adaptacao.status === 'ativa'
    ? `Fase 1 em andamento (${adaptacao.semanas}/${semanasAlvo} semanas)`
    : podePrincipal
      ? 'Fase 2 pronta: pode pedir a mudança da posição principal'
      : `Fase 2: secundária conquistada · principal ainda em avaliação`;
  return {
    posicao: adaptacao.posicao,
    fase,
    status: adaptacao.status,
    semanas: adaptacao.semanas,
    semanasAlvo,
    prazoPrincipal,
    overallPosicao,
    overallOk,
    tempoOk,
    podePrincipal,
    motivoBloqueioPrincipal,
    rotuloStatus,
    texto: `Adaptação a ${adaptacao.posicao}: ${rotuloStatus}. Fase 1 — secundária em ~${semanasAlvo} semanas. Fase 2 — principal após ~${DIAS_ADAPTACAO_PRINCIPAL} dias (aprox. ${formatarData(prazoPrincipal)})${motivoBloqueioPrincipal && !podePrincipal ? ` ${motivoBloqueioPrincipal}` : ''}`,
  };
}

export function conversarTreinador(estado: EstadoCarreira, acao: AcaoTreinador, posicao?: Posicao): EstadoCarreira {
  if (estado.aposentado) throw new Error('A carreira já foi encerrada.');
  if (estaSemClube(estado))
    throw new Error('Você está sem clube e não possui treinador para conversar.');
  if (!Object.hasOwn(ACOES_TREINADOR, acao)) throw new Error('Conversa inválida.');
  const c = structuredClone(estado), a = c.acompanhamento, j = c.jogador;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  if (!clube) throw new Error('Você está sem clube e não possui treinador para conversar.');
  const categoria = CATEGORIA_ACAO_TREINADOR[acao];
  const bloqueio = cooldownTreinadorAtivo(a.cooldownsTreinador, categoria, c.dataAtual);
  if (bloqueio) {
    const semanas = Math.max(1, Math.ceil((Date.parse(bloqueio) - Date.parse(c.dataAtual)) / 604800000));
    throw new Error(`Nova conversa dessa categoria possível em aproximadamente ${semanas} semana(s).`);
  }
  const h = avaliarHierarquia(c);
  let resposta = `${h.motivo} Próximo passo: ${h.proximoPasso}`;
  if (acao === 'oportunidade') {
    if (a.promessa?.status === 'ativa') resposta = `Nosso compromisso continua: ${a.promessa.condicao}`;
    else if (j.lesao || j.condicionamento < 65) resposta = 'Primeiro complete a recuperação. Não vou prometer minutos enquanto seu preparo estiver comprometido.';
    else if (j.confianca >= 50 && c.relacionamentos.treinador >= 40 && h.ordem <= 3) {
      const tipo = j.confianca >= 62 && h.ordem <= 2 ? 'minutos' : 'avaliacao';
      const condicao = tipo === 'minutos' ? 'Dar uma oportunidade nas próximas três partidas, se você estiver disponível e em condições físicas.' : 'Reavaliar seu espaço após três partidas, considerando treinos, concorrência e preparo.';
      a.promessa = { tipo, clubeId: clube.id, treinadorId: clube.treinador.id, inicio: c.dataAtual, prazo: somarDias(c.dataAtual, 35), condicao, status: 'ativa', partidas: 0, limitePartidas: 3 };
      resposta = condicao;
    } else resposta = `Ainda não é hora de prometer uma chance. ${h.motivo} ${h.proximoPasso}`;
  } else if (acao === 'melhorar') {
    resposta = `${h.proximoPasso} ${j.preparacao.historico.at(-1)?.nota && j.preparacao.historico.at(-1)!.nota < 55 ? 'O último treino ficou abaixo do esperado.' : 'Treine no Centro os fundamentos da função que quer disputar.'}`;
  } else if (acao === 'papel') resposta = `Seu papel atual é ${j.status}; o contrato prevê ${j.contrato.papelEsperado}. ${h.motivo}`;
  else if (acao === 'aceitar') {
    const mesmoContexto = a.papelAceito?.clubeId === clube.id && a.papelAceito.status === j.status;
    if (mesmoContexto) {
      resposta = `Já registramos sua aceitação como ${j.status}. Quando o papel no elenco mudar de fato, podemos revisitar o assunto. Por ora: ${h.proximoPasso}`;
    } else {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 2 + j.personalidade.lealdade / 100);
      j.moral = limitar(j.moral + 1);
      a.papelAceito = { status: j.status, data: c.dataAtual, clubeId: clube.id };
      resposta = `Valorizo sua postura. Aceitar o papel não fecha a porta: ${h.proximoPasso}`;
    }
  } else if (acao === 'reclamar') {
    const recente = j.notasRecentes.at(-1) ?? 6.5;
    c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - ((100 - j.personalidade.temperamento) > clube.treinador.paciencia ? 4 : 2));
    j.moral = limitar(j.moral + 1);
    resposta = recente >= 7 && !h.titular ? 'Entendo sua cobrança depois das boas atuações. Vou observar sua disputa pela vaga, mas não posso garantir titularidade.' : `A cobrança desgasta nossa relação. ${h.motivo} ${h.proximoPasso}`;
  } else if (acao === 'cobrar') {
    if (a.promessa?.status !== 'descumprida') resposta = 'Não há uma promessa descumprida para discutir agora.';
    else {
      j.moral = limitar(j.moral + 2);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 1);
      resposta = 'Você tem razão em cobrar. Não cumpri o combinado; precisamos reconstruir a confiança e avaliar seu espaço.';
      a.promessa.status = 'encerrada';
    }
  } else if (acao === 'posicao') {
    if (!posicao || !posicoesPlausiveis(j).includes(posicao)) throw new Error('Escolha uma posição plausível para o seu perfil.');
    const progresso = a.adaptacao?.posicao === posicao ? avaliarProgressoAdaptacao(c) : null;
    if (progresso?.podePrincipal) {
      j.posicaoSecundaria = j.posicao;
      j.posicao = posicao;
      j.overall = calcularOverall(j.atributos, posicao);
      j.preparacao.planoId = null;
      j.preparacao.prioridades = [];
      a.adaptacao = null;
      resposta = `Seu trabalho sustentou a mudança. ${posicao} passa a ser sua posição principal.`;
    } else if (a.adaptacao?.status === 'ativa') {
      resposta = 'Conclua a fase 1 da adaptação atual antes de começar outro teste. A secundária ainda está em avaliação.';
    } else if (progresso && !progresso.podePrincipal) {
      resposta = `Você já tem ${posicao} como alternativa. ${progresso.motivoBloqueioPrincipal ?? 'Ainda não é hora de mudar a posição principal.'}`;
    } else if (j.confianca < 45 || j.lesao) {
      resposta = `Vamos esperar. ${h.proximoPasso}`;
    } else {
      const semanas = semanasAdaptacaoSecundaria(j.personalidade.adaptabilidade);
      a.adaptacao = { posicao, inicio: c.dataAtual, semanas: 0, clubeId: clube.id, status: 'ativa' };
      resposta = `Vamos trabalhar como ${posicao}. Fase 1: cerca de ${semanas} semanas para avaliar a posição secundária (sua principal permanece ${j.posicao}). Fase 2: após cerca de ${DIAS_ADAPTACAO_PRINCIPAL} dias desde o início, podemos discutir mudar a principal se o nível convencer.`;
    }
  }
  a.conversas = [...a.conversas, { data: c.dataAtual, acao, resposta, clubeId: clube.id }].slice(-30);
  a.cooldownsTreinador = { ...a.cooldownsTreinador, [categoria]: somarDias(c.dataAtual, DIAS_COOLDOWN_TREINADOR[categoria]) };
  registrarEvento(c, 'treinador', ACOES_TREINADOR[acao], resposta, 'Treinador', false);
  return c;
}

export function atualizarCompromissos(c: EstadoCarreira): void {
  if (estaSemClube(c)) return;
  const a = c.acompanhamento, j = c.jogador;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  if (!clube) return;
  const partida = [...c.temporada.partidas, ...c.temporada.partidasBase].find(p => p.id === c.ultimaPartidaId);
  const p = a.promessa;
  if (p?.status === 'ativa') {
    if (p.clubeId !== clube.id || p.treinadorId !== clube.treinador.id) {
      p.status = 'encerrada';
      registrarEvento(c, 'promessa', 'Compromisso encerrado', 'A mudança de clube ou comissão encerrou o compromisso anterior.', 'Treinador', false);
    } else {
      if (partida) p.partidas++;
      if (p.tipo === 'minutos' && (partida?.participacao?.minutos ?? 0) > 0 || p.tipo === 'avaliacao' && (p.partidas >= p.limitePartidas || c.dataAtual >= p.prazo)) {
        p.status = 'cumprida';
        c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 3);
        registrarEvento(c, 'promessa', 'Compromisso cumprido', p.tipo === 'minutos' ? 'Você recebeu a oportunidade combinada. A relação com a comissão melhorou.' : `A comissão reavaliou sua situação: ${avaliarHierarquia(c).motivo}`, 'Treinador', false);
      } else if (p.partidas >= p.limitePartidas || c.dataAtual >= p.prazo) {
        p.status = j.lesao || j.suspensao > 0 || j.condicionamento < 65 ? 'encerrada' : 'descumprida';
        if (p.status === 'descumprida') {
          c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 3);
          j.moral = limitar(j.moral - 2);
        }
        registrarEvento(c, 'promessa', p.status === 'descumprida' ? 'A oportunidade prometida não veio' : 'Compromisso encerrado por indisponibilidade', p.status === 'descumprida' ? 'Você pode cobrar o treinador na próxima conversa.' : 'A condição de disponibilidade não foi atendida. Converse após a recuperação.', 'Treinador', false);
      }
    }
  }
  if (j.perfilFormacao.origem === 'historia' && resolverHistoria(j.perfilFormacao.escolhas).some(o => o.afinidade === 'lideranca') && (j.preparacao.historico.at(-1)?.nota ?? 0) >= 65)
    j.personalidade.lideranca = limitar(j.personalidade.lideranca + .08);
  const adaptacao = a.adaptacao;
  if (adaptacao?.status === 'ativa') {
    if (adaptacao.clubeId !== clube.id) {
      a.adaptacao = null;
      registrarEvento(c, 'posicao', 'Adaptação interrompida', 'Converse com a nova comissão para retomar o teste posicional.', 'Treinador', false);
    } else if (!j.lesao && j.preparacao.historico.at(-1)?.avaliacao !== 'Recuperação') {
      adaptacao.semanas++;
      if (adaptacao.semanas >= semanasAdaptacaoSecundaria(j.personalidade.adaptabilidade) && j.confianca >= 50 && posicoesPlausiveis(j).includes(adaptacao.posicao)) {
        j.posicaoSecundaria = adaptacao.posicao;
        adaptacao.status = 'secundaria';
        const prazo = somarDias(adaptacao.inicio, DIAS_ADAPTACAO_PRINCIPAL);
        registrarEvento(c, 'posicao', `Nova posição secundária: ${adaptacao.posicao}`, `Fase 1 concluída. A principal ainda depende da fase 2 (prazo aproximado ${formatarData(prazo)} e nível compatível na posição).`, 'Treinador');
      }
    }
  } else if (adaptacao && adaptacao.clubeId !== clube.id) {
    a.adaptacao = null;
    registrarEvento(c, 'posicao', 'Adaptação interrompida', 'Converse com a nova comissão para retomar o teste posicional.', 'Treinador', false);
  }
}
