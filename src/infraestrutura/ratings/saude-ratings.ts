import type { Clube } from "@/dominio/entidades/modelos";
import { normalizarRatingMetadata } from "@/dominio/rating-metadata";

export const HEALTH_THRESHOLDS = {
  enriquecidoMinimo: 0.15,
  quedaRelativaMaxima: 0.6,
  quedaAbsolutaMinima: 0.09,
  quedaAbsolutaMaxima: 0.4,
} as const;
export type StatusEnriquecimento =
  "ok" | "fallback_esperado" | "degradado" | "falha_critica";
export interface MetricasRatings {
  playersTotal: number;
  providerCandidates: number;
  matched: number;
  exact: number;
  high: number;
  ambiguous: number;
  externalRatings: number;
  fallbackEngine: number;
  requestFailures: number;
  coverage: number;
  previousCoverage: number;
}
export function taxaEnriquecimento(clubes: Clube[] | null | undefined): number {
  const jogadores = clubes?.flatMap((c) => c.elenco) ?? [];
  return jogadores.length
    ? jogadores.filter((j) => {
        const meta = normalizarRatingMetadata(
          (j as { ratingMetadata?: unknown }).ratingMetadata,
        );
        return meta?.source === "external" || meta?.source === "multi-source";
      }).length / jogadores.length
    : 0;
}
export function snapshotEstavaEnriquecido(
  clubes: Clube[] | null | undefined,
): boolean {
  return taxaEnriquecimento(clubes) >= HEALTH_THRESHOLDS.enriquecidoMinimo;
}
export function quedaSeveraEnriquecimento(
  atual: number,
  anterior?: number,
): boolean {
  if (anterior === undefined || anterior < HEALTH_THRESHOLDS.enriquecidoMinimo)
    return false;
  const queda = anterior - atual;
  return (
    queda >= HEALTH_THRESHOLDS.quedaAbsolutaMaxima ||
    (queda >= HEALTH_THRESHOLDS.quedaAbsolutaMinima &&
      atual / anterior <= 1 - HEALTH_THRESHOLDS.quedaRelativaMaxima)
  );
}
export function avaliarSaudeRatings(
  m: MetricasRatings,
  permitirEnginePuro = false,
  falhaBot = false,
) {
  const regressao = quedaSeveraEnriquecimento(m.coverage, m.previousCoverage);
  const semExterno = m.externalRatings === 0;
  const abortarPublicacao =
    regressao ||
    (falhaBot && m.previousCoverage > 0) ||
    (semExterno && !permitirEnginePuro);
  const status: StatusEnriquecimento = abortarPublicacao
    ? "falha_critica"
    : semExterno
      ? "fallback_esperado"
      : m.requestFailures
        ? "degradado"
        : "ok";
  return {
    status,
    abortarPublicacao,
    metricas: m,
    motivo: regressao
      ? "Queda severa de cobertura externa."
      : abortarPublicacao
        ? "Falha de ratings ou fallback puro sem autorização explícita."
        : undefined,
  };
}
