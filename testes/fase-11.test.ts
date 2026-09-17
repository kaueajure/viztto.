import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ClienteSportmonks,
  ErroSportmonks,
  obterTokenSportmonks,
  redigirSegredos,
} from "@/infraestrutura/sportmonks/cliente";
import {
  escolherMelhorMatch,
  normalizarNome,
  pontuarMatch,
  type CandidatoSportmonks,
} from "@/infraestrutura/sportmonks/matching";
import {
  calcularRatingViztto,
  normalizarDetailsSportmonks,
  type EntradaRatingEngine,
} from "@/infraestrutura/sportmonks/rating-engine";
import { enriquecerLigaComSportmonks } from "@/infraestrutura/sportmonks/enriquecer-liga";
import { mapeamentoSportmonks, SPORTMONKS_LIGAS } from "@/dominio/constantes/sportmonks-ligas";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  definirDiretorioImportacao,
  obterDiretorioImportacao,
  salvarDadosLiga,
  lerDadosLiga,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { criarJogadorMundo, hidratarElencoClube } from "@/dominio/jogador-mundo";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import { serializarCarreira, hidratarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import type { Clube, JogadorExterno } from "@/dominio/entidades/modelos";

const diretorioOriginal = obterDiretorioImportacao();
const limpeza: string[] = [];

afterEach(async () => {
  definirDiretorioImportacao(diretorioOriginal);
  delete process.env.SPORTMONKS_API_TOKEN;
  for (const d of limpeza.splice(0)) await rm(d, { recursive: true, force: true });
});

function jogadorBase(
  overrides: Partial<JogadorExterno> & Pick<JogadorExterno, "id" | "nome">,
): JogadorExterno {
  return {
    idExterno: 1,
    idTransfermarkt: overrides.id,
    dataNascimento: "1998-05-10",
    idade: 27,
    nacionalidade: ["Brasil"],
    posicao: "Centre-Forward",
    grupoPosicao: "ATA",
    peDominante: "direito",
    altura: 180,
    numero: 9,
    valorMercado: 8_000_000,
    contratoAte: "2027-06-30",
    joinedOn: null,
    signedFrom: null,
    foto: "",
    ...overrides,
  };
}

function candidato(
  overrides: Partial<CandidatoSportmonks> & Pick<CandidatoSportmonks, "id" | "nome">,
): CandidatoSportmonks {
  return {
    dateOfBirth: "1998-05-10",
    height: 180,
    nationality: "Brasil",
    teamName: "Flamengo",
    position: "Centre-Forward",
    ...overrides,
  };
}

function entradaRating(
  overrides: Partial<EntradaRatingEngine> = {},
): EntradaRatingEngine {
  return {
    seed: "teste-1",
    nome: "Jogador Teste",
    posicaoBruta: "Centre-Forward",
    idade: 25,
    valorMercado: 10_000_000,
    altura: 182,
    reputacaoLiga: 85,
    reputacaoClube: 80,
    forcaMediaLiga: 72,
    indiceNoElenco: 2,
    tamanhoElenco: 25,
    cobertura: "A",
    ...overrides,
  };
}

describe("Sportmonks — configuração de ligas", () => {
  it("mapeia todas as ligas suportadas sem espalhar IDs", () => {
    for (const liga of LIGAS_SUPORTADAS) {
      const m = mapeamentoSportmonks(liga);
      expect(m.ligaId).toBe(liga.id);
      expect(["A", "B", "C", "D"]).toContain(m.cobertura);
    }
    expect(SPORTMONKS_LIGAS["brasileirao-c"]!.cobertura).toBe("D");
    expect(SPORTMONKS_LIGAS.brasileirao!.cobertura).toBe("A");
    expect(SPORTMONKS_LIGAS.brasileirao!.seasonStrategy).toBe("busca");
    expect(SPORTMONKS_LIGAS["premier-league"]!.seasonStrategy).toBe("busca");
    // currentSeason só quando configurado conscientemente — default é busca.
    for (const m of Object.values(SPORTMONKS_LIGAS)) {
      expect(m.seasonStrategy).not.toBe("current");
    }
  });
});

describe("SportmonksClient", () => {
  it("falha com mensagem clara sem token", () => {
    delete process.env.SPORTMONKS_API_TOKEN;
    expect(() => obterTokenSportmonks()).toThrow(/SPORTMONKS_API_TOKEN/);
    expect(() => new ClienteSportmonks()).toThrow(ErroSportmonks);
  });

  it("pagina automaticamente e respeita has_more", async () => {
    process.env.SPORTMONKS_API_TOKEN = "tok-teste";
    let pagina = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      pagina++;
      const u = new URL(url);
      const page = Number(u.searchParams.get("page") ?? 1);
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          data: [{ id: page }],
          pagination: { has_more: page < 3, next_page: page < 3 ? page + 1 : null },
        }),
      } as Response;
    });
    const cliente = new ClienteSportmonks({
      token: "tok-teste",
      fetchImpl: fetchImpl as typeof fetch,
      usarCache: false,
      intervaloMs: 0,
      concorrencia: 1,
    });
    const itens = await cliente.getTodasPaginas<{ id: number }>("/teams/seasons/1");
    expect(itens).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("faz retry em 429 e 5xx", async () => {
    process.env.SPORTMONKS_API_TOKEN = "tok-teste";
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      if (n === 1)
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "0" }),
          json: async () => ({}),
        } as Response;
      if (n === 2)
        return {
          ok: false,
          status: 503,
          headers: new Headers(),
          json: async () => ({}),
        } as Response;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: { ok: true } }),
      } as Response;
    });
    const cliente = new ClienteSportmonks({
      token: "tok-teste",
      fetchImpl: fetchImpl as typeof fetch,
      usarCache: false,
      intervaloMs: 0,
    });
    const r = await cliente.getJson<{ data: { ok: boolean } }>("/leagues/1");
    expect(r.data.ok).toBe(true);
    expect(n).toBe(3);
  });

  it("classifica autenticação inválida", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const cliente = new ClienteSportmonks({
      token: "ruim",
      fetchImpl,
      usarCache: false,
      intervaloMs: 0,
    });
    await expect(cliente.getJson("/leagues/1")).rejects.toMatchObject({
      codigo: "auth",
    });
  });

  it("rejeita resposta sem data[] na paginação", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: null }),
    })) as unknown as typeof fetch;
    const cliente = new ClienteSportmonks({
      token: "t",
      fetchImpl,
      usarCache: false,
      intervaloMs: 0,
    });
    await expect(cliente.getTodasPaginas("/x")).rejects.toMatchObject({
      codigo: "resposta_invalida",
    });
  });

  it("redige token em logs", () => {
    expect(redigirSegredos("erro api_token=segredo123", "segredo123")).toContain(
      "[REDACTED]",
    );
    expect(redigirSegredos("erro api_token=segredo123", "segredo123")).not.toContain(
      "segredo123",
    );
  });
});

