/**
 * Benchmark de desenvolvimento — seed fixa.
 * Uso: npm run benchmark:desenvolvimento
 *
 * Foco principal: 1 temporada (≈45 semanas) com metas de ganho de OVR.
 */
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import type { Atributo, EstadoCarreira, Posicao } from "@/dominio/entidades/modelos";
import { calcularOverall, PESOS_POSICOES } from "@/dominio/regras/jogador";
import { exerciciosRecomendados } from "@/dominio/treinamento/exercicios";
import { aplicarSessaoTreino } from "@/simulacao/treinamento/aplicar-sessao";
import { processarTreinamento } from "@/simulacao/treinamento/treinamento";
import { calcularEvolucao } from "@/simulacao/evolucao/evolucao";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { somarDias } from "@/utilitarios/formatacao";

export type CenarioBenchmark = {
  id: string;
  label: string;
  sessoesPorSemana: number;
  scoreMedio: number;
  minutosPorSemana: number;
  potencial: number;
  idadeInicial: number;
  /** Overall alvo no início (~55–60 base, 70+/80+/85+ pro). */
  ovrAlvo: number;
  categoria: "base" | "profissional";
  /** Semanas a simular (45 ≈ 1 temporada). */
  semanas: number;
  /** Anos extras após a 1ª temporada (para visão de longo prazo). */
  anosExtras?: number;
};

/** Cenários de 1 temporada — meta de balanceamento. */
export const CENARIOS_TEMPORADA: CenarioBenchmark[] = [
  {
    id: "base-pouco",
    label: "Base / pouco treino",
    sessoesPorSemana: 1,
    scoreMedio: 52,
    minutosPorSemana: 20,
    potencial: 82,
    idadeInicial: 16,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
  },
  {
    id: "base-normal",
    label: "Base / treino normal",
    sessoesPorSemana: 2,
    scoreMedio: 76,
    minutosPorSemana: 45,
    potencial: 84,
    idadeInicial: 16,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
  },
  {
    id: "base-forte",
    label: "Base / treino forte",
    sessoesPorSemana: 3,
    scoreMedio: 90,
    minutosPorSemana: 70,
    potencial: 88,
    idadeInicial: 16,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
  },
  {
    id: "base-talento",
    label: "Base / talento alto",
    sessoesPorSemana: 3,
    scoreMedio: 94,
    minutosPorSemana: 85,
    potencial: 96,
    idadeInicial: 16,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
  },
  {
    id: "pro-70",
    label: "Pro OVR 70+",
    sessoesPorSemana: 2.5,
    scoreMedio: 82,
    minutosPorSemana: 70,
    potencial: 84,
    idadeInicial: 22,
    ovrAlvo: 72,
    categoria: "profissional",
    semanas: 45,
  },
  {
    id: "pro-jovem-67",
    label: "Pro jovem ~67",
    sessoesPorSemana: 2.5,
    scoreMedio: 80,
    minutosPorSemana: 65,
    potencial: 86,
    idadeInicial: 19,
    ovrAlvo: 67,
    categoria: "profissional",
    semanas: 45,
  },
  {
    id: "pro-jovem-67-2t",
    label: "Pro jovem 67 · 2 temp",
    sessoesPorSemana: 2.5,
    scoreMedio: 80,
    minutosPorSemana: 65,
    potencial: 86,
    idadeInicial: 19,
    ovrAlvo: 67,
    categoria: "profissional",
    semanas: 90,
  },
  {
    id: "pro-80",
    label: "Pro OVR 80+",
    sessoesPorSemana: 2.5,
    scoreMedio: 85,
    minutosPorSemana: 75,
    potencial: 88,
    idadeInicial: 25,
    ovrAlvo: 81,
    categoria: "profissional",
    semanas: 45,
  },
  {
    id: "elite-85",
    label: "Jogador 85+",
    sessoesPorSemana: 3,
    scoreMedio: 90,
    minutosPorSemana: 80,
    potencial: 92,
    idadeInicial: 26,
    ovrAlvo: 86,
    categoria: "profissional",
    semanas: 45,
  },
  {
    id: "veterano",
    label: "Veterano 32+",
    sessoesPorSemana: 2,
    scoreMedio: 80,
    minutosPorSemana: 50,
    potencial: 80,
    idadeInicial: 32,
    ovrAlvo: 76,
    categoria: "profissional",
    semanas: 45,
  },
];

