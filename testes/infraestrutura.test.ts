import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  escolherFormacaoPreferida,
  escalarTitulares,
  grupoPosicao,
} from "@/dominio/formacao";
import {
  adaptarPersistencia,
  obterErroPersistencia,
} from "@/infraestrutura/persistencia/armazenamento";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { importarLiga } from "@/infraestrutura/transfermarkt/importar-liga";
import {
  definirDiretorioImportacao,
  lerDadosLiga,
  obterDiretorioImportacao,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { mockTransfermarktBrasil } from "./auxiliar-mock-importacao";

const diretorioImportacaoOriginal = obterDiretorioImportacao();

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  definirDiretorioImportacao(diretorioImportacaoOriginal);
  vi.resetModules();
});

async function ambienteImportacao() {
  const diretorio = await mkdtemp(join(tmpdir(), "viztto-tm-"));
  definirDiretorioImportacao(diretorio);
  return diretorio;
}

describe("formação viztto", () => {
  it("classifica posições e escolhe formação coerente", () => {
    expect(grupoPosicao("Goalkeeper")).toBe("GOL");
    expect(grupoPosicao("Centre-Back")).toBe("DEF");
    expect(grupoPosicao("Defensive Midfield")).toBe("MEI");
    expect(grupoPosicao("Centre-Forward")).toBe("ATA");
    const elenco = [
      { id: "1", posicao: "Goalkeeper", valorMercado: 1, idade: 28 },
      { id: "2", posicao: "Centre-Back", valorMercado: 5, idade: 26 },
      { id: "3", posicao: "Centre-Back", valorMercado: 4, idade: 27 },
      { id: "4", posicao: "Left-Back", valorMercado: 3, idade: 24 },
      { id: "5", posicao: "Right-Back", valorMercado: 3, idade: 25 },
      { id: "6", posicao: "Defensive Midfield", valorMercado: 6, idade: 27 },
      { id: "7", posicao: "Central Midfield", valorMercado: 7, idade: 23 },
      { id: "8", posicao: "Central Midfield", valorMercado: 5, idade: 22 },
      { id: "9", posicao: "Left Winger", valorMercado: 8, idade: 24 },
      { id: "10", posicao: "Right Winger", valorMercado: 8, idade: 21 },
      { id: "11", posicao: "Centre-Forward", valorMercado: 10, idade: 29 },
    ];
    const formacao = escolherFormacaoPreferida(elenco);
    expect(["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1"]).toContain(formacao);
    const { goleiroId, titularIds } = escalarTitulares(elenco, "4-3-3");
    expect(goleiroId).toBe("1");
    expect(titularIds).toHaveLength(10);
  });
});

describe("save local", () => {
  it("valida e restaura uma carreira completa", () => {
    const liga = LIGAS_SUPORTADAS[0],
      clubes = gerarClubesDemonstracao(liga);
    const carreira = criarCarreira({
      identidade: {
        nome: "Kauê",
        sobrenome: "Silva",
        nacionalidade: "Brasil",
        idade: 15,
        posicao: "CA",
        posicaoSecundaria: "",
        peDominante: "direito",
        altura: 178,
        peso: 72,
        arquetipo: "artilheiro",
      },
      liga,
      clubes,
      clubeId: clubes[0].id,
      seed: "save",
      dataInicio: "2026-01-05",
      origem: "demonstracao",
    });
    expect(validarSave(JSON.parse(JSON.stringify(carreira)))).toEqual(carreira);
  });

  it("abstrai armazenamento e informa erro de quota", () => {
    const memoria = new Map<string, string>(),
      adaptador = adaptarPersistencia({
        ler: (chave) => memoria.get(chave) ?? null,
        salvar: (chave, valor) => {
          memoria.set(chave, valor);
        },
        remover: (chave) => {
          memoria.delete(chave);
        },
      });
    adaptador.setItem("teste", "save");
    expect(adaptador.getItem("teste")).toBe("save");
    const falho = adaptarPersistencia({
      ler: () => null,
      salvar: () => {
        throw new Error("QuotaExceededError");
      },
      remover: () => {},
    });
    expect(() => falho.setItem("teste", "save")).not.toThrow();
    expect(obterErroPersistencia()).toContain("Não foi possível salvar");
  });
});

