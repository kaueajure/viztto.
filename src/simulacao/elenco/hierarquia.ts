import type { Clube, EstadoCarreira, Jogador, Posicao } from '@/dominio/entidades/modelos';
import { POSICOES_ALTERNATIVAS } from '@/dominio/regras/jogador';
import { SLOTS_FORMACAO, type Formacao, type SlotFormacao } from '@/dominio/formacao';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import {
  avaliarParaSlot,
  escalarElencoCompleto,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
  pesoCompatibilidade,
  type CandidatoEscalacao,
} from './escalacao-elenco';

/** Compatibilidade mínima para entrar no ranking ordinal (“Xª opção”). */
export const COMPAT_HIERARQUIA = 0.75;

export function notaBase(j: Jogador, clube: Clube): number {
  const media = j.notasRecentes.length ? j.notasRecentes.reduce((a,b) => a+b,0)/j.notasRecentes.length : 6.5;
  return (j.overall-(clube.qualidadeBase-8))*1.2 + (j.confianca-50)*.35 + (media-6.5)*3 + (j.forma-55)*.08 + (j.condicionamento-90)*.08 - j.fadiga*.05 + ((j.preparacao.historico.at(-1)?.nota ?? 55)-55)*.07;
}

export function bonusPromessa(c: EstadoCarreira): number {
  const p = c.acompanhamento.promessa;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  return p?.status === 'ativa' && p.tipo === 'minutos' && p.clubeId === c.clubeAtualId && p.treinadorId === clube?.treinador.id && !c.jogador.lesao && c.jogador.condicionamento >= 65 ? 2 : 0;
}

function formacaoDoClube(clube: Clube): Formacao {
  const preferida = clube.treinador?.formacaoPreferida;
  if (preferida && preferida in SLOTS_FORMACAO) return preferida;
  return clube.formacaoPreferida;
}

function slotsUnicos(formacao: Formacao): SlotFormacao[] {
  const slots: SlotFormacao[] = ['GOL', ...SLOTS_FORMACAO[formacao]];
  return [...new Set(slots)];
}

export type FaixaHierarquia = 'titularidade' | 'rotacao' | 'desenvolvimento';

function hierarquiaSemClube() {
  return {
    ordem: 99,
    faixa: 'desenvolvimento' as FaixaHierarquia,
    rotulo: 'Sem clube',
    formacaoUsaPosicao: false,
    formacaoUsaPosicaoPrincipal: false,
    formacaoUsaPosicaoSecundaria: false,
    slotReferencia: null as SlotFormacao | null,
    papelEscalacao: 'nao relacionado' as const,
    titular: false,
    chance: 'Muito baixa',
    motivo: 'Você está sem clube e não disputa posição em nenhum elenco.',
    proximoPasso: 'Peça ao agente para buscar oportunidades ou contate um clube específico.',
    distancia: 'Agente livre',
    concorrentes: [] as { id: string; nome: string; overall: number; disponivel: boolean; usuario: boolean }[],
  };
}

/** Slot da posição principal (inclui SA como extensão natural de atacantes/meias). */
function slotPosicaoPrincipal(
  usuario: CandidatoEscalacao,
  slot: SlotFormacao,
): boolean {
  if (usuario.posicaoPrincipal === slot) return true;
  if (slot === 'SA' && ['CA', 'MEI', 'PD', 'PE'].includes(usuario.posicaoPrincipal))
    return true;
  return false;
}

function slotPosicaoSecundaria(
  usuario: CandidatoEscalacao,
  slot: SlotFormacao,
): boolean {
  return usuario.posicoesSecundarias.includes(slot as Posicao);
}

/**
 * Nota estrutural da hierarquia: ignora lesão/suspensão.
 * Disponibilidade semanal fica a cargo da escalação (`escalarElencoCompleto`).
 */
export function notaHierarquiaEstrutural(
  candidato: CandidatoEscalacao,
  slot: SlotFormacao,
  rotacaoTreinador = 50,
): number {
  if (candidato.lesionado || candidato.suspensao > 0) {
    return avaliarParaSlot(
      { ...candidato, lesionado: false, suspensao: 0 },
      slot,
      rotacaoTreinador,
    );
  }
  return avaliarParaSlot(candidato, slot, rotacaoTreinador);
}

/**
 * Ranking ordinal da posição: só concorrentes com compatibilidade forte.
 * Lesionados/suspensos permanecem no ranking (hierarquia ≠ disponibilidade).
 * O usuário entra sempre no slot avaliado.
 */
