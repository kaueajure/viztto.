import type { StateStorage } from "zustand/middleware";
export interface RepositorioLocal {
  ler(chave: string): string | null;
  salvar(chave: string, valor: string): void;
  remover(chave: string): void;
}
export const repositorioNavegador: RepositorioLocal = {
  ler: (chave) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(chave),
  salvar: (chave, valor) => window.localStorage.setItem(chave, valor),
  remover: (chave) => window.localStorage.removeItem(chave),
};
let erroPersistencia: string | null = null;
export const obterErroPersistencia = () => erroPersistencia;
export function adaptarPersistencia(
  repositorio: RepositorioLocal,
): StateStorage {
  return {
    getItem: (chave) => {
      try {
        return repositorio.ler(chave);
      } catch {
        erroPersistencia =
          "Não foi possível ler a carreira salva neste navegador.";
        return null;
      }
    },
    setItem: (chave, valor) => {
      try {
        repositorio.salvar(chave, valor);
        erroPersistencia = null;
      } catch {
        erroPersistencia =
          "Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Mantenha esta página aberta.";
      }
    },
    removeItem: (chave) => {
      try {
        repositorio.remover(chave);
      } catch {
        erroPersistencia = "Não foi possível excluir o save do navegador.";
      }
    },
  };
}
