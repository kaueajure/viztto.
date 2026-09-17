import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { LIGAS_SUPORTADAS } from "../src/dominio/constantes/ligas";
import { lerDadosLiga } from "../src/infraestrutura/persistencia/importacao-futebol";
import { criarLoteCanonico } from "../src/infraestrutura/ratings/lote";

const args = process.argv.slice(2);
if (!args.includes("--input") && !args.includes("--report-only")) {
  const ligas = [];
  for (const liga of LIGAS_SUPORTADAS) {
    const dados = await lerDadosLiga(liga.id);
    if (dados) ligas.push({ liga, clubes: dados.clubes });
  }
  if (!ligas.length)
    throw new Error("Nenhum snapshot canônico disponível; forneça --input.");
  const lote = criarLoteCanonico(ligas);
  await mkdir(".cache/ratings", { recursive: true });
  await writeFile(
    ".cache/ratings/players-to-enrich.json",
    JSON.stringify(lote),
  );
}
const child = spawn(
  process.env.RATINGS_PYTHON ?? "python3",
  ["-m", "ratings_bot", ...args],
  { stdio: "inherit" },
);
child.on("error", () => {
  console.error("Python indisponível; configure RATINGS_PYTHON.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
