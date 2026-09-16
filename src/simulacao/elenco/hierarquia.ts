import type { Clube, EstadoCarreira, Jogador, Posicao } from '@/dominio/entidades/modelos';
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
export function avaliarHierarquia(c: EstadoCarreira) {
  const j = c.jogador, clube = c.clubes.find(cl => cl.id === c.clubeAtualId)!;
  const proximoPasso = j.lesao ? 'Complete a recuperação com o departamento médico.' : j.fadiga > 65 || j.condicionamento < 65 ? 'Reduza a carga e recupere o condicionamento.' : j.confianca < 55 ? 'Boas avaliações de treino e regularidade ajudam a conquistar confiança.' : 'Mantenha bons treinos e aproveite os minutos disponíveis.';
  if (j.categoria === 'base') {
    const nota = notaBase(j,clube);
    const ordem = nota > 6 ? 1 : nota > -10 ? 2 : 3;
    const disponivel = !j.lesao && j.suspensao <= 0;
    return { ordem, concorrentes: [] as { id:string; nome:string; overall:number; disponivel:boolean; usuario:boolean }[],
      titular: disponivel && ordem === 1, chance: !disponivel ? 'Muito baixa' : nota > 14 ? 'Muito alta' : nota > 6 ? 'Alta' : nota > -10 ? 'Média' : nota > -18 ? 'Baixa' : 'Muito baixa',
      motivo: !disponivel ? j.lesao ? 'Você está em recuperação médica.' : 'Você está suspenso.' : `Você está na faixa de ${ordem === 1 ? 'titular' : ordem === 2 ? 'rotação' : 'formação'} da categoria. A comissão compara seu nível, forma e treino com a exigência da base.`, proximoPasso,
      distancia: nota > 6 ? 'Pronto para disputar a vaga na base' : nota > -10 ? 'Próximo da rotação' : 'Ainda em formação',
    };
  }
  const usuario = jogadorUsuarioComoCandidato(j);
  usuario.confiancaTreinador += bonusPromessa(c)*10;
  const candidatos = [...clube.elenco.map(jogadorMundoComoCandidato),usuario];
  const relacionados = candidatos.filter(x => pesoCompatibilidade(x,j.posicao) >= .75).map(x => ({x,nota:avaliarParaSlot(x,j.posicao,clube.treinador.rotacao)})).sort((a,b) => b.nota-a.nota);
  const ordem = relacionados.findIndex(x => x.x.ehUsuario)+1;
  const escalacao = escalarElencoCompleto(candidatos,clube.formacaoPreferida,clube.treinador).escalacaoUsuario;
  const lider = relacionados.find(x => !x.x.ehUsuario && !x.x.lesionado && x.x.suspensao <= 0);
  const indisponiveis = candidatos.filter(x => !x.ehUsuario && pesoCompatibilidade(x,j.posicao) >= .75 && (x.lesionado || x.suspensao > 0));
  const diferenca = lider ? lider.nota-avaliarParaSlot(usuario,j.posicao,clube.treinador.rotacao) : 0;
  const motivo = j.lesao ? 'Você está em recuperação médica.' : j.suspensao > 0 ? 'Você está suspenso.' : j.condicionamento < 65 || j.fadiga > 65 ? 'Seu preparo físico limita a participação.' : escalacao === 'titular' ? `${indisponiveis.length ? 'Há concorrentes indisponíveis. ' : ''}Seu nível, momento e adequação à formação colocam você entre as primeiras escolhas.` : lider && diferenca > 0 ? `${lider.x.nome} está à frente: ${lider.x.overall > j.overall ? 'oferece maior nível atual' : lider.x.forma > j.forma ? 'está em melhor forma' : 'tem melhor avaliação para a função'}. ${j.confianca < 55 ? 'Sua confiança com a comissão ainda precisa crescer.' : 'O treinador também considera a formação e o equilíbrio da equipe.'}` : 'A formação atual favorece outras funções. Versatilidade e bons treinos podem abrir espaço.';
  return { ordem, titular: escalacao === 'titular', chance: escalacao === 'titular' ? j.condicionamento >= 80 ? 'Muito alta' : 'Alta' : escalacao === 'banco' ? ordem <= 2 ? 'Média' : 'Baixa' : 'Muito baixa', motivo,proximoPasso,
    distancia:diferenca > 10 ? 'Distância considerável' : diferenca > 3 ? 'Disputa aberta' : 'Níveis próximos',
    concorrentes:relacionados.slice(0,5).map(({x}) => ({id:x.id,nome:x.nome,overall:x.overall,disponivel:!x.lesionado && x.suspensao<=0,usuario:x.ehUsuario})),
  };
}
const ALTERNATIVAS: Record<Posicao,Posicao[]> = { GOL:[],LD:['LE','VOL','PD'],LE:['LD','VOL','PE'],ZAG:['VOL'],VOL:['MC','ZAG'],MC:['VOL','MEI'],MEI:['MC','PD','PE','CA'],PD:['PE','MEI','CA'],PE:['PD','MEI','CA'],CA:['PD','PE','MEI'] };
export function posicoesPlausiveis(j: Jogador): Posicao[] {
  return ALTERNATIVAS[j.posicao].filter(p => p === 'CA' ? j.atributos.finalizacao >= 48 : p === 'ZAG' || p === 'VOL' ? j.atributos.desarme >= 45 : true);
}
