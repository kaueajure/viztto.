import { z } from "zod";
import legado from "../../docs/migrations/legacy-rating-metadata.json";

export const esquemaFonteRating = z.enum([
  "external",
  "multi-source",
  "transfermarkt-estimated",
  "generated",
]);
export const esquemaConfiancaRating = z.enum(["high", "medium", "low"]);
export const esquemaFonteExterna = z
  .object({
    provider: z.string().min(1).max(80),
    externalPlayerId: z.string().min(1).max(120).optional(),
    ratingOriginal: z.number().finite().optional(),
    ratingNormalizado: z.number().finite().min(1).max(99).optional(),
    externalPotential: z.number().finite().optional(),
    confidence: z.enum(["exact", "high", "medium", "low"]).optional(),
    matchedBy: z.array(z.string().max(80)).max(20).optional(),
    sourceUpdatedAt: z.string().max(50).optional(),
    calibrationVersion: z.string().max(80).optional(),
  })
  .strict();
const atual = z.object({
  source: esquemaFonteRating,
  confidence: esquemaConfiancaRating,
  sources: z.array(esquemaFonteExterna).max(20).optional(),
  estimatedAttributes: z.array(z.string().max(40)).max(40).optional(),
  calibrationVersion: z.string().max(80).optional(),
  // Dados históricos persistidos continuam disponíveis para saves antigos.
  minutes: z.number().finite().optional(),
  appearances: z.number().finite().optional(),
  season: z.string().max(40).optional(),
  matchConfidence: z.string().max(40).optional(),
});

function migrar(valor: unknown): unknown {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return valor;
  const v = { ...valor } as Record<string, unknown>;
  const source = legado.sources[v.source as keyof typeof legado.sources];
  if (!source) return valor;
  v.source = source;
  v.sources = [
    {
      provider: legado.provider,
      ...(typeof v[legado.playerId] === "number"
        ? { externalPlayerId: String(v[legado.playerId]) }
        : {}),
    },
  ];
  delete v[legado.playerId];
  delete v.coverageLevel;
  return v;
}

/** Migração somente em memória; não reescreve snapshots nem recalcula ratings. */
export const esquemaRatingMetadata = z.preprocess(migrar, atual.strict());
export type RatingMetadata = z.infer<typeof esquemaRatingMetadata>;
export type FonteRating = z.infer<typeof esquemaFonteRating>;
export type ConfiancaRating = z.infer<typeof esquemaConfiancaRating>;
export type FonteRatingExterna = z.infer<typeof esquemaFonteExterna>;
export type RatingMetadataPersistido = RatingMetadata;

export function normalizarRatingMetadata(
  valor: unknown,
): RatingMetadata | undefined {
  const v = migrar(valor);
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const conhecidos = Object.fromEntries(
    Object.keys(atual.shape)
      .filter((k) => Object.hasOwn(v, k))
      .map((k) => [k, (v as Record<string, unknown>)[k]]),
  );
  const r = esquemaRatingMetadata.safeParse(conhecidos);
  return r.success ? r.data : undefined;
}
