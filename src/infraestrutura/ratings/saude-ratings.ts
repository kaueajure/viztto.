import type { Clube } from "@/dominio/entidades/modelos";
import { normalizarRatingMetadata } from "@/dominio/rating-metadata";
import type { ResultadoBot } from "./contrato";

export const HEALTH_THRESHOLDS = {
  enriquecidoMinimo: 0.15,
  quedaRelativaMaxima: 0.6,
  quedaAbsolutaMinima: 0.09,
  quedaAbsolutaMaxima: 0.4,
} as const;
export type StatusEnriquecimento =
  "ok" | "fallback_esperado" | "degradado" | "falha_critica";
/** Distingue ausência de provider de falha técnica do provider. */
export type StatusProvider =
  | "not-configured"
  | "healthy"
  | "degraded"
  | "failed";
export interface MetricasRatings {
  playersTotal: number;
  providerCandidates: number;
  matched: number;
  exact: number;
  high: number;
  medium: number;
  low: number;
  ambiguous: number;
  unmatched: number;
  externalRatings: number;
  fallbackEngine: number;
  requestFailures: number;
  coverage: number;
  previousCoverage: number;
  providerStatus: StatusProvider;
}

/**
 * Métricas de UMA liga, derivadas dos diagnósticos por jogador.
 * Contadores globais do lote (`resultado.providers`) descrevem o processo
 * inteiro e nunca são atribuídos a uma liga isolada.
 */
export function metricasDaLiga(
  jogadores: Set<string>,
  resultado: ResultadoBot,
  coverage: number,
  previousCoverage: number,
): MetricasRatings {
  const providers = Object.keys(resultado.providers).length;
  const diagnosticos = Object.values(resultado.diagnostics).flatMap((d) =>
    Object.entries(d)
      .filter(([id]) => jogadores.has(id))
      .map(([, m]) => m),
  );
  const nivel = (c: string) =>
    diagnosticos.filter((d) => d.confidence === c).length;
  const externalRatings = resultado.players.filter(
    (p) =>
      jogadores.has(p.id) &&
      p.sources.some((s) => ["exact", "high"].includes(s.confidence)),
  ).length;
  const requestFailures = diagnosticos.filter((d) => d.error).length;
  return {
    playersTotal: jogadores.size,
    providerCandidates: diagnosticos.reduce(
      (n, d) => n + d.candidateCount,
      0,
    ),
    matched: externalRatings,
    exact: nivel("exact"),
    high: nivel("high"),
    medium: nivel("medium"),
    low: nivel("low"),
    ambiguous: nivel("ambiguous"),
    unmatched: nivel("unmatched"),
    externalRatings,
    fallbackEngine: jogadores.size - externalRatings,
    requestFailures,
    coverage,
    previousCoverage,
    providerStatus: !providers
      ? "not-configured"
      : requestFailures >= jogadores.size * providers
        ? "failed"
        : requestFailures
          ? "degraded"
          : "healthy",
  };
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
