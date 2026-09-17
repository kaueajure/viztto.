import type { NivelCoberturaSportmonks } from "@/dominio/constantes/sportmonks-ligas";
import type { Clube } from "@/dominio/entidades/modelos";
import type { RatingMetadata } from "./rating-engine";

export const HEALTH_THRESHOLDS = {
  enriquecidoMinimo: 0.15,
  quedaRelativaMaxima: 0.6,
  quedaAbsolutaMinima: 0.09,
  quedaAbsolutaMaxima: 0.4,
  coberturaCritica: 0.25,
  matchCritico: 0.1,
  coberturaSaudavel: 0.6,
  matchSaudavel: 0.35,
  statsSaudavel: 0.25,
} as const;

export type StatusEnriquecimento =
  "ok" | "fallback_esperado" | "degradado" | "falha_critica";

/** Saúde agregada do enrichment Sportmonks por liga. */
export type NivelSaudeEnriquecimento =
  "saudavel" | "degradado" | "critico" | "fallback_esperado";

/** Contadores brutos coletados durante o enrichment. */
export interface MetricasEnriquecimentoLiga {
  timesEsperados: number;
  timesEncontrados: number;
  squadsSolicitados: number;
  squadsObtidos: number;
  squadsFalhos: number;
  jogadoresTm: number;
  candidatosSm: number;
  matches: number;
  comStats: number;
  fallback: number;
  requestsFalhos: number;
}

/** Taxas normalizadas usadas pela regra centralizada de saúde. */
export interface CoverageHealth {
  teamCoverage: number;
  squadSuccessRate: number;
  playerStatsCoverage: number;
  matchRate: number;
  taxaEnriquecimento: number;
  taxaEnriquecimentoAnterior?: number;
}

export interface AvaliacaoSaudeEnriquecimento {
  saude: NivelSaudeEnriquecimento;
  coverageHealth: CoverageHealth;
  status: StatusEnriquecimento;
  abortarPublicacao: boolean;
  motivo?: string;
}

/** Fração de jogadores com enrichment Sportmonks/hybrid no snapshot. */
export function taxaEnriquecimento(clubes: Clube[] | null | undefined): number {
  if (!clubes?.length) return 0;
  let total = 0;
  let ricos = 0;
  for (const c of clubes) {
    for (const j of c.elenco) {
      total++;
      const meta = (j as { ratingMetadata?: RatingMetadata }).ratingMetadata;
      if (meta?.source === "sportmonks" || meta?.source === "hybrid") ricos++;
    }
  }
  return total > 0 ? ricos / total : 0;
}

export function metricasVazias(
  parcial: Partial<MetricasEnriquecimentoLiga> = {},
): MetricasEnriquecimentoLiga {
  return {
    timesEsperados: 0,
    timesEncontrados: 0,
    squadsSolicitados: 0,
    squadsObtidos: 0,
    squadsFalhos: 0,
    jogadoresTm: 0,
    candidatosSm: 0,
    matches: 0,
    comStats: 0,
    fallback: 0,
    requestsFalhos: 0,
    ...parcial,
  };
}

export function calcularCoverageHealth(
  m: MetricasEnriquecimentoLiga,
  taxaEnriquecimentoAtual: number,
  taxaEnriquecimentoAnterior?: number,
): CoverageHealth {
  const teamCoverage =
    m.timesEsperados > 0 ? m.timesEncontrados / m.timesEsperados : 0;
  const squadSuccessRate =
    m.squadsSolicitados > 0 ? m.squadsObtidos / m.squadsSolicitados : 0;
  const playerStatsCoverage =
    m.jogadoresTm > 0 ? m.comStats / m.jogadoresTm : 0;
  const matchRate = m.jogadoresTm > 0 ? m.matches / m.jogadoresTm : 0;
  return {
    teamCoverage,
    squadSuccessRate,
    playerStatsCoverage,
    matchRate,
    taxaEnriquecimento: taxaEnriquecimentoAtual,
    ...(taxaEnriquecimentoAnterior !== undefined
      ? { taxaEnriquecimentoAnterior }
      : {}),
  };
}

/**
 * Queda severa: ex. 75% enriquecido → 12%.
 * Compara taxa atual vs anterior quando a anterior era materialmente rica.
 */
