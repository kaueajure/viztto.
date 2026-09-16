import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { EstadoCarreiraPersistido } from "./carreira-persistida";
import { validarSave } from "./validar-save";

export class ErroApiCarreira extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public revision?: number,
  ) {
    super(mensagem);
  }
}
export interface SaveCarregado {
  carreira: EstadoCarreira;
  revision: number;
}
export interface ClienteCarreira {
  carregar(): Promise<SaveCarregado | null>;
  criar(
    state: EstadoCarreiraPersistido,
    revision: number | null,
    substituir: boolean,
  ): Promise<SaveCarregado>;
  salvar(
    state: EstadoCarreiraPersistido,
    revision: number,
  ): Promise<{ revision: number }>;
  excluir(revision: number): Promise<void>;
}
async function requisitar(method: string, body?: unknown) {
  const resposta = await fetch("/api/carreira", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (method === "GET" && resposta.status === 404) return null;
  let dados;
  try {
    dados = await resposta.json();
  } catch {
    throw new ErroApiCarreira(
      resposta.status,
      resposta.status === 413
        ? "O servidor recusou o tamanho do save. Suas alterações continuam nesta página."
        : "Não foi possível acessar sua carreira no servidor. Tente novamente.",
    );
  }
  if (!resposta.ok)
    throw new ErroApiCarreira(
      resposta.status,
      dados.erro ?? "Não foi possível acessar sua carreira no servidor.",
      dados.revision,
    );
  return dados;
}
function carregarResposta(dados: {
  carreira: unknown;
  revision: number;
}): SaveCarregado {
  if (!Number.isSafeInteger(dados.revision) || dados.revision < 0)
    throw new Error("Resposta inválida do servidor.");
  return { carreira: validarSave(dados.carreira), revision: dados.revision };
}
export const apiCarreira: ClienteCarreira = {
  async carregar() {
    const dados = await requisitar("GET");
    return dados ? carregarResposta(dados) : null;
  },
  async criar(state, revision, substituir) {
    return carregarResposta(
      await requisitar("POST", { state, revision, substituir }),
    );
  },
  async salvar(state, revision) {
    const dados = await requisitar("PUT", { state, revision });
    if (
      !Number.isSafeInteger(dados.revision) ||
      dados.revision !== revision + 1
    )
      throw new Error("Resposta inválida do servidor.");
    return { revision: dados.revision };
  },
  async excluir(revision) {
    await requisitar("DELETE", { revision });
  },
};
