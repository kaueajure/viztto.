import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarLoteCanonico } from "@/infraestrutura/ratings/lote";
import type {
  LoteCanonico,
  ResultadoBot,
} from "@/infraestrutura/ratings/contrato";
import { metricasDaLiga } from "@/infraestrutura/ratings/saude-ratings";
import { preflightRatings } from "@/infraestrutura/ratings/preflight";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { resolverRating } from "@/infraestrutura/ratings/resolver";
import type { Liga } from "@/dominio/entidades/modelos";

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function temp() {
  const d = await mkdtemp(join(tmpdir(), "v5-"));
  dirs.push(d);
  return d;
}
function snapshot(liga: Liga): DadosLigaImportados {
  const cal = TEMPORADAS_INICIAIS[liga.id]!;
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

// ── Universo de ligas ───────────────────────────────────────────────────────
it("universo atual tem exatamente 12 ligas sem Série C nem Série D", () => {
  expect(LIGAS_SUPORTADAS).toHaveLength(12);
  const brasil = LIGAS_SUPORTADAS.filter((l) => l.pais === "Brasil");
  expect(brasil.map((l) => l.id).sort()).toEqual(["brasileirao", "brasileirao-b"]);
  for (const id of ["brasileirao-c", "brasileirao-d"])
    expect(LIGAS_SUPORTADAS.some((l) => l.id === id)).toBe(false);
  for (const tm of ["BRA3", "BRA4"])
    expect(LIGAS_SUPORTADAS.map((l) => l.idTransfermarkt)).not.toContain(tm);
  expect(Object.keys(TEMPORADAS_INICIAIS).sort()).toEqual(
    LIGAS_SUPORTADAS.map((l) => l.id).sort(),
  );
});

it("N) deploy exige typecheck, test, test:ratings, snapshots e build antes de publicar", async () => {
  const workflow = await readFile(".github/workflows/deploy.yml", "utf8");
  const ordem = [
    "npm run snapshots:check-git",
    "npm run typecheck",
    "npm test",
    "npm run test:ratings",
    "npm run build",
  ].map((comando) => workflow.indexOf(comando));
  expect(ordem.every((i) => i > 0)).toBe(true);
  expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  // O job de deploy não roda sem a barreira.
  expect(workflow).toMatch(/needs: validate/);
  expect(workflow.indexOf("npm run build")).toBeLessThan(
    workflow.indexOf("needs: validate"),
  );
});

// ── Métricas por liga vs globais ────────────────────────────────────────────
function lotesDeDuasLigas() {
  const ligas = LIGAS_SUPORTADAS.slice(0, 2).map((l) => ({
    ...l,
    quantidadeClubes: 2,
  }));
  const lote = criarLoteCanonico(
    ligas.map((liga) => ({ liga, clubes: snapshot(liga).clubes })),
  );
  const porLiga = (id: string) =>
    new Set(lote.players.filter((p) => p.league === id).map((p) => p.id));
  return { ligas, lote, porLiga };
}

/** Provider que só responde à primeira liga e falha na segunda. */
function resultadoDesigual(lote: LoteCanonico, ligaComFalha: string) {
  const jogadores = lote.players;
  return {
    version: 1 as const,
    batchId: lote.batchId,
    players: jogadores.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources:
        p.league === ligaComFalha
          ? []
          : [
              {
                provider: "mock",
                externalPlayerId: `x-${p.id}`,
                ratingOriginal: 78,
                ratingNormalizado: 78,
                confidence: "exact" as const,
                matchedBy: ["dateOfBirth"],
                calibrationVersion: "mock-v1",
                attributes: {},
              },
            ],
    })),
    providers: {
      mock: {
        requests: jogadores.length,
        cacheHits: 0,
        // Contadores globais do lote: só a segunda liga falhou.
        errors: jogadores.filter((p) => p.league === ligaComFalha).length,
        staleMappings: 0,
        providerCandidates: jogadores.length,
        synthetic: true,
        status: "degraded" as const,
      },
    },
    diagnostics: {
      mock: Object.fromEntries(
        jogadores.map((p) => [
          p.id,
          p.league === ligaComFalha
            ? {
                confidence: "unmatched" as const,
                collision: false,
                matchedBy: [],
                candidateCount: 0,
                error: true,
              }
            : {
                confidence: "exact" as const,
                collision: false,
                matchedBy: ["dateOfBirth"],
                candidateCount: 2,
                error: false,
              },
        ]),
      ),
    },
  } satisfies ResultadoBot;
}

