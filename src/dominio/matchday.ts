import type { Escalacao, Posicao } from "./entidades/modelos";

/** Instrução individual do treinador para a partida. */
export type InstrucaoTreinador =
  | "profundidade"
  | "simples"
  | "finalizacoes"
  | "criacao"
  | "pressionar"
  | "proteger"
  | "evitar-riscos";

export const ROTULOS_INSTRUCAO: Record<InstrucaoTreinador, string> = {
  profundidade: "Atacar a profundidade",
  simples: "Jogar de forma simples",
  finalizacoes: "Arriscar mais finalizações",
  criacao: "Priorizar criação",
  pressionar: "Pressionar a saída",
  proteger: "Proteger mais a defesa",
  "evitar-riscos": "Evitar riscos (cartão/pendurado)",
};

export interface ObjetivoPartida {
  id: string;
  descricao: string;
  /** Critério interno para avaliação pós-jogo. */
  criterio:
    | "minutos"
    | "nota"
    | "gol"
    | "assistencia"
    | "sem-cartao"
    | "desarmes"
    | "passes-chave"
    | "defesas"
    | "limpo";
  meta: number;
  cumprido?: boolean;
}

export interface ConcorrentePosicao {
  id: string;
  nome: string;
  overall: number;
  disponivel: boolean;
}

export interface BriefingMatchday {
  partidaId: string;
  rodada: number;
  data: string;
  categoria: "base" | "profissional";
  competicao: string;
  estadio: string;
  mandanteId: string;
  visitanteId: string;
  adversarioId: string;
  mandante: boolean;
  posicao: Posicao;
  escalacao: Escalacao;
  formaClube: number;
  formaAdversario: number;
  forcaClube: number;
  forcaAdversario: number;
  concorrentes: ConcorrentePosicao[];
  instrucao: InstrucaoTreinador;
  objetivos: ObjetivoPartida[];
  textoSituacao: string;
}

/** Modificadores acumulados por decisões durante a partida. */
export interface ModificadoresPartida {
  agressividade: number;
  risco: number;
  intensidade: number;
  protagonismo: number;
  pedirSubstituicao: boolean;
}

export function criarModificadoresNeutros(): ModificadoresPartida {
  return {
    agressividade: 0,
    risco: 0,
    intensidade: 0,
    protagonismo: 0,
    pedirSubstituicao: false,
  };
}

export type TipoDecisaoPartida =
  | "amarelo"
  | "intervalo-ruim"
  | "entrada-banco"
  | "perdendo"
  | "fadiga";

export interface DecisaoPartidaPendente {
  id: string;
  tipo: TipoDecisaoPartida;
  minuto: number;
  titulo: string;
  texto: string;
  opcoes: { id: string; rotulo: string }[];
}

export interface ContextoPartida {
  instrucao: InstrucaoTreinador;
  objetivos: ObjetivoPartida[];
  impactoTreinador: number;
  impactoHierarquia: string | null;
  reacaoImprensa: string | null;
  reacaoTreinador: string | null;
}

export type FaseMatchday = "pre" | "ao-vivo" | "pos";
