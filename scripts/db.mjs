// @ts-check
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { criarCliente } from "../src/infraestrutura/banco/cliente.mjs";
import { obterDatabaseUrl } from "../src/infraestrutura/banco/configuracao.mjs";

/** @type {ReturnType<typeof criarCliente> | undefined} */
let cliente;
try {
  const comando = process.argv[2];
  if (comando !== "check" && comando !== "migrate") {
    throw new Error("Use npm run db:check ou npm run db:migrate.");
  }
  // Validação separada para manter a mensagem clara sem revelar credenciais.
  obterDatabaseUrl();
  cliente = criarCliente(1);
  if (comando === "check") {
    const [resultado] = await cliente`SELECT 1 AS ok`;
    if (resultado?.ok !== 1) throw new Error("Resposta inesperada do banco.");
    console.log("PostgreSQL: conexão validada (SELECT 1).");
  } else {
    await migrate(drizzle(cliente), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
    console.log("PostgreSQL: migrations aplicadas; banco atualizado.");
  }
} catch (erro) {
  // Erros de drivers podem conter usuário, URL, SQL e dados. Não imprimir o erro bruto.
  const mensagem = erro instanceof Error ? erro.message : "";
  console.error(
    mensagem.startsWith("DATABASE_URL ") || mensagem.startsWith("Use npm run ")
      ? mensagem
      : "Falha no comando do banco. Verifique a conexão, as permissões e as migrations. Nenhuma credencial foi registrada.",
  );
  process.exitCode = 1;
} finally {
  if (cliente) {
    try {
      await cliente.end({ timeout: 5 });
    } catch {
      console.error(
        "Não foi possível encerrar normalmente a conexão PostgreSQL.",
      );
      process.exitCode = 1;
    }
  }
}
