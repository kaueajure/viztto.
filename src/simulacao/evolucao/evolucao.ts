import { afinidadeHistoria } from "@/dominio/historia-formacao";
import type { Atributo, Jogador, Clube } from "@/dominio/entidades/modelos";
import { calcularOverall } from "@/dominio/regras/jogador";
import {
  eficienciaIdade,
  fatorPotencial,
  rendimentoAtributo,
} from "@/dominio/treinamento/progresso";
import { limitar } from "@/utilitarios/formatacao";

/**
 * Evolução genérica (partidas / legado).
 * Potencial é soft — não bloqueia o level-up em 99.
 */
export function calcularEvolucao(
  jogador: Jogador,
  atributos: Atributo[],
  pontos: number,
  clube: Clube | null,
): number {
  const pot = fatorPotencial(jogador.overall, jogador.potencialInterno);
  const nivelClube = clube
    ? jogador.categoria === "base"
      ? clube.qualidadeBase
      : clube.forcaGeral
    : 48;
  const eficienciaSemClube = clube ? 1 : 0.55;
  const contexto =
    (0.55 + jogador.personalidade.profissionalismo / 140) *
    (0.7 + jogador.moral / 200) *
    (jogador.lesao ? 0.3 : 1) *
    (0.65 + nivelClube / 180) *
    eficienciaSemClube *
    pot;

  let total = 0;
  for (const atributo of atributos) {
    const idade = eficienciaIdade(jogador.idade, atributo);
    const rendimento = rendimentoAtributo(jogador.atributos[atributo]);
    const ganho =
      pontos *
      idade *
      contexto *
      rendimento *
      afinidadeHistoria(jogador.perfilFormacao, atributo, jogador.idade);
    total += ganho;
    if (jogador.atributos[atributo] >= 99) {
      jogador.desenvolvimento[atributo] = 0;
      continue;
    }
    jogador.desenvolvimento[atributo] += ganho;
    while (
      jogador.desenvolvimento[atributo] >= 100 &&
      jogador.atributos[atributo] < 99
    ) {
      jogador.atributos[atributo]++;
      jogador.desenvolvimento[atributo] -= 100;
    }
    if (jogador.atributos[atributo] >= 99) {
      jogador.atributos[atributo] = 99;
      jogador.desenvolvimento[atributo] = 0;
    }
  }
  jogador.overall = calcularOverall(jogador.atributos, jogador.posicao);
  return Math.round(total);
}

export function aplicarDeclinio(jogador: Jogador): void {
  for (const atributo of [
    "velocidade",
    "aceleracao",
    "agilidade",
    "resistencia",
    "forca",
    "visao",
    "passeCurto",
  ] as Atributo[]) {
    const idadeInicio = ["visao", "passeCurto"].includes(atributo)
      ? 36
      : atributo === "forca"
        ? 34
        : 30;
    if (jogador.idade > idadeInicio)
      jogador.atributos[atributo] = limitar(
        jogador.atributos[atributo] - (jogador.idade - idadeInicio) * 0.035,
        1,
        99,
      );
  }
  jogador.overall = calcularOverall(jogador.atributos, jogador.posicao);
}