it("D/E/F) candidatos, erros e cobertura por liga são independentes", () => {
  const { ligas, lote, porLiga } = lotesDeDuasLigas();
  const resultado = resultadoDesigual(lote, ligas[1].id);
  const saudavel = metricasDaLiga(porLiga(ligas[0].id), resultado, 1, 0);
  const quebrada = metricasDaLiga(porLiga(ligas[1].id), resultado, 0, 0);

  expect(saudavel.requestFailures).toBe(0);
  expect(saudavel.providerStatus).toBe("healthy");
  expect(saudavel.exact).toBe(saudavel.playersTotal);
  expect(saudavel.providerCandidates).toBe(saudavel.playersTotal * 2);
  expect(saudavel.coverage).toBe(1);

  expect(quebrada.requestFailures).toBe(quebrada.playersTotal);
  expect(quebrada.providerStatus).toBe("failed");
  expect(quebrada.providerCandidates).toBe(0);
  expect(quebrada.unmatched).toBe(quebrada.playersTotal);
  expect(quebrada.coverage).toBe(0);

  // Métricas globais do lote continuam somando tudo.
  expect(resultado.providers.mock.providerCandidates).toBe(lote.players.length);
  expect(resultado.providers.mock.errors).toBe(quebrada.playersTotal);
  expect(saudavel.providerCandidates).toBeLessThan(
    resultado.providers.mock.providerCandidates +
      saudavel.providerCandidates,
  );
});

it("sem provider, a liga fica não-configurada em vez de falha técnica", () => {
  const { ligas, lote, porLiga } = lotesDeDuasLigas();
  const vazio = {
    version: 1 as const,
    batchId: lote.batchId,
    players: lote.players.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources: [],
    })),
    providers: {},
    diagnostics: {},
  } satisfies ResultadoBot;
  const m = metricasDaLiga(porLiga(ligas[0].id), vazio, 0, 0);
  expect(m.providerStatus).toBe("not-configured");
  expect(m.requestFailures).toBe(0);
  expect(m.fallbackEngine).toBe(m.playersTotal);
});

// ── Preflight ───────────────────────────────────────────────────────────────
it("K/L/M) preflight rejeita provider desconhecido, sem calibração e duplicado", async () => {
  await expect(preflightRatings(["mock", "mock"])).rejects.toThrow(/repetido/);
  await expect(preflightRatings(["fonte-inexistente"])).rejects.toThrow(
    /Unknown or unauthorized provider/,
  );
  const dir = await temp();
  const calibracao = join(dir, "calibracao.json");
  await writeFile(calibracao, JSON.stringify({ outro: {} }));
  await expect(
    preflightRatings(["mock"], { calibracao, cacheDir: join(dir, "cache") }),
  ).rejects.toThrow(/has no calibration entry/);
  await writeFile(
    calibracao,
    JSON.stringify({
      mock: {
        version: "v1",
        overall: [
          [1, 1],
          [99, 99],
        ],
        attributes: {
          pace: {
            target: "atributoInexistente",
            curve: [
              [1, 1],
              [99, 99],
            ],
          },
        },
      },
    }),
  );
  await expect(
    preflightRatings(["mock"], { calibracao, cacheDir: join(dir, "cache") }),
  ).rejects.toThrow(/alvo inexistente/);
});

it("preflight aprova provider real do repositório e reporta ausência de provider", async () => {
  const dir = await temp();
  const semProvider = await preflightRatings([], {
    cacheDir: join(dir, "cache"),
  });
  expect(semProvider.join("\n")).toMatch(
    /Providers externos habilitados: nenhum/,
  );
  const comProvider = await preflightRatings(["mock"], {
    cacheDir: join(dir, "cache"),
  });
  expect(comProvider.join("\n")).toMatch(/Provider: mock/);
  expect(comProvider.join("\n")).toMatch(/Calibration: mock-v1/);
  expect(comProvider.join("\n")).toMatch(/Synthetic: yes/);
});

// ── Comportamento sem provider externo ──────────────────────────────────────
async function pipeline(opcoes: Parameters<typeof atualizarBaseFutebol>[0]) {
  const dir = opcoes!.diretorio!;
  const ligas = LIGAS_SUPORTADAS.slice(0, 2).map((l) => ({
    ...l,
    quantidadeClubes: 2,
  }));
  const linhas: string[] = [];
  const resumo = await atualizarBaseFutebol({
    ligas,
    publicacao: { modo: "isolada", ligasEsperadas: ligas.map((l) => l.id) },
    reportDir: join(dir, "reports"),
    cacheDir: join(dir, "cache"),
    informar: (l) => linhas.push(l),
    preflight: async () => [],
    importar: async (liga, op) => {
      const dados = snapshot(liga);
      await salvarDadosLiga(dados, op!.diretorio);
      return { ...dados, temporadaTransfermarkt: dados.temporadaTransfermarkt! };
    },
    executarBot: async (lote) => ({
      version: 1,
      batchId: lote.batchId,
      players: lote.players.map((p) => ({
        id: p.id,
        transfermarktId: p.transfermarktId,
        sources: [],
      })),
      providers: {},
      diagnostics: {},
    }),
    ...opcoes,
  });
  return { resumo, linhas };
}

it("G) zero providers sem opt-in bloqueia e explica no terminal", async () => {
  const dir = await temp();
  const { resumo, linhas } = await pipeline({ diretorio: dir });
  expect(resumo.publicou).toBe(false);
  expect(linhas.join("\n")).toMatch(
    /Providers externos habilitados: nenhum.*--allow-engine-only/s,
  );
  await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
});

