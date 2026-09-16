import type { Atributo, EstadoCarreira } from '@/dominio/entidades/modelos';
import { NOMES_ATRIBUTOS } from '@/dominio/entidades/modelos';
import type { ObjetivoPessoalTipo } from '@/dominio/desenvolvimento';
import { avaliarHierarquia } from '../elenco/hierarquia';
import { registrarEvento } from '../eventos/eventos';
import { limitar } from '@/utilitarios/formatacao';
export const OBJETIVOS_PESSOAIS: Record<ObjetivoPessoalTipo,string> = { titular:'Virar titular',minutos:'Ganhar mais minutos',tecnica:'Evoluir tecnicamente',emprestimo:'Conseguir empréstimo',transferencia:'Buscar transferência',renovacao:'Renovar contrato' };
const minutos = (c:EstadoCarreira) => c.registros.reduce((s,r)=>s+r.estatisticas.minutos,0);
const tecnica = (c:EstadoCarreira) => c.jogador.atributos.dominio+c.jogador.atributos.passeCurto+c.jogador.atributos.visao;
export function escolherObjetivo(estado:EstadoCarreira,tipo:ObjetivoPessoalTipo):EstadoCarreira {
  if(!Object.hasOwn(OBJETIVOS_PESSOAIS,tipo)) throw new Error('Escolha um objetivo válido.');
  if(estado.aposentado) throw new Error('Esta carreira já foi encerrada.');
  const c=structuredClone(estado);
  c.acompanhamento.objetivoPessoal={tipo,inicio:c.dataAtual,referencia:tipo==='minutos'?minutos(c):tipo==='tecnica'?tecnica(c):tipo==='renovacao'?Date.parse(c.jogador.contrato.dataTermino):0,progresso:0,concluido:false};
  registrarEvento(c,'objetivo-pessoal',`Seu foco: ${OBJETIVOS_PESSOAIS[tipo]}`,'Seu agente acompanhará esse caminho. A escolha orienta os próximos passos, sem alterar seus atributos.','Agente',false);
  return c;
}
export function atualizarObjetivoPessoal(c:EstadoCarreira):void {
  const o=c.acompanhamento.objetivoPessoal;if(!o||o.concluido)return;
  const h=avaliarHierarquia(c);
  o.progresso=limitar(o.tipo==='titular'?h.titular?100:h.ordem===2?65:25:o.tipo==='minutos'?(minutos(c)-o.referencia)/270*100:o.tipo==='tecnica'?(tecnica(c)-o.referencia)/3*100:o.tipo==='emprestimo'?c.mercado.emprestimo?100:c.mercado.disponivelParaEmprestimo?40:0:o.tipo==='transferencia'?c.eventos.some(e=>e.tipo==='transferencia'&&e.data>=o.inicio)?100:c.mercado.statusPedidoSaida==='aceito'?35:0:Date.parse(c.jogador.contrato.dataTermino)>o.referencia?100:0);
  if(o.progresso>=100){o.concluido=true;c.jogador.moral=limitar(c.jogador.moral+2);registrarEvento(c,'objetivo-pessoal',`Objetivo alcançado: ${OBJETIVOS_PESSOAIS[o.tipo]}`,'Seu trabalho trouxe resultado. Defina seu próximo foco quando quiser.','Agente',false);}
}
export function registrarResumoSemanal(c:EstadoCarreira,antes:EstadoCarreira,motivoParticipacao?:string):void {
  const j=c.jogador;
  const evolucoes=(Object.keys(NOMES_ATRIBUTOS) as Atributo[]).flatMap(atributo=>Math.floor(j.atributos[atributo])>Math.floor(antes.jogador.atributos[atributo])?[{atributo,antes:Math.floor(antes.jogador.atributos[atributo]),depois:Math.floor(j.atributos[atributo])}]:[]);
  const ultimo=[...c.temporada.partidas,...c.temporada.partidasBase].find(p=>p.id===c.ultimaPartidaId)?.participacao;
  const h=avaliarHierarquia(c);
  let feedback=!ultimo?'Semana sem participação em partida. O trabalho no treino segue contando para seu desenvolvimento.':ultimo.minutos===0?`Você não entrou nesta partida. ${motivoParticipacao ?? h.motivo} ${h.proximoPasso}`:ultimo.vermelhos?'A expulsão prejudicou a equipe. Trabalhe a disciplina para preservar a confiança da comissão.':ultimo.gols>0?`Você contribuiu com ${ultimo.gols} gol(s) em ${ultimo.minutos} minutos. A comissão valorizou sua presença nas jogadas decisivas.`:ultimo.assistencias>0||ultimo.passesChave>=3?`Seus ${ultimo.passesChave} passes-chave e ${ultimo.assistencias} assistência(s) ajudaram a criar oportunidades. Continue oferecendo opções ao time.`:j.posicao==='GOL'?`Você participou com ${ultimo.defesas} defesa(s). A comissão acompanhará sua segurança e regularidade.`:ultimo.desarmes>=4?`Você recuperou bolas com ${ultimo.desarmes} desarmes e ajudou a proteger a equipe.`:ultimo.minutos<30?`Você teve ${ultimo.minutos} minutos para mostrar serviço. Continue bem nos treinos para ampliar sua participação.`:`Você cumpriu ${ultimo.minutos} minutos. O próximo passo é participar mais das ações decisivas da sua função.`;
  const treino=j.preparacao.historico.at(-1);
  const textoTreino=treino?`${treino.avaliacao}. ${treino.progresso>0?'Progresso acumulado nos atributos trabalhados.':'Recuperação física priorizada.'} Confiança ${treino.confianca>=0?'+':''}${treino.confianca.toFixed(1)}.`:'Sem avaliação de treino nesta semana.';
  c.acompanhamento.resumoSemanal={data:c.dataAtual,treino:textoTreino,feedback,evolucoes,overallAntes:antes.jogador.overall,overallDepois:j.overall};
  if(evolucoes.length)registrarEvento(c,'evolucao','Seu trabalho começou a aparecer',evolucoes.map(e=>`${NOMES_ATRIBUTOS[e.atributo]}: ${e.antes} → ${e.depois}`).join(' · '),'Treinador',false);
  if(j.overall>antes.jogador.overall)registrarEvento(c,'overall','Seu nível geral subiu',`${antes.jogador.overall} → ${j.overall}. A evolução reflete os atributos da sua posição.`,'Treinador');
  atualizarObjetivoPessoal(c);
  if (!h.titular && h.ordem >= 3 && j.personalidade.ambicao >= 70 && (ultimo?.minutos ?? 0) === 0)
    j.moral = limitar(j.moral - (j.personalidade.ambicao - 65) * 0.04);
  else if (h.titular && j.personalidade.ambicao >= 60)
    j.moral = limitar(j.moral + 0.3);
}

