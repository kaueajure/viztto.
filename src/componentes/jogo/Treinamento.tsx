import { PlanoDesenvolvimento } from "./PlanoDesenvolvimento";
import type { EstadoCarreira, FocoTreino } from "@/dominio/entidades/modelos";
import { FOCOS_TREINO } from "@/simulacao/treinamento/treinamento";
import { useJogoStore } from "@/estado/jogo-store";
import { Barra } from "@/componentes/interface/Elementos";
import { Check } from "lucide-react";
import { planosDaPosicao } from "@/dominio/planos-desenvolvimento";

export function Treinamento({ carreira: c }: { carreira: EstadoCarreira }) {
  const escolher = useJogoStore((s) => s.escolherTreino);
  const temPlano = !!c.jogador.preparacao.planoId;
  const plano = planosDaPosicao(c.jogador.posicao).find(
    (p) => p.id === c.jogador.preparacao.planoId,
  );
  return (
    <>
      <p className="sobretitulo">CENTRO DE TREINAMENTO</p>
      <h1>O TRABALHO INVISÍVEL.</h1>
      <p className="texto-suave">
        Defina um plano de desenvolvimento e até duas prioridades. O treino
        acontece uma vez ao avançar o tempo. Recuperação reduz fadiga e risco.
      </p>
      <PlanoDesenvolvimento carreira={c} />
      {temPlano && (
        <p className="painel" role="status">
          Plano ativo: <strong>{plano?.nome ?? "Personalizado"}</strong>
          {c.jogador.preparacao.prioridades.length
            ? ` · Prioridades definidas`
            : ""}
          . Com plano ativo, a carga segue a intensidade do plano; o foco
          rápido só oferece recuperação ou o ritmo do plano (equilibrado).
        </p>
      )}
      <div className="grade-dupla espaco">
        <div className="grade-dupla opcoes">
          {(
            Object.entries(FOCOS_TREINO) as [
              FocoTreino,
              (typeof FOCOS_TREINO)[FocoTreino],
            ][]
          )
            .filter(([id]) => !temPlano || id === "recuperacao" || id === "equilibrado")
            .map(([id, foco]) => (
              <button
                key={id}
                className={`opcao ${c.focoTreino === id ? "selecionada" : ""}`}
                aria-pressed={c.focoTreino === id}
                onClick={() => escolher(id)}
              >
                <div className="linha-titulo">
                  <strong>{foco.nome}</strong>
                  {c.focoTreino === id && <Check size={18} />}
                </div>
                <span>{foco.descricao}</span>
                <small>
                  {foco.carga < 0
                    ? "DESCANSO ATIVO"
                    : foco.carga > 20
                      ? "CARGA ALTA"
                      : "CARGA MODERADA"}
                </small>
              </button>
            ))}
        </div>
        <section className="painel">
          <h2>PREPARAÇÃO FÍSICA</h2>
          <Barra nome="Condicionamento" valor={c.jogador.condicionamento} />
          <Barra nome="Fadiga" valor={c.jogador.fadiga} />
          <Barra nome="Ritmo de jogo" valor={c.jogador.ritmo} />
          <p className="citacao">
            “Evoluir também é saber a hora de descansar.”
          </p>
          {c.jogador.lesao && (
            <p className="aviso">
              Você está lesionado. O departamento médico aplicará recuperação
              até sua liberação.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
