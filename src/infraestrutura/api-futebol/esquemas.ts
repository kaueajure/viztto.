import { z } from "zod";
export const esquemaRespostaApi = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(z.unknown()),
  results: z.number().int().nonnegative().optional(),
  paging: z
    .object({
      current: z.number().int().positive(),
      total: z.number().int().nonnegative(),
    })
    .optional(),
});
export const esquemaLigaApi = z.object({
  league: z.object({ id: z.number() }),
  seasons: z.array(
    z.object({ year: z.number(), start: z.string(), current: z.boolean() }),
  ),
});
export const esquemaClubeApi = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable(),
    country: z.string(),
    founded: z.number().nullable(),
    logo: z.string().url().nullable(),
  }),
  venue: z.object({ name: z.string().nullable() }).nullable(),
});
export const esquemaClube = z.object({
  id: z.string(),
  idExterno: z.number(),
  ligaId: z.string(),
  nome: z.string(),
  codigo: z.string(),
  pais: z.string(),
  fundacao: z.number().nullable(),
  escudo: z.string(),
  estadio: z.string(),
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
});
export const esquemaImportacao = z.object({
  clubes: z.array(esquemaClube).min(2),
  temporada: z.number(),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(["api", "demonstracao"]),
  aviso: z.string().nullable(),
});
