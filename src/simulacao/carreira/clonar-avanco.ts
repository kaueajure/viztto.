import type {
  Clube,
  EstadoCarreira,
  JogadorMundo,
  Lesao,
} from "@/dominio/entidades/modelos";

/**
 * Clone estrutural rápido de NPC — evita structuredClone (nativo é lento em
 * árvores com milhares de jogadores). Cobre todos os campos mutáveis na
 * simulação semanal.
 */
export function clonarJogadorMundo(j: JogadorMundo): JogadorMundo {
  return {
    ...j,
    nacionalidade: j.nacionalidade.slice(),
    posicoesSecundarias: j.posicoesSecundarias.slice(),
    atributos: j.atributos ? { ...j.atributos } : j.atributos,
    ratingMetadata: j.ratingMetadata
      ? {
          ...j.ratingMetadata,
          sources: j.ratingMetadata.sources?.map((s) => ({
            ...s,
            matchedBy: s.matchedBy?.slice(),
          })),
          estimatedAttributes: j.ratingMetadata.estimatedAttributes?.slice(),
        }
      : j.ratingMetadata,
    lesao: j.lesao ? clonarLesao(j.lesao) : null,
    estatisticasCarreira: { ...j.estatisticasCarreira },
  };
}

function clonarLesao(l: Lesao): Lesao {
  return { ...l };
}

export function clonarClube(c: Clube): Clube {
  return {
    ...c,
    titularesIds: c.titularesIds.slice(),
    bancoIds: c.bancoIds.slice(),
    treinador: { ...c.treinador },
    elenco: c.elenco.map(clonarJogadorMundo),
    // dadosBrutos é somente leitura após a criação da carreira.
    dadosBrutos: c.dadosBrutos,
  };
}

/**
 * Clona o estado para avanço semanal sem copiar elenco de ligas externas nem
 * calendários externos (compartilhados até materializar em finalizarSemana).
 *
 * Preserva a ordem original de `estado.clubes` (crítica para mercado NPC / RNG
 * quando o jogador muda de liga).
 */
export function clonarCarreiraParaAvanco(estado: EstadoCarreira): EstadoCarreira {
  const ligaId = estado.liga.id;
  const clubes = estado.clubes.map((c) =>
    c.ligaId === ligaId ? clonarClube(c) : c,
  );

  const {
    clubes: _c,
    temporadasExternas: _te,
    ...resto
  } = estado;

  const carreira = structuredClone(resto) as EstadoCarreira;
  carreira.clubes = clubes;
  // Compartilhado até materializarClubesExternos / materializarTemporadasExternas.
  carreira.temporadasExternas = estado.temporadasExternas;
  return carreira;
}

/** Deep-clone dos clubes fora da liga atual antes de mutação. */
export function materializarClubesExternos(carreira: EstadoCarreira): void {
  const ligaId = carreira.liga.id;
  for (let i = 0; i < carreira.clubes.length; i++) {
    const c = carreira.clubes[i]!;
    if (c.ligaId === ligaId) continue;
    carreira.clubes[i] = clonarClube(c);
  }
}

/** Clone das temporadas externas antes de avançar rodadas/classificações. */
export function materializarTemporadasExternas(carreira: EstadoCarreira): void {
  carreira.temporadasExternas = structuredClone(carreira.temporadasExternas);
}
