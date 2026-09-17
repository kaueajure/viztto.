"use client";
import { useState } from 'react';
import { NOMES_ATRIBUTOS, type Atributo, type EstadoCarreira } from '@/dominio/entidades/modelos';
import type { IntensidadeTreino } from '@/dominio/desenvolvimento';
import { planosDaPosicao, prioridadesDaPosicao } from '@/dominio/planos-desenvolvimento';
import { useJogoStore } from '@/estado/jogo-store';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
export function PlanoDesenvolvimento({ carreira: c }: { carreira: EstadoCarreira }) {
  const prep = c.jogador.preparacao, planos = planosDaPosicao(c.jogador.posicao);
  const livre = estaSemClube(c);
  const [plano,setPlano] = useState(prep.planoId ?? planos[0].id);
  const [prioridades,setPrioridades] = useState<Atributo[]>(prep.prioridades);
  const [intensidade,setIntensidade] = useState<IntensidadeTreino>(prep.intensidade);
  const [resposta,setResposta] = useState('');
  const configurar = useJogoStore(s => s.configurarDesenvolvimento);
  const ultimo = prep.historico.at(-1);
  return <section className="painel espaco"><h2>PLANO DE DESENVOLVIMENTO</h2>
    <div className="campos"><label>Plano<select value={plano} onChange={e => setPlano(e.target.value)}>{planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Intensidade<select value={intensidade} onChange={e => setIntensidade(e.target.value as IntensidadeTreino)}><option value="leve">Leve · mais recuperação</option><option value="normal">Normal · equilíbrio</option><option value="intenso">Intenso · mais fadiga e risco físico</option></select></label></div>
    <fieldset className="espaco"><legend>Até duas prioridades individuais</legend><div className="grade-dupla">{prioridadesDaPosicao(c.jogador.posicao).map(a => <label key={a} className="aceite"><input type="checkbox" checked={prioridades.includes(a)} disabled={!prioridades.includes(a) && prioridades.length >= 2} onChange={() => setPrioridades(atuais => atuais.includes(a) ? atuais.filter(x => x !== a) : [...atuais,a])}/>{NOMES_ATRIBUTOS[a]}</label>)}</div></fieldset>
    <button className="botao principal espaco" onClick={() => { configurar(plano,prioridades,intensidade); setResposta(useJogoStore.getState().erro ?? 'Plano confirmado para as próximas semanas.'); }}>Confirmar plano</button>
    {resposta && <p role="status">{resposta}</p>}
    {ultimo && (
      <p className="citacao">
        Último treino: {ultimo.avaliacao}.
        {!livre && (
          <> Confiança {ultimo.confianca >= 0 ? '+' : ''}{ultimo.confianca.toFixed(1)}.</>
        )}{' '}
        {ultimo.progresso > 0 ? 'Trabalho acumulado nos fundamentos.' : 'Semana dedicada à recuperação.'}
      </p>
    )}
  </section>;
}
