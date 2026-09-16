"use client";
import { useJogoStore } from "@/estado/jogo-store";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";

export function DecisoesInicio({ carreira }: { carreira: EstadoCarreira }) {
  const responderDecisao = useJogoStore((s) => s.responderDecisao);
  const pendentes = (carreira.decisoes ?? []).filter((d) => !d.resolvida);
  if (!pendentes.length) return null;
  return (
    <section className="propostas-inicio" aria-label="Decisões pendentes">
      <div className="linha-titulo">
        <h2>DECISÕES</h2>
        <span role="status">{pendentes.length} aguardando</span>
      </div>
      {pendentes.map((decisao) => (
        <article className="oferta-inicio" key={decisao.id}>
          <div>
            <span className="sobretitulo">{decisao.remetente.toUpperCase()}</span>
            <h3>{decisao.titulo}</h3>
            <p className="texto-suave">{decisao.texto}</p>
          </div>
          <div className="acoes-oferta">
            <div className="acoes">
              {decisao.opcoes.map((opcao) => (
                <button
                  key={opcao.id}
                  className="botao secundario"
                  onClick={() => responderDecisao(decisao.id, opcao.id)}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