/** Cenários longos (compat / visão 21 anos). */
export const CENARIOS_PADRAO: CenarioBenchmark[] = [
  {
    id: "ruim",
    label: "Pouco treino",
    sessoesPorSemana: 1,
    scoreMedio: 48,
    minutosPorSemana: 25,
    potencial: 76,
    idadeInicial: 15,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
    anosExtras: 9,
  },
  {
    id: "normal",
    label: "Carreira normal",
    sessoesPorSemana: 2,
    scoreMedio: 74,
    minutosPorSemana: 40,
    potencial: 82,
    idadeInicial: 15,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
    anosExtras: 9,
  },
  {
    id: "dedicado",
    label: "Dedicado",
    sessoesPorSemana: 3,
    scoreMedio: 90,
    minutosPorSemana: 75,
    potencial: 90,
    idadeInicial: 15,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
    anosExtras: 9,
  },
  {
    id: "talento",
    label: "Alto talento",
    sessoesPorSemana: 3,
    scoreMedio: 92,
    minutosPorSemana: 80,
    potencial: 94,
    idadeInicial: 15,
    ovrAlvo: 58,
    categoria: "base",
    semanas: 45,
    anosExtras: 9,
  },
  {
    id: "veterano28",
    label: "Veterano 28+",
    sessoesPorSemana: 2.5,
    scoreMedio: 85,
    minutosPorSemana: 60,
    potencial: 80,
    idadeInicial: 28,
    ovrAlvo: 74,
    categoria: "profissional",
    semanas: 45,
    anosExtras: 3,
  },
];

const POS: Posicao = "CA";

function ajustarOvrInicial(c: EstadoCarreira, ovrAlvo: number): void {
  const pesos = PESOS_POSICOES[POS];
  const attrs = Object.keys(c.jogador.atributos) as Atributo[];
  // Base uniforme + boost nos pesos da posição.
  for (const a of attrs) {
    c.jogador.atributos[a] = Math.max(40, ovrAlvo - 12);
  }
  for (const [a, w] of Object.entries(pesos) as [Atributo, number][]) {
    c.jogador.atributos[a] = Math.min(
      95,
      ovrAlvo + (w >= 5 ? 4 : w >= 3 ? 1 : -2),
    );
  }
  // Ajuste fino até ficar perto do OVR alvo.
  for (let i = 0; i < 40; i++) {
    c.jogador.overall = calcularOverall(c.jogador.atributos, POS);
    const diff = ovrAlvo - c.jogador.overall;
    if (Math.abs(diff) <= 1) break;
    const passo = diff > 0 ? 1 : -1;
    const chave = (Object.entries(pesos) as [Atributo, number][]).sort(
      (a, b) => b[1] - a[1],
    )[i % Object.keys(pesos).length]![0];
    c.jogador.atributos[chave] = Math.max(
      1,
      Math.min(99, c.jogador.atributos[chave] + passo),
    );
  }
  c.jogador.overall = calcularOverall(c.jogador.atributos, POS);
}

