import { PLANOS, prioridadesDaPosicao } from "@/dominio/planos-desenvolvimento";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { IntensidadeTreino, AvaliacaoTreino } from "@/dominio/desenvolvimento";
import { registrarEvento } from "../eventos/eventos";
import type {
  Atributo,
  Clube,
  FocoTreino,
  Jogador,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { calcularEvolucao } from "../evolucao/evolucao";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";
import { garantirCentro } from "./aplicar-sessao";
import { chaveSemanaCarreira } from "@/dominio/treinamento/progresso";
import { TRAINING_GRADES } from "@/dominio/treinamento/notas";

export const FOCOS_TREINO: Record<
  FocoTreino,
  { nome: string; descricao: string; atributos: Atributo[]; carga: number }
> = {
  equilibrado: {
    nome: "Equilibrado",
    descricao: "Fundamentos da sua posição, com carga moderada.",
    atributos: [],
    carga: 10,
  },
  finalizacao: {
    nome: "Finalização",
    descricao: "Conclusão de jogadas, compostura e posicionamento.",
    atributos: ["finalizacao", "compostura", "posicionamento", "cabeceio"],
    carga: 16,
  },
  criacao: {
    nome: "Criação",
    descricao: "Passe, visão de jogo e tomada de decisão.",
    atributos: ["passeCurto", "passeLongo", "visao", "decisao"],
    carga: 12,
  },
  drible: {
    nome: "Drible",
    descricao: "Controle de bola, agilidade e um contra um.",
    atributos: ["drible", "dominio", "agilidade"],
    carga: 16,
  },
  velocidade: {
    nome: "Velocidade",
    descricao: "Explosão e sprints. Exige mais do físico.",
    atributos: ["aceleracao", "velocidade", "agilidade"],
    carga: 23,
  },
  fisico: {
    nome: "Físico",
    descricao: "Força, resistência e impulsão. Carga elevada.",
    atributos: ["forca", "resistencia", "impulsao"],
    carga: 23,
  },
  defesa: {
    nome: "Defesa",
    descricao: "Marcação, antecipação e fundamentos defensivos.",
    atributos: [
      "marcacao",
      "desarme",
      "antecipacao",
      "reflexos",
      "defesaGoleiro",
      "posicionamentoGoleiro",
    ],
    carga: 15,
  },
  recuperacao: {
    nome: "Recuperação",
    descricao: "Descanso ativo. Reduz a fadiga, sem desenvolvimento.",
    atributos: [],
    carga: -24,
  },
};

export function gerarLesao(
  jogador: Jogador,
  data: string,
  aleatorio: GeradorAleatorio,
  risco: number,
): boolean {
  if (jogador.lesao || !aleatorio.chance(risco)) return false;
  const dias = aleatorio.chance(0.08)
    ? aleatorio.inteiro(35, 84)
    : aleatorio.inteiro(7, 28);
  jogador.lesao = {
    tipo:
      dias > 34
        ? "Problema no joelho"
        : aleatorio.escolher([
            "Desconforto muscular",
            "Contusão",
            "Entorse",
            "Lesão muscular",
          ]),
    gravidade: dias > 34 ? "grave" : dias > 14 ? "moderada" : "leve",
    diasRecuperacao: dias,
    dataInicio: data,
    dataPrevistaRetorno: somarDias(data, dias),
  };
  return true;
}

export function focoTreinoEfetivo(
  foco: FocoTreino,
  planoId: string | null | undefined,
): FocoTreino {
  if (!planoId) return foco;
  return foco === "recuperacao" ? "recuperacao" : "equilibrado";
}

/**
 * Ao avançar a semana:
 * - Com sessões do Centro: fecha histórico/fadiga (XP já aplicado nas sessões).
 * - Sem sessões: sem XP de atributo (treino é opt-in no Centro).
 * - Lesão: recuperação.
 * - Compatibilidade: se ainda há plano legado e 0 sessões, aplica resíduo mínimo
 *   do sistema antigo (saves em transição / testes fase 08).
 */
export function processarTreinamento(
  jogador: Jogador,
  foco: FocoTreino,
  clube: Clube | null,
  data: string,
  aleatorio: GeradorAleatorio,
): number {
  const preparacao = jogador.preparacao;
  const centro = garantirCentro(jogador);
  const sessoesFechadas = [...centro.semana.sessoes];
  const focoUsado = focoTreinoEfetivo(foco, preparacao.planoId);
  const recuperacao = !!jogador.lesao || focoUsado === "recuperacao";
  const confiancaAntes = jogador.confianca;
  let progresso = 0;
  let nota = 0;
  let avaliacao: AvaliacaoTreino = "Recuperação";

  if (jogador.lesao || focoUsado === "recuperacao") {
    jogador.fadiga = limitar(jogador.fadiga - 24);
    jogador.condicionamento = limitar(jogador.condicionamento + 6);
    avaliacao = "Recuperação";
    nota = 0;
  } else if (sessoesFechadas.length > 0) {
    const carga = sessoesFechadas.length * 7;
    jogador.fadiga = limitar(jogador.fadiga - 12 + carga * (clube ? 1 : 0.85));
    jogador.condicionamento = limitar(
      jogador.condicionamento + 8 - carga * 0.25 + (clube ? 0 : 2),
    );
    nota =
      sessoesFechadas.reduce((s, x) => s + x.score, 0) /
      sessoesFechadas.length;
    avaliacao =
      nota >= TRAINING_GRADES.A.min
        ? "Excelente"
        : nota >= TRAINING_GRADES.B.min
          ? "Muito bom"
          : nota >= TRAINING_GRADES.C.min
            ? "Bom"
            : "Regular";
    if (clube) {
      jogador.confianca = limitar(jogador.confianca + (nota - 52) / 22);
      jogador.moral = limitar(jogador.moral + (nota - 55) / 70);
    } else {
      jogador.moral = limitar(jogador.moral + (nota - 55) / 140);
    }
    jogador.forma = limitar(jogador.forma * 0.97 + nota * 0.03);
    progresso = Math.round(nota / 10);
    gerarLesao(
      jogador,
      data,
      aleatorio,
      0.0015 + jogador.fadiga * 0.0001 + sessoesFechadas.length * 0.0004,
    );
  } else if (preparacao.planoId) {
    // Legado: plano sem sessões do Centro (transição / testes).
    const treino = FOCOS_TREINO.equilibrado;
    const fatorCarga = { leve: 0.65, normal: 1, intenso: 1.65 }[
      preparacao.intensidade
    ];
    nota = avaliarTreino(jogador, aleatorio);
    jogador.fadiga = limitar(
      jogador.fadiga - 15 + treino.carga * fatorCarga * (clube ? 1 : 0.85),
    );
    jogador.condicionamento = limitar(
      jogador.condicionamento + 10 - treino.carga * fatorCarga * 0.4,
    );
    if (clube) {
      jogador.confianca = limitar(jogador.confianca + (nota - 52) / 18);
      jogador.moral = limitar(jogador.moral + (nota - 55) / 60);
    }
    jogador.forma = limitar(jogador.forma * 0.97 + nota * 0.03);
    const plano = PLANOS.find(
      (p) =>
        p.id === preparacao.planoId && p.posicoes.includes(jogador.posicao),
    );
    const atributos =
      plano?.atributos ??
      (Object.keys(PESOS_POSICOES[jogador.posicao]) as Atributo[]);
    const pontos =
      4.2 *
      (0.45 + nota / 100) *
      (preparacao.intensidade === "intenso"
        ? 1.12
        : preparacao.intensidade === "leve"
          ? 0.7
          : 1);
    progresso = calcularEvolucao(jogador, atributos, pontos, clube);
    const prioridades = preparacao.prioridades.filter((a) =>
      prioridadesDaPosicao(jogador.posicao).includes(a),
    );
    progresso += calcularEvolucao(jogador, prioridades, pontos * 0.35, clube);
    gerarLesao(
      jogador,
      data,
      aleatorio,
      0.002 +
        jogador.fadiga * 0.00012 +
        (preparacao.intensidade === "intenso" ? 0.003 : 0),
    );
    avaliacao =
      nota >= 82
        ? "Excelente"
        : nota >= 69
          ? "Muito bom"
          : nota >= 55
            ? "Bom"
            : nota >= 40
              ? "Regular"
              : "Ruim";
  } else {
    // Sem sessões e sem plano: carga física do foco legado, sem XP de atributo.
    // O Centro é opt-in — não treinar na semana não concede desenvolvimento.
    const treino = FOCOS_TREINO[focoUsado];
    const fatorCarga = { leve: 0.65, normal: 1, intenso: 1.65 }[
      preparacao.intensidade
    ];
    jogador.fadiga = limitar(
      jogador.fadiga - 15 + treino.carga * fatorCarga * (clube ? 1 : 0.85),
    );
    jogador.condicionamento = limitar(
      jogador.condicionamento +
        10 -
        Math.max(0, treino.carga) * fatorCarga * 0.4 +
        (clube ? 0 : 2),
    );
    nota = 0;
    avaliacao = "Regular";
    progresso = 0;
  }

  preparacao.historico = [
    ...preparacao.historico,
    {
      data,
      avaliacao,
      nota,
      confianca: jogador.confianca - confiancaAntes,
      progresso,
    },
  ].slice(-8);
  centro.semana = { chave: chaveSemanaCarreira(data), sessoes: [] };
  return progresso;
}

export function avaliarTreino(j: Jogador, rng: GeradorAleatorio): number {
  const recente = j.preparacao.historico
    .filter((t) => t.avaliacao !== "Recuperação")
    .slice(-3);
  const media = recente.length
    ? recente.reduce((s, t) => s + t.nota, 0) / recente.length
    : 55;
  return limitar(
    12 +
      j.personalidade.profissionalismo * 0.27 +
      j.personalidade.disciplina * 0.17 +
      j.moral * 0.12 +
      j.condicionamento * 0.12 -
      j.fadiga * 0.2 +
      media * 0.07 +
      (j.idade < 24 ? 3 : 0) +
      (j.preparacao.planoId ? 2 : 0) +
      rng.inteiro(-8, 8),
  );
}

export function configurarDesenvolvimento(
  estado: EstadoCarreira,
  planoId: string,
  prioridades: Atributo[],
  intensidade: IntensidadeTreino,
): EstadoCarreira {
  const plano = PLANOS.find(
    (p) => p.id === planoId && p.posicoes.includes(estado.jogador.posicao),
  );
  if (
    !plano ||
    prioridades.length > 2 ||
    new Set(prioridades).size !== prioridades.length ||
    prioridades.some(
      (a) => !prioridadesDaPosicao(estado.jogador.posicao).includes(a),
    ) ||
    !["leve", "normal", "intenso"].includes(intensidade)
  )
    throw new Error(
      "Escolha um plano da sua posição, até duas prioridades e uma intensidade válida.",
    );
  const c = structuredClone(estado);
  c.jogador.preparacao = {
    ...c.jogador.preparacao,
    planoId,
    prioridades: [...prioridades],
    intensidade,
  };
  if (c.focoTreino !== "recuperacao") c.focoTreino = "equilibrado";
  registrarEvento(
    c,
    "plano",
    "Plano de desenvolvimento atualizado",
    `${plano.nome}. Intensidade ${intensidade}; ${prioridades.length} prioridade(s) individual(is).`,
    "Treinador",
    false,
  );
  return c;
}

export function escolherFocoTreino(
  estado: EstadoCarreira,
  foco: FocoTreino,
): EstadoCarreira {
  if (!Object.hasOwn(FOCOS_TREINO, foco))
    throw new Error("Escolha um foco de treino válido.");
  if (
    estado.jogador.preparacao.planoId &&
    foco !== "recuperacao" &&
    foco !== "equilibrado"
  )
    throw new Error(
      "Com plano ativo, use apenas recuperação ou o ritmo do plano.",
    );
  return { ...estado, focoTreino: foco };
}
