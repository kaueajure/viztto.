import type { LinhaClassificacao, Partida } from "@/dominio/entidades/modelos";
export function calcularClassificacao(
  ids: string[],
  partidas: Partida[],
  pontosVitoria = 3,
  pontosEmpate = 1,
): LinhaClassificacao[] {
  const linhas = new Map(
    ids.map((clubeId) => [
      clubeId,
      {
        clubeId,
        jogos: 0,
        pontos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldo: 0,
        posicao: 0,
      },
    ]),
  );
  for (const partida of partidas) {
    if (partida.golsMandante === null || partida.golsVisitante === null)
      continue;
    const mandante = linhas.get(partida.mandanteId)!,
      visitante = linhas.get(partida.visitanteId)!;
    for (const [linha, gols, sofridos] of [
      [mandante, partida.golsMandante, partida.golsVisitante],
      [visitante, partida.golsVisitante, partida.golsMandante],
    ] as const) {
      linha.jogos++;
      linha.golsPro += gols;
      linha.golsContra += sofridos;
      linha.saldo = linha.golsPro - linha.golsContra;
      if (gols > sofridos) {
        linha.vitorias++;
        linha.pontos += pontosVitoria;
      } else if (gols === sofridos) {
        linha.empates++;
        linha.pontos += pontosEmpate;
      } else linha.derrotas++;
    }
  }
  return [...linhas.values()]
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.vitorias - a.vitorias ||
        b.saldo - a.saldo ||
        b.golsPro - a.golsPro ||
        a.clubeId.localeCompare(b.clubeId),
    )
    .map((linha, indice) => ({ ...linha, posicao: indice + 1 }));
}
