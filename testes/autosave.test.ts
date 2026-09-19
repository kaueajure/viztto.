import { describe, expect, it, vi } from "vitest";
import { criarJogoStore } from "@/estado/jogo-store";
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
function ambiente() {
  const exemplo = exemploCarreira();
  const api: ClienteCarreira = {
    carregar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
    criar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
    salvar: vi.fn(async (_p, revision) => ({ revision: revision + 1 })),
    excluir: vi.fn(async () => {}),
  };
  return { ...exemplo, api, store: criarJogoStore(api) };
}
function pendente<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promise, resolver, rejeitar };
}

/** Espera o autosave agendado após o paint (setTimeout 0). */
async function flushAutosave() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

describe("autosave em memória", () => {
  it("uma gravação ativa, agrupa alterações e envia a revisão confirmada", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    const primeira = pendente<{ revision: number }>();
    vi.mocked(api.salvar).mockImplementationOnce(() => primeira.promise);
    store.getState().escolherTreino("drible");
    store.getState().escolherTreino("fisico");
    store.getState().escolherTreino("defesa");
    await flushAutosave();
    expect(api.salvar).toHaveBeenCalledTimes(1);
    expect(store.getState().alteracoesPendentes).toBe(true);
    expect(vi.mocked(api.salvar).mock.calls[0]![0].focoTreino).toBe("defesa");
    primeira.resolver({ revision: 1 });
    await store.getState().tentarSalvar();
    expect(api.salvar).toHaveBeenCalledTimes(1);
    expect(store.getState().revision).toBe(1);
    expect(store.getState().alteracoesPendentes).toBe(false);
  });
  it("falha preserva memória e permite retry, conflito não sobrescreve servidor", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    vi.mocked(api.salvar).mockRejectedValueOnce(new Error("offline"));
    store.getState().escolherTreino("drible");
    await store.getState().tentarSalvar();
    expect(store.getState().carreira?.focoTreino).toBe("drible");
    expect(store.getState().alteracoesPendentes).toBe(true);
    expect(store.getState().erroPersistencia).toBeTruthy();
    await store.getState().tentarSalvar();
    expect(store.getState().alteracoesPendentes).toBe(false);
    vi.mocked(api.salvar).mockRejectedValueOnce(
      new ErroApiCarreira(409, "Outra aba alterou"),
    );
    store.getState().escolherTreino("fisico");
    await store.getState().tentarSalvar();
    expect(store.getState().conflito).toBe(true);
    const chamadas = vi.mocked(api.salvar).mock.calls.length;
    await store.getState().tentarSalvar();
    expect(api.salvar).toHaveBeenCalledTimes(chamadas);
    expect(await store.getState().carregar()).toBe(false);
    expect(await store.getState().carregar(true)).toBe(true);
  });
  it("criação e exclusão só alteram memória após confirmação, falhas preservam carreira", async () => {
    const { store, api, entrada } = ambiente();
    await store.getState().carregar();
    const anterior = store.getState().carreira;
    expect(await store.getState().iniciar(entrada)).toBe(false);
    vi.mocked(api.criar).mockRejectedValueOnce(new Error("db indisponível"));
    expect(await store.getState().iniciar(entrada, true)).toBe(false);
    expect(store.getState().carreira).toBe(anterior);
    vi.mocked(api.excluir).mockRejectedValueOnce(new Error("db indisponível"));
    expect(await store.getState().excluir()).toBe(false);
    expect(store.getState().carreira).toBe(anterior);
    expect(await store.getState().excluir()).toBe(true);
    expect(store.getState().carreira).toBeNull();
  });
  it("exclusão espera PUT ativo e não deixa estado antigo ressuscitar", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    const primeira = pendente<{ revision: number }>();
    vi.mocked(api.salvar).mockImplementationOnce(() => primeira.promise);
    store.getState().escolherTreino("drible");
    const exclusao = store.getState().excluir();
    expect(api.excluir).not.toHaveBeenCalled();
    primeira.resolver({ revision: 1 });
    expect(await exclusao).toBe(true);
    expect(api.excluir).toHaveBeenCalledWith(1);
    expect(store.getState().carreira).toBeNull();
  });
});

describe('Fase 08 — regressões da fila', () => {
  it('ACK perdido reenvia o mesmo payload antes de salvar alterações mais novas', async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    let confirmado: unknown;
    let chamadas=0;
    vi.mocked(api.salvar).mockImplementation(async (p, revision) => {
      chamadas++;
      if(chamadas===1){confirmado=structuredClone(p);throw new ErroApiCarreira(0,'timeout',undefined,'TIMEOUT');}
      if(chamadas===2){expect(p).toEqual(confirmado);expect(revision).toBe(0);return {revision:1};}
      expect(p.focoTreino).toBe('defesa');expect(revision).toBe(1);return {revision:2};
    });
    store.getState().escolherTreino('drible');
    await store.getState().tentarSalvar();
    store.getState().escolherTreino('defesa');
    await store.getState().tentarSalvar();
    expect(chamadas).toBe(3);
    expect(store.getState().revision).toBe(2);
    expect(store.getState().alteracoesPendentes).toBe(false);
  });
  it.each([400,401,403,404,409,413,422])('HTTP %i não recebe retry mesmo com código genérico', async status => {
    vi.useFakeTimers();
    try {
      const {store,api}=ambiente();await store.getState().carregar();
      vi.mocked(api.salvar).mockRejectedValue(new ErroApiCarreira(status,'falha',undefined,'INDISPONIVEL'));
      store.getState().escolherTreino('defesa');await store.getState().tentarSalvar();
      const chamadas=vi.mocked(api.salvar).mock.calls.length;
      await vi.advanceTimersByTimeAsync(60000);
      expect(api.salvar).toHaveBeenCalledTimes(chamadas);
    } finally {vi.useRealTimers();}
  });
});
