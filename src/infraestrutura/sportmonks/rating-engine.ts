import type { Atributo, Atributos, Posicao } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { calcularOverall, criarAtributosUniformes } from "@/dominio/regras/jogador";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import type { NivelCoberturaSportmonks } from "@/dominio/constantes/sportmonks-ligas";

const LISTA_ATRIBUTOS = Object.keys(NOMES_ATRIBUTOS) as Atributo[];

export type FonteRating =
  | "sportmonks"
  | "hybrid"
  | "transfermarkt-estimated"
  | "generated";

export type ConfiancaRating = "high" | "medium" | "low";

export interface RatingMetadata {
  source: FonteRating;
  confidence: ConfiancaRating;
  minutes: number;
  appearances: number;
  season: string;
  sportmonksPlayerId?: number;
  matchConfidence?: string;
  estimatedAttributes?: Atributo[];
  coverageLevel?: NivelCoberturaSportmonks;
}

/** Stats normalizadas (por 90 quando aplicável). Ausentes = undefined. */
export interface StatsSportmonksNormalizadas {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  shots?: number;
  shotsOnTarget?: number;
  keyPasses?: number;
  passesAccurate?: number;
  passesTotal?: number;
  longBalls?: number;
  dribblesAttempted?: number;
  dribblesSuccess?: number;
  tackles?: number;
  tacklesWon?: number;
  interceptions?: number;
  clearances?: number;
  aerialsWon?: number;
  aerialsTotal?: number;
  duelsWon?: number;
  duelsTotal?: number;
  rating?: number;
  saves?: number;
  goalsConceded?: number;
  cleanSheets?: number;
  xg?: number;
  xa?: number;
}

export interface EntradaRatingEngine {
  seed: string;
  nome: string;
  posicaoBruta: string;
  idade: number;
  valorMercado: number | null;
  altura: number | null;
  reputacaoLiga: number;
  reputacaoClube: number;
  forcaMediaLiga: number;
  indiceNoElenco: number;
  tamanhoElenco: number;
  cobertura: NivelCoberturaSportmonks;
  stats?: StatsSportmonksNormalizadas | null;
  sportmonksPlayerId?: number;
  seasonLabel?: string;
  matchConfidence?: string;
}

export interface ResultadoRating {
  atributos: Atributos;
  overall: number;
  potencial: number;
  metadata: RatingMetadata;
}

const CONST = {
  /** Minutos mínimos para confiança alta. */
  minutosAlta: 1200,
  minutosMedia: 450,
  /** Shrinkage: peso das stats vs prior. */
  minutosPlenaConfianca: 1800,
} as const;

function priorPosicao(posicao: Posicao, overallAlvo: number): Atributos {
  const base = criarAtributosUniformes(Math.round(overallAlvo * 0.92));
  const boosts: Partial<Record<Posicao, Partial<Record<Atributo, number>>>> = {
    GOL: { reflexos: 8, defesaGoleiro: 8, posicionamentoGoleiro: 6, saida: 4, reposicao: 3 },
    CA: { finalizacao: 8, compostura: 5, posicionamento: 6, cabeceio: 4 },
    PD: { drible: 7, velocidade: 6, aceleracao: 5, cruzamento: 4, finalizacao: 3 },
    PE: { drible: 7, velocidade: 6, aceleracao: 5, cruzamento: 4, finalizacao: 3 },
    MEI: { visao: 7, passeCurto: 6, passeLongo: 4, dominio: 5, finalizacao: 3 },
    MC: { passeCurto: 6, dominio: 5, visao: 4, resistencia: 4, marcacao: 2 },
    VOL: { marcacao: 6, desarme: 6, antecipacao: 5, passeCurto: 3, forca: 3 },
    ZAG: { marcacao: 7, desarme: 5, antecipacao: 5, cabeceio: 5, forca: 4 },
    LD: { cruzamento: 5, velocidade: 5, resistencia: 4, marcacao: 3 },
    LE: { cruzamento: 5, velocidade: 5, resistencia: 4, marcacao: 3 },
  };
  for (const [atr, delta] of Object.entries(boosts[posicao] ?? {}) as [Atributo, number][]) {
    base[atr] = limitar(base[atr] + delta, 1, 99);
  }
  return base;
}

