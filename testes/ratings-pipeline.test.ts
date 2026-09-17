import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  criarLoteCanonico,
  executarRatingsBot,
} from "@/infraestrutura/ratings/lote";
import {
  validarResultadoBot,
  type LoteCanonico,
  type RatingExterno,
  type ResultadoBot,
} from "@/infraestrutura/ratings/contrato";
import {
  calcularRatingViztto,
  type EntradaRatingEngine,
} from "@/infraestrutura/ratings/rating-engine";
import { resolverRating } from "@/infraestrutura/ratings/resolver";
import { avaliarSaudeRatings } from "@/infraestrutura/ratings/saude-ratings";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  salvarDadosLiga,
  lerDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { esquemaRatingMetadata } from "@/dominio/rating-metadata";
import legado from "../docs/migrations/legacy-rating-metadata.json";
import type { Liga } from "@/dominio/entidades/modelos";

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function temp() {
  const d = await mkdtemp(join(tmpdir(), "ratings-test-"));
  dirs.push(d);
  return d;
}
const entrada: EntradaRatingEngine = {
  seed: "1",
  nome: "Jogador",
  posicaoBruta: "Centre-Forward",
  idade: 24,
  valorMercado: 10_000_000,
  altura: 180,
  reputacaoLiga: 85,
  reputacaoClube: 80,
  forcaMediaLiga: 72,
  indiceNoElenco: 2,
  tamanhoElenco: 25,
};
const fonte: RatingExterno = {
  provider: "mock",
  externalPlayerId: "1",
  ratingOriginal: 78,
  ratingNormalizado: 78,
  confidence: "exact",
  matchedBy: ["name", "dateOfBirth"],
  calibrationVersion: "v1",
  attributes: { velocidade: 82 },
  externalPotential: 95,
  potentialNormalizado: 95,
};
function snapshot(liga: Liga): DadosLigaImportados {
  const clubes = gerarClubesDemonstracao(liga).slice(0, liga.quantidadeClubes);
  for (const [i, c] of clubes.entries()) {
    c.id = `${liga.id}-${i}`;
    c.idTransfermarkt = String(i + 1);
    c.ligaId = liga.id;
    for (const [k, j] of c.elenco.entries()) {
      j.id = `${liga.id}-${i}-${k}`;
      j.idTransfermarkt = j.id;
      j.dataNascimento = "2000-01-01";
    }
  }
  const cal = TEMPORADAS_INICIAIS[liga.id];
  return {
    ligaId: liga.id,
    temporada: cal.ano,
    temporadaTransfermarkt: cal.temporadaTransfermarkt,
    inicio: cal.inicio,
    importadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    status: "completo",
    clubes,
    erros: [],
    progresso: {
      total: clubes.length,
      importados: clubes.length,
      falhas: 0,
      clubeAtual: null,
    },
  };
}
function resultado(lote: LoteCanonico, externo = false): ResultadoBot {
  return {
    version: 1,
    batchId: lote.batchId,
    players: lote.players.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources: externo ? [{ ...fonte, externalPlayerId: p.id }] : [],
    })),
    providers: externo
      ? {
          mock: {
            requests: 1,
            cacheHits: 0,
            errors: 0,
            staleMappings: 0,
            providerCandidates: lote.players.length,
            synthetic: true,
          },
        }
      : {},
    diagnostics: externo
      ? {
          mock: Object.fromEntries(
            lote.players.map((p) => [
              p.id,
              {
                confidence: "exact",
                collision: false,
                matchedBy: ["name", "dateOfBirth"],
              },
            ]),
          ),
        }
      : {},
  };
}

