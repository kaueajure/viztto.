import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";
import { obterDatabaseUrl } from "./src/infraestrutura/banco/configuracao.mjs";

// Variáveis já exportadas no ambiente têm precedência sobre o arquivo local.
if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infraestrutura/banco/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: obterDatabaseUrl() },
});
