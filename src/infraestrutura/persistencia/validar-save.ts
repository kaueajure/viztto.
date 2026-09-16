import { esquemaLiga } from "@/dominio/regras/liga";
import { esquemaMercado, camposProposta } from "./esquema-mercado";
import { z } from "zod";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { esquemaIdentidade } from "@/dominio/regras/jogador";
import { esquemaClube } from "@/infraestrutura/transfermarkt/esquemas";
import { prepararClubesParaMundo } from "@/dominio/mundo-futebol";
import { criarTreinador } from "@/dominio/mundo-futebol";
import { normalizarIdsEventos } from "@/simulacao/eventos/eventos";

const numero = z.number().finite(),
  data = z.iso.date(),
  texto = z.string().max(10000);
const atributos = z.object(
  Object.fromEntries(
    Object.keys(NOMES_ATRIBUTOS).map((chave) => [chave, numero]),
  ),
);
const categoria = z.enum(["base", "profissional"]);
const contrato = z.object({
  clausulaRescisao: z.number().finite().nonnegative().optional(),
  luvas: z.number().finite().nonnegative().optional(),
  clubeId: texto,
  salario: numero,
  dataInicio: data,
  dataTermino: data,
  papelEsperado: texto,
  tipo: categoria,
  bonusGol: numero,
});
const estatisticas = z.object({
  jogos: numero,
  titularidades: numero,
  minutos: numero,
  gols: numero,
  assistencias: numero,
  amarelos: numero,
  vermelhos: numero,
  somaNotas: numero,
});
const classificacao = z.array(
  z.object({
    clubeId: texto,
    jogos: numero,
    pontos: numero,
    vitorias: numero,
    empates: numero,
    derrotas: numero,
    golsPro: numero,
    golsContra: numero,
    saldo: numero,
    posicao: numero,
  }),
);
const evento = z.object({
  id: texto,
  data,
  tipo: texto,
  titulo: texto,
  texto,
  remetente: texto,
  lida: z.boolean(),
});
const participacao = z.object({
  escalacao: texto,
  entrada: numero,
  saida: numero,
  minutos: numero,
  gols: numero,
  assistencias: numero,
  chutes: numero,
  passes: numero,
  passesChave: numero,
  desarmes: numero,
  amarelos: numero,
  vermelhos: numero,
  faltas: numero,
  defesas: numero,
  nota: numero.nullable(),
  confianca: numero,
  moral: numero,
  desenvolvimento: numero,
});
const partidas = z.array(
  z.object({
    id: texto,
    rodada: numero,
    data,
    mandanteId: texto,
    visitanteId: texto,
    categoria,
    golsMandante: numero.nullable(),
    golsVisitante: numero.nullable(),
    eventos: z.array(
      z.object({
        minuto: numero,
        tipo: texto,
        clubeId: texto,
        texto,
        jogador: z.boolean(),
      }),
    ),
    participacao: participacao.nullable(),
  }),
);
const esquemaTemporada = z.object({
  ano: numero,
  rodadaAtual: numero,
  totalRodadas: numero,
  partidas,
  partidasBase: partidas,
  classificacao,
  classificacaoBase: classificacao,
  encerrada: z.boolean(),
});

