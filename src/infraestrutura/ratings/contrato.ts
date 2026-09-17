import { z } from "zod";
import { esquemaFonteExterna } from "@/dominio/rating-metadata";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";

const identidade = z.string().min(1).max(200);
const rating = z.number().finite().min(1).max(99);
export const esquemaJogadorCanonico = z
  .object({
    id: identidade,
    transfermarktId: identidade,
    name: identidade,
    league: identidade,
    club: identidade,
    position: identidade,
    dateOfBirth: z.iso.date().nullable(),
    country: z.string().nullable(),
    height: z.number().finite().nullable(),
    marketValue: z.number().finite().nullable(),
    age: z.number().finite().nullable(),
    division: z.string().nullable(),
    clubStrength: z.number().finite(),
    engineOverall: rating,
  })
  .strict();
export type JogadorCanonico = z.infer<typeof esquemaJogadorCanonico>;
export interface LoteCanonico {
  version: 1;
  batchId: string;
  players: JogadorCanonico[];
}
export const esquemaRatingExterno = esquemaFonteExterna
  .extend({
    externalPlayerId: identidade,
    ratingOriginal: z.number().finite(),
    ratingNormalizado: rating,
    confidence: z.enum(["exact", "high", "medium", "low"]),
    calibrationVersion: identidade,
    potentialNormalizado: rating.optional(),
    attributes: z
      .record(z.string(), rating)
      .refine(
        (attrs) =>
          Object.keys(attrs).every((k) => Object.hasOwn(NOMES_ATRIBUTOS, k)),
        "Atributo externo sem mapeamento Viztto",
      ),
  })
  .strict();
export type RatingExterno = z.infer<typeof esquemaRatingExterno>;
const contador = z.number().int().nonnegative();
const esquemaResultado = z
  .object({
    version: z.literal(1),
    batchId: identidade,
    players: z.array(
      z
        .object({
          id: identidade,
          transfermarktId: identidade,
          sources: z.array(esquemaRatingExterno).max(20),
        })
        .strict(),
    ),
    // Contadores do LOTE inteiro; nunca use como métrica de uma liga.
    providers: z.record(
      z.string(),
      z
        .object({
          requests: contador,
          cacheHits: contador,
          errors: contador,
          staleMappings: contador,
          providerCandidates: contador,
          synthetic: z.boolean(),
          status: z.enum(["healthy", "degraded", "failed"]),
        })
        .strict(),
    ),
    diagnostics: z.record(
      z.string(),
      z.record(
        z.string(),
        z
          .object({
            confidence: z.enum([
              "exact",
              "high",
              "medium",
              "low",
              "ambiguous",
              "unmatched",
            ]),
            collision: z.boolean(),
            matchedBy: z.array(z.string()),
            // Por jogador: base para agregar candidatos e falhas por liga.
            candidateCount: contador,
            error: z.boolean(),
          })
          .strict(),
      ),
    ),
  })
  .strict();
export type ResultadoBot = z.infer<typeof esquemaResultado>;

/** Rejeita lote velho, IDs estranhos, faltantes, duplicados e relação externa não 1:1. */
export function validarResultadoBot(
  valor: unknown,
  lote: LoteCanonico,
): ResultadoBot {
  const r = esquemaResultado.parse(valor);
  if (r.batchId !== lote.batchId || r.players.length !== lote.players.length)
    throw new Error("Contrato ratings: lote incompatível.");
  const canonicos = new Map(lote.players.map((p) => [p.id, p.transfermarktId]));
  if (
    canonicos.size !== lote.players.length ||
    new Set(lote.players.map((p) => p.transfermarktId)).size !==
      lote.players.length
  )
    throw new Error("Identidade canônica duplicada.");
  const ids = [...canonicos.keys()];
  const nomesProvider = Object.keys(r.providers);
  if (
    nomesProvider.length !== Object.keys(r.diagnostics).length ||
    nomesProvider.some((nome) => !Object.hasOwn(r.diagnostics, nome)) ||
    Object.keys(r.diagnostics).some((nome) => !Object.hasOwn(r.providers, nome))
  )
    throw new Error(
      "Contrato ratings: providers e diagnostics devem declarar os mesmos nomes.",
    );
  for (const nome of nomesProvider) {
    const diag = r.diagnostics[nome]!;
    const chaves = Object.keys(diag);
    if (
      chaves.length !== ids.length ||
      new Set(chaves).size !== ids.length ||
      ids.some((id) => !Object.hasOwn(diag, id))
    )
      throw new Error(
        `Contrato ratings: ${nome} precisa de exatamente um diagnostic por jogador canônico.`,
      );
  }
  const vistos = new Set<string>();
  const usados = new Set<string>();
  for (const p of r.players) {
    if (canonicos.get(p.id) !== p.transfermarktId || vistos.has(p.id))
      throw new Error("Contrato ratings: jogador estranho ou duplicado.");
    vistos.add(p.id);
    const fontes = new Set<string>();
    for (const s of p.sources) {
      // Node é segunda barreira: só exact/high entram no snapshot.
      if (!["exact", "high"].includes(s.confidence))
        throw new Error(
          "Contrato ratings: source só pode ser exact ou high.",
        );
      const chave = `${s.provider}:${s.externalPlayerId}`;
      if (
        !Object.hasOwn(r.providers, s.provider) ||
        fontes.has(s.provider) ||
        usados.has(chave)
      )
        throw new Error(
          "Contrato ratings: provider duplicado ou colisão de external ID.",
        );
      const d = r.diagnostics[s.provider]?.[p.id];
      if (!d || d.collision || d.confidence !== s.confidence)
        throw new Error("Contrato ratings: diagnóstico incompatível.");
      fontes.add(s.provider);
      usados.add(chave);
    }
  }
  return r;
}
