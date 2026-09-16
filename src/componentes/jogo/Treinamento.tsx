import type { EstadoCarreira, FocoTreino } from "@/dominio/entidades/modelos";
import { FOCOS_TREINO } from "@/simulacao/treinamento/treinamento";
import { useJogoStore } from "@/estado/jogo-store";
import { Barra } from "@/componentes/interface/Elementos";
import { Check } from "lucide-react";
export function Treinamento({ carreira: c }: { carreira: EstadoCarreira }) {
  const escolher = useJogoStore((s) => s.escolherTreino);
  return (
    <>
      <p className="sobretitulo">CENTRO DE TREINAMENTO</p>
      <h1>O TRABALHO INVISÍVEL.</h1>
      <p className="texto-suave">
        Escolha o foco da próxima semana. O treino acontece uma única vez ao
        avançar o tempo.
      </p>
      <div className="grade-dupla espaco">
        <div className="grade-dupla opcoes">
          {(
            Object.entries(FOCOS_TREINO) as [
              FocoTreino,
              (typeof FOCOS_TREINO)[FocoTreino],
            ][]
          ).map(([id, foco]) => (
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
          <p className="texto-suave">
            Carga alta e fadiga aumentam o risco de lesão. A evolução é gradual
            e varia com idade, profissionalismo, moral e qualidade da estrutura.
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
