import type { EstadoCarreira, Atributo } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { avaliarPotencial, POSICOES } from "@/dominio/regras/jogador";
import { Barra } from "@/componentes/interface/Elementos";
import { dinheiro } from "@/utilitarios/formatacao";
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
          <h2>RELATÓRIO DA COMISSÃO</h2>
          <p className="citacao">“{avaliarPotencial(j)}.”</p>
          <p className="texto-suave">
            Essa avaliação representa uma possibilidade. Minutos, treinos, saúde
            e regularidade vão definir seu desenvolvimento.
          </p>
          <dl className="ficha">
            <div>
              <dt>Reputação</dt>
              <dd>{Math.round(j.reputacao)} / 100</dd>
            </div>
            <div>
              <dt>Valor de mercado</dt>
              <dd>{dinheiro(j.valorMercado)}</dd>
            </div>
            <div>
              <dt>Profissionalismo</dt>
              <dd>
                {j.personalidade.profissionalismo > 70
                  ? "Muito dedicado"
                  : j.personalidade.profissionalismo > 45
                    ? "Regular"
                    : "Precisa de orientação"}
              </dd>
            </div>
            <div>
              <dt>Departamento médico</dt>
              <dd>
                {j.lesao
                  ? `${j.lesao.tipo} · ${j.lesao.diasRecuperacao} dias`
                  : "Liberado"}
              </dd>
            </div>
            <div>
              <dt>Suspensão</dt>
              <dd>
                {j.suspensao ? `${j.suspensao} partida(s)` : "Sem suspensão"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="grade-atributos">
        {Object.entries(GRUPOS).map(([nome, atributos]) => (
          <section className="painel" key={nome}>
            <h2>{nome.toUpperCase()}</h2>
            {atributos.map((a) => (
              <Barra key={a} nome={NOMES_ATRIBUTOS[a]} valor={j.atributos[a]} />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
