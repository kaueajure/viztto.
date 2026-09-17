import { obterDiretorioImportacao } from "../src/infraestrutura/persistencia/importacao-futebol";
import { atualizarBaseFutebol } from "../src/infraestrutura/transfermarkt/atualizar-base";

try {
  const resumo = await atualizarBaseFutebol({
    diretorio: obterDiretorioImportacao(),
    dryRun: process.argv.includes("--dry-run"),
    permitirEnginePuro: process.argv.includes("--allow-engine-only"),
  });
  process.exitCode = resumo.temFalhas ? 1 : 0;
} catch (erro) {
  console.error(
    "Não foi possível atualizar a base:",
    erro instanceof Error ? erro.message : erro,
  );
  process.exitCode = 1;
}
