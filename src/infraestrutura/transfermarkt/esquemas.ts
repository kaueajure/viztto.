import { z } from "zod";
import { FORMACOES } from "@/dominio/formacao";

export const esquemaJogadorExterno = z.object({
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
});

export const esquemaClube = z.object({
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
  reputacao: z.number(),
  forcaGeral: z.number(),
  forcaAtaque: z.number(),
  forcaMeio: z.number(),
  forcaDefesa: z.number(),
  qualidadeBase: z.number(),
  poderFinanceiro: z.number(),
  forma: z.number(),
  moral: z.number(),
  fadiga: z.number(),
  elenco: z.array(esquemaJogadorExterno),
  dadosBrutos: z.record(z.string(), z.unknown()).nullable(),
});

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
  precisaImportar: z.boolean().optional(),
});

export const esquemaStatusImportacao = z.object({
  ligaId: z.string(),
  status: z.enum([
    "em_andamento",
    "parcial",
    "completo",
    "interrompido",
    "nao_importada",
  ]),
  progresso: esquemaProgressoImportacao.nullable(),
  motivoInterrupcao: z.string().nullable().optional(),
  importadoEm: z.string().nullable().optional(),
  atualizadoEm: z.string().nullable().optional(),
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
