import { z } from "zod";
import type { NivelCoberturaSportmonks } from "@/dominio/constantes/sportmonks-ligas";

/**
 * Schema único de RatingMetadata — fonte de verdade para:
 * Rating Engine, JogadorMundo, snapshots Zod e save persistido.
 */
export const esquemaFonteRating = z.enum([
  "sportmonks",
  "hybrid",
  "transfermarkt-estimated",
  "generated",
]);

export const esquemaConfiancaRating = z.enum(["high", "medium", "low"]);

export const esquemaNivelCobertura = z.enum(["A", "B", "C", "D"]);

export const esquemaRatingMetadata = z
  .object({
    source: esquemaFonteRating,
    confidence: esquemaConfiancaRating,
    minutes: z.number().finite().optional(),
    appearances: z.number().finite().optional(),
    season: z.string().max(40).optional(),
    sportmonksPlayerId: z.number().finite().optional(),
    matchConfidence: z.string().max(40).optional(),
    estimatedAttributes: z.array(z.string().max(40)).max(40).optional(),
    coverageLevel: esquemaNivelCobertura.optional(),
  })
  .strict();

export type RatingMetadata = z.infer<typeof esquemaRatingMetadata>;
export type FonteRating = z.infer<typeof esquemaFonteRating>;
export type ConfiancaRating = z.infer<typeof esquemaConfiancaRating>;

/** Garante objeto compatível com o schema único (descarta chaves extras). */
export function normalizarRatingMetadata(
  valor: unknown,
): RatingMetadata | undefined {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    return undefined;
  const conhecidos = Object.fromEntries(
    Object.keys(esquemaRatingMetadata.shape)
      .filter((chave) => Object.hasOwn(valor, chave))
      .map((chave) => [chave, (valor as Record<string, unknown>)[chave]]),
  );
  const r = esquemaRatingMetadata.safeParse(conhecidos);
  return r.success ? r.data : undefined;
}

export type RatingMetadataPersistido = RatingMetadata;

export type { NivelCoberturaSportmonks };
