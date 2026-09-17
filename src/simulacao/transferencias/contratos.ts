import type { EstadoCarreira, StatusElenco } from "@/dominio/entidades/modelos";
import type { AcompanhamentoCarreira } from "@/dominio/desenvolvimento";
import { tetoSalario, registrarNegociacao } from "./mercado-progressivo";
import { somarDias } from "@/utilitarios/formatacao";
import { registrarEvento } from "../eventos/eventos";

export type TipoPedidoContrato =
  AcompanhamentoCarreira["pedidosContrato"][number]["tipo"];
export interface PedidoContrato {
  tipo: TipoPedidoContrato;
  salario: number;
  duracaoAnos: number;
  papel: StatusElenco;
  clausula?: number;
}

export const IMPORTANCIA_PAPEL: Record<StatusElenco, number> = {
  "categoria de base": 0,
  promessa: 1,
  reserva: 2,
  rotacao: 3,
  titular: 4,
  "jogador importante": 5,
  "estrela do time": 6,
};

const PAPEIS_PROFISSIONAIS: StatusElenco[] = [
  "promessa",
  "reserva",
  "rotacao",
  "titular",
  "jogador importante",
  "estrela do time",
];

/** Anos restantes do vínculo atual (mín. 1 se ainda vigente). */
export function anosRestantesContrato(
  dataAtual: string,
  dataTermino: string,
): number {
  const dias = (Date.parse(dataTermino) - Date.parse(dataAtual)) / 86400000;
  if (dias <= 0) return 1;
  return Math.max(1, Math.min(5, Math.ceil(dias / 365)));
}

