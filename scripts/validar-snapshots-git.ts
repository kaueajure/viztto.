import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validarSnapshotsVersionados } from "../src/infraestrutura/persistencia/validar-snapshots-git";
const exec = promisify(execFile);
const resultado = await validarSnapshotsVersionados(async (caminho) => {
  try {
    return (
      await exec("git", ["show", `:${caminho}`], { maxBuffer: 32 * 1024 ** 2 })
    ).stdout;
  } catch (erro) {
    if ((erro as { code?: number }).code === 128) return null;
    throw erro;
  }
});
console.log("Snapshots do índice Git íntegros e carregáveis:", resultado);
