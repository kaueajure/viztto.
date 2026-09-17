import { obterDiretorioImportacao } from "../src/infraestrutura/persistencia/importacao-futebol";
import { atualizarBaseFutebol } from "../src/infraestrutura/transfermarkt/atualizar-base";

// `--provider <nome>` repetido seleciona os providers externos do lote.
const providers = process.argv.reduce<string[]>(
  (lista, arg, i) =>
    arg === "--provider" ? [...lista, process.argv[i + 1] ?? ""] : lista,
  [],
);

try {
  const resumo = await atualizarBaseFutebol({
    diretorio: obterDiretorioImportacao(),
    dryRun: process.argv.includes("--dry-run"),
    permitirEnginePuro: process.argv.includes("--allow-engine-only"),
    providers,
  });
  process.exitCode = resumo.temFalhas ? 1 : 0;
} catch (erro) {
  console.error(
    "Não foi possível atualizar a base:",
    erro instanceof Error ? erro.message : erro,
  );
  process.exitCode = 1;
}
