import { avaliarHierarquia } from "@/simulacao/elenco/hierarquia";
import Link from "next/link";
import { ResumoHistoria } from "./SuaHistoria";
import type { EstadoCarreira, Atributo } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { avaliarPotencial, POSICOES } from "@/dominio/regras/jogador";
import { Barra } from "@/componentes/interface/Elementos";
import { dinheiro } from "@/utilitarios/formatacao";
import { rotuloRelacao } from "@/simulacao/decisoes/decisoes";

const GRUPOS: Record<string, Atributo[]> = {
  Técnicos: [
    "finalizacao",
    "passeCurto",
    "passeLongo",
    "cruzamento",
    "drible",
    "dominio",
    "cabeceio",
    "desarme",
    "marcacao",
  ],
  Físicos: [
    "aceleracao",
    "velocidade",
    "forca",
    "resistencia",
    "impulsao",
    "agilidade",
  ],
  Mentais: [
    "visao",
    "posicionamento",
    "compostura",
    "decisao",
    "antecipacao",
    "concentracao",
    "agressividade",
  ],
  Goleiro: [
    "reflexos",
    "posicionamentoGoleiro",
    "defesaGoleiro",
    "saida",
    "reposicao",
  ],
};

export function PainelJogador({ carreira: c }: { carreira: EstadoCarreira }) {
  const j = c.jogador;
  const hierarquia = avaliarHierarquia(c);
  const rel = c.relacionamentos ?? {
    treinador: 50,
    diretoria: 50,
    agente: 60,
  };
  return (
    <>
      <section className="perfil-completo">
        <div className="overall">
          <strong>{j.overall}</strong>
          <span>GERAL</span>
        </div>
        <div>
          <p className="sobretitulo">
            {j.categoria === "base" ? "CATEGORIA DE BASE" : "PROFISSIONAL"} /{" "}
            {POSICOES[j.posicao]}
          </p>
          <h1>
            {j.nome} {j.sobrenome}
          </h1>
          <p>
            {j.nacionalidade} · {j.idade} anos · {j.altura} cm · {j.peso} kg ·
            Pé {j.peDominante}
            {j.posicaoSecundaria
              ? ` · Alternativa: ${j.posicaoSecundaria}`
              : ""}
          </p>
        </div>
      </section>
      {j.perfilFormacao.origem === "historia" && <ResumoHistoria escolhas={j.perfilFormacao.escolhas} />}
      <div className="grade-dupla espaco">
        <section className="painel">
          <h2>MOMENTO ATUAL</h2>
          <Barra nome="Forma" valor={j.forma} />
          <Barra nome="Moral" valor={j.moral} />
          <Barra nome="Condicionamento" valor={j.condicionamento} />
          <Barra nome="Fadiga" valor={j.fadiga} />
          <Barra nome="Ritmo de jogo" valor={j.ritmo} />
          <Barra nome="Confiança do treinador" valor={j.confianca} />
        </section>
        <section className="painel">
          <h2>RELACIONAMENTOS</h2>
          <dl className="ficha">
            <div>
              <dt>Treinador</dt>
              <dd>{rotuloRelacao(rel.treinador)}</dd>
            </div>
            <div>
              <dt>Diretoria</dt>
              <dd>{rotuloRelacao(rel.diretoria)}</dd>
            </div>
            <div>
              <dt>Agente</dt>
              <dd>{rotuloRelacao(rel.agente)}</dd>
            </div>
            <div>
              <dt>Contrato</dt>
              <dd>
                {dinheiro(j.contrato.salario)}/sem · até {j.contrato.dataTermino}
              </dd>
            </div>
            <div>
              <dt>Papel</dt>
              <dd>{j.status}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{dinheiro(j.valorMercado)}</dd>
            </div>
          </dl>
          <p className="citacao">“{avaliarPotencial(j)}.”</p>
        </section>
      </div>
      <section className="painel espaco">
        <h2>CONCORRÊNCIA · {POSICOES[j.posicao].toUpperCase()}</h2>
        <p>{hierarquia.ordem}ª opção. {hierarquia.motivo}</p>
        <p className="texto-suave">{hierarquia.proximoPasso}</p>
        <Link className="botao secundario" href="/carreira/clube">Ver hierarquia e conversar com o treinador</Link>
      </section>
      <div className="grade-atributos">
        {Object.entries(GRUPOS).map(([nome, atributos]) => (
          <section className="painel" key={nome}>
            <h2>{nome.toUpperCase()}</h2>
            {atributos.map((a) => (
              <div key={a}>
                <Barra nome={NOMES_ATRIBUTOS[a]} valor={j.atributos[a]} />
                {j.desenvolvimento[a] > 0.05 && (
                  <p className="texto-suave progresso-atributo">
                    Progresso interno: {Math.round(j.desenvolvimento[a] * 100)}%
                    rumo ao próximo ponto
                  </p>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
      {j.preparacao.historico.length > 0 && (
        <section className="painel espaco">
          <h2>ÚLTIMOS TREINOS</h2>
          <ul className="lista-atencao">
            {[...j.preparacao.historico].slice(-4).reverse().map((t) => (
              <li key={t.data + t.avaliacao}>
                <div>
                  <strong>{t.avaliacao}</strong>
                  <p className="texto-suave">
                    {t.data} · confiança {t.confianca >= 0 ? "+" : ""}
                    {t.confianca.toFixed(1)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
