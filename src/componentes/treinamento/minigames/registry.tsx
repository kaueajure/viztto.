import type { ReactNode } from "react";
import type { ExercicioId } from "@/dominio/treinamento/exercicios";
import type { PropsMinigame } from "./tipos";
import { MinigamePenalti, MinigameFinalizacaoPrimeira, MinigameDesarme } from "./index-timing";
import { MinigameFinalizacaoColocada } from "./FinalizacaoColocada";
import {
  MinigameCabecalho,
  MinigameCruzamento,
  MinigamePasseProfundidade,
  MinigamePasseRapido,
} from "./GrupoCampo";
import {
  MinigameArrancada,
  MinigameDrible,
  MinigameDominio,
  MinigameResistencia,
} from "./GrupoTecnico";
import {
  MinigameGoleiroPenalti,
  MinigameGoleiroPosicionamento,
  MinigameGoleiroReflexos,
  MinigameInterceptacao,
} from "./GrupoGoleiro";

const MAPA: Record<ExercicioId, (p: PropsMinigame) => ReactNode> = {
  penaltis: (p) => <MinigamePenalti {...p} />,
  "finalizacao-colocada": (p) => <MinigameFinalizacaoColocada {...p} />,
  "finalizacao-primeira": (p) => <MinigameFinalizacaoPrimeira {...p} />,
  cabecalho: (p) => <MinigameCabecalho {...p} />,
  "passe-rapido": (p) => <MinigamePasseRapido {...p} />,
  "passe-profundidade": (p) => <MinigamePasseProfundidade {...p} />,
  cruzamento: (p) => <MinigameCruzamento {...p} />,
  drible: (p) => <MinigameDrible {...p} />,
  dominio: (p) => <MinigameDominio {...p} />,
  arrancada: (p) => <MinigameArrancada {...p} />,
  resistencia: (p) => <MinigameResistencia {...p} />,
  desarme: (p) => <MinigameDesarme {...p} />,
  interceptacao: (p) => <MinigameInterceptacao {...p} />,
  "goleiro-reflexos": (p) => <MinigameGoleiroReflexos {...p} />,
  "goleiro-penaltis": (p) => <MinigameGoleiroPenalti {...p} />,
  "goleiro-posicionamento": (p) => <MinigameGoleiroPosicionamento {...p} />,
};

export function renderMinigame(id: ExercicioId, props: PropsMinigame) {
  return MAPA[id](props);
}
