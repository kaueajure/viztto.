"use client";

export interface ResultadoMinigame {
  exercicioId: string;
  score: number;
  tentativas: number;
}

export interface PropsMinigame {
  onConcluido: (resultado: ResultadoMinigame) => void;
  /** 0–1 determinístico; se omitido, usa Math.random. */
  aleatorio?: () => number;
  /** Acelera timers em testes. */
  multiplicadorTempo?: number;
}

export function criarAleatorio(seed?: number): () => number {
  let estado = (seed ?? Date.now()) >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let v = estado;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

export function mediaScores(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Score por distância ao centro ideal (0 = perfeito). */
export function scorePorDistancia(
  posicao: number,
  ideal: number,
  toleranciaVerde: number,
  toleranciaAmarela: number,
): number {
  const d = Math.abs(posicao - ideal);
  if (d <= toleranciaVerde) return Math.round(100 - (d / toleranciaVerde) * 15);
  if (d <= toleranciaAmarela)
    return Math.round(
      70 -
        ((d - toleranciaVerde) / (toleranciaAmarela - toleranciaVerde)) * 20,
    );
  return Math.max(
    0,
    Math.round(49 - ((d - toleranciaAmarela) / (1 - toleranciaAmarela)) * 49),
  );
}
