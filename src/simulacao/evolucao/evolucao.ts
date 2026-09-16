import type { Atributo, Jogador, Clube } from "@/dominio/entidades/modelos";
import { calcularOverall } from "@/dominio/regras/jogador";
import { limitar } from "@/utilitarios/formatacao";
export function calcularEvolucao(
  jogador: Jogador,
  atributos: Atributo[],
  pontos: number,
  clube: Clube,
): number {
  const curvaIdade =
    jogador.idade < 19
      ? 1.5
      : jogador.idade < 24
        ? 1.15
        : jogador.idade < 29
          ? 0.55
          : 0.18;
  const margem = limitar(
    (jogador.potencialInterno - jogador.overall) / 18,
    0,
    1,
  );
  const contexto =
    (0.55 + jogador.personalidade.profissionalismo / 140) *
    (0.7 + jogador.moral / 200) *
    (jogador.lesao ? 0.3 : 1) *
    (0.65 +
      (jogador.categoria === "base" ? clube.qualidadeBase : clube.forcaGeral) /
        180);
  const ganho = pontos * curvaIdade * margem * contexto;
  for (const atributo of atributos) {
    jogador.desenvolvimento[atributo] += ganho;
    while (
      jogador.desenvolvimento[atributo] >= 100 &&
      jogador.atributos[atributo] < 99
    ) {
      jogador.atributos[atributo]++;
      jogador.desenvolvimento[atributo] -= 100;
    }
  }
  jogador.overall = calcularOverall(jogador.atributos, jogador.posicao);
  return Math.round(ganho * atributos.length);
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
