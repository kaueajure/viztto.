import { describe, expect, it, vi } from "vitest";
import { criarJogoStore } from "@/estado/jogo-store";
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
import { CODIGOS_ERRO_SAVE } from "@/infraestrutura/persistencia/codigos-erro";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import { esquemaIdentidade } from "@/dominio/regras/jogador";

describe("save incompatível vs criação", () => {
  it("GET 422 marca saveIncompativel sem banner de persistência", async () => {
    const exemplo = exemploCarreira();
    const api: ClienteCarreira = {
      carregar: vi.fn(async () => {
        throw new ErroApiCarreira(
          422,
          "incompatível",
          3,
          CODIGOS_ERRO_SAVE.INCOMPATIVEL,
        );
      }),
      criar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 4 })),
      salvar: vi.fn(async (_p, revision) => ({ revision: revision + 1 })),
      excluir: vi.fn(async () => {}),
    };
    const store = criarJogoStore(api);
    expect(await store.getState().carregar()).toBe(false);
    const s = store.getState();
    expect(s.saveIncompativel).toBe(true);
    expect(s.temSave).toBe(true);
    expect(s.revision).toBe(3);
    expect(s.carreira).toBeNull();
    expect(s.erroPersistencia).toBeNull();
    expect(s.codigoErroPersistencia).toBeNull();
    expect(s.statusPersistencia).toBe("salvo");
  });

  it("criar com substituir limpa saveIncompativel", async () => {
    const exemplo = exemploCarreira();
    const api: ClienteCarreira = {
      carregar: vi.fn(async () => {
        throw new ErroApiCarreira(
          422,
          "incompatível",
          1,
          CODIGOS_ERRO_SAVE.CATALOG_INCOMPATIBLE,
        );
      }),
      criar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 2 })),
      salvar: vi.fn(async (_p, revision) => ({ revision: revision + 1 })),
      excluir: vi.fn(async () => {}),
    };
    const store = criarJogoStore(api);
    await store.getState().carregar();
    expect(await store.getState().iniciar(exemplo.entrada, false)).toBe(false);
    expect(store.getState().erro).toMatch(/Substituir|antiga/i);
    expect(await store.getState().iniciar(exemplo.entrada, true)).toBe(true);
    expect(store.getState().saveIncompativel).toBe(false);
    expect(store.getState().carreira).toBeTruthy();
    expect(api.criar).toHaveBeenCalledWith(expect.anything(), 1, true);
  });
});

describe("mensagens de identidade em português", () => {
  it("não devolve textos técnicos do Zod em inglês", () => {
    const r = esquemaIdentidade.safeParse({
      nome: "A",
      sobrenome: "",
      nacionalidade: "",
      idade: 10,
      posicao: "XX",
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 100,
      peso: 30,
      arquetipo: "equilibrado",
    });
    expect(r.success).toBe(false);
    for (const issue of r.error!.issues) {
      expect(issue.message).not.toMatch(/Too small|Invalid input|expected /i);
      expect(issue.message.length).toBeGreaterThan(3);
    }
  });
});
