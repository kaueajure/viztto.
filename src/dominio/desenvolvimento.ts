import type { Atributo, Posicao, StatusElenco } from './entidades/modelos';

export const CAPITULOS = ['origem', 'destaque', 'dificuldade', 'chegada'] as const;
export type CapituloHistoria = typeof CAPITULOS[number];
export type EscolhasHistoria = Record<CapituloHistoria, string>;
export type PerfilFormacao = { origem: 'legado' } | {
  origem: 'historia'; versao: 1; seed: string; escolhas: EscolhasHistoria;
};
export type IntensidadeTreino = 'leve' | 'normal' | 'intenso';
export type AvaliacaoTreino = 'Ruim' | 'Regular' | 'Bom' | 'Muito bom' | 'Excelente' | 'Recuperação';
export interface RegistroTreino {
  data: string; avaliacao: AvaliacaoTreino; nota: number;
  confianca: number; progresso: number;
}
export type NotaTreinoPersistida = "A" | "B" | "C" | "D";

export interface RecordeExercicio {
  score: number;
  nota: NotaTreinoPersistida;
  realizados: number;
}

export interface SessaoTreinoSemana {
  id: string;
  exercicioId: string;
  score: number;
  nota: NotaTreinoPersistida;
  modo: "jogar" | "simular";
  aplicada: boolean;
}

export interface SemanaCentroTreinamento {
  chave: string;
  sessoes: SessaoTreinoSemana[];
}

/** Centro de treinamento jogável — campos opcionais para saves legados. */
export interface CentroTreinamentoEstado {
  /** Progresso fracionário 0–100 por atributo (espelha desenvolvimento quando hidratado). */
  progressoAtributos: Partial<Record<Atributo, number>>;
  melhoresExercicios: Partial<Record<string, RecordeExercicio>>;
  semana: SemanaCentroTreinamento;
}

export interface PreparacaoJogador {
  planoId: string | null; prioridades: Atributo[]; intensidade: IntensidadeTreino;
  historico: RegistroTreino[];
  /** Ausente em saves antigos — hidratar com criarCentroTreinamento(). */
  centro?: CentroTreinamentoEstado;
}
export type AcaoTreinador = 'motivo' | 'oportunidade' | 'melhorar' | 'papel' | 'posicao' | 'aceitar' | 'reclamar' | 'cobrar';
export type CategoriaConversaTreinador = 'informativa' | 'pedido' | 'reclamacao' | 'cobranca' | 'posicional';
export type CooldownsTreinador = Record<CategoriaConversaTreinador, string | null>;
export interface PromessaTreinador {
  tipo: 'minutos' | 'avaliacao'; clubeId: string; treinadorId: string;
  inicio: string; prazo: string; condicao: string;
  status: 'ativa' | 'cumprida' | 'descumprida' | 'encerrada';
  partidas: number; limitePartidas: number;
}
export type ObjetivoPessoalTipo = 'titular' | 'minutos' | 'tecnica' | 'emprestimo' | 'transferencia' | 'renovacao';
/** Dias até poder reativar um objetivo pessoal já concluído (anti-farm). */
export const DIAS_COOLDOWN_OBJETIVO_PESSOAL = 120;
export type StatusAdaptacao = 'ativa' | 'secundaria';
export interface AdaptacaoPosicao {
  posicao: Posicao; inicio: string; semanas: number; clubeId: string; status: StatusAdaptacao;
}
export interface PapelAceitoTreinador {
  status: StatusElenco; data: string; clubeId: string;
}
export interface HistoricoObjetivoPessoal {
  tipo: ObjetivoPessoalTipo; concluidoEm: string; cicloId: string;
}
export interface ObjetivoPessoalAtivo {
  tipo: ObjetivoPessoalTipo; inicio: string; referencia: number; progresso: number; concluido: boolean; cicloId: string;
}
export interface MudancaElencoSemana {
  texto: string;
  motivos: ('hierarquia' | 'escalacao' | 'chance' | 'concorrente' | 'papel')[];
}
export interface AcompanhamentoCarreira {
  conversas: { data: string; acao: AcaoTreinador; resposta: string; clubeId: string }[];
  cooldownsTreinador: CooldownsTreinador;
  promessa: PromessaTreinador | null;
  adaptacao: AdaptacaoPosicao | null;
  papelAceito: PapelAceitoTreinador | null;
  pedidosContrato: { data: string; clubeId: string; tipo: 'renovacao' | 'aumento' | 'extensao' | 'papel' | 'clausula'; status: 'aceito' | 'negado' | 'contraproposta' | 'adiado'; resposta: string; propostaId?: string }[];
  proximoPedidoContrato: string | null;
  objetivoPessoal: ObjetivoPessoalAtivo | null;
  historicoObjetivos: HistoricoObjetivoPessoal[];
  base: { ultimaAvaliacao: string | null; texto: string | null; treinosProfissional: number; conviteAte: string | null };
  resumoSemanal: { data: string; treino: string; feedback: string; evolucoes: { atributo: Atributo; antes: number; depois: number }[]; overallAntes: number; overallDepois: number; mudancaElenco: MudancaElencoSemana | null } | null;
  ultimoEventoContextual: string | null;
}
export function criarCooldownsTreinador(valor: string | null = null): CooldownsTreinador {
  return { informativa: valor, pedido: valor, reclamacao: valor, cobranca: valor, posicional: valor };
}
export function criarCentroTreinamento(chaveSemana = ""): CentroTreinamentoEstado {
  return {
    progressoAtributos: {},
    melhoresExercicios: {},
    semana: { chave: chaveSemana, sessoes: [] },
  };
}

export function criarPreparacao(): PreparacaoJogador {
  return {
    planoId: null,
    prioridades: [],
    intensidade: "normal",
    historico: [],
    centro: criarCentroTreinamento(),
  };
}
export function criarAcompanhamento(): AcompanhamentoCarreira {
  return { conversas: [], cooldownsTreinador: criarCooldownsTreinador(), promessa: null, adaptacao: null, papelAceito: null,
    pedidosContrato: [], proximoPedidoContrato: null, objetivoPessoal: null, historicoObjetivos: [],
    base: { ultimaAvaliacao: null, texto: null, treinosProfissional: 0, conviteAte: null },
    resumoSemanal: null, ultimoEventoContextual: null };
}
