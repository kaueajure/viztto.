/** Edições de início do jogo.
 * Transfermarkt e Sportmonks têm nomenclaturas distintas — NÃO inferir uma da outra.
 * Datas são âncoras do simulador semanal, não uma reprodução dos calendários reais.
 * Série C herda a âncora da Série B; segundas divisões europeias herdam a principal.
 *
 * Sportmonks: Brasil usa ano civil ("2026"); Europa usa "YYYY/YYYY+1" (ex. "2026/2027").
 */
export const TEMPORADAS_INICIAIS: Record<
  string,
  {
    ano: number;
    inicio: string;
    temporadaTransfermarkt: string;
    /**
     * Label EXATO esperado no nome da season Sportmonks (após normalização).
     * Brasil: "2026". Europa: "2026/2027" (equivale a "2026/27").
     */
    temporadaSportmonks: string;
    /** Override opcional; por padrão usa liga.quantidadeClubes. */
    clubesEsperados?: number;
  }
> = {
  brasileirao: {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    temporadaSportmonks: "2026",
    inicio: "2026-01-28",
  },
  "brasileirao-b": {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    temporadaSportmonks: "2026",
    inicio: "2026-04-10",
  },
  "brasileirao-c": {
    ano: 2026,
    temporadaTransfermarkt: "2025",
    temporadaSportmonks: "2026",
    inicio: "2026-04-10",
  },
  "premier-league": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
  "la-liga": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
  "serie-a": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-22",
  },
  bundesliga: {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-21",
  },
  "ligue-1": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
  championship: {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
  "la-liga-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
  "serie-b": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-22",
  },
  "bundesliga-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-21",
  },
  "ligue-2": {
    ano: 2026,
    temporadaTransfermarkt: "2026",
    temporadaSportmonks: "2026/2027",
    inicio: "2026-08-14",
  },
};

export function formatarTemporada(ligaId: string, ano: number): string {
  return ["brasileirao", "brasileirao-b", "brasileirao-c"].includes(ligaId)
    ? String(ano)
    : `${ano}/${String(ano + 1).slice(2)}`;
}

/**
 * Normaliza label Sportmonks para comparação exata:
 * "2026/2027" ↔ "2026/27"; "2026" permanece "2026".
 * NÃO aceita anos vizinhos (±1).
 */
export function normalizarLabelTemporadaSportmonks(label: string): string {
  const t = label.trim().replace(/\s+/g, "");
  const euro = t.match(/^(\d{4})\/(\d{2}|\d{4})$/);
  if (euro) {
    const inicio = euro[1]!;
    const fimBruto = euro[2]!;
    const fim =
      fimBruto.length === 2 ? `${inicio.slice(0, 2)}${fimBruto}` : fimBruto;
    return `${inicio}/${fim}`;
  }
  const ano = t.match(/^(\d{4})$/);
  return ano ? ano[1]! : t;
}

/** Match estruturado entre nome da season SM e label configurado. */
export function temporadaSportmonksCompativel(
  nomeSeason: string,
  temporadaSportmonks: string,
): boolean {
  return (
    normalizarLabelTemporadaSportmonks(nomeSeason) ===
    normalizarLabelTemporadaSportmonks(temporadaSportmonks)
  );
}
