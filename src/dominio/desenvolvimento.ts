import type { Atributo, Posicao } from './entidades/modelos';

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
export interface PreparacaoJogador {
  planoId: string | null; prioridades: Atributo[]; intensidade: IntensidadeTreino;
  historico: RegistroTreino[];
}
export type AcaoTreinador = 'motivo' | 'oportunidade' | 'melhorar' | 'papel' | 'posicao' | 'aceitar' | 'reclamar' | 'cobrar';
export interface PromessaTreinador {
  tipo: 'minutos' | 'avaliacao'; clubeId: string; treinadorId: string;
  inicio: string; prazo: string; condicao: string;
  status: 'ativa' | 'cumprida' | 'descumprida' | 'encerrada';
  partidas: number; limitePartidas: number;
}
export type ObjetivoPessoalTipo = 'titular' | 'minutos' | 'tecnica' | 'emprestimo' | 'transferencia' | 'renovacao';
export interface AcompanhamentoCarreira {
  conversas: { data: string; acao: AcaoTreinador; resposta: string; clubeId: string }[];
  proximaConversa: string | null; promessa: PromessaTreinador | null;
  adaptacao: { posicao: Posicao; inicio: string; semanas: number; clubeId: string; status: 'ativa' | 'concluida' } | null;
  pedidosContrato: { data: string; clubeId: string; tipo: 'renovacao' | 'aumento' | 'extensao' | 'papel' | 'clausula'; status: 'aceito' | 'negado' | 'contraproposta' | 'adiado'; resposta: string; propostaId?: string }[];
  proximoPedidoContrato: string | null;
  objetivoPessoal: { tipo: ObjetivoPessoalTipo; inicio: string; referencia: number; progresso: number; concluido: boolean } | null;
  base: { ultimaAvaliacao: string | null; texto: string | null; treinosProfissional: number; conviteAte: string | null };
  resumoSemanal: { data: string; treino: string; feedback: string; evolucoes: { atributo: Atributo; antes: number; depois: number }[]; overallAntes: number; overallDepois: number } | null;
  ultimoEventoContextual: string | null;
}
export function criarPreparacao(): PreparacaoJogador {
  return { planoId: null, prioridades: [], intensidade: 'normal', historico: [] };
}
export function criarAcompanhamento(): AcompanhamentoCarreira {
  return { conversas: [], proximaConversa: null, promessa: null, adaptacao: null,
    pedidosContrato: [], proximoPedidoContrato: null, objetivoPessoal: null,
    base: { ultimaAvaliacao: null, texto: null, treinosProfissional: 0, conviteAte: null },
    resumoSemanal: null, ultimoEventoContextual: null };
}