describe("Matching Transfermarkt ↔ Sportmonks", () => {
  it("match exato por nome + data de nascimento", () => {
    const j = jogadorBase({ id: "tm1", nome: "Pedro Silva" });
    const r = pontuarMatch(j, candidato({ id: 10, nome: "Pedro Silva" }));
    expect(r.confianca).toBe("exact");
  });

  it("normaliza acentos no nome", () => {
    expect(normalizarNome("José Ângelo")).toBe("jose angelo");
    const j = jogadorBase({ id: "tm2", nome: "José Ângelo" });
    const r = pontuarMatch(
      j,
      candidato({ id: 11, nome: "Jose Angelo", dateOfBirth: "1998-05-10" }),
    );
    expect(["exact", "high"]).toContain(r.confianca);
  });

  it("não aplica stats em matching duvidoso / medium", () => {
    const j = jogadorBase({ id: "tm3", nome: "João Santos", dataNascimento: "1995-01-01" });
    const r = escolherMelhorMatch(j, [
      candidato({
        id: 20,
        nome: "Joao Silva",
        dateOfBirth: "1999-12-12",
        teamName: "Outro",
      }),
    ]);
    expect(r.sportmonksId).toBeNull();
  });

  it("marca ambíguo quando homônimos empatam", () => {
    const j = jogadorBase({
      id: "tm4",
      nome: "Lucas Souza",
      dataNascimento: "2000-01-01",
    });
    const r = escolherMelhorMatch(j, [
      candidato({ id: 1, nome: "Lucas Souza", dateOfBirth: "2000-01-01", teamName: "A" }),
      candidato({ id: 2, nome: "Lucas Souza", dateOfBirth: "2000-01-01", teamName: "B" }),
    ]);
    expect(r.sportmonksId).toBeNull();
    expect(r.confianca).toBe("medium");
    expect(r.motivo).toMatch(/ambiguo/);
  });

  it("prioriza clube atual após transferência heurística", () => {
    const j = jogadorBase({ id: "tm5", nome: "Rafael Costa" });
    const r = escolherMelhorMatch(
      j,
      [
        candidato({ id: 1, nome: "Rafael Costa", teamName: "Clube Antigo" }),
        candidato({ id: 2, nome: "Rafael Costa", teamName: "Flamengo" }),
      ],
      "Flamengo",
    );
    expect(r.sportmonksId).toBe(2);
  });
});

