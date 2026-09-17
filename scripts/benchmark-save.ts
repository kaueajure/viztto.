/**
 * Benchmark realista do tamanho/tempo do save com ~13 ligas.
 * Não altera snapshots oficiais.
 *
 * Uso: npm run benchmark:save
 */
import { LIGAS_SUPORTADAS } from "../src/dominio/constantes/ligas";
import { criarAtributosUniformes } from "../src/dominio/regras/jogador";
import { NOMES_ATRIBUTOS } from "../src/dominio/entidades/modelos";
import {
  hidratarCarreira,
  serializarCarreira,
} from "../src/infraestrutura/persistencia/carreira-persistida";
import { exemploCarreira } from "../testes/auxiliar-carreira-persistida";

function medir(fn: () => unknown): { ms: number; result: unknown } {
  const t0 = performance.now();
  const result = fn();
  return { ms: performance.now() - t0, result };
}

function deltaNpc(comAttrs: boolean, i: number) {
  return {
    id: `npc-${i}`,
    clubeId: `c-${i % 100}`,
    idade: 24,
    overall: 70,
    potencial: 78,
    ...(comAttrs
      ? {
          atributos: criarAtributosUniformes(65),
          ratingMetadata: {
            source: "sportmonks",
            confidence: "high",
            minutes: 2000,
            appearances: 28,
            season: "2026",
            sportmonksPlayerId: 10_000 + i,
            matchConfidence: "exact",
            estimatedAttributes: ["velocidade", "forca"],
            coverageLevel: "A",
          },
        }
      : {}),
    forma: 70,
    moral: 70,
    condicionamento: 70,
    fadiga: 20,
    valorMercado: 1_000_000,
    salario: 10_000,
    contratoAte: "2028-06-30",
    lesionado: false,
    lesao: null,
    suspensao: 0,
    statusElenco: "titular",
    estatisticasCarreira: {
      jogos: 0,
      titularidades: 0,
      minutos: 0,
      gols: 0,
      assistencias: 0,
      amarelos: 0,
      vermelhos: 0,
      somaNotas: 0,
    },
  };
}

function main() {
  const totalClubes = LIGAS_SUPORTADAS.reduce(
    (s, l) => s + l.quantidadeClubes,
    0,
  );
  const npcsPorClube = 28;
  const npcs = totalClubes * npcsPorClube;

  // Payload no formato do save (só deltas de elenco) — mede volume real dos attrs.
  const elencoSem = Array.from({ length: npcs }, (_, i) => deltaNpc(false, i));
  const elencoCom = Array.from({ length: npcs }, (_, i) => deltaNpc(true, i));
  const saveSem = {
    versao: 4,
    clubesDinamicos: [{ id: "x", elenco: elencoSem }],
  };
  const saveCom = {
    versao: 4,
    clubesDinamicos: [{ id: "x", elenco: elencoCom }],
  };

  const strSem = medir(() => JSON.stringify(saveSem));
  const strCom = medir(() => JSON.stringify(saveCom));
  const bytesSem = Buffer.byteLength(strSem.result as string);
  const bytesCom = Buffer.byteLength(strCom.result as string);

  // Round-trip real em fixture (timing de serialize/hydrate do pipeline oficial).
  const { carreira, catalogo } = exemploCarreira();
  for (const c of carreira.clubes)
    for (const j of c.elenco) {
      j.atributos = criarAtributosUniformes(66);
      j.ratingMetadata = {
        source: "sportmonks",
        confidence: "high",
        minutes: 1800,
        appearances: 25,
        season: "2026",
        sportmonksPlayerId: 1,
        matchConfidence: "exact",
        estimatedAttributes: ["velocidade"],
        coverageLevel: "A",
      };
    }
  const ser = medir(() => serializarCarreira(carreira));
  const persistido = ser.result as ReturnType<typeof serializarCarreira>;
  const stringifyRt = medir(() => JSON.stringify(persistido));
  const parseRt = medir(() => JSON.parse(stringifyRt.result as string));
  const hyd = medir(() => hidratarCarreira(parseRt.result, catalogo));

  const delta = bytesCom - bytesSem;
  const pct = ((delta / bytesSem) * 100).toFixed(1);
  const rel = {
    ligas: LIGAS_SUPORTADAS.length,
    clubes: totalClubes,
    npcs,
    attrsPorNpc: Object.keys(NOMES_ATRIBUTOS).length,
    saveSemAttrsMB: +(bytesSem / (1024 * 1024)).toFixed(3),
    saveComAttrsMB: +(bytesCom / (1024 * 1024)).toFixed(3),
    aumentoPct: +pct,
    deltaBytes: delta,
    stringifySemMs: +strSem.ms.toFixed(1),
    stringifyComMs: +strCom.ms.toFixed(1),
    // Pipeline real (fixture menor, mas mesmo código de produção)
    serializeFixtureMs: +ser.ms.toFixed(1),
    stringifyFixtureMs: +stringifyRt.ms.toFixed(1),
    parseFixtureMs: +parseRt.ms.toFixed(1),
    hydrateFixtureMs: +hyd.ms.toFixed(1),
    limiteMiB: 16,
    dentroDoLimite: bytesCom < 16 * 1024 * 1024,
  };

  console.log("\n════════════════════════════════════════");
  console.log("BENCHMARK SAVE REALISTA (13 ligas × 28 jogadores)");
  console.log("════════════════════════════════════════");
  console.log(`NPCs: ${rel.npcs} · Clubes: ${rel.clubes} · Ligas: ${rel.ligas}`);
  console.log(`Atributos/NPC: ${rel.attrsPorNpc}`);
  console.log(`Save sem attrs: ${rel.saveSemAttrsMB} MB`);
  console.log(`Save com attrs: ${rel.saveComAttrsMB} MB`);
  console.log(`Aumento: +${rel.aumentoPct}%`);
  console.log(`Stringify sem: ${rel.stringifySemMs} ms`);
  console.log(`Stringify com: ${rel.stringifyComMs} ms`);
  console.log(`Serialize fixture: ${rel.serializeFixtureMs} ms`);
  console.log(`Hydrate fixture: ${rel.hydrateFixtureMs} ms`);
  console.log(`Limite 16 MiB: ${rel.dentroDoLimite ? "OK" : "EXCEDIDO"}`);
  console.log("════════════════════════════════════════\n");
  console.log(JSON.stringify(rel, null, 2));
}

main();
