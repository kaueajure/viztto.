import type {
  EstadoCarreira,
  Jogador,
  JogadorMundo,
  Liga,
  StatusElenco,
  TransferenciaMundial,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { registrarEvento } from "../eventos/eventos";
import { reescalarClube } from "../elenco/escalacao-elenco";
import { sincronizarForcaClube } from "../elenco/forca-escalacao";
import {
  clubePodePagar,
  interesseEmJogador,
  ligaDoClube,
  papelPrometidoPara,
  reputacaoCompativel,
  resolverJanela,
} from "./necessidade";

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

function transferirNpc(
  carreira: EstadoCarreira,
  jogador: JogadorMundo,
  deId: string,
  paraId: string,
  valor: number,
): TransferenciaMundial {
  const de = carreira.clubes.find((c) => c.id === deId)!;
  const para = carreira.clubes.find((c) => c.id === paraId)!;
  de.elenco = de.elenco.filter((j) => j.id !== jogador.id);
  de.orcamento += Math.round(valor * 0.9);
  jogador.clubeId = para.id;
  jogador.salario = Math.round(
    Math.max(jogador.salario, valor * 0.0012) * (1 + para.poderFinanceiro / 200),
  );
  jogador.statusElenco = papelPrometidoPara(para, jogador.overall);
  para.elenco.push(jogador);
  para.orcamento = Math.max(0, para.orcamento - valor);
  reescalarClube(de);
  reescalarClube(para);
  sincronizarForcaClube(de);
  sincronizarForcaClube(para);
  const registro: TransferenciaMundial = {
    id: `tmund-${carreira.dataAtual}-${jogador.id}`,
    jogadorId: jogador.id,
    nomeJogador: jogador.nome,
    deClubeId: de.id,
    paraClubeId: para.id,
    valor,
    salario: jogador.salario,
    duracaoAnos: 3,
    papelPrometido: jogador.statusElenco,
    etapa: "concluida",
    data: carreira.dataAtual,
    aoUsuario: false,
  };
  carreira.transferenciasRecentes = [
    registro,
    ...carreira.transferenciasRecentes,
  ].slice(0, 40);
  return registro;
}

function processarMercadoNpc(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  if (carreira.janelaTransferencias === "fechada") return;
  const compradores = [...carreira.clubes].sort(
    () => aleatorio.proximo() - 0.5,
  );
  let feitos = 0;
  for (const comprador of compradores) {
    if (feitos >= 3) break;
    if (!aleatorio.chance(0.22)) continue;
    const ligaComp = ligaDoClube(carreira, comprador.id);
    let melhor: {
      jogador: JogadorMundo;
      vendedorId: string;
      score: number;
    } | null = null;
    for (const vendedor of carreira.clubes) {
      if (vendedor.id === comprador.id) continue;
      const ligaVend = ligaDoClube(carreira, vendedor.id);
      for (const j of vendedor.elenco) {
        if (j.lesionado) continue;
        if (
          !reputacaoCompativel(j.overall, j.potencial, j.idade, comprador)
        )
          continue;
        const score = interesseEmJogador(
          comprador,
          j,
          ligaVend.reputacao,
          ligaComp.reputacao,
        );
        if (score < 18) continue;
        if (!clubePodePagar(comprador, j.valorMercado)) continue;
        // não desmantelar titular absoluto barato demais
        if (
          (vendedor.titularesIds.includes(j.id) ||
            vendedor.goleiroTitularId === j.id) &&
          j.overall >= vendedor.forcaGeral - 2 &&
          !aleatorio.chance(0.15)
        )
          continue;
        if (!melhor || score > melhor.score)
          melhor = { jogador: j, vendedorId: vendedor.id, score };
      }
    }
    if (!melhor) continue;
    const valor = Math.round(melhor.jogador.valorMercado * (0.9 + aleatorio.proximo() * 0.35));
    if (!clubePodePagar(comprador, valor)) continue;
    const reg = transferirNpc(
      carreira,
      melhor.jogador,
      melhor.vendedorId,
      comprador.id,
      valor,
    );
    feitos++;
    if (aleatorio.chance(0.4))
      registrarEvento(
        carreira,
        "transferencia-mundo",
        `${reg.nomeJogador} troca de clube`,
        `${carreira.clubes.find((c) => c.id === reg.deClubeId)?.nome} → ${carreira.clubes.find((c) => c.id === reg.paraClubeId)?.nome}.`,
        "Imprensa",
        false,
      );
  }
}

export function avaliarMercado(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  carreira.janelaTransferencias = resolverJanela(carreira.dataAtual);
  const j = carreira.jogador;
  for (const proposta of carreira.propostas)
    if (
      proposta.status === "pendente" &&
      proposta.validade < carreira.dataAtual
    )
      proposta.status = "expirada";

  processarMercadoNpc(carreira, aleatorio);

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
      papelPrometido: j.status,
      etapa: "proposta_jogador",
      data: carreira.dataAtual,
      validade: somarDias(carreira.dataAtual, 28),
      status: "pendente",
    });
    registrarEvento(
      carreira,
      "renovacao",
      "Diretoria propõe renovação",
      "Uma nova proposta de contrato aguarda sua decisão.",
      "Diretoria",
    );
  }

  // sondagens fora da janela; propostas firmes na janela
  const naJanela = carreira.janelaTransferencias !== "fechada";
  if (pendentes.filter((p) => p.tipo === "transferencia").length >= 2) return;
  const desempenho = carreira.registros
    .filter((r) => r.ano === carreira.temporada.ano)
    .reduce((s, r) => s + r.estatisticas.gols + r.estatisticas.assistencias, 0);
  const interesseBase = limitar(
    0.012 +
      j.forma * 0.00025 +
      j.reputacao * 0.00025 +
      desempenho * 0.001 +
      (j.personalidade.ambicao - 50) * 0.0001 +
      (naJanela ? 0.04 : 0.008),
    0.01,
    0.16,
  );
  if (!aleatorio.chance(interesseBase)) return;

  const ligaJogador = carreira.liga;
  const candidatos = carreira.clubes.filter((c) => {
    if (c.id === carreira.clubeAtualId) return false;
    if (pendentes.some((p) => p.clubeId === c.id)) return false;
    if (!reputacaoCompativel(j.overall, j.potencialInterno, j.idade, c))
      return false;
    const liga = ligaDoClube(carreira, c.id);
    const score = interesseEmJogador(
      c,
      {
        posicaoPrincipal: j.posicao,
        overall: j.overall,
        potencial: j.potencialInterno,
        idade: j.idade,
        forma: j.forma,
        valorMercado: j.valorMercado,
        salario: j.contrato.salario,
      },
      ligaJogador.reputacao,
      liga.reputacao,
    );
    return score >= 12 && clubePodePagar(c, j.valorMercado * 0.7);
  });
  if (!candidatos.length) return;
  const clube = aleatorio.escolher(candidatos);
  const papel = papelPrometidoPara(clube, j.overall);
  carreira.propostas.push({
    id: `transferencia-${carreira.dataAtual}-${clube.id}`,
    clubeId: clube.id,
    tipo: "transferencia",
    salario: Math.round(
      Math.max(500, j.valorMercado * 0.0015) *
        (1 + clube.poderFinanceiro / 100),
    ),
    duracaoAnos: aleatorio.inteiro(2, 5),
    papelPrometido: papel,
    etapa: naJanela ? "proposta_jogador" : "sondagem",
    data: carreira.dataAtual,
    validade: somarDias(carreira.dataAtual, naJanela ? 21 : 14),
    status: "pendente",
  });
  registrarEvento(
    carreira,
    "interesse",
    `${clube.nome} demonstra interesse em ${j.nome}`,
    naJanela
      ? `Proposta formal: ${papel}. Consulte salário e duração.`
      : "Sondagem fora da janela. Seu agente acompanha o caso.",
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
  proposta.etapa = aceitar ? "aceite" : "rejeicao";
  if (!aceitar) {
    carreira.jogador.moral = limitar(
      carreira.jogador.moral +
        (carreira.jogador.personalidade.lealdade - 50) / 30,
    );
    carreira.relacionamentos.agente = limitar(
      carreira.relacionamentos.agente - 2,
    );
    return carreira;
  }
  const j = carreira.jogador;
  if (proposta.tipo === "renovacao") {
    j.contrato = {
      ...j.contrato,
      salario: proposta.salario,
      dataInicio: carreira.dataAtual,
      dataTermino: somarDias(carreira.dataAtual, proposta.duracaoAnos * 365),
      papelEsperado: proposta.papelPrometido ?? j.status,
    };
    carreira.relacionamentos.diretoria = limitar(
      carreira.relacionamentos.diretoria + 5,
    );
    registrarEvento(
      carreira,
      "contrato",
      "Contrato renovado",
      `Novo vínculo até ${j.contrato.dataTermino}.`,
      "Diretoria",
    );
    return carreira;
  }
  const destino = carreira.clubes.find((c) => c.id === proposta.clubeId);
  if (!destino) throw new Error("Clube da proposta não encontrado.");
  const origem = carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
  if (origem) {
    origem.orcamento += Math.round(j.valorMercado * 0.5);
    reescalarClube(origem);
    sincronizarForcaClube(origem);
  }
  carreira.clubeAtualId = destino.id;
  j.contrato = {
    clubeId: destino.id,
    salario: proposta.salario,
    dataInicio: carreira.dataAtual,
    dataTermino: somarDias(carreira.dataAtual, proposta.duracaoAnos * 365),
    papelEsperado: proposta.papelPrometido ?? "rotacao",
    tipo: "profissional",
    bonusGol: j.contrato.bonusGol,
  };
  j.status = proposta.papelPrometido ?? "rotacao";
  j.confianca = 55;
  carreira.relacionamentos.treinador = 50;
  carreira.liga =
    carreira.ligas.find((l) => l.id === destino.ligaId) ?? carreira.liga;
  carreira.transferenciasRecentes.unshift({
    id: `user-${proposta.id}`,
    jogadorId: "usuario",
    nomeJogador: `${j.nome} ${j.sobrenome}`,
    deClubeId: origem?.id ?? carreira.clubeInicialId,
    paraClubeId: destino.id,
    valor: j.valorMercado,
    salario: proposta.salario,
    duracaoAnos: proposta.duracaoAnos,
    papelPrometido: proposta.papelPrometido,
    etapa: "concluida",
    data: carreira.dataAtual,
    aoUsuario: true,
  });
  registrarEvento(
    carreira,
    "transferencia",
    `${j.nome} assina com o ${destino.nome}`,
    `Papel prometido: ${proposta.papelPrometido}.`,
    "Agente",
  );
  return carreira;
}

export type { StatusElenco };
