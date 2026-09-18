import { afinidadeHistoria } from "@/dominio/historia-formacao";
import type {
  CentroTreinamentoEstado,
  SessaoTreinoSemana,
} from "@/dominio/desenvolvimento";
import { criarCentroTreinamento } from "@/dominio/desenvolvimento";
import type {
  Atributo,
  Clube,
  EstadoCarreira,
  Jogador,
} from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { calcularOverall } from "@/dominio/regras/jogador";
import {
  exercicioPorId,
  type ExercicioId,
  type ExercicioTreino,
} from "@/dominio/treinamento/exercicios";
import {
  atualizarRecorde,
  notaDeScore,
  type NotaTreino,
} from "@/dominio/treinamento/notas";
import {
  FRACAO_SECUNDARIO,
  FRACAO_TERCIARIO,
  MAX_SESSOES_SEMANA,
  chaveSemanaCarreira,
  eficienciaIdade,
  fatorCategoria,
  fatorPotencial,
  progressoDeXp,
  xpBrutoDaSessao,
} from "@/dominio/treinamento/progresso";
import { limitar } from "@/utilitarios/formatacao";

export interface GanhoAtributoSessao {
  atributo: Atributo;
  xp: number;
  antes: number;
  depois: number;
  progressoAntes: number;
  progressoDepois: number;
}

export interface ResultadoSessaoTreino {
  sessaoId: string;
  exercicioId: ExercicioId;
  score: number;
  nota: NotaTreino;
  modo: "jogar" | "simular";
  novoRecorde: boolean;
  recordeAnterior: NotaTreino | null;
  ganhos: GanhoAtributoSessao[];
  overallAntes: number;
  overallDepois: number;
}

export function garantirCentro(
  jogador: Jogador,
  data?: string,
): CentroTreinamentoEstado {
  if (!jogador.preparacao.centro) {
    jogador.preparacao.centro = criarCentroTreinamento(
      data ? chaveSemanaCarreira(data) : "",
    );
  }
  return jogador.preparacao.centro;
}

export function sincronizarSemanaCentro(jogador: Jogador, data: string): void {
  const centro = garantirCentro(jogador, data);
  const chave = chaveSemanaCarreira(data);
  if (centro.semana.chave !== chave) {
    centro.semana = { chave, sessoes: [] };
  }
}

function aplicarXpEmAtributo(
  jogador: Jogador,
  atributo: Atributo,
  xpBruto: number,
  clube: Clube | null,
): GanhoAtributoSessao {
  const antes = jogador.atributos[atributo];
  const progressoAntes = jogador.desenvolvimento[atributo];
  if (antes >= 99) {
    jogador.desenvolvimento[atributo] = 0;
    return {
      atributo,
      xp: 0,
      antes,
      depois: 99,
      progressoAntes,
      progressoDepois: 0,
    };
  }

  const pot = fatorPotencial(jogador.overall, jogador.potencialInterno);
  const idade = eficienciaIdade(jogador.idade, atributo);
  const afinidade = afinidadeHistoria(
    jogador.perfilFormacao,
    atributo,
    jogador.idade,
  );
  const estrutura = clube
    ? 0.85 + (jogador.categoria === "base" ? clube.qualidadeBase : clube.forcaGeral) / 400
    : 0.72;
  const moral = 0.85 + jogador.moral / 400;
  const xpEfetivo =
    xpBruto *
    idade *
    pot *
    afinidade *
    estrutura *
    moral *
    fatorCategoria(jogador.categoria);
  const progresso = progressoDeXp(xpEfetivo, antes);

  jogador.desenvolvimento[atributo] += progresso;
  while (
    jogador.desenvolvimento[atributo] >= 100 &&
    jogador.atributos[atributo] < 99
  ) {
    jogador.atributos[atributo]++;
    jogador.desenvolvimento[atributo] -= 100;
  }
  if (jogador.atributos[atributo] >= 99) {
    jogador.atributos[atributo] = 99;
    jogador.desenvolvimento[atributo] = 0;
  }

  const centro = garantirCentro(jogador);
  centro.progressoAtributos[atributo] = jogador.desenvolvimento[atributo];

  return {
    atributo,
    xp: Math.round(progresso * 10) / 10,
    antes,
    depois: jogador.atributos[atributo],
    progressoAntes,
    progressoDepois: jogador.desenvolvimento[atributo],
  };
}

