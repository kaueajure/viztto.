"use client";
import { create } from "zustand";
import type { EstadoCarreira, FocoTreino } from "@/dominio/entidades/modelos";
import {
  criarCarreira,
  type EntradaCarreira,
} from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { iniciarProximaTemporada } from "@/aplicacao/casos-de-uso/temporada";
import { responderProposta, aposentarJogador } from "@/simulacao/transferencias/mercado";
import { responderDecisao } from "@/simulacao/decisoes/decisoes";
import {
  conversarAgente,
  definirPreferencias,
  contrapropor,
  type AcaoAgente,
} from "@/simulacao/transferencias/mercado-progressivo";
import type { PreferenciasCarreira, TermosContrato } from "@/dominio/mercado";
import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import {
  apiCarreira,
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";

interface JogoStore {
  carreira: EstadoCarreira | null;
  revision: number | null;
  temSave: boolean;
  hidratado: boolean;
  salvando: boolean;
  operando: boolean;
  alteracoesPendentes: boolean;
  conflito: boolean;
  erro: string | null;
  erroPersistencia: string | null;
  carregar: (descartar?: boolean) => Promise<boolean>;
  tentarSalvar: () => Promise<void>;
  iniciar: (entrada: EntradaCarreira, substituir?: boolean) => Promise<boolean>;
  excluir: () => Promise<boolean>;
  reiniciar: () => Promise<boolean>;
  avancar: () => void;
  proximaTemporada: () => void;
  escolherTreino: (foco: FocoTreino) => void;
  responder: (id: string, aceitar: boolean) => void;
  responderDecisao: (id: string, opcaoId: string) => void;
  conversarAgente: (
    acao:
      | "contatar"
      | "buscar"
      | "sair"
      | "publicar"
      | "permanecer"
      | "bloquear"
      | "desbloquear"
      | "emprestar"
      | "cancelar-emprestimo",
    clubeId?: string,
  ) => void;
  aposentar: () => void;
  definirPreferencias: (
    preferencias: PreferenciasCarreira,
    clubes: string[],
  ) => void;
  contrapropor: (id: string, termos: TermosContrato) => void;
  lerNoticias: () => void;
}

/** Cada instância contém somente memória; útil também para testar reload descartando o store. */
export function criarJogoStore(api: ClienteCarreira = apiCarreira) {
  let ativo: Promise<void> | null = null;
  let carregamento: Promise<boolean> | null = null;
  let geracao = 0;
  return create<JogoStore>((set, get) => {
    const falha = (erro: unknown) => {
      set({
        erroPersistencia:
          erro instanceof ErroApiCarreira
            ? erro.message
            : "Não foi possível salvar sua carreira no servidor. Há alterações não salvas. Tente novamente.",
        conflito:
          erro instanceof ErroApiCarreira && [409, 404].includes(erro.status),
      });
    };
    const drenar = (): Promise<void> => {
      if (ativo) return ativo;
      if (get().operando || get().conflito || !get().alteracoesPendentes)
        return Promise.resolve();
      ativo = (async () => {
        set({ salvando: true });
        try {
          while (get().alteracoesPendentes && !get().operando) {
            const carreira = get().carreira;
            const revision = get().revision;
            if (!carreira || revision === null) break;
            const enviada = geracao;
            const resultado = await api.salvar(
              serializarCarreira(carreira),
              revision,
            );
            set({
              revision: resultado.revision,
              alteracoesPendentes: geracao !== enviada,
              erroPersistencia: null,
            });
          }
        } catch (erro) {
          falha(erro);
        } finally {
          set({ salvando: false });
        }
      })().finally(() => {
        ativo = null;
      });
      return ativo;
    };
    const aplicar = (
      operacao: (carreira: EstadoCarreira) => EstadoCarreira,
    ) => {
      if (get().operando || get().conflito) return;
      try {
        const atual = get().carreira;
        if (!atual) return;
        const carreira = operacao(atual);
        if (carreira === atual) return;
        geracao++;
        set({ carreira, alteracoesPendentes: true, erro: null });
        if (!get().erroPersistencia) void drenar();
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
      carreira: null,
      revision: null,
      temSave: false,
      hidratado: false,
      salvando: false,
      operando: false,
      alteracoesPendentes: false,
      conflito: false,
      erro: null,
      erroPersistencia: null,
      carregar: (descartar = false) => {
        if (carregamento) return carregamento;
        if (get().operando || (get().alteracoesPendentes && !descartar))
          return Promise.resolve(false);
        set({ operando: true });
        carregamento = (async () => {
          await ativo;
          try {
            const resultado = await api.carregar();
            geracao++;
            set({
              carreira: resultado?.carreira ?? null,
              revision: resultado?.revision ?? null,
              temSave: !!resultado,
              alteracoesPendentes: false,
              conflito: false,
              erro: null,
              erroPersistencia: null,
            });
            return true;
          } catch (erro) {
            falha(erro);
            if (erro instanceof ErroApiCarreira && erro.revision !== undefined)
              set({ revision: erro.revision, temSave: true });
            return false;
          } finally {
            set({ hidratado: true, operando: false });
          }
        })().finally(() => {
          carregamento = null;
        });
        return carregamento;
      },
      tentarSalvar: async () => {
        if (get().conflito) return;
        if (!get().carreira) {
          await get().carregar();
          return;
        }
        await drenar();
      },
      iniciar: async (entrada, substituir = false) => {
        if (get().operando || !get().hidratado) return false;
        if (get().temSave && !substituir) {
          set({ erro: "Confirme a substituição da carreira existente." });
          return false;
        }
        set({ operando: true, erro: null });
        await ativo;
        try {
          const nova = criarCarreira(entrada);
          const resultado = await api.criar(
            serializarCarreira(nova),
            get().revision,
            substituir,
          );
          geracao++;
          set({
            carreira: resultado.carreira,
            revision: resultado.revision,
            temSave: true,
            alteracoesPendentes: false,
            conflito: false,
            erroPersistencia: null,
          });
          return true;
        } catch (erro) {
          falha(erro);
          return false;
        } finally {
          set({ operando: false });
        }
      },
      excluir: async () => {
        if (get().operando) return false;
        set({ operando: true });
        await ativo;
        try {
          await api.excluir(get().revision ?? 0);
          geracao++;
          set({
            carreira: null,
            revision: null,
            temSave: false,
            alteracoesPendentes: false,
            conflito: false,
            erro: null,
            erroPersistencia: null,
          });
          return true;
        } catch (erro) {
          falha(erro);
          return false;
        } finally {
          set({ operando: false });
        }
      },
      reiniciar: async () => {
        const c = get().carreira;
        if (!c) return false;
        const liga = c.ligas.find(
          (l) =>
            l.id === c.clubes.find((cl) => cl.id === c.clubeInicialId)?.ligaId,
        )!;
        const clubes = c.clubes.map((clube) => ({
          ...clube,
          reputacao: clube.forcaGeral,
          forma: 50,
          moral: 60,
          fadiga: 10,
        }));
        return get().iniciar(
          {
            identidade: c.identidadeInicial,
            liga,
            clubes: clubes.filter((cl) => cl.ligaId === liga.id),
            clubeId: c.clubeInicialId,
            origem: c.origem,
            seed: c.seed,
            dataInicio: c.dataInicio,
            ligasMundo: c.ligas.filter((l) => l.id !== liga.id),
            clubesMundo: clubes.filter((cl) => cl.ligaId !== liga.id),
          },
          true,
        );
      },
      avancar: () => aplicar(avancarSemana),
      proximaTemporada: () => aplicar(iniciarProximaTemporada),
      escolherTreino: (foco) => aplicar((c) => ({ ...c, focoTreino: foco })),
      responder: (id, aceitar) =>
        aplicar((c) => responderProposta(c, id, aceitar)),
      responderDecisao: (id, opcaoId) =>
        aplicar((c) => responderDecisao(c, id, opcaoId)),
      conversarAgente: (acao: AcaoAgente, clubeId) =>
        aplicar((c) => conversarAgente(c, acao, clubeId)),
      aposentar: () => aplicar((c) => aposentarJogador(c)),
      definirPreferencias: (p, clubes) =>
        aplicar((c) => definirPreferencias(c, p, clubes)),
      contrapropor: (id, termos) => aplicar((c) => contrapropor(c, id, termos)),
      lerNoticias: () =>
        aplicar((c) =>
          c.noticias.every((n) => n.lida)
            ? c
            : { ...c, noticias: c.noticias.map((n) => ({ ...n, lida: true })) },
        ),
    };
  });
}
export const useJogoStore = criarJogoStore();
