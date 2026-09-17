import type { NivelCoberturaSportmonks } from "@/dominio/constantes/sportmonks-ligas";
import type { Clube } from "@/dominio/entidades/modelos";
import type { RatingMetadata } from "./rating-engine";

export type StatusEnriquecimento =
  | "ok"
  | "fallback_esperado"
  | "degradado"
  | "falha_critica";

/** Saúde agregada do enrichment Sportmonks por liga. */
export type NivelSaudeEnriquecimento =
  | "saudavel"
  | "degradado"
  | "critico"
  | "fallback_esperado";

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
export function taxaEnriquecimento(
  clubes: Clube[] | null | undefined,
): number {
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
  if (anterior === undefined || anterior < 0.4) return false;
  if (atual < anterior * 0.35) return true;
  if (anterior - atual >= 0.45 && atual < 0.25) return true;
  return false;
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
    coverageHealth.teamCoverage < 0.25 ||
    (entrada.metricas.squadsSolicitados > 0 &&
      coverageHealth.squadSuccessRate < 0.25) ||
    (entrada.metricas.jogadoresTm > 0 && coverageHealth.matchRate < 0.1);

  const coberturaFraca =
    coverageHealth.teamCoverage < 0.6 ||
    (entrada.metricas.squadsSolicitados > 0 &&
      coverageHealth.squadSuccessRate < 0.6) ||
    coverageHealth.matchRate < 0.35 ||
    coverageHealth.playerStatsCoverage < 0.25;

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

  // Bootstrap A/B degradado (não crítico): publica com warning.
  if (cobreAb && coberturaFraca && !entrada.anteriorEnriquecido) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: false,
      motivo: "bootstrap A/B com enrichment parcial — publicação degradada",
    };
  }

  if (coberturaFraca && entrada.anteriorEnriquecido && cobreAb) {
    return {
      saude: "degradado",
      coverageHealth,
      status: "degradado",
      abortarPublicacao: false,
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
