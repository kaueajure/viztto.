/** Edições de início do jogo. No Transfermarkt, Brasil 2026 usa o ID interno 2025.
 * Datas são âncoras do simulador semanal, não uma reprodução dos calendários reais.
 * Série C herda a âncora da Série B; segundas divisões europeias herdam a principal.
 */
export const TEMPORADAS_INICIAIS: Record<
  string,
  {
    ano: number;
    inicio: string;
    temporadaTransfermarkt: string;
    /** Se definido, publicação exige exatamente este número de clubes. */
    clubesEsperados?: number;
  }
> = {
  brasileirao: {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    inicio: "2026-01-28",
  },
  "brasileirao-b": {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    inicio: "2026-04-10",
  },
  "brasileirao-c": {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    inicio: "2026-04-10",
  },
  "premier-league": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
  "la-liga": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
  "serie-a": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-22",
  },
  bundesliga: {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-21",
  },
  "ligue-1": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
  championship: {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
  "la-liga-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
  "serie-b": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-22",
  },
  "bundesliga-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-21",
  },
  "ligue-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    inicio: "2026-08-14",
  },
};
export function formatarTemporada(ligaId: string, ano: number): string {
  return ["brasileirao", "brasileirao-b", "brasileirao-c"].includes(ligaId)
    ? String(ano)
    : `${ano}/${String(ano + 1).slice(2)}`;
}
