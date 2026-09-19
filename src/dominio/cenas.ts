import type { EventoCarreira } from "./entidades/modelos";

export type CategoriaCena =
  | "treinador"
  | "concorrencia"
  | "imprensa"
  | "agente"
  | "clube"
  | "marco";

export type TipoCena =
  | "elogio-sequencia"
  | "cobranca-ruins"
  | "informar-titularidade"
  | "informar-perda-vaga"
  | "teste-posicao-cena"
  | "cobranca-promessa"
  | "mudanca-papel"
  | "concorrente-lesionado"
  | "concorrente-retornando"
  | "novo-contratado"
  | "ultrapassou-concorrente"
  | "ultrapassado-concorrente"
  | "grande-atuacao"
  | "sequencia-ruim-imprensa"
  | "primeiro-gol-imprensa"
  | "classico"
  | "rumor-transferencia"
  | "discussao-titularidade"
  | "clube-observa"
  | "interesse-aumentou"
  | "interesse-esfriou"
  | "oportunidade-especifica"
  | "sugestao-saida"
  | "crise-resultados"
  | "disputa-titulo"
  | "classico-chegando"
  | "estreia-profissional"
  | "primeira-titularidade"
  | "primeiro-gol-marco"
  | "primeira-assistencia"
  | "marco-jogos"
  | "hat-trick-marco"
  | "conquista-titularidade";

export interface RegistroCena {
  id: string;
  tipo: TipoCena;
  categoria: CategoriaCena;
  data: string;
  escolha?: string;
}

export interface DefinicaoCena {
  tipo: TipoCena;
  categoria: CategoriaCena;
  prioridade: number;
  /** Dias mínimos entre cenas do mesmo tipo. */
  cooldownDias: number;
  remetente: EventoCarreira["remetente"];
  titulo: string;
  texto: string;
  /** Se presente, vira DecisaoPendente; senão só informa. */
  opcoes?: { id: string; rotulo: string }[];
}

export interface HistoricoCenasCarreira {
  registros: RegistroCena[];
  /** Última data em que uma cena daquele tipo foi gerada. */
  cooldowns: Partial<Record<TipoCena, string>>;
  /** Última data de qualquer cena (ajuda a espaçar). */
  ultimaCena: string | null;
}

export function criarHistoricoCenas(): HistoricoCenasCarreira {
  return { registros: [], cooldowns: {}, ultimaCena: null };
}

/** Limite razoável de cenas novas por semana (além de decisões legadas). */
export const LIMITE_CENAS_POR_SEMANA = 2;