function overallPriorMercado(entrada: EntradaRatingEngine): number {
  const aleatorio = new GeradorAleatorio(gerarSeedNumerica(`ov-${entrada.seed}`));
  const valor = Math.max(0, entrada.valorMercado ?? 0);
  const logValor =
    valor > 0
      ? Math.log10(valor + 1)
      : 4.6 + aleatorio.proximo() * 0.5; // sem MV: prior baixo (~40–50k), não mid-tier
  let overall = 38 + logValor * 6.2;
  const idade = entrada.idade;
  if (idade <= 18) overall -= 4;
  else if (idade <= 21) overall -= 1.5;
  else if (idade >= 22 && idade <= 28) overall += 2.5;
  else if (idade >= 29 && idade <= 32) overall += 1;
  else if (idade >= 33) overall -= (idade - 32) * 1.2;
  overall += (entrada.reputacaoLiga - 80) * 0.12;
  overall += (entrada.reputacaoClube - 70) * 0.08;
  const fracao =
    entrada.tamanhoElenco > 1
      ? entrada.indiceNoElenco / (entrada.tamanhoElenco - 1)
      : 0.5;
  overall += (0.45 - fracao) * 8;
  // Normalização leve por força média da liga (não exagerar)
  overall += (entrada.forcaMediaLiga - 70) * 0.05;
  overall += aleatorio.inteiro(-2, 2);
  return limitar(overall, 48, 93);
}

function per90(valor: number, minutos: number): number {
  if (minutos <= 0) return 0;
  return (valor * 90) / minutos;
}

function blend(prior: number, observado: number, pesoObs: number): number {
  const w = limitar(pesoObs, 0, 1);
  return prior * (1 - w) + observado * w;
}

function mapStatToAttr(
  prior: number,
  rate: number,
  // taxas típicas por 90 em escala 0–~3+
  refBaixa: number,
  refAlta: number,
  peso: number,
): number {
  const t = limitar((rate - refBaixa) / Math.max(0.01, refAlta - refBaixa), 0, 1);
  const observado = 40 + t * 50;
  return limitar(blend(prior, observado, peso), 1, 99);
}

function aplicarStats(
  atributos: Atributos,
  posicao: Posicao,
  stats: StatsSportmonksNormalizadas,
  peso: number,
  ligaFator: number,
): Atributos {
  const a = { ...atributos };
  const m = stats.minutes;
  const g90 = per90(stats.goals, m) * ligaFator;
  const a90 = per90(stats.assists, m) * ligaFator;
  const s90 = per90(stats.shots ?? 0, m);
  const kp90 = per90(stats.keyPasses ?? 0, m);
  const t90 = per90(stats.tackles ?? 0, m);
  const i90 = per90(stats.interceptions ?? 0, m);
  const drSucc =
    stats.dribblesAttempted && stats.dribblesAttempted > 0
      ? (stats.dribblesSuccess ?? 0) / stats.dribblesAttempted
      : 0;
  const savePct =
    stats.saves != null && stats.goalsConceded != null
      ? stats.saves / Math.max(1, stats.saves + stats.goalsConceded)
      : undefined;

  if (posicao === "GOL") {
    if (stats.saves != null)
      a.reflexos = mapStatToAttr(a.reflexos, per90(stats.saves, m), 1, 5, peso);
    if (savePct != null)
      a.defesaGoleiro = limitar(blend(a.defesaGoleiro, 35 + savePct * 55, peso), 1, 99);
    a.posicionamentoGoleiro = mapStatToAttr(
      a.posicionamentoGoleiro,
      stats.cleanSheets ?? 0,
      0,
      15,
      peso * 0.6,
    );
  } else {
    if (["CA", "PD", "PE", "MEI"].includes(posicao)) {
      a.finalizacao = mapStatToAttr(a.finalizacao, g90, 0.05, 0.7, peso);
      if (stats.xg != null)
        a.posicionamento = mapStatToAttr(a.posicionamento, per90(stats.xg, m), 0.05, 0.55, peso);
      const conv =
        (stats.shotsOnTarget ?? stats.shots ?? 0) > 0
          ? stats.goals / (stats.shotsOnTarget ?? stats.shots ?? 1)
          : 0;
      a.compostura = mapStatToAttr(a.compostura, conv, 0.05, 0.45, peso * 0.7);
    }
    if (["PD", "PE", "MEI", "CA"].includes(posicao)) {
      a.drible = mapStatToAttr(a.drible, drSucc, 0.2, 0.7, peso * 0.8);
    }
    if (["MEI", "MC", "VOL", "PD", "PE"].includes(posicao)) {
      a.visao = mapStatToAttr(a.visao, a90 + kp90 * 0.5, 0.05, 0.6, peso);
      a.passeCurto = mapStatToAttr(
        a.passeCurto,
        stats.passesAccurate && stats.passesTotal
          ? stats.passesAccurate / Math.max(1, stats.passesTotal)
          : 0.7,
        0.6,
        0.92,
        peso * 0.7,
      );
      if (stats.longBalls != null)
        a.passeLongo = mapStatToAttr(a.passeLongo, per90(stats.longBalls, m), 0.5, 4, peso * 0.5);
    }
    if (["VOL", "ZAG", "LD", "LE", "MC"].includes(posicao)) {
      a.desarme = mapStatToAttr(a.desarme, t90, 0.5, 4, peso);
      a.antecipacao = mapStatToAttr(a.antecipacao, i90, 0.3, 3, peso);
      a.marcacao = mapStatToAttr(
        a.marcacao,
        t90 + i90 + per90(stats.clearances ?? 0, m) * 0.3,
        1,
        7,
        peso,
      );
      if (stats.aerialsWon != null)
        a.cabeceio = mapStatToAttr(a.cabeceio, per90(stats.aerialsWon, m), 0.5, 4, peso * 0.6);
    }
    if (stats.assists)
      a.cruzamento = mapStatToAttr(a.cruzamento, a90, 0.02, 0.35, peso * 0.4);
  }
  if (stats.rating != null) {
    // Influência leve — NÃO mapear rating*10 → overall.
    const bump = (stats.rating - 6.8) * 1.2 * peso;
    for (const atr of LISTA_ATRIBUTOS) a[atr] = limitar(a[atr] + bump * 0.15, 1, 99);
  }
  return a;
}

