import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { criarCliente } from "./cliente.mjs";
import * as schema from "./schema";

function criarConexao() {
  const cliente = criarCliente();
  return { cliente, db: drizzle(cliente, { schema }) };
}

type Conexao = ReturnType<typeof criarConexao>;
const globalBanco = globalThis as typeof globalThis & {
  vizttoBanco?: Conexao;
};

/** Lazy e reutilizada por processo, inclusive após hot reload em desenvolvimento. */
export function obterBanco() {
  globalBanco.vizttoBanco ??= criarConexao();
  return globalBanco.vizttoBanco.db;
}

export async function encerrarBanco() {
  const conexao = globalBanco.vizttoBanco;
  if (!conexao) return;
  await conexao.cliente.end({ timeout: 5 });
  delete globalBanco.vizttoBanco;
}
