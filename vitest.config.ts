import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const cacheTestes = join(process.cwd(), ".cache/viztto");
mkdirSync(cacheTestes, { recursive: true });
const diretorioImportacaoTestes = mkdtempSync(
  join(cacheTestes, "import-testes-"),
);

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["testes/**/*.test.ts"],
    env: { VIZTTO_IMPORTACAO_DIR: diretorioImportacaoTestes },
  },
});
