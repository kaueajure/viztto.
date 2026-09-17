import { CAPITULOS, type EscolhasHistoria } from "@/dominio/desenvolvimento";
import {
  NOMES_ATRIBUTOS,
  type Atributo,
  type IdentidadeJogador,
} from "@/dominio/entidades/modelos";
import {
  PERGUNTAS_HISTORIA,
  resumirHistoria,
  sortearHistoria,
} from "@/dominio/historia-formacao";
import { Check } from "lucide-react";

const ROTULOS = ["Origem", "Destaque", "Dificuldade", "Chegada"] as const;

export function ResumoHistoria({ escolhas }: { escolhas: EscolhasHistoria }) {
  const resumo = resumirHistoria(escolhas);
  return (
    <section className="vz-hist-resumo">
      <p className="vz-card-sub">Sua história</p>
      <h2>{resumo.perfil}</h2>
      <dl className="ficha">
        {resumo.opcoes.map((o, i) => (
          <div key={o.id}>
            <dt>{ROTULOS[i]}</dt>
            <dd>{o.titulo}</dd>
          </div>
        ))}
      </dl>
      <p>
        <b>Qualidades:</b> {resumo.qualidades.join(" · ")}
      </p>
      <p>
        <b>PRECISA DESENVOLVER:</b> {resumo.desenvolver.join(" · ")}
      </p>
    </section>
  );
}

export function SuaHistoria({
  seed,
  identidade,
  capitulo,
  escolhas,
  escolher,
}: {
  seed: string;
  identidade: IdentidadeJogador;
  capitulo: number;
  escolhas: Partial<EscolhasHistoria>;
  escolher: (capitulo: (typeof CAPITULOS)[number], id: string) => void;
}) {
  if (capitulo >= 4)
    return <ResumoHistoria escolhas={escolhas as EscolhasHistoria} />;

  const chave = CAPITULOS[capitulo]!;
  const opcoes = sortearHistoria(seed, identidade.posicao)[chave];

  return (
    <section className="vz-historia" aria-label="Sua História">
      <nav className="vz-hist-progress" aria-label="Capítulos da história">
        {ROTULOS.map((nome, i) => (
          <span
            key={nome}
            className={
              i < capitulo ? "feito" : i === capitulo ? "atual" : ""
            }
          >
            {i < capitulo ? <Check size={12} /> : i + 1} {nome}
          </span>
        ))}
      </nav>
      <p className="vz-card-sub">
        Capítulo {capitulo + 1} de 4
      </p>
      <h2>{PERGUNTAS_HISTORIA[chave]}</h2>
      <div className="vz-hist-opcoes">
        {opcoes.map((o) => {
          const plus = Object.entries(o.atributos).filter(([, v]) => v > 0);
          const minus = Object.entries(o.atributos).filter(([, v]) => v < 0);
          const sel = escolhas[chave] === o.id;
          return (
            <button
              key={o.id}
              type="button"
              className={`vz-hist-card${sel ? " selecionada" : ""}`}
              aria-pressed={sel}
              onClick={() => escolher(chave, o.id)}
            >
              {sel && (
                <span className="vz-hist-check" aria-hidden>
                  <Check size={14} />
                </span>
              )}
              <strong>{o.titulo}</strong>
              <span className="vz-hist-desc">{o.descricao}</span>
              {plus.length > 0 && (
                <small className="vz-hist-plus">
                  Qualidade:{" "}
                  {plus
                    .map(([a]) => NOMES_ATRIBUTOS[a as Atributo])
                    .join(" · ")}
                </small>
              )}
              {minus.length > 0 && (
                <small className="vz-hist-minus">
                  Desafio:{" "}
                  {minus
                    .map(([a]) => NOMES_ATRIBUTOS[a as Atributo])
                    .join(" · ")}
                </small>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
