import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { interpretadorPython } from "./lote";

export const CAMINHO_CALIBRACAO = "config/ratings-calibration.json";

/**
 * Valida providers e calibração ANTES de importar o Transfermarkt.
 * Erro estático de configuração nunca deve aparecer após milhares de jogadores.
 */
export async function preflightRatings(
  providers: string[],
  opcoes: { calibracao?: string; cacheDir?: string } = {},
): Promise<string[]> {
  if (new Set(providers).size !== providers.length)
    throw new Error("Preflight ratings: provider repetido na configuração.");
  if (providers.some((p) => !/^[a-z0-9-]{1,80}$/.test(p)))
    throw new Error("Preflight ratings: nome de provider inválido.");
  const caminho = opcoes.calibracao ?? CAMINHO_CALIBRACAO;
  // O robô conhece o registro de providers, a autorização e as curvas.
  const args = ["-m", "ratings_bot", "--preflight", "--calibration", caminho];
  if (opcoes.cacheDir) args.push("--cache-dir", opcoes.cacheDir);
  for (const provider of providers) args.push("--provider", provider);
  let linhas: string[];
  try {
    const { stdout } = await promisify(execFile)(interpretadorPython(), args, {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    linhas = stdout.trim().split("\n").filter(Boolean);
  } catch (erro) {
    const saida = (erro as { stderr?: string }).stderr?.trim();
    throw new Error(
      saida || "Preflight ratings: Python indisponível ou ratings_bot ausente.",
    );
  }
  // Só o Node conhece os atributos do jogo; alvo inexistente descartaria dados.
  const calibracao: Record<
    string,
    { attributes?: Record<string, { target?: string }> }
  > = JSON.parse(await readFile(caminho, "utf8"));
  for (const provider of providers)
    for (const [externo, spec] of Object.entries(
      calibracao[provider]?.attributes ?? {},
    ))
      if (!spec.target || !Object.hasOwn(NOMES_ATRIBUTOS, spec.target))
        throw new Error(
          `Preflight ratings: atributo ${externo} de ${provider} aponta para alvo inexistente no Viztto.`,
        );
  return linhas;
}
