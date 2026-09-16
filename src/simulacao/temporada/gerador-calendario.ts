import type {
  Categoria,
  Partida,
  Temporada,
  Clube,
} from "@/dominio/entidades/modelos";
import { somarDias } from "@/utilitarios/formatacao";
import { calcularClassificacao } from "./classificacao";
export function gerarCalendarioLiga(
  ids: string[],
  inicio: string,
  categoria: Categoria = "profissional",
): Partida[] {
  if (ids.length < 2 || new Set(ids).size !== ids.length)
    throw new Error(
      "O calendário precisa de pelo menos dois clubes distintos.",
    );
  const ordem: (string | null)[] = [...ids];
  if (ordem.length % 2) ordem.push(null);
  const partidas: Partida[] = [],
    rodadas = ordem.length - 1;
  for (let rodada = 0; rodada < rodadas; rodada++) {
    for (let indice = 0; indice < ordem.length / 2; indice++) {
      const primeiro = ordem[indice],
        segundo = ordem[ordem.length - 1 - indice];
      if (!primeiro || !segundo) continue;
      const [mandante, visitante] =
        (rodada + indice) % 2 ? [segundo, primeiro] : [primeiro, segundo];
      for (let turno = 0; turno < 2; turno++) {
        const numero = rodada + turno * rodadas + 1;
        partidas.push({
          id: `${inicio}-${categoria}-${numero}-${indice}`,
          rodada: numero,
          data: somarDias(inicio, numero * 7),
          mandanteId: turno ? visitante : mandante,
          visitanteId: turno ? mandante : visitante,
          categoria,
          golsMandante: null,
          golsVisitante: null,
          eventos: [],
          participacao: null,
        });
      }
    }
    ordem.splice(1, 0, ordem.pop()!);
  }
  return partidas.sort((a, b) => a.rodada - b.rodada);
}
export function criarTemporada(
  clubes: Clube[],
  ano: number,
  inicio: string,
): Temporada {
  const ids = clubes.map((clube) => clube.id),
    partidas = gerarCalendarioLiga(ids, inicio);
  return {
    ano,
    rodadaAtual: 0,
    totalRodadas: Math.max(...partidas.map((p) => p.rodada)),
    partidas,
    partidasBase: gerarCalendarioLiga(ids, inicio, "base"),
    classificacao: calcularClassificacao(ids, []),
    classificacaoBase: calcularClassificacao(ids, []),
    encerrada: false,
  };
}
