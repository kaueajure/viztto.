/**
 * Benchmark do Rating Engine v2 — aplica engine + força do elenco sobre snapshots
 * canônicos e imprime hierarquia de clubes / calibração de jogadores.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/benchmark-ratings.ts
 *   npx tsx --conditions=react-server scripts/benchmark-ratings.ts --write
 *
 * --write persiste via a mesma pipeline de aplicarResultados (sem re-fetch TM).
 */
import { LIGAS_SUPORTADAS } from "../src/dominio/constantes/ligas";
import {
  lerDadosLiga,
  salvarDadosLiga,
} from "../src/infraestrutura/persistencia/importacao-futebol";
import {
  aplicarResultados,
  criarLoteCanonico,
  type LigaCanonica,
} from "../src/infraestrutura/ratings/lote";
import type { ResultadoBot } from "../src/infraestrutura/ratings/contrato";
import { ovrDeValorMercado } from "../src/dominio/regras/rating-mercado";

function fmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `€${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

function mediaTitulares(clube: {
  elenco: { id: string; overall?: number }[];
  goleiroTitularId: string | null;
  titularesIds: string[];
}): number {
  const ids = [
    ...(clube.goleiroTitularId ? [clube.goleiroTitularId] : []),
    ...clube.titularesIds,
  ];
  const porId = new Map(clube.elenco.map((j) => [j.id, j]));
  const ovrs = ids
    .map((id) => porId.get(id)?.overall)
    .filter((n): n is number => typeof n === "number");
  if (!ovrs.length) return 0;
  return ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
}

function resultadoEnginePuro(universo: LigaCanonica[]): ResultadoBot {
  const lote = criarLoteCanonico(universo);
  return {
    version: 1,
    batchId: lote.batchId,
    players: lote.players.map((p) => ({
      id: p.id,
      transfermarktId: p.transfermarktId,
      sources: [],
    })),
    providers: {},
    diagnostics: {},
  };
}

const escrever = process.argv.includes("--write");

const universo: LigaCanonica[] = [];
for (const liga of LIGAS_SUPORTADAS) {
  const dados = await lerDadosLiga(liga.id);
  if (dados) universo.push({ liga, clubes: dados.clubes });
}
if (!universo.length) throw new Error("Nenhum snapshot em src/dados/futebol.");

const enriquecido = aplicarResultados(universo, resultadoEnginePuro(universo));

if (escrever) {
  for (const { liga, clubes } of enriquecido) {
    const dados = await lerDadosLiga(liga.id);
    if (!dados) continue;
    dados.clubes = clubes;
    dados.atualizadoEm = new Date().toISOString();
    await salvarDadosLiga(dados);
    console.log(`Escrito: ${liga.id}`);
  }
}

type LinhaClube = {
  liga: string;
  nome: string;
  valor: number;
  mediaTit: number;
  geral: number;
  ataque: number;
  meio: number;
  defesa: number;
  reputacao: number;
};

const clubes: LinhaClube[] = [];
for (const { liga, clubes: cs } of enriquecido) {
  for (const c of cs) {
    clubes.push({
      liga: liga.id,
      nome: c.nome,
      valor: c.valorElenco ?? 0,
      mediaTit: mediaTitulares(c),
      geral: c.forcaGeral,
      ataque: c.forcaAtaque,
      meio: c.forcaMeio,
      defesa: c.forcaDefesa,
      reputacao: c.reputacao,
    });
  }
}
clubes.sort((a, b) => b.geral - a.geral || b.valor - a.valor);

console.log("\n=== RANKING DE CLUBES (engine v2) ===\n");
console.log(
  "CLUBE".padEnd(36),
  "VALOR".padStart(10),
  "MÉD.TIT".padStart(8),
  "FORÇA".padStart(7),
  "ATA".padStart(5),
  "MEI".padStart(5),
  "DEF".padStart(5),
  "REP".padStart(5),
  "LIGA",
);
for (const c of clubes) {
  console.log(
    c.nome.slice(0, 36).padEnd(36),
    fmtEur(c.valor).padStart(10),
    c.mediaTit.toFixed(1).padStart(8),
    String(c.geral).padStart(7),
    String(c.ataque).padStart(5),
    String(c.meio).padStart(5),
    String(c.defesa).padStart(5),
    String(c.reputacao).padStart(5),
    c.liga,
  );
}

function achar(nomeParte: string) {
  const n = nomeParte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return clubes.find((c) =>
    c.nome
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .includes(n),
  );
}

console.log("\n=== EXEMPLOS PEDIDOS ===\n");
for (const nome of [
  "Real Madrid",
  "Vitória",
  "Palmeiras",
  "Ceará",
  "Brighton",
]) {
  const c = achar(nome);
  if (!c) {
    console.log(`${nome}: não encontrado`);
    continue;
  }
  console.log(
    `${c.nome} | valor ${fmtEur(c.valor)} | tit ${c.mediaTit.toFixed(1)} | força ${c.geral} (A${c.ataque}/M${c.meio}/D${c.defesa}) | rep ${c.reputacao} | ${c.liga}`,
  );
}

type Jog = {
  nome: string;
  idade: number;
  pos: string;
  valor: number;
  ovr: number;
  pot: number;
  clube: string;
};
const jogadores: Jog[] = [];
for (const { clubes: cs } of enriquecido) {
  for (const c of cs) {
    for (const bruto of c.elenco) {
      const j = bruto as {
        nome: string;
        idade?: number | null;
        posicao?: string;
        posicaoPrincipal?: string;
        valorMercado?: number | null;
        overall?: number;
        potencial?: number;
      };
      if (typeof j.overall !== "number") continue;
      jogadores.push({
        nome: j.nome,
        idade: j.idade ?? 0,
        pos: j.posicaoPrincipal ?? j.posicao ?? "?",
        valor: j.valorMercado ?? 0,
        ovr: j.overall,
        pot: j.potencial ?? j.overall,
        clube: c.nome,
      });
    }
  }
}
jogadores.sort((a, b) => b.valor - a.valor);

console.log("\n=== 10 JOGADORES (níveis diferentes) ===\n");
console.log(
  "NOME".padEnd(28),
  "IDADE".padStart(5),
  "POS".padStart(4),
  "VALOR".padStart(10),
  "OVR".padStart(4),
  "POT".padStart(4),
  "CLUBE",
);
const amostras: Jog[] = [];
const faixas = [
  (j: Jog) => j.valor >= 100_000_000,
  (j: Jog) => j.valor >= 40_000_000 && j.valor < 100_000_000,
  (j: Jog) => j.valor >= 10_000_000 && j.valor < 40_000_000,
  (j: Jog) => j.valor >= 2_000_000 && j.valor < 10_000_000,
  (j: Jog) => j.valor >= 500_000 && j.valor < 2_000_000,
  (j: Jog) => j.valor < 500_000 && j.valor > 0,
];
for (const pred of faixas) {
  const pool = jogadores.filter(pred);
  if (pool[0]) amostras.push(pool[0]!);
  if (pool[Math.floor(pool.length / 3)])
    amostras.push(pool[Math.floor(pool.length / 3)]!);
}
const unicos = [...new Map(amostras.map((j) => [j.nome, j])).values()].slice(
  0,
  10,
);
for (const j of unicos) {
  console.log(
    j.nome.slice(0, 28).padEnd(28),
    String(j.idade).padStart(5),
    j.pos.slice(0, 4).padStart(4),
    fmtEur(j.valor).padStart(10),
    String(j.ovr).padStart(4),
    String(j.pot).padStart(4),
    j.clube.slice(0, 24),
  );
}

console.log("\n=== SANITY CHECKS ===\n");
const bilhao = clubes.filter((c) => c.valor >= 1_000_000_000);
const baratos = clubes.filter((c) => c.valor > 0 && c.valor <= 40_000_000);
let falhas = 0;
for (const rico of bilhao) {
  for (const barato of baratos) {
    if (rico.geral + 2 < barato.geral) {
      console.log(
        `⚠ elenco €1B+ (${rico.nome} ${rico.geral}) abaixo de €40M (${barato.nome} ${barato.geral})`,
      );
      falhas++;
    }
  }
}
const elite = jogadores.filter((j) => j.valor >= 100_000_000);
const baratosJ = jogadores.filter(
  (j) => j.valor >= 800_000 && j.valor <= 1_200_000,
);
const eliteBaixo = elite.filter((j) => j.ovr < 84);
const milhaoAlto = baratosJ.filter((j) => j.ovr >= 85);
if (eliteBaixo.length)
  console.log(
    `⚠ ${eliteBaixo.length} jogadores €100m+ com OVR < 84 (ex.: ${eliteBaixo[0]?.nome} ${eliteBaixo[0]?.ovr})`,
  );
else console.log("✓ jogadores €100m+ em faixa alta");
if (milhaoAlto.length) {
  console.log(
    `⚠ ${milhaoAlto.length} jogadores ~€1m com OVR 85+ (ex.: ${milhaoAlto[0]?.nome})`,
  );
  falhas++;
} else console.log("✓ jogadores ~€1m sem OVR elite artificial");

const jovensCaros = jogadores.filter(
  (j) => j.idade <= 20 && j.valor >= 40_000_000,
);
const jovemOk = jovensCaros.every((j) => j.pot >= j.ovr + 5);
console.log(
  jovemOk
    ? `✓ jovens caros (${jovensCaros.length}) com potencial acima do OVR`
    : `⚠ jovens caros sem margem de potencial`,
);

const veteranos = jogadores.filter((j) => j.idade >= 33 && j.valor >= 5_000_000);
const vetOk = veteranos.every(
  (j) => j.ovr >= ovrDeValorMercado(j.valor) - 2,
);
console.log(
  vetOk
    ? `✓ veteranos valiosos (${veteranos.length}) não despencam só por idade de mercado`
    : `⚠ veteranos com OVR artificialmente baixo`,
);

const rm = achar("Real Madrid");
const vit = achar("Vitória");
if (rm && vit) {
  if (rm.geral > vit.geral + 5)
    console.log(
      `✓ Real Madrid (${rm.geral}) bem acima do Vitória (${vit.geral})`,
    );
  else {
    console.log(
      `⚠ hierarquia Real (${rm.geral}) vs Vitória (${vit.geral}) suspeita`,
    );
    falhas++;
  }
}

console.log(
  falhas
    ? `\nSanity: ${falhas} alerta(s)`
    : "\nSanity: hierarquia e calibração ok",
);
console.log(
  escrever
    ? "Snapshots atualizados via aplicarResultados."
    : "Dry-run (passe --write para persistir).",
);
