import { atualizarVinculoAcompanhamento, atualizarObjetivoPessoal } from "../carreira/acompanhamento";
import {
  estaSemClube,
  limparEstadoAgenteLivre,
  podeRegistrarAgenteLivreImediato,
  tornarAgenteLivre,
} from "../carreira/agente-livre";
import {
  avancarInteresses,
  processarContrapropostas,
  avaliarPapelPrometido,
  registrarNegociacao,
  tetoSalario,
} from "./mercado-progressivo";
import { aplicarAssinaturaContrato } from "./contratos";
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
  clubeDoContrato,
  clubesDePaisesDiferentes,
} from "./pais-clube";
import {
  clubePodePagar,
  interesseEmJogador,
  ligaDoClube,
  papelPrometidoPara,
  proximaAberturaJanela,
  reputacaoCompativel,
  resolverJanela,
} from "./necessidade";

function temAcordoAgendado(carreira: EstadoCarreira, excetoId?: string) {
  return carreira.propostas.some(
    (p) =>
      p.id !== excetoId &&
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro"),
  );
}

function encerrarNegociacoesIncompativeis(
  carreira: EstadoCarreira,
  manterClubeId: string,
  manterPropostaId: string,
) {
  for (const outra of carreira.propostas) {
    if (
      outra.id !== manterPropostaId &&
      outra.tipo !== "renovacao" &&
      (outra.status === "pendente" ||
        (outra.status === "aceita" &&
          (outra.etapa === "acordo" || outra.etapa === "acordo_futuro")))
    ) {
      outra.status = "expirada";
      outra.etapa = "cancelada";
    }
  }
  for (const interesse of carreira.mercado.interesses) {
    if (interesse.clubeId !== manterClubeId) interesse.status = "encerrado";
  }
}

function sincronizarLigaAoClube(carreira: EstadoCarreira, destinoId: string) {
  const destino = carreira.clubes.find((c) => c.id === destinoId);
  if (!destino) return;
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
  } else {
    carreira.liga =
      carreira.ligas.find((l) => l.id === destino.ligaId) ?? carreira.liga;
  }
}

export function processarRetornoEmprestimo(carreira: EstadoCarreira): void {
  const emp = carreira.mercado?.emprestimo;
  if (!emp || emp.retornoEm > carreira.dataAtual) return;
  const origem = carreira.clubes.find((c) => c.id === emp.clubeOrigemId);
  if (!origem) {
    delete carreira.mercado.emprestimo;
    return;
  }
  const deId = carreira.clubeAtualId;
  // Contrato de origem já acabou: encerra empréstimo sem restaurar vínculo inexistente.
  if (carreira.jogador.contrato.dataTermino < carreira.dataAtual) {
    delete carreira.mercado.emprestimo;
    carreira.mercado.disponivelParaEmprestimo = false;
    carreira.mercado.pediuEmprestimo = false;
    if (!estaSemClube(carreira))
      tornarAgenteLivre(carreira, "fim_emprestimo_sem_contrato");
    registrarNegociacao(
      carreira,
      origem.id,
      `O empréstimo encerrou e o contrato com o ${origem.nome} já havia terminado. Você está sem clube.`,
    );
    return;
  }
  sincronizarLigaAoClube(carreira, origem.id);
  carreira.clubeAtualId = origem.id;
  delete carreira.mercado.emprestimo;
  atualizarVinculoAcompanhamento(carreira, carreira.clubes.find(c => c.id === deId)?.pais);
  carreira.mercado.disponivelParaEmprestimo = false;
  carreira.mercado.pediuEmprestimo = false;
  carreira.mercado.respostaDiretoriaEmprestimo = undefined;
  registrarNegociacao(
    carreira,
    origem.id,
    `Empréstimo encerrado. Você retornou ao ${origem.nome}.`,
  );
  registrarEvento(
    carreira,
    "retorno-emprestimo",
    `Retorno ao ${origem.nome}`,
    `O período de empréstimo em ${carreira.clubes.find((c) => c.id === deId)?.nome ?? "outro clube"} terminou.`,
    "Agente",
  );
}

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
  if (carreira.aposentado) return;
  processarRetornoEmprestimo(carreira);
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
    !estaSemClube(carreira) &&
    carreira.clubeAtualId &&
    !carreira.mercado.pediuSaida &&
    !carreira.mercado.emprestimo &&
    !temAcordoAgendado(carreira) &&
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
  avancarInteresses(carreira, aleatorio);
  avaliarPapelPrometido(carreira);
}

