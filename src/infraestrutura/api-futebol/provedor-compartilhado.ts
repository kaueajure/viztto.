import "server-only";
import { createHash } from "node:crypto";
import { ClienteApiFutebol } from "./cliente-api";
import { ProvedorApiFootball } from "./api-football";
// Cache operacional por processo e credencial; não contém dados da carreira.
const clientes = new Map<string, ClienteApiFutebol>();
export function obterProvedor(chave: string): ProvedorApiFootball {
  const identificador = createHash("sha256").update(chave).digest("hex");
  let cliente = clientes.get(identificador);
  if (!cliente) {
    if (clientes.size >= 2) clientes.clear();
    cliente = new ClienteApiFutebol(chave);
    clientes.set(identificador, cliente);
  }
  return new ProvedorApiFootball(chave, cliente);
}
