/**
 * Regras de promoção/rebaixamento entre divisões — fonte de verdade data-driven.
 * A UI de zonas e o fechamento de temporada leem daqui (não hardcodam no React).
 */

export type FormatoPlayoffAcesso = {
  /** Posições da divisão inferior que entram no playoff (após acessos diretos). */
  posicoes: number[];
  /** Semifinais em ida e volta. */
  idaVoltaSemifinal: boolean;
  /** Final em jogo único (em casa do melhor classificado). */
  finalJogoUnico: boolean;
  /**
   * `chave_4`: 3×6 e 4×5 → final.
   * `chave_3`: 4×5 → vencedor × 3 → (opcionalmente) playoff interdivisional.
   */
  chave: "chave_4" | "chave_3";
};

export type FormatoPlayoffInterdivisional = {
  /** Posição na divisão superior (ex.: 16º da Bundesliga). */
  posicaoSuperior: number;
  /**
   * Adversário: posição fixa na inferior (ex.: 3º) ou vencedor do playoff de acesso.
   */
  adversarioInferior: number | "playoff";
  idaVolta: boolean;
};

export type RegrasMovimentoPar = {
  id: string;
  pais: string;
  divisaoSuperiorId: string;
  divisaoInferiorId: string;
  /** Quantidade de clubes rebaixados diretamente (do fundo da tabela). */
  rebaixamentoDireto: number;
  /** Posições da superior em playoff de rebaixamento (além dos diretos). */
  playoffRebaixamentoPosicoes: number[];
  /** Quantidade promovida diretamente do topo da inferior. */
  promocaoDireta: number;
  playoffAcesso?: FormatoPlayoffAcesso;
  playoffInterdivisional?: FormatoPlayoffInterdivisional;
  /** Nota de simplificação quando a regra real for mais complexa. */
  nota?: string;
};

/**
 * Pares de divisão do catálogo atual (TEMPORADA_TRANSFERMARKT / universo viztto).
 * Sem divisão 3 no universo: inferiores não rebaixam para baixo.
 */
export const REGRAS_MOVIMENTO_PARES: RegrasMovimentoPar[] = [
  {
    id: "brasil",
    pais: "Brasil",
    divisaoSuperiorId: "brasileirao",
    divisaoInferiorId: "brasileirao-b",
    rebaixamentoDireto: 4,
    playoffRebaixamentoPosicoes: [],
    promocaoDireta: 4,
  },
  {
    id: "inglaterra",
    pais: "Inglaterra",
    divisaoSuperiorId: "premier-league",
    divisaoInferiorId: "championship",
    rebaixamentoDireto: 3,
    playoffRebaixamentoPosicoes: [],
    promocaoDireta: 2,
    playoffAcesso: {
      posicoes: [3, 4, 5, 6],
      idaVoltaSemifinal: true,
      finalJogoUnico: true,
      chave: "chave_4",
    },
  },
  {
    id: "espanha",
    pais: "Espanha",
    divisaoSuperiorId: "la-liga",
    divisaoInferiorId: "la-liga-2",
    rebaixamentoDireto: 3,
    playoffRebaixamentoPosicoes: [],
    promocaoDireta: 2,
    playoffAcesso: {
      posicoes: [3, 4, 5, 6],
      idaVoltaSemifinal: true,
      finalJogoUnico: true,
      chave: "chave_4",
    },
  },
  {
    id: "italia",
    pais: "Itália",
    divisaoSuperiorId: "serie-a",
    divisaoInferiorId: "serie-b",
    rebaixamentoDireto: 3,
    playoffRebaixamentoPosicoes: [],
    promocaoDireta: 2,
    playoffAcesso: {
      posicoes: [3, 4, 5, 6],
      idaVoltaSemifinal: true,
      finalJogoUnico: true,
      chave: "chave_4",
    },
    nota:
      "Serie B: simplificação 1–2 diretos + playoff 3–6 (regras reais com cortes por pontos omitidas).",
  },
  {
    id: "alemanha",
    pais: "Alemanha",
    divisaoSuperiorId: "bundesliga",
    divisaoInferiorId: "bundesliga-2",
    rebaixamentoDireto: 2,
    playoffRebaixamentoPosicoes: [16],
    promocaoDireta: 2,
    playoffInterdivisional: {
      posicaoSuperior: 16,
      adversarioInferior: 3,
      idaVolta: true,
    },
  },
  {
    id: "franca",
    pais: "França",
    divisaoSuperiorId: "ligue-1",
    divisaoInferiorId: "ligue-2",
    rebaixamentoDireto: 2,
    playoffRebaixamentoPosicoes: [16],
    promocaoDireta: 2,
    playoffAcesso: {
      posicoes: [3, 4, 5],
      idaVoltaSemifinal: false,
      finalJogoUnico: true,
      chave: "chave_3",
    },
    playoffInterdivisional: {
      posicaoSuperior: 16,
      adversarioInferior: "playoff",
      idaVolta: true,
    },
    nota:
      "Ligue 1/2: 2 rebaixamentos diretos + barrages 16º vs vencedor do playoff 3–5 da Ligue 2.",
  },
];

export function regrasMovimentoDoPar(
  superiorId: string,
  inferiorId: string,
): RegrasMovimentoPar | undefined {
  return REGRAS_MOVIMENTO_PARES.find(
    (p) =>
      p.divisaoSuperiorId === superiorId &&
      p.divisaoInferiorId === inferiorId,
  );
}

export function regrasMovimentoPorLigaId(
  ligaId: string,
): RegrasMovimentoPar | undefined {
  return REGRAS_MOVIMENTO_PARES.find(
    (p) =>
      p.divisaoSuperiorId === ligaId || p.divisaoInferiorId === ligaId,
  );
}
