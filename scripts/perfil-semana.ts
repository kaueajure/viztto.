/**
 * Profiling one-shot: carreira realista com todas as ligas.
 * Roda: node --import tsx scripts/perfil-semana.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { LIGAS_SUPORTADAS } from "../src/dominio/constantes/ligas";
import { criarCarreira } from "../src/aplicacao/casos-de-uso/criar-carreira";
import {
  prepararSemana,
  simularRodadaCompleta,
  finalizarSemana,
} from "../src/aplicacao/casos-de-uso/fases-semana";
import { serializarCarreira } from "../src/infraestrutura/persistencia/carreira-persistida";
import { sortearHistoria } from "../src/dominio/historia-formacao";

const SNAPSHOT: Record<string, string> = {
  brasileirao: "brasileirao.json",
  "brasileirao-b": "brasileirao-b.json",
  "premier-league": "premier-league.json",
  championship: "championship.json",
  "la-liga": "la-liga.json",
  "la-liga-2": "la-liga-2.json",
  "serie-a": "serie-a.json",
  "serie-b": "serie-b.json",
  bundesliga: "bundesliga.json",
  "bundesliga-2": "bundesliga-2.json",
  "ligue-1": "ligue-1.json",
  "ligue-2": "ligue-2.json",
};

function ms(a: number, b: number) {
  return Math.round((b - a) * 100) / 100;
}

function carregar() {
  const packs = LIGAS_SUPORTADAS.map((l) => {
    const arq = SNAPSHOT[l.id];
    if (!arq) return null;
    const dados = JSON.parse(
      readFileSync(join(process.cwd(), "src/dados/futebol", arq), "utf8"),
    );
    return { liga: l, clubes: dados.clubes, inicio: dados.inicio as string };
  }).filter(Boolean) as {
    liga: (typeof LIGAS_SUPORTADAS)[number];
    clubes: unknown[];
    inicio: string;
  }[];

  const principal = packs.find((p) => p.liga.id === "brasileirao")!;
  const outras = packs.filter((p) => p !== principal);
  const seed = "perfil-semana-realista-v1";
  const posicao = "MEI" as const;
  const historia = Object.fromEntries(
    Object.entries(sortearHistoria(seed, posicao)).map(([k, v]) => [k, v[0]!.id]),
  ) as Record<"origem" | "destaque" | "dificuldade" | "chegada", string>;

  const t0 = performance.now();
  const carreira = criarCarreira({
    identidade: {
      nome: "Perfil",
      sobrenome: "Bench",
      nacionalidade: "Brasil",
      idade: 18,
      posicao,
      posicaoSecundaria: "MC",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "criador",
    },
    liga: principal.liga,
    clubes: principal.clubes as never,
    clubeId: (principal.clubes[0] as { id: string }).id,
    origem: "api",
    seed,
    dataInicio: principal.inicio,
    historia,
    ligasMundo: outras.map((o) => o.liga),
    clubesMundo: outras.flatMap((o) => o.clubes) as never,
  });
  carreira.jogador.categoria = "profissional";
  carreira.jogador.status = "titular";
  const t1 = performance.now();

  const clubes = carreira.clubes.length;
  const jogadores = carreira.clubes.reduce((n, c) => n + c.elenco.length, 0);
  const ligas = carreira.ligas.length;
  console.log(
    `carreira criada em ${ms(t0, t1)} ms · ligas=${ligas} clubes=${clubes} jogadores=${jogadores}`,
  );
  return carreira;
}

async function main() {
  const carreira = carregar();

  // --- structuredClone isolado vs seletivo ---
  const c0 = performance.now();
  const clone = structuredClone(carreira);
  const c1 = performance.now();
  void clone;

  const cs0 = performance.now();
  const { clonarCarreiraParaAvanco } = await import(
    "../src/simulacao/carreira/clonar-avanco"
  );
  const cloneSel = clonarCarreiraParaAvanco(carreira);
  const cs1 = performance.now();
  void cloneSel;

  // --- prepararSemana (≈ abrir Matchday) ---
  const p0 = performance.now();
  const ctx = prepararSemana(carreira);
  const p1 = performance.now();

  // --- simularRodadaCompleta ---
  const s0 = performance.now();
  simularRodadaCompleta(ctx);
  const s1 = performance.now();

  // --- finalizarSemana ---
  const f0 = performance.now();
  const fim = finalizarSemana(ctx);
  const f1 = performance.now();

  // --- serializar ---
  const z0 = performance.now();
  const persistido = serializarCarreira(fim);
  const z1 = performance.now();

  const j0 = performance.now();
  const json = JSON.stringify(persistido);
  const j1 = performance.now();

  console.log("\n=== DIAGNÓSTICO (ms) ===");
  console.log(`structuredClone(estado):     ${ms(c0, c1)}`);
  console.log(`clonarCarreiraParaAvanco:    ${ms(cs0, cs1)}`);
  console.log(`prepararSemana (Matchday):   ${ms(p0, p1)}`);
  console.log(`simularRodadaCompleta:       ${ms(s0, s1)}`);
  console.log(`finalizarSemana (total):     ${ms(f0, f1)}`);
  console.log(`serializarCarreira:          ${ms(z0, z1)}`);
  console.log(`JSON.stringify:              ${ms(j0, j1)} · ${(json.length / 1e6).toFixed(2)} MB`);
  console.log(
    `TOTAL simular semana:         ${ms(p0, f1)} (prep+sim+fim)`,
  );
  console.log(
    `TOTAL + serialização:         ${ms(p0, z1)}`,
  );
  console.log(
    `TOTAL + JSON:                 ${ms(p0, j1)}`,
  );

  // Segunda semana para warm cache / steady state
  const w0 = performance.now();
  const ctx2 = prepararSemana(fim);
  simularRodadaCompleta(ctx2);
  const fim2 = finalizarSemana(ctx2);
  const w1 = performance.now();
  const z2 = performance.now();
  serializarCarreira(fim2);
  const z3 = performance.now();
  console.log(`\n2ª semana (prep+sim+fim):    ${ms(w0, w1)}`);
  console.log(`2ª serializar:               ${ms(z2, z3)}`);

  // Breakdown via monkey-patch style re-run with internal marks
  // Instrumentação fina: importar módulos e cronometrar partes conhecidas
  await breakdownFino(fim2);
}

async function breakdownFino(
  carreiraBase: import("../src/dominio/entidades/modelos").EstadoCarreira,
) {
  const { avancarLigasExternas } = await import(
    "../src/simulacao/mundo/avancar-ligas"
  );
  const { GeradorAleatorio } = await import("../src/utilitarios/aleatorio");
  const { calcularClassificacao } = await import(
    "../src/simulacao/temporada/classificacao"
  );
  const { avaliarMercado } = await import(
    "../src/simulacao/transferencias/mercado"
  );
  const { gerarCenasSemana } = await import(
    "../src/simulacao/cenas/motor-cenas"
  );
  const { gerarDecisoesSemana } = await import(
    "../src/simulacao/decisoes/decisoes"
  );

  console.log("\n=== BREAKDOWN FINO (pós 2ª semana, clone fresco) ===");
  const estado = structuredClone(carreiraBase);

  // Medir só avancarLigasExternas isolado no fim de um preparar+simular
  const ctx = prepararSemana(estado);
  simularRodadaCompleta(ctx);

  const a0 = performance.now();
  // Clone aleatorio state for fair measure — call on copy of ctx carreira mid-finalize
  const car = structuredClone(ctx.carreira);
  const aleatorio = new GeradorAleatorio(ctx.aleatorio.estado);
  avancarLigasExternas(car, aleatorio);
  const a1 = performance.now();
  console.log(`avancarLigasExternas:        ${ms(a0, a1)}`);

  // Contar partidas externas desta rodada
  let partidasExt = 0;
  for (const [id, t] of Object.entries(car.temporadasExternas)) {
    if (id === car.liga.id) continue;
    partidasExt += t.partidas.filter((p) => p.rodada === t.rodadaAtual).length;
    partidasExt += t.partidasBase.filter((p) => p.rodada === t.rodadaAtual).length;
  }
  console.log(`  partidas externas rodada:  ${partidasExt}`);
  console.log(
    `  clubes fora da liga:       ${car.clubes.filter((c) => c.ligaId !== car.liga.id).length}`,
  );

  const clubesLiga = car.clubes.filter((c) => c.ligaId === car.liga.id);
  const cl0 = performance.now();
  calcularClassificacao(
    clubesLiga.map((c) => c.id),
    car.temporada.partidas,
    car.liga.regras.pontosVitoria,
    car.liga.regras.pontosEmpate,
  );
  calcularClassificacao(
    clubesLiga.map((c) => c.id),
    car.temporada.partidasBase,
    car.liga.regras.pontosVitoria,
    car.liga.regras.pontosEmpate,
  );
  const cl1 = performance.now();
  console.log(`classificacao principal×2:   ${ms(cl0, cl1)}`);

  const m0 = performance.now();
  avaliarMercado(car, aleatorio);
  const m1 = performance.now();
  console.log(`avaliarMercado:              ${ms(m0, m1)}`);

  const d0 = performance.now();
  gerarDecisoesSemana(car, aleatorio);
  const d1 = performance.now();
  console.log(`gerarDecisoesSemana:         ${ms(d0, d1)}`);

  const ce0 = performance.now();
  try {
    gerarCenasSemana(car, carreiraBase, aleatorio);
  } catch {
    /* estado parcial no breakdown — ignora */
  }
  const ce1 = performance.now();
  console.log(`gerarCenasSemana:            ${ms(ce0, ce1)}`);

  // Medir prepararClubesRodada indiretamente: tempo prepararSemana - clone
  const sc0 = performance.now();
  structuredClone(carreiraBase);
  const sc1 = performance.now();
  const pr0 = performance.now();
  prepararSemana(carreiraBase);
  const pr1 = performance.now();
  console.log(`\nstructuredClone again:      ${ms(sc0, sc1)}`);
  console.log(`prepararSemana again:        ${ms(pr0, pr1)}`);
  console.log(
    `prepararSemana − clone ≈:    ${ms(pr0, pr1) - ms(sc0, sc1)} (resto: treino+escalação+evolução+briefing)`,
  );

  // Partidas principais da rodada
  const ctxP = prepararSemana(structuredClone(carreiraBase));
  const rodada = ctxP.rodada;
  const nProf = ctxP.carreira.temporada.partidas.filter(
    (p) => p.rodada === rodada && p.golsMandante === null,
  ).length;
  const nBase = ctxP.carreira.temporada.partidasBase.filter(
    (p) => p.rodada === rodada && p.golsMandante === null,
  ).length;
  const sm0 = performance.now();
  simularRodadaCompleta(ctxP);
  const sm1 = performance.now();
  console.log(`\npartidas prof rodada:        ${nProf}`);
  console.log(`partidas base rodada:        ${nBase}`);
  console.log(`simularRodadaCompleta:       ${ms(sm0, sm1)}`);
  if (nProf + nBase > 0) {
    console.log(
      `  média por partida:         ${ms(sm0, sm1) / (nProf + nBase)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