/** Compromissos pertencem à comissão; histórico continua preservado após mudar de clube. */
export function atualizarVinculoAcompanhamento(c:EstadoCarreira, paisAnterior?:string):void {
  const a=c.acompanhamento,j=c.jogador,clube=c.clubes.find(cl=>cl.id===c.clubeAtualId)!;
  if(a.promessa?.status==='ativa') {
    a.promessa.status='encerrada';
    registrarEvento(c,'promessa','Compromisso com a comissão anterior encerrado','A mudança de clube encerrou a promessa anterior. Converse com seu novo treinador.','Treinador',false);
  }
  a.adaptacao=null;a.proximaConversa=null;a.proximoPedidoContrato=null;
  a.base={ultimaAvaliacao:null,texto:null,treinosProfissional:0,conviteAte:null};
  if(paisAnterior && paisAnterior!==clube.pais) {
    const custo=(100-j.personalidade.adaptabilidade)*.04;
    j.moral=limitar(j.moral-custo);j.forma=limitar(j.forma-custo);
    registrarEvento(c,'adaptacao','Um novo país, uma nova rotina',j.personalidade.adaptabilidade>=65?'Sua facilidade de adaptação ajuda a enfrentar a mudança.':'A mudança de ambiente pede paciência e regularidade nos primeiros treinos.','Agente',false);
  }
  atualizarObjetivoPessoal(c);
}
