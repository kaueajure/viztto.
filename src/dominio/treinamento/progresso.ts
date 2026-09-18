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

/**
 * XP base por nota (primário).
 * O custo crescente (custoProximoPonto) faz o trabalho de desacelerar no alto.
 */
export const XP_POR_NOTA: Record<NotaTreino, number> = {
  A: 15,
  B: 11,
  C: 7,
  D: 4,
};

export const FRACAO_SECUNDARIO = 0.7;
export const FRACAO_TERCIARIO = 0.45;

/** Sessões máximas que concedem XP por semana de carreira. */
export const MAX_SESSOES_SEMANA = 3;

/**
 * Eficiência por idade. Jovens da base evoluem rápido;
 * veteranos ainda sobem tecnicamente, mas o físico desacelera.
 */
export function eficienciaIdade(idade: number, atributo: Atributo): number {
  const fisico = ATRIBUTOS_FISICOS.has(atributo);
  if (idade <= 17) return fisico ? 1.55 : 1.42;
  if (idade <= 21) return fisico ? 1.28 : 1.2;
  if (idade <= 25) return fisico ? 0.92 : 1.05;
  if (idade <= 28) return fisico ? 0.5 : 0.88;
  if (idade <= 31) return fisico ? 0.22 : 0.58;
  if (idade <= 34) return fisico ? 0.1 : 0.38;
  return fisico ? 0.05 : 0.28;
}

/**
 * Soft potential: desacelera perto/além do potencial oculto,
 * mas nunca zera (permite evolução excepcional).
 * Gap grande (talento alto) dá um leve bônus — não hardcap.
 */
export function fatorPotencial(overall: number, potencialInterno: number): number {
  const gap = potencialInterno - overall;
  if (gap >= 28) return 1.1;
  if (gap >= 18) return 1.04;
  if (gap >= 10) return 0.88 + ((gap - 10) / 8) * 0.12;
  if (gap >= 0) return 0.4 + (gap / 10) * 0.48;
  // Além do potencial: crescimento residual pequeno.
  return Math.max(0.07, 0.18 - Math.min(12, -gap) * 0.008);
}

/**
 * XP necessário para +1 no atributo (barra desenvolvimento continua 0–100).
 *
 * Filosofia carreira:
 * 40–49 muito fácil → 50–59 fácil → 60–64 fácil/mod → 65–69 moderado
 * 70–74 mais difícil → 75–79 difícil → 80–84 bem difícil
 * 85–89 muito difícil → 90+ excepcional
 */
export function custoProximoPonto(valor: number): number {
  const v = Math.max(1, Math.min(99, Math.floor(valor)));
  if (v < 40) return 52;
  if (v < 50) return 78; // muito fácil
  if (v < 60) return 118; // fácil
  if (v < 65) return 158; // fácil/moderado
  if (v < 70) return 205; // moderado
  if (v < 75) return 265; // mais difícil
  if (v < 80) return 335; // difícil
  if (v < 85) return 430; // bem difícil
  if (v < 90) return 560; // muito difícil
  return 750; // excepcional 90+
}

/**
 * Converte XP efetivo (já com idade/potencial/etc.) em % da barra 0–100.
 * Saves antigos continuam válidos: desenvolvimento[atributo] segue 0–100.
 */
export function progressoDeXp(xpEfetivo: number, valorAtributo: number): number {
  if (xpEfetivo <= 0) return 0;
  return (xpEfetivo / custoProximoPonto(valorAtributo)) * 100;
}

/**
 * Inverso relativo do custo — útil em comparações/testes.
 * Preferir progressoDeXp / custoProximoPonto na lógica nova.
 */
export function rendimentoAtributo(valor: number): number {
  return 100 / custoProximoPonto(valor);
}

/** Boost leve para categoria de base (mesmo OVR, contexto formativo). */
export function fatorCategoria(categoria: "base" | "profissional"): number {
  return categoria === "base" ? 1.12 : 1;
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
