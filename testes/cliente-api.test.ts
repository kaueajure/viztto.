import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteApiFutebol } from "@/infraestrutura/api-futebol/cliente-api";
import { validarPng } from "@/infraestrutura/api-futebol/cache-escudos";
function ambiente() {
  let agora = Date.UTC(2026, 8, 15, 12);
  const pausas: number[] = [];
  const cliente = new ClienteApiFutebol(
    "segredo",
    async (ms) => {
      pausas.push(ms);
      agora += ms;
    },
    () => agora,
  );
  return { cliente, pausas };
}
const sucesso = () =>
  new Response(
    JSON.stringify({
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [{ id: 1 }],
    }),
    {
      headers: {
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "99",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
      },
    },
  );
afterEach(() => vi.unstubAllGlobals());
describe("cliente API com controle de consumo", () => {
  it("deduplica e guarda sucesso sem permitir mutação do cache", async () => {
    const fetch = vi.fn().mockImplementation(async () => sucesso());
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    const [a, b] = await Promise.all([
      cliente.consultar("leagues?current=true"),
      cliente.consultar("leagues?current=true"),
    ]);
    a.push("alteracao");
    expect(b).toHaveLength(1);
    expect(await cliente.consultar("leagues?current=true")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cliente.obterCota().restanteDia).toBe(99);
  });
  it("espaça chamadas diferentes conforme limite por minuto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => sucesso()),
    );
    const { cliente, pausas } = ambiente();
    await cliente.consultar("leagues?current=true");
    await cliente.consultar("teams?league=71&season=2024");
    expect(pausas).toContain(6100);
  });
  it("repete 429 com espera progressiva e número limitado", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { cliente, pausas } = ambiente();
    await expect(
      cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ codigo: "limite" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(pausas).toContain(1000);
    expect(pausas).toContain(2000);
    await expect(
      cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ codigo: "limite" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("respeita Retry-After longo sem manter uma requisição esperando", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", { status: 429, headers: { "retry-after": "120" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    await expect(
      cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ tentarEmSegundos: 120 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("não repete autenticação nem respostas malformadas", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      ambiente().cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ codigo: "autenticacao" });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue(new Response("html"));
    await expect(
      ambiente().cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ codigo: "resposta" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("repete falha transitória uma vez e recupera", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockImplementation(async () => sucesso());
    vi.stubGlobal("fetch", fetch);
    expect(await ambiente().cliente.consultar("leagues?current=true")).toEqual([
      { id: 1 },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("bloqueia chamadas após esgotar cota diária mas serve cache", async () => {
    const resposta = sucesso();
    resposta.headers.set("x-ratelimit-requests-remaining", "0");
    const fetch = vi.fn().mockResolvedValue(resposta);
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    await cliente.consultar("leagues?current=true");
    await expect(
      cliente.consultar("teams?league=71&season=2024"),
    ).rejects.toMatchObject({ codigo: "limite" });
    expect(await cliente.consultar("leagues?current=true")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("não aceita paginação parcial nem endpoints não utilizados", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [],
          response: [],
          paging: { current: 1, total: 2 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    await expect(
      cliente.consultar("leagues?current=true"),
    ).rejects.toMatchObject({ codigo: "resposta" });
    await expect(cliente.consultar("fixtures?live=all")).rejects.toMatchObject({
      codigo: "parametros",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("guarda restrição de temporada para não consumir quota novamente", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: { plan: "try from 2022 to 2024" },
          response: [],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    await expect(
      cliente.consultar("teams?league=71&season=2026"),
    ).rejects.toMatchObject({ ultimaTemporadaPermitida: 2024 });
    await expect(
      cliente.consultar("teams?league=71&season=2026"),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("escudos", () => {
  it("rejeita HTML e arquivos grandes disfarçados de imagem", () => {
    expect(validarPng(new TextEncoder().encode("<html>erro</html>"))).toBe(
      false,
    );
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(validarPng(png)).toBe(true);
    expect(validarPng(new Uint8Array(1024 * 1024 + 1))).toBe(false);
  });
  it("rejeita caminho arbitrário antes de acessar o provedor", async () => {
    const { GET } = await import("@/app/api/futebol/escudos/[id]/route");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const resposta = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "../segredo" }),
    });
    expect(resposta.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("edições iniciais do viztto", () => {
  it("separa ano civil brasileiro e temporada europeia, inclusive nos anos seguintes", async () => {
    const { TEMPORADAS_INICIAIS, formatarTemporada } =
      await import("@/dominio/constantes/temporadas-iniciais");
    expect(TEMPORADAS_INICIAIS.brasileirao.ano).toBe(2026);
    for (const [id, edicao] of Object.entries(TEMPORADAS_INICIAIS)) {
      if (id === "brasileirao") continue;
      expect(edicao.ano).toBe(2025);
      expect(edicao.inicio.startsWith("2025-08")).toBe(true);
      expect(formatarTemporada(id, 2025)).toBe("2025/2026");
      expect(formatarTemporada(id, 2026)).toBe("2026/2027");
    }
    expect(formatarTemporada("brasileirao", 2027)).toBe("2027");
  });
});