export function rankingHierarquiaSlot(
  candidatos: CandidatoEscalacao[],
  slot: SlotFormacao,
  rotacaoTreinador: number,
): { x: CandidatoEscalacao; nota: number; compat: number }[] {
  return candidatos
    .map((x) => ({
      x,
      nota: notaHierarquiaEstrutural(x, slot, rotacaoTreinador),
      compat: pesoCompatibilidade(x, slot),
    }))
    .filter((row) => {
      if (row.nota <= -100) return false;
      if (row.x.ehUsuario) return true;
      return row.compat >= COMPAT_HIERARQUIA;
    })
    .sort((a, b) => b.nota - a.nota);
}

function rotuloSituacaoEscalacao(
  papel: 'titular' | 'banco' | 'nao relacionado' | 'lesionado' | 'suspenso',
  concorrentesIndisponiveis: { nome: string }[],
): string {
  if (papel === 'titular') {
    if (concorrentesIndisponiveis.length > 0) {
      const nomes = concorrentesIndisponiveis
        .slice(0, 2)
        .map((c) => c.nome)
        .join(' e ');
      return `Titular no próximo jogo porque ${nomes} ${concorrentesIndisponiveis.length === 1 ? 'está indisponível' : 'estão indisponíveis'}`;
    }
    return 'Titular no próximo jogo';
  }
  if (papel === 'banco') return 'Banco no próximo jogo';
  if (papel === 'lesionado') return 'Indisponível por lesão';
  if (papel === 'suspenso') return 'Suspenso para o próximo jogo';
  return 'Fora da lista no próximo jogo';
}

