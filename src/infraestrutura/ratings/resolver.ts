import type { Atributo } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { calcularOverall } from "@/dominio/regras/jogador";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
import { limitar } from "@/utilitarios/formatacao";
import {
  calcularRatingViztto,
  type EntradaRatingEngine,
  type ResultadoRating,
} from "./rating-engine";
import type { RatingExterno } from "./contrato";

const media = (v: number[]) => v.reduce((s, n) => s + n, 0) / v.length;
const atributos = Object.keys(NOMES_ATRIBUTOS) as Atributo[];

/** Determinístico: fontes ordenadas, somente EXACT/HIGH, fallback universal.
 * Fontes da mesma `family` (ex.: ea_fc) contam como um único voto. */
export function resolverRating(
  entrada: EntradaRatingEngine,
  fontes: RatingExterno[],
): ResultadoRating {
  const engine = calcularRatingViztto(entrada);
  const seguras = fontes
    .filter((s) => ["exact", "high"].includes(s.confidence))
    .sort((a, b) => a.provider.localeCompare(b.provider));
  if (!seguras.length) return engine;
  const porFamilia = new Map<string, RatingExterno[]>();
  for (const s of seguras) {
    const fam = s.family?.trim() || `provider:${s.provider}`;
    const lista = porFamilia.get(fam) ?? [];
    lista.push(s);
    porFamilia.set(fam, lista);
  }
  const evidencias: RatingExterno[] = [];
  for (const [, grupo] of [...porFamilia.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ordenado = [...grupo].sort((a, b) =>
      a.provider.localeCompare(b.provider),
    );
    // Preferência estável: primeiro provider lexicográfico do grupo, salvo
    // ea-official quando presente na família ea_fc.
    const preferido =
      ordenado.find((s) => s.provider === "ea-official") ?? ordenado[0]!;
    evidencias.push(preferido);
  }
  const valores = evidencias.map((s) => s.ratingNormalizado);
  const divergente = Math.max(...valores) - Math.min(...valores) > 10;
  const externo = media(valores);
  const foraPrior = Math.abs(externo - engine.overall) > 18;
  const alvo = limitar(
    Math.round(
      divergente || foraPrior ? (externo + engine.overall) / 2 : externo,
    ),
    1,
    99,
  );
  const attrs = { ...engine.atributos };
  const estimados: Atributo[] = [];
  for (const atributo of atributos) {
    const observados = evidencias.flatMap((s) =>
      s.attributes[atributo] === undefined ? [] : [s.attributes[atributo]],
    );
    if (observados.length) attrs[atributo] = Math.round(media(observados));
    else {
      estimados.push(atributo);
      attrs[atributo] = limitar(
        Math.round((attrs[atributo] * alvo) / engine.overall),
        1,
        99,
      );
    }
  }
  // O jogo deriva OVR dos atributos. Ajusta só os estimados; nunca distorce observações.
  const posicao = mapearPosicaoPrincipal(entrada.posicaoBruta);
  for (let i = 0; i < 99; i++) {
    const atual = calcularOverall(attrs, posicao);
    if (Math.abs(atual - alvo) <= 1 || !estimados.length) break;
    for (const a of estimados)
      attrs[a] = limitar(attrs[a] + Math.sign(alvo - atual), 1, 99);
  }
  const overall = calcularOverall(attrs, posicao);
  const potenciais = evidencias.flatMap((s) =>
    s.potentialNormalizado === undefined ? [] : [s.potentialNormalizado],
  );
  const estimativa = Math.max(
    overall,
    engine.potencial + overall - engine.overall,
  );
  const potencial =
    entrada.idade >= 32
      ? overall
      : Math.round(
          limitar(
            potenciais.length
              ? estimativa * 0.7 + media(potenciais) * 0.3
              : estimativa,
            overall,
            99,
          ),
        );
  return {
    atributos: attrs,
    overall,
    potencial,
    metadata: {
      source: evidencias.length > 1 ? "multi-source" : "external",
      confidence:
        divergente || foraPrior || Math.abs(overall - alvo) > 5
          ? "medium"
          : "high",
      sources: evidencias.map(
        ({ attributes: _attrs, potentialNormalizado: _pot, ...meta }) => meta,
      ),
      estimatedAttributes: estimados,
      calibrationVersion: "resolver-v2/engine-v1",
    },
  };
}
