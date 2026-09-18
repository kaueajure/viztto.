"use client";

import type { ExercicioTreino } from "@/dominio/treinamento/exercicios";
import { ROTULOS_CATEGORIA } from "@/dominio/treinamento/exercicios";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import type { RecordeExercicio } from "@/dominio/desenvolvimento";

export function CardExercicio({
  exercicio,
  recorde,
  podeJogar,
  onJogar,
  onSimular,
}: {
  exercicio: ExercicioTreino;
  recorde?: RecordeExercicio;
  podeJogar: boolean;
  onJogar: () => void;
  onSimular?: () => void;
}) {
  return (
    <article className="treino-card" data-testid={`card-exercicio-${exercicio.id}`}>
      <header>
        <strong>{exercicio.nome}</strong>
        <small>{ROTULOS_CATEGORIA[exercicio.categoria]}</small>
      </header>
      <p className="texto-suave">{exercicio.descricao}</p>
      <ul className="treino-attrs">
        <li>
          {NOMES_ATRIBUTOS[exercicio.primario].toUpperCase()} ↑↑
        </li>
        {exercicio.secundarios.map((a) => (
          <li key={a}>{NOMES_ATRIBUTOS[a].toUpperCase()} ↑</li>
        ))}
      </ul>
      <p className="treino-recorde">
        Melhor nota: <strong>{recorde?.nota ?? "—"}</strong>
        {recorde ? ` (${recorde.score})` : ""}
      </p>
      <div className="treino-card-acoes">
        <button
          type="button"
          className="botao principal"
          disabled={!podeJogar}
          onClick={onJogar}
          data-testid={`jogar-${exercicio.id}`}
        >
          JOGAR
        </button>
        {recorde && onSimular && (
          <button
            type="button"
            className="botao secundario"
            disabled={!podeJogar}
            onClick={onSimular}
            data-testid={`simular-${exercicio.id}`}
          >
            SIMULAR {recorde.nota}
          </button>
        )}
      </div>
    </article>
  );
}