describe("Rating Engine Viztto", () => {
  const posicoes = [
    ["Centre-Forward", "atacante"],
    ["Left Winger", "ponta"],
    ["Attacking Midfield", "meia"],
    ["Defensive Midfield", "volante"],
    ["Centre-Back", "zagueiro"],
    ["Right-Back", "lateral"],
    ["Goalkeeper", "goleiro"],
  ] as const;

  for (const [pos, rotulo] of posicoes) {
    it(`gera overall/potencial válidos para ${rotulo}`, () => {
      const r = calcularRatingViztto(
        entradaRating({
          seed: `pos-${pos}`,
          posicaoBruta: pos,
          stats: {
            appearances: 30,
            minutes: 2400,
            goals: pos.includes("Forward") || pos.includes("Winger") ? 12 : 2,
            assists: 5,
            shots: 40,
            shotsOnTarget: 18,
            keyPasses: 20,
            tackles: 40,
            interceptions: 25,
            saves: pos === "Goalkeeper" ? 90 : undefined,
            goalsConceded: pos === "Goalkeeper" ? 30 : undefined,
            rating: 7.1,
          },
        }),
      );
      expect(r.overall).toBeGreaterThanOrEqual(48);
      expect(r.overall).toBeLessThanOrEqual(94);
      expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
      expect(r.metadata.source).toMatch(/sportmonks|hybrid/);
    });
  }

  it("não mapeia rating de partida * 10 para overall", () => {
    const r = calcularRatingViztto(
      entradaRating({
        stats: {
          appearances: 28,
          minutes: 2500,
          goals: 5,
          assists: 3,
          rating: 7.8,
        },
      }),
    );
    expect(r.overall).not.toBe(78);
    expect(r.overall).toBeLessThan(85);
  });

  it("aplica shrinkage com poucos minutos", () => {
    const poucos = calcularRatingViztto(
      entradaRating({
        seed: "poucos",
        stats: { appearances: 2, minutes: 75, goals: 2, assists: 0, shots: 3 },
      }),
    );
    const muitos = calcularRatingViztto(
      entradaRating({
        seed: "muitos",
        stats: {
          appearances: 34,
          minutes: 3000,
          goals: 20,
          assists: 8,
          shots: 90,
          shotsOnTarget: 40,
        },
      }),
    );
    // Amostra pequena não pode dominar o rating
    expect(poucos.metadata.confidence).not.toBe("high");
    expect(poucos.metadata.source).toMatch(/hybrid|sportmonks|transfermarkt/);
    expect(poucos.overall).toBeLessThanOrEqual(muitos.overall + 3);
    expect(poucos.atributos.finalizacao).toBeLessThan(95);
    expect(poucos.metadata.confidence).toBe("low");
  });

  it("fallback Transfermarkt sem stats", () => {
    const r = calcularRatingViztto(entradaRating({ stats: null, cobertura: "D" }));
    expect(r.metadata.source).toBe("transfermarkt-estimated");
    expect(r.metadata.confidence).toBe("low");
    expect(r.overall).toBeGreaterThan(0);
    expect(r.potencial).toBeGreaterThanOrEqual(r.overall);
  });

  it("normaliza força da liga (PL vs Série C)", () => {
    const elite = calcularRatingViztto(
      entradaRating({
        seed: "pl",
        reputacaoLiga: 95,
        forcaMediaLiga: 82,
        cobertura: "A",
        stats: { appearances: 30, minutes: 2500, goals: 10, assists: 4 },
      }),
    );
    const inferior = calcularRatingViztto(
      entradaRating({
        seed: "sc",
        reputacaoLiga: 55,
        forcaMediaLiga: 58,
        cobertura: "D",
        valorMercado: 200_000,
        stats: { appearances: 30, minutes: 2500, goals: 10, assists: 4 },
      }),
    );
    expect(elite.overall).toBeGreaterThan(inferior.overall - 2);
  });

  it("é determinístico", () => {
    const a = calcularRatingViztto(entradaRating({ seed: "det" }));
    const b = calcularRatingViztto(entradaRating({ seed: "det" }));
    expect(a).toEqual(b);
  });

  it("normaliza details Sportmonks", () => {
    const s = normalizarDetailsSportmonks(
      [
        { type: { developer_name: "GOALS" }, value: 11 },
        { type: { name: "Assists" }, value: 4 },
        { type: { code: "minutes_played" }, value: 2100 },
      ],
      20,
      0,
    );
    expect(s.goals).toBe(11);
    expect(s.assists).toBe(4);
    expect(s.minutes).toBe(2100);
  });

  it("distribuição plausível sem inflação extrema", () => {
    const overalls = Array.from({ length: 40 }, (_, i) =>
      calcularRatingViztto(
        entradaRating({
          seed: `dist-${i}`,
          valorMercado: 100_000 * (i + 1),
          indiceNoElenco: i % 25,
          stats:
            i % 3 === 0
              ? null
              : {
                  appearances: 10 + (i % 20),
                  minutes: 400 + i * 50,
                  goals: i % 8,
                  assists: i % 5,
                },
        }),
      ).overall,
    );
    const media = overalls.reduce((a, b) => a + b, 0) / overalls.length;
    expect(media).toBeGreaterThan(55);
    expect(media).toBeLessThan(82);
    expect(Math.max(...overalls)).toBeLessThanOrEqual(94);
  });
});

