import type { Posicao } from "@/dominio/entidades/modelos";
import { limitar } from "@/utilitarios/formatacao";

/** Âncoras valor de mercado (€) → OVR base (interpolação log). */
const ANCORAS_MERCADO: readonly [number, number][] = [
  [50_000, 50],
  [100_000, 53],
  [250_000, 57],
  [500_000, 60],
  [1_000_000, 63],
  [2_000_000, 66],
  [5_000_000, 70],
  [10_000_000, 74],
  [20_000_000, 78],
  [40_000_000, 82],
  [70_000_000, 85],
  [100_000_000, 88],
  [150_000_000, 91],
  [200_000_000, 93],
];

export interface EntradaOvrMercado {
  posicao: Posicao;
  idade: number;
  valorMercado: number | null;
  reputacaoLiga: number;
  indiceNoElenco: number;
  tamanhoElenco: number;
  minutosTemporada?: number | null;
  golsTemporada?: number | null;
  assistenciasTemporada?: number | null;
}

/** OVR âncora contínuo a partir do valor de mercado (determinístico). */
export function ovrDeValorMercado(valorMercado: number | null): number {
  const valor = Math.max(0, valorMercado ?? 0);
  if (valor <= 0) return 48;
  if (valor < ANCORAS_MERCADO[0]![0]) {
    const t = Math.log(Math.max(1, valor) / 10_000) / Math.log(50_000 / 10_000);
    return limitar(45 + t * 5, 45, 50);
  }
  for (let i = 0; i < ANCORAS_MERCADO.length - 1; i++) {
    const [v0, o0] = ANCORAS_MERCADO[i]!;
    const [v1, o1] = ANCORAS_MERCADO[i + 1]!;
    if (valor <= v1) {
      const t =
        (Math.log(valor) - Math.log(v0)) / (Math.log(v1) - Math.log(v0));
      return o0 + t * (o1 - o0);
    }
  }
  const extra = Math.log10(valor / 150_000_000) * 2.2;
  return limitar(91 + extra, 91, 93);
}

function ajusteIdade(idade: number): number {
  if (idade <= 18) return -4;
  if (idade <= 20) return -3;
  if (idade <= 22) return -1;
  if (idade <= 28) return 0;
  if (idade <= 31) return 1;
  if (idade <= 34) return 1.5;
  return 2;
}

/** Liga só como correção pequena (±2). */
function ajusteLiga(reputacaoLiga: number): number {
  return limitar((reputacaoLiga - 78) * 0.1, -2, 2);
}

function ajustePosicao(posicao: Posicao): number {
  if (posicao === "GOL") return 1.5;
  if (posicao === "ZAG") return 1;
  if (posicao === "LD" || posicao === "LE") return 0.5;
  if (posicao === "VOL") return 0.5;
  return 0;
}

function ajusteImportanciaElenco(
  indiceNoElenco: number,
  tamanhoElenco: number,
): number {
  if (tamanhoElenco <= 1) return 0;
  if (indiceNoElenco <= 2) return 1.5;
  const fracao = indiceNoElenco / (tamanhoElenco - 1);
  if (fracao <= 0.3) return 0.5;
  if (fracao >= 0.7) return -1.2;
  return 0;
}

function ajustePerformance(entrada: EntradaOvrMercado): number {
  const minutos = entrada.minutosTemporada;
  if (minutos == null || !Number.isFinite(minutos) || minutos < 200) return 0;
  const gols = entrada.golsTemporada ?? 0;
  const ast = entrada.assistenciasTemporada ?? 0;
  const por90 = ((gols + ast * 0.7) / minutos) * 90;
  let adj = 0;
  if (minutos >= 2000) adj += 0.8;
  else if (minutos >= 900) adj += 0.3;
  if (por90 >= 0.55) adj += 1.2;
  else if (por90 >= 0.35) adj += 0.6;
  else if (por90 < 0.08 && minutos >= 1200) adj -= 0.8;
  return limitar(adj, -2.5, 2.5);
}

/**
 * OVR alvo a partir de dados reais — sem RNG, sem circularidade com força do clube.
 */
export function overallAlvoDeMercado(entrada: EntradaOvrMercado): number {
  const overall =
    ovrDeValorMercado(entrada.valorMercado) +
    ajusteIdade(entrada.idade) +
    ajusteLiga(entrada.reputacaoLiga) +
    ajustePosicao(entrada.posicao) +
    ajusteImportanciaElenco(entrada.indiceNoElenco, entrada.tamanhoElenco) +
    ajustePerformance(entrada);
  return Math.round(limitar(overall, 45, 94));
}

export function potencialDe(
  overall: number,
  idade: number,
  valorMercado: number | null,
): number {
  if (idade >= 30) return overall;
  let margemMin = 0;
  let margemMax = 0;
  if (idade <= 18) {
    margemMin = 8;
    margemMax = 18;
  } else if (idade <= 21) {
    margemMin = 5;
    margemMax = 14;
  } else if (idade <= 23) {
    margemMin = 3;
    margemMax = 9;
  } else if (idade <= 26) {
    margemMin = 1;
    margemMax = 5;
  } else if (idade <= 29) {
    margemMin = 0;
    margemMax = 2;
  }
  let margem = (margemMin + margemMax) / 2;
  const valor = valorMercado ?? 0;
  if (idade <= 20 && valor >= 40_000_000) margem += 3;
  else if (idade <= 22 && valor >= 20_000_000) margem += 2;
  else if (idade <= 23 && valor >= 10_000_000) margem += 1;
  return Math.round(limitar(overall + margem, overall, 97));
}
