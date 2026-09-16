/** Edições de início do jogo (bootstrap Transfermarkt 2026 / 2026-27). */
export const TEMPORADAS_INICIAIS: Record<
  string,
  { ano: number; inicio: string }
> = {
  brasileirao: { ano: 2026, inicio: "2026-01-28" },
  "brasileirao-b": { ano: 2026, inicio: "2026-04-10" },
  "premier-league": { ano: 2026, inicio: "2026-08-14" },
  "la-liga": { ano: 2026, inicio: "2026-08-14" },
  "serie-a": { ano: 2026, inicio: "2026-08-22" },
  bundesliga: { ano: 2026, inicio: "2026-08-21" },
  "ligue-1": { ano: 2026, inicio: "2026-08-14" },
};
export function formatarTemporada(ligaId: string, ano: number): string {
  return ligaId === "brasileirao" || ligaId === "brasileirao-b"
    ? String(ano)
    : `${ano}/${String(ano + 1).slice(2)}`;
}