function montarCarreira(
  seed: string,
  cenario: CenarioBenchmark,
): EstadoCarreira {
  const liga = LIGAS_SUPORTADAS[0]!;
  const clubes = gerarClubesDemonstracao(liga).slice(0, 4);
  const c = criarCarreira({
    identidade: {
      nome: "Bench",
      sobrenome: "Mark",
      nacionalidade: "Brasil",
      idade: cenario.idadeInicial,
      posicao: POS,
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 180,
      peso: 74,
      arquetipo: "artilheiro",
    },
    liga,
    clubes,
    clubeId: clubes[0]!.id,
    origem: "demonstracao",
    seed,
    dataInicio: "2026-07-01",
  });

  ajustarOvrInicial(c, cenario.ovrAlvo);
  c.jogador.potencialInterno = Math.max(
    cenario.potencial,
    c.jogador.overall + 2,
  );
  c.jogador.idade = cenario.idadeInicial;
  c.jogador.categoria = cenario.categoria;
  // Personalidade/história estáveis no bench — evita seed distorcer o ganho.
  c.jogador.personalidade.profissionalismo =
    cenario.id.includes("talento") || cenario.id === "dedicado" ? 88 : 72;
  c.jogador.personalidade.ambicao = 70;
  c.jogador.personalidade.disciplina = 70;
  c.jogador.moral = 72;
  c.jogador.condicionamento = 88;
  c.jogador.fadiga = 15;
  c.jogador.perfilFormacao = { origem: "legado" };
  return c;
}

export type ResultadoBenchmark = {
  id: string;
  label: string;
  inicio: number;
  fimTemporada: number;
  ganhoTemporada: number;
  porIdade: Record<number, number>;
  pico: number;
  final: number;
  ovr15: number;
};

function rodarSemanas(
  c: EstadoCarreira,
  cenario: CenarioBenchmark,
  semanas: number,
  rng: GeradorAleatorio,
  seedTag: string,
  porIdade?: Record<number, number>,
): EstadoCarreira {
  const recomendados = exerciciosRecomendados(POS);
  const prioritarios = [
    "penaltis",
    "finalizacao-colocada",
    "finalizacao-primeira",
    "cabecalho",
  ];
  const exercicios = [
    ...prioritarios
      .map((id) => recomendados.find((e) => e.id === id))
      .filter(Boolean),
    ...recomendados.filter((e) => !prioritarios.includes(e.id)),
  ] as typeof recomendados;

  let carreira = c;
  for (let w = 0; w < semanas; w++) {
    const clube =
      carreira.clubes.find((x) => x.id === carreira.clubeAtualId) ?? null;
    const frac = cenario.sessoesPorSemana % 1;
    const nSessoes = Math.min(
      3,
      Math.floor(cenario.sessoesPorSemana) + (rng.proximo() < frac ? 1 : 0),
    );
    for (let s = 0; s < nSessoes; s++) {
      const ex = exercicios[s % exercicios.length]!;
      const score = Math.max(
        0,
        Math.min(100, cenario.scoreMedio + rng.inteiro(-6, 6)),
      );
      try {
        carreira = aplicarSessaoTreino(
          carreira,
          {
            exercicioId: ex.id,
            score,
            modo: "jogar",
            sessaoId: `${seedTag}-w${w}-s${s}`,
          },
          clube,
        ).carreira;
      } catch {
        break;
      }
    }

    if (cenario.minutosPorSemana > 0 && clube) {
      const attrs = Object.keys(PESOS_POSICOES[POS]) as Atributo[];
      const nota = 6 + (cenario.scoreMedio / 100) * 2;
      calcularEvolucao(
        carreira.jogador,
        attrs,
        (cenario.minutosPorSemana / 90) * Math.max(1, nota - 4) * 0.62,
        clube,
      );
    }

    carreira.dataAtual = somarDias(carreira.dataAtual, 7);
    processarTreinamento(
      carreira.jogador,
      "equilibrado",
      clube,
      carreira.dataAtual,
      rng,
    );
    // Benchmark mede curva de XP, não RNG de lesão (seed ≠ cenário).
    carreira.jogador.lesao = null;
    carreira.jogador.fadiga = Math.min(carreira.jogador.fadiga, 35);
    carreira.jogador.condicionamento = Math.max(
      carreira.jogador.condicionamento,
      75,
    );

    if (w > 0 && w % 45 === 44) {
      carreira.jogador.idade += 1;
      if (porIdade) porIdade[carreira.jogador.idade] = carreira.jogador.overall;
    }
  }
  return carreira;
}

