import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarLoteCanonico } from "@/infraestrutura/ratings/lote";
import {
  validarResultadoBot,
  type LoteCanonico,
  type ResultadoBot,
} from "@/infraestrutura/ratings/contrato";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import type { Liga } from "@/dominio/entidades/modelos";

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function temp() {
  const d = await mkdtemp(join(tmpdir(), "v6-"));
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

function loteMinimo() {
  const liga = { ...LIGAS_SUPORTADAS[0]!, quantidadeClubes: 2 };
  return criarLoteCanonico([{ liga, clubes: snapshot(liga).clubes }]);
}

function diag(
  confidence: "exact" | "high" | "medium" | "low" | "ambiguous" | "unmatched",
  extras: Partial<{ collision: boolean; error: boolean; candidateCount: number }> = {},
) {
  return {
    confidence,
    collision: extras.collision ?? false,
    matchedBy: confidence === "exact" || confidence === "high" ? ["dateOfBirth"] : [],
    candidateCount: extras.candidateCount ?? 0,
    error: extras.error ?? false,
  };
}

function resultadoCompleto(
  lote: LoteCanonico,
  op: {
    confidence?: "exact" | "high" | "medium" | "low" | "ambiguous" | "unmatched";
    comSource?: boolean;
    status?: "healthy" | "degraded" | "failed";
    collision?: boolean;
    omitirUltimo?: boolean;
    jogadorExtra?: string;
    semDiagnostics?: boolean;
    providerFantasma?: boolean;
  } = {},
): ResultadoBot {
  const confidence = op.confidence ?? "exact";
  const comSource = op.comSource ?? ["exact", "high"].includes(confidence);
  const players = lote.players.map((p) => ({
    id: p.id,
    transfermarktId: p.transfermarktId,
    sources: comSource
      ? [
          {
            provider: "mock",
            externalPlayerId: `x-${p.id}`,
            ratingOriginal: 78,
            ratingNormalizado: 78,
            confidence: confidence as "exact" | "high" | "medium" | "low",
            matchedBy: ["dateOfBirth"],
            calibrationVersion: "mock-v1",
            attributes: {},
          },
        ]
      : [],
  }));
  const ids = lote.players.map((p) => p.id);
  const diagEntries = ids.map((id) => [
    id,
    diag(confidence, { collision: op.collision }),
  ]);
  if (op.omitirUltimo) diagEntries.pop();
  if (op.jogadorExtra)
    diagEntries.push([op.jogadorExtra, diag("unmatched")]);
  return {
    version: 1,
    batchId: lote.batchId,
    players,
    providers: op.providerFantasma
      ? {}
      : {
          mock: {
            requests: 1,
            cacheHits: 0,
            errors: 0,
            staleMappings: 0,
            providerCandidates: ids.length,
            synthetic: true,
            status: op.status ?? "healthy",
          },
        },
    diagnostics: op.semDiagnostics
      ? {}
      : op.providerFantasma
        ? { mock: Object.fromEntries(diagEntries) }
        : { mock: Object.fromEntries(diagEntries) },
  };
}

// ── Contrato: diagnostics completos ─────────────────────────────────────────
it("A) diagnostics incompletos rejeitam o contrato", () => {
  const lote = loteMinimo();
  expect(() =>
    validarResultadoBot(resultadoCompleto(lote, { omitirUltimo: true }), lote),
  ).toThrow(/diagnostic por jogador/);
});

it("B) diagnostic de jogador inexistente rejeita", () => {
  const lote = loteMinimo();
  expect(() =>
    validarResultadoBot(
      resultadoCompleto(lote, { jogadorExtra: "estranho" }),
      lote,
    ),
  ).toThrow(/diagnostic por jogador/);
});

it("C) provider sem diagnostics rejeita", () => {
  const lote = loteMinimo();
  expect(() =>
    validarResultadoBot(resultadoCompleto(lote, { semDiagnostics: true }), lote),
  ).toThrow(/providers e diagnostics/);
});

it("D) diagnostics de provider não declarado rejeita", () => {
  const lote = loteMinimo();
  expect(() =>
    validarResultadoBot(resultadoCompleto(lote, { providerFantasma: true }), lote),
  ).toThrow(/providers e diagnostics/);
});

it.each(["unmatched", "medium", "ambiguous"] as const)(
  "E/F/G) %s sem source mas com diagnostic aceita",
  (confidence) => {
    const lote = loteMinimo();
    const r = resultadoCompleto(lote, { confidence, comSource: false });
    expect(validarResultadoBot(r, lote)).toEqual(r);
  },
);

it.each(["medium", "low"] as const)(
  "H/I) source %s rejeita mesmo com diagnostic",
  (confidence) => {
    const lote = loteMinimo();
    expect(() =>
      validarResultadoBot(
        resultadoCompleto(lote, { confidence, comSource: true }),
        lote,
      ),
    ).toThrow(/exact ou high/);
  },
);

it("J) collision=true com source rejeita", () => {
  const lote = loteMinimo();
  expect(() =>
    validarResultadoBot(
      resultadoCompleto(lote, { confidence: "exact", collision: true }),
      lote,
    ),
  ).toThrow(/diagnóstico incompatível/);
});

// ── allow-engine-only ───────────────────────────────────────────────────────
async function pipeline(
  opcoes: Parameters<typeof atualizarBaseFutebol>[0] & {
    bot?: (lote: LoteCanonico) => Promise<ResultadoBot> | ResultadoBot;
  },
) {
  const dir = opcoes!.diretorio!;
  const { bot, ...resto } = opcoes;
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
    ...resto,
    executarBot: async (lote) =>
      bot ? await bot(lote) : {
        version: 1,
        batchId: lote.batchId,
        players: lote.players.map((p) => ({
          id: p.id,
          transfermarktId: p.transfermarktId,
          sources: [],
        })),
        providers: {},
        diagnostics: {},
      },
  });
  return { resumo, linhas };
}

