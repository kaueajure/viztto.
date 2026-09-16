/** Edições de início do jogo, independentes do ano do relógio e de seasons.current. */
export const TEMPORADAS_INICIAIS: Record<
  string,
  { ano: number; inicio: string }
> = {
  brasileirao: { ano: 2026, inicio: "2026-01-28" },
  "premier-league": { ano: 2025, inicio: "2025-08-15" },
  "la-liga": { ano: 2025, inicio: "2025-08-15" },
  "serie-a": { ano: 2025, inicio: "2025-08-23" },
  bundesliga: { ano: 2025, inicio: "2025-08-22" },
  "ligue-1": { ano: 2025, inicio: "2025-08-15" },
};
export function formatarTemporada(ligaId: string, ano: number): string {
  return ligaId === "brasileirao" ? String(ano) : `${ano}/${ano + 1}`;
}
