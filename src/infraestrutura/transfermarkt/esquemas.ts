import { z } from "zod";
import { FORMACOES } from "@/dominio/formacao";

export const esquemaJogadorExterno = z
  .object({
    id: z.string(),
    idExterno: z.number(),
    idTransfermarkt: z.string(),
    nome: z.string(),
    idade: z.number().nullable(),
    numero: z.number().nullable(),
    posicao: z.string(),
    grupoPosicao: z.enum(["GOL", "DEF", "MEI", "ATA"]),
    nacionalidade: z.array(z.string()),
    altura: z.number().nullable(),
    peDominante: z.string().nullable(),
    valorMercado: z.number().nullable(),
    dataNascimento: z.string().nullable(),
    contratoAte: z.string().nullable(),
    joinedOn: z.string().nullable(),
    signedFrom: z.string().nullable(),
    foto: z.string(),
    overall: z.number().optional(),
    potencial: z.number().optional(),
    posicaoPrincipal: z.string().optional(),
    posicoesSecundarias: z.array(z.string()).optional(),
    clubeId: z.string().nullable().optional(),
    forma: z.number().optional(),
    moral: z.number().optional(),
    condicionamento: z.number().optional(),
    fadiga: z.number().optional(),
    salario: z.number().optional(),
    lesionado: z.boolean().optional(),
    suspensao: z.number().optional(),
    statusElenco: z.string().optional(),
    lesao: z
      .object({
        tipo: z.string(),
        gravidade: z.string(),
        diasRecuperacao: z.number(),
        dataInicio: z.string(),
        dataPrevistaRetorno: z.string(),
      })
      .nullable()
      .optional(),
    estatisticasCarreira: z
      .object({
        jogos: z.number(),
        titularidades: z.number(),
        minutos: z.number(),
        gols: z.number(),
        assistencias: z.number(),
        amarelos: z.number(),
        vermelhos: z.number(),
        somaNotas: z.number(),
      })
      .optional(),
  })
  .passthrough();

const esquemaTreinador = z.object({
  id: z.string(),
  nome: z.string(),
  formacaoPreferida: z.enum(FORMACOES),
  estilo: z.enum(["posse", "direto", "equilibrado", "contra-ataque"]),
  preferenciaJovens: z.number(),
  disciplina: z.number(),
  rotacao: z.number(),
  paciencia: z.number(),
});

export const esquemaClube = z
  .object({
    id: z.string(),
    idExterno: z.number(),
    idTransfermarkt: z.string(),
    ligaId: z.string(),
    nome: z.string(),
    nomeCurto: z.string(),
    nomeOficial: z.string().nullable(),
    codigo: z.string(),
    pais: z.string(),
    fundacao: z.number().nullable(),
    escudo: z.string(),
    estadio: z.string(),
    capacidadeEstadio: z.number().nullable(),
    tamanhoElenco: z.number().nullable(),
    idadeMedia: z.number().nullable(),
    valorElenco: z.number().nullable(),
    registroTransferencias: z.number().nullable(),
    formacaoPreferida: z.enum(FORMACOES),
    goleiroTitularId: z.string().nullable(),
    titularesIds: z.array(z.string()),
    bancoIds: z.array(z.string()).optional(),
    treinador: esquemaTreinador.optional(),
    reputacao: z.number(),
    forcaGeral: z.number(),
    forcaAtaque: z.number(),
    forcaMeio: z.number(),
    forcaDefesa: z.number(),
    qualidadeBase: z.number(),
    poderFinanceiro: z.number(),
    orcamento: z.number().optional(),
    forma: z.number(),
    moral: z.number(),
    fadiga: z.number(),
    elenco: z.array(esquemaJogadorExterno),
    dadosBrutos: z.record(z.string(), z.unknown()).nullable(),
  })
  .transform((c) => ({
    ...c,
    bancoIds: c.bancoIds ?? [],
    orcamento: c.orcamento ?? Math.round(c.poderFinanceiro * 1_200_000),
    treinador: c.treinador ?? {
      id: `tec-${c.id}`,
      nome: "Comissão técnica",
      formacaoPreferida: c.formacaoPreferida,
      estilo: "equilibrado" as const,
      preferenciaJovens: 50,
      disciplina: 50,
      rotacao: 50,
      paciencia: 50,
    },
  }));

export const esquemaErroImportacao = z.object({
  clubeId: z.string(),
  nome: z.string(),
  motivo: z.string(),
});

export const esquemaProgressoImportacao = z.object({
  total: z.number().int().nonnegative(),
  importados: z.number().int().nonnegative(),
  falhas: z.number().int().nonnegative(),
  clubeAtual: z.string().nullable(),
});

export const esquemaDadosLigaImportados = z.object({
  temporadaTransfermarkt: z.string().optional(),
  ligaId: z.string(),
  temporada: z.number(),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  importadoEm: z.string(),
  atualizadoEm: z.string(),
  status: z.enum(["em_andamento", "parcial", "completo", "interrompido"]),
  progresso: esquemaProgressoImportacao,
  clubes: z.array(esquemaClube),
  erros: z.array(esquemaErroImportacao),
  motivoInterrupcao: z.string().nullable().optional(),
});

export const esquemaImportacao = z.object({
  clubes: z.array(esquemaClube).min(2),
  erros: z.array(esquemaErroImportacao).optional(),
  temporada: z.number(),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(["api", "demonstracao"]),
  aviso: z.string().nullable(),
  progresso: esquemaProgressoImportacao.optional(),
});

export const esquemaCompetitionSearch = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      country: z.string(),
      clubs: z.number().optional(),
      players: z.number().optional(),
    }),
  ),
});

export const esquemaCompetitionClubs = z.object({
  id: z.string(),
  name: z.string(),
  seasonId: z.string(),
  clubs: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const esquemaClubProfile = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string(),
  officialName: z.string().nullable().optional(),
  image: z.string(),
  foundedOn: z.string().nullable().optional(),
  stadiumName: z.string(),
  stadiumSeats: z.number(),
  currentTransferRecord: z.number().optional(),
  currentMarketValue: z.number().nullable().optional(),
  squad: z
    .object({
      size: z.number(),
      averageAge: z.number(),
      foreigners: z.number().optional(),
      nationalTeamPlayers: z.number().optional(),
    })
    .optional(),
  league: z
    .object({
      id: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      countryName: z.string().nullable().optional(),
    })
    .optional(),
});

export const esquemaClubPlayers = z.object({
  id: z.string(),
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      position: z.string(),
      dateOfBirth: z.string().nullable().optional(),
      age: z.number().nullable().optional(),
      nationality: z.array(z.string()).default([]),
      currentClub: z.string().nullable().optional(),
      height: z.number().nullable().optional(),
      foot: z.string().nullable().optional(),
      joinedOn: z.string().nullable().optional(),
      joined: z.string().nullable().optional(),
      signedFrom: z.string().nullable().optional(),
      contract: z.string().nullable().optional(),
      marketValue: z.number().nullable().optional(),
      status: z.string().nullable().optional(),
    }),
  ),
});