function botFailed(lote: LoteCanonico): ResultadoBot {
  return {
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
        errors: lote.players.length,
        staleMappings: 0,
        providerCandidates: 0,
        synthetic: true,
        status: "failed",
      },
    },
    diagnostics: {
      mock: Object.fromEntries(
        lote.players.map((p) => [p.id, diag("unmatched", { error: true })]),
      ),
    },
  };
}

function botHealthyZeroMatches(lote: LoteCanonico): ResultadoBot {
  return {
    version: 1,
    batchId: lote.batchId,
    players: lote.players.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources: [],
    })),
    providers: {
      mock: {
        requests: lote.players.length,
        cacheHits: 0,
        errors: 0,
        staleMappings: 0,
        providerCandidates: lote.players.length,
        synthetic: true,
        status: "healthy",
      },
    },
    diagnostics: {
      mock: Object.fromEntries(
        lote.players.map((p) => [
          p.id,
          diag("unmatched", { candidateCount: 1 }),
        ]),
      ),
    },
  };
}

it("allow-engine-only com provider failed bloqueia", async () => {
  const dir = await temp();
  const { resumo, linhas } = await pipeline({
    diretorio: dir,
    providers: ["mock"],
    permitirEnginePuro: true,
    bot: async (lote) => botFailed(lote),
  });
  expect(resumo.publicou).toBe(false);
  expect(linhas.join("\n")).toMatch(/só é válido quando nenhum provider/);
});

it("todos providers failed bloqueiam mesmo sem allow-engine-only", async () => {
  const dir = await temp();
  const { resumo, linhas } = await pipeline({
    diretorio: dir,
    providers: ["mock"],
    bot: async (lote) => botFailed(lote),
  });
  expect(resumo.publicou).toBe(false);
  expect(linhas.join("\n")).toMatch(/Provider externo foi configurado, mas falhou/);
});

it("um provider failed + outro healthy avalia health normalmente", async () => {
  const dir = await temp();
  const { resumo } = await pipeline({
    diretorio: dir,
    providers: ["mock", "mock-b"],
    bot: async (lote) => ({
      version: 1,
      batchId: lote.batchId,
      players: lote.players.map((p) => ({
        id: p.id,
        transfermarktId: p.transfermarktId,
        sources: [
          {
            provider: "mock-b",
            externalPlayerId: `b-${p.id}`,
            ratingOriginal: 78,
            ratingNormalizado: 78,
            confidence: "exact",
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
          errors: lote.players.length,
          staleMappings: 0,
          providerCandidates: 0,
          synthetic: true,
          status: "failed",
        },
        "mock-b": {
          requests: 1,
          cacheHits: 0,
          errors: 0,
          staleMappings: 0,
          providerCandidates: lote.players.length,
          synthetic: true,
          status: "healthy",
        },
      },
      diagnostics: {
        mock: Object.fromEntries(
          lote.players.map((p) => [p.id, diag("unmatched", { error: true })]),
        ),
        "mock-b": Object.fromEntries(
          lote.players.map((p) => [p.id, diag("exact", { candidateCount: 1 })]),
        ),
      },
    }),
  });
  expect(resumo.publicou).toBe(true);
});

it("zero matches com provider saudável não é falha técnica automática", async () => {
  const dir = await temp();
  // Sem cobertura anterior e sem allow: health ainda bloqueia por zero externo
  // quando providerStatus !== not-configured? Com a nova regra, semExterno +
  // provider configurado NÃO usa allow-engine-only — publica se não houver regressão.
  const { resumo } = await pipeline({
    diretorio: dir,
    providers: ["mock"],
    bot: async (lote) => botHealthyZeroMatches(lote),
  });
  expect(resumo.publicou).toBe(true);
  const saude = JSON.parse(
    await readFile(join(dir, "reports/saude-ratings.json"), "utf8"),
  );
  expect(saude.ligas.every((l: { status: string }) => l.status === "fallback_esperado")).toBe(
    true,
  );
  expect(
    saude.ligas.every(
      (l: { metricas: { providerStatus: string } }) =>
        l.metricas.providerStatus === "healthy",
    ),
  ).toBe(true);
});

it("Série C e D ausentes do universo e dos snapshots versionados", async () => {
  expect(LIGAS_SUPORTADAS.map((l) => l.id)).not.toEqual(
    expect.arrayContaining(["brasileirao-c", "brasileirao-d"]),
  );
  const { readdir } = await import("node:fs/promises");
  const arquivos = await readdir("src/dados/futebol");
  expect(arquivos).not.toContain("brasileirao-c.json");
  expect(arquivos).not.toContain("brasileirao-d.json");
});
