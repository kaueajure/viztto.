import type { Liga } from "@/dominio/entidades/modelos";

/** Nível de cobertura Sportmonks por competição. */
export type NivelCoberturaSportmonks = "A" | "B" | "C" | "D";

/**
 * Como resolver a temporada Sportmonks.
 * - preferido: exige seasonIdPreferido (sem fallback silencioso)
 * - busca: preferido se houver, senão /seasons/search — nunca currentSeason
 * - current: só quando configurado conscientemente; currentSeason é último recurso
 */
export type EstrategiaTemporadaSportmonks = "preferido" | "busca" | "current";

export interface MapeamentoSportmonksLiga {
  ligaId: string;
  /** ID da liga no Sportmonks Football API v3. */
  idSportmonks: number | null;
  /**
   * Nome usado em /seasons/search/{name} para resolver a temporada.
   * Evita seasonId global único (Brasil ≠ Europa).
   */
  nomeTemporadaBusca: string | null;
  /** Season ID conhecido (opcional; se null, resolve via busca). */
  seasonIdPreferido: number | null;
  /** Estratégia de resolução — Brasil/Europa usam "busca" por padrão. */
  seasonStrategy: EstrategiaTemporadaSportmonks;
  cobertura: NivelCoberturaSportmonks;
  notas?: string;
}

/**
 * Mapeamento centralizado Viztto → Sportmonks.
 * IDs oficiais da Football API v3; cobertura estimada por nível de plano/dados.
 * NÃO espalhar IDs Sportmonks pelo restante do código.
 */
export const SPORTMONKS_LIGAS: Record<string, MapeamentoSportmonksLiga> = {
  brasileirao: {
    ligaId: "brasileirao",
    idSportmonks: 648,
    nomeTemporadaBusca: "Brasileirão",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
    notas: "Stats individuais tipicamente ricos na Série A.",
  },
  "brasileirao-b": {
    ligaId: "brasileirao-b",
    idSportmonks: 651,
    nomeTemporadaBusca: "Brasil Serie B",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "B",
  },
  "brasileirao-c": {
    ligaId: "brasileirao-c",
    idSportmonks: null,
    nomeTemporadaBusca: null,
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "D",
    notas: "Cobertura individual limitada/ausente; usar fallback Transfermarkt.",
  },
  "premier-league": {
    ligaId: "premier-league",
    idSportmonks: 8,
    nomeTemporadaBusca: "Premier League",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  championship: {
    ligaId: "championship",
    idSportmonks: 9,
    nomeTemporadaBusca: "Championship",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  "la-liga": {
    ligaId: "la-liga",
    idSportmonks: 564,
    nomeTemporadaBusca: "La Liga",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  "la-liga-2": {
    ligaId: "la-liga-2",
    idSportmonks: 567,
    nomeTemporadaBusca: "La Liga 2",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "B",
  },
  "serie-a": {
    ligaId: "serie-a",
    idSportmonks: 384,
    nomeTemporadaBusca: "Serie A",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  "serie-b": {
    ligaId: "serie-b",
    idSportmonks: 387,
    nomeTemporadaBusca: "Serie B",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "B",
  },
  bundesliga: {
    ligaId: "bundesliga",
    idSportmonks: 82,
    nomeTemporadaBusca: "Bundesliga",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  "bundesliga-2": {
    ligaId: "bundesliga-2",
    idSportmonks: 85,
    nomeTemporadaBusca: "2. Bundesliga",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "B",
  },
  "ligue-1": {
    ligaId: "ligue-1",
    idSportmonks: 301,
    nomeTemporadaBusca: "Ligue 1",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "A",
  },
  "ligue-2": {
    ligaId: "ligue-2",
    idSportmonks: 304,
    nomeTemporadaBusca: "Ligue 2",
    seasonIdPreferido: null,
    seasonStrategy: "busca",
    cobertura: "B",
  },
};

export function mapeamentoSportmonks(liga: Pick<Liga, "id">): MapeamentoSportmonksLiga {
  return (
    SPORTMONKS_LIGAS[liga.id] ?? {
      ligaId: liga.id,
      idSportmonks: null,
      nomeTemporadaBusca: null,
      seasonIdPreferido: null,
      seasonStrategy: "busca",
      cobertura: "D",
      notas: "Liga sem mapeamento Sportmonks.",
    }
  );
}

export const SPORTMONKS_ENV_TOKEN = "SPORTMONKS_API_TOKEN";
export const SPORTMONKS_BASE_URL =
  process.env.SPORTMONKS_API_URL?.replace(/\/$/, "") ||
  "https://api.sportmonks.com/v3/football";