describe("importação Transfermarkt", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("importa clubes e elencos sem chamadas paralelas por search", async () => {
    const diretorio = await ambienteImportacao();
    const consulta = mockTransfermarktBrasil();
    vi.stubGlobal("fetch", consulta);
    const resultado = await importarLiga(LIGAS_SUPORTADAS[0], {
      baseUrl: "https://tm.test",
      esperar: async () => {},
    });
    expect(resultado.clubes).toHaveLength(3);
    expect(resultado.clubes[0].elenco.length).toBeGreaterThan(0);
    expect(resultado.clubes[0].formacaoPreferida).toBeTruthy();
    expect(resultado.clubes[0].escudo).toContain("akamaized");
    expect(
      consulta.mock.calls.some(([url]) =>
        String(url).includes("/competitions/BRA1/clubs"),
      ),
    ).toBe(true);
    expect(
      consulta.mock.calls.some(([url]) =>
        String(url).includes("/competitions/search/"),
      ),
    ).toBe(false);
    expect(
      consulta.mock.calls.some(([url]) =>
        String(url).includes("/clubs/614/players?season_id="),
      ),
    ).toBe(true);
    const salvo = await lerDadosLiga("brasileirao");
    expect(salvo?.status).toBe("completo");
    await rm(diretorio, { recursive: true, force: true });
  });

  it("retoma pulando clubes já salvos", async () => {
    const diretorio = await ambienteImportacao();
    vi.stubGlobal("fetch", mockTransfermarktBrasil());
    await importarLiga(LIGAS_SUPORTADAS[0], {
      baseUrl: "https://tm.test",
      esperar: async () => {},
    });
    const consulta = mockTransfermarktBrasil();
    vi.stubGlobal("fetch", consulta);
    await importarLiga(LIGAS_SUPORTADAS[0], {
      baseUrl: "https://tm.test",
      esperar: async () => {},
    });
    expect(
      consulta.mock.calls.filter(([url]) =>
        String(url).includes("/players?season_id="),
      ),
    ).toHaveLength(0);
    await rm(diretorio, { recursive: true, force: true });
  });
});

describe("endpoints públicos", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("informa quando a liga ainda não foi importada", async () => {
    const diretorio = await ambienteImportacao();
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const resposta = await GET(
      new NextRequest("http://localhost/api/futebol?liga=brasileirao"),
    );
    expect(resposta.status).toBe(404);
    const dados = await resposta.json();
    expect(dados.precisaImportar).toBe(true);
    await rm(diretorio, { recursive: true, force: true });
  });

  it("lê dados locais após POST de importação", async () => {
    const diretorio = await ambienteImportacao();
    vi.resetModules();
    const { definirDiretorioImportacao: definirDir } = await import(
      "@/infraestrutura/persistencia/importacao-futebol"
    );
    definirDir(diretorio);
    vi.stubEnv("TRANSFERMARKT_API_URL", "https://tm.test");
    const consulta = mockTransfermarktBrasil();
    vi.stubGlobal("fetch", consulta);
    vi.doMock("@/infraestrutura/transfermarkt/importar-liga", async () => {
      const original = await vi.importActual<
        typeof import("@/infraestrutura/transfermarkt/importar-liga")
      >("@/infraestrutura/transfermarkt/importar-liga");
      return {
        ...original,
        importarLiga: (
          liga: Parameters<typeof original.importarLiga>[0],
          opcoes?: Parameters<typeof original.importarLiga>[1],
        ) =>
          original.importarLiga(liga, {
            ...opcoes,
            baseUrl: "https://tm.test",
            esperar: async () => {},
          }),
      };
    });
    const { POST } = await import("@/app/api/futebol/importar/route");
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const importacao = await POST(
      new NextRequest("http://localhost/api/futebol/importar?liga=brasileirao"),
    );
    expect(importacao.status).toBe(200);
    const resposta = await GET(
      new NextRequest("http://localhost/api/futebol?liga=brasileirao"),
    );
    const dados = await resposta.json();
    expect(resposta.status).toBe(200);
    expect(dados.clubes).toHaveLength(3);
    expect(dados.origem).toBe("api");
    await rm(diretorio, { recursive: true, force: true });
  });

  it("exige TRANSFERMARKT_API_URL no POST", async () => {
    vi.stubEnv("TRANSFERMARKT_API_URL", "");
    const { POST } = await import("@/app/api/futebol/importar/route");
    const { NextRequest } = await import("next/server");
    const resposta = await POST(
      new NextRequest("http://localhost/api/futebol/importar?liga=brasileirao"),
    );
    expect(resposta.status).toBe(503);
  });
});
