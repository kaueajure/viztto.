"use client";

import { MinigameBarraTiming } from "./Penalti";
import type { PropsMinigame } from "./tipos";

export function MinigameFinalizacaoPrimeira(props: PropsMinigame) {
  return (
    <MinigameBarraTiming
      {...props}
      exercicioId="finalizacao-primeira"
      rotuloAcao="FINALIZAR"
    />
  );
}

export function MinigameDesarme(props: PropsMinigame) {
  return (
    <MinigameBarraTiming
      {...props}
      exercicioId="desarme"
      rotuloAcao="DESARMAR"
    />
  );
}

export function MinigamePenalti(props: PropsMinigame) {
  return (
    <MinigameBarraTiming
      {...props}
      exercicioId="penaltis"
      rotuloAcao="CHUTAR"
    />
  );
}