export function simularCenarioTemporada(
  cenario: CenarioBenchmark,
  seed = "viztto-bench-v2",
): ResultadoBenchmark {
  let c = montarCarreira(`${seed}-${cenario.id}`, cenario);
  const inicio = c.jogador.overall;
  const rng = new GeradorAleatorio(
    [...`${seed}-${cenario.id}`].reduce(
      (a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619),
      2166136261,
    ) >>> 0,
  );

  const porIdade: Record<number, number> = {
    [c.jogador.idade]: c.jogador.overall,
  };
  let pico = c.jogador.overall;

  c = rodarSemanas(c, cenario, cenario.semanas, rng, `${cenario.id}-t1`, porIdade);
  const fimTemporada = c.jogador.overall;
  porIdade[c.jogador.idade] = fimTemporada;
  pico = Math.max(pico, fimTemporada);

  const extras = (cenario.anosExtras ?? 0) * 45;
  if (extras > 0) {
    c = rodarSemanas(c, cenario, extras, rng, `${cenario.id}-extra`, porIdade);
    porIdade[c.jogador.idade] = c.jogador.overall;
    pico = Math.max(pico, c.jogador.overall);
  }

  return {
    id: cenario.id,
    label: cenario.label,
    inicio,
    fimTemporada,
    ganhoTemporada: fimTemporada - inicio,
    porIdade,
    pico,
    final: c.jogador.overall,
    ovr15: inicio,
  };
}

/** Compat com testes antigos (carreira multi-ano). */
export function simularCarreiraTreino(
  cenario: CenarioBenchmark,
  seed = "viztto-bench-v2",
): ResultadoBenchmark {
  return simularCenarioTemporada(cenario, seed);
}

export function ovrEm(mapa: Record<number, number>, idade: number): number {
  if (mapa[idade] != null) return mapa[idade];
  const keys = Object.keys(mapa)
    .map(Number)
    .sort((a, b) => a - b);
  const prev = [...keys].reverse().find((k) => k <= idade);
  return prev != null ? mapa[prev]! : 0;
}

function main() {
  console.log("=== BENCHMARK DESENVOLVIMENTO VIZTTO (1 TEMPORADA) ===\n");
  console.log(
    "CENÁRIO".padEnd(22),
    "INI".padStart(4),
    "FIM".padStart(5),
    "GANHO".padStart(6),
    "META",
  );
  for (const cen of CENARIOS_TEMPORADA) {
    const r = simularCenarioTemporada(cen);
    const meta =
      cen.id === "base-pouco"
        ? "+1..+3"
        : cen.id === "base-normal"
          ? "+4..+9"
          : cen.id.startsWith("base-")
            ? "+6..+12"
            : cen.id === "pro-jovem-67"
              ? "+4..+7"
              : cen.id === "pro-jovem-67-2t"
                ? "+8..+14"
                : cen.id === "pro-70"
                  ? "+3..+6"
                  : cen.id === "pro-80"
                    ? "+1..+3"
                    : cen.id === "elite-85"
                      ? "≤+2"
                      : "≤+1";
    console.log(
      [
        cen.label.padEnd(22),
        String(r.inicio).padStart(4),
        String(r.fimTemporada).padStart(5),
        String(r.ganhoTemporada >= 0 ? `+${r.ganhoTemporada}` : r.ganhoTemporada).padStart(6),
        meta.padStart(8),
      ].join(" "),
    );
  }

  console.log("\n=== LONGO PRAZO (referência) ===\n");
  console.log(
    "CENÁRIO".padEnd(18),
    "INI",
    "OVR18",
    "OVR21",
    "OVR25",
    "PICO",
  );
  for (const cen of CENARIOS_PADRAO) {
    const r = simularCarreiraTreino(cen);
    console.log(
      [
        cen.label.padEnd(18),
        String(r.inicio).padStart(5),
        String(ovrEm(r.porIdade, Math.max(18, cen.idadeInicial))).padStart(5),
        String(ovrEm(r.porIdade, Math.max(21, cen.idadeInicial))).padStart(5),
        String(ovrEm(r.porIdade, Math.max(25, cen.idadeInicial))).padStart(5),
        String(r.pico).padStart(5),
      ].join(" "),
    );
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("simular-desenvolvimento.ts")
) {
  main();
}