describe("Enriquecimento + snapshots + atomicidade", () => {
  it("liga cobertura D usa fallback sem chamar API", async () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao-c")!;
    const clubes = [
      {
        id: "c1",
        nome: "Clube C",
        reputacao: 55,
        elenco: [jogadorBase({ id: "j1", nome: "Atleta C" })],
      },
    ] as unknown as Clube[];
    const r = await enriquecerLigaComSportmonks(liga, clubes, {
      informar: () => undefined,
    });
    const j = r.clubes[0]!.elenco[0]! as unknown as {
      overall: number;
      ratingMetadata: { source: string; coverageLevel: string };
    };
    expect(j.overall).toBeGreaterThan(0);
    expect(j.ratingMetadata.source).toBe("transfermarkt-estimated");
    expect(j.ratingMetadata.coverageLevel).toBe("D");
    expect(r.relatorio.cobertura).toBe("D");
  });

  it("sem token usa fallback (não aborta)", async () => {
    delete process.env.SPORTMONKS_API_TOKEN;
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const clubes = [
      {
        id: "c1",
        nome: "Flamengo",
        reputacao: 85,
        elenco: [jogadorBase({ id: "j1", nome: "Pedro" })],
      },
    ] as unknown as Clube[];
    const r = await enriquecerLigaComSportmonks(liga, clubes, {
      informar: () => undefined,
      exigirToken: false,
    });
    expect(r.abortarPublicacao).toBeFalsy();
    expect(
      (r.clubes[0]!.elenco[0] as unknown as { ratingMetadata: { source: string } })
        .ratingMetadata.source,
    ).toBe("transfermarkt-estimated");
  });

  it("auth falha aborta publicação na atualização", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f11-auth-"));
    limpeza.push(dir);
    definirDiretorioImportacao(dir);
    process.env.SPORTMONKS_API_TOKEN = "ruim";
    const liga = LIGAS_SUPORTADAS[0]!;
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const cliente = new ClienteSportmonks({
      token: "ruim",
      fetchImpl,
      usarCache: false,
      intervaloMs: 0,
    });
    const r = await enriquecerLigaComSportmonks(
      liga,
      [
        {
          id: "c1",
          nome: "X",
          reputacao: 70,
          elenco: [jogadorBase({ id: "j1", nome: "Y" })],
        },
      ] as unknown as Clube[],
      { cliente, informar: () => undefined, temporadaLabel: "2025" },
    );
    expect(r.abortarPublicacao).toBe(true);
  });

  it("atualizar-base publica após enrichment mock", async () => {
    const dir = await mkdtemp(join(tmpdir(), "viztto-f11-upd-"));
    limpeza.push(dir);
    const liga = { ...LIGAS_SUPORTADAS[0]!, quantidadeClubes: 2 };
    const agora = new Date().toISOString();
    const clubeFactory = (n: number): Clube =>
      ({
        id: `${liga.id}-${n}`,
        idExterno: n,
        idTransfermarkt: String(n),
        ligaId: liga.id,
        nome: `Clube ${n}`,
        nomeCurto: `C${n}`,
        nomeOficial: `Clube ${n}`,
        codigo: `C${n}`,
        pais: "BR",
        fundacao: 1900,
        escudo: "",
        estadio: "Arena",
        capacidadeEstadio: 40000,
        tamanhoElenco: 1,
        idadeMedia: 25,
        valorElenco: 10_000_000,
        registroTransferencias: null,
        formacaoPreferida: "4-3-3",
        goleiroTitularId: null,
        titularesIds: [],
        bancoIds: [],
        reputacao: 70,
        forcaGeral: 70,
        forcaAtaque: 70,
        forcaMeio: 70,
        forcaDefesa: 70,
        qualidadeBase: 60,
        poderFinanceiro: 50,
        orcamento: 5_000_000,
        forma: 70,
        moral: 70,
        fadiga: 20,
        dadosBrutos: null,
        elenco: [jogadorBase({ id: `p${n}`, nome: `Titular ${n}` })],
      }) as unknown as Clube;

    const resultado = await atualizarBaseFutebol({
      diretorio: dir,
      ligas: [liga],
      publicacao: { modo: "isolada", ligasEsperadas: [liga.id] },
      informar: () => undefined,
      importar: async (l, op) => {
        const staging = op?.diretorio ?? dir;
        await salvarDadosLiga(
          {
            ligaId: l.id,
            temporada: 2026,
            temporadaTransfermarkt: "2025",
            inicio: "2026-01-28",
            importadoEm: agora,
            atualizadoEm: agora,
            status: "completo",
            clubes: [clubeFactory(1), clubeFactory(2)],
            erros: [],
            progresso: { total: 2, importados: 2, falhas: 0, clubeAtual: null },
          },
          staging,
        );
        return {
          clubes: [clubeFactory(1), clubeFactory(2)],
          erros: [],
          temporada: 2026,
          temporadaTransfermarkt: "2025",
          inicio: "2026-01-28",
          status: "completo",
          progresso: { total: 2, importados: 2, falhas: 0, clubeAtual: null },
        };
      },
      enriquecer: async (_liga, clubes) => ({
        clubes: clubes.map((c) => ({
          ...c,
          elenco: c.elenco.map((j) => ({
            ...j,
            overall: 74,
            potencial: 80,
            ratingMetadata: {
              source: "transfermarkt-estimated" as const,
              confidence: "medium" as const,
              minutes: 0,
              appearances: 0,
              season: "",
              coverageLevel: "A" as const,
            },
          })),
        })),
        relatorio: {
          ligaId: liga.id,
          cobertura: "A" as const,
          total: 2,
          matched: [],
          unmatched: [],
          ambiguous: [],
          requests: 0,
        },
        status: "ok" as const,
      }),
    });
    expect(resultado.ligas[0]!.publicado).toBe(true);
    expect(resultado.publicou).toBe(true);
    const snap = await lerDadosLiga(liga.id, dir);
    expect(
      (snap!.clubes[0]!.elenco[0] as unknown as { overall: number }).overall,
    ).toBe(74);
  });
});