export const esquemaCarreira = z.object({
  versao: z.literal(2),
  id: texto,
  seed: texto,
  estadoAleatorio: numero,
  dataAtual: data,
  dataInicio: data,
  identidadeInicial: esquemaIdentidade,
  clubeInicialId: texto,
  clubeAtualId: texto,
  origem: z.enum(["api", "demonstracao"]),
  clubes: z.array(esquemaClube).min(2),
  liga: esquemaLiga,
  ligas: z.array(esquemaLiga).min(1),
  jogador: esquemaIdentidade.extend({
    idade: numero.min(15),
    atributos,
    desenvolvimento: atributos,
    overall: numero,
    potencialInterno: numero,
    personalidade: z.object({
      profissionalismo: numero,
      ambicao: numero,
      lealdade: numero,
      disciplina: numero,
      temperamento: numero,
      adaptabilidade: numero,
      lideranca: numero,
    }),
    categoria,
    status: texto,
    moral: numero,
    forma: numero,
    condicionamento: numero,
    fadiga: numero,
    ritmo: numero,
    confianca: numero,
    reputacao: numero,
    valorMercado: numero,
    contrato,
    lesao: z
      .object({
        tipo: texto,
        gravidade: texto,
        diasRecuperacao: numero,
        dataInicio: data,
        dataPrevistaRetorno: data,
      })
      .nullable(),
    suspensao: numero,
    amarelosAcumulados: numero,
    notasRecentes: z.array(numero),
  }),
  temporada: esquemaTemporada,
  temporadasExternas: z.record(texto, esquemaTemporada).default({}),
  focoTreino: z.enum([
    "equilibrado",
    "finalizacao",
    "criacao",
    "drible",
    "velocidade",
    "fisico",
    "defesa",
    "recuperacao",
  ]),
  mercado: esquemaMercado,
  propostas: z.array(
    z.object({
      ...camposProposta,
      id: texto,
      clubeId: texto,
      tipo: z.enum(["transferencia", "renovacao", "emprestimo"]),
      salario: numero,
      duracaoAnos: numero,
      papelPrometido: texto.default("rotacao"),
      etapa: texto.default("proposta_jogador"),
      data,
      validade: data,
      status: z.enum(["pendente", "aceita", "rejeitada", "expirada"]),
    }),
  ),
  transferenciasRecentes: z
    .array(
      z.object({
        id: texto,
        jogadorId: texto,
        nomeJogador: texto,
        deClubeId: texto,
        paraClubeId: texto,
        valor: numero,
        salario: numero,
        duracaoAnos: numero,
        papelPrometido: texto,
        etapa: texto,
        data,
        aoUsuario: z.boolean(),
      }),
    )
    .default([]),
  janelaTransferencias: z
    .enum(["fechada", "verao", "inverno"])
    .default("fechada"),
  relacionamentos: z
    .object({
      treinador: numero,
      diretoria: numero,
      agente: numero,
    })
    .default({ treinador: 50, diretoria: 50, agente: 60 }),
  decisoes: z
    .array(
      z.object({
        id: texto,
        data,
        tipo: texto,
        remetente: texto,
        titulo: texto,
        texto,
        opcoes: z.array(z.object({ id: texto, rotulo: texto })),
        resolvida: z.boolean(),
        opcaoEscolhida: texto.optional(),
      }),
    )
    .default([]),
  noticias: z.array(evento),
  eventos: z.array(evento),
  objetivos: z.array(
    z.object({
      id: texto,
      titulo: texto,
      meta: numero,
      progresso: numero,
      concluido: z.boolean(),
    }),
  ),
  registros: z.array(
    z.object({
      ano: numero,
      clubeId: texto,
      competicao: texto,
      categoria,
      estatisticas,
    }),
  ),
  temporadasAnteriores: z.array(
    z.object({
      ano: numero,
      campeaoId: texto,
      campeaoBaseId: texto,
      ligaId: texto.optional(),
      classificacao,
      classificacaoBase: classificacao,
    }),
  ),
  ultimaPartidaId: texto.nullable(),
  aposentado: z.boolean().optional(),
  dataAposentadoria: data.optional(),
  idadeAposentadoria: numero.optional(),
  clubeFinalId: texto.optional(),
});

function migrarParaV2(valor: unknown): unknown {
  if (!valor || typeof valor !== "object") return valor;
  const bruto = valor as Record<string, unknown>;
  if (bruto.versao === 2) return bruto;
  if (bruto.versao !== 1) return bruto;
  const liga = bruto.liga as EstadoCarreira["liga"];
  const clubes = (bruto.clubes as EstadoCarreira["clubes"]).map((c) => ({
    ...c,
    bancoIds: c.bancoIds ?? [],
    orcamento: c.orcamento ?? Math.round((c.poderFinanceiro ?? 60) * 1_200_000),
    treinador:
      c.treinador ??
      criarTreinador(c.id, c.formacaoPreferida ?? "4-3-3", liga.id),
  }));
  return {
    ...bruto,
    versao: 2,
    ligas: [liga],
    clubes,
    temporadasExternas: {},
    transferenciasRecentes: [],
    janelaTransferencias: "fechada",
    relacionamentos: { treinador: 50, diretoria: 50, agente: 60 },
    decisoes: [],
    propostas: ((bruto.propostas as unknown[]) ?? []).map((p) => {
      const prop = p as Record<string, unknown>;
      return {
        ...prop,
        papelPrometido: prop.papelPrometido ?? "rotacao",
        etapa: prop.etapa ?? "proposta_jogador",
      };
    }),
  };
}

export function validarSave(valor: unknown): EstadoCarreira {
  const migrado = migrarParaV2(valor);
  const resultado = esquemaCarreira.safeParse(migrado);
  if (!resultado.success)
    throw new Error("O save está incompleto ou incompatível.");
  const c = resultado.data;
  const ids = new Set(c.clubes.map((clube) => clube.id));
  if (
    !ids.has(c.clubeAtualId) ||
    !ids.has(c.clubeInicialId) ||
    c.temporada.partidas.some(
      (p) => !ids.has(p.mandanteId) || !ids.has(p.visitanteId),
    )
  )
    throw new Error("Os clubes do save são inválidos.");

  const carreira = c as unknown as EstadoCarreira;
  normalizarIdsEventos(carreira.noticias);
  normalizarIdsEventos(carreira.eventos);
  // Só hidrata elencos legados (pré–JogadorMundo); saves v2 já vivos não são reprocessados.
  carreira.clubes = carreira.clubes.map((clube) => {
    const precisaHidratacao = clube.elenco.some(
      (j) =>
        typeof (j as { overall?: number }).overall !== "number" ||
        !(j as { estatisticasCarreira?: unknown }).estatisticasCarreira,
    );
    if (!precisaHidratacao) {
      if (!clube.treinador)
        clube.treinador = criarTreinador(
          clube.id,
          clube.formacaoPreferida,
          carreira.liga.id,
        );
      clube.bancoIds = clube.bancoIds ?? [];
      clube.orcamento =
        clube.orcamento ?? Math.round(clube.poderFinanceiro * 1_200_000);
      return clube;
    }
    const liga =
      carreira.ligas.find((l) => l.id === clube.ligaId) ?? carreira.liga;
    return prepararClubesParaMundo([clube], liga)[0]!;
  });
  return carreira;
}