export function solicitarContrato(
  estado: EstadoCarreira,
  pedido: PedidoContrato,
): EstadoCarreira {
  if (
    !Number.isFinite(pedido.salario) ||
    pedido.salario <= 0 ||
    !Number.isInteger(pedido.duracaoAnos) ||
    pedido.duracaoAnos < 1 ||
    pedido.duracaoAnos > 5 ||
    !Object.hasOwn(IMPORTANCIA_PAPEL, pedido.papel) ||
    !["renovacao", "aumento", "extensao", "papel", "clausula"].includes(
      pedido.tipo,
    ) ||
    (pedido.clausula !== undefined &&
      (!Number.isFinite(pedido.clausula) || pedido.clausula <= 0))
  )
    throw new Error(
      "Informe salário positivo, prazo entre um e cinco anos e termos válidos.",
    );
  if (estado.aposentado)
    throw new Error("Esta carreira já foi encerrada.");
  if (
    estado.jogador.categoria === "profissional" &&
    pedido.papel === "categoria de base"
  )
    throw new Error(
      "Jogador profissional não pode solicitar papel de categoria de base.",
    );

  const c = structuredClone(estado);
  const a = c.acompanhamento;
  const j = c.jogador;
  if (a.proximoPedidoContrato && a.proximoPedidoContrato > c.dataAtual)
    throw new Error(
      `Nova conversa contratual possível em aproximadamente ${Math.ceil((Date.parse(a.proximoPedidoContrato) - Date.parse(c.dataAtual)) / 604800000)} semana(s).`,
    );

  const clube = c.clubes.find((cl) => cl.id === j.contrato.clubeId)!;
  const dias =
    (Date.parse(j.contrato.dataTermino) - Date.parse(c.dataAtual)) / 86400000;
  const resto = anosRestantesContrato(c.dataAtual, j.contrato.dataTermino);
  const media = j.notasRecentes.length
    ? j.notasRecentes.reduce((s, n) => s + n, 0) / j.notasRecentes.length
    : 6.5;
  const faixa = Math.max(
    j.contrato.salario,
    j.overall * 25 * (0.7 + IMPORTANCIA_PAPEL[j.status] * 0.2),
  );
  const interesse = c.mercado.interesses.some(
    (i) => i.status === "negociando" || i.status === "sondagem",
  );
  const teto = Math.min(
    tetoSalario(clube),
    Math.round(
      faixa *
        (1 +
          Math.max(0, media - 6.5) * 0.1 +
          j.reputacao * 0.001 +
          (dias < 180 ? 0.15 : 0) +
          (interesse ? 0.08 : 0) +
          (c.relacionamentos.diretoria - 50) * 0.001 +
          (j.idade < 24 ? 0.04 : 0)),
    ),
  );

  let status: AcompanhamentoCarreira["pedidosContrato"][number]["status"] =
    "negado";
  let resposta: string;
  let propostaId: string | undefined;

  if (j.categoria === "base") {
    status = "adiado";
    resposta =
      "A diretoria quer concluir sua avaliação na base antes de discutir um contrato profissional. Continue treinando e acompanhe o parecer da comissão.";
  } else if (c.mercado.emprestimo) {
    status = "adiado";
    resposta =
      "Seu contrato pertence ao clube de origem. O agente propõe retomar a negociação após o empréstimo; seu vínculo atual permanece preservado.";
  } else if (
    c.propostas.some(
      (p) =>
        p.tipo === "renovacao" &&
        p.status === "pendente" &&
        p.validade >= c.dataAtual,
    )
  ) {
    status = "adiado";
    resposta =
      "Já existe uma proposta de renovação aguardando resposta. Seu agente recomenda avaliar os termos antes de abrir outra conversa.";
  } else if (tetoSalario(clube) < j.contrato.salario || clube.orcamento <= 0) {
    resposta =
      "A diretoria não tem orçamento disponível para ampliar este compromisso salarial.";
  } else if (
    (pedido.tipo === "aumento" || pedido.tipo === "renovacao") &&
    pedido.salario > Math.max(teto, j.contrato.salario) * 2
  ) {
    resposta = `O pedido salarial é incompatível com sua faixa atual. Seu agente recomenda termos mais próximos de €${Math.round(teto).toLocaleString("pt-BR")}/semana.`;
  } else if (
    (pedido.tipo === "papel" || pedido.tipo === "renovacao") &&
    IMPORTANCIA_PAPEL[pedido.papel] > IMPORTANCIA_PAPEL[j.status] + 2
  ) {
    resposta = `O papel solicitado está distante da sua participação atual (${j.status}).`;
  } else if (dias > 1095 && pedido.tipo === "renovacao") {
    resposta =
      "Seu contrato ainda possui mais de três anos. A diretoria não vê necessidade de uma renovação completa agora.";
  } else if (dias > 1095 && pedido.tipo === "extensao") {
    resposta =
      "Seu vínculo já é longo. A diretoria prefere reavaliar a extensão mais perto do fim do contrato.";
  } else if (
    pedido.tipo === "clausula" &&
    (pedido.clausula === undefined || pedido.clausula < j.valorMercado * 0.8)
  ) {
    resposta =
      "A cláusula solicitada não protege o valor esportivo do jogador para o clube.";
  } else if (pedido.tipo === "aumento" && pedido.salario <= j.contrato.salario) {
    resposta =
      "Um aumento precisa superar o salário atual. Ajuste o valor com seu agente.";
  } else if (
    pedido.tipo === "papel" &&
    pedido.papel === j.contrato.papelEsperado
  ) {
    resposta = "O papel solicitado já está previsto no contrato atual.";
  } else {
    const papelAtual = j.contrato.papelEsperado;
    let salario = j.contrato.salario;
    let papel = papelAtual;
    let duracao = resto;
    let clausula = j.contrato.clausulaRescisao;
    let alteraDuracao = false;

    if (pedido.tipo === "aumento") {
      salario = Math.min(pedido.salario, teto);
      // Mantém duração/papel do vínculo vigente; assinatura não estende.
    } else if (pedido.tipo === "extensao") {
      duracao = pedido.duracaoAnos;
      alteraDuracao = true;
      if (pedido.salario > j.contrato.salario * 1.05)
        salario = Math.min(pedido.salario, teto);
    } else if (pedido.tipo === "papel") {
      papel =
        IMPORTANCIA_PAPEL[pedido.papel] > IMPORTANCIA_PAPEL[j.status] + 1
          ? j.status
          : pedido.papel;
      if (!PAPEIS_PROFISSIONAIS.includes(papel) && j.categoria === "profissional")
        papel = j.status === "categoria de base" ? "promessa" : j.status;
    } else if (pedido.tipo === "clausula") {
      clausula = pedido.clausula;
    } else {
      // renovação completa: prazo pedido a partir da assinatura
      salario = Math.min(pedido.salario, teto);
      papel =
        IMPORTANCIA_PAPEL[pedido.papel] > IMPORTANCIA_PAPEL[j.status] + 1
          ? j.status
          : pedido.papel;
      if (papel === "categoria de base" && j.categoria === "profissional")
        papel = j.status === "categoria de base" ? "promessa" : j.status;
      duracao = pedido.duracaoAnos;
      alteraDuracao = true;
      clausula = pedido.clausula ?? j.contrato.clausulaRescisao;
    }

    if (alteraDuracao && duracao > 5) {
      resposta = "A duração solicitada não é compatível com o vínculo atual.";
    } else {
      const divergiu =
        (pedido.tipo === "aumento" && salario < pedido.salario) ||
        (pedido.tipo === "papel" && papel !== pedido.papel) ||
        (pedido.tipo === "extensao" && duracao !== pedido.duracaoAnos) ||
        (pedido.tipo === "renovacao" &&
          (salario < pedido.salario ||
            papel !== pedido.papel ||
            duracao !== pedido.duracaoAnos)) ||
        (pedido.tipo === "clausula" && clausula !== pedido.clausula);
      status = divergiu ? "contraproposta" : "aceito";
      propostaId = `pedido-contrato-${c.dataAtual}-${a.pedidosContrato.length}`;
      c.propostas.push({
        id: propostaId,
        clubeId: clube.id,
        tipo: "renovacao",
        salario,
        duracaoAnos: duracao,
        papelPrometido: papel,
        clausulaRescisao: clausula,
        etapa: "proposta_jogador",
        data: c.dataAtual,
        validade: somarDias(c.dataAtual, 28),
        status: "pendente",
      });
      const trechos: string[] = [];
      if (pedido.tipo === "aumento" || pedido.tipo === "renovacao")
        trechos.push(`€${salario.toLocaleString("pt-BR")} por semana`);
      if (pedido.tipo === "extensao" || pedido.tipo === "renovacao")
        trechos.push(`${duracao} ano(s) a partir da assinatura`);
      if (pedido.tipo === "papel" || pedido.tipo === "renovacao")
        trechos.push(`papel de ${papel}`);
      if (pedido.tipo === "clausula")
        trechos.push(
          `cláusula de €${(clausula ?? 0).toLocaleString("pt-BR")}`,
        );
      if (pedido.tipo === "aumento")
        trechos.push("duração e papel do contrato atual preservados");
      if (pedido.tipo === "papel")
        trechos.push("salário e prazo atuais preservados");
      if (pedido.tipo === "clausula")
        trechos.push("salário, prazo e papel preservados");
      resposta = `${status === "aceito" ? "A diretoria aceitou os termos para assinatura" : "A diretoria apresentou uma contraproposta"}: ${trechos.join("; ")}. Seu agente encaminhou a proposta; confirme para assinar.`;
    }
  }

  a.pedidosContrato = [
    ...a.pedidosContrato,
    {
      data: c.dataAtual,
      clubeId: clube.id,
      tipo: pedido.tipo,
      status,
      resposta,
      ...(propostaId ? { propostaId } : {}),
    },
  ].slice(-20);
  a.proximoPedidoContrato = somarDias(
    c.dataAtual,
    status === "adiado" ? 28 : 42,
  );
  registrarNegociacao(c, clube.id, resposta, propostaId);
  registrarEvento(
    c,
    "diretoria",
    `Resposta contratual: ${status}`,
    resposta,
    "Diretoria",
    false,
  );
  return c;
}

