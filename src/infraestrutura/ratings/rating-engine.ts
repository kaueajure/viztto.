import type { Atributo, Atributos, Posicao } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import {
  calcularOverall,
  criarAtributosUniformes,
} from "@/dominio/regras/jogador";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import type {
  ConfiancaRating,
  FonteRating,
  RatingMetadata,
} from "@/dominio/rating-metadata";

export type { ConfiancaRating, FonteRating, RatingMetadata };
export {
  esquemaRatingMetadata,
  normalizarRatingMetadata,
} from "@/dominio/rating-metadata";

const LISTA_ATRIBUTOS = Object.keys(NOMES_ATRIBUTOS) as Atributo[];

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
}

export interface ResultadoRating {
  atributos: Atributos;
  overall: number;
  potencial: number;
  metadata: RatingMetadata;
}

function priorPosicao(posicao: Posicao, overallAlvo: number): Atributos {
  const base = criarAtributosUniformes(Math.round(overallAlvo * 0.92));
  const boosts: Partial<Record<Posicao, Partial<Record<Atributo, number>>>> = {
    GOL: {
      reflexos: 8,
      defesaGoleiro: 8,
      posicionamentoGoleiro: 6,
      saida: 4,
      reposicao: 3,
    },
    CA: { finalizacao: 8, compostura: 5, posicionamento: 6, cabeceio: 4 },
    PD: {
      drible: 7,
      velocidade: 6,
      aceleracao: 5,
      cruzamento: 4,
      finalizacao: 3,
    },
    PE: {
      drible: 7,
      velocidade: 6,
      aceleracao: 5,
      cruzamento: 4,
      finalizacao: 3,
    },
    MEI: { visao: 7, passeCurto: 6, passeLongo: 4, dominio: 5, finalizacao: 3 },
    MC: { passeCurto: 6, dominio: 5, visao: 4, resistencia: 4, marcacao: 2 },
    VOL: { marcacao: 6, desarme: 6, antecipacao: 5, passeCurto: 3, forca: 3 },
    ZAG: { marcacao: 7, desarme: 5, antecipacao: 5, cabeceio: 5, forca: 4 },
    LD: { cruzamento: 5, velocidade: 5, resistencia: 4, marcacao: 3 },
    LE: { cruzamento: 5, velocidade: 5, resistencia: 4, marcacao: 3 },
  };
  for (const [atr, delta] of Object.entries(boosts[posicao] ?? {}) as [
    Atributo,
    number,
  ][]) {
    base[atr] = limitar(base[atr] + delta, 1, 99);
  }
  return base;
}

function overallPriorMercado(entrada: EntradaRatingEngine): number {
  const aleatorio = new GeradorAleatorio(
    gerarSeedNumerica(`ov-${entrada.seed}`),
  );
  const valor = Math.max(0, entrada.valorMercado ?? 0);
  const logValor =
    valor > 0 ? Math.log10(valor + 1) : 4.6 + aleatorio.proximo() * 0.5; // sem MV: prior baixo (~40–50k), não mid-tier
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

function blend(prior: number, observado: number, peso: number): number {
  return prior * (1 - peso) + observado * peso;
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
  const baseVel = ["PD", "PE", "LD", "LE", "CA"].includes(posicao)
    ? 68
    : posicao === "GOL"
      ? 48
      : 58;
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
  set(
    "agressividade",
    idade >= 28 ? 58 + rng.inteiro(0, 8) : 50 + rng.inteiro(-5, 8),
  );
  return { attrs: a, estimados };
}

function potencialDe(
  overall: number,
  idade: number,
  valorMercado: number | null,
  reputacaoLiga: number,
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
  return Math.round(limitar(overall + margem, overall, 97));
}

/**
 * Rating Engine Viztto — determinístico e centralizado.
 * Prior canônico → atributos → calcularOverall(). Fallback sem dependência externa.
 */
export function calcularRatingViztto(
  entrada: EntradaRatingEngine,
): ResultadoRating {
  const posicao = mapearPosicaoPrincipal(entrada.posicaoBruta);
  const overallPrior = overallPriorMercado(entrada);
  let atributos = priorPosicao(posicao, overallPrior);
  const { attrs } = atributosEstimadosNaoObservaveis(
    atributos,
    posicao,
    entrada.idade,
    entrada.altura,
    entrada.seed,
  );
  atributos = attrs;

  let overall = calcularOverall(atributos, posicao);
  // Âncora suave no prior de mercado para evitar outliers absurdos
  overall = Math.round(limitar(blend(overallPrior, overall, 0.35), 48, 94));
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
    entrada.seed,
  );

  return {
    atributos,
    overall,
    potencial,
    metadata: {
      source: "transfermarkt-estimated",
      confidence: "low",
      estimatedAttributes: LISTA_ATRIBUTOS,
      calibrationVersion: "engine-v1",
    },
  };
}
