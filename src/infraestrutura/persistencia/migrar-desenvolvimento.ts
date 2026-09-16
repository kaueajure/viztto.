import { criarAcompanhamento, criarPreparacao } from '@/dominio/desenvolvimento';
/** Apenas defaults neutros. Nunca recalcula atributos nem sorteia um passado. */
export function migrarDesenvolvimento(valor: unknown, persistido = false): unknown {
  if (!valor || typeof valor !== 'object') return valor;
  const c = valor as Record<string, unknown>;
  if (persistido && c.versao !== 3) return valor;
  if (!persistido && c.versao !== 2) return valor;
  if (!c.jogador || typeof c.jogador !== 'object') return valor;
  const j = c.jogador as Record<string, unknown>;
  return { ...c, ...(persistido ? { versao: 4 } : {}),
    acompanhamento: c.acompanhamento ?? criarAcompanhamento(),
    jogador: { ...j, perfilFormacao: j.perfilFormacao ?? { origem: 'legado' }, preparacao: j.preparacao ?? criarPreparacao() } };
}
