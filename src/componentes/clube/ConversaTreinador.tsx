"use client";
import { useState } from 'react';
import type { EstadoCarreira, Posicao } from '@/dominio/entidades/modelos';
import type { AcaoTreinador } from '@/dominio/desenvolvimento';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import { avaliarHierarquia, posicoesPlausiveis } from '@/simulacao/elenco/hierarquia';
import {
  ACOES_TREINADOR,
  CATEGORIA_ACAO_TREINADOR,
  acaoTreinadorBloqueada,
  avaliarProgressoAdaptacao,
} from '@/simulacao/elenco/treinador';
import { useJogoStore } from '@/estado/jogo-store';
import { formatarData } from '@/utilitarios/formatacao';

export function ConversaTreinador({ carreira: c }: { carreira: EstadoCarreira }) {
  const livre = estaSemClube(c);
  const h = avaliarHierarquia(c), a = c.acompanhamento, alternativas = posicoesPlausiveis(c.jogador);
  const [posicao, setPosicao] = useState<Posicao | ''>('');
  const conversar = useJogoStore(s => s.conversarTreinador);
  const ultima = a.conversas.filter(x => x.clubeId === c.clubeAtualId).at(-1);
  const progresso = avaliarProgressoAdaptacao(c);
  const bloqueios = (Object.keys(ACOES_TREINADOR) as AcaoTreinador[])
    .map(acao => ({ acao, ate: acaoTreinadorBloqueada(c, acao) }))
    .filter(x => x.ate);

  if (livre) {
    return (
      <section className="painel espaco">
        <p className="sobretitulo">SEM CLUBE</p>
        <h2>SEM TREINADOR</h2>
        <p>Você está agente livre e não possui comissão técnica vinculada.</p>
        <p className="texto-suave">{h.proximoPasso}</p>
      </section>
    );
  }

  return <section className="painel espaco"><p className="sobretitulo">SEU LUGAR NO ELENCO {c.jogador.categoria === 'base' ? 'DA BASE' : ''}</p><h2>{h.rotulo.toUpperCase()}</h2>
    <p>{h.motivo}</p><p className="texto-suave">{h.distancia}. {h.proximoPasso}</p>
    {h.concorrentes.length > 0 && <ol className="lista-concorrencia">{h.concorrentes.map(x => <li key={x.id} className={x.usuario ? 'voce' : ''}><strong>{x.nome}{x.usuario ? ' (você)' : ''}</strong><span>{x.overall} · {x.disponivel ? 'Disponível' : 'Indisponível'}</span></li>)}</ol>}
    {c.jogador.categoria === "base" && <div className="espaco"><h3>AVALIAÇÃO DA BASE</h3><p>{a.base.texto ?? "A primeira avaliação mensal acompanhará seus treinos e desenvolvimento."}</p>{a.base.conviteAte && a.base.conviteAte >= c.dataAtual && <p>Treinos com o profissional até {formatarData(a.base.conviteAte)} · {a.base.treinosProfissional} sessões realizadas.</p>}</div>}
    <h3>CONVERSAR COM O TREINADOR</h3>
    {alternativas.length > 0 && <label>Posição para teste<select value={posicao} onChange={e => setPosicao(e.target.value as Posicao)}><option value="">Escolha uma alternativa</option>{alternativas.map(p => <option key={p}>{p}</option>)}</select></label>}
    <div className="grade-dupla espaco">{(Object.entries(ACOES_TREINADOR) as [AcaoTreinador, string][]).map(([acao, rotulo]) => {
      const ate = acaoTreinadorBloqueada(c, acao);
      return <button key={acao} className="botao secundario" disabled={!!ate || !!c.aposentado || (acao === 'posicao' && !posicao) || (acao === 'cobrar' && a.promessa?.status !== 'descumprida')} onClick={() => conversar(acao, posicao || undefined)} title={ate ? `Disponível em ${formatarData(ate)}` : undefined}>{rotulo}</button>;
    })}</div>
    {bloqueios.length > 0 && <p className="texto-suave">Cooldowns por tipo: {[...new Map(bloqueios.map(b => [CATEGORIA_ACAO_TREINADOR[b.acao], b.ate!])).entries()].map(([cat, ate]) => `${cat} até ${formatarData(ate)}`).join(' · ')}.</p>}
    {ultima && <p role="status" className="citacao">{ultima.resposta}</p>}
    {a.promessa && <p>Compromisso: {a.promessa.condicao} · {a.promessa.status} · prazo {formatarData(a.promessa.prazo)}.</p>}
    {progresso && <div className="espaco">
      <h3>ADAPTAÇÃO POSICIONAL</h3>
      <p>{progresso.rotuloStatus}</p>
      <p className="texto-suave">Progresso fase 1: {progresso.semanas}/{progresso.semanasAlvo} semanas · Fase 2 (principal): a partir de {formatarData(progresso.prazoPrincipal)}.</p>
      {progresso.motivoBloqueioPrincipal && !progresso.podePrincipal && <p className="texto-suave">{progresso.motivoBloqueioPrincipal}</p>}
      {progresso.podePrincipal && <p>Você pode pedir a mudança da posição principal para {progresso.posicao}.</p>}
    </div>}
  </section>;
}