export function responderProposta(
  estado: EstadoCarreira,
  id: string,
  aceitar: boolean,
  opcoes?: { forcarImediato?: boolean },
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
  if (carreira.aposentado)
    throw new Error("Sua carreira profissional já foi encerrada.");
  if (
    aceitar &&
    (proposta.contrapropostaPendente ||
      !["proposta_jogador", "negociacao"].includes(proposta.etapa))
  )
    throw new Error("Aguarde uma oferta contratual formal antes de aceitar.");
  if (aceitar && temAcordoAgendado(carreira, proposta.id))
    throw new Error(
      "Você já possui um acordo definitivo e deve cumprir o compromisso.",
    );
  if (aceitar && proposta.preContrato) {
    const dono = clubeDoContrato(carreira);
    const destinoPre = carreira.clubes.find((cl) => cl.id === proposta.clubeId);
    if (
      !proposta.efetivarEm ||
      proposta.valorTransferencia !== 0 ||
      proposta.efetivarEm <= carreira.jogador.contrato.dataTermino ||
      (Date.parse(carreira.jogador.contrato.dataTermino) -
        Date.parse(carreira.dataAtual)) /
        86400000 >
        180 ||
      !dono ||
      !destinoPre ||
      !clubesDePaisesDiferentes(dono, destinoPre)
    )
      throw new Error(
        "Este pré-contrato não atende às condições de contratação internacional ao fim do vínculo.",
      );
  }
  if (
    aceitar &&
    proposta.preContrato &&
    proposta.efetivarEm &&
    proposta.efetivarEm > carreira.dataAtual
  ) {
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
    encerrarNegociacoesIncompativeis(carreira, proposta.clubeId, proposta.id);
    registrarNegociacao(
      carreira,
      proposta.clubeId,
      `Pré-contrato assinado. A chegada está prevista para ${proposta.efetivarEm}.`,
      proposta.id,
      proposta,
    );
    return carreira;
  }
  if (!aceitar) {
    proposta.status = "rejeitada";
    proposta.etapa = "rejeicao";
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
    if (estaSemClube(carreira))
      throw new Error(
        "Você está sem clube e não pode renovar um contrato inexistente.",
      );
    proposta.status = "aceita";
    proposta.etapa = "aceite";
    const atual = carreira.clubes.find(
      (cl) => cl.id === carreira.clubeAtualId,
    );
    if (
      !atual ||
      carreira.mercado.emprestimo ||
      proposta.clubeId !== j.contrato.clubeId ||
      proposta.clubeId !== atual.id ||
      proposta.salario > tetoSalario(atual)
    )
      throw new Error("A renovação não cabe na folha do clube atual.");
    const bonusGol = proposta.bonusGol ?? j.contrato.bonusGol;
    const luvas = proposta.luvas;
    aplicarAssinaturaContrato(carreira, proposta);
    j.contrato = {
      ...j.contrato,
      bonusGol,
      ...(luvas !== undefined ? { luvas } : {}),
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
    atualizarObjetivoPessoal(carreira);
    return carreira;
  }
  const destino = carreira.clubes.find((c) => c.id === proposta.clubeId);
  if (!destino) throw new Error("Clube da proposta não encontrado.");
  if (
    !estaSemClube(carreira) &&
    proposta.clubeOrigemId &&
    proposta.clubeOrigemId !== carreira.clubeAtualId &&
    !carreira.mercado.emprestimo
  )
    throw new Error("Esta negociação pertence ao seu clube anterior.");

  const janelaFechada = resolverJanela(carreira.dataAtual) === "fechada";
  const livre = podeRegistrarAgenteLivreImediato(carreira);
  const contratoExpirado = j.contrato.dataTermino < carreira.dataAtual;
  // Agente livre ou contrato já encerrado: registro imediato (centraliza exceção de janela).
  // forcarImediato: data de apresentação já chegou (efetivarPreContratos).
  const agendar =
    !opcoes?.forcarImediato &&
    janelaFechada &&
    !proposta.preContrato &&
    !livre &&
    !contratoExpirado &&
    (proposta.tipo === "transferencia" || proposta.tipo === "emprestimo");

  if (proposta.tipo === "emprestimo") {
    if (livre)
      throw new Error("Empréstimo exige vínculo com um clube proprietário.");
    if (carreira.mercado.emprestimo)
      throw new Error("Você já está em um período de empréstimo.");
    const percentual = proposta.percentualSalario ?? 0.5;
    const custo =
      proposta.salario * percentual * 52 + (proposta.luvas ?? 0);
    if (custo > destino.orcamento || proposta.salario * percentual > tetoSalario(destino))
      throw new Error(
        "O clube não possui orçamento e folha disponíveis para o empréstimo.",
      );
    if (agendar) {
      proposta.status = "aceita";
      proposta.etapa = "acordo_futuro";
      proposta.acordoFuturo = true;
      proposta.efetivarEm = proximaAberturaJanela(carreira.dataAtual);
      encerrarNegociacoesIncompativeis(carreira, proposta.clubeId, proposta.id);
      registrarNegociacao(
        carreira,
        destino.id,
        `Empréstimo acertado com o ${destino.nome}. Apresentação prevista para ${formatarDataCurta(proposta.efetivarEm)}.`,
        proposta.id,
        proposta,
      );
      return carreira;
    }
    return efetivarEmprestimoUsuario(carreira, proposta, destino);
  }

  // Transferência: agente livre = taxa 0; clube ainda pode rejeitar por folha/orçamento.
  const valor = livre
    ? 0
    : (proposta.valorTransferencia ?? Math.round(j.valorMercado * 0.5));
  if (
    valor + proposta.salario * 52 + (proposta.luvas ?? 0) > destino.orcamento ||
    proposta.salario > tetoSalario(destino)
  )
    throw new Error(
      "O clube não possui orçamento e folha disponíveis para estes termos.",
    );

  if (agendar) {
    proposta.status = "aceita";
    proposta.etapa = "acordo_futuro";
    proposta.acordoFuturo = true;
    proposta.efetivarEm = proximaAberturaJanela(carreira.dataAtual);
    encerrarNegociacoesIncompativeis(carreira, proposta.clubeId, proposta.id);
    registrarNegociacao(
      carreira,
      destino.id,
      `Transferência acertada para o ${destino.nome}. Apresentação prevista para ${formatarDataCurta(proposta.efetivarEm)}.`,
      proposta.id,
      proposta,
    );
    registrarEvento(
      carreira,
      "acordo-futuro",
      `Acordo com o ${destino.nome}`,
      `Você permanece no clube atual até ${formatarDataCurta(proposta.efetivarEm)}.`,
      "Agente",
    );
    return carreira;
  }

  proposta.status = "aceita";
  proposta.etapa = "aceite";
  destino.orcamento -= valor + (proposta.luvas ?? 0);
  sincronizarLigaAoClube(carreira, destino.id);
  const origem = carreira.clubeAtualId
    ? carreira.clubes.find((c) => c.id === carreira.clubeAtualId)
    : undefined;
  if (origem) {
    origem.orcamento += valor;
    reescalarClube(origem);
    sincronizarForcaClube(origem);
  }
  if (origem && !livre) {
    carreira.historicoContratos = [
      ...carreira.historicoContratos,
      {
        clubeId: j.contrato.clubeId,
        salario: j.contrato.salario,
        dataInicio: j.contrato.dataInicio,
        dataTermino: carreira.dataAtual,
        papelEsperado: j.contrato.papelEsperado,
        tipo: j.contrato.tipo,
        motivoSaida: "transferencia" as const,
      },
    ].slice(-20);
  }
  carreira.clubeAtualId = destino.id;
  carreira.ultimoClubeId = origem?.id ?? carreira.ultimoClubeId;
  limparEstadoAgenteLivre(carreira);
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
  carreira.relacionamentos.diretoria = 50;
  carreira.transferenciasRecentes.unshift({
    id: `user-${proposta.id}`,
    jogadorId: "usuario",
    nomeJogador: `${j.nome} ${j.sobrenome}`,
    deClubeId: origem?.id ?? carreira.ultimoClubeId ?? carreira.clubeInicialId,
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
  proposta.acordoFuturo = false;
  proposta.valorTransferencia = valor;
  encerrarNegociacoesIncompativeis(carreira, destino.id, proposta.id);
  carreira.mercado.pediuSaida = false;
  carreira.mercado.statusPedidoSaida = "nenhum";
  carreira.mercado.pedidoPublico = false;
  carreira.mercado.pediuEmprestimo = false;
  carreira.mercado.disponivelParaEmprestimo = false;
  carreira.mercado.respostaDiretoriaSaida = undefined;
  carreira.mercado.respostaDiretoriaEmprestimo = undefined;
  carreira.mercado.respostaSaidaLida = true;
  carreira.mercado.respostaEmprestimoLida = true;
  carreira.mercado.ultimaCobrancaPapel = undefined;
  delete carreira.mercado.emprestimo;
  registrarNegociacao(
    carreira,
    destino.id,
    livre
      ? "Contrato assinado como agente livre. Sem taxa de transferência."
      : "Transferência concluída. Contrato assinado.",
    proposta.id,
    proposta,
  );
  registrarEvento(
    carreira,
    livre ? "novo-clube" : "transferencia",
    `${j.nome} assina com o ${destino.nome}`,
    livre
      ? `Agente livre. Papel prometido: ${proposta.papelPrometido}. Taxa: €0.`
      : `Papel prometido: ${proposta.papelPrometido}.`,
    "Agente",
  );
  atualizarVinculoAcompanhamento(carreira, origem?.pais);
  return carreira;
}

function formatarDataCurta(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function efetivarEmprestimoUsuario(
  carreira: EstadoCarreira,
  proposta: NonNullable<EstadoCarreira["propostas"][number]>,
  destino: NonNullable<EstadoCarreira["clubes"][number]>,
): EstadoCarreira {
  if (!carreira.clubeAtualId)
    throw new Error("Empréstimo exige vínculo com um clube proprietário.");
  const origemId = carreira.clubeAtualId;
  const percentual = proposta.percentualSalario ?? 0.5;
  const retornoEm =
    proposta.efetivarEm && proposta.acordoFuturo
      ? somarDias(carreira.dataAtual, Math.max(180, proposta.duracaoAnos * 365))
      : somarDias(carreira.dataAtual, Math.max(180, proposta.duracaoAnos * 365));
  destino.orcamento = Math.max(
    0,
    destino.orcamento - Math.round(proposta.salario * percentual * 26),
  );
  sincronizarLigaAoClube(carreira, destino.id);
  carreira.clubeAtualId = destino.id;
  carreira.jogador.status = proposta.papelPrometido ?? "rotacao";
  carreira.jogador.confianca = 55;
  carreira.relacionamentos.treinador = 50;
  carreira.mercado.emprestimo = {
    clubeOrigemId: origemId,
    retornoEm,
    percentualSalario: percentual,
  };
  carreira.mercado.disponivelParaEmprestimo = false;
  carreira.mercado.pediuEmprestimo = false;
  proposta.status = "aceita";
  proposta.etapa = "concluida";
  proposta.acordoFuturo = false;
  encerrarNegociacoesIncompativeis(carreira, destino.id, proposta.id);
  carreira.transferenciasRecentes.unshift({
    id: `loan-${proposta.id}`,
    jogadorId: "usuario",
    nomeJogador: `${carreira.jogador.nome} ${carreira.jogador.sobrenome}`,
    deClubeId: origemId,
    paraClubeId: destino.id,
    valor: 0,
    salario: proposta.salario,
    duracaoAnos: proposta.duracaoAnos,
    papelPrometido: proposta.papelPrometido,
    etapa: "concluida",
    data: carreira.dataAtual,
    aoUsuario: true,
  });
  registrarNegociacao(
    carreira,
    destino.id,
    `Empréstimo concluído até ${formatarDataCurta(retornoEm)}. O contrato original permanece com o clube de origem.`,
    proposta.id,
    proposta,
  );
  registrarEvento(
    carreira,
    "emprestimo",
    `${carreira.jogador.nome} é emprestado ao ${destino.nome}`,
    `Retorno previsto para ${formatarDataCurta(retornoEm)}.`,
    "Agente",
  );
  atualizarVinculoAcompanhamento(carreira, carreira.clubes.find(c => c.id === origemId)?.pais);
  return carreira;
}

export type { StatusElenco };

export function efetivarPreContratos(estado: EstadoCarreira): EstadoCarreira {
  let c = estado;
  for (const p of estado.propostas.filter(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro") &&
      p.efetivarEm &&
      p.efetivarEm <= estado.dataAtual,
  )) {
    const copia = structuredClone(c);
    const oferta = copia.propostas.find((x) => x.id === p.id)!;
    oferta.status = "pendente";
    oferta.etapa = "proposta_jogador";
    oferta.validade = copia.dataAtual;
    oferta.acordoFuturo = false;
    // Ao efetivar, vira contratação imediata (agente livre ou transferência).
    oferta.preContrato = false;
    delete oferta.efetivarEm;
    try {
      c = responderProposta(copia, p.id, true, { forcarImediato: true });
    } catch {
      c = structuredClone(c);
      c.propostas.find((x) => x.id === p.id)!.status = "expirada";
      registrarNegociacao(
        c,
        p.clubeId,
        "O acordo não pôde ser efetivado: vínculo ou condições financeiras mudaram.",
        p.id,
      );
    }
  }
  return c;
}

export function aposentarJogador(estado: EstadoCarreira): EstadoCarreira {
  if (estado.aposentado)
    throw new Error("Esta carreira já está encerrada.");
  const carreira = structuredClone(estado);
  carreira.mercado ??= criarMercado();
  carreira.aposentado = true;
  carreira.dataAposentadoria = carreira.dataAtual;
  carreira.idadeAposentadoria = carreira.jogador.idade;
  carreira.clubeFinalId = carreira.clubeAtualId ?? carreira.ultimoClubeId ?? undefined;
  for (const p of carreira.propostas) {
    if (p.status === "pendente") {
      p.status = "expirada";
      p.etapa = "cancelada";
    }
  }
  for (const i of carreira.mercado.interesses) i.status = "encerrado";
  registrarNegociacao(
    carreira,
    carreira.clubeAtualId ?? carreira.ultimoClubeId ?? carreira.clubeInicialId,
    "Você confirmou a aposentadoria. Sua carreira profissional foi encerrada.",
  );
  registrarEvento(
    carreira,
    "aposentadoria",
    `${carreira.jogador.nome} se aposenta`,
    `Aos ${carreira.jogador.idade} anos, no ${carreira.clubes.find((c) => c.id === (carreira.clubeAtualId ?? carreira.ultimoClubeId))?.nome ?? "clube"}. O histórico permanece disponível.`,
    "Agente",
  );
  return carreira;
}
