// @ts-check
import "server-only";
import postgres from "postgres";
import { obterDatabaseUrl } from "./configuracao.mjs";

/** A conexão efetiva só é aberta na primeira consulta. */
export function criarCliente(max = 5) {
  return postgres(obterDatabaseUrl(), {
    max,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { statement_timeout: 30_000 },
    // Notices podem conter nomes e detalhes do servidor; não enviar a logs.
    onnotice: () => {},
  });
}
