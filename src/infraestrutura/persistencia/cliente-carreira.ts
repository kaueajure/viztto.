import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { EstadoCarreiraPersistido } from "./carreira-persistida";
import { validarSave } from "./validar-save";
import {
  CODIGOS_ERRO_SAVE,
  mensagemAmigavelPersistencia,
} from "./codigos-erro";

export class ErroApiCarreira extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public revision?: number,
    public codigo?: string,
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

function codigoDeStatus(status: number, codigo?: string): string {
  if (codigo) return codigo;
  if (status === 409) return CODIGOS_ERRO_SAVE.REVISION_CONFLICT;
  if (status === 413) return CODIGOS_ERRO_SAVE.SAVE_TOO_LARGE;
  if (status === 422) return CODIGOS_ERRO_SAVE.CATALOG_INCOMPATIBLE;
  if (status === 404) return CODIGOS_ERRO_SAVE.AUSENTE;
  if (status === 400) return CODIGOS_ERRO_SAVE.SAVE_INVALID;
  if (status >= 500) return CODIGOS_ERRO_SAVE.DATABASE_UNAVAILABLE;
  return CODIGOS_ERRO_SAVE.INDISPONIVEL;
}

async function requisitar(method: string, body?: unknown) {
  let resposta: Response;
  try {
    resposta = await fetch("/api/carreira", {
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
  } catch (erro) {
    const timeout =
      erro instanceof Error &&
      (erro.name === "TimeoutError" || /timeout/i.test(erro.message));
    const codigo = timeout
      ? CODIGOS_ERRO_SAVE.TIMEOUT
      : CODIGOS_ERRO_SAVE.NETWORK_ERROR;
    throw new ErroApiCarreira(
      0,
      mensagemAmigavelPersistencia(codigo, "Falha de rede ao salvar."),
      undefined,
      codigo,
    );
  }
  if (method === "GET" && resposta.status === 404) return null;
  let dados;
  try {
    dados = await resposta.json();
  } catch {
    const codigo = codigoDeStatus(resposta.status);
    throw new ErroApiCarreira(
      resposta.status,
      mensagemAmigavelPersistencia(
        codigo,
        resposta.status === 413
          ? "O servidor recusou o tamanho do save. Suas alterações continuam nesta página."
          : "Não foi possível acessar sua carreira no servidor. Tente novamente.",
      ),
      undefined,
      codigo,
    );
  }
  if (!resposta.ok) {
    const codigo = codigoDeStatus(resposta.status, dados.codigo);
    throw new ErroApiCarreira(
      resposta.status,
      mensagemAmigavelPersistencia(
        codigo,
        dados.erro ?? "Não foi possível acessar sua carreira no servidor.",
      ),
      dados.revision,
      codigo,
    );
  }
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
