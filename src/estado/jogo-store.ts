"use client";
import { escolherObjetivo } from "@/simulacao/carreira/acompanhamento";
import type { ObjetivoPessoalTipo } from "@/dominio/desenvolvimento";
import { solicitarContrato, type PedidoContrato } from "@/simulacao/transferencias/contratos";
import { conversarTreinador } from "@/simulacao/elenco/treinador";
import type { AcaoTreinador } from "@/dominio/desenvolvimento";
import type { Posicao } from "@/dominio/entidades/modelos";
import { escolherFocoTreino } from "@/simulacao/treinamento/treinamento";
import {
  aplicarSessaoTreino,
  type EntradaSessaoTreino,
  type ResultadoSessaoTreino,
} from "@/simulacao/treinamento/aplicar-sessao";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
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
import { marcarRespostasMercadoLidas } from "@/dominio/mercado";
import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import {
  apiCarreira,
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
import {
  CODIGOS_ERRO_SAVE,
  erroHttpRetentavel,
  mensagemAmigavelPersistencia,
} from "@/infraestrutura/persistencia/codigos-erro";

export type StatusPersistencia =
  | "salvo"
  | "salvando"
  | "pendente"
  | "retentando"
  | "erro"
  | "conflito";

interface JogoStore {
  carreira: EstadoCarreira | null;
  revision: number | null;
  temSave: boolean;
  hidratado: boolean;
  salvando: boolean;
  operando: boolean;
  alteracoesPendentes: boolean;
  conflito: boolean;
  falhasPersistencia: number;
  statusPersistencia: StatusPersistencia;
  erro: string | null;
  erroPersistencia: string | null;
  codigoErroPersistencia: string | null;
  carregar: (descartar?: boolean) => Promise<boolean>;
  tentarSalvar: () => Promise<void>;
  iniciar: (entrada: EntradaCarreira, substituir?: boolean) => Promise<boolean>;
  excluir: () => Promise<boolean>;
  reiniciar: () => Promise<boolean>;
  avancar: () => void;
  proximaTemporada: () => void;
  escolherObjetivo: (tipo: ObjetivoPessoalTipo) => void;
  solicitarContrato: (pedido: PedidoContrato) => void;
  conversarTreinador: (acao: AcaoTreinador, posicao?: Posicao) => void;
  /** Mantido para foco de recuperação e testes de persistência. */
  escolherTreino: (foco: FocoTreino) => void;
  concluirSessaoTreino: (entrada: EntradaSessaoTreino) => ResultadoSessaoTreino | null;
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
      | "cancelar-emprestimo"
      | "situacao",
    clubeId?: string,
  ) => void;
  aposentar: () => void;
  definirPreferencias: (
    preferencias: PreferenciasCarreira,
    clubes: string[],
  ) => void;
  contrapropor: (id: string, termos: TermosContrato) => void;
  lerNoticias: () => void;
  lerNoticia: (ids: string[]) => void;
  marcarMercadoLido: () => void;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000] as const;
const FALHAS_ANTES_BANNER = 3;

function classificarFalha(erro: unknown): {
  retentavel: boolean;
  conflito: boolean;
  codigo: string;
  mensagem: string;
} {
  if (erro instanceof ErroApiCarreira) {
    const codigo =
      erro.codigo ??
      (erro.status === 409
        ? CODIGOS_ERRO_SAVE.REVISION_CONFLICT
        : erro.status === 413
          ? CODIGOS_ERRO_SAVE.SAVE_TOO_LARGE
          : erro.status === 422
            ? CODIGOS_ERRO_SAVE.CATALOG_INCOMPATIBLE
            : erro.status === 404
              ? CODIGOS_ERRO_SAVE.AUSENTE
              : CODIGOS_ERRO_SAVE.INDISPONIVEL);
    const retentavelPorCodigo = [
      CODIGOS_ERRO_SAVE.TIMEOUT,
      CODIGOS_ERRO_SAVE.NETWORK_ERROR,
      CODIGOS_ERRO_SAVE.DATABASE_UNAVAILABLE,
      CODIGOS_ERRO_SAVE.INDISPONIVEL,
    ].includes(codigo as never);
    return {
      retentavel: ![400,401,403,404,409,413,415,422].includes(erro.status) && (retentavelPorCodigo || erroHttpRetentavel(erro.status)),
      conflito: [409, 404].includes(erro.status),
      codigo,
      mensagem: mensagemAmigavelPersistencia(codigo, erro.message),
    };
  }
  if (erro instanceof Error) {
    const texto = erro.message;
    if (/Campo inesperado|Save inválido|incompleto|validar|Zod|Payload/i.test(texto))
      return {
        retentavel: false,
        conflito: false,
        codigo: CODIGOS_ERRO_SAVE.SAVE_INVALID,
        mensagem: mensagemAmigavelPersistencia(
          CODIGOS_ERRO_SAVE.SAVE_INVALID,
          texto,
        ),
      };
    if (/timeout|TimeoutError/i.test(texto) || erro.name === "TimeoutError")
      return {
        retentavel: true,
        conflito: false,
        codigo: CODIGOS_ERRO_SAVE.TIMEOUT,
        mensagem: mensagemAmigavelPersistencia(CODIGOS_ERRO_SAVE.TIMEOUT, texto),
      };
    if (/offline|network|Failed to fetch|NetworkError|ECONNRESET/i.test(texto))
      return {
        retentavel: true,
        conflito: false,
        codigo: CODIGOS_ERRO_SAVE.NETWORK_ERROR,
        mensagem: mensagemAmigavelPersistencia(
          CODIGOS_ERRO_SAVE.NETWORK_ERROR,
          texto,
        ),
      };
  }
  return {
    retentavel: true,
    conflito: false,
    codigo: CODIGOS_ERRO_SAVE.NETWORK_ERROR,
    mensagem: mensagemAmigavelPersistencia(
      CODIGOS_ERRO_SAVE.NETWORK_ERROR,
      "Não conseguimos salvar agora. Tentaremos novamente automaticamente.",
    ),
  };
}

