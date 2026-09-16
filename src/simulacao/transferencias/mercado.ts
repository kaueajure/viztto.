import {
  avancarInteresses,
  processarContrapropostas,
  avaliarPapelPrometido,
  registrarNegociacao,
  tetoSalario,
} from "./mercado-progressivo";
import { criarMercado } from "@/dominio/mercado";
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
    Math.max(jogador.salario, valor * 0.0012) *
      (1 + para.poderFinanceiro / 200),
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
        if (!reputacaoCompativel(j.overall, j.potencial, j.idade, comprador))
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
    const valor = Math.round(
      melhor.jogador.valorMercado * (0.9 + aleatorio.proximo() * 0.35),
    );
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
  carreira.mercado ??= criarMercado();
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
    !carreira.mercado.pediuSaida &&
    !carreira.propostas.some(
      (p) => p.status === "aceita" && p.etapa === "acordo",
    ) &&
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

  processarContrapropostas(carreira);
  avancarInteresses(carreira);
  avaliarPapelPrometido(carreira);
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
  carreira.mercado ??= criarMercado();
  if (
    aceitar &&
    (proposta.contrapropostaPendente ||
      !["proposta_jogador", "negociacao"].includes(proposta.etapa))
  )
    throw new Error("Aguarde uma oferta contratual formal antes de aceitar.");
  if (
    aceitar &&
    proposta.tipo === "transferencia" &&
    !proposta.preContrato &&
    resolverJanela(carreira.dataAtual) === "fechada"
  )
    throw new Error(
      "A janela está fechada. Uma transferência normal só pode ser concluída durante a janela.",
    );
  if (
    aceitar &&
    carreira.propostas.some(
      (p) =>
        p.id !== proposta.id && p.status === "aceita" && p.etapa === "acordo",
    )
  )
    throw new Error("Você já assinou um pré-contrato e deve cumprir o acordo.");
  if (
    aceitar &&
    proposta.preContrato &&
    (!proposta.efetivarEm ||
      proposta.valorTransferencia !== 0 ||
      proposta.efetivarEm <= carreira.jogador.contrato.dataTermino ||
      (Date.parse(carreira.jogador.contrato.dataTermino) -
        Date.parse(carreira.dataAtual)) /
        86400000 >
        180 ||
      carreira.clubes.find((cl) => cl.id === proposta.clubeId)?.ligaId ===
        carreira.liga.id)
  )
    throw new Error(
      "Este pré-contrato não atende às condições de contratação internacional ao fim do vínculo.",
    );
  if (
    aceitar &&
    proposta.preContrato &&
    proposta.efetivarEm &&
    proposta.efetivarEm > carreira.dataAtual
  ) {
    if (
      carreira.propostas.some(
        (p) => p.status === "aceita" && p.etapa === "acordo",
      )
    )
      throw new Error("Você já assinou um pré-contrato.");
    const contratante = carreira.clubes.find(
      (cl) => cl.id === proposta.clubeId,
    );
    if (
      !contratante ||
      proposta.salario > tetoSalario(contratante) ||
      proposta.salario * 52 + (proposta.luvas ?? 0) > contratante.orcamento
    )
      throw new Error("O pré-contrato não cabe no orçamento do clube.");
    proposta.status = "aceita";
    proposta.etapa = "acordo";
    registrarNegociacao(
      carreira,
      proposta.clubeId,
      `Pré-contrato assinado. A chegada está prevista para ${proposta.efetivarEm}.`,
      proposta.id,
      proposta,
    );
    return carreira;
  }
  proposta.status = aceitar ? "aceita" : "rejeitada";
  proposta.etapa = aceitar ? "aceite" : "rejeicao";
  if (!aceitar) {
    const interesse = carreira.mercado.interesses.find(
      (i) => i.clubeId === proposta.clubeId,
    );
    if (interesse) {
      interesse.status = "encerrado";
      interesse.nivelInteresse = Math.max(0, interesse.nivelInteresse - 30);
      interesse.reabrirEm = somarDias(carreira.dataAtual, 84);
    }
    registrarNegociacao(
      carreira,
      proposta.clubeId,
      "Você rejeitou a proposta.",
      proposta.id,
    );
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
    const atual = carreira.clubes.find(
      (cl) => cl.id === carreira.clubeAtualId,
    )!;
    if (proposta.clubeId !== atual.id || proposta.salario > tetoSalario(atual))
      throw new Error("A renovação não cabe na folha do clube atual.");
    j.contrato = {
      ...j.contrato,
      salario: proposta.salario,
      dataInicio: carreira.dataAtual,
      dataTermino: somarDias(carreira.dataAtual, proposta.duracaoAnos * 365),
      papelEsperado: proposta.papelPrometido ?? j.status,
      clausulaRescisao: proposta.clausulaRescisao,
      bonusGol: proposta.bonusGol ?? j.contrato.bonusGol,
      luvas: proposta.luvas,
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
    registrarNegociacao(
      carreira,
      proposta.clubeId,
      "Novo contrato assinado.",
      proposta.id,
      proposta,
    );
    return carreira;
  }
  const destino = carreira.clubes.find((c) => c.id === proposta.clubeId);
  if (!destino) throw new Error("Clube da proposta não encontrado.");
  if (
    proposta.clubeOrigemId &&
    proposta.clubeOrigemId !== carreira.clubeAtualId
  )
    throw new Error("Esta negociação pertence ao seu clube anterior.");
  const valor = proposta.valorTransferencia ?? Math.round(j.valorMercado * 0.5);
  if (
    valor + proposta.salario * 52 + (proposta.luvas ?? 0) > destino.orcamento ||
    proposta.salario > tetoSalario(destino)
  )
    throw new Error(
      "O clube não possui orçamento e folha disponíveis para estes termos.",
    );
  destino.orcamento -= valor + (proposta.luvas ?? 0);
  if (destino.ligaId !== carreira.liga.id) {
    const ligaDestino = carreira.ligas.find((l) => l.id === destino.ligaId);
    const temporadaDestino = carreira.temporadasExternas[destino.ligaId];
    if (!ligaDestino || !temporadaDestino)
      throw new Error("A liga de destino não possui uma temporada disponível.");
    carreira.temporadasExternas[carreira.liga.id] = carreira.temporada;
    carreira.temporada = temporadaDestino;
    delete carreira.temporadasExternas[destino.ligaId];
    carreira.liga = ligaDestino;
    carreira.ultimaPartidaId = null;
  }
  const origem = carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
  if (origem) {
    origem.orcamento += valor;
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
    bonusGol: proposta.bonusGol ?? 0,
    clausulaRescisao: proposta.clausulaRescisao,
    luvas: proposta.luvas,
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
    valor,
    salario: proposta.salario,
    duracaoAnos: proposta.duracaoAnos,
    papelPrometido: proposta.papelPrometido,
    etapa: "concluida",
    data: carreira.dataAtual,
    aoUsuario: true,
  });
  proposta.etapa = "concluida";
  for (const outra of carreira.propostas)
    if (
      outra.id !== proposta.id &&
      (outra.status === "pendente" ||
        (outra.status === "aceita" && outra.etapa === "acordo"))
    ) {
      outra.status = "expirada";
    }
  for (const interesse of carreira.mercado.interesses)
    interesse.status = "encerrado";
  carreira.mercado.pediuSaida = false;
  carreira.mercado.pedidoPublico = false;
  carreira.mercado.ultimaCobrancaPapel = undefined;
  registrarNegociacao(
    carreira,
    destino.id,
    "Transferência concluída. Contrato assinado.",
    proposta.id,
    proposta,
  );
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

export function efetivarPreContratos(estado: EstadoCarreira): EstadoCarreira {
  let c = estado;
  for (const p of estado.propostas.filter(
    (p) =>
      p.status === "aceita" &&
      p.etapa === "acordo" &&
      p.efetivarEm &&
      p.efetivarEm <= estado.dataAtual,
  )) {
    const copia = structuredClone(c);
    const oferta = copia.propostas.find((x) => x.id === p.id)!;
    oferta.status = "pendente";
    oferta.etapa = "proposta_jogador";
    oferta.validade = copia.dataAtual;
    try {
      c = responderProposta(copia, p.id, true);
    } catch {
      c = structuredClone(c);
      c.propostas.find((x) => x.id === p.id)!.status = "expirada";
      registrarNegociacao(
        c,
        p.clubeId,
        "O pré-contrato não pôde ser efetivado: vínculo ou condições financeiras mudaram.",
        p.id,
      );
    }
  }
  return c;
}
