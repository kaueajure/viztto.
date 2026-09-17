import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  copyFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { afterEach, expect, it } from "vitest";
const diretorios: string[] = [];
afterEach(async () => {
  for (const d of diretorios.splice(0))
    await rm(d, { recursive: true, force: true });
});
async function ambiente(opcoes: {
  existente?: boolean;
  bloquear?: boolean;
  falhar?: boolean;
}) {
  const dir = await mkdtemp(join(tmpdir(), "viztto-cli-"));
  diretorios.push(dir);
  for (const pasta of ["scripts", "API", "bin"]) await mkdir(join(dir, pasta));
  for (const script of ["atualizar-dados-futebol.sh", "ratings-python.sh"])
    await copyFile(join("scripts", script), join(dir, "scripts", script));
  await writeFile(
    join(dir, "bin/curl"),
    '#!/usr/bin/env bash\n[[ -f "$TEST_ROOT/pronta" ]]\n',
    { mode: 0o755 },
  );
  await writeFile(
    join(dir, "bin/node"),
    `#!/usr/bin/env bash
if [[ "$*" == *" -e "* ]]; then printf 'http://127.0.0.1:8000'; exit 0; fi
printf '%s' "$$" > "$TEST_ROOT/atualizador.pid"
if [[ -f "$TEST_ROOT/bloquear" ]]; then sleep 60 & echo $! > "$TEST_ROOT/filho.pid"; wait; fi
if [[ -f "$TEST_ROOT/falhar" ]]; then exit 1; fi
`,
    { mode: 0o755 },
  );
  await writeFile(
    join(dir, "API/iniciar.sh"),
    '#!/usr/bin/env bash\necho $$ > "$TEST_ROOT/api.pid"\ntouch "$TEST_ROOT/pronta"\nexec sleep 60\n',
  );
  for (const [flag, arquivo] of [
    [opcoes.existente, "pronta"],
    [opcoes.bloquear, "bloquear"],
    [opcoes.falhar, "falhar"],
  ] as const)
    if (flag) await writeFile(join(dir, arquivo), "");
  const filho = spawn(
    "bash",
    [join(dir, "scripts/atualizar-dados-futebol.sh")],
    {
      env: {
        ...process.env,
        TEST_ROOT: dir,
        // Interpretador explícito: a CLI não provisiona venv no diretório de teste.
        RATINGS_PYTHON: "python3",
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      },
      stdio: "pipe",
    },
  );
  let saida = "";
  filho.stdout.on("data", (b) => {
    saida += b;
  });
  filho.stderr.on("data", (b) => {
    saida += b;
  });
  const fim = new Promise<number | null>((resolve, reject) => {
    filho.on("exit", resolve);
    filho.on("error", reject);
  });
  return { dir, filho, fim, saida: () => saida };
}
async function aguardarArquivo(path: string) {
  for (let n = 0; n < 100; n++) {
    try {
      return await readFile(path, "utf8");
    } catch {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw new Error(`Arquivo não criado: ${path}`);
}
function vivo(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
it("reutiliza API existente sem encerrá-la e propaga falha da CLI", async () => {
  const a = await ambiente({ existente: true, falhar: true });
  expect(await a.fim).toBe(1);
  expect(a.saida()).toContain("Reutilizando");
  await expect(readFile(join(a.dir, "api.pid"))).rejects.toThrow();
});
it("inicia API e encerra apenas o processo que criou", async () => {
  const a = await ambiente({});
  expect(await a.fim).toBe(0);
  const pid = Number(await readFile(join(a.dir, "api.pid"), "utf8"));
  expect(vivo(pid)).toBe(false);
});
for (const sinal of ["SIGINT", "SIGTERM"] as const)
  it(`encerra API, atualizador e descendentes ao receber ${sinal}`, async () => {
    const a = await ambiente({ bloquear: true });
    const pid = Number(await aguardarArquivo(join(a.dir, "filho.pid")));
    a.filho.kill(sinal);
    expect(await a.fim).toBe(sinal === "SIGINT" ? 130 : 143);
    expect(vivo(Number(await readFile(join(a.dir, "api.pid"), "utf8")))).toBe(
      false,
    );
    // Um filho recém-encerrado pode aguardar reap pelo init; zumbi não está executando.
    if (vivo(pid))
      expect(await readFile(`/proc/${pid}/stat`, "utf8")).toMatch(/\) Z /);
  }, 10000);