it("H) zero providers com opt-in publica quando não há regressão", async () => {
  const dir = await temp();
  const { resumo, linhas } = await pipeline({
    diretorio: dir,
    permitirEnginePuro: true,
  });
  expect(resumo.publicou).toBe(true);
  expect(linhas.join("\n")).toMatch(
    /Modo Rating Engine puro autorizado explicitamente/,
  );
  const relatorio = JSON.parse(
    await readFile(join(dir, "reports/saude-ratings.json"), "utf8"),
  );
  // Cada liga recebe suas próprias métricas no relatório.
  expect(relatorio.ligas).toHaveLength(2);
  for (const liga of relatorio.ligas) {
    expect(liga.status).toBe("fallback_esperado");
    expect(liga.metricas.providerStatus).toBe("not-configured");
    expect(liga.metricas.playersTotal).toBeGreaterThan(0);
    expect(liga.metricas.fallbackEngine).toBe(liga.metricas.playersTotal);
  }
});

it("I) base anterior enriquecida bloqueia mesmo com opt-in", async () => {
  const dir = await temp();
  const enriquecido = async (lote: LoteCanonico) => ({
    version: 1 as const,
    batchId: lote.batchId,
    players: lote.players.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources: [
        {
          provider: "mock",
          externalPlayerId: `x-${p.id}`,
          ratingOriginal: 78,
          ratingNormalizado: 78,
          confidence: "exact" as const,
          matchedBy: ["dateOfBirth"],
          calibrationVersion: "mock-v1",
          attributes: {},
        },
      ],
    })),
    providers: {
      mock: {
        requests: 1,
        cacheHits: 0,
        errors: 0,
        staleMappings: 0,
        providerCandidates: lote.players.length,
        synthetic: true,
        status: "healthy" as const,
      },
    },
    diagnostics: {
      mock: Object.fromEntries(
        lote.players.map((p) => [
          p.id,
          {
            confidence: "exact" as const,
            collision: false,
            matchedBy: ["dateOfBirth"],
            candidateCount: 1,
            error: false,
          },
        ]),
      ),
    },
  });
  const primeira = await pipeline({
    diretorio: dir,
    executarBot: enriquecido,
  });
  expect(primeira.resumo.publicou).toBe(true);
  const antes = await readFile(join(dir, "active.json"), "utf8");
  const segunda = await pipeline({
    diretorio: dir,
    permitirEnginePuro: true,
  });
  expect(segunda.resumo.publicou).toBe(false);
  expect(await readFile(join(dir, "active.json"), "utf8")).toBe(antes);
});

it("J) provider sintético não alimenta publicação oficial", async () => {
  const dir = await temp();
  await expect(
    pipeline({
      diretorio: dir,
      publicacao: undefined,
      executarBot: async (lote) => ({
        version: 1,
        batchId: lote.batchId,
        players: lote.players.map((p) => ({
          id: p.id,
          transfermarktId: p.transfermarktId,
          sources: [],
        })),
        providers: {
          mock: {
            requests: 1,
            cacheHits: 0,
            errors: 0,
            staleMappings: 0,
            providerCandidates: 0,
            synthetic: true,
            status: "healthy",
          },
        },
        diagnostics: { mock: {} },
      }),
    }),
  ).resolves.toMatchObject({ resumo: { publicou: false } });
});

// ── Potencial ───────────────────────────────────────────────────────────────
const entrada = {
  seed: "v5",
  nome: "Teste",
  posicaoBruta: "Centre-Forward",
  idade: 24,
  valorMercado: 5_000_000,
  altura: 180,
  reputacaoLiga: 80,
  reputacaoClube: 70,
  forcaMediaLiga: 72,
  indiceNoElenco: 3,
  tamanhoElenco: 25,
};
const fonte = {
  provider: "mock",
  externalPlayerId: "x1",
  ratingOriginal: 80,
  ratingNormalizado: 80,
  confidence: "exact" as const,
  matchedBy: ["dateOfBirth"],
  calibrationVersion: "mock-v1",
  attributes: {},
};

it.each([17, 31, 32, 40])(
  "potencial respeita overall e teto aos %i anos",
  (idade) => {
    for (const potentialNormalizado of [1, 60, 99]) {
      const r = resolverRating({ ...entrada, idade }, [
        { ...fonte, potentialNormalizado },
      ]);
      expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
      expect(r.potencial).toBeLessThanOrEqual(99);
      if (idade >= 32) expect(r.potencial).toBe(r.overall);
    }
  },
);

it("potencial externo inferior ao overall nunca rebaixa o jogador", () => {
  const r = resolverRating({ ...entrada, idade: 20 }, [
    { ...fonte, ratingNormalizado: 90, potentialNormalizado: 40 },
  ]);
  expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
});

it("overall 99 mantém potencial dentro da escala", () => {
  const r = resolverRating({ ...entrada, idade: 25 }, [
    { ...fonte, ratingNormalizado: 99, potentialNormalizado: 99 },
  ]);
  expect(r.overall).toBeLessThanOrEqual(99);
  expect(r.potencial).toBeLessThanOrEqual(99);
  expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
});
