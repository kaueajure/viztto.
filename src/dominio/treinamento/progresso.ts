import type { Atributo } from "@/dominio/entidades/modelos";
import type { NotaTreino } from "./notas";
import { centroNota } from "./notas";

/** Atributos físicos — sofrem mais com a idade. */
export const ATRIBUTOS_FISICOS: ReadonlySet<Atributo> = new Set([
  "velocidade",
  "aceleracao",
  "agilidade",
  "resistencia",
  "forca",
  "impulsao",
]);

/** XP base por nota (primário). Calibrado via benchmark. */
export const XP_POR_NOTA: Record<NotaTreino, number> = {
  A: 15,
  B: 11,
  C: 8,
  D: 5,
};

export const FRACAO_SECUNDARIO = 0.7;
export const FRACAO_TERCIARIO = 0.45;

/** Sessões máximas que concedem XP por semana de carreira. */
export const MAX_SESSOES_SEMANA = 3;

/**
 * Eficiência por idade. Veteranos ainda evoluem tecnicamente;
 * físico desacelera mais — sem hard stop.
 */
export function eficienciaIdade(idade: number, atributo: Atributo): number {
  const fisico = ATRIBUTOS_FISICOS.has(atributo);
  if (idade <= 17) return fisico ? 1.55 : 1.4;
  if (idade <= 21) return fisico ? 1.28 : 1.22;
  if (idade <= 25) return fisico ? 0.9 : 1.05;
  if (idade <= 28) return fisico ? 0.5 : 0.88;
  if (idade <= 31) return fisico ? 0.22 : 0.58;
  if (idade <= 34) return fisico ? 0.1 : 0.38;
  return fisico ? 0.05 : 0.28;
}

/**
 * Soft potential: desacelera perto/além do potencial oculto,
 * mas nunca zera (permite evolução excepcional).
 */
export function fatorPotencial(overall: number, potencialInterno: number): number {
  const gap = potencialInterno - overall;
  if (gap >= 14) return 1;
  if (gap >= 6) return 0.62 + ((gap - 6) / 8) * 0.38;
  if (gap >= 0) return 0.32 + (gap / 6) * 0.3;
  // Além do potencial: crescimento residual pequeno.
  return Math.max(0.07, 0.18 - Math.min(12, -gap) * 0.008);
}

/**
 * Custo crescente: atributos altos absorvem menos progresso por XP.
 * A barra visual continua 0–100 (desenvolvimento do jogador).
 */
export function rendimentoAtributo(valor: number): number {
  const v = Math.max(1, Math.min(99, valor));
  // 40 → ~1.25 | 60 → ~0.95 | 80 → ~0.55 | 90 → ~0.35
  return Math.max(0.22, Math.min(1.35, (108 - v) / 52));
}

/** Ajuste fino: A 86 ≠ A 99, sem diferença enorme. */
export function xpBrutoDaSessao(nota: NotaTreino, score: number): number {
  const base = XP_POR_NOTA[nota];
  const fino = (Math.max(0, Math.min(100, score)) - centroNota(nota)) * 0.06;
  return Math.max(1, base + fino);
}

export function chaveSemanaCarreira(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dia = d.getUTCDay();
  const desdeSegunda = (dia + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desdeSegunda);
  return d.toISOString().slice(0, 10);
}
