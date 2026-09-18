import "server-only";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Clube, JogadorExterno, Liga } from "@/dominio/entidades/modelos";
import { sincronizarForcaSnapshot } from "@/simulacao/elenco/forca-escalacao";
import { reputacaoInstitucional } from "@/infraestrutura/transfermarkt/normalizacao";
import {
  calcularRatingViztto,
  type EntradaRatingEngine,
} from "./rating-engine";
import {
  esquemaJogadorCanonico,
  validarResultadoBot,
  type LoteCanonico,
  type ResultadoBot,
} from "./contrato";
import { resolverRating } from "./resolver";

export interface LigaCanonica {
  liga: Liga;
  clubes: Clube[];
}

function elencoOrdenadoPorMercado(clube: Clube): JogadorExterno[] {
  return [...clube.elenco]
    .map((bruto) => bruto as unknown as JogadorExterno)
    .sort((a, b) => (b.valorMercado ?? 0) - (a.valorMercado ?? 0));
}

export function entradaEngine(
  liga: Liga,
  clube: Clube,
  j: JogadorExterno,
  indice: number,
  tamanhoElenco = clube.elenco.length,
): EntradaRatingEngine {
  return {
    seed: `${j.id}-${clube.id}`,
    nome: j.nome,
    posicaoBruta: j.posicao,
    idade: j.idade ?? 24,
    valorMercado: j.valorMercado,
    altura: j.altura,
    reputacaoLiga: liga.reputacao,
    reputacaoClube: clube.reputacao,
    forcaMediaLiga: liga.forcaMedia,
    indiceNoElenco: indice,
    tamanhoElenco,
  };
}
export function criarLoteCanonico(ligas: LigaCanonica[]): LoteCanonico {
  const players = ligas.flatMap(({ liga, clubes }) =>
    clubes.flatMap((c) => {
      const ordenados = elencoOrdenadoPorMercado(c);
      return ordenados.map((j, i) =>
        esquemaJogadorCanonico.parse({
          id: j.id,
          transfermarktId: j.idTransfermarkt,
          name: j.nome,
          club: c.nome,
          league: liga.id,
          position: j.posicao,
          dateOfBirth: j.dataNascimento?.slice(0, 10) ?? null,
          country: j.nacionalidade?.[0] ?? null,
          height: j.altura ?? null,
          marketValue: j.valorMercado ?? null,
          age: j.idade ?? null,
          division: String(liga.divisao),
          clubStrength: c.forcaGeral,
          engineOverall: calcularRatingViztto(
            entradaEngine(liga, c, j, i, ordenados.length),
          ).overall,
        }),
      );
    }),
  );
  if (
    new Set(players.map((p) => p.id)).size !== players.length ||
    new Set(players.map((p) => p.transfermarktId)).size !== players.length
  )
    throw new Error("Universo Transfermarkt contém jogadores duplicados.");
  return { version: 1, batchId: randomUUID(), players };
}
/** Interpretador do lote Python; a venv isolada é provisionada pelos scripts. */
export function interpretadorPython(): string {
  return process.env.RATINGS_PYTHON ?? "python3";
}
export interface OpcoesBot {
  diretorio: string;
  cacheDir?: string;
  reportPath?: string;
  providers?: string[];
  fixture?: string;
  dryRun?: boolean;
}
export async function executarRatingsBot(
  lote: LoteCanonico,
  opcoes: OpcoesBot,
): Promise<ResultadoBot> {
  await mkdir(opcoes.diretorio, { recursive: true });
  const input = join(opcoes.diretorio, "players-to-enrich.json");
  const output = join(opcoes.diretorio, `ratings-results-${lote.batchId}.json`);
  await writeFile(input, JSON.stringify(lote));
  const args = [
    "-m",
    "ratings_bot",
    "--input",
    input,
    "--output",
    output,
    "--report",
    opcoes.reportPath ?? "relatorios/ratings-import.json",
    "--cache-dir",
    opcoes.cacheDir ?? ".cache/ratings",
  ];
  for (const provider of opcoes.providers ?? [])
    args.push("--provider", provider);
  if (opcoes.fixture) args.push("--fixture", opcoes.fixture);
  if (opcoes.dryRun) args.push("--dry-run");
  try {
    await promisify(execFile)(interpretadorPython(), args, {
      timeout: 3_600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      "Ratings bot falhou; consulte configuração e relatório de saúde.",
    );
  }
  return validarResultadoBot(JSON.parse(await readFile(output, "utf8")), lote);
}
export function aplicarResultados(
  ligas: LigaCanonica[],
  resultado: ResultadoBot,
): LigaCanonica[] {
  const porId = new Map(resultado.players.map((p) => [p.id, p]));
  return ligas.map(({ liga, clubes }) => ({
    liga,
    clubes: clubes.map((c) => {
      const ordenados = elencoOrdenadoPorMercado(c);
      const indicePorId = new Map(ordenados.map((j, i) => [j.id, i]));
      const elenco = c.elenco.map((bruto) => {
        const j = bruto as unknown as JogadorExterno;
        const i = indicePorId.get(j.id) ?? 0;
        const r = resolverRating(
          entradaEngine(liga, c, j, i, ordenados.length),
          porId.get(j.id)?.sources ?? [],
        );
        return {
          ...bruto,
          overall: r.overall,
          potencial: r.potencial,
          atributos: r.atributos,
          ratingMetadata: r.metadata,
        };
      });
      const clube: Clube = {
        ...c,
        elenco: elenco as Clube["elenco"],
        reputacao: reputacaoInstitucional(liga, c.valorElenco ?? null),
      };
      // OVR → escalação → força do clube (sem RNG, sem circularidade).
      sincronizarForcaSnapshot(clube);
      return clube;
    }),
  }));
}
