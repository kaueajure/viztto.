/**
 * Diagnóstico em memória: todos os NPCs atravessam o pipeline real.
 * Não lê nem altera snapshots oficiais. Tempos de uma execução, sem otimização.
 */
import { LIGAS_SUPORTADAS } from "../src/dominio/constantes/ligas";
import { criarAtributosUniformes } from "../src/dominio/regras/jogador";
import { gerarClubesDemonstracao } from "../src/dados/demonstracao";
import { criarCarreira } from "../src/aplicacao/casos-de-uso/criar-carreira";
import {
  hidratarCarreira,
  serializarCarreira,
} from "../src/infraestrutura/persistencia/carreira-persistida";

function medir<T>(fn: () => T) {
  const inicio = performance.now();
  const resultado = fn();
  return { ms: +(performance.now() - inicio).toFixed(2), resultado };
}
const heapInicio = process.memoryUsage().heapUsed;
const ligas = LIGAS_SUPORTADAS;
const clubes = ligas.flatMap((liga) => {
  const modelos = gerarClubesDemonstracao(liga);
  return Array.from({ length: liga.quantidadeClubes }, (_, i) => {
    const clube = structuredClone(modelos[i % modelos.length]);
    clube.id = `${liga.id}-benchmark-${i}`;
    clube.idTransfermarkt = clube.id;
    clube.nome = `Clube ${liga.id} ${i}`;
    clube.elenco = Array.from({ length: 28 }, (_, j) => ({
      ...structuredClone(clube.elenco[j % clube.elenco.length]),
      id: `${clube.id}-j${j}`,
      idTransfermarkt: `${clube.id}-j${j}`,
      clubeId: clube.id,
      overall: 66,
      potencial: 78,
      atributos: criarAtributosUniformes(66),
      ratingMetadata: {
        source: "external" as const,
        confidence: "high" as const,
        minutes: 1800,
        appearances: 25,
        season: "2026",
        sources: [
          { provider: "benchmark", externalPlayerId: String(i * 28 + j + 1) },
        ],
        matchConfidence: "exact",
        estimatedAttributes: ["velocidade"],
      },
    }));
    clube.tamanhoElenco = 28;
    clube.titularesIds = [];
    clube.bancoIds = [];
    clube.goleiroTitularId = null;
    return clube;
  });
});
const carreira = criarCarreira({
  identidade: {
    nome: "Ana",
    sobrenome: "Benchmark",
    nacionalidade: "Brasil",
    idade: 22,
    posicao: "PD",
    posicaoSecundaria: "",
    peDominante: "direito",
    altura: 170,
    peso: 62,
    arquetipo: "criador",
  },
  origem: "api",
  seed: "benchmark-13-ligas",
  dataInicio: "2026-06-01",
  liga: ligas[0],
  clubes: clubes.filter((c) => c.ligaId === ligas[0].id),
  clubeId: clubes[0].id,
  ligasMundo: ligas.slice(1),
  clubesMundo: clubes.filter((c) => c.ligaId !== ligas[0].id),
});
// Classificações completas; calendário limitado para isolar o custo de milhares de NPCs.
carreira.temporada.partidas = [];
for (const temporada of Object.values(carreira.temporadasExternas))
  temporada.partidas = [];
const serialize = medir(() => serializarCarreira(carreira));
const stringify = medir(() => JSON.stringify(serialize.resultado));
const parse = medir(() => JSON.parse(stringify.resultado));
const hydrate = medir(() =>
  hidratarCarreira(parse.resultado, { ligas, clubes }),
);
const npcs = carreira.clubes.reduce((s, c) => s + c.elenco.length, 0);
if (hydrate.resultado.clubes.reduce((s, c) => s + c.elenco.length, 0) !== npcs)
  throw new Error("Round-trip perdeu NPCs");
console.log(
  JSON.stringify(
    {
      ligas: carreira.ligas.length,
      clubes: carreira.clubes.length,
      npcs,
      temporadasExternas: Object.keys(carreira.temporadasExternas).length,
      saveMiB: +(Buffer.byteLength(stringify.resultado) / 1024 ** 2).toFixed(3),
      serializeMs: serialize.ms,
      stringifyMs: stringify.ms,
      parseMs: parse.ms,
      hydrateMs: hydrate.ms,
      heapDeltaMiB: +(
        (process.memoryUsage().heapUsed - heapInicio) /
        1024 ** 2
      ).toFixed(2),
      rssMiB: +(process.memoryUsage().rss / 1024 ** 2).toFixed(2),
    },
    null,
    2,
  ),
);