function atributosEstimadosNaoObservaveis(
  a: Atributos,
  posicao: Posicao,
  idade: number,
  altura: number | null,
  seed: string,
): { attrs: Atributos; estimados: Atributo[] } {
  const rng = new GeradorAleatorio(gerarSeedNumerica(`est-${seed}`));
  const estimados: Atributo[] = [];
  const set = (atr: Atributo, valor: number) => {
    a[atr] = limitar(valor, 1, 99);
    estimados.push(atr);
  };
  // Velocidade/aceleração: heurística por posição/idade — sem falsa precisão.
  const baseVel =
    ["PD", "PE", "LD", "LE", "CA"].includes(posicao) ? 68 : posicao === "GOL" ? 48 : 58;
  const idadeVel = idade <= 24 ? 4 : idade >= 32 ? -8 : 0;
  set("velocidade", baseVel + idadeVel + rng.inteiro(-3, 3));
  set("aceleracao", baseVel + 2 + idadeVel + rng.inteiro(-3, 3));
  set(
    "forca",
    (altura && altura >= 185 ? 66 : 58) +
      (["ZAG", "CA", "VOL"].includes(posicao) ? 6 : 0) +
      rng.inteiro(-4, 4),
  );
  set("concentracao", 55 + rng.inteiro(-5, 8));
  set("agressividade", idade >= 28 ? 58 + rng.inteiro(0, 8) : 50 + rng.inteiro(-5, 8));
  return { attrs: a, estimados };
}

function potencialDe(
  overall: number,
  idade: number,
  valorMercado: number | null,
  reputacaoLiga: number,
  minutos: number,
  seed: string,
): number {
  const rng = new GeradorAleatorio(gerarSeedNumerica(`pot-${seed}`));
  if (idade >= 32) return overall;
  if (idade >= 29) return Math.min(99, overall + rng.inteiro(0, 2));
  let margem =
    idade <= 18
      ? rng.inteiro(12, 20)
      : idade <= 21
        ? rng.inteiro(8, 16)
        : idade <= 24
          ? rng.inteiro(4, 11)
          : rng.inteiro(1, 5);
  if (idade <= 22 && (valorMercado ?? 0) > 15_000_000) margem += 2;
  if (reputacaoLiga >= 90 && idade <= 21) margem += 2;
  if (minutos >= 1500 && idade <= 23) margem += 1;
  return Math.round(limitar(overall + margem, overall, 97));
}

/**
 * Rating Engine Viztto — determinístico e centralizado.
 * Stats → atributos → calcularOverall(). Nunca rating_partida * 10.
 */
