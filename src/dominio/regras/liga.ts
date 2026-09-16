import { z } from "zod";
import { LIGAS_SUPORTADAS } from "../constantes/ligas";

export const esquemaLiga = z
  .object({
    id: z.string(),
    idTransfermarkt: z.string(),
    termoBusca: z.string(),
    nome: z.string(),
    pais: z.string(),
    bandeira: z.string(),
    divisao: z.number().int().positive().optional(),
    reputacao: z.number().finite(),
    forcaMedia: z.number().finite(),
    quantidadeClubes: z.number().int().nonnegative(),
    regras: z.object({
      pontosVitoria: z.number(),
      pontosEmpate: z.number(),
      amarelosSuspensao: z.number(),
    }),
  })
  .transform((liga) => ({
    ...liga,
    divisao:
      liga.divisao ??
      LIGAS_SUPORTADAS.find((l) => l.id === liga.id)?.divisao ??
      1,
  }));

export const esquemaLigaDisponivel = esquemaLiga.and(
  z.object({
    temporada: z.number().int(),
    inicio: z.string(),
    clubesDisponiveis: z.number().int().min(2),
    status: z.enum(["completo", "parcial"]),
    atualizadoEm: z.string(),
  }),
);
export const esquemaLigasDisponiveis = z.object({
  ligas: z.array(esquemaLigaDisponivel),
});
export type LigaDisponivel = z.infer<typeof esquemaLigaDisponivel>;
