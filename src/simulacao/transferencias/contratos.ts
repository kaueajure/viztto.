import type { EstadoCarreira, StatusElenco } from '@/dominio/entidades/modelos';
import type { AcompanhamentoCarreira } from '@/dominio/desenvolvimento';
import { tetoSalario, registrarNegociacao } from './mercado-progressivo';
import { somarDias } from '@/utilitarios/formatacao';
import { registrarEvento } from '../eventos/eventos';
export type TipoPedidoContrato = AcompanhamentoCarreira['pedidosContrato'][number]['tipo'];
export interface PedidoContrato { tipo: TipoPedidoContrato; salario: number; duracaoAnos: number; papel: StatusElenco; clausula?: number }
const importancia: Record<StatusElenco,number> = {'categoria de base':0,promessa:1,reserva:2,rotacao:3,titular:4,'jogador importante':5,'estrela do time':6};
export function solicitarContrato(estado: EstadoCarreira, pedido: PedidoContrato): EstadoCarreira {
  if (!Number.isFinite(pedido.salario) || pedido.salario <= 0 || !Number.isInteger(pedido.duracaoAnos) || pedido.duracaoAnos < 1 || pedido.duracaoAnos > 5 || !Object.hasOwn(importancia,pedido.papel) || !['renovacao','aumento','extensao','papel','clausula'].includes(pedido.tipo) || (pedido.clausula !== undefined && (!Number.isFinite(pedido.clausula) || pedido.clausula <= 0))) throw new Error('Informe salário positivo, prazo entre um e cinco anos e termos válidos.');
  if (estado.aposentado) throw new Error('Esta carreira já foi encerrada.');
  const c=structuredClone(estado), a=c.acompanhamento,j=c.jogador;
  if(a.proximoPedidoContrato && a.proximoPedidoContrato > c.dataAtual) throw new Error(`Nova conversa contratual possível em aproximadamente ${Math.ceil((Date.parse(a.proximoPedidoContrato)-Date.parse(c.dataAtual))/604800000)} semana(s).`);
  const clube=c.clubes.find(cl => cl.id === j.contrato.clubeId)!;
  const dias=(Date.parse(j.contrato.dataTermino)-Date.parse(c.dataAtual))/86400000;
  const media=j.notasRecentes.length ? j.notasRecentes.reduce((s,n)=>s+n,0)/j.notasRecentes.length : 6.5;
  const faixa=Math.max(j.contrato.salario, j.overall*25*(.7+importancia[j.status]*.2));
  const interesse=c.mercado.interesses.some(i=>i.status==='negociando'||i.status==='sondagem');
  const teto=Math.min(tetoSalario(clube), Math.round(faixa*(1 + Math.max(0,media-6.5)*.1 + j.reputacao*.001 + (dias<180?.15:0) + (interesse?.08:0) + (c.relacionamentos.diretoria-50)*.001 + (j.idade<24?.04:0))));
  let status: AcompanhamentoCarreira['pedidosContrato'][number]['status']='negado';
  let resposta:string;
  let propostaId:string|undefined;
  if(j.categoria==='base') {status='adiado';resposta='A diretoria quer concluir sua avaliação na base antes de discutir um contrato profissional. Continue treinando e acompanhe o parecer da comissão.';}
  else if(c.mercado.emprestimo) {status='adiado';resposta='Seu contrato pertence ao clube de origem. O agente propõe retomar a negociação após o empréstimo; seu vínculo atual permanece preservado.';}
  else if(c.propostas.some(p=>p.tipo==='renovacao' && p.status==='pendente' && p.validade>=c.dataAtual)) {status='adiado';resposta='Já existe uma proposta de renovação aguardando resposta. Seu agente recomenda avaliar os termos antes de abrir outra conversa.';}
  else if(tetoSalario(clube)<j.contrato.salario || clube.orcamento<=0) resposta='A diretoria não tem orçamento disponível para ampliar este compromisso salarial.';
  else if(pedido.salario>Math.max(teto,j.contrato.salario)*2 || importancia[pedido.papel]>importancia[j.status]+2) resposta=`O pedido é incompatível com sua faixa salarial e seu papel atual de ${j.status}. Seu agente recomenda termos mais próximos da sua participação.`;
  else if(dias>1095 && pedido.tipo!=='papel') resposta='Seu contrato ainda possui mais de três anos. A diretoria não vê necessidade de renegociar agora.';
  else if(pedido.tipo==='clausula' && (pedido.clausula===undefined || pedido.clausula<j.valorMercado*.8)) resposta='A cláusula solicitada não protege o valor esportivo do jogador para o clube.';
  else {
    const salario=Math.min(pedido.salario,teto);
    const papel=importancia[pedido.papel] > importancia[j.status]+1 ? j.status : pedido.papel;
    const duracao=Math.max(pedido.duracaoAnos,Math.ceil(Math.max(0,dias)/365));
    if(duracao>5) resposta='A duração solicitada não é compatível com o vínculo atual.';
    else {
      status=salario<pedido.salario || papel!==pedido.papel || duracao!==pedido.duracaoAnos ? 'contraproposta' : 'aceito';
      propostaId=`pedido-contrato-${c.dataAtual}-${a.pedidosContrato.length}`;
      c.propostas.push({id:propostaId,clubeId:clube.id,tipo:'renovacao',salario,duracaoAnos:duracao,papelPrometido:papel,clausulaRescisao:pedido.clausula??j.contrato.clausulaRescisao,etapa:'proposta_jogador',data:c.dataAtual,validade:somarDias(c.dataAtual,28),status:'pendente'});
      resposta=`${status==='aceito'?'A diretoria aceitou os termos para assinatura':'A diretoria apresentou uma contraproposta'}: €${salario.toLocaleString('pt-BR')} por semana, ${duracao} ano(s), papel de ${papel}. ${status==='contraproposta'?'A faixa salarial, o papel e o prazo atual limitaram os termos. ':''}Seu agente encaminhou a proposta; confirme para assinar.`;
    }
  }
  a.pedidosContrato=[...a.pedidosContrato,{data:c.dataAtual,clubeId:clube.id,tipo:pedido.tipo,status,resposta,...(propostaId?{propostaId}:{})}].slice(-20);
  a.proximoPedidoContrato=somarDias(c.dataAtual,status==='adiado'?28:42);
  registrarNegociacao(c,clube.id,resposta,propostaId);
  registrarEvento(c,'diretoria',`Resposta contratual: ${status}`,resposta,'Diretoria',false);
  return c;
}
