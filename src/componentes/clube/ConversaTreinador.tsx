"use client";
import { useState } from 'react';
import type { EstadoCarreira, Posicao } from '@/dominio/entidades/modelos';
import type { AcaoTreinador } from '@/dominio/desenvolvimento';
import { avaliarHierarquia, posicoesPlausiveis } from '@/simulacao/elenco/hierarquia';
import { ACOES_TREINADOR } from '@/simulacao/elenco/treinador';
import { useJogoStore } from '@/estado/jogo-store';
import { formatarData } from '@/utilitarios/formatacao';
export function ConversaTreinador({ carreira:c }: { carreira:EstadoCarreira }) {
  const h = avaliarHierarquia(c), a = c.acompanhamento, alternativas = posicoesPlausiveis(c.jogador);
  const [posicao,setPosicao] = useState<Posicao | ''>('');
  const conversar = useJogoStore(s => s.conversarTreinador);
  const ultima = a.conversas.filter(x => x.clubeId === c.clubeAtualId).at(-1);
  const bloqueado = !!a.proximaConversa && a.proximaConversa > c.dataAtual;
  return <section className="painel espaco"><p className="sobretitulo">SEU LUGAR NO ELENCO {c.jogador.categoria === 'base' ? 'DA BASE' : ''}</p><h2>{h.ordem}ª OPÇÃO · {c.jogador.posicao}</h2>
    <p>{h.motivo}</p><p className="texto-suave">{h.distancia}. {h.proximoPasso}</p>
    {h.concorrentes.length > 0 && <ol className="lista-concorrencia">{h.concorrentes.map(x => <li key={x.id} className={x.usuario ? 'voce' : ''}><strong>{x.nome}{x.usuario ? ' (você)' : ''}</strong><span>{x.overall} · {x.disponivel ? 'Disponível' : 'Indisponível'}</span></li>)}</ol>}
    {c.jogador.categoria === "base" && <div className="espaco"><h3>AVALIAÇÃO DA BASE</h3><p>{a.base.texto ?? "A primeira avaliação mensal acompanhará seus treinos e desenvolvimento."}</p>{a.base.conviteAte && a.base.conviteAte >= c.dataAtual && <p>Treinos com o profissional até {formatarData(a.base.conviteAte)} · {a.base.treinosProfissional} sessões realizadas.</p>}</div>}
    <h3>CONVERSAR COM O TREINADOR</h3>
    {alternativas.length > 0 && <label>Posição para teste<select value={posicao} onChange={e => setPosicao(e.target.value as Posicao)}><option value="">Escolha uma alternativa</option>{alternativas.map(p => <option key={p}>{p}</option>)}</select></label>}
    <div className="grade-dupla espaco">{(Object.entries(ACOES_TREINADOR) as [AcaoTreinador,string][]).map(([acao,rotulo]) => <button key={acao} className="botao secundario" disabled={bloqueado || !!c.aposentado || (acao === 'posicao' && !posicao) || (acao === 'cobrar' && a.promessa?.status !== 'descumprida')} onClick={() => conversar(acao,posicao || undefined)}>{rotulo}</button>)}</div>
    {bloqueado && <p className="texto-suave">Nova conversa em {formatarData(a.proximaConversa!)}.</p>}
    {ultima && <p role="status" className="citacao">{ultima.resposta}</p>}
    {a.promessa && <p>Compromisso: {a.promessa.condicao} · {a.promessa.status} · prazo {formatarData(a.promessa.prazo)}.</p>}
    {a.adaptacao && <p>Adaptação a {a.adaptacao.posicao}: {a.adaptacao.semanas} semanas · {a.adaptacao.status}.</p>}
  </section>;
}