it("fallback é determinístico e declara todos os atributos estimados", () => {
  const r = calcularRatingViztto(entrada);
  expect(r).toEqual(calcularRatingViztto(entrada));
  expect(resolverRating(entrada, [])).toEqual(r);
  expect(r.metadata.source).toBe("transfermarkt-estimated");
  expect(r.metadata.estimatedAttributes?.sort()).toEqual(
    Object.keys(r.atributos).sort(),
  );
  expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
});
it.each(["exact", "high"] as const)(
  "%s aplica externo preservando atributos observados",
  (confidence) => {
    const r = resolverRating(entrada, [{ ...fonte, confidence }]);
    expect(r.metadata.source).toBe("external");
    expect(r.atributos.velocidade).toBe(82);
    expect(r.metadata.estimatedAttributes).not.toContain("velocidade");
    expect(r.metadata.sources?.[0].externalPotential).toBe(95);
    expect(r.potencial).toBeLessThan(95);
  },
);
it.each(["medium", "low"] as const)("%s usa fallback", (confidence) => {
  expect(resolverRating(entrada, [{ ...fonte, confidence }])).toEqual(
    calcularRatingViztto(entrada),
  );
});
it("consenso multi-source independe da ordem; divergência reduz confiança", () => {
  const segunda = { ...fonte, provider: "mock-b", ratingNormalizado: 80 };
  expect(resolverRating(entrada, [fonte, segunda])).toEqual(
    resolverRating(entrada, [segunda, fonte]),
  );
  expect(resolverRating(entrada, [fonte, segunda]).metadata.source).toBe(
    "multi-source",
  );
  expect(
    resolverRating(entrada, [fonte, { ...segunda, ratingNormalizado: 50 }])
      .metadata.confidence,
  ).toBe("medium");
});
it("engine mantém contexto de liga, posição, idade e valor sem inflação extrema", () => {
  const ratings = Array.from({ length: 200 }, (_, i) =>
    calcularRatingViztto({
      ...entrada,
      seed: String(i),
      idade: 17 + (i % 20),
      valorMercado: i * 100_000,
      indiceNoElenco: i % 25,
    }),
  );
  expect(
    ratings.every(
      (r) => r.overall >= 40 && r.overall <= 99 && r.potencial >= r.overall,
    ),
  ).toBe(true);
  expect(
    calcularRatingViztto({ ...entrada, reputacaoLiga: 95 }).overall,
  ).toBeGreaterThanOrEqual(
    calcularRatingViztto({ ...entrada, reputacaoLiga: 45 }).overall,
  );
});
it("migra metadata histórica sem alterar OVR nem perder identidade externa", () => {
  const source = Object.keys(legado.sources)[0];
  const meta = esquemaRatingMetadata.parse({
    source,
    confidence: "high",
    [legado.playerId]: 123,
    coverageLevel: "A",
    minutes: 2000,
    season: "2026",
  });
  expect(meta).toMatchObject({
    source: "external",
    sources: [{ provider: legado.provider, externalPlayerId: "123" }],
    minutes: 2000,
  });
  expect(esquemaRatingMetadata.parse(meta)).toEqual(meta);
  expect(
    esquemaRatingMetadata.safeParse({ source, confidence: "high", unknown: 1 })
      .success,
  ).toBe(false);
});
it("contrato rejeita jogador estranho, faltante, duplicado, lote antigo, JSON inválido e atributo desconhecido", () => {
  const liga = { ...LIGAS_SUPORTADAS[0], quantidadeClubes: 2 };
  const lote = criarLoteCanonico([{ liga, clubes: snapshot(liga).clubes }]);
  const valid = resultado(lote, true);
  expect(validarResultadoBot(valid, lote)).toEqual(valid);
  const mutate = (fn: (r: ResultadoBot) => void) => {
    const r = structuredClone(valid);
    fn(r);
    expect(() => validarResultadoBot(r, lote)).toThrow();
  };
  mutate((r) => {
    r.players[0].id = "stranger";
  });
  mutate((r) => {
    r.players.pop();
  });
  mutate((r) => {
    r.players[0] = r.players[1];
  });
  mutate((r) => {
    r.batchId = "old";
  });
  mutate((r) => {
    r.players[0].sources[0].attributes.obscuro = 70;
  });
  mutate((r) => {
    r.players[0].sources[0].externalPlayerId =
      r.players[1].sources[0].externalPlayerId;
  });
  mutate((r) => {
    r.diagnostics.mock[r.players[0].id].confidence = "ambiguous";
  });
  expect(() => validarResultadoBot("not-json", lote)).toThrow();
});
it("gate exige opt-in e bloqueia regressão mesmo com opt-in", () => {
  const m = {
    playersTotal: 100,
    providerCandidates: 0,
    matched: 0,
    exact: 0,
    high: 0,
    ambiguous: 0,
    externalRatings: 0,
    fallbackEngine: 100,
    requestFailures: 0,
    coverage: 0,
    previousCoverage: 0,
  };
  expect(avaliarSaudeRatings(m).abortarPublicacao).toBe(true);
  expect(avaliarSaudeRatings(m, true).abortarPublicacao).toBe(false);
  expect(
    avaliarSaudeRatings({ ...m, previousCoverage: 0.75 }, true)
      .abortarPublicacao,
  ).toBe(true);
  expect(
    avaliarSaudeRatings({ ...m, previousCoverage: 0.05 }, true, true)
      .abortarPublicacao,
  ).toBe(true);
});