export function calcularRatingViztto(entrada: EntradaRatingEngine): ResultadoRating {
  const posicao = mapearPosicaoPrincipal(entrada.posicaoBruta);
  const overallPrior = overallPriorMercado(entrada);
  let atributos = priorPosicao(posicao, overallPrior);
  const stats = entrada.stats;
  const minutos = stats?.minutes ?? 0;
  const apps = stats?.appearances ?? 0;
  const pesoStats =
    minutos <= 0
      ? 0
      : minutos < 300
        ? limitar(minutos / 2000, 0.05, 0.25)
        : limitar(minutos / CONST.minutosPlenaConfianca, 0.15, 0.92);
  // Ligas mais fracas: stats brutas valem um pouco menos na conversão
  const ligaFator = limitar(0.85 + (entrada.reputacaoLiga - 50) / 200, 0.8, 1.15);

  let source: FonteRating = "transfermarkt-estimated";
  if (stats && minutos > 0 && entrada.cobertura !== "D") {
    atributos = aplicarStats(atributos, posicao, stats, pesoStats, ligaFator);
    source = pesoStats >= 0.55 ? "sportmonks" : "hybrid";
  } else if (entrada.cobertura === "D" || !stats) {
    source = "transfermarkt-estimated";
  }

  const { attrs, estimados } = atributosEstimadosNaoObservaveis(
    atributos,
    posicao,
    entrada.idade,
    entrada.altura,
    entrada.seed,
  );
  atributos = attrs;

  let overall = calcularOverall(atributos, posicao);
  // Âncora suave no prior de mercado para evitar outliers absurdos
  overall = Math.round(limitar(blend(overallPrior, overall, stats && minutos > 300 ? 0.65 : 0.35), 48, 94));
  // Recalibra atributos levemente para coerência com overall final
  const fator = overall / Math.max(1, calcularOverall(atributos, posicao));
  if (Math.abs(fator - 1) > 0.02) {
    for (const atr of LISTA_ATRIBUTOS)
      atributos[atr] = limitar(Math.round(atributos[atr] * fator), 1, 99);
    overall = calcularOverall(atributos, posicao);
  }

  const potencial = potencialDe(
    overall,
    entrada.idade,
    entrada.valorMercado,
    entrada.reputacaoLiga,
    minutos,
    entrada.seed,
  );

  let confidence: ConfiancaRating = "low";
  if (source === "sportmonks" && minutos >= CONST.minutosAlta) confidence = "high";
  else if (
    (source === "sportmonks" || source === "hybrid") &&
    minutos >= CONST.minutosMedia
  )
    confidence = "medium";
  else if (source === "transfermarkt-estimated") confidence = "low";

  if (entrada.cobertura === "C" || entrada.cobertura === "D")
    confidence = confidence === "high" ? "medium" : "low";

  return {
    atributos,
    overall,
    potencial,
    metadata: {
      source,
      confidence,
      minutes: minutos,
      appearances: apps,
      season: entrada.seasonLabel ?? "",
      sportmonksPlayerId: entrada.sportmonksPlayerId,
      matchConfidence: entrada.matchConfidence,
      estimatedAttributes: estimados,
      coverageLevel: entrada.cobertura,
    },
  };
}

/** Aliases explícitos por métrica — sem substring genérica perigosa. */
const ALIASES_STATS: Record<
  keyof Pick<
    StatsSportmonksNormalizadas,
    | "goals"
    | "assists"
    | "shots"
    | "shotsOnTarget"
    | "keyPasses"
    | "passesAccurate"
    | "passesTotal"
    | "longBalls"
    | "dribblesAttempted"
    | "dribblesSuccess"
    | "tackles"
    | "tacklesWon"
    | "interceptions"
    | "clearances"
    | "aerialsWon"
    | "duelsWon"
    | "saves"
    | "goalsConceded"
    | "cleanSheets"
    | "rating"
    | "xg"
    | "xa"
    | "minutes"
    | "appearances"
  >,
  string[]
