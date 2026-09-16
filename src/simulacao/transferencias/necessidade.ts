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
      ? 35
      : nec?.nivel === "alta"
        ? 22
        : nec?.nivel === "media"
          ? 10
          : 2;
  const gapOverall = jogador.overall - clube.forcaGeral;
  const potencialBonus =
    jogador.idade <= 22
      ? Math.max(0, jogador.potencial - jogador.overall) * 0.8
      : 0;
  const reputacaoOk =
    jogador.overall + potencialBonus >= clube.reputacao - 18 ||
    (jogador.idade <= 20 && jogador.potencial >= clube.reputacao + 5);
  if (!reputacaoOk && clube.reputacao > 85) return 0;

  let score =
    pesoNec +
    gapOverall * 2 +
    potencialBonus +
    (jogador.forma - 50) * 0.1 +
    (ligaDestinoReputacao - ligaOrigemReputacao) * 0.15;

  if (jogador.valorMercado > orcamentoAproximado(clube) * 0.45) score -= 40;
  if (jogador.salario > clube.poderFinanceiro * 800) score -= 15;
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

export function resolverJanela(data: string): "fechada" | "verao" | "inverno" {
  const mes = Number(data.slice(5, 7));
  if (mes === 1 || mes === 2) return "inverno";
  if (mes >= 6 && mes <= 8) return "verao";
  return "fechada";
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
  if (jogadorOverall >= clube.reputacao - 12) return true;
  if (idade <= 21 && jogadorPotencial >= clube.reputacao + 3) return true;
  return jogadorOverall >= clube.forcaGeral - 10;
}

export function ligaDoClube(carreira: EstadoCarreira, clubeId: string) {
  const clube = carreira.clubes.find((c) => c.id === clubeId);
  if (!clube) return carreira.liga;
  return (
    carreira.ligas.find((l) => l.id === clube.ligaId) ??
    (clube.ligaId === carreira.liga.id ? carreira.liga : carreira.liga)
  );
}
