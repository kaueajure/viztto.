/**
 * Pós–Fase 12 — hardening: releases atômicas, publicação estrita,
 * freeze de atributos no save, season consciente, saúde SM.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  TEMPORADAS_INICIAIS,
  normalizarLabelTemporadaSportmonks,
  temporadaSportmonksCompativel,
} from "@/dominio/constantes/temporadas-iniciais";
import { SPORTMONKS_LIGAS } from "@/dominio/constantes/sportmonks-ligas";
import { criarAtributosUniformes } from "@/dominio/regras/jogador";
import { NOMES_ATRIBUTOS, type Clube, type JogadorMundo } from "@/dominio/entidades/modelos";
import {
  validarDisponibilidadeLiga,
  validarPublicacaoLiga,
} from "@/infraestrutura/persistencia/base-futebol";
import {
  definirDiretorioImportacao,
  obterDiretorioImportacao,
  lerDadosLiga,
  lerManifestoAtivo,
  publicarReleaseAtomica as publicarRelease,
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  hidratarCarreira,
  serializarCarreira,
} from "@/infraestrutura/persistencia/carreira-persistida";
import { resolverSeasonId } from "@/infraestrutura/sportmonks/enriquecer-liga";
import { ClienteSportmonks } from "@/infraestrutura/sportmonks/cliente";
import {
  avaliarSaudeEnriquecimento,
  metricasVazias,
} from "@/infraestrutura/sportmonks/saude-enriquecimento";
import type { RatingMetadata } from "@/dominio/rating-metadata";
import { exemploCarreira } from "./auxiliar-carreira-persistida";

const publicarReleaseAtomica: typeof publicarRelease = (candidatos, destino, opcoes) =>
  publicarRelease(candidatos, destino, { ...opcoes, publicacao: { modo: "isolada", ligasEsperadas: candidatos.map(c => c.ligaId) } });

const dirOriginal = obterDiretorioImportacao();
const limpeza: string[] = [];

afterEach(async () => {
  definirDiretorioImportacao(dirOriginal);
  for (const d of limpeza.splice(0))
    await rm(d, { recursive: true, force: true });
});

function snapshotCompleto(
  ligaId: string,
  nClubes: number,
  overrides?: Partial<DadosLigaImportados>,
): DadosLigaImportados {
  const cal = TEMPORADAS_INICIAIS[ligaId]!;
  const agora = new Date().toISOString();
  const clubes = Array.from({ length: nClubes }, (_, i) => ({
    id: `${ligaId}-c${i}`,
    idExterno: i + 1,
    idTransfermarkt: String(1000 + i),
    ligaId,
    nome: `Clube ${i}`,
    nomeCurto: `C${i}`,
    nomeOficial: `Clube ${i}`,
    codigo: `C${i}`,
    pais: "BR",
    fundacao: 1900,
    escudo: "",
    estadio: "Arena",
    capacidadeEstadio: 40000,
    tamanhoElenco: 1,
    idadeMedia: 25,
    valorElenco: 1_000_000,
    registroTransferencias: null,
    formacaoPreferida: "4-3-3" as const,
    goleiroTitularId: null,
    titularesIds: [] as string[],
    bancoIds: [] as string[],
    reputacao: 70,
    forcaGeral: 70,
    forcaAtaque: 70,
    forcaMeio: 70,
    forcaDefesa: 70,
    qualidadeBase: 60,
    poderFinanceiro: 50,
    orcamento: 1_000_000,
    forma: 70,
    moral: 70,
    fadiga: 20,
    dadosBrutos: null,
    elenco: [
      {
        id: `${ligaId}-j${i}`,
        idExterno: i + 1,
        idTransfermarkt: String(2000 + i),
        nome: `Jogador ${i}`,
        dataNascimento: "1998-01-01",
        idade: 27,
        nacionalidade: ["Brasil"],
        posicaoPrincipal: "CA" as const,
        posicoesSecundarias: [] as [],
        posicao: "Centre-Forward",
        grupoPosicao: "ATA" as const,
        peDominante: "direito",
        altura: 180,
        numero: 9,
        clubeId: `${ligaId}-c${i}`,
        overall: 70,
        potencial: 75,
        forma: 70,
        moral: 70,
        condicionamento: 70,
        fadiga: 20,
        valorMercado: 1_000_000,
        salario: 10_000,
        contratoAte: "2028-12-31",
        joinedOn: null,
        signedFrom: null,
        foto: "",
        lesionado: false,
        lesao: null,
        suspensao: 0,
        statusElenco: "titular" as const,
        estatisticasCarreira: {
          jogos: 0,
          titularidades: 0,
          minutos: 0,
          gols: 0,
          assistencias: 0,
          amarelos: 0,
          vermelhos: 0,
          somaNotas: 0,
        },
      },
    ],
  })) as unknown as Clube[];

  return {
    ligaId,
    temporada: cal.ano,
    temporadaTransfermarkt: cal.temporadaTransfermarkt,
    inicio: cal.inicio,
    importadoEm: agora,
    atualizadoEm: agora,
    status: "completo",
    progresso: {
      total: nClubes,
      importados: nClubes,
      falhas: 0,
      clubeAtual: null,
    },
    clubes,
    erros: [],
    ...overrides,
  };
}

describe("Fase 12 — release atômica (ponteiro active.json)", () => {
  it("A) morte antes da troca do manifesto mantém release A 100% ativa", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f12-a-"));
    limpeza.push(dir);
    const liga = LIGAS_SUPORTADAS[0]!;
    const a = snapshotCompleto(liga.id, 4);
    a.clubes.forEach((c) => {
      c.elenco[0]!.overall = 60;
    });
    const { releaseId: idA } = await publicarReleaseAtomica(
      [{ ligaId: liga.id, dados: a }],
      dir,
    );
    expect((await lerManifestoAtivo(dir))!.releaseId).toBe(idA);
    expect((await lerDadosLiga(liga.id, dir))!.clubes[0]!.elenco[0]!.overall).toBe(
      60,
    );

    // Simula release B montada mas processo morto antes do rename do active.json
    const idB = `r-fake-b`;
    const releaseB = join(dir, "releases", idB);
    await mkdir(releaseB, { recursive: true });
    const b = snapshotCompleto(liga.id, 4);
    b.clubes.forEach((c) => {
      c.elenco[0]!.overall = 99;
    });
    await salvarDadosLiga(b, releaseB);
    // NÃO troca active.json
    expect((await lerManifestoAtivo(dir))!.releaseId).toBe(idA);
    expect((await lerDadosLiga(liga.id, dir))!.clubes[0]!.elenco[0]!.overall).toBe(
      60,
    );
  });

  it("B) troca única do manifesto ativa todas as ligas da release B", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f12-b-"));
    limpeza.push(dir);
    const ligas = LIGAS_SUPORTADAS.slice(0, 2);
    await publicarReleaseAtomica(
      ligas.map((l) => ({
        ligaId: l.id,
        dados: snapshotCompleto(l.id, 3),
      })),
      dir,
    );
    const bDados = ligas.map((l) => {
      const s = snapshotCompleto(l.id, 3);
      s.clubes.forEach((c) => {
        c.elenco[0]!.overall = 88;
      });
      return { ligaId: l.id, dados: s };
    });
    const { releaseId } = await publicarReleaseAtomica(bDados, dir);
    expect((await lerManifestoAtivo(dir))!.releaseId).toBe(releaseId);
    for (const l of ligas) {
      expect(
        (await lerDadosLiga(l.id, dir))!.clubes[0]!.elenco[0]!.overall,
      ).toBe(88);
    }
  });
});

describe("Fase 12 — gate de publicação oficial", () => {
  it("C) 18/20 não substitui 20/20; 20/20 substitui 20/20", () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const anterior = snapshotCompleto(liga.id, 20);
    const novo18 = snapshotCompleto(liga.id, 18);
    const pub18 = validarPublicacaoLiga(liga, novo18, anterior);
    expect(pub18.ok).toBe(false);
    expect(pub18.motivo).toMatch(/Esperados|Regressão|cobertura/i);

    const novo20 = snapshotCompleto(liga.id, 20);
    expect(validarPublicacaoLiga(liga, novo20, anterior).ok).toBe(true);
  });

  it("19/20 não publica; parcial não publica; liga nova incompleta não publica", () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const ant = snapshotCompleto(liga.id, 20);
    expect(validarPublicacaoLiga(liga, snapshotCompleto(liga.id, 19), ant).ok).toBe(
      false,
    );

    const parcial = snapshotCompleto(liga.id, 18, {
      status: "parcial",
      erros: [{ clubeId: "x", nome: "X", motivo: "falha" }],
      progresso: { total: 20, importados: 18, falhas: 2, clubeAtual: null },
    });
    expect(validarDisponibilidadeLiga(liga, parcial)).not.toBeNull();
    expect(validarPublicacaoLiga(liga, parcial, null).ok).toBe(false);

    const incompletaNova = snapshotCompleto(liga.id, 10, {
      progresso: { total: 20, importados: 10, falhas: 0, clubeAtual: null },
      status: "parcial",
    });
    expect(validarPublicacaoLiga(liga, incompletaNova, null).ok).toBe(false);
  });

  it("mudança legítima de quantidade via clubesEsperados", () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const ant = snapshotCompleto(liga.id, 20);
    const novo = snapshotCompleto(liga.id, 18);
    expect(
      validarPublicacaoLiga(liga, novo, ant, { clubesEsperados: 18 }).ok,
    ).toBe(true);
  });
});

describe("Fase 12 — freeze de atributos no save", () => {
  it("E+F) save antigo preserva A; carreira nova usa B; legado sem attrs usa catálogo", () => {
    const { carreira, catalogo } = exemploCarreira();
    const clube = carreira.clubes[0]!;
    const pedro = clube.elenco[0]!;
    const attrsA = criarAtributosUniformes(70);
    attrsA.finalizacao = 80;
    attrsA.drible = 72;
    attrsA.passeCurto = 68;
    pedro.overall = 78;
    pedro.potencial = 82;
    pedro.atributos = attrsA;
    pedro.ratingMetadata = {
      source: "sportmonks",
      confidence: "high",
      minutes: 2000,
      appearances: 30,
      season: "A",
    };

    const persistido = serializarCarreira(carreira);
    expect(persistido.clubesDinamicos[0]!.elenco[0]!.atributos?.finalizacao).toBe(
      80,
    );

    // Catálogo B com atributos diferentes
    const catalogoB = structuredClone(catalogo);
    for (const c of catalogoB.clubes) {
      for (const j of c.elenco) {
        if (j.id === pedro.id) {
          j.overall = 83;
          j.potencial = 90;
          const attrsB = criarAtributosUniformes(80);
          attrsB.finalizacao = 88;
          attrsB.drible = 84;
          attrsB.passeCurto = 80;
          j.atributos = attrsB;
        }
      }
    }

    const hidratado = hidratarCarreira(persistido, catalogoB);
    const pedroSave = hidratado.clubes
      .flatMap((c) => c.elenco)
      .find((j) => j.id === pedro.id)!;
    expect(pedroSave.overall).toBe(78);
    expect(pedroSave.atributos?.finalizacao).toBe(80);
    expect(pedroSave.atributos?.drible).toBe(72);
    expect(pedroSave.atributos?.passeCurto).toBe(68);

    // Nova carreira a partir do catálogo B
    const pedroCatalogo = catalogoB.clubes
      .flatMap((c) => c.elenco)
      .find((j) => j.id === pedro.id)!;
    expect(pedroCatalogo.overall).toBe(83);
    expect(pedroCatalogo.atributos?.finalizacao).toBe(88);

    // Save legado sem atributos → fallback do catálogo na 1ª hidratação
    const legado = structuredClone(persistido);
    for (const c of legado.clubesDinamicos) {
      for (const j of c.elenco) {
        delete (j as { atributos?: unknown }).atributos;
        delete (j as { ratingMetadata?: unknown }).ratingMetadata;
      }
    }
    const hLegado = hidratarCarreira(legado, catalogoB);
    const pedroLegado = hLegado.clubes
      .flatMap((c) => c.elenco)
      .find((j) => j.id === pedro.id)!;
    expect(pedroLegado.overall).toBe(78); // overall ainda do save
    expect(pedroLegado.atributos?.finalizacao).toBe(88); // fallback catálogo B
    // Re-serialize congela
    const re = serializarCarreira(hLegado);
    expect(re.clubesDinamicos.flatMap((c) => c.elenco).find((j) => j.id === pedro.id)!
      .atributos?.finalizacao).toBe(88);
  });

  it("round-trip preserva overall, potencial, atributos e metadata", () => {
    const { carreira, catalogo } = exemploCarreira();
    const j = carreira.clubes[0]!.elenco[0]! as JogadorMundo;
    j.overall = 77;
    j.potencial = 85;
    j.atributos = criarAtributosUniformes(71);
    j.atributos.finalizacao = 79;
    j.ratingMetadata = {
      source: "hybrid",
      confidence: "medium",
      minutes: 1200,
      appearances: 20,
      season: "2025",
    };
    const r = hidratarCarreira(serializarCarreira(carreira), catalogo);
    const j2 = r.clubes[0]!.elenco.find((x) => x.id === j.id)!;
    expect(j2.overall).toBe(77);
    expect(j2.potencial).toBe(85);
    expect(j2.atributos?.finalizacao).toBe(79);
    expect(j2.ratingMetadata?.source).toBe("hybrid");
  });

  it("tamanho aproximado do save com atributos vs sem", () => {
    const { carreira } = exemploCarreira();
    const sem = structuredClone(carreira);
    for (const c of sem.clubes)
      for (const j of c.elenco) {
        delete j.atributos;
        delete j.ratingMetadata;
      }
    const bytesSem = Buffer.byteLength(JSON.stringify(serializarCarreira(sem)));
    for (const c of carreira.clubes)
      for (const j of c.elenco) {
        j.atributos ??= criarAtributosUniformes(65);
        j.ratingMetadata ??= {
          source: "transfermarkt-estimated",
          confidence: "low",
        };
      }
    const bytesCom = Buffer.byteLength(
      JSON.stringify(serializarCarreira(carreira)),
    );
    // Guarda números para o relatório; delta deve ser positivo e < 16 MiB.
    expect(bytesCom).toBeGreaterThan(bytesSem);
    expect(bytesCom).toBeLessThan(16 * 1024 * 1024);
    // eslint-disable-next-line no-console
    console.log(
      `[save-size] sem attrs≈${(bytesSem / 1024).toFixed(1)} KiB · com attrs≈${(bytesCom / 1024).toFixed(1)} KiB · Δ=${((bytesCom - bytesSem) / 1024).toFixed(1)} KiB · chavesAttrs=${Object.keys(NOMES_ATRIBUTOS).length}`,
    );
  });
});

describe("Fase 12 — saúde Sportmonks e season", () => {
  it("D) queda 75%→10% aborta; 20/20 ok; 5/20 degradado", () => {
    const queda = avaliarSaudeEnriquecimento({
      cobertura: "A",
      metricas: metricasVazias({
        timesEsperados: 20,
        timesEncontrados: 20,
        squadsSolicitados: 20,
        squadsObtidos: 20,
        jogadoresTm: 500,
        matches: 50,
        comStats: 50,
        fallback: 450,
      }),
      taxaAtual: 0.1,
      taxaAnterior: 0.75,
      anteriorEnriquecido: true,
    });
    expect(queda.abortarPublicacao).toBe(true);

    const ok = avaliarSaudeEnriquecimento({
      cobertura: "A",
      metricas: metricasVazias({
        timesEsperados: 20,
        timesEncontrados: 20,
        squadsSolicitados: 20,
        squadsObtidos: 20,
        jogadoresTm: 500,
        matches: 350,
        comStats: 300,
        fallback: 50,
      }),
      taxaAtual: 0.7,
      taxaAnterior: 0.75,
      anteriorEnriquecido: true,
    });
    expect(ok.abortarPublicacao).toBe(false);
    expect(["saudavel", "degradado"]).toContain(ok.saude);

    const ruim = avaliarSaudeEnriquecimento({
      cobertura: "A",
      metricas: metricasVazias({
        timesEsperados: 20,
        timesEncontrados: 5,
        squadsSolicitados: 20,
        squadsObtidos: 5,
        squadsFalhos: 15,
        jogadoresTm: 500,
        matches: 40,
        comStats: 20,
        fallback: 480,
      }),
      taxaAtual: 0.05,
      taxaAnterior: 0.7,
      anteriorEnriquecido: true,
    });
    expect(ruim.abortarPublicacao).toBe(true);
  });

  it("G) strategy busca não escolhe currentSeason silenciosamente", async () => {
    expect(SPORTMONKS_LIGAS.brasileirao!.seasonStrategy).toBe("busca");
    expect(SPORTMONKS_LIGAS["premier-league"]!.seasonStrategy).toBe("busca");

    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("/leagues/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { currentSeason: { id: 999, name: "2024" } },
          }),
        };
      }
      if (String(url).includes("/seasons/search/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: [
              { id: 111, name: "2025", league_id: 648 },
              { id: 222, name: "2026", league_id: 648 },
            ],
          }),
        };
      }
      if (String(url).includes("/seasons/222")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { id: 222, name: "2026", league_id: 648 },
          }),
        };
      }
      if (String(url).includes("/seasons/111")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { id: 111, name: "2025", league_id: 648 },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: {} }),
      };
    }) as unknown as typeof fetch;

    const cliente = new ClienteSportmonks({
      token: "t",
      fetchImpl,
      usarCache: false,
      intervaloMs: 0,
    });
    const season = await resolverSeasonId(
      cliente,
      {
        idSportmonks: 648,
        seasonIdPreferido: null,
        seasonStrategy: "busca",
      },
      "2026",
    );
    expect(season.seasonId).toBe(222);
    expect(season.metodo).toBe("busca");
    expect(calls.some((u) => u.includes("/leagues/"))).toBe(false);
    expect(calls.some((u) => u.includes("/seasons/search/"))).toBe(true);
  });

  it("seasonIdPreferido explícito tem prioridade", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("/seasons/777")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { id: 777, name: "2026", league_id: 648 },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: [] }),
      };
    }) as unknown as typeof fetch;
    const cliente = new ClienteSportmonks({
      token: "t",
      fetchImpl,
      usarCache: false,
      intervaloMs: 0,
    });
    const r = await resolverSeasonId(
      cliente,
      {
        idSportmonks: 648,
        seasonIdPreferido: 777,
        seasonStrategy: "busca",
      },
      "2026",
    );
    expect(r.seasonId).toBe(777);
    expect(r.metodo).toBe("preferido");
  });
});

describe("Fase 12 — manifesto corrompido / legado", () => {
  it("manifesto corrompido cai no layout legado sem escolher release aleatória", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f12-leg-"));
    limpeza.push(dir);
    const liga = LIGAS_SUPORTADAS[0]!;
    const legado = snapshotCompleto(liga.id, 2);
    legado.clubes[0]!.elenco[0]!.overall = 55;
    await salvarDadosLiga(legado, dir);
    await writeFile(join(dir, "active.json"), "{quebrado", "utf8");
    const lido = await lerDadosLiga(liga.id, dir);
    expect(lido!.clubes[0]!.elenco[0]!.overall).toBe(55);
  });

  it("release referenciada inexistente NÃO mistura legado", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f12-miss-"));
    limpeza.push(dir);
    const liga = LIGAS_SUPORTADAS[0]!;
    const legado = snapshotCompleto(liga.id, 2);
    legado.clubes[0]!.elenco[0]!.overall = 44;
    await salvarDadosLiga(legado, dir);
    await writeFile(
      join(dir, "active.json"),
      JSON.stringify({
        versao: 1,
        releaseId: "r-inexistente",
        atualizadoEm: new Date().toISOString(),
        ligas: [liga.id],
      }),
      "utf8",
    );
    const { ErroReleaseInvalida: E } = await import(
      "@/infraestrutura/persistencia/importacao-futebol"
    );
    await expect(lerDadosLiga(liga.id, dir)).rejects.toBeInstanceOf(E);
  });
});

describe("Fase 12+ — ratingMetadata completo round-trip", () => {
  const fontes: RatingMetadata["source"][] = [
    "sportmonks",
    "hybrid",
    "transfermarkt-estimated",
    "generated",
  ];

  for (const source of fontes) {
    it(`metadata ${source} serializa e hidrata completa`, () => {
      const { carreira, catalogo } = exemploCarreira();
      const j = carreira.clubes[0]!.elenco[0]!;
      const meta: RatingMetadata = {
        source,
        confidence: "high",
        minutes: 2500,
        appearances: 30,
        season: "2026",
        sportmonksPlayerId: 12345,
        matchConfidence: "exact",
        estimatedAttributes: ["velocidade", "forca"],
        coverageLevel: "A",
      };
      j.ratingMetadata = meta;
      j.atributos = criarAtributosUniformes(70);
      const h = hidratarCarreira(serializarCarreira(carreira), catalogo);
      const j2 = h.clubes[0]!.elenco.find((x) => x.id === j.id)!;
      expect(j2.ratingMetadata).toEqual(meta);
    });
  }

  it("snapshot B não altera metadata A do save", () => {
    const { carreira, catalogo } = exemploCarreira();
    const j = carreira.clubes[0]!.elenco[0]!;
    const metaA: RatingMetadata = {
      source: "sportmonks",
      confidence: "high",
      minutes: 2500,
      appearances: 30,
      season: "A",
      sportmonksPlayerId: 111,
      matchConfidence: "exact",
      estimatedAttributes: ["velocidade"],
      coverageLevel: "A",
    };
    j.overall = 78;
    j.atributos = criarAtributosUniformes(70);
    j.atributos.finalizacao = 80;
    j.ratingMetadata = metaA;
    const save = serializarCarreira(carreira);
    const catB = structuredClone(catalogo);
    for (const c of catB.clubes)
      for (const nj of c.elenco)
        if (nj.id === j.id) {
          nj.overall = 99;
          nj.ratingMetadata = {
            source: "hybrid",
            confidence: "low",
            minutes: 1,
            appearances: 1,
            season: "B",
            sportmonksPlayerId: 999,
            coverageLevel: "D",
          };
        }
    const h = hidratarCarreira(save, catB);
    const jh = h.clubes.flatMap((c) => c.elenco).find((x) => x.id === j.id)!;
    expect(jh.overall).toBe(78);
    expect(jh.atributos?.finalizacao).toBe(80);
    expect(jh.ratingMetadata).toEqual(metaA);
  });
});

describe("Fase 12+ — point-of-commit da release", () => {
  it("falha na limpeza após active.json NÃO remove release B", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-poc-"));
    limpeza.push(dir);
    const liga = LIGAS_SUPORTADAS[0]!;
    const a = snapshotCompleto(liga.id, 2);
    a.clubes[0]!.elenco[0]!.overall = 50;
    const { releaseId: idA } = await publicarReleaseAtomica(
      [{ ligaId: liga.id, dados: a }],
      dir,
    );
    const b = snapshotCompleto(liga.id, 2);
    b.clubes[0]!.elenco[0]!.overall = 91;
    const { releaseId: idB, manifestoCommitado } = await publicarReleaseAtomica(
      [{ ligaId: liga.id, dados: b }],
      dir,
      { falharLimpeza: true },
    );
    expect(manifestoCommitado).toBe(true);
    expect(idB).not.toBe(idA);
    expect((await lerManifestoAtivo(dir))!.releaseId).toBe(idB);
    expect((await lerDadosLiga(liga.id, dir))!.clubes[0]!.elenco[0]!.overall).toBe(
      91,
    );
  });

  it("falha antes do manifesto preserva A", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-pre-"));
    limpeza.push(dir);
    const liga = LIGAS_SUPORTADAS[0]!;
    const a = snapshotCompleto(liga.id, 2);
    a.clubes[0]!.elenco[0]!.overall = 40;
    const { releaseId: idA } = await publicarReleaseAtomica(
      [{ ligaId: liga.id, dados: a }],
      dir,
    );
    await expect(
      publicarReleaseAtomica(
        [
          {
            ligaId: liga.id,
            dados: {
              ...snapshotCompleto(liga.id, 2),
              ligaId: "!!!invalido!!!",
            } as DadosLigaImportados,
          },
        ],
        dir,
      ),
    ).rejects.toThrow();
    expect((await lerManifestoAtivo(dir))!.releaseId).toBe(idA);
    expect((await lerDadosLiga(liga.id, dir))!.clubes[0]!.elenco[0]!.overall).toBe(
      40,
    );
  });
});

describe("Fase 12+ — clubes esperados e temporada SM", () => {
  it("usa liga.quantidadeClubes por padrão", () => {
    const bra = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const cha = LIGAS_SUPORTADAS.find((l) => l.id === "championship")!;
    const bun = LIGAS_SUPORTADAS.find((l) => l.id === "bundesliga")!;
    expect(
      validarPublicacaoLiga(bra, snapshotCompleto(bra.id, 20), null).ok,
    ).toBe(true);
    expect(
      validarPublicacaoLiga(cha, snapshotCompleto(cha.id, 24), null).ok,
    ).toBe(true);
    expect(
      validarPublicacaoLiga(bun, snapshotCompleto(bun.id, 18), null).ok,
    ).toBe(true);
    expect(
      validarPublicacaoLiga(bra, snapshotCompleto(bra.id, 18), null).ok,
    ).toBe(false);
  });

  it("override de temporada vence quantidade padrão", () => {
    const bra = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    expect(
      validarPublicacaoLiga(bra, snapshotCompleto(bra.id, 18), null, {
        clubesEsperados: 18,
      }).ok,
    ).toBe(true);
  });

  it("labels Sportmonks Brasil/Europa", () => {
    expect(TEMPORADAS_INICIAIS.brasileirao!.temporadaSportmonks).toBe("2026");
    expect(TEMPORADAS_INICIAIS.brasileirao!.temporadaTransfermarkt).toBe("2025");
    expect(TEMPORADAS_INICIAIS["premier-league"]!.temporadaSportmonks).toBe(
      "2026/2027",
    );
    expect(normalizarLabelTemporadaSportmonks("2026/27")).toBe("2026/2027");
    expect(temporadaSportmonksCompativel("2026/27", "2026/2027")).toBe(true);
    expect(temporadaSportmonksCompativel("2025", "2026")).toBe(false);
  });
});
