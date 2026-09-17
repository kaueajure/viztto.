/**
 * Metadata de ratings anterior à Fase 11, necessária para interpretar saves
 * antigos. A migração ocorre somente em memória: nada é recalculado ou
 * reescrito. O histórico da migração está em `docs/migrations/`.
 */
export const RATING_METADATA_LEGADO = {
  fontes: { sportmonks: "external", hybrid: "external" },
  campoIdExterno: "sportmonksPlayerId",
  provider: "sportmonks",
} as const;