describe("Hidratação, save e força do clube", () => {
  it("snapshot overall tem precedência na criação de JogadorMundo", () => {
    const j = criarJogadorMundo(
      {
        ...jogadorBase({ id: "snap1", nome: "Snapshot" }),
        overall: 81,
        potencial: 86,
      } as Parameters<typeof criarJogadorMundo>[0],
      {
        clubeId: "c",
        reputacaoClube: 80,
        reputacaoLiga: 85,
        forcaClube: 75,
        indiceNoElenco: 0,
        tamanhoElenco: 20,
      },
    );
    expect(j.overall).toBe(81);
    expect(j.potencial).toBe(86);
  });

  it("atualização de snapshot não altera save já criado", () => {
    const { carreira, catalogo } = exemploCarreira();
    const overallAntes = carreira.jogador.overall;
    const elencoAntes = carreira.clubes[0]!.elenco.map((j) => j.overall);
    const serial = serializarCarreira(carreira);
    const catalogoNovo = {
      ligas: catalogo.ligas,
      clubes: catalogo.clubes.map((c) => ({
        ...c,
        elenco: c.elenco.map((j) => ({ ...j, overall: 99, potencial: 99 })),
      })),
    };
    const hidratada = hidratarCarreira(serial, catalogoNovo);
    // Deltas do save sobrescrevem overall do catálogo novo
    expect(hidratada.jogador.overall).toBe(overallAntes);
    expect(hidratada.clubes[0]!.elenco.map((j) => j.overall)).toEqual(elencoAntes);
  });

  it("força do clube deriva da escalação após hidratar overalls", () => {
    const liga = LIGAS_SUPORTADAS[0]!;
    const elenco = Array.from({ length: 14 }, (_, i) =>
      criarJogadorMundo(
        {
          ...jogadorBase({
            id: `f${i}`,
            nome: `J${i}`,
            posicao:
              i === 0
                ? "Goalkeeper"
                : i < 5
                  ? "Centre-Back"
                  : i < 9
                    ? "Central Midfield"
                    : "Centre-Forward",
            valorMercado: 20_000_000 - i * 500_000,
          }),
          overall: 80 - i,
          potencial: 85 - i,
        } as Parameters<typeof criarJogadorMundo>[0],
        {
          clubeId: "cx",
          reputacaoClube: 80,
          reputacaoLiga: liga.reputacao,
          forcaClube: 70,
          indiceNoElenco: i,
          tamanhoElenco: 14,
        },
      ),
    );
    const clube = {
      id: "cx",
      ligaId: liga.id,
      formacaoPreferida: "4-3-3" as const,
      goleiroTitularId: elenco[0]!.id,
      titularesIds: elenco.slice(1, 11).map((j) => j.id),
      bancoIds: elenco.slice(11).map((j) => j.id),
      elenco,
      reputacao: 80,
      forcaGeral: 50,
      forcaAtaque: 50,
      forcaMeio: 50,
      forcaDefesa: 50,
      poderFinanceiro: 60,
      orcamento: 1,
      forma: 70,
      moral: 70,
      fadiga: 15,
      treinador: {
        id: "t1",
        nome: "Técnico",
        formacaoPreferida: "4-3-3",
        estilo: "equilibrado",
        preferenciaJovens: 50,
        disciplina: 50,
        rotacao: 50,
        paciencia: 50,
      },
    } as unknown as Clube;
    sincronizarForcaClube(clube);
    expect(Number.isFinite(clube.forcaGeral)).toBe(true);
    expect(clube.forcaGeral).not.toBe(50);
    expect(clube.forcaAtaque).toBeGreaterThan(0);
  });

  it("hidratarElenco preserva JogadorMundo já completo", () => {
    const liga = LIGAS_SUPORTADAS[0]!;
    const base = criarJogadorMundo(
      {
        ...jogadorBase({ id: "h1", nome: "H" }),
        overall: 77,
        potencial: 82,
      } as Parameters<typeof criarJogadorMundo>[0],
      {
        clubeId: "c",
        reputacaoClube: 70,
        reputacaoLiga: 80,
        forcaClube: 70,
        indiceNoElenco: 0,
        tamanhoElenco: 1,
      },
    );
    const out = hidratarElencoClube(
      [base],
      { id: "c", reputacao: 70, forcaGeral: 70 },
      liga,
    );
    expect(out[0]!.overall).toBe(77);
  });
});