/** Aplica só os campos negociados conforme o tipo do pedido de origem. */
export function aplicarAssinaturaContrato(
  carreira: EstadoCarreira,
  proposta: {
    id: string;
    salario: number;
    duracaoAnos: number;
    papelPrometido: StatusElenco;
    clausulaRescisao?: number;
  },
): void {
  const j = carreira.jogador;
  const tipo =
    carreira.acompanhamento.pedidosContrato.find(
      (p) => p.propostaId === proposta.id,
    )?.tipo ?? "renovacao";

  if (tipo === "aumento") {
    j.contrato = { ...j.contrato, salario: proposta.salario };
    return;
  }
  if (tipo === "papel") {
    j.contrato = {
      ...j.contrato,
      papelEsperado: proposta.papelPrometido,
    };
    if (proposta.papelPrometido !== "categoria de base")
      j.status = proposta.papelPrometido;
    return;
  }
  if (tipo === "clausula") {
    j.contrato = {
      ...j.contrato,
      clausulaRescisao: proposta.clausulaRescisao,
    };
    return;
  }
  // extensao e renovacao: novo prazo a partir da assinatura
  j.contrato = {
    ...j.contrato,
    salario: proposta.salario,
    dataInicio: carreira.dataAtual,
    dataTermino: somarDias(carreira.dataAtual, proposta.duracaoAnos * 365),
    papelEsperado: proposta.papelPrometido ?? j.status,
    clausulaRescisao: proposta.clausulaRescisao,
  };
  if (
    proposta.papelPrometido &&
    proposta.papelPrometido !== "categoria de base"
  )
    j.status = proposta.papelPrometido;
}
