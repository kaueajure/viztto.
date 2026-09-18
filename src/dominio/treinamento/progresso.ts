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
  A: 24,
  B: 18,
  C: 12,
  D: 8,
};

export const FRACAO_SECUNDARIO = 0.75;
export const FRACAO_TERCIARIO = 0.5;

/** Sessões máximas que concedem XP por semana de carreira. */
export const MAX_SESSOES_SEMANA = 3;

/**
 * Eficiência por idade. Jovens da base evoluem rápido;
 * veteranos ainda sobem tecnicamente, mas o físico desacelera.
 */
export function eficienciaIdade(idade: number, atributo: Atributo): number {
  const fisico = ATRIBUTOS_FISICOS.has(atributo);
  if (idade <= 17) return fisico ? 1.65 : 1.5;
  if (idade <= 21) return fisico ? 1.38 : 1.28;
  if (idade <= 25) return fisico ? 1.0 : 1.12;
  if (idade <= 28) return fisico ? 0.55 : 0.95;
  if (idade <= 31) return fisico ? 0.25 : 0.62;
  if (idade <= 34) return fisico ? 0.12 : 0.42;
  return fisico ? 0.06 : 0.3;
}

/**
 * Soft potential: desacelera perto/além do potencial oculto,
 * mas nunca zera (permite evolução excepcional).
 * Gap grande (talento alto) dá um leve bônus — não hardcap.
 */
export function fatorPotencial(overall: number, potencialInterno: number): number {
  const gap = potencialInterno - overall;
  if (gap >= 22) return 1.18;
  if (gap >= 12) return 1.1;
  if (gap >= 6) return 0.98 + ((gap - 6) / 6) * 0.12;
  if (gap >= 0) return 0.72 + (gap / 6) * 0.26;
  // Além do potencial: crescimento residual pequeno.
  return Math.max(0.12, 0.28 - Math.min(12, -gap) * 0.01);
}

/**
 * XP necessário para +1 no atributo (barra desenvolvimento continua 0–100).
 *
 * Baixo/médio: muito fácil · 70–79: ainda acessível · 80+: desacelera · 85+/90+: difícil
 */
export function custoProximoPonto(valor: number): number {
  const v = Math.max(1, Math.min(99, Math.floor(valor)));
  if (v < 40) return 18;
  if (v < 50) return 26;
  if (v < 60) return 38;
  if (v < 65) return 48;
  if (v < 70) return 58; // faixa ~65–69 sobe com frequência
  if (v < 75) return 78;
  if (v < 80) return 105;
  if (v < 85) return 175;
  if (v < 90) return 310;
  return 460;
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
  return categoria === "base" ? 1.22 : 1;
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
