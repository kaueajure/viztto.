import { join } from "node:path";
import { atualizarBaseFutebol } from "../src/infraestrutura/transfermarkt/atualizar-base";

try {
  const resumo = await atualizarBaseFutebol({
    diretorio: join(process.cwd(), "src/dados/futebol"),
  });
  process.exitCode = resumo.temFalhas ? 1 : 0;
} catch (erro) {
  console.error(
    "Não foi possível atualizar a base:",
    erro instanceof Error ? erro.message : erro,
  );
  process.exitCode = 1;
}
