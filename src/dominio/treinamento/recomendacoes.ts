import type { Atributo, Posicao } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import type { ObjetivoPessoalTipo } from "@/dominio/desenvolvimento";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";
import {
  exerciciosRecomendados,
  exerciciosVisiveisPara,
  type ExercicioTreino,
} from "./exercicios";

/** Sugestões curtas do treinador com base em posição + atributos fracos + objetivo. */
export function recomendacaoTreinador(
  posicao: Posicao,
  atributos: Record<Atributo, number>,
  objetivo?: ObjetivoPessoalTipo | null,
): { texto: string; exercicios: ExercicioTreino[] } {
  const pesos = PESOS_POSICOES[posicao];
  const relevantes = (Object.entries(pesos) as [Atributo, number][])
    .sort((a, b) => b[1] - a[1] || atributos[a[0]] - atributos[b[0]])
    .slice(0, 6);

  let maisFraco = [...relevantes].sort(
    (a, b) => atributos[a[0]] - atributos[b[0]],
  )[0]?.[0];

  // Objetivo pessoal enviesa o foco dos exercícios (mesmos pesos da posição).
  if (objetivo === "tecnica" || objetivo === "titular") {
    const alvo = relevantes.sort(
      (a, b) => atributos[a[0]] - atributos[b[0]],
    )[0]?.[0];
    if (alvo) maisFraco = alvo;
  }

  const base = exerciciosRecomendados(posicao);
  const visiveis = exerciciosVisiveisPara(posicao);
  const focados = maisFraco
    ? visiveis.filter(
        (e) =>
          e.primario === maisFraco ||
          e.secundarios.includes(maisFraco) ||
          e.terciarios?.includes(maisFraco),
      )
    : [];

  const lista = (focados.length ? focados : base).slice(0, 3);
  const texto =
    objetivo === "titular"
      ? `Com o foco em titularidade, priorize ${maisFraco ? NOMES_ATRIBUTOS[maisFraco].toLowerCase() : "os fundamentos"} nesta semana.`
      : objetivo === "tecnica"
        ? `Seu objetivo técnico aponta para ${maisFraco ? NOMES_ATRIBUTOS[maisFraco].toLowerCase() : "os fundamentos"}.`
        : maisFraco
          ? `Seu ${NOMES_ATRIBUTOS[maisFraco].toLowerCase()} pede atenção nesta semana.`
          : "Foque nos fundamentos da sua posição.";

  return { texto, exercicios: lista.length ? lista : base.slice(0, 3) };
}