async function setup() {
  const dir = await temp();
  const ligas = LIGAS_SUPORTADAS.slice(0, 2).map((l) => ({
    ...l,
    quantidadeClubes: 2,
  }));
  const importar = vi.fn(async (liga: Liga, op?: { diretorio?: string }) => {
    const dados = snapshot(liga);
    await salvarDadosLiga(dados, op!.diretorio);
    return { ...dados, temporadaTransfermarkt: dados.temporadaTransfermarkt! };
  });
  return {
    dir,
    ligas,
    importar,
    opcoes: {
      diretorio: dir,
      ligas,
      importar,
      publicacao: {
        modo: "isolada" as const,
        ligasEsperadas: ligas.map((l) => l.id),
      },
      reportDir: join(dir, "reports"),
      cacheDir: join(dir, "cache"),
      informar: () => {},
    },
  };
}
it("todas as ligas importadas antes de um único lote; release final é atômica", async () => {
  const { opcoes, importar, ligas, dir } = await setup();
  const bot = vi.fn(async (lote: LoteCanonico) => {
    expect(importar).toHaveBeenCalledTimes(2);
    return resultado(lote, true);
  });
  const r = await atualizarBaseFutebol({ ...opcoes, executarBot: bot });
  expect(r.publicou).toBe(true);
  expect(bot).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(await readFile(join(dir, "active.json"), "utf8")).ligas,
  ).toEqual(ligas.map((l) => l.id));
  expect(
    (await lerDadosLiga(ligas[0].id, dir))?.clubes[0].elenco[0].ratingMetadata
      ?.source,
  ).toBe("external");
});
it("dry-run não publica nem cria active.json", async () => {
  const { opcoes, dir } = await setup();
  const r = await atualizarBaseFutebol({
    ...opcoes,
    dryRun: true,
    permitirEnginePuro: true,
    executarBot: async (l) => resultado(l),
  });
  expect(r).toMatchObject({
    publicou: false,
    temFalhas: false,
    statusLote: "dry_run",
  });
  await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
  expect(await readdir(dir)).not.toContain("releases");
});
it("falha na última liga não chama bot nem publica", async () => {
  const { opcoes, importar, dir } = await setup();
  const bot = vi.fn(async (l: LoteCanonico) => resultado(l));
  const r = await atualizarBaseFutebol({
    ...opcoes,
    executarBot: bot,
    importar: async (liga, o) => {
      if (liga.id === opcoes.ligas[1].id) throw new Error("falha última");
      return importar(liga, o);
    },
  });
  expect(r.publicou).toBe(false);
  expect(bot).not.toHaveBeenCalled();
  await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
});
it("falha completa e regressão preservam bytes da release anterior", async () => {
  const { opcoes, dir } = await setup();
  expect(
    (
      await atualizarBaseFutebol({
        ...opcoes,
        executarBot: async (l) => resultado(l, true),
      })
    ).publicou,
  ).toBe(true);
  const antes = await readFile(join(dir, "active.json"), "utf8");
  for (const executarBot of [
    async () => {
      throw new Error("offline");
    },
    async (l: LoteCanonico) => resultado(l),
  ]) {
    const r = await atualizarBaseFutebol({
      ...opcoes,
      permitirEnginePuro: true,
      executarBot,
    });
    expect(r.publicou).toBe(false);
    expect(await readFile(join(dir, "active.json"), "utf8")).toBe(antes);
  }
});
it("publicação oficial parcial continua bloqueada", async () => {
  const { opcoes, dir } = await setup();
  const r = await atualizarBaseFutebol({
    ...opcoes,
    publicacao: undefined,
    permitirEnginePuro: true,
    executarBot: async (l) => resultado(l),
  });
  expect(r.publicou).toBe(false);
  await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
});
it("Python → Node com fixtures produz contrato validado sem alterar universo", async () => {
  const dir = await temp();
  const liga = { ...LIGAS_SUPORTADAS[0], quantidadeClubes: 2 };
  const lote = criarLoteCanonico([{ liga, clubes: snapshot(liga).clubes }]);
  const p = lote.players[0];
  const fixture = join(dir, "fixture.json");
  await writeFile(
    fixture,
    JSON.stringify({
      mock: [
        {
          externalPlayerId: "x1",
          name: p.name,
          dateOfBirth: p.dateOfBirth,
          overall: 78,
        },
      ],
    }),
  );
  const r = await executarRatingsBot(lote, {
    diretorio: dir,
    cacheDir: join(dir, "cache"),
    reportPath: join(dir, "report.json"),
    providers: ["mock"],
    fixture,
    dryRun: true,
  });
  expect(r.players).toHaveLength(lote.players.length);
  expect(r.players[0].sources[0].ratingNormalizado).toBe(78);
  expect(
    JSON.parse(await readFile(join(dir, "report.json"), "utf8")).dryRun,
  ).toBe(true);
});
it("Sportmonks não sobrevive no pipeline nem em envs exigidos", async () => {
  const ignorados = new Set(["node_modules", ".next", ".git", "__pycache__"]);
  const encontrados: string[] = [];
  async function varrer(dir: string) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (ignorados.has(item.name)) continue;
      const caminho = join(dir, item.name);
      if (item.isDirectory()) await varrer(caminho);
      else if (
        caminho !== "testes/ratings-pipeline.test.ts" &&
        /\.(ts|tsx|py|json|sh|mjs)$/.test(item.name)
      ) {
        if (/sportmonks/i.test(await readFile(caminho, "utf8")))
          encontrados.push(caminho);
      }
    }
  }
  for (const raiz of ["src", "scripts", "ratings_bot", "testes", "config"])
    await varrer(raiz);
  // O histórico de migração em docs/ é deliberadamente preservado.
  expect(encontrados).toEqual([]);
  expect(await readFile(".env.example", "utf8")).not.toMatch(/sportmonks/i);
});
