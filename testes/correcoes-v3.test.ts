import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile, readdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import { SPORTMONKS_LIGAS } from "@/dominio/constantes/sportmonks-ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  normalizarRatingMetadata,
  esquemaRatingMetadata,
} from "@/dominio/rating-metadata";
import { ClienteSportmonks } from "@/infraestrutura/sportmonks/cliente";
import {
  resolverSeasonId,
  enriquecerLigaComSportmonks,
} from "@/infraestrutura/sportmonks/enriquecer-liga";
import {
  avaliarSaudeEnriquecimento,
  metricasVazias,
  quedaSeveraEnriquecimento,
} from "@/infraestrutura/sportmonks/saude-enriquecimento";
import {
  publicarReleaseAtomica,
  lerDadosLiga,
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { validarSnapshotsVersionados } from "@/infraestrutura/persistencia/validar-snapshots-git";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";

const dirs: string[] = [];
async function temporario() {
  const dir = await mkdtemp(join(tmpdir(), "viztto-v3-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});

function snapshot(liga = LIGAS_SUPORTADAS[0]): DadosLigaImportados {
  const cal = TEMPORADAS_INICIAIS[liga.id];
  const modelo = gerarClubesDemonstracao(liga)[0];
  const clubes = Array.from({ length: liga.quantidadeClubes }, (_, i) => {
    const c = structuredClone(modelo);
    c.id = `${liga.id}-c${i}`;
    c.nome = `Equipe ${i}`;
    c.idTransfermarkt = c.id;
    c.elenco = Array.from({ length: 25 }, (_, j) => ({
      ...structuredClone(modelo.elenco[j % modelo.elenco.length]),
      id: `${c.id}-j${j}`,
      idTransfermarkt: `${c.id}-j${j}`,
      clubeId: c.id,
      nome: `Atleta ${i} Numero ${j}`,
      dataNascimento: `${1990 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-${String(j + 1).padStart(2, "0")}`,
    }));
    c.tamanhoElenco = 25;
    return c;
  });
  return {
    ligaId: liga.id,
    temporada: cal.ano,
    temporadaTransfermarkt: cal.temporadaTransfermarkt,
    inicio: cal.inicio,
    importadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    status: "completo",
    progresso: {
      total: clubes.length,
      importados: clubes.length,
      falhas: 0,
      clubeAtual: null,
    },
    clubes,
    erros: [],
  };
}

it.each([
  ["premier-league", 8, "2026/2027"],
  ["brasileirao", 648, "2026"],
] as const)(
  "URL real de %s pesquisa label e filtra liga",
  async (id, league, label) => {
    const urls: URL[] = [];
    const cliente = new ClienteSportmonks({
      token: "fake",
      usarCache: false,
      intervaloMs: 0,
      fetchImpl: (async (input) => {
        const url = new URL(String(input));
        urls.push(url);
        const data = { id: 123, league_id: league, name: label };
        if (
          url.pathname ===
          `/v3/football/seasons/search/${encodeURIComponent(label)}`
        ) {
          expect(url.searchParams.get("filters")).toBe(
            `seasonLeagues:${league}`,
          );
          return Response.json({ data: [data] });
        }
        expect(url.pathname).toBe("/v3/football/seasons/123");
        expect(url.searchParams.get("include")).toBe("league");
        return Response.json({ data });
      }) as typeof fetch,
    });
    expect(
      (await resolverSeasonId(cliente, SPORTMONKS_LIGAS[id], label)).seasonId,
    ).toBe(123);
    expect(urls).toHaveLength(2);
    expect(decodeURIComponent(urls[0].pathname)).not.toContain(
      "Premier League",
    );
    expect(decodeURIComponent(urls[0].pathname)).not.toContain("Brasileirão");
  },
);

it.each([
  { id: 123, league_id: 8, name: "2025/2026" },
  { id: 123, league_id: 648, name: "2026/2027" },
  {},
  { id: 999, league_id: 8, name: "2026/2027" },
])("rejeita detalhe de season inválido: %j", async (data) => {
  const cliente = new ClienteSportmonks({
    token: "fake",
    usarCache: false,
    intervaloMs: 0,
    fetchImpl: (async () => Response.json({ data })) as typeof fetch,
  });
  expect(
    (
      await resolverSeasonId(
        cliente,
        {
          idSportmonks: 8,
          seasonIdPreferido: 123,
          seasonStrategy: "preferido",
        },
        "2026/2027",
      )
    ).seasonId,
  ).toBeNull();
});

it("publica 13; rejeita 12, 1, duplicada e inesperada preservando active", async () => {
  const dir = await temporario();
  const todos = LIGAS_SUPORTADAS.map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  await publicarReleaseAtomica(todos, dir);
  const antes = await readFile(join(dir, "active.json"), "utf8");
  for (const candidatos of [
    todos.slice(0, 12),
    todos.slice(0, 1),
    [...todos.slice(0, 12), todos[0]],
    [...todos.slice(0, 12), { ...todos[12], ligaId: "inesperada" }],
  ]) {
    await expect(publicarReleaseAtomica(candidatos, dir)).rejects.toThrow();
    expect(await readFile(join(dir, "active.json"), "utf8")).toBe(antes);
  }
  for (const liga of LIGAS_SUPORTADAS)
    expect((await lerDadosLiga(liga.id, dir))?.ligaId).toBe(liga.id);
});

it("permite universo isolado de duas ligas apenas explicitamente", async () => {
  const dir = await temporario();
  const candidatos = LIGAS_SUPORTADAS.slice(0, 2).map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  await expect(publicarReleaseAtomica(candidatos, dir)).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
  await publicarReleaseAtomica(candidatos, dir, {
    publicacao: {
      modo: "isolada",
      ligasEsperadas: candidatos.map((c) => c.ligaId),
    },
  });
  expect(await lerDadosLiga(candidatos[1].ligaId, dir)).not.toBeNull();
});

it.each([
  [0.15, 0.05, true],
  [0.35, 0.12, true],
  [0.7, 0.4, false],
  [0.7, 0.1, true],
  [0.35, 0.33, false],
])("queda %s → %s: severa=%s", (anterior, atual, severa) => {
  expect(quedaSeveraEnriquecimento(atual as number, anterior as number)).toBe(
    severa,
  );
});

it.each(["A", "B"] as const)(
  "bootstrap %s exige opt-in e crítico nunca passa",
  (cobertura) => {
    const entrada = {
      cobertura,
      taxaAtual: 0.4,
      metricas: metricasVazias({
        timesEsperados: 20,
        timesEncontrados: 8,
        squadsSolicitados: 8,
        squadsObtidos: 8,
        jogadoresTm: 500,
        matches: 200,
        comStats: 200,
      }),
    };
    expect(avaliarSaudeEnriquecimento(entrada).abortarPublicacao).toBe(true);
    expect(
      avaliarSaudeEnriquecimento({
        ...entrada,
        permitirBootstrapDegradado: true,
      }),
    ).toMatchObject({
      status: "degradado",
      abortarPublicacao: false,
    });
    expect(
      avaliarSaudeEnriquecimento({
        ...entrada,
        metricas: metricasVazias(),
        permitirBootstrapDegradado: true,
      }),
    ).toMatchObject({
      status: "falha_critica",
      abortarPublicacao: true,
    });
  },
);

it("normalizador seleciona conhecidos, save permanece strict", () => {
  const metadata = {
    source: "sportmonks",
    confidence: "high",
    minutes: 1800,
    extraField: "futuro",
  };
  expect(normalizarRatingMetadata(metadata)).toEqual({
    source: "sportmonks",
    confidence: "high",
    minutes: 1800,
  });
  expect(esquemaRatingMetadata.safeParse(metadata).success).toBe(false);
  expect(
    normalizarRatingMetadata({ ...metadata, confidence: "invalida" }),
  ).toBeUndefined();
});

it("clone lógico versionado lê todas as ligas e referência ausente é rejeitada", async () => {
  const dir = await temporario(),
    clone = await temporario();
  const todos = LIGAS_SUPORTADAS.map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  for (const c of todos) await salvarDadosLiga(c.dados, dir);
  const { releaseId } = await publicarReleaseAtomica(todos, dir);
  expect((await readdir(dir)).sort()).toEqual(["active.json", "releases"]);
  await cp(dir, clone, { recursive: true });
  const ler = async (caminho: string) => {
    try {
      return await readFile(
        join(clone, caminho.replace("src/dados/futebol/", "")),
        "utf8",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  };
  await validarSnapshotsVersionados(ler);
  for (const l of LIGAS_SUPORTADAS)
    expect((await lerDadosLiga(l.id, clone))?.ligaId).toBe(l.id);
  await rm(join(clone, "releases", releaseId), { recursive: true });
  await expect(validarSnapshotsVersionados(ler)).rejects.toThrow("ausente");
  await expect(lerDadosLiga("premier-league", clone)).rejects.toThrow(
    "NÃO será usado",
  );
});

// Respostas seguem GET Team Squad by Team and Season ID: data[] + player + details.type.
// https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-squads/get-team-squad-by-team-and-season-id
it.each([
  [20, false, true],
  [8, false, false],
  [8, true, true],
  [1, true, false],
])(
  "pipeline fake: %s teams, opt-in=%s, publica=%s",
  async (nTeams, optIn, publica) => {
    const dir = await temporario();
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "premier-league")!;
    const dados = snapshot(liga);
    const requests: string[] = [];
    const inesperadas: string[] = [];
    const cliente = new ClienteSportmonks({
      token: "fake",
      usarCache: false,
      intervaloMs: 0,
      fetchImpl: (async (input) => {
        const url = new URL(String(input));
        requests.push(url.pathname);
        const season = { id: 123, league_id: 8, name: "2026/2027" };
        if (url.pathname === "/v3/football/seasons/search/2026%2F2027") {
          expect(url.searchParams.get("filters")).toBe("seasonLeagues:8");
          return Response.json({ data: [season] });
        }
        if (url.pathname === "/v3/football/seasons/123")
          return Response.json({ data: season });
        if (url.pathname === "/v3/football/teams/seasons/123")
          return Response.json({
            data: dados.clubes
              .slice(0, nTeams)
              .map((c, i) => ({ id: i + 1, name: c.nome })),
            pagination: { has_more: false },
          });
        const squad = url.pathname.match(
          /^\/v3\/football\/squads\/seasons\/123\/teams\/(\d+)$/,
        );
        if (squad) {
          expect(url.searchParams.get("include")).toBe(
            "player;player.nationality;details.type",
          );
          const i = Number(squad[1]) - 1;
          return Response.json({
            data: dados.clubes[i].elenco.map((j, k) => ({
              id: i * 25 + k + 1,
              player_id: i * 25 + k + 1,
              team_id: i + 1,
              season_id: 123,
              player: {
                id: i * 25 + k + 1,
                name: j.nome,
                date_of_birth: j.dataNascimento,
                height: j.altura,
              },
              details:
                k < 15
                  ? [
                      {
                        type_id: 119,
                        value: { total: 1800 },
                        type: { developer_name: "MINUTES_PLAYED" },
                      },
                      {
                        type_id: 321,
                        value: { total: 25 },
                        type: { developer_name: "APPEARANCES" },
                      },
                    ]
                  : [],
            })),
          });
        }
        inesperadas.push(url.toString());
        return Response.json({ message: "URL inesperada" }, { status: 400 });
      }) as typeof fetch,
    });
    const resultado = await atualizarBaseFutebol({
      diretorio: dir,
      ligas: [liga],
      publicacao: { modo: "isolada", ligasEsperadas: [liga.id] },
      permitirBootstrapDegradado: optIn,
      informar: () => {},
      importar: async (_, op) => {
        await salvarDadosLiga(dados, op!.diretorio);
        return {
          ...dados,
          temporadaTransfermarkt: dados.temporadaTransfermarkt!,
        };
      },
      enriquecer: (l, c, op) =>
        enriquecerLigaComSportmonks(l, c, {
          ...op,
          cliente,
          mappingPath: join(dir, "mapping.json"),
        }),
    });
    expect(inesperadas).toEqual([]);
    expect(requests.filter((p) => p.includes("/squads/"))).toHaveLength(nTeams);
    expect(resultado.publicou).toBe(publica);
    expect(resultado.temFalhas).toBe(!publica);
    if (publica) {
      expect(resultado.statusLote).toBe(
        nTeams === 20 ? "sucesso" : "atualizacao_degradada",
      );
      expect((await lerDadosLiga(liga.id, dir))!.clubes).toHaveLength(20);
      expect(resultado.ligas[0].sportmonks?.matched).toBe(nTeams * 25);
    } else {
      await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
    }
  },
);

it("nome da liga nunca é aceito como label de season", async () => {
  const fetchImpl = vi.fn();
  const cliente = new ClienteSportmonks({
    token: "fake",
    fetchImpl,
    usarCache: false,
  });
  expect(
    (
      await resolverSeasonId(
        cliente,
        SPORTMONKS_LIGAS["premier-league"],
        "Premier League",
      )
    ).seasonId,
  ).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("atualizador oficial não publica lista parcial mesmo saudável", async () => {
  const dir = await temporario();
  const liga = LIGAS_SUPORTADAS[0],
    dados = snapshot(liga);
  const resultado = await atualizarBaseFutebol({
    diretorio: dir,
    ligas: [liga],
    informar: () => {},
    importar: async (_, op) => {
      await salvarDadosLiga(dados, op!.diretorio);
      return {
        ...dados,
        temporadaTransfermarkt: dados.temporadaTransfermarkt!,
      };
    },
    enriquecer: async (_, clubes) => ({
      clubes,
      status: "ok",
      relatorio: {
        ligaId: liga.id,
        cobertura: "A",
        total: 500,
        matched: [],
        unmatched: [],
        ambiguous: [],
        requests: 0,
        saude: "saudavel",
      },
    }),
  });
  expect(resultado).toMatchObject({
    publicou: false,
    statusLote: "falha_critica",
  });
  await expect(readFile(join(dir, "active.json"))).rejects.toThrow();
});

it("save completo rejeita metadata com extras", async () => {
  const { exemploCarreira } = await import("./auxiliar-carreira-persistida");
  const { serializarCarreira, validarCarreiraPersistida } =
    await import("@/infraestrutura/persistencia/carreira-persistida");
  const save = serializarCarreira(exemploCarreira().carreira);
  Object.assign(save.clubesDinamicos[0].elenco[0], {
    ratingMetadata: {
      source: "sportmonks",
      confidence: "high",
      campoFuturo: "x",
    },
  });
  expect(() => validarCarreiraPersistida(save)).toThrow();
});

it("season errada bloqueia bootstrap A/B também no enrichment", async () => {
  const dir = await temporario();
  const liga = LIGAS_SUPORTADAS.find(l => l.id === "premier-league")!;
  const cliente = new ClienteSportmonks({
    token: "fake", usarCache: false, intervaloMs: 0,
    fetchImpl: (async () => Response.json({
      data: [{ id: 123, name: "2025/2026", league_id: 8 }],
    })) as typeof fetch,
  });
  const resultado = await enriquecerLigaComSportmonks(liga, snapshot(liga).clubes, {
    cliente, mappingPath: join(dir, "mapping.json"), temporadaLabel: "2026/2027",
    permitirBootstrapDegradado: true, informar: () => {},
  });
  expect(resultado).toMatchObject({ status: "falha_critica", abortarPublicacao: true });
});