function distribuirXp(
  jogador: Jogador,
  exercicio: ExercicioTreino,
  nota: NotaTreino,
  score: number,
  clube: Clube | null,
): GanhoAtributoSessao[] {
  const bruto = xpBrutoDaSessao(nota, score);
  const ganhos: GanhoAtributoSessao[] = [];
  ganhos.push(aplicarXpEmAtributo(jogador, exercicio.primario, bruto, clube));
  for (const a of exercicio.secundarios) {
    ganhos.push(
      aplicarXpEmAtributo(jogador, a, bruto * FRACAO_SECUNDARIO, clube),
    );
  }
  for (const a of exercicio.terciarios ?? []) {
    ganhos.push(
      aplicarXpEmAtributo(jogador, a, bruto * FRACAO_TERCIARIO, clube),
    );
  }
  jogador.overall = calcularOverall(jogador.atributos, jogador.posicao);
  return ganhos;
}

export function sessoesDisponiveis(jogador: Jogador, data: string): number {
  sincronizarSemanaCentro(jogador, data);
  return Math.max(
    0,
    MAX_SESSOES_SEMANA - jogador.preparacao.centro!.semana.sessoes.length,
  );
}

export function podeSimular(jogador: Jogador, exercicioId: string): boolean {
  const centro = garantirCentro(jogador);
  return !!centro.melhoresExercicios[exercicioId];
}

export interface EntradaSessaoTreino {
  exercicioId: string;
  score: number;
  modo: "jogar" | "simular";
  /** ID estável da tentativa — impede reaplicar a mesma conclusão. */
  sessaoId: string;
}

export function aplicarSessaoTreino(
  estado: EstadoCarreira,
  entrada: EntradaSessaoTreino,
  clube: Clube | null,
): { carreira: EstadoCarreira; resultado: ResultadoSessaoTreino } {
  if (estado.aposentado) {
    throw new Error("Jogador aposentado não treina.");
  }
  const carreira = structuredClone(estado);
  const jogador = carreira.jogador;
  if (jogador.lesao) {
    throw new Error(
      "Você está se recuperando de lesão e não pode participar do treinamento desta semana.",
    );
  }

  sincronizarSemanaCentro(jogador, carreira.dataAtual);
  const centro = garantirCentro(jogador, carreira.dataAtual);

  if (centro.semana.sessoes.length >= MAX_SESSOES_SEMANA) {
    throw new Error("Você já concluiu as 3 sessões desta semana.");
  }
  if (centro.semana.sessoes.some((s) => s.id === entrada.sessaoId)) {
    throw new Error("Esta sessão já foi aplicada.");
  }

  const exercicio = exercicioPorId(entrada.exercicioId);
  if (!exercicio) throw new Error("Exercício inválido.");

  let score = Math.max(0, Math.min(100, entrada.score));
  let nota = notaDeScore(score);

  if (entrada.modo === "simular") {
    const recorde = centro.melhoresExercicios[exercicio.id];
    if (!recorde) {
      throw new Error("Sem recorde para simular este exercício.");
    }
    score = recorde.score;
    nota = recorde.nota as NotaTreino;
  }

  const overallAntes = jogador.overall;
  const recordeAnterior =
    (centro.melhoresExercicios[exercicio.id]?.nota as NotaTreino | undefined) ??
    null;
  const atualizado = atualizarRecorde(
    centro.melhoresExercicios[exercicio.id],
    score,
  );
  const anteriores =
    centro.melhoresExercicios[exercicio.id]?.realizados ?? 0;
  centro.melhoresExercicios[exercicio.id] = {
    score: atualizado.score,
    nota: atualizado.nota,
    realizados: anteriores + 1,
  };

  const ganhos = distribuirXp(jogador, exercicio, nota, score, clube);

  const sessao: SessaoTreinoSemana = {
    id: entrada.sessaoId,
    exercicioId: exercicio.id,
    score,
    nota,
    modo: entrada.modo,
    aplicada: true,
  };
  centro.semana.sessoes.push(sessao);

  // Fadiga/condicionamento ficam no fechamento semanal (evita carga dupla).
  if (clube) {
    jogador.moral = limitar(jogador.moral + (nota === "A" ? 1.2 : nota === "B" ? 0.6 : 0));
  } else {
    jogador.moral = limitar(jogador.moral + (nota === "A" ? 0.5 : 0.2));
  }

  return {
    carreira,
    resultado: {
      sessaoId: entrada.sessaoId,
      exercicioId: exercicio.id,
      score,
      nota,
      modo: entrada.modo,
      novoRecorde: atualizado.novoRecorde,
      recordeAnterior,
      ganhos,
      overallAntes,
      overallDepois: jogador.overall,
    },
  };
}

export function rotuloGanho(atributo: Atributo, papel: "primario" | "secundario" | "terciario"): string {
  const setas = papel === "primario" ? "↑↑" : "↑";
  return `${NOMES_ATRIBUTOS[atributo].toUpperCase()} ${setas}`;
}