> = {
  goals: ["goals", "goals_total", "goal"],
  goalsConceded: ["goals_conceded", "goalsconceded", "conceded"],
  xg: ["expected_goals", "expectedgoals", "xg"],
  assists: ["assists", "assist"],
  xa: ["expected_assists", "expectedassists", "xa"],
  shots: ["shots_total", "total_shots", "shots"],
  shotsOnTarget: ["shots_on_target", "shotsontarget", "on_target"],
  keyPasses: ["key_passes", "keypasses", "key_pass"],
  passesAccurate: ["accurate_passes", "passes_accurate", "accuratepasses"],
  passesTotal: ["total_passes", "passes_total", "passes"],
  longBalls: ["long_balls", "longballs"],
  dribblesAttempted: ["dribbles_attempts", "dribble_attempts", "dribbles_attempted"],
  dribblesSuccess: ["dribbles_success", "successful_dribbles", "dribbles_succeeded"],
  tackles: ["tackles", "tackles_total"],
  tacklesWon: ["tackles_won", "won_tackles", "tackleswon"],
  interceptions: ["interceptions", "interception"],
  clearances: ["clearances", "clearance"],
  aerialsWon: ["aerials_won", "aerial_won", "aerialswon"],
  duelsWon: ["duels_won", "duelswon"],
  saves: ["saves", "goalkeeper_saves", "gk_saves"],
  cleanSheets: ["clean_sheets", "cleansheets", "clean_sheet"],
  rating: ["rating", "average_rating"],
  minutes: ["minutes_played", "minutes"],
  appearances: ["appearances", "apps", "matches_played"],
};

function tokenizarTipo(d: {
  type_id?: number;
  type?: { code?: string; name?: string; developer_name?: string };
}): { developer: string; code: string; name: string } {
  return {
    developer: (d.type?.developer_name ?? "").toLowerCase().trim(),
    code: (d.type?.code ?? "").toLowerCase().trim(),
    name: (d.type?.name ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
  };
}

function valorDetail(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "total" in (v as object)) {
    const n = Number((v as { total: number }).total);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "string" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

/**
 * Resolve uma métrica de forma determinística:
 * 1) developer_name exato 2) code exato 3) alias 4) name normalizado exato.
 * Nunca usa includes genérico (evita goal ⊂ goals_conceded).
 */
export function resolverStatDetail(
  details: Array<{
    type_id?: number;
    value?: unknown;
    type?: { code?: string; name?: string; developer_name?: string };
  }>,
  aliases: string[],
): number | undefined {
  const wanted = new Set(aliases.map((a) => a.toLowerCase()));
  // Pass 1: developer_name
  for (const d of details) {
    const t = tokenizarTipo(d);
    if (t.developer && wanted.has(t.developer)) return valorDetail(d.value);
  }
  // Pass 2: code
  for (const d of details) {
    const t = tokenizarTipo(d);
    if (t.code && wanted.has(t.code)) return valorDetail(d.value);
  }
  // Pass 3–4: name normalizado / alias
  for (const d of details) {
    const t = tokenizarTipo(d);
    if (t.name && wanted.has(t.name)) return valorDetail(d.value);
  }
  return undefined;
}

/** Extrai stats conhecidas de details Sportmonks (ordem-independente). */
export function normalizarDetailsSportmonks(
  details:
    | Array<{
        type_id?: number;
        value?: unknown;
        type?: { code?: string; name?: string; developer_name?: string };
      }>
    | undefined,
  appearances = 0,
  minutes = 0,
): StatsSportmonksNormalizadas {
  const stats: StatsSportmonksNormalizadas = {
    appearances,
    minutes,
    goals: 0,
    assists: 0,
  };
  if (!details?.length) return stats;
  const get = (key: keyof typeof ALIASES_STATS) =>
    resolverStatDetail(details, ALIASES_STATS[key]);

  stats.goals = get("goals") ?? 0;
  stats.assists = get("assists") ?? 0;
  stats.shots = get("shots");
  stats.shotsOnTarget = get("shotsOnTarget");
  stats.keyPasses = get("keyPasses");
  stats.passesAccurate = get("passesAccurate");
  stats.passesTotal = get("passesTotal");
  stats.longBalls = get("longBalls");
  stats.dribblesAttempted = get("dribblesAttempted");
  stats.dribblesSuccess = get("dribblesSuccess");
  stats.tackles = get("tackles");
  stats.tacklesWon = get("tacklesWon");
  stats.interceptions = get("interceptions");
  stats.clearances = get("clearances");
  stats.aerialsWon = get("aerialsWon");
  stats.duelsWon = get("duelsWon");
  stats.saves = get("saves");
  stats.goalsConceded = get("goalsConceded");
  stats.cleanSheets = get("cleanSheets");
  stats.rating = get("rating");
  stats.xg = get("xg");
  stats.xa = get("xa");
  const mins = get("minutes");
  if (mins != null) stats.minutes = mins;
  const apps = get("appearances");
  if (apps != null) stats.appearances = apps;
  return stats;
}
