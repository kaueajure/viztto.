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

describe("validação do estado runtime", () => {
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
  it("retorna 404 sem sugerir importação e não consulta a API externa", async () => {
    const diretorio = await ambienteImportacao();
    const consulta = vi.fn();
    vi.stubGlobal("fetch", consulta);
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const resposta = await GET(
      new NextRequest("http://localhost/api/futebol?liga=brasileirao"),
    );
    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({
      erro: "Liga não disponível na base local.",
    });
    expect(consulta).not.toHaveBeenCalled();
    await rm(diretorio, { recursive: true, force: true });
  });
});
