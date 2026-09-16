import { HISTORIAS } from "@/dominio/historia-formacao";
import { z } from 'zod';
import { NOMES_ATRIBUTOS } from '@/dominio/entidades/modelos';
const data = z.iso.date(), texto = z.string().min(1).max(2000);
const numero = z.number().finite(), nivel = numero.min(0).max(100);
export const esquemaAtributo = z.enum(Object.keys(NOMES_ATRIBUTOS) as [keyof typeof NOMES_ATRIBUTOS, ...Array<keyof typeof NOMES_ATRIBUTOS>]);
const posicao = z.enum(['GOL','LD','ZAG','LE','VOL','MC','MEI','PD','PE','CA']);
export const esquemaHistoria = z.discriminatedUnion('origem', [
  z.object({ origem: z.literal('legado') }).strict(),
  z.object({ origem: z.literal('historia'), versao: z.literal(1), seed: texto,
    escolhas: z.object({ origem: texto.refine(v => HISTORIAS.origem.some(o => o.id === v)), destaque: texto.refine(v => HISTORIAS.destaque.some(o => o.id === v)), dificuldade: texto.refine(v => HISTORIAS.dificuldade.some(o => o.id === v)), chegada: texto.refine(v => HISTORIAS.chegada.some(o => o.id === v)) }).strict() }).strict(),
]);
export const esquemaPreparacao = z.object({
  planoId: texto.nullable(), prioridades: z.array(esquemaAtributo).max(2).refine(v => new Set(v).size === v.length),
  intensidade: z.enum(['leve','normal','intenso']),
  historico: z.array(z.object({ data, avaliacao: z.enum(['Ruim','Regular','Bom','Muito bom','Excelente','Recuperação']), nota: nivel, confianca: numero.min(-100).max(100), progresso: numero.nonnegative() }).strict()).max(8),
}).strict();
export const esquemaAcompanhamento = z.object({
  conversas: z.array(z.object({ data, acao: z.enum(['motivo','oportunidade','melhorar','papel','posicao','aceitar','reclamar','cobrar']), resposta: texto, clubeId: texto }).strict()).max(30),
  proximaConversa: data.nullable(),
  promessa: z.object({ tipo: z.enum(['minutos','avaliacao']), clubeId: texto, treinadorId: texto, inicio: data, prazo: data, condicao: texto, status: z.enum(['ativa','cumprida','descumprida','encerrada']), partidas: numero.int().nonnegative(), limitePartidas: numero.int().min(1).max(10) }).strict().nullable(),
  adaptacao: z.object({ posicao, inicio: data, semanas: numero.int().nonnegative(), clubeId: texto, status: z.enum(['ativa','concluida']) }).strict().nullable(),
  pedidosContrato: z.array(z.object({ data, clubeId: texto, tipo: z.enum(['renovacao','aumento','extensao','papel','clausula']), status: z.enum(['aceito','negado','contraproposta','adiado']), resposta: texto, propostaId: texto.optional() }).strict()).max(20),
  proximoPedidoContrato: data.nullable(),
  objetivoPessoal: z.object({ tipo: z.enum(['titular','minutos','tecnica','emprestimo','transferencia','renovacao']), inicio: data, referencia: numero, progresso: nivel, concluido: z.boolean() }).strict().nullable(),
  base: z.object({ ultimaAvaliacao: data.nullable(), texto: texto.nullable(), treinosProfissional: numero.int().nonnegative(), conviteAte: data.nullable() }).strict(),
  resumoSemanal: z.object({ data, treino: texto, feedback: texto, evolucoes: z.array(z.object({ atributo: esquemaAtributo, antes: nivel, depois: nivel }).strict()).max(27), overallAntes: nivel, overallDepois: nivel }).strict().nullable(),
  ultimoEventoContextual: data.nullable(),
}).strict();