export function quedaSeveraEnriquecimento(
  atual: number,
  anterior: number | undefined,
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

/**
 * Regra centralizada de saúde do enrichment.
 * Cobertura D → fallback esperado (nunca erro/aborto por métricas).
 * A/B: queda severa vs snapshot anterior aborta publicação.
 */
export function avaliarSaudeEnriquecimento(entrada: {
  cobertura: NivelCoberturaSportmonks;
  metricas: MetricasEnriquecimentoLiga;
  taxaAtual: number;
  taxaAnterior?: number;
  anteriorEnriquecido?: boolean;
  permitirBootstrapDegradado?: boolean;
}): AvaliacaoSaudeEnriquecimento {
  const coverageHealth = calcularCoverageHealth(
    entrada.metricas,
    entrada.taxaAtual,
    entrada.taxaAnterior,
  );

  if (entrada.cobertura === "D") {
    return {
      saude: "fallback_esperado",
      coverageHealth,
      status: "fallback_esperado",
      abortarPublicacao: false,
      motivo: "cobertura-D",
    };
  }

  const queda = quedaSeveraEnriquecimento(
    entrada.taxaAtual,
    entrada.taxaAnterior,
  );
  const cobreAb = entrada.cobertura === "A" || entrada.cobertura === "B";

  const coberturaCritica =
    coverageHealth.teamCoverage < HEALTH_THRESHOLDS.coberturaCritica ||
    (entrada.metricas.squadsSolicitados > 0 &&
      coverageHealth.squadSuccessRate < HEALTH_THRESHOLDS.coberturaCritica) ||
    (entrada.metricas.jogadoresTm > 0 &&
      coverageHealth.matchRate < HEALTH_THRESHOLDS.matchCritico);

  const coberturaFraca =
    coverageHealth.teamCoverage < HEALTH_THRESHOLDS.coberturaSaudavel ||
    (entrada.metricas.squadsSolicitados > 0 &&
      coverageHealth.squadSuccessRate < HEALTH_THRESHOLDS.coberturaSaudavel) ||
    coverageHealth.matchRate < HEALTH_THRESHOLDS.matchSaudavel ||
    coverageHealth.playerStatsCoverage < HEALTH_THRESHOLDS.statsSaudavel;

  if (cobreAb && queda) {
    return {
      saude: "critico",
      coverageHealth,
      status: "falha_critica",
      abortarPublicacao: true,
      motivo: `queda severa de enrichment (${pct(entrada.taxaAnterior)} → ${pct(entrada.taxaAtual)})`,
    };
  }

  // A/B crítico: NUNCA publicar — inclusive no primeiro bootstrap.
  if (cobreAb && coberturaCritica) {
    return {
      saude: "critico",
      coverageHealth,
      status: "falha_critica",
      abortarPublicacao: true,
      motivo: `cobertura Sportmonks crítica (teams=${pct(coverageHealth.teamCoverage)}, squads=${pct(coverageHealth.squadSuccessRate)}, match=${pct(coverageHealth.matchRate)})`,
    };
  }

  const anteriorEnriquecido =
    entrada.anteriorEnriquecido ??
    (entrada.taxaAnterior !== undefined &&
      entrada.taxaAnterior >= HEALTH_THRESHOLDS.enriquecidoMinimo);
  // Bootstrap A/B degradado exige consentimento explícito.
  if (cobreAb && coberturaFraca && !anteriorEnriquecido) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: !entrada.permitirBootstrapDegradado,
      motivo: "bootstrap A/B parcial exige permitirBootstrapDegradado",
    };
  }

  if (coberturaFraca && anteriorEnriquecido && cobreAb) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: true,
      motivo: "métricas Sportmonks abaixo do esperado para cobertura A/B",
    };
  }

  if (entrada.cobertura === "C" && coberturaCritica) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: false,
      motivo: "cobertura C crítica tolerada",
    };
  }

  if (entrada.cobertura === "C" && coberturaFraca) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: false,
      motivo: "cobertura C parcial",
    };
  }

  if (coberturaFraca) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: false,
      motivo: "enrichment parcial",
    };
  }

  return {
    saude: "saudavel",
    coverageHealth,
    status: "ok",
    abortarPublicacao: false,
  };
}

function pct(n: number | undefined): string {
  if (n === undefined) return "n/a";
  return `${Math.round(n * 100)}%`;
}
