import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import {
  criarApiCarreira,
  COOKIE_CARREIRA,
  hashToken,
  LIMITE_SAVE_BYTES,
} from "@/infraestrutura/persistencia/api-carreira";
import { criarRepositorioCarreira } from "@/infraestrutura/banco/repositorio-carreira";
import { obterBanco, encerrarBanco } from "@/infraestrutura/banco/conexao";
import { careerSaves } from "@/infraestrutura/banco/schema";
import { eq } from "drizzle-orm";
import { criarJogoStore } from "@/estado/jogo-store";
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
vi.mock("server-only", () => ({}));
const exemplo = exemploCarreira();
function req(
  method: string,
  body?: unknown,
  token?: string,
  query = "",
  origin = "http://localhost",
) {
  return new NextRequest(`http://localhost/api/carreira${query}`, {
    method,
    headers: {
      origin,
      "Content-Type": "application/json",
      ...(token ? { cookie: `${COOKIE_CARREIRA}=${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const state = () => serializarCarreira(exemplo.carreira);

describe("segurança HTTP da carreira", () => {
  const repo = {
    ler: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
  };
  const api = criarApiCarreira(repo, async () => exemplo.catalogo);
  it("ausência de cookie retorna vazio sem abrir banco", async () => {
    expect((await api(req("GET"))).status).toBe(404);
    expect(repo.ler).not.toHaveBeenCalled();
  });
  it("rejeita UUID arbitrário na URL e escrita cross-origin", async () => {
    expect(
      (await api(req("GET", undefined, undefined, "?id=outro"))).status,
    ).toBe(400);
    expect(
      (
        await api(
          req(
            "POST",
            { state: state(), revision: null },
            undefined,
            "",
            "https://malicioso.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await api(
          req(
            "POST",
            { state: state(), revision: null },
            undefined,
            "",
            "https://localhost",
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("rejeita corpo acima do limite e payload inesperado", async () => {
    const r = req("POST", { state: state(), revision: null });
    r.headers.set("content-length", String(LIMITE_SAVE_BYTES + 1));
    expect((await api(r)).status).toBe(413);
    expect(
      (await api(req("POST", { state: state(), revision: null, id: "outro" })))
        .status,
    ).toBe(400);
    expect(repo.criar).not.toHaveBeenCalled();
  });
  it("não expõe credenciais, stack ou erro bruto do banco", async () => {
    repo.ler.mockRejectedValueOnce(
      new Error("postgresql://usuario:segredo@servidor/db"),
    );
    const resposta = await api(req("GET", undefined, "a".repeat(64)));
    expect(resposta.status).toBe(503);
    expect(await resposta.text()).not.toContain("segredo");
  });
});

describe.skipIf(!process.env.VIZTTO_TEST_DATABASE_URL)(
  "carreira no PostgreSQL real",
  () => {
    const tokens: string[] = [];
    const repo = criarRepositorioCarreira();
    const api = criarApiCarreira(repo, async () => exemplo.catalogo);
    beforeAll(() =>
      vi.stubEnv("DATABASE_URL", process.env.VIZTTO_TEST_DATABASE_URL!),
    );
    afterAll(async () => {
      for (const token of tokens)
        await obterBanco()
          .delete(careerSaves)
          .where(eq(careerSaves.accessTokenHash, hashToken(token)));
      await encerrarBanco();
      vi.unstubAllEnvs();
    });
    async function criar() {
      const resposta = await api(
        req("POST", { state: state(), revision: null }),
      );
      expect(resposta.status).toBe(201);
      const cookie = resposta.headers.get("set-cookie")!;
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=lax");
      expect(cookie).toContain("Path=/");
      const token = cookie.match(/viztto_carreira=([a-f0-9]+)/)![1];
      tokens.push(token);
      return token;
    }
    it("cria, carrega, atualiza, rejeita revisão antiga e exclui por token", async () => {
      const token = await criar();
      const salvo = await repo.ler(hashToken(token));
      expect(salvo?.accessTokenHash).not.toBe(token);
      const p = state();
      p.focoTreino = "drible";
      expect(
        (await api(req("PUT", { state: p, revision: 0 }, token))).status,
      ).toBe(200);
      expect(
        (await api(req("PUT", { state: state(), revision: 0 }, token))).status,
      ).toBe(409);
      // ACK perdido: repetir exatamente a gravação confirmada é idempotente.
      expect(
        (await api(req("PUT", { state: p, revision: 0 }, token))).status,
      ).toBe(200);
      const r = await (await api(req("GET", undefined, token))).json();
      expect(r.carreira.focoTreino).toBe("drible");
      expect(r.revision).toBe(1);
      expect((await repo.ler(hashToken(token)))?.gameDate).toBe(p.dataAtual);
      expect((await api(req("GET", undefined, "b".repeat(64)))).status).toBe(
        404,
      );
      expect(
        (await api(req("PUT", { state: p, revision: 1 }, "b".repeat(64))))
          .status,
      ).toBe(404);
      expect(
        (await api(req("DELETE", { revision: 1 }, "b".repeat(64)))).status,
      ).toBe(200);
      expect(await repo.ler(hashToken(token))).not.toBeNull();
      expect(
        (await api(req("GET", undefined, token, `?id=${salvo!.id}`))).status,
      ).toBe(400);
      expect((await api(req("DELETE", { revision: 0 }, token))).status).toBe(
        409,
      );
      const excluido = await api(req("DELETE", { revision: 1 }, token));
      expect(excluido.status).toBe(200);
      expect(excluido.headers.get("set-cookie")).toContain("Max-Age=0");
      expect(await repo.ler(hashToken(token))).toBeNull();
    });
    it("duas escritas concorrentes da mesma revisão não se sobrescrevem", async () => {
      const token = await criar();
      const a = state(),
        b = state();
      a.focoTreino = "drible";
      b.focoTreino = "fisico";
      const respostas = await Promise.all([
        api(req("PUT", { state: a, revision: 0 }, token)),
        api(req("PUT", { state: b, revision: 0 }, token)),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await repo.ler(hashToken(token)))?.revision).toBe(1);
    });
    it("JSONB não duplica identidades, URLs, fotos ou snapshots", async () => {
      const token = await criar();
      const salvo = (await repo.ler(hashToken(token)))!;
      const texto = JSON.stringify(salvo.state);
      for (const proibido of [
        '"escudo"',
        '"foto"',
        '"dadosBrutos"',
        '"idTransfermarkt"',
        '"clubes"',
        "https://imagens.test/",
      ])
        expect(texto).not.toContain(proibido);
      expect(salvo.state.clubesDinamicos[0].id).toBe(
        exemplo.carreira.clubes[0].id,
      );
      expect(salvo.state.clubesDinamicos[0].elenco[0]).toHaveProperty(
        "estatisticasCarreira",
      );
      expect(salvo.state.clubesDinamicos[0].elenco[0]).not.toHaveProperty(
        "nome",
      );
    });
    it("substituição atômica e falha de banco preservam save anterior", async () => {
      const token = await criar();
      const antes = await repo.ler(hashToken(token));
      const p = state();
      p.id = "nova-carreira";
      expect(
        (await api(req("POST", { state: p, revision: 0 }, token))).status,
      ).toBe(409);
      const falha = criarApiCarreira(
        {
          ...repo,
          atualizar: async () => {
            throw new Error("Banco indisponível");
          },
        },
        async () => exemplo.catalogo,
      );
      expect(
        (
          await falha(
            req("POST", { state: p, revision: 0, substituir: true }, token),
          )
        ).status,
      ).toBe(503);
      expect((await repo.ler(hashToken(token)))?.state).toEqual(antes?.state);
      expect(
        (
          await api(
            req("POST", { state: p, revision: 0, substituir: true }, token),
          )
        ).status,
      ).toBe(200);
      const depois = await repo.ler(hashToken(token));
      expect(depois?.id).toBe(antes?.id);
      expect(depois?.revision).toBe(1);
      expect(depois?.state.id).toBe("nova-carreira");
    });
    it("save incompatível é preservado e entidade ausente não é substituída", async () => {
      const token = await criar();
      const faltando = criarApiCarreira(repo, async () => ({
        ligas: [],
        clubes: [],
      }));
      expect((await faltando(req("GET", undefined, token))).status).toBe(422);
      expect((await repo.ler(hashToken(token)))?.revision).toBe(0);
      const p = state();
      p.clubesDinamicos[0].elenco[0].clubeId = "errado";
      expect(
        (await api(req("PUT", { state: p, revision: 0 }, token))).status,
      ).toBe(400);
      expect((await repo.ler(hashToken(token)))?.revision).toBe(0);
    });
    it("descarta completamente Zustand, recarrega do PostgreSQL e continua a simulação", async () => {
      let token = "";
      const chamar = async (method: string, body?: unknown) => {
        const resposta = await api(req(method, body, token || undefined));
        const novo = resposta.headers
          .get("set-cookie")
          ?.match(/viztto_carreira=([a-f0-9]+)/)?.[1];
        if (novo) {
          token = novo;
          tokens.push(token);
        }
        if (method === "GET" && resposta.status === 404) return null;
        const resultado = await resposta.json();
        if (!resposta.ok)
          throw new ErroApiCarreira(resposta.status, resultado.erro);
        return resultado;
      };
      const cliente: ClienteCarreira = {
        carregar: () => chamar("GET"),
        criar: (state, revision, substituir) =>
          chamar("POST", { state, revision, substituir }),
        salvar: (state, revision) => chamar("PUT", { state, revision }),
        excluir: async (revision) => {
          await chamar("DELETE", { revision });
        },
      };
      let store = criarJogoStore(cliente);
      await store.getState().carregar();
      expect(await store.getState().iniciar(exemplo.entrada)).toBe(true);
      store.getState().avancar();
      store.getState().escolherTreino("drible");
      await store.getState().tentarSalvar();
      const esperado = serializarCarreira(store.getState().carreira!);
      store = criarJogoStore(cliente);
      expect(store.getState().carreira).toBeNull();
      expect(await store.getState().carregar()).toBe(true);
      expect(serializarCarreira(store.getState().carreira!)).toEqual(esperado);
      store.getState().avancar();
      await store.getState().tentarSalvar();
      expect(store.getState().alteracoesPendentes).toBe(false);
      expect((await repo.ler(hashToken(token)))?.state.dataAtual).toBe(
        store.getState().carreira?.dataAtual,
      );
    });
  },
);