export function avaliarHierarquia(c: EstadoCarreira) {
  if (estaSemClube(c)) return hierarquiaSemClube();
  const j = c.jogador, clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  if (!clube) return hierarquiaSemClube();
  const proximoPasso = j.lesao ? 'Complete a recuperação com o departamento médico.' : j.fadiga > 65 || j.condicionamento < 65 ? 'Reduza a carga e recupere o condicionamento.' : j.confianca < 55 ? 'Boas avaliações de treino e regularidade ajudam a conquistar confiança.' : 'Mantenha bons treinos e aproveite os minutos disponíveis.';

  if (j.categoria === 'base') {
    const nota = notaBase(j, clube);
    const faixa: FaixaHierarquia = nota > 6 ? 'titularidade' : nota > -10 ? 'rotacao' : 'desenvolvimento';
    const ordem = faixa === 'titularidade' ? 1 : faixa === 'rotacao' ? 2 : 3;
    const disponivel = !j.lesao && j.suspensao <= 0;
    const rotulo =
      faixa === 'titularidade' ? 'Faixa de titularidade' :
      faixa === 'rotacao' ? 'Faixa de rotação' : 'Em desenvolvimento';
    return {
      ordem,
      faixa,
      rotulo,
      formacaoUsaPosicao: true,
      formacaoUsaPosicaoPrincipal: true,
      formacaoUsaPosicaoSecundaria: false,
      slotReferencia: null as SlotFormacao | null,
      papelEscalacao: (faixa === 'titularidade' ? 'titular' : faixa === 'rotacao' ? 'banco' : 'nao relacionado') as 'titular' | 'banco' | 'nao relacionado' | 'lesionado' | 'suspenso',
      concorrentes: [] as { id:string; nome:string; overall:number; disponivel:boolean; usuario:boolean }[],
      titular: disponivel && faixa === 'titularidade',
      chance: !disponivel ? 'Muito baixa' : nota > 14 ? 'Muito alta' : nota > 6 ? 'Alta' : nota > -10 ? 'Média' : nota > -18 ? 'Baixa' : 'Muito baixa',
      motivo: !disponivel
        ? j.lesao ? 'Você está em recuperação médica.' : 'Você está suspenso.'
        : `Você está na ${rotulo.toLowerCase()} da categoria de base. Sem elenco juvenil completo para ranking ordinal, a comissão compara nível, forma e treino com a exigência da base.`,
      proximoPasso,
      distancia: faixa === 'titularidade' ? 'Pronto para disputar a vaga na base' : faixa === 'rotacao' ? 'Próximo da rotação' : 'Ainda em formação',
    };
  }

  const formacao = formacaoDoClube(clube);
  const usuario = jogadorUsuarioComoCandidato(j);
  usuario.confiancaTreinador += bonusPromessa(c) * 10;
  const candidatos = [...clube.elenco.map(jogadorMundoComoCandidato), usuario];
  const slots = slotsUnicos(formacao);

  const slotsPrincipais = slots.filter((s) => slotPosicaoPrincipal(usuario, s));
  const slotsSecundarios = slots.filter(
    (s) => slotPosicaoSecundaria(usuario, s) && !slotPosicaoPrincipal(usuario, s),
  );
  const slotsFortes = slots.filter(
    (s) =>
      !slotPosicaoPrincipal(usuario, s) &&
      !slotPosicaoSecundaria(usuario, s) &&
      pesoCompatibilidade(usuario, s) >= COMPAT_HIERARQUIA,
  );
  const slotsEmergencia = slots.filter(
    (s) =>
      !slotPosicaoPrincipal(usuario, s) &&
      !slotPosicaoSecundaria(usuario, s) &&
      pesoCompatibilidade(usuario, s) >= 0.35 &&
      pesoCompatibilidade(usuario, s) < COMPAT_HIERARQUIA,
  );

  const formacaoUsaPosicaoPrincipal = slotsPrincipais.length > 0;
  const formacaoUsaPosicaoSecundaria = slotsSecundarios.length > 0;
  /** Compat: true só quando a formação usa a posição principal. */
  const formacaoUsaPosicao = formacaoUsaPosicaoPrincipal;

  type OrigemSlot = 'principal' | 'secundaria' | 'alternativa' | 'emergencia';
  let origemSlot: OrigemSlot = 'principal';
  let slotsAvaliados: SlotFormacao[];
  if (slotsPrincipais.length > 0) {
    slotsAvaliados = slotsPrincipais;
    origemSlot = 'principal';
  } else if (slotsSecundarios.length > 0) {
    slotsAvaliados = slotsSecundarios;
    origemSlot = 'secundaria';
  } else if (slotsFortes.length > 0) {
    slotsAvaliados = slotsFortes;
    origemSlot = 'alternativa';
  } else {
    slotsAvaliados = slotsEmergencia;
    origemSlot = 'emergencia';
  }

  let melhorOrdem = Number.POSITIVE_INFINITY;
  let melhorNota = -Infinity;
  let melhorCompatUsuario = -1;
  let slotReferencia: SlotFormacao | null = null;
  let rankingMelhor: { x: CandidatoEscalacao; nota: number; compat: number }[] = [];

  for (const slot of slotsAvaliados) {
    const ranking = rankingHierarquiaSlot(
      candidatos,
      slot,
      clube.treinador.rotacao,
    );
    const idx = ranking.findIndex((x) => x.x.ehUsuario);
    if (idx < 0) continue;
    const ordemSlot = idx + 1;
    const notaUsuario = ranking[idx]!.nota;
    const compatUsuario = ranking[idx]!.compat;
    const melhorQueAtual =
      compatUsuario > melhorCompatUsuario ||
      (compatUsuario === melhorCompatUsuario &&
        (ordemSlot < melhorOrdem ||
          (ordemSlot === melhorOrdem && notaUsuario > melhorNota)));
    if (melhorQueAtual) {
      melhorOrdem = ordemSlot;
      melhorNota = notaUsuario;
      melhorCompatUsuario = compatUsuario;
      slotReferencia = slot;
      rankingMelhor = ranking;
    }
  }

  // Fallback: posição principal fora da formação — ainda calcula profundidade estrutural.
  if (!Number.isFinite(melhorOrdem)) {
    const slotEstrutural = (usuario.posicaoPrincipal as SlotFormacao) || null;
    if (slotEstrutural) {
      rankingMelhor = rankingHierarquiaSlot(
        candidatos,
        slotEstrutural,
        clube.treinador.rotacao,
      );
      const idx = rankingMelhor.findIndex((x) => x.x.ehUsuario);
      if (idx >= 0) {
        melhorOrdem = idx + 1;
        melhorNota = rankingMelhor[idx]!.nota;
        slotReferencia = slotEstrutural;
      }
    }
  }

  const escalacao = escalarElencoCompleto(
    candidatos,
    formacao,
    clube.treinador,
  ).escalacaoUsuario;
  const ordem = Number.isFinite(melhorOrdem) ? melhorOrdem : 99;
  const lider = rankingMelhor.find(
    (x) => !x.x.ehUsuario && !x.x.lesionado && x.x.suspensao <= 0,
  );
  const indisponiveis = rankingMelhor.filter(
    (x) => !x.x.ehUsuario && (x.x.lesionado || x.x.suspensao > 0),
  );
  const diferenca =
    lider && Number.isFinite(melhorNota) ? lider.nota - melhorNota : 0;
  const situacaoJogo = rotuloSituacaoEscalacao(
    escalacao,
    indisponiveis.map((row) => ({ nome: row.x.nome })),
  );

  const hierarquiaRotulo = slotReferencia
    ? origemSlot === 'secundaria'
      ? `${ordem}ª opção em ${slotReferencia} (posição secundária)`
      : origemSlot === 'alternativa' || origemSlot === 'emergencia'
        ? `Alternativa para ${slotReferencia} · ${ordem}ª opção`
        : `${ordem}ª opção em ${slotReferencia}`
    : `Fora do desenho · ${formacao}`;

  let motivo: string;
  if (j.lesao) {
    motivo = `${hierarquiaRotulo}. Você está em recuperação médica — a hierarquia da posição se mantém, mas você fica fora do próximo jogo.`;
  } else if (j.suspensao > 0) {
    motivo = `${hierarquiaRotulo}. Você está suspenso para o próximo jogo; a ordem na posição não muda por isso.`;
  } else if (j.condicionamento < 65 || j.fadiga > 65) {
    motivo = `${hierarquiaRotulo}. Seu preparo físico limita a participação nesta semana. ${situacaoJogo}.`;
  } else if (origemSlot === 'secundaria' && slotReferencia) {
    motivo = `A formação atual não utiliza sua posição principal ${j.posicao}. Você está sendo considerado como ${slotReferencia}, sua posição secundária — hoje ${ordem}ª opção nessa função. ${situacaoJogo}.`;
  } else if (
    (origemSlot === 'alternativa' || origemSlot === 'emergencia') &&
    slotReferencia
  ) {
    motivo = `A formação atual não usa ${j.posicao}. Você está sendo considerado como alternativa para ${slotReferencia} — ${ordem}ª opção entre concorrentes reais dessa função. ${situacaoJogo}.`;
  } else if (!slotReferencia) {
    motivo = `A formação ${formacao} não usa ${j.posicao} e não há função próxima com boa adequação. ${situacaoJogo}.`;
  } else if (escalacao === 'titular') {
    motivo = `${situacaoJogo}. Na hierarquia estrutural você é ${ordem}ª opção em ${slotReferencia}.`;
  } else if (lider && diferenca > 0) {
    motivo = `${situacaoJogo}. ${lider.x.nome} está à frente na disputa por ${slotReferencia}: ${lider.x.overall > j.overall ? 'oferece maior nível atual' : lider.x.forma > j.forma ? 'está em melhor forma' : 'tem melhor avaliação para a função'}. ${j.confianca < 55 ? 'Sua confiança com a comissão ainda precisa crescer.' : 'O treinador também considera a formação e o equilíbrio da equipe.'}`;
  } else {
    motivo = `${situacaoJogo}. Há disputa aberta pela vaga de ${slotReferencia} na formação ${formacao}. Versatilidade e bons treinos podem abrir espaço.`;
  }

  return {
    ordem,
    faixa: (escalacao === 'titular' ? 'titularidade' : escalacao === 'banco' ? 'rotacao' : 'desenvolvimento') as FaixaHierarquia,
    rotulo: hierarquiaRotulo,
    formacaoUsaPosicao,
    formacaoUsaPosicaoPrincipal,
    formacaoUsaPosicaoSecundaria,
    slotReferencia,
    papelEscalacao: escalacao,
    titular: escalacao === 'titular',
    chance:
      escalacao === 'titular'
        ? j.condicionamento >= 80 ? 'Muito alta' : 'Alta'
        : escalacao === 'banco'
          ? ordem <= 2 ? 'Média' : 'Baixa'
          : 'Muito baixa',
    motivo,
    proximoPasso,
    distancia:
      diferenca > 10 ? 'Distância considerável' : diferenca > 3 ? 'Disputa aberta' : 'Níveis próximos',
    concorrentes: rankingMelhor.slice(0, 5).map(({ x }) => ({
      id: x.id,
      nome: x.nome,
      overall: x.overall,
      disponivel: !x.lesionado && x.suspensao <= 0,
      usuario: x.ehUsuario,
    })),
  };
}

const ALTERNATIVAS = POSICOES_ALTERNATIVAS;

/** Alternativas conceituais da posição (criação e adaptação). */
export function posicoesAlternativas(posicao: Posicao): Posicao[] {
  return [...ALTERNATIVAS[posicao]];
}

export function posicoesPlausiveis(j: Jogador): Posicao[] {
  return ALTERNATIVAS[j.posicao].filter((p) =>
    p === 'CA'
      ? j.atributos.finalizacao >= 48
      : p === 'ZAG' || p === 'VOL'
        ? j.atributos.desarme >= 45
        : true,
  );
}
