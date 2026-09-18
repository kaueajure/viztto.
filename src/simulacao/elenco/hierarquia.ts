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

function slotDiretoDoUsuario(
  usuario: CandidatoEscalacao,
  slot: SlotFormacao,
): boolean {
  if (usuario.posicaoPrincipal === slot) return true;
  if (usuario.posicoesSecundarias.includes(slot as Posicao)) return true;
  if (slot === 'SA' && ['CA', 'MEI', 'PD', 'PE'].includes(usuario.posicaoPrincipal))
    return true;
  return false;
}

/**
 * Ranking ordinal da posição: só concorrentes com compatibilidade forte.
 * O usuário entra sempre (para hierarquia em função alternativa).
 * Compat 0.50/0.35/0.12 continua valendo na escalação emergencial, não aqui.
 */
export function rankingHierarquiaSlot(
  candidatos: CandidatoEscalacao[],
  slot: SlotFormacao,
  rotacaoTreinador: number,
): { x: CandidatoEscalacao; nota: number; compat: number }[] {
  return candidatos
    .map((x) => ({
      x,
      nota: avaliarParaSlot(x, slot, rotacaoTreinador),
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
): string {
  if (papel === 'titular') return 'Titular no próximo jogo';
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
  const slotsDiretos = slots.filter((s) => slotDiretoDoUsuario(usuario, s));
  const slotsAlternativos =
    slotsDiretos.length > 0
      ? []
      : slots.filter((s) => pesoCompatibilidade(usuario, s) >= 0.35);
  const slotsAvaliados =
    slotsDiretos.length > 0 ? slotsDiretos : slotsAlternativos;
  const formacaoUsaPosicao = slotsDiretos.length > 0;

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
    // Prefere slot natural; entre iguais, melhor ordem; depois melhor nota.
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

  const escalacao = escalarElencoCompleto(
    candidatos,
    formacao,
    clube.treinador,
  ).escalacaoUsuario;
  const situacaoJogo = rotuloSituacaoEscalacao(escalacao);
  const ordem = Number.isFinite(melhorOrdem) ? melhorOrdem : 1;
  const lider = rankingMelhor.find((x) => !x.x.ehUsuario && !x.x.lesionado && x.x.suspensao <= 0);
  const indisponiveis = rankingMelhor.filter(
    (x) => !x.x.ehUsuario && (x.x.lesionado || x.x.suspensao > 0),
  );
  const diferenca = lider ? lider.nota - melhorNota : 0;
  const alternativasRotulo = slotsAlternativos.slice(0, 3).join('/');

  let motivo: string;
  if (j.lesao) motivo = 'Você está em recuperação médica.';
  else if (j.suspensao > 0) motivo = 'Você está suspenso.';
  else if (j.condicionamento < 65 || j.fadiga > 65) motivo = 'Seu preparo físico limita a participação.';
  else if (!formacaoUsaPosicao) {
    motivo = slotReferencia
      ? `A formação atual não usa ${j.posicao}. Você é considerado alternativa para ${alternativasRotulo || slotReferencia}. Na disputa por ${slotReferencia} você aparece como ${ordem}ª opção entre concorrentes reais dessa função. ${situacaoJogo}.`
      : `A formação atual não usa ${j.posicao}, e também não há função próxima com boa adequação no desenho ${formacao}. ${situacaoJogo}.`;
  } else if (escalacao === 'titular') {
    motivo = `${situacaoJogo}. ${indisponiveis.length ? 'Há concorrentes indisponíveis. ' : ''}Seu nível, momento e adequação à vaga de ${slotReferencia ?? j.posicao} na formação ${formacao} colocam você entre as primeiras escolhas.`;
  } else if (lider && diferenca > 0) {
    motivo = `${situacaoJogo}. ${lider.x.nome} está à frente na disputa por ${slotReferencia ?? j.posicao}: ${lider.x.overall > j.overall ? 'oferece maior nível atual' : lider.x.forma > j.forma ? 'está em melhor forma' : 'tem melhor avaliação para a função'}. ${j.confianca < 55 ? 'Sua confiança com a comissão ainda precisa crescer.' : 'O treinador também considera a formação e o equilíbrio da equipe.'}`;
  } else {
    motivo = `${situacaoJogo}. Há disputa aberta pela vaga de ${slotReferencia ?? j.posicao} na formação ${formacao}. Versatilidade e bons treinos podem abrir espaço.`;
  }

  const rotulo = !formacaoUsaPosicao
    ? slotReferencia
      ? `Alternativa para ${slotReferencia} · ${ordem}ª opção`
      : `Fora do desenho · ${formacao}`
    : `${ordem}ª opção em ${slotReferencia ?? j.posicao}`;

  return {
    ordem,
    faixa: (escalacao === 'titular' ? 'titularidade' : escalacao === 'banco' ? 'rotacao' : 'desenvolvimento') as FaixaHierarquia,
    rotulo,
    formacaoUsaPosicao,
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
