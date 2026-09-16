"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EstadoCarreira, FocoTreino } from "@/dominio/entidades/modelos";
import {
  adaptarPersistencia,
  obterErroPersistencia,
  repositorioNavegador,
} from "@/infraestrutura/persistencia/armazenamento";
import {
  criarCarreira,
  type EntradaCarreira,
} from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { iniciarProximaTemporada } from "@/aplicacao/casos-de-uso/temporada";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import { responderProposta } from "@/simulacao/transferencias/mercado";
import { responderDecisao } from "@/simulacao/decisoes/decisoes";
import {
  conversarAgente,
  definirPreferencias,
  contrapropor,
} from "@/simulacao/transferencias/mercado-progressivo";
import type { PreferenciasCarreira, TermosContrato } from "@/dominio/mercado";
interface JogoStore {
  conversarAgente: (
    acao: "contatar" | "buscar" | "sair" | "publicar" | "permanecer",
    clubeId?: string,
  ) => void;
  definirPreferencias: (
    preferencias: PreferenciasCarreira,
    clubes: string[],
  ) => void;
  contrapropor: (id: string, termos: TermosContrato) => void;
  carreira: EstadoCarreira | null;
  hidratado: boolean;
  erro: string | null;
  iniciar: (entrada: EntradaCarreira) => void;
  avancar: () => void;
  proximaTemporada: () => void;
  escolherTreino: (foco: FocoTreino) => void;
  responder: (id: string, aceitar: boolean) => void;
  responderDecisao: (id: string, opcaoId: string) => void;
  excluir: () => void;
  reiniciar: () => void;
  lerNoticias: () => void;
}
export const useJogoStore = create<JogoStore>()(
  persist(
    (set, get) => {
      const aplicar = (
        operacao: (carreira: EstadoCarreira) => EstadoCarreira,
      ) => {
        try {
          const atual = get().carreira;
          if (atual) set({ carreira: operacao(atual), erro: null });
          const erro = obterErroPersistencia();
          if (erro) set({ erro });
        } catch (erro) {
          set({
            erro:
              erro instanceof Error
                ? erro.message
                : "Não foi possível executar esta ação.",
          });
        }
      };
      return {
        conversarAgente: (acao, clubeId) =>
          aplicar((c) => conversarAgente(c, acao, clubeId)),
        definirPreferencias: (preferencias, clubes) =>
          aplicar((c) => definirPreferencias(c, preferencias, clubes)),
        contrapropor: (id, termos) =>
          aplicar((c) => contrapropor(c, id, termos)),
        carreira: null,
        hidratado: false,
        erro: null,
        iniciar: (entrada) => {
          try {
            set({ carreira: criarCarreira(entrada), erro: null });
            const erro = obterErroPersistencia();
            if (erro) set({ erro });
          } catch (erro) {
            set({
              erro:
                erro instanceof Error
                  ? erro.message
                  : "Não foi possível criar a carreira.",
            });
          }
        },
        avancar: () => aplicar(avancarSemana),
        proximaTemporada: () => aplicar(iniciarProximaTemporada),
        escolherTreino: (foco) => aplicar((c) => ({ ...c, focoTreino: foco })),
        responder: (id, aceitar) =>
          aplicar((c) => responderProposta(c, id, aceitar)),
        responderDecisao: (id, opcaoId) =>
          aplicar((c) => responderDecisao(c, id, opcaoId)),
        excluir: () => {
          set({ carreira: null, erro: null });
          const erro = obterErroPersistencia();
          if (erro) set({ erro });
        },
        reiniciar: () =>
          aplicar((c) =>
            criarCarreira({
              identidade: c.identidadeInicial,
              liga: c.liga,
              clubes: c.clubes.map((clube) => ({
                ...clube,
                reputacao: clube.forcaGeral,
                forma: 50,
                moral: 60,
                fadiga: 10,
              })),
              clubeId: c.clubeInicialId,
              origem: c.origem,
              seed: c.seed,
              dataInicio: c.dataInicio,
            }),
          ),
        lerNoticias: () =>
          aplicar((c) => ({
            ...c,
            noticias: c.noticias.map((n) => ({ ...n, lida: true })),
          })),
      };
    },
    {
      name: "viztto-carreira",
      version: 2,
      storage: createJSONStorage(() =>
        adaptarPersistencia(repositorioNavegador),
      ),
      skipHydration: true,
      merge: (persistido, atual) => {
        const dados = persistido as { carreira?: unknown } | undefined;
        return {
          ...atual,
          carreira: dados?.carreira ? validarSave(dados.carreira) : null,
        };
      },
      partialize: (estado) => ({ carreira: estado.carreira }),
      onRehydrateStorage: () => (_estado, erro) => {
        queueMicrotask(() =>
          useJogoStore.setState({
            hidratado: true,
            erro: erro
              ? "Não foi possível recuperar o save. Exclua a carreira para começar novamente."
              : obterErroPersistencia(),
          }),
        );
      },
    },
  ),
);
