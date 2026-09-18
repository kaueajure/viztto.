/** Notas de treino (FIFA-like). Thresholds centralizados — sem números mágicos na UI. */

export const NOTAS_TREINO = ["A", "B", "C", "D"] as const;
export type NotaTreino = (typeof NOTAS_TREINO)[number];

export const TRAINING_GRADES = {
  A: { min: 85, max: 100 },
  B: { min: 70, max: 84 },
  C: { min: 50, max: 69 },
  D: { min: 0, max: 49 },
} as const satisfies Record<NotaTreino, { min: number; max: number }>;

export function notaDeScore(score: number): NotaTreino {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= TRAINING_GRADES.A.min) return "A";
  if (s >= TRAINING_GRADES.B.min) return "B";
  if (s >= TRAINING_GRADES.C.min) return "C";
  return "D";
}

/** Centro aproximado da faixa da nota — usado no ajuste fino de XP. */
export function centroNota(nota: NotaTreino): number {
  const { min, max } = TRAINING_GRADES[nota];
  return (min + max) / 2;
}

export function atualizarRecorde(
  anterior: { score: number; nota: NotaTreino } | null | undefined,
  score: number,
): { score: number; nota: NotaTreino; novoRecorde: boolean } {
  const nota = notaDeScore(score);
  if (!anterior || score > anterior.score) {
    return { score, nota, novoRecorde: true };
  }
  return { score: anterior.score, nota: anterior.nota, novoRecorde: false };
}
