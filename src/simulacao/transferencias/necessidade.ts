import type {
  Clube,
  EstadoCarreira,
  JogadorMundo,
  Posicao,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import { orcamentoAproximado } from "@/dominio/mundo-futebol";

export type NecessidadePosicao = {
  posicao: Posicao;
  quantidade: number;
  melhorOverall: number;
  mediaOverall: number;
  idadeMedia: number;
  desfalquesLongos: number;
  nivel: "baixa" | "media" | "alta" | "critica";
};

const POSICOES_FOCO: Posicao[] = [
  "GOL",
  "LD",
  "ZAG",
  "LE",
  "VOL",
  "MC",
  "MEI",
  "PD",
  "PE",
  "CA",
];

export function avaliarNecessidadeElenco(clube: Clube): NecessidadePosicao[] {
  return POSICOES_FOCO.map((posicao) => {
    const grupo = clube.elenco.filter(
      (j) =>
        j.posicaoPrincipal === posicao ||
        j.posicoesSecundarias.includes(posicao),
    );
    const disponiveis = grupo.filter(
      (j) => !j.lesionado || (j.lesao?.diasRecuperacao ?? 0) < 60,
    );
    const desfalquesLongos = grupo.length - disponiveis.length;
    const overalls = disponiveis.map((j) => j.overall).sort((a, b) => b - a);
    const melhorOverall = overalls[0] ?? 0;
    const mediaOverall =
      overalls.length > 0
        ? overalls.reduce((a, b) => a + b, 0) / overalls.length
        : 0;
    const idadeMedia =
      grupo.length > 0
        ? grupo.reduce((a, b) => a + b.idade, 0) / grupo.length
        : 30;
    const gap = clube.forcaGeral - melhorOverall;
    let nivel: NecessidadePosicao["nivel"] = "baixa";
    if (disponiveis.length === 0 || gap >= 12) nivel = "critica";
    else if (
      gap >= 7 ||
      (grupo.length <= 1 && melhorOverall < clube.forcaGeral - 3)
    )
      nivel = "alta";
    else if (
      gap >= 3 ||
      idadeMedia >= 31 ||
      desfalquesLongos > 0 ||
      (grupo.length < 3 && grupo.some((j) => j.idade >= 31))
    )
      nivel = "media";
    return {
      posicao,
      desfalquesLongos,
      quantidade: grupo.length,
      melhorOverall,
      mediaOverall,
      idadeMedia,
      nivel,
    };
  });
}

export function interesseEmJogador(
  clube: Clube,
  jogador: Pick<
    JogadorMundo,
    | "posicaoPrincipal"
    | "overall"
    | "potencial"
    | "idade"
    | "forma"
    | "valorMercado"
    | "salario"
  >,
  ligaOrigemReputacao: number,
  ligaDestinoReputacao: number,
): number {
  const necessidades = avaliarNecessidadeElenco(clube);
  const nec = necessidades.find((n) => n.posicao === jogador.posicaoPrincipal);
  const pesoNec =
    nec?.nivel === "critica"
      ? 38
      : nec?.nivel === "alta"
        ? 26
        : nec?.nivel === "media"
          ? 14
          : 6;
  const gapOverall = jogador.overall - clube.forcaGeral;
  const potencialBonus =
    jogador.idade <= 23
      ? Math.max(0, jogador.potencial - jogador.overall) * 1.15
      : jogador.idade <= 26
        ? Math.max(0, jogador.potencial - jogador.overall) * 0.45
        : 0;
  const reputacaoOk =
    jogador.overall + potencialBonus >= clube.reputacao - 24 ||
    (jogador.idade <= 22 && jogador.potencial >= clube.reputacao - 2);
  // Gigantes ainda exigem nível/potencial alto.
  if (!reputacaoOk && clube.reputacao >= 90) return 0;

  // Encaixe: jogador acima do clube é melhoria; nível parecido depende de necessidade.
  const encaixe =
    gapOverall >= 10
      ? 28
      : gapOverall >= 5
        ? 16 + (gapOverall - 5) * 1.4
        : gapOverall >= -4
          ? 12 - Math.abs(gapOverall) * 0.9
          : gapOverall >= -12
            ? Math.max(-8, gapOverall * 0.65)
            : Math.max(-16, gapOverall * 0.45);

  let score =
    pesoNec +
    encaixe +
    potencialBonus +
    (jogador.forma - 50) * 0.12 +
    (ligaDestinoReputacao - ligaOrigemReputacao) * 0.12;

  if (jogador.valorMercado > orcamentoAproximado(clube) * 0.55) score -= 30;
  if (jogador.salario > clube.poderFinanceiro * 900) score -= 12;
  return score;
}

export function papelPrometidoPara(
  clube: Clube,
  overall: number,
): StatusElenco {
  const d = overall - clube.forcaGeral;
  if (d >= 8) return "estrela do time";
  if (d >= 4) return "jogador importante";
  if (d >= -1) return "titular";
  if (d >= -6) return "rotacao";
  return "reserva";
}

export type TipoJanela = "fechada" | "verao" | "inverno";

export type SituacaoJanela = {
  aberta: boolean;
  tipo: TipoJanela;
  proximaAbertura: string;
};

/** Janelas oficiais: janeiro, fevereiro e julho. */
export function resolverJanela(data: string): TipoJanela {
  const mes = Number(data.slice(5, 7));
  if (mes === 1 || mes === 2) return "inverno";
  if (mes === 7) return "verao";
  return "fechada";
}

/** Próxima data em que uma transferência pode ser efetivada a partir de `data`. */
export function proximaAberturaJanela(data: string): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  if (mes >= 3 && mes <= 6) return `${ano}-07-01`;
  if (mes >= 8) return `${ano + 1}-01-01`;
  if (mes === 1 || mes === 2) return `${ano}-07-01`;
  return `${ano + 1}-01-01`;
}

export function obterSituacaoJanela(data: string): SituacaoJanela {
  const tipo = resolverJanela(data);
  const ano = Number(data.slice(0, 4));
  return {
    aberta: tipo !== "fechada",
    tipo,
    proximaAbertura:
      tipo === "fechada"
        ? proximaAberturaJanela(data)
        : tipo === "inverno"
          ? `${ano}-01-01`
          : `${ano}-07-01`,
  };
}

/** Peso de frequência de propostas espontâneas (testável). */
export function pesoFrequenciaPropostas(data: string): number {
  const mes = Number(data.slice(5, 7));
  if (mes === 1 || mes === 7) return 1;
  if (mes === 2) return 0.75;
  if (mes === 6 || mes === 12) return 0.45;
  return 0.18;
}

export function clubePodePagar(clube: Clube, valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && clube.orcamento >= valor;
}

export function reputacaoCompativel(
  jogadorOverall: number,
  jogadorPotencial: number,
  idade: number,
  clube: Clube,
): boolean {
  if (jogadorOverall >= clube.reputacao - 18) return true;
  if (idade <= 23 && jogadorPotencial >= clube.reputacao - 5) return true;
  if (idade <= 21 && jogadorPotencial >= clube.forcaGeral + 2) return true;
  return jogadorOverall >= clube.forcaGeral - 14;
}

export function ligaDoClube(carreira: EstadoCarreira, clubeId: string) {
  const clube = carreira.clubes.find((c) => c.id === clubeId);
  if (!clube) return carreira.liga;
  return (
    carreira.ligas.find((l) => l.id === clube.ligaId) ??
    (clube.ligaId === carreira.liga.id ? carreira.liga : carreira.liga)
  );
}
