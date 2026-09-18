import type { Clube, EstadoCarreira, Jogador, Posicao } from '@/dominio/entidades/modelos';
import { POSICOES_ALTERNATIVAS } from '@/dominio/regras/jogador';
import { SLOTS_FORMACAO, type Formacao, type SlotFormacao } from '@/dominio/formacao';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import { avaliarParaSlot, escalarElencoCompleto, jogadorMundoComoCandidato, jogadorUsuarioComoCandidato, pesoCompatibilidade } from './escalacao-elenco';

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
  const slotsDiretos = slots.filter((s) => {
    if (usuario.posicaoPrincipal === s) return true;
    if (usuario.posicoesSecundarias.includes(s as Posicao)) return true;
    if (s === 'SA' && ['CA', 'MEI', 'PD', 'PE'].includes(usuario.posicaoPrincipal)) return true;
    return false;
  });
  const slotsAvaliados =
    slotsDiretos.length > 0
      ? slotsDiretos
      : slots.filter((s) => pesoCompatibilidade(usuario, s) >= 0.35);
  const formacaoUsaPosicao = slotsDiretos.length > 0;

  let melhorOrdem = Number.POSITIVE_INFINITY;
  let melhorNota = -Infinity;
  let slotReferencia: SlotFormacao | null = null;
  let rankingMelhor: { x: (typeof candidatos)[number]; nota: number }[] = [];

  for (const slot of slotsAvaliados) {
    const ranking = candidatos
      .map((x) => ({ x, nota: avaliarParaSlot(x, slot, clube.treinador.rotacao) }))
      .filter((x) => x.nota > -100)
      .sort((a, b) => b.nota - a.nota);
    const idx = ranking.findIndex((x) => x.x.ehUsuario);
    if (idx < 0) continue;
    const ordemSlot = idx + 1;
    const notaUsuario = ranking[idx]!.nota;
    if (
      ordemSlot < melhorOrdem ||
      (ordemSlot === melhorOrdem && notaUsuario > melhorNota)
    ) {
      melhorOrdem = ordemSlot;
      melhorNota = notaUsuario;
      slotReferencia = slot;
      rankingMelhor = ranking;
    }
  }

  const escalacao = escalarElencoCompleto(
    candidatos,
    formacao,
    clube.treinador,
  ).escalacaoUsuario;
  const ordem = Number.isFinite(melhorOrdem) ? melhorOrdem : candidatos.length;
  const lider = rankingMelhor.find((x) => !x.x.ehUsuario && !x.x.lesionado && x.x.suspensao <= 0);
  const indisponiveis = rankingMelhor.filter(
    (x) => !x.x.ehUsuario && (x.x.lesionado || x.x.suspensao > 0),
  );
  const diferenca = lider ? lider.nota - melhorNota : 0;

  let motivo: string;
  if (j.lesao) motivo = 'Você está em recuperação médica.';
  else if (j.suspensao > 0) motivo = 'Você está suspenso.';
  else if (j.condicionamento < 65 || j.fadiga > 65) motivo = 'Seu preparo físico limita a participação.';
  else if (!formacaoUsaPosicao) {
    motivo = slotReferencia
      ? `A formação ${formacao} não utiliza diretamente a posição ${j.posicao}. Na prática você compete pela vaga de ${slotReferencia}${ordem === 1 ? ' como primeira opção dessa função' : ` (hoje ${ordem}ª opção nesse slot)`}.`
      : `A formação ${formacao} não utiliza diretamente a posição ${j.posicao}, e também não há vaga próxima com boa adequação no desenho atual.`;
  } else if (escalacao === 'titular') {
    motivo = `${indisponiveis.length ? 'Há concorrentes indisponíveis. ' : ''}Seu nível, momento e adequação à vaga de ${slotReferencia ?? j.posicao} na formação ${formacao} colocam você entre as primeiras escolhas.`;
  } else if (lider && diferenca > 0) {
    motivo = `${lider.x.nome} está à frente na disputa por ${slotReferencia ?? j.posicao}: ${lider.x.overall > j.overall ? 'oferece maior nível atual' : lider.x.forma > j.forma ? 'está em melhor forma' : 'tem melhor avaliação para a função'}. ${j.confianca < 55 ? 'Sua confiança com a comissão ainda precisa crescer.' : 'O treinador também considera a formação e o equilíbrio da equipe.'}`;
  } else {
    motivo = `Há disputa aberta pela vaga de ${slotReferencia ?? j.posicao} na formação ${formacao}. Versatilidade e bons treinos podem abrir espaço.`;
  }

  const rotulo = !formacaoUsaPosicao
    ? slotReferencia
      ? `Alternativa · ${slotReferencia}`
      : `Fora do desenho · ${formacao}`
    : `${ordem}ª opção · ${slotReferencia ?? j.posicao}`;

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