/** Cada instância contém somente memória; útil também para testar reload descartando o store. */
export function criarJogoStore(api: ClienteCarreira = apiCarreira) {
  let ativo: Promise<void> | null = null;
  let carregamento: Promise<boolean> | null = null;
  let geracao = 0;
  let geracaoSerializacaoInvalida: number | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let falhasConsecutivas = 0;
  let envioPendente: { payload: ReturnType<typeof serializarCarreira>; revision: number; geracao: number } | null = null;

  return create<JogoStore>((set, get) => {
    const limparRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
    const agendarRetry = () => {
      if (retryTimer || get().conflito || !get().alteracoesPendentes) return;
      if (geracaoSerializacaoInvalida === geracao) return;
      const indice = Math.min(falhasConsecutivas - 1, BACKOFF_MS.length - 1);
      const base = BACKOFF_MS[Math.max(0, indice)] ?? BACKOFF_MS[0];
      const jitter = Math.floor(base * 0.15 * Math.random());
      set({ statusPersistencia: "retentando" });
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void drenar();
      }, base + jitter);
    };
    const falha = (erro: unknown) => {
      const info = classificarFalha(erro);
      if (!info.retentavel) envioPendente = null;
      falhasConsecutivas++;
      const persistente = !info.retentavel || falhasConsecutivas >= FALHAS_ANTES_BANNER;
      set({
        erroPersistencia: persistente
          ? falhasConsecutivas >= FALHAS_ANTES_BANNER && info.retentavel
            ? "Há alterações ainda não salvas."
            : info.mensagem
          : info.mensagem,
        codigoErroPersistencia: info.codigo,
        conflito: info.conflito,
        falhasPersistencia: falhasConsecutivas,
        statusPersistencia: info.conflito
          ? "conflito"
          : persistente
            ? "erro"
            : "retentando",
      });
      if (info.retentavel && !info.conflito) agendarRetry();
    };
    const drenar = (): Promise<void> => {
      if (ativo) return ativo;
      if (get().operando || get().conflito || !get().alteracoesPendentes)
        return Promise.resolve();
      if (geracaoSerializacaoInvalida === geracao && !envioPendente) {
        set({
          statusPersistencia: "erro",
          codigoErroPersistencia:
            get().codigoErroPersistencia ?? CODIGOS_ERRO_SAVE.SAVE_INVALID,
        });
        return Promise.resolve();
      }
      limparRetry();
      ativo = (async () => {
        set({ salvando: true, statusPersistencia: "salvando" });
        try {
          while (get().alteracoesPendentes && !get().operando && !get().conflito) {
            const carreira = get().carreira;
            const revision = get().revision;
            if (!carreira || revision === null) break;
            if (geracaoSerializacaoInvalida === geracao && !envioPendente) {
              set({
                statusPersistencia: "erro",
                codigoErroPersistencia:
                  get().codigoErroPersistencia ?? CODIGOS_ERRO_SAVE.SAVE_INVALID,
              });
              break;
            }
            const enviada = envioPendente?.geracao ?? geracao;
            let payload;
            try {
              payload = envioPendente?.payload ?? serializarCarreira(carreira);
              geracaoSerializacaoInvalida = null;
            } catch (erro) {
              geracaoSerializacaoInvalida = geracao;
              falhasConsecutivas++;
              set({
                erroPersistencia: mensagemAmigavelPersistencia(
                  CODIGOS_ERRO_SAVE.SAVE_INVALID,
                  erro instanceof Error
                    ? erro.message
                    : "Não foi possível validar o progresso para salvar.",
                ),
                codigoErroPersistencia: CODIGOS_ERRO_SAVE.SAVE_INVALID,
                falhasPersistencia: falhasConsecutivas,
                statusPersistencia: "erro",
              });
              break;
            }
            envioPendente ??= { payload, revision, geracao: enviada };
            const resultado = await api.salvar(envioPendente.payload, envioPendente.revision);
            envioPendente = null;
            falhasConsecutivas = 0;
            set({
              revision: resultado.revision,
              alteracoesPendentes: geracao !== enviada,
              erroPersistencia: null,
              codigoErroPersistencia: null,
              falhasPersistencia: 0,
              statusPersistencia:
                geracao !== enviada ? "pendente" : "salvo",
            });
          }
        } catch (erro) {
          falha(erro);
        } finally {
          set({ salvando: false });
          if (
            get().alteracoesPendentes &&
            !get().conflito &&
            get().statusPersistencia === "pendente"
          )
            set({ statusPersistencia: "pendente" });
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
        set({
          carreira,
          alteracoesPendentes: true,
          erro: null,
          statusPersistencia: get().salvando
            ? "salvando"
            : get().statusPersistencia === "retentando" ||
                get().statusPersistencia === "erro"
              ? get().statusPersistencia
              : "pendente",
        });
        if (!retryTimer) void drenar();
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
      falhasPersistencia: 0,
      statusPersistencia: "salvo",
      erro: null,
      erroPersistencia: null,
      codigoErroPersistencia: null,
      carregar: (descartar = false) => {
        if (carregamento) return carregamento;
        if (get().operando || (get().alteracoesPendentes && !descartar))
          return Promise.resolve(false);
        set({ operando: true });
        carregamento = (async () => {
          await ativo;
          limparRetry();
          try {
            const resultado = await api.carregar();
            geracao++;
            envioPendente = null;
            geracaoSerializacaoInvalida = null;
            falhasConsecutivas = 0;
            set({
              carreira: resultado?.carreira ?? null,
              revision: resultado?.revision ?? null,
              temSave: !!resultado,
              alteracoesPendentes: false,
              conflito: false,
              erro: null,
              erroPersistencia: null,
              codigoErroPersistencia: null,
              falhasPersistencia: 0,
              statusPersistencia: "salvo",
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
        limparRetry();
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
        limparRetry();
        try {
          const nova = criarCarreira(entrada);
          const resultado = await api.criar(
            serializarCarreira(nova),
            get().revision,
            substituir,
          );
          geracao++;
          envioPendente = null;
          geracaoSerializacaoInvalida = null;
          falhasConsecutivas = 0;
          set({
            carreira: resultado.carreira,
            revision: resultado.revision,
            temSave: true,
            alteracoesPendentes: false,
            conflito: false,
            erroPersistencia: null,
            codigoErroPersistencia: null,
            falhasPersistencia: 0,
            statusPersistencia: "salvo",
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
        limparRetry();
        try {
          await api.excluir(get().revision ?? 0);
          geracao++;
          envioPendente = null;
          geracaoSerializacaoInvalida = null;
          falhasConsecutivas = 0;
          set({
            carreira: null,
            revision: null,
            temSave: false,
            alteracoesPendentes: false,
            conflito: false,
            erro: null,
            erroPersistencia: null,
            codigoErroPersistencia: null,
            falhasPersistencia: 0,
            statusPersistencia: "salvo",
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
            historia: c.jogador.perfilFormacao.origem === "historia" ? c.jogador.perfilFormacao.escolhas : undefined,
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
      escolherObjetivo: t => aplicar(c => escolherObjetivo(c,t)),
      solicitarContrato: p => aplicar(c => solicitarContrato(c,p)),
      conversarTreinador: (a,p) => aplicar(c => conversarTreinador(c,a,p)),
      escolherTreino: (foco) => aplicar((c) => escolherFocoTreino(c, foco)),
      concluirSessaoTreino: (entrada) => {
        let resultado: ResultadoSessaoTreino | null = null;
        aplicar((c) => {
          const livre = estaSemClube(c);
          const clube = livre
            ? null
            : (c.clubes.find((x) => x.id === c.clubeAtualId) ?? null);
          const r = aplicarSessaoTreino(c, entrada, clube);
          resultado = r.resultado;
          return r.carreira;
        });
        if (!resultado) {
          const msg = get().erro;
          if (msg) throw new Error(msg);
        }
        return resultado;
      },
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
      lerNoticia: (ids) =>
        aplicar((c) => {
          const set = new Set(ids);
          if (!c.noticias.some((n) => set.has(n.id) && !n.lida)) return c;
          return {
            ...c,
            noticias: c.noticias.map((n) =>
              set.has(n.id) ? { ...n, lida: true } : n,
            ),
          };
        }),
      marcarMercadoLido: () => aplicar(marcarRespostasMercadoLidas),
    };
  });
}
export const useJogoStore = criarJogoStore();

/** Exposição só em desenvolvimento — nunca em build de produção. */
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production"
) {
  (
    window as unknown as { __VZ_JOGO__?: typeof useJogoStore }
  ).__VZ_JOGO__ = useJogoStore;
}
