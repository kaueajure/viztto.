import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ProvedorApiFootball } from "@/infraestrutura/api-futebol/api-football";
import {
  adaptarPersistencia,
  obterErroPersistencia,
} from "@/infraestrutura/persistencia/armazenamento";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
afterEach(() => vi.unstubAllGlobals());
describe("importação externa", () => {
  it("descobre temporada pelo indicador current", async () => {
    const consulta = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [],
          response: [
            {
              league: { id: 71 },
              seasons: [
                { year: 2024, start: "2024-04-10", current: false },
                { year: 2025, start: "2025-03-30", current: true },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", consulta);
    const ligas = await new ProvedorApiFootball("chave-de-teste").buscarLigas();
    expect(ligas[0].temporada).toBe(2025);
    expect(ligas[0].inicio).toBe("2025-03-30");
    expect(consulta.mock.calls[0][1].headers).toEqual({
      "x-apisports-key": "chave-de-teste",
    });
  });
  it("mapeia identidade real sem depender de resultados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: {},
            response: [1, 2].map((id) => ({
              team: {
                id,
                name: `Clube externo ${id}`,
                code: null,
                country: "Brasil",
                founded: 1910,
                logo: `https://exemplo.com/${id}.png`,
              },
              venue: { name: "Estádio externo" },
            })),
          }),
        ),
      ),
    );
    const clubes = await new ProvedorApiFootball("teste").buscarClubes(
      71,
      2025,
    );
    expect(clubes).toHaveLength(2);
    expect(clubes[0].nome).toBe("Clube externo 1");
    expect(clubes[0].escudo).toBe("https://exemplo.com/1.png");
    expect(clubes[0].forcaGeral).not.toBe(clubes[1].forcaGeral);
  });
  it("rejeita erros do provedor mesmo com HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: { requests: "Limite excedido" },
            response: [],
          }),
        ),
      ),
    );
    await expect(
      new ProvedorApiFootball("teste").buscarLigas(),
    ).rejects.toThrow("recusou");
  });
  it("rejeita resposta incompleta e rede indisponível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: [] }))),
    );
    await expect(
      new ProvedorApiFootball("teste").buscarLigas(),
    ).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Sem rede")));
    await expect(
      new ProvedorApiFootball("teste").buscarLigas(),
    ).rejects.toThrow("Sem conexão");
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
    expect(() =>
      validarSave({ ...carreira, jogador: { nome: "Incompleto" } }),
    ).toThrow();
    expect(() =>
      validarSave({ ...carreira, clubeAtualId: "inexistente" }),
    ).toThrow();
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
    adaptador.removeItem("teste");
    expect(adaptador.getItem("teste")).toBeNull();
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

describe("plano com temporadas históricas", () => {
  it("identifica o último ano permitido sem expor a resposta do provedor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: {
              plan: "Free plans do not have access to this season, try from 2022 to 2024.",
            },
            response: [],
          }),
        ),
      ),
    );
    await expect(
      new ProvedorApiFootball("teste").buscarClubes(71, 2026),
    ).rejects.toMatchObject({ ultimaTemporadaPermitida: 2024 });
  });
  it("consulta as datas reais da temporada disponível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [],
            response: [
              {
                league: { id: 71 },
                seasons: [{ year: 2024, start: "2024-04-13", current: false }],
              },
            ],
          }),
        ),
      ),
    );
    expect(
      await new ProvedorApiFootball("teste").buscarTemporada(71, 2024),
    ).toMatchObject({ temporada: 2024, inicio: "2024-04-13" });
  });
});

describe("endpoint público de importação", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("retorna demonstração explícita quando não há chave", async () => {
    vi.stubEnv("API_FOOTBALL_CHAVE", "");
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const resposta = await GET(
      new NextRequest("http://localhost/api/futebol?liga=brasileirao"),
    );
    const dados = await resposta.json();
    expect(dados.origem).toBe("demonstracao");
    expect(dados.clubes).toHaveLength(8);
    expect(dados.aviso).toContain("fictícios");
  });
  it("rejeita ligas fora da configuração", async () => {
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const resposta = await GET(
      new NextRequest("http://localhost/api/futebol?liga=inexistente"),
    );
    expect(resposta.status).toBe(400);
  });
  it("não consulta anos anteriores quando o plano recusa a edição inicial", async () => {
    vi.stubEnv("API_FOOTBALL_CHAVE", "teste-sem-temporadas-antigas");
    const consulta = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: { plan: "try from 2022 to 2024" },
          response: [],
        }),
      ),
    );
    vi.stubGlobal("fetch", consulta);
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const resultado = await GET(
      new NextRequest("http://localhost/api/futebol?liga=brasileirao"),
    );
    const dados = await resultado.json();
    expect(dados.temporada).toBe(2026);
    expect(dados.inicio).toBe("2026-01-28");
    expect(dados.origem).toBe("demonstracao");
    expect(dados.aviso).toContain("não libera");
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta.mock.calls[0][0]).toContain("season=2026");
  });
  it("inicia Europa na edição 2025/2026 com as datas retornadas pela API", async () => {
    vi.stubEnv("API_FOOTBALL_CHAVE", "teste-europa-edicao-2025");
    vi.useFakeTimers();
    const consulta = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [],
            response: [
              {
                league: { id: 39 },
                seasons: [{ year: 2025, start: "2025-08-15", current: false }],
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [],
            response: [1, 2].map((id) => ({
              team: {
                id,
                name: `Clube ${id}`,
                code: "CLU",
                country: "England",
                founded: 1900,
                logo: "https://exemplo.com/escudo.png",
              },
              venue: { name: "Estádio" },
            })),
          }),
        ),
      );
    vi.stubGlobal("fetch", consulta);
    const { GET } = await import("@/app/api/futebol/route");
    const { NextRequest } = await import("next/server");
    const promessa = GET(
      new NextRequest("http://localhost/api/futebol?liga=premier-league"),
    );
    await vi.runAllTimersAsync();
    const dados = await (await promessa).json();
    vi.useRealTimers();
    expect(dados.temporada).toBe(2025);
    expect(dados.inicio).toBe("2025-08-15");
    expect(dados.origem).toBe("api");
    expect(
      consulta.mock.calls.every(([url]) => url.includes("season=2025")),
    ).toBe(true);
  });
});
