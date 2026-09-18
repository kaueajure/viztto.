/**
 * Benchmark de desenvolvimento — seed fixa.
 * Uso: npm run benchmark:desenvolvimento
 */
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import type { Atributo, EstadoCarreira } from "@/dominio/entidades/modelos";
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
  anos: number;
};

export const CENARIOS_PADRAO: CenarioBenchmark[] = [
  {
    id: "ruim",
    label: "Pouco treino",
    sessoesPorSemana: 1,
    scoreMedio: 48,
    minutosPorSemana: 25,
    potencial: 76,
    idadeInicial: 15,
    anos: 10,
  },
  {
    id: "normal",
    label: "Carreira normal",
    sessoesPorSemana: 2,
    scoreMedio: 74,
    minutosPorSemana: 40,
    potencial: 82,
    idadeInicial: 15,
    anos: 10,
  },
  {
    id: "dedicado",
    label: "Dedicado",
    sessoesPorSemana: 3,
    scoreMedio: 90,
    minutosPorSemana: 75,
    potencial: 90,
    idadeInicial: 15,
    anos: 10,
  },
  {
    id: "talento",
    label: "Alto talento",
    sessoesPorSemana: 3,
    scoreMedio: 92,
    minutosPorSemana: 80,
    potencial: 94,
    idadeInicial: 15,
    anos: 10,
  },
  {
    id: "veterano28",
    label: "Veterano 28+",
    sessoesPorSemana: 2.5,
    scoreMedio: 85,
    minutosPorSemana: 60,
    potencial: 80,
    idadeInicial: 28,
    anos: 4,
  },
  {
    id: "veterano33",
    label: "Veterano 33+",
    sessoesPorSemana: 2,
    scoreMedio: 85,
    minutosPorSemana: 40,
    potencial: 78,
    idadeInicial: 33,
    anos: 3,
  },
];

function montarCarreira(
  seed: string,
  idade: number,
  potencial: number,
): EstadoCarreira {
  const liga = LIGAS_SUPORTADAS[0]!;
  const clubes = gerarClubesDemonstracao(liga).slice(0, 4);
  const c = criarCarreira({
    identidade: {
      nome: "Bench",
      sobrenome: "Mark",
      nacionalidade: "Brasil",
      idade,
      posicao: "CA",
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

  for (const a of Object.keys(c.jogador.atributos) as Atributo[]) {
    c.jogador.atributos[a] = 52;
  }
  for (const [a, w] of Object.entries(PESOS_POSICOES.CA) as [Atributo, number][]) {
    c.jogador.atributos[a] = w >= 4 ? 62 : w >= 3 ? 58 : 55;
  }
  c.jogador.overall = calcularOverall(c.jogador.atributos, "CA");
  c.jogador.potencialInterno = Math.max(potencial, c.jogador.overall + 2);
  c.jogador.idade = idade;
  c.jogador.categoria = idade < 17 ? "base" : "profissional";
  return c;
}

export function simularCarreiraTreino(
  cenario: CenarioBenchmark,
  seed = "viztto-bench-v1",
): { porIdade: Record<number, number>; pico: number; final: number; ovr15: number } {
  let c = montarCarreira(`${seed}-${cenario.id}`, cenario.idadeInicial, cenario.potencial);
  const ovr15 = c.jogador.overall;
  const rng = new GeradorAleatorio(
    [...`${seed}-${cenario.id}`].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0,
  );
  const recomendados = exerciciosRecomendados("CA");
  // Foco nos fundamentos que mais movem OVR de CA (evita diluir em arrancada cedo).
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
  const porIdade: Record<number, number> = { [c.jogador.idade]: c.jogador.overall };
  let pico = c.jogador.overall;
  const semanas = cenario.anos * 45;

  for (let w = 0; w < semanas; w++) {
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId) ?? null;
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
        c = aplicarSessaoTreino(
          c,
          {
            exercicioId: ex.id,
            score,
            modo: "jogar",
            sessaoId: `${cenario.id}-w${w}-s${s}`,
          },
          clube,
        ).carreira;
      } catch {
        break;
      }
    }

    if (cenario.minutosPorSemana > 0 && clube) {
      const attrs = Object.keys(PESOS_POSICOES.CA) as Atributo[];
      const nota = 6 + (cenario.scoreMedio / 100) * 2;
      calcularEvolucao(
        c.jogador,
        attrs,
        (cenario.minutosPorSemana / 90) * Math.max(1, nota - 4) * 1.6,
        clube,
      );
    }

    c.dataAtual = somarDias(c.dataAtual, 7);
    processarTreinamento(c.jogador, "equilibrado", clube, c.dataAtual, rng);

    if (w > 0 && w % 45 === 44) {
      c.jogador.idade += 1;
      porIdade[c.jogador.idade] = c.jogador.overall;
    }
    pico = Math.max(pico, c.jogador.overall);
  }
  porIdade[c.jogador.idade] = c.jogador.overall;
  return { porIdade, pico, final: c.jogador.overall, ovr15 };
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
  console.log("=== BENCHMARK DESENVOLVIMENTO VIZTTO ===\n");
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
    const line = [
      cen.label.padEnd(18),
      String(r.ovr15).padStart(5),
      String(ovrEm(r.porIdade, Math.max(18, cen.idadeInicial))).padStart(5),
      String(ovrEm(r.porIdade, Math.max(21, cen.idadeInicial))).padStart(5),
      String(ovrEm(r.porIdade, Math.max(25, cen.idadeInicial))).padStart(5),
      String(r.pico).padStart(5),
    ].join(" ");
    console.log(line);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("simular-desenvolvimento.ts")) {
  main();
}
