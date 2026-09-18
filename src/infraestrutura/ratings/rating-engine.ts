import type { Atributo, Atributos, Posicao } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import {
  calcularOverall,
  criarAtributosUniformes,
} from "@/dominio/regras/jogador";
import {
  overallAlvoDeMercado,
  potencialDe,
} from "@/dominio/regras/rating-mercado";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
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
export {
  ovrDeValorMercado,
  overallAlvoDeMercado,
  potencialDe,
} from "@/dominio/regras/rating-mercado";

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
  /** Estatísticas reais opcionais (minutos/gols) — só ajustam se presentes. */
  minutosTemporada?: number | null;
  golsTemporada?: number | null;
  assistenciasTemporada?: number | null;
}

export interface ResultadoRating {
  atributos: Atributos;
  overall: number;
  potencial: number;
  metadata: RatingMetadata;
}

function priorPosicao(posicao: Posicao, overallAlvo: number): Atributos {
  const base = criarAtributosUniformes(Math.round(overallAlvo * 0.9));
  const boosts: Partial<Record<Posicao, Partial<Record<Atributo, number>>>> = {
    GOL: {
      reflexos: 10,
      defesaGoleiro: 10,
      posicionamentoGoleiro: 8,
      saida: 5,
      reposicao: 4,
      concentracao: 4,
    },
    CA: {
      finalizacao: 10,
      compostura: 6,
      posicionamento: 7,
      cabeceio: 5,
      forca: 3,
    },
    PD: {
      drible: 8,
      velocidade: 7,
      aceleracao: 6,
      dominio: 5,
      cruzamento: 5,
      finalizacao: 3,
    },
    PE: {
      drible: 8,
      velocidade: 7,
      aceleracao: 6,
      dominio: 5,
      cruzamento: 5,
      finalizacao: 3,
    },
    MEI: {
      visao: 8,
      passeCurto: 7,
      dominio: 6,
      passeLongo: 5,
      finalizacao: 3,
    },
    MC: {
      passeCurto: 7,
      visao: 5,
      dominio: 6,
      resistencia: 5,
      antecipacao: 3,
    },
    VOL: {
      marcacao: 7,
      desarme: 7,
      antecipacao: 6,
      passeCurto: 4,
      forca: 4,
      resistencia: 3,
    },
    ZAG: {
      marcacao: 8,
      desarme: 6,
      antecipacao: 6,
      cabeceio: 6,
      forca: 5,
    },
    LD: {
      velocidade: 6,
      resistencia: 5,
      cruzamento: 6,
      marcacao: 4,
      aceleracao: 4,
    },
    LE: {
      velocidade: 6,
      resistencia: 5,
      cruzamento: 6,
      marcacao: 4,
      aceleracao: 4,
    },
  };
  for (const [atr, delta] of Object.entries(boosts[posicao] ?? {}) as [
    Atributo,
    number,
  ][]) {
    base[atr] = limitar(base[atr] + delta, 1, 99);
  }
  return base;
}

function aplicarHeuristicasFisicas(
  a: Atributos,
  posicao: Posicao,
  idade: number,
  altura: number | null,
): Atributos {
  const out = { ...a };
  const baseVel = ["PD", "PE", "LD", "LE", "CA"].includes(posicao)
    ? 70
    : posicao === "GOL"
      ? 48
      : 60;
  const idadeVel = idade <= 24 ? 3 : idade >= 32 ? -7 : 0;
  out.velocidade = limitar(baseVel + idadeVel, 1, 99);
  out.aceleracao = limitar(baseVel + 2 + idadeVel, 1, 99);
  out.forca = limitar(
    (altura && altura >= 185 ? 68 : 58) +
      (["ZAG", "CA", "VOL"].includes(posicao) ? 6 : 0),
    1,
    99,
  );
  out.concentracao = limitar(56 + (idade >= 28 ? 4 : 0), 1, 99);
  out.agressividade = limitar(idade >= 28 ? 60 : 52, 1, 99);
  return out;
}

/** Escala atributos até `calcularOverall` bater o OVR alvo (±1). */
export function calibrarAtributosParaOverall(
  attrs: Atributos,
  posicao: Posicao,
  overallAlvo: number,
): Atributos {
  const a = { ...attrs };
  for (let i = 0; i < 8; i++) {
    const atual = calcularOverall(a, posicao);
    if (Math.abs(atual - overallAlvo) <= 1) break;
    const fator = overallAlvo / Math.max(1, atual);
    for (const atr of LISTA_ATRIBUTOS) {
      a[atr] = limitar(Math.round(a[atr] * fator), 1, 99);
    }
  }
  let atual = calcularOverall(a, posicao);
  if (atual !== overallAlvo) {
    const delta = overallAlvo - atual;
    const chave = LISTA_ATRIBUTOS[0]!;
    a[chave] = limitar(a[chave] + delta * 2, 1, 99);
    atual = calcularOverall(a, posicao);
    if (Math.abs(atual - overallAlvo) > 0) {
      const f = overallAlvo / Math.max(1, atual);
      for (const atr of LISTA_ATRIBUTOS)
        a[atr] = limitar(Math.round(a[atr] * f), 1, 99);
    }
  }
  return a;
}

/**
 * Rating Engine Viztto v2 — âncora em valor de mercado real.
 * Dados do jogador → OVR → atributos → (depois) força do clube.
 */
export function calcularRatingViztto(
  entrada: EntradaRatingEngine,
): ResultadoRating {
  const posicao = mapearPosicaoPrincipal(entrada.posicaoBruta);
  const overallAlvo = overallAlvoDeMercado({
    posicao,
    idade: entrada.idade,
    valorMercado: entrada.valorMercado,
    reputacaoLiga: entrada.reputacaoLiga,
    indiceNoElenco: entrada.indiceNoElenco,
    tamanhoElenco: entrada.tamanhoElenco,
    minutosTemporada: entrada.minutosTemporada,
    golsTemporada: entrada.golsTemporada,
    assistenciasTemporada: entrada.assistenciasTemporada,
  });
  let atributos = priorPosicao(posicao, overallAlvo);
  atributos = aplicarHeuristicasFisicas(
    atributos,
    posicao,
    entrada.idade,
    entrada.altura,
  );
  atributos = calibrarAtributosParaOverall(atributos, posicao, overallAlvo);
  let overallFinal = limitar(calcularOverall(atributos, posicao), 45, 94);
  if (Math.abs(overallFinal - overallAlvo) > 1) {
    atributos = calibrarAtributosParaOverall(atributos, posicao, overallAlvo);
    overallFinal = limitar(calcularOverall(atributos, posicao), 45, 94);
  }
  const potencial = potencialDe(
    overallFinal,
    entrada.idade,
    entrada.valorMercado,
  );

  return {
    atributos,
    overall: overallFinal,
    potencial,
    metadata: {
      source: "transfermarkt-estimated",
      confidence: "low",
      estimatedAttributes: LISTA_ATRIBUTOS,
      calibrationVersion: "engine-v2-market",
    },
  };
}
