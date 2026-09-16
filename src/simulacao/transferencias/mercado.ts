import type {
  EstadoCarreira,
  Jogador,
  Liga,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { registrarEvento } from "../eventos/eventos";
export function calcularValorMercado(
  jogador: Jogador,
  liga: Liga,
  data: string,
): number {
  const anosRestantes = Math.max(
    0,
    (Date.parse(jogador.contrato.dataTermino) - Date.parse(data)) / 31557600000,
  );
  const idade =
    jogador.idade < 24
      ? 1.35
      : jogador.idade < 29
        ? 1
        : jogador.idade < 33
          ? 0.65
          : 0.3;
  const posicao = ["CA", "PD", "PE", "MEI"].includes(jogador.posicao)
    ? 1.15
    : 0.9;
  return (
    Math.round(
      (90000 *
        Math.exp((jogador.overall - 55) * 0.115) *
        idade *
        posicao *
        (0.6 + liga.reputacao / 150) *
        (0.6 + jogador.reputacao / 100) *
        (0.8 + jogador.forma / 200) *
        (0.65 + Math.min(3, anosRestantes) * 0.15) *
        (1 + Math.max(0, jogador.potencialInterno - jogador.overall) / 100)) /
        1000,
    ) * 1000
  );
}
export function avaliarMercado(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  const j = carreira.jogador;
  for (const proposta of carreira.propostas)
    if (
      proposta.status === "pendente" &&
      proposta.validade < carreira.dataAtual
    )
      proposta.status = "expirada";
  if (j.categoria === "base") return;
  const pendentes = carreira.propostas.filter((p) => p.status === "pendente");
  const ultimaRenovacao = carreira.propostas
    .filter((p) => p.tipo === "renovacao")
    .at(-1);
  if (
    j.contrato.dataTermino < somarDias(carreira.dataAtual, 365) &&
    !pendentes.some((p) => p.tipo === "renovacao") &&
    (!ultimaRenovacao ||
      ultimaRenovacao.data < somarDias(carreira.dataAtual, -84))
  ) {
    carreira.propostas.push({
      id: `renovacao-${carreira.dataAtual}`,
      clubeId: carreira.clubeAtualId,
      tipo: "renovacao",
      salario: Math.round(j.contrato.salario * (1.05 + j.confianca / 500)),
      duracaoAnos: 3,
      data: carreira.dataAtual,
      validade: somarDias(carreira.dataAtual, 28),
      status: "pendente",
    });
    registrarEvento(
      carreira,
      "renovacao",
      "Diretoria propõe renovação",
      "Uma nova proposta de contrato aguarda sua decisão na tela inicial.",
      "Diretoria",
    );
  }
  if (pendentes.filter((p) => p.tipo === "transferencia").length >= 2) return;
  const desempenho = carreira.registros
    .filter((r) => r.ano === carreira.temporada.ano)
    .reduce((s, r) => s + r.estatisticas.gols + r.estatisticas.assistencias, 0);
  const interesse = limitar(
    0.018 +
      j.forma * 0.0003 +
      j.reputacao * 0.00025 +
      desempenho * 0.001 +
      (j.personalidade.ambicao - 50) * 0.0001,
    0.015,
    0.13,
  );
  if (!aleatorio.chance(interesse)) return;
  const candidatos = carreira.clubes.filter(
    (c) =>
      c.id !== carreira.clubeAtualId &&
      !pendentes.some((p) => p.clubeId === c.id) &&
      j.overall >= c.forcaGeral - 13 &&
      j.overall < c.forcaGeral + 17 &&
      c.poderFinanceiro * 500000 > j.valorMercado &&
      aleatorio.chance(0.35 + (100 - c.forcaGeral) / 150),
  );
  if (!candidatos.length) return;
  const clube = aleatorio.escolher(candidatos);
  carreira.propostas.push({
    id: `transferencia-${carreira.dataAtual}`,
    clubeId: clube.id,
    tipo: "transferencia",
    salario: Math.round(
      Math.max(500, j.valorMercado * 0.0015) *
        (1 + clube.poderFinanceiro / 100),
    ),
    duracaoAnos: aleatorio.inteiro(2, 4),
    data: carreira.dataAtual,
    validade: somarDias(carreira.dataAtual, 21),
    status: "pendente",
  });
  registrarEvento(
    carreira,
    "interesse",
    `${clube.nome} acompanha ${j.nome}`,
    "Seu agente recebeu uma proposta. Consulte salário, duração e nível do clube antes de decidir.",
    "Agente",
  );
}
export function responderProposta(
  estado: EstadoCarreira,
  id: string,
  aceitar: boolean,
): EstadoCarreira {
  const carreira = structuredClone(estado),
    proposta = carreira.propostas.find((p) => p.id === id);
  if (
    !proposta ||
    proposta.status !== "pendente" ||
    proposta.validade < carreira.dataAtual
  )
    throw new Error("Esta proposta não está mais disponível.");
  proposta.status = aceitar ? "aceita" : "rejeitada";
  if (!aceitar) {
    carreira.jogador.moral = limitar(
      carreira.jogador.moral +
        (carreira.jogador.personalidade.lealdade - 50) / 30,
    );
    return carreira;
  }
  const clube = carreira.clubes.find((c) => c.id === proposta.clubeId)!;
  carreira.jogador.contrato = {
    clubeId: clube.id,
    salario: proposta.salario,
    dataInicio: carreira.dataAtual,
    dataTermino: somarDias(carreira.dataAtual, proposta.duracaoAnos * 365),
    papelEsperado: "rotacao",
    tipo: "profissional",
    bonusGol: Math.round(proposta.salario * 0.05),
  };
  carreira.clubeAtualId = clube.id;
  if (proposta.tipo === "transferencia") {
    carreira.jogador.confianca =
      45 + carreira.jogador.personalidade.adaptabilidade * 0.15;
    carreira.jogador.status = "rotacao";
    carreira.ultimaPartidaId = null;
  }
  for (const outra of carreira.propostas)
    if (outra.status === "pendente") outra.status = "expirada";
  registrarEvento(
    carreira,
    proposta.tipo,
    proposta.tipo === "renovacao"
      ? "Contrato renovado"
      : `${carreira.jogador.nome} assina com ${clube.nome}`,
    `Vínculo de ${proposta.duracaoAnos} anos confirmado.`,
    "Diretoria",
  );
  return carreira;
}
