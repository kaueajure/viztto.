import { CAPITULOS, type EscolhasHistoria } from '@/dominio/desenvolvimento';
import { NOMES_ATRIBUTOS, type Atributo, type IdentidadeJogador } from '@/dominio/entidades/modelos';
import { PERGUNTAS_HISTORIA, resumirHistoria, sortearHistoria } from '@/dominio/historia-formacao';

export function ResumoHistoria({ escolhas }: { escolhas: EscolhasHistoria }) {
  const resumo = resumirHistoria(escolhas);
  return <section className="painel espaco"><p className="sobretitulo">SUA HISTÓRIA</p><h2>{resumo.perfil}</h2>
    <dl className="ficha">{resumo.opcoes.map((o,i) => <div key={o.id}><dt>{['Origem','Primeiro destaque','Dificuldade','Chegada'][i]}</dt><dd>{o.titulo}</dd></div>)}</dl>
    <h3>PRINCIPAIS QUALIDADES</h3><p>{resumo.qualidades.join(' · ')}</p>
    <h3>PRECISA DESENVOLVER</h3><p>{resumo.desenvolver.join(' · ')}</p>
    <p className="texto-suave">Seu passado orienta o começo. Treino, experiência e decisões constroem o que vem depois.</p>
  </section>;
}
export function SuaHistoria({ seed, identidade, capitulo, escolhas, escolher }: {
  seed: string; identidade: IdentidadeJogador; capitulo: number; escolhas: Partial<EscolhasHistoria>;
  escolher: (capitulo: typeof CAPITULOS[number], id: string) => void;
}) {
  const chave = CAPITULOS[capitulo];
  if (!chave) return <ResumoHistoria escolhas={escolhas as EscolhasHistoria} />;
  const opcoes = sortearHistoria(seed,identidade.posicao)[chave];
  return <section aria-label="Sua História"><p className="sobretitulo">CAPÍTULO {capitulo+1} / 4</p><h2>{PERGUNTAS_HISTORIA[chave]}</h2>
    <div className="opcoes espaco">{opcoes.map(o => <button key={o.id} className={`opcao ${escolhas[chave] === o.id ? 'selecionada' : ''}`} aria-pressed={escolhas[chave] === o.id} onClick={() => escolher(chave,o.id)}>
      <strong>{o.titulo}</strong><span>{o.descricao}</span>
      <small>Favorece: {Object.entries(o.atributos).filter(([,v]) => v > 0).map(([a]) => NOMES_ATRIBUTOS[a as Atributo]).join(' · ')}</small>
      <small>A desenvolver: {Object.entries(o.atributos).filter(([,v]) => v < 0).map(([a]) => NOMES_ATRIBUTOS[a as Atributo]).join(' · ')}</small>
    </button>)}</div>
  </section>;
}
