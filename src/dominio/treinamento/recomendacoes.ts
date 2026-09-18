import type { Atributo, Posicao } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";
import {
  exerciciosRecomendados,
  exerciciosVisiveisPara,
  type ExercicioTreino,
} from "./exercicios";

/** Sugestões curtas do treinador com base em posição + atributos fracos relevantes. */
export function recomendacaoTreinador(
  posicao: Posicao,
  atributos: Record<Atributo, number>,
): { texto: string; exercicios: ExercicioTreino[] } {
  const pesos = PESOS_POSICOES[posicao];
  const relevantes = (Object.entries(pesos) as [Atributo, number][])
    .sort((a, b) => b[1] - a[1] || atributos[a[0]] - atributos[b[0]])
    .slice(0, 6);

  const maisFraco = [...relevantes].sort(
    (a, b) => atributos[a[0]] - atributos[b[0]],
  )[0]?.[0];

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
  const texto = maisFraco
    ? `Seu ${NOMES_ATRIBUTOS[maisFraco].toLowerCase()} pede atenção nesta semana.`
    : "Foque nos fundamentos da sua posição.";

  return { texto, exercicios: lista.length ? lista : base.slice(0, 3) };
}
