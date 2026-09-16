import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteTransfermarkt } from "@/infraestrutura/transfermarkt/cliente";
import { respostaJson } from "./auxiliar-mock-importacao";

function ambiente() {
  let agora = Date.UTC(2026, 0, 15, 12);
  const pausas: number[] = [];
  const cliente = new ClienteTransfermarkt(
    "https://tm.test",
    async (ms) => {
      pausas.push(ms);
      agora += ms;
    },
    () => agora,
    1500,
  );
  return { cliente, pausas };
}

afterEach(() => vi.unstubAllGlobals());

describe("cliente Transfermarkt", () => {
  it("serializa chamadas e aplica intervalo", async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      respostaJson({ ok: true }),
    );
    vi.stubGlobal("fetch", fetch);
    const { cliente, pausas } = ambiente();
    await cliente.consultar("/clubs/1/profile");
    await cliente.consultar("/clubs/2/profile");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(pausas.some((p) => p >= 1500)).toBe(true);
  });

  it("repete 429 com espera", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "retry-after": "2" } }),
      )
      .mockResolvedValue(respostaJson({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const { cliente, pausas } = ambiente();
    await expect(cliente.consultar("/clubs/1/profile")).resolves.toEqual({
      ok: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(pausas.some((p) => p >= 3000)).toBe(true);
  });

  it("cacheia respostas bem-sucedidas", async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson({ id: "1" }));
    vi.stubGlobal("fetch", fetch);
    const { cliente } = ambiente();
    await cliente.consultar("/clubs/1/profile");
    await cliente.consultar("/clubs/1/profile");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
