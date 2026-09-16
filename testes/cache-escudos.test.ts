import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const arquivos = vi.hoisted(
  () => new Map<string, { dados: Uint8Array; data: number }>(),
);
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  stat: vi.fn(async (caminho: string) => {
    const a = arquivos.get(caminho);
    if (!a) throw new Error("ENOENT");
    return { size: a.dados.length, mtimeMs: a.data };
  }),
  readFile: vi.fn(async (caminho: string) => {
    const a = arquivos.get(caminho);
    if (!a) throw new Error("ENOENT");
    return a.dados;
  }),
  writeFile: vi.fn(async (caminho: string, dados: Uint8Array) => {
    arquivos.set(caminho, { dados, data: Date.now() });
  }),
  rename: vi.fn(async (origem: string, destino: string) => {
    arquivos.set(destino, arquivos.get(origem)!);
    arquivos.delete(origem);
  }),
  readdir: vi.fn(async () =>
    [...arquivos.keys()].map((c) => c.split("/").at(-1)),
  ),
  unlink: vi.fn(async (caminho: string) => {
    arquivos.delete(caminho);
  }),
}));
const png = () => {
  const dados = new Uint8Array(24);
  dados.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return dados;
};
beforeEach(() => {
  arquivos.clear();
  vi.resetModules();
  vi.unstubAllGlobals();
});
describe("cache de escudos no servidor", () => {
  it("baixa uma vez, deduplica e reutiliza cache sem enviar chave", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(png(), { headers: { "content-type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { buscarEscudo } =
      await import("@/infraestrutura/api-futebol/cache-escudos");
    const [a, b] = await Promise.all([buscarEscudo(121), buscarEscudo(121)]);
    expect(a).toEqual(b);
    expect(await buscarEscudo(121)).toEqual(a);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers).toBeUndefined();
    expect([...arquivos.keys()].some((c) => c.endsWith("/121.png"))).toBe(true);
  });
  it("serve escudo antigo quando não consegue renovar no CDN", async () => {
    const dados = png();
    arquivos.set(`${process.cwd()}/.cache/viztto/escudos/121.png`, {
      dados,
      data: Date.now() - 40 * 86400000,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("DNS indisponível")),
    );
    const { buscarEscudo } =
      await import("@/infraestrutura/api-futebol/cache-escudos");
    expect(await buscarEscudo(121)).toEqual(dados);
  });
  it("não grava resposta HTML ou imagem excedendo o limite", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("erro", { headers: { "content-type": "text/html" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { buscarEscudo } =
      await import("@/infraestrutura/api-futebol/cache-escudos");
    await expect(buscarEscudo(121)).rejects.toThrow("Formato");
    expect(arquivos.size).toBe(0);
  });
  it("interrompe novas consultas quando o CDN falha em resolver DNS", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("DNS indisponível"));
    vi.stubGlobal("fetch", fetch);
    const { buscarEscudo } =
      await import("@/infraestrutura/api-futebol/cache-escudos");
    await expect(buscarEscudo(121)).rejects.toThrow();
    await expect(buscarEscudo(122)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
