"use client";
import Link from 'next/link';
import { useState } from 'react';
import type { EstadoCarreira, StatusElenco } from '@/dominio/entidades/modelos';
import type { TipoPedidoContrato } from '@/simulacao/transferencias/contratos';
import { useJogoStore } from '@/estado/jogo-store';
import { formatarData } from '@/utilitarios/formatacao';
export function ConversaContrato({ carreira:c }: { carreira:EstadoCarreira }) {
  const [tipo,setTipo]=useState<TipoPedidoContrato>('renovacao');
  const [salario,setSalario]=useState(Math.round(c.jogador.contrato.salario*1.15));
  const [anos,setAnos]=useState(3);
  const [papel,setPapel]=useState<StatusElenco>(c.jogador.status);
  const [clausula,setClausula]=useState(c.jogador.contrato.clausulaRescisao??Math.round(c.jogador.valorMercado*2));
  const solicitar=useJogoStore(s=>s.solicitarContrato), a=c.acompanhamento, ultima=a.pedidosContrato.at(-1);
  const bloqueado=!!a.proximoPedidoContrato && a.proximoPedidoContrato>c.dataAtual;
  return <section className="painel espaco"><h2>CONTRATO · CONVERSE COM SEU AGENTE</h2><p className="texto-suave">Seu agente leva os termos à diretoria e apresenta a resposta aqui. A assinatura acontece nas propostas do mercado.</p>
    <div className="campos"><label>Solicitação<select value={tipo} onChange={e=>setTipo(e.target.value as TipoPedidoContrato)}><option value="renovacao">Renovação</option><option value="aumento">Aumento salarial</option><option value="extensao">Extensão do vínculo</option><option value="papel">Revisão do papel</option>{c.jogador.contrato.clausulaRescisao && <option value="clausula">Revisão de cláusula</option>}</select></label>
    <label>Salário semanal (€)<input type="number" min="1" value={salario} onChange={e=>setSalario(Number(e.target.value))}/></label>
    <label>Duração (anos)<input type="number" min="1" max="5" value={anos} onChange={e=>setAnos(Number(e.target.value))}/></label>
    <label>Papel solicitado<select value={papel} onChange={e=>setPapel(e.target.value as StatusElenco)}>{['categoria de base','promessa','reserva','rotacao','titular','jogador importante','estrela do time'].map(p=><option key={p} value={p}>{p.replace('rotacao','rotação')}</option>)}</select></label>
    {tipo==='clausula' && <label>Cláusula (€)<input type="number" min="1" value={clausula} onChange={e=>setClausula(Number(e.target.value))}/></label>}</div>
    <button className="botao principal espaco" disabled={bloqueado||!!c.aposentado} onClick={()=>solicitar({tipo,salario,duracaoAnos:anos,papel,...(tipo==='clausula'?{clausula}:{})})}>Enviar pedido pelo agente</button>
    {bloqueado && <p>Nova conversa em {formatarData(a.proximoPedidoContrato!)}.</p>}
    {ultima && <div role="status"><p className="citacao">{ultima.resposta}</p>{ultima.propostaId && <Link className="botao secundario" href="/carreira/mercado">Ver proposta para assinatura</Link>}</div>}
  </section>;
}
