import type {
  Clube,
  EstadoCarreira,
  PropostaTransferencia,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import {
  criarMercado,
  PAPEIS_MERCADO,
  marcarNovidadeStatusInteresse,
  type InteresseClube,
  type PreferenciasCarreira,
  type TermosContrato,
} from "@/dominio/mercado";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { registrarEvento } from "../eventos/eventos";
import { somarEstatisticas } from "../temporada/estatisticas";
import {
  avaliarNecessidadeElenco,
  ligaDoClube,
  pesoFrequenciaPropostas,
  resolverJanela,
} from "./necessidade";
import { avaliarHierarquia } from "../elenco/hierarquia";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
import {
  clubeDoContrato,
  clubesDePaisesDiferentes,
} from "./pais-clube";

const LIMIAR_ELEGIBILIDADE = 38;
const MAX_NOVOS_INTERESSES_SEMANA = 2;

const diasContrato = (c: EstadoCarreira) =>
  estaSemClube(c)
    ? 0
    : Math.ceil(
        (Date.parse(c.jogador.contrato.dataTermino) - Date.parse(c.dataAtual)) /
          86400000,
      );

/** Clube de referência para histórico de negociação (último vínculo se livre). */
function clubeRefHistorico(c: EstadoCarreira): string {
  return c.clubeAtualId ?? c.ultimoClubeId ?? c.clubeInicialId;
}

function temAcordoAtivo(c: EstadoCarreira) {
  return c.propostas.some(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro"),
  );
}

export function normalizarTermosContrato(
  termos: TermosContrato | PropostaTransferencia | Record<string, unknown>,
): TermosContrato | undefined {
  if (!termos || typeof termos !== "object") return undefined;
  const salario = Number((termos as TermosContrato).salario);
  const duracaoAnos = Number((termos as TermosContrato).duracaoAnos);
  const papelPrometido = (termos as TermosContrato).papelPrometido;
  if (
    !Number.isFinite(salario) ||
    salario <= 0 ||
    !Number.isInteger(duracaoAnos) ||
    duracaoAnos < 1 ||
    duracaoAnos > 5 ||
    !PAPEIS_MERCADO.includes(papelPrometido)
  )
    return undefined;
  const clausula = (termos as TermosContrato).clausulaRescisao;
  return {
    salario,
    duracaoAnos,
    papelPrometido,
    ...(typeof clausula === "number" && clausula > 0
      ? { clausulaRescisao: clausula }
      : {}),
  };
}

export function avaliarPedidoSaidaDiretoria(c: EstadoCarreira): {
  aceitaNegociar: boolean;
  resposta: string;
} {
  if (estaSemClube(c)) {
    return {
      aceitaNegociar: false,
      resposta:
        "Você já está sem clube. Não há diretoria para pedir transferência — busque um novo contrato.",
    };
  }
  const j = c.jogador;
  const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId);
  if (!clube) {
    return {
      aceitaNegociar: false,
      resposta: "Não há diretoria vinculada para analisar o pedido.",
    };
  }
  const importancia = PAPEIS_MERCADO.indexOf(j.status);
  const nec = avaliarNecessidadeElenco(clube).find(
    (n) => n.posicao === j.posicao,
  );
  const dias = diasContrato(c);
  if (
    importancia >= 4 &&
    dias > 500 &&
    c.relacionamentos.diretoria >= 45 &&
    (nec?.nivel === "alta" ||
      nec?.nivel === "critica" ||
      (nec?.quantidade ?? 0) <= 2)
  ) {
    return {
      aceitaNegociar: false,
      resposta:
        "A diretoria recusou o pedido. Considera você peça importante do elenco e quer mantê-lo até o fim do contrato.",
    };
  }
  if (importancia >= 3 && dias > 700 && c.relacionamentos.diretoria > 55) {
    return {
      aceitaNegociar: true,
      resposta:
        "A diretoria aceita apenas no fim da temporada ou se chegar uma proposta muito acima do valor de mercado.",
    };
  }
  if (c.relacionamentos.diretoria < 30 || clube.orcamento < j.valorMercado) {
    return {
      aceitaNegociar: true,
      resposta:
        "A diretoria aceita negociar e está aberta a propostas adequadas pelo seu passe.",
    };
  }
  return {
    aceitaNegociar: true,
    resposta:
      "A diretoria registrou o pedido em privado. Aceita conversar se chegar uma proposta compatível com o valor pedido.",
  };
}

export function avaliarPedidoEmprestimoDiretoria(c: EstadoCarreira): {
  aceita: boolean;
  resposta: string;
} {
  if (estaSemClube(c)) {
    return {
      aceita: false,
      resposta:
        "Sem vínculo com um clube proprietário não há empréstimo — assine um contrato primeiro.",
    };
  }
  const j = c.jogador;
  const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId);
  if (!clube) {
    return {
      aceita: false,
      resposta: "Não há diretoria vinculada para analisar o empréstimo.",
    };
  }
  const nec = avaliarNecessidadeElenco(clube).find(
    (n) => n.posicao === j.posicao,
  )!;
  const titular = ["titular", "jogador importante", "estrela do time"].includes(
    j.status,
  );
  const chegouHaPouco =
    Date.parse(c.dataAtual) - Date.parse(j.contrato.dataInicio) < 90 * 86400000;
  if (titular && nec.nivel !== "baixa") {
    return {
      aceita: false,
      resposta:
        "Seu clube recusou o pedido de empréstimo porque considera você parte importante da rotação.",
    };
  }
  if (nec.quantidade <= 1 || nec.nivel === "critica") {
    return {
      aceita: false,
      resposta:
        "A diretoria negou: o elenco está curto na posição e não há reposição imediata.",
    };
  }
  if (chegouHaPouco) {
    return {
      aceita: false,
      resposta:
        "A diretoria pediu para reavaliar mais adiante: você acabou de chegar ao clube.",
    };
  }
  if (
    j.idade <= 23 ||
    j.status === "promessa" ||
    j.status === "reserva" ||
    j.overall < clube.forcaGeral - 4
  ) {
    return {
      aceita: true,
      resposta:
        "A diretoria autorizou disponibilizá-lo para empréstimo. Clubes compatíveis poderão fazer propostas.",
    };
  }
  if (c.relacionamentos.diretoria >= 55 && !titular) {
    return {
      aceita: true,
      resposta:
        "A diretoria aceitou o pedido de empréstimo para você ganhar minutos.",
    };
  }
  return {
    aceita: false,
    resposta:
      "A diretoria quer reavaliar na próxima janela e negou o empréstimo por enquanto.",
  };
}
export function registrarNegociacao(
  c: EstadoCarreira,
  clubeId: string,
  texto: string,
  propostaId?: string,
  termos?: TermosContrato | PropostaTransferencia,
) {
  c.mercado ??= criarMercado();
  c.mercado.historico.push({
    id: `neg-${c.mercado.historico.length}-${c.dataAtual}`,
    data: c.dataAtual,
    clubeId,
    texto,
    propostaId,
    termos: termos ? normalizarTermosContrato(termos) : undefined,
  });
  registrarEvento(
    c,
    "negociacao",
    c.clubes.find((cl) => cl.id === clubeId)?.nome ?? "Seu agente",
    texto,
    "Agente",
  );
}
export function tetoSalario(clube: Clube): number {
  return Math.max(
    0,
    Math.floor(
      Math.min(clube.poderFinanceiro * 800, (clube.orcamento * 0.25) / 52),
    ),
  );
}
export function precoPedido(c: EstadoCarreira): number {
  if (estaSemClube(c)) return 0;
  const origem = c.clubes.find((cl) => cl.id === c.clubeAtualId);
  if (!origem) return 0;
  const importancia = PAPEIS_MERCADO.indexOf(c.jogador.status);
  const listado =
    c.mercado?.statusPedidoSaida === "aceito" || c.mercado?.pediuSaida === true;
  const publico = !!c.mercado?.pedidoPublico;
  const fator =
    0.65 +
    Math.min(3, Math.max(0, diasContrato(c)) / 365) * 0.2 +
    Math.max(0, importancia - 2) * 0.12;
  const preco =
    c.jogador.valorMercado *
    fator *
    (listado ? 0.85 : 1) *
    (publico ? 0.95 : 1) *
    (origem.orcamento < c.jogador.valorMercado ? 0.8 : 1);
  return Math.round(
    Math.min(preco, c.jogador.contrato.clausulaRescisao ?? Infinity),
  );
}
export function avaliarAlvo(c: EstadoCarreira, clube: Clube) {
  const j = c.jogador;
  const nec = avaliarNecessidadeElenco(clube).find(
    (n) => n.posicao === j.posicao,
  )!;
  const stats = somarEstatisticas(
    c.registros
      .filter((r) => r.categoria === "profissional")
      .map((r) => r.estatisticas),
  );
  const recentes = j.notasRecentes;
  const nota = recentes.length
    ? recentes.reduce((a, b) => a + b, 0) / recentes.length
    : stats.jogos
      ? stats.somaNotas / stats.jogos
      : 6.5;
  // Observadores não conhecem o potencial interno exato: evidência reduz a margem de incerteza.
  const potencialPercebido = Math.max(
    j.overall,
    j.potencialInterno - Math.max(2, 10 - Math.min(8, stats.minutos / 180)),
  );
  const promessa =
    j.idade <= 21 &&
    potencialPercebido >= clube.forcaGeral + 5 &&
    j.overall >= clube.forcaGeral - 20;
  const concorrentes = clube.elenco.filter(
    (p) =>
      (p.posicaoPrincipal === j.posicao ||
        p.posicoesSecundarias.includes(j.posicao)) &&
      (!p.lesionado || (p.lesao?.diasRecuperacao ?? 0) < 60),
  );
  const melhores = concorrentes.filter((p) => p.overall >= j.overall).length;
  const pronto = j.overall >= clube.forcaGeral - 7;
  let papel: StatusElenco =
    promessa && (!pronto || melhores >= 2)
      ? "promessa"
      : melhores >= 2
        ? "reserva"
        : melhores === 1
          ? "rotacao"
          : "titular";
  if (papel === "titular" && j.overall >= clube.forcaGeral + 4)
    papel = "jogador importante";
  if (papel === "jogador importante" && j.overall >= clube.forcaGeral + 8 && j.reputacao >= 65)
    papel = "estrela do time";
  const livre = estaSemClube(c);
  const salarioRef = livre
    ? Math.max(500, j.valorMercado * 0.0015)
    : Math.max(500, j.contrato.salario * 1.1, j.valorMercado * 0.0015);
  const salario = Math.round(salarioRef);
  const donoContrato = clubeDoContrato(c);
  const preContrato =
    !livre &&
    diasContrato(c) <= 180 &&
    !!donoContrato &&
    clubesDePaisesDiferentes(donoContrato, clube);
  const custo = livre || preContrato ? 0 : precoPedido(c);
  const cabe =
    salario <= tetoSalario(clube) && custo + salario * 52 <= clube.orcamento;
  const saturado =
    melhores >= 3 || (concorrentes.length >= 4 && nec.nivel === "baixa");
  const compativel =
    pronto || (promessa && potencialPercebido >= clube.reputacao - 4);
  const necessidade = { baixa: 2, media: 12, alta: 24, critica: 34 }[nec.nivel];
  const producao = ["CA", "PD", "PE"].includes(j.posicao)
    ? stats.gols + stats.assistencias * 0.5
    : ["MEI", "MC"].includes(j.posicao)
      ? stats.assistencias + stats.gols * 0.4
      : 0;
  const excepcional = nota >= 8 && stats.minutos >= 180;
  const semanasLivre = livre ? semanasSemClube(c) : 0;
  const evidencia =
    stats.minutos >= 450 ||
    j.reputacao >= 55 ||
    (promessa && potencialPercebido >= clube.forcaGeral + 10) ||
    (nec.nivel === "critica" && pronto) ||
    (diasContrato(c) <= 180 && pronto) ||
    excepcional ||
    (livre && pronto);
  const score = limitar(
    necessidade +
      (j.overall - clube.forcaGeral) * 1.5 +
      (promessa ? 20 : 0) +
      j.reputacao * 0.2 +
      Math.min(12, stats.minutos / 90) +
      (nota - 6.5) * 8 +
      (j.forma - 50) * 0.15 +
      Math.min(10, (producao / Math.max(1, stats.minutos / 90)) * 10) +
      (c.liga.reputacao - ligaDoClube(c, clube.id).reputacao) * 0.1 +
      (livre ? 12 : 0) -
      (semanasLivre >= 8 ? Math.min(8, semanasLivre - 6) : 0),
  );
  const viavel =
    clube.id !== c.clubeAtualId &&
    compativel &&
    !saturado &&
    cabe &&
    (nec.nivel !== "baixa" || promessa || melhores === 0);
  const motivo: InteresseClube["motivo"] = nec.desfalquesLongos
    ? "lesao"
    : promessa
      ? "promessa"
      : nec.idadeMedia >= 30
        ? "sucessao"
        : diasContrato(c) <= 180
          ? "oportunidade"
          : "reforco";
  const resposta = !compativel
    ? "Sem interesse: o nível atual e o potencial observado não atendem ao elenco."
    : saturado
      ? "Sem interesse: já temos várias opções melhores na posição."
      : !cabe
        ? "Interessados apenas em empréstimo; a contratação definitiva não cabe no orçamento e na folha."
        : !viavel
          ? "Sem interesse: não identificamos necessidade nesta posição."
          : !evidencia
            ? "Estamos acompanhando, mas precisamos de mais evidências esportivas."
            : promessa
              ? "Interessados como promessa, sem garantia de titularidade."
              : "Aceitamos conversar. Vamos acompanhar sua situação antes de apresentar uma oferta.";
  return {
    viavel,
    evidencia,
    score,
    papel,
    motivo,
    resposta,
    salario,
    preContrato,
    nota,
    nec,
    potencialPercebido,
    saturado,
    compativel,
  };
}
function atendePreferencias(
  c: EstadoCarreira,
  clube: Clube,
  a: ReturnType<typeof avaliarAlvo>,
) {
  const p = c.mercado.preferencias;
  const atual =
    c.clubes.find((cl) => cl.id === c.clubeAtualId) ??
    c.clubes.find((cl) => cl.id === c.ultimoClubeId);
  const europa = c.ligas.filter((l) => l.pais !== "Brasil").map((l) => l.id);
  return (
    (!p.apenasDesejados || c.mercado.clubesDesejados.includes(clube.id)) &&
    (!p.mesmoPais || !atual || clube.pais === atual.pais) &&
    (!p.europa || europa.includes(clube.ligaId)) &&
    (!p.clubeMaior || !atual || clube.reputacao > atual.reputacao) &&
    (!p.maisMinutos || PAPEIS_MERCADO.indexOf(a.papel) >= 3) &&
    (!p.salarioMaior ||
      a.salario > (estaSemClube(c) ? 0 : c.jogador.contrato.salario)) &&
    (!p.titulos ||
      clube.reputacao >=
        Math.max(
          ...c.clubes
            .filter((cl) => cl.ligaId === clube.ligaId)
            .map((cl) => cl.reputacao),
        ) -
          5)
  );
}
function observar(
  c: EstadoCarreira,
  clube: Clube,
  origem: InteresseClube["origem"],
) {
  const a = avaliarAlvo(c, clube);
  // Jogadores já conhecidos chegam com relatórios anteriores; não há bloqueio por mês.
  const conhecido =
    a.viavel && a.evidencia && a.score >= 80 && c.jogador.reputacao >= 75;
  const i: InteresseClube = {
    clubeId: clube.id,
    jogadorId: "usuario",
    nivelInteresse: conhecido ? 65 : 0,
    motivo: a.motivo,
    semanasObservando: 0,
    status: !a.viavel ? "encerrado" : conhecido ? "sondagem" : "observando",
    ultimaAtualizacao: c.dataAtual,
    origem,
    resposta: a.resposta,
    papel: a.papel,
    reabrirEm: !a.viavel ? somarDias(c.dataAtual, 56) : undefined,
    ...(conhecido ? { novidadeEm: c.dataAtual } : {}),
  };
  c.mercado.interesses.push(i);
  registrarNegociacao(
    c,
    clube.id,
    origem === "agente"
      ? `Seu agente entrou em contato. ${a.resposta}`
      : `O clube ${conhecido ? "retomou relatórios anteriores e fez uma sondagem" : "começou a observar você"}: ${a.motivo === "lesao" ? "busca reposição por lesão" : a.motivo}.`,
  );
  return i;
}
export type AcaoAgente =
  | "contatar"
  | "buscar"
  | "sair"
  | "publicar"
  | "permanecer"
  | "bloquear"
  | "desbloquear"
  | "emprestar"
  | "cancelar-emprestimo"
  | "situacao";

export function conversarAgente(
  estado: EstadoCarreira,
  acao: AcaoAgente,
  clubeId?: string,
): EstadoCarreira {
  const c = structuredClone(estado);
  c.mercado ??= criarMercado();
  if (c.aposentado)
    throw new Error("Sua carreira profissional já foi encerrada.");

  if (acao === "situacao") {
    const interesses = c.mercado.interesses.filter((i) => i.status !== "encerrado").length;
    if (estaSemClube(c)) {
      const ultimo =
        c.clubes.find((cl) => cl.id === c.ultimoClubeId)?.nome ?? "seu último clube";
      const semanas = semanasSemClube(c);
      const mercado =
        interesses > 0
          ? `${interesses} clube(s) observam você no mercado.`
          : "Ainda não há interesse concreto — podemos buscar ou contatar clubes.";
      const texto = [
        "Seu agente analisou a situação.",
        `Você está sem clube (agente livre) desde o fim do vínculo com o ${ultimo}${semanas > 0 ? ` · ${semanas} semana(s)` : ""}.`,
        mercado,
        "Posso buscar oportunidades, contatar um clube específico ou ajustar suas preferências e expectativa salarial.",
      ].join(" ");
      registrarNegociacao(c, clubeRefHistorico(c), texto);
      return c;
    }
    const h = avaliarHierarquia(c);
    const janela = resolverJanela(c.dataAtual);
    const pedido =
      c.mercado.statusPedidoSaida === "aceito"
        ? "Há pedido de saída aceito pela diretoria."
        : c.mercado.statusPedidoSaida === "recusado"
          ? "A diretoria recusou seu pedido de saída."
          : "Não há pedido de transferência ativo.";
    const papel = h.titular
      ? "Você está na disputa pela titularidade e tem espaço real."
      : h.ordem <= 3
        ? `Você está em ${h.rotulo}. ${h.proximoPasso}`
        : `Você está atrás na hierarquia. ${h.motivo} ${h.proximoPasso}`;
    const mercado =
      interesses > 0
        ? `${interesses} clube(s) mantêm interesse ativo.`
        : janela === "fechada"
          ? "Fora da janela o mercado esfria, mas observação continua possível."
          : "Ainda não há interesse concreto no mercado.";
    const texto = [
      "Seu agente analisou a situação.",
      papel,
      pedido,
      mercado,
      c.jogador.moral < 45
        ? "Sua insatisfação está aparente. Podemos falar com a diretoria, buscar empréstimo ou abrir o mercado — diga o caminho."
        : "Se quiser pressão sobre o clube, peça transferência, empréstimo ou renegociação via contrato.",
    ].join(" ");
    registrarNegociacao(c, clubeRefHistorico(c), texto);
    return c;
  }

  if (acao === "bloquear" || acao === "desbloquear") {
    c.mercado.bloquearPropostas = acao === "bloquear";
    registrarNegociacao(c, clubeRefHistorico(c),
      acao === "bloquear"
        ? "Seu agente vai filtrar novas abordagens espontâneas. Você ainda pode pedir contato ativo com clubes."
        : "Seu agente voltou a receber propostas espontâneas em seu nome.",
    );
    return c;
  }

  if (acao === "emprestar" || acao === "cancelar-emprestimo") {
    if (estaSemClube(c))
      throw new Error(
        "Sem clube não há empréstimo. Busque um contrato pelo agente.",
      );
    if (c.jogador.categoria === "base")
      throw new Error(
        "Empréstimos profissionais só após a promoção ao time principal.",
      );
    if (c.mercado.emprestimo)
      throw new Error("Você já está emprestado; aguarde o retorno.");
    if (acao === "cancelar-emprestimo") {
      c.mercado.pediuEmprestimo = false;
      c.mercado.disponivelParaEmprestimo = false;
      c.mercado.respostaDiretoriaEmprestimo = undefined;
      c.mercado.respostaEmprestimoLida = true;
      registrarNegociacao(c, clubeRefHistorico(c),
        "Você retirou o pedido de empréstimo.",
      );
      return c;
    }
    const decisao = avaliarPedidoEmprestimoDiretoria(c);
    c.mercado.pediuEmprestimo = true;
    c.mercado.disponivelParaEmprestimo = decisao.aceita;
    c.mercado.respostaDiretoriaEmprestimo = decisao.resposta;
    c.mercado.respostaEmprestimoLida = false;
    registrarNegociacao(c, clubeRefHistorico(c), decisao.resposta);
    return c;
  }

  if (acao === "sair" || acao === "publicar" || acao === "permanecer") {
    if (estaSemClube(c) && acao !== "permanecer")
      throw new Error(
        "Você já está sem clube. Peça ao agente para buscar ou contatar clubes.",
      );
    if (acao === "permanecer") {
      c.mercado.pediuSaida = false;
      c.mercado.statusPedidoSaida = "nenhum";
      c.mercado.pedidoPublico = false;
      c.mercado.respostaDiretoriaSaida = undefined;
      c.mercado.respostaSaidaLida = true;
      registrarNegociacao(c, clubeRefHistorico(c),
        "Você decidiu permanecer e voltou a considerar renovações.",
      );
      return c;
    }
    if (acao === "sair") {
      if (c.mercado.statusPedidoSaida === "aceito") return c;
      if (c.mercado.statusPedidoSaida === "recusado")
        throw new Error(
          "A diretoria já respondeu a este pedido. Retire o pedido ou aguarde para tentar novamente.",
        );
      c.jogador.moral = limitar(c.jogador.moral - 3);
      const decisao = avaliarPedidoSaidaDiretoria(c);
      c.mercado.respostaDiretoriaSaida = decisao.resposta;
      c.mercado.respostaSaidaLida = false;
      c.mercado.pedidoPublico = false;
      if (decisao.aceitaNegociar) {
        c.mercado.pediuSaida = true;
        c.mercado.statusPedidoSaida = "aceito";
        registrarNegociacao(c, clubeRefHistorico(c),
          `Pedido privado de transferência registrado. ${decisao.resposta}`,
        );
      } else {
        c.mercado.pediuSaida = false;
        c.mercado.statusPedidoSaida = "recusado";
        registrarNegociacao(c, clubeRefHistorico(c),
          `Pedido de transferência analisado. ${decisao.resposta}`,
        );
      }
      return c;
    }
    if (c.mercado.statusPedidoSaida !== "aceito")
      throw new Error("Converse primeiro com o agente sobre sua saída.");
    if (!c.mercado.pedidoPublico) {
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 12);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 6);
      c.jogador.moral = limitar(c.jogador.moral - 2);
    }
    c.mercado.pediuSaida = true;
    c.mercado.statusPedidoSaida = "aceito";
    c.mercado.pedidoPublico = true;
    registrarNegociacao(c, clubeRefHistorico(c),
      "Seu pedido de saída se tornou público. Isso aumenta a visibilidade no mercado, mas prejudica a relação com a diretoria e o treinador.",
    );
    return c;
  }

  if (c.jogador.categoria === "base")
    throw new Error(
      "Seu agente poderá negociar após sua promoção ao profissional.",
    );
  if (temAcordoAtivo(c))
    throw new Error(
      "Você já tem um acordo definitivo. Aguarde a data da transferência.",
    );

  const candidatos =
    acao === "contatar"
      ? c.clubes.filter((cl) => cl.id === clubeId && cl.id !== c.clubeAtualId)
      : (() => {
          const avaliacoes = c.clubes
            .filter((cl) => cl.id !== c.clubeAtualId)
            .map((cl) => ({ clube: cl, a: avaliarAlvo(c, cl) }))
            .filter(({ clube, a }) => atendePreferencias(c, clube, a));
          return avaliacoes
            .sort(
              (x, y) =>
                Number(c.mercado.clubesDesejados.includes(y.clube.id)) -
                  Number(c.mercado.clubesDesejados.includes(x.clube.id)) ||
                y.a.score - x.a.score,
            )
            .slice(0, 3)
            .map((x) => x.clube);
        })();
  if (!candidatos.length) {
    if (acao === "buscar") {
      registrarNegociacao(c, clubeRefHistorico(c),
        "Seu agente não encontrou clubes com interesse concreto neste momento.",
      );
      return c;
    }
    throw new Error(
      "Nenhum clube disponível corresponde ao pedido. Revise suas preferências.",
    );
  }
  let abertos = 0;
  const nomesAbertos: string[] = [];
  for (const clube of candidatos) {
    const anterior = c.mercado.interesses.find((i) => i.clubeId === clube.id);
    if (
      anterior &&
      (anterior.status !== "encerrado" ||
        (anterior.reabrirEm ?? "") > c.dataAtual)
    ) {
      if (acao === "contatar")
        throw new Error(
          "O contato já está em andamento ou o clube pediu tempo antes de uma nova conversa.",
        );
      continue;
    }
    c.mercado.interesses = c.mercado.interesses.filter(
      (i) => i.clubeId !== clube.id,
    );
    const interesse = observar(c, clube, "agente");
    if (interesse.status !== "encerrado") {
      abertos++;
      nomesAbertos.push(clube.nome);
    }
  }
  if (acao === "buscar") {
    registrarNegociacao(c, clubeRefHistorico(c),
      abertos > 0
        ? `Seu agente abriu conversa com ${nomesAbertos.join(" e ")}.`
        : "Seu agente não encontrou clubes com interesse concreto neste momento.",
    );
  }
  return c;
}
export function definirPreferencias(
  estado: EstadoCarreira,
  preferencias: PreferenciasCarreira,
  clubesDesejados: string[],
): EstadoCarreira {
  const c = structuredClone(estado);
  c.mercado ??= criarMercado();
  for (const chave of Object.keys(
    c.mercado.preferencias,
  ) as (keyof PreferenciasCarreira)[]) {
    if (typeof preferencias[chave] !== "boolean")
      throw new Error("Preferências inválidas.");
  }
  if (
    clubesDesejados.some(
      (id) => id === c.clubeAtualId || !c.clubes.some((cl) => cl.id === id),
    )
  )
    throw new Error("Clube desejado inválido.");
  c.mercado.preferencias = { ...preferencias };
  c.mercado.clubesDesejados = [...new Set(clubesDesejados)];
  registrarNegociacao(c, clubeRefHistorico(c),
    "Seu agente atualizou as preferências para a próxima etapa da carreira.",
  );
  return c;
}
function encerrar(c: EstadoCarreira, i: InteresseClube, texto: string) {
  i.status = "encerrado";
  i.nivelInteresse = Math.max(0, i.nivelInteresse - 35);
  i.reabrirEm = somarDias(c.dataAtual, 84);
  i.resposta = texto;
  registrarNegociacao(c, i.clubeId, texto);
}
export function avaliarOfertaClube(
  c: EstadoCarreira,
  oferta: number,
): "aceitar" | "pedir-mais" | "rejeitar" {
  const pedido = precoPedido(c);
  return oferta >= pedido
    ? "aceitar"
    : oferta >= pedido * 0.7
      ? "pedir-mais"
      : "rejeitar";
}
function negociarClubes(
  c: EstadoCarreira,
  clube: Clube,
  i: InteresseClube,
  a: ReturnType<typeof avaliarAlvo>,
) {
  const livre = estaSemClube(c);
  const pre = !livre && a.preContrato && resolverJanela(c.dataAtual) === "fechada";
  const comoEmprestimo =
    !livre &&
    !pre &&
    c.mercado.disponivelParaEmprestimo &&
    a.compativel &&
    !a.saturado &&
    (a.nec.nivel !== "baixa" || !a.viavel);
  if (comoEmprestimo) {
    const percentual = 0.5;
    const custoAnual = a.salario * percentual * 52;
    if (
      custoAnual > clube.orcamento * 0.15 ||
      a.salario * percentual > tetoSalario(clube)
    ) {
      encerrar(
        c,
        i,
        "O clube analisou um empréstimo, mas não viu encaixe esportivo ou financeiro agora.",
      );
      return;
    }
    if (
      c.propostas.filter(
        (p) =>
          p.status === "pendente" &&
          (p.tipo === "transferencia" || p.tipo === "emprestimo"),
      ).length >= 2
    )
      return;
    const termos: TermosContrato = {
      salario: a.salario,
      duracaoAnos: 1,
      papelPrometido: a.papel,
    };
    const proposta: PropostaTransferencia = {
      ...termos,
      id: `emprestimo-${clube.id}-${c.dataAtual}-${c.propostas.length}`,
      clubeId: clube.id,
      clubeOrigemId: c.clubeAtualId ?? undefined,
      tipo: "emprestimo",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 21),
      status: "pendente",
      valorTransferencia: 0,
      percentualSalario: percentual,
      rodadasNegociacao: 0,
      ofertaInicial: { ...termos },
    };
    c.propostas.push(proposta);
    i.propostaId = proposta.id;
    {
      const anterior = i.status;
      i.status = "negociando";
      marcarNovidadeStatusInteresse(i, anterior, c.dataAtual);
    }
    registrarNegociacao(
      c,
      clube.id,
      "O clube apresentou uma proposta de empréstimo após avaliar necessidade e minutos prováveis.",
      proposta.id,
      termos,
    );
    return;
  }
  const pedido = livre || pre ? 0 : precoPedido(c);
  const limite = Math.max(
    0,
    Math.min(clube.orcamento - a.salario * 52, c.jogador.valorMercado * 1.8),
  );
  if (!livre && i.ofertaClube === undefined) {
    i.ofertaClube = pre
      ? 0
      : Math.min(
          limite,
          a.score >= 80 ? pedido : Math.round(c.jogador.valorMercado * 0.85),
        );
    i.rodadasClube = 1;
    registrarNegociacao(
      c,
      clube.id,
      pre
        ? "O clube abriu conversas para um pré-contrato internacional, válido após o fim do vínculo atual."
        : `O clube ofereceu €${i.ofertaClube.toLocaleString("pt-BR")} ao seu clube atual.`,
    );
    return;
  }
  if (!livre) {
    const resposta = pre ? "aceitar" : avaliarOfertaClube(c, i.ofertaClube!);
    if (resposta === "rejeitar" || pedido > limite || (i.rodadasClube ?? 0) > 3) {
      encerrar(
        c,
        i,
        "A negociação entre os clubes terminou sem acordo sobre o valor.",
      );
      return;
    }
    if (resposta === "pedir-mais") {
      i.ofertaClube = pedido;
      i.rodadasClube = (i.rodadasClube ?? 0) + 1;
      registrarNegociacao(
        c,
        clube.id,
        `Seu clube pediu €${pedido.toLocaleString("pt-BR")}. O interessado vai analisar os novos termos.`,
      );
      return;
    }
  } else {
    i.ofertaClube = 0;
  }
  if (
    c.propostas.filter(
      (p) => p.status === "pendente" && p.tipo === "transferencia",
    ).length >= 2
  )
    return;
  const termos: TermosContrato = {
    salario: a.salario,
    duracaoAnos: c.jogador.idade <= 23 ? 4 : 3,
    papelPrometido: a.papel,
    ...(clube.pais === "Espanha"
      ? { clausulaRescisao: Math.round(c.jogador.valorMercado * 3) }
      : {}),
  };
  const proposta: PropostaTransferencia = {
    ...termos,
    id: `oferta-${clube.id}-${c.dataAtual}-${c.propostas.length}`,
    clubeId: clube.id,
    clubeOrigemId: c.clubeAtualId ?? undefined,
    tipo: "transferencia",
    etapa: "proposta_jogador",
    data: c.dataAtual,
    validade: somarDias(c.dataAtual, 21),
    status: "pendente",
    valorTransferencia: livre || pre ? 0 : i.ofertaClube,
    rodadasNegociacao: 0,
    ofertaInicial: { ...termos },
    bonusGol: ["CA", "PE", "PD"].includes(c.jogador.posicao)
      ? Math.round(a.salario * 0.1)
      : 0,
    preContrato: pre,
    efetivarEm: pre ? somarDias(c.jogador.contrato.dataTermino, 1) : undefined,
  };
  c.propostas.push(proposta);
  i.propostaId = proposta.id;
  registrarNegociacao(
    c,
    clube.id,
    livre
      ? "Como agente livre, o clube apresentou uma oferta contratual sem taxa de transferência."
      : "Acordo de contratação autorizado. O clube apresentou uma oferta contratual ao jogador.",
    proposta.id,
    termos,
  );
}
export function avancarInteresses(
  c: EstadoCarreira,
  aleatorio: GeradorAleatorio = new GeradorAleatorio(
    Math.abs(
      (c.estadoAleatorio ?? 1) ^
        Date.parse(c.dataAtual) ^
        (c.mercado?.interesses.length ?? 0),
    ),
  ),
) {
  c.mercado ??= criarMercado();
  if (c.aposentado || c.jogador.categoria === "base" || temAcordoAtivo(c))
    return;
  const peso = pesoFrequenciaPropostas(c.dataAtual);
  const boostPublico = c.mercado.pedidoPublico ? 1.55 : 1;
  const boostListado =
    c.mercado.statusPedidoSaida === "aceito" || c.mercado.pediuSaida ? 1.2 : 1;
  const boostLivre = estaSemClube(c) ? 1.75 : 1;
  const boostObjetivo =
    c.acompanhamento.objetivoPessoal &&
    !c.acompanhamento.objetivoPessoal.concluido &&
    (c.acompanhamento.objetivoPessoal.tipo === "transferencia" ||
      (estaSemClube(c) &&
        c.acompanhamento.objetivoPessoal.tipo === "emprestimo"))
      ? 1.35
      : 1;
  const chanceBase = Math.min(
    0.7,
    0.08 * peso * boostPublico * boostListado * boostLivre * boostObjetivo,
  );
  const limiar = Math.max(
    18,
    LIMIAR_ELEGIBILIDADE -
      (c.mercado.pedidoPublico ? 8 : 0) -
      (estaSemClube(c) ? 6 : 0) -
      (boostObjetivo > 1 ? 4 : 0),
  );

  const candidatosNovos: {
    clube: Clube;
    a: ReturnType<typeof avaliarAlvo>;
    origem: InteresseClube["origem"];
    interesseAnterior?: InteresseClube;
  }[] = [];

  for (const clube of c.clubes) {
    if (clube.id === c.clubeAtualId) continue;
    const a = avaliarAlvo(c, clube);
    let i = c.mercado.interesses.find((x) => x.clubeId === clube.id);
    if (
      i?.status === "encerrado" &&
      i.reabrirEm &&
      i.reabrirEm <= c.dataAtual &&
      a.viavel &&
      a.evidencia &&
      a.score >= limiar
    ) {
      // Reaberturas competem pelo mesmo orçamento semanal de novos interesses.
      candidatosNovos.push({
        clube,
        a,
        origem: i.origem,
        interesseAnterior: i,
      });
      continue;
    }
    if (!i) {
      const elegivelEmprestimo =
        !estaSemClube(c) &&
        c.mercado.disponivelParaEmprestimo &&
        a.compativel &&
        !a.saturado &&
        a.nec.nivel !== "baixa" &&
        a.evidencia &&
        a.score >= limiar * 0.85;
      if (a.viavel && a.evidencia && a.score >= limiar)
        candidatosNovos.push({ clube, a, origem: "clube" });
      else if (elegivelEmprestimo)
        candidatosNovos.push({ clube, a, origem: "clube" });
      continue;
    }
    if (
      i.status === "encerrado" ||
      i.ultimaAtualizacao >= c.dataAtual ||
      Date.parse(c.dataAtual) - Date.parse(i.ultimaAtualizacao) < 7 * 86400000
    )
      continue;
    i.ultimaAtualizacao = c.dataAtual;
    i.semanasObservando++;
    i.papel = a.papel;
    i.motivo = a.motivo;
    const pendente = c.propostas.find(
      (p) =>
        p.clubeId === clube.id &&
        (p.status === "pendente" ||
          (p.status === "aceita" &&
            (p.etapa === "acordo" || p.etapa === "acordo_futuro"))),
    );
    if (pendente?.etapa === "acordo" || pendente?.etapa === "acordo_futuro")
      continue;
    if (!a.viavel || (c.jogador.lesao?.diasRecuperacao ?? 0) >= 60) {
      if (
        c.mercado.disponivelParaEmprestimo &&
        a.compativel &&
        !a.saturado &&
        i.status === "negociando" &&
        !(c.mercado.bloquearPropostas && i.origem === "clube")
      ) {
        negociarClubes(c, clube, i, a);
        i.resposta = a.resposta;
        continue;
      }
      i.nivelInteresse = Math.max(0, i.nivelInteresse - 20);
      if (i.status === "negociando" || i.nivelInteresse === 0) {
        if (pendente) {
          pendente.status = "rejeitada";
          pendente.etapa = "rejeicao";
        }
        encerrar(
          c,
          i,
          "O clube encerrou as conversas após reavaliar elenco, finanças ou lesão prolongada.",
        );
      }
      continue;
    }
    if (pendente) continue;
    if (
      i.status === "negociando" &&
      c.propostas.some((p) => p.id === i.propostaId && p.status !== "pendente")
    ) {
      encerrar(
        c,
        i,
        "As conversas foram encerradas após o término da proposta.",
      );
      continue;
    }
    const ganho = !a.evidencia
      ? 1
      : a.nota < 6.2
        ? -8
        : Math.max(
            2,
            Math.min(
              14,
              a.score / 5 + (c.mercado.pedidoPublico && a.viavel ? 2 : 0),
            ),
          );
    i.nivelInteresse = limitar(i.nivelInteresse + ganho);
    if (i.nivelInteresse < 20 && i.status !== "observando") {
      i.status = "observando";
      i.ofertaClube = undefined;
      i.rodadasClube = undefined;
      registrarNegociacao(
        c,
        clube.id,
        "As últimas atuações esfriaram o interesse. O clube voltou à observação.",
      );
    }
    const bloqueiaOferta =
      c.mercado.bloquearPropostas && i.origem === "clube";
    if (i.status === "negociando") {
      if (!bloqueiaOferta) negociarClubes(c, clube, i, a);
      else
        i.resposta =
          "O clube mantém interesse interno, mas seu agente está filtrando novas ofertas espontâneas.";
    } else if (
      i.status === "sondagem" &&
      i.nivelInteresse >= 65 &&
      a.evidencia
    ) {
      if (
        c.propostas.filter(
          (p) =>
            p.status === "pendente" &&
            (p.tipo === "transferencia" || p.tipo === "emprestimo"),
        ).length >= 2
      )
        continue;
      if (bloqueiaOferta) {
        i.resposta =
          "Há sondagem avançada, mas novas propostas espontâneas estão bloqueadas pelo seu agente.";
      } else {
        const anterior = i.status;
        i.status = "negociando";
        marcarNovidadeStatusInteresse(i, anterior, c.dataAtual);
        registrarNegociacao(
          c,
          clube.id,
          resolverJanela(c.dataAtual) === "fechada"
            ? "Interesse sério: o clube quer negociar agora e agendar a mudança para a próxima janela."
            : "Interesse sério: o clube decidiu abrir a negociação de contratação.",
        );
      }
    } else if (i.status === "interessado" && i.nivelInteresse >= 45) {
      const anterior = i.status;
      i.status = "sondagem";
      marcarNovidadeStatusInteresse(i, anterior, c.dataAtual);
      registrarNegociacao(
        c,
        clube.id,
        "Após acompanhar suas atuações, o clube fez uma sondagem ao agente.",
      );
    } else if (i.status === "observando" && i.nivelInteresse >= 20) {
      const anterior = i.status;
      i.status = "interessado";
      marcarNovidadeStatusInteresse(i, anterior, c.dataAtual);
      registrarNegociacao(
        c,
        clube.id,
        "O relatório de observação evoluiu para interesse inicial.",
      );
    }
    i.resposta = a.resposta;
  }

  candidatosNovos.sort((x, y) => y.a.score - x.a.score);
  let novos = 0;
  for (const { clube, a, origem, interesseAnterior } of candidatosNovos) {
    if (novos >= MAX_NOVOS_INTERESSES_SEMANA) break;
    // Jogadores muito conhecidos têm chance garantida no slot, mas ainda
    // respeitam o teto semanal — evita explosão quando muitos reabrirEm vencem juntos.
    const conhecido =
      a.viavel &&
      a.evidencia &&
      a.score >= 80 &&
      c.jogador.reputacao >= 75;
    const fatorScore = Math.min(1.4, a.score / 70);
    const chance = conhecido ? 1 : chanceBase * fatorScore;
    if (!aleatorio.chance(chance)) continue;
    if (interesseAnterior) {
      c.mercado.interesses = c.mercado.interesses.filter(
        (x) => x !== interesseAnterior,
      );
    }
    // Origem "agente" só nasce em contatar/buscar; interesses espontâneos novos
    // usam "clube" (clubesDesejados/pedido de saída não reclassificam).
    // Reaberturas preservam a origem já registrada no interesse encerrado.
    observar(c, clube, origem);
    novos++;
  }
}
export function contrapropor(
  estado: EstadoCarreira,
  id: string,
  termos: TermosContrato,
): EstadoCarreira {
  const c = structuredClone(estado);
  const p = c.propostas.find((x) => x.id === id);
  if (
    !p ||
    p.status !== "pendente" ||
    p.validade < c.dataAtual ||
    !["proposta_jogador", "negociacao"].includes(p.etapa) ||
    p.contrapropostaPendente
  )
    throw new Error("Esta oferta não está disponível para negociação.");
  if (
    !Number.isFinite(termos.salario) ||
    termos.salario <= 0 ||
    !Number.isInteger(termos.duracaoAnos) ||
    termos.duracaoAnos < 1 ||
    termos.duracaoAnos > 5 ||
    !PAPEIS_MERCADO.includes(termos.papelPrometido) ||
    (termos.clausulaRescisao !== undefined &&
      (!Number.isFinite(termos.clausulaRescisao) ||
        termos.clausulaRescisao <= 0))
  )
    throw new Error(
      "Informe salário positivo, duração de 1 a 5 anos e termos válidos.",
    );
  if ((p.rodadasNegociacao ?? 0) >= 3)
    throw new Error(
      "O clube apresentou sua oferta final. Aceite ou rejeite os termos.",
    );
  p.ofertaInicial ??= {
    salario: p.salario,
    duracaoAnos: p.duracaoAnos,
    papelPrometido: p.papelPrometido,
    clausulaRescisao: p.clausulaRescisao,
  };
  p.contrapropostaPendente = { ...termos };
  p.responderEm = somarDias(c.dataAtual, 7);
  p.etapa = "negociacao";
  p.validade = somarDias(c.dataAtual, 21);
  registrarNegociacao(
    c,
    p.clubeId,
    "Você apresentou uma contraproposta. O clube responderá na próxima semana.",
    p.id,
    termos,
  );
  return c;
}
export function processarContrapropostas(c: EstadoCarreira) {
  for (const p of c.propostas) {
    if (
      p.status !== "pendente" ||
      !p.contrapropostaPendente ||
      !p.responderEm ||
      p.responderEm > c.dataAtual
    )
      continue;
    const t = p.contrapropostaPendente;
    const base = p.ofertaInicial!;
    const clube = c.clubes.find((cl) => cl.id === p.clubeId)!;
    const teto = Math.min(
      tetoSalario(clube),
      base.salario * 1.35,
      Math.max(
        0,
        (clube.orcamento - (p.valorTransferencia ?? 0) - (p.luvas ?? 0)) / 52,
      ),
    );
    const papelMax =
      p.tipo === "renovacao"
        ? base.papelPrometido
        : avaliarAlvo(c, clube).papel;
    const excessoPapel =
      PAPEIS_MERCADO.indexOf(t.papelPrometido) -
      PAPEIS_MERCADO.indexOf(papelMax);
    p.rodadasNegociacao = (p.rodadasNegociacao ?? 0) + 1;
    delete p.contrapropostaPendente;
    delete p.responderEm;
    if (
      t.salario > teto * 1.8 ||
      excessoPapel >= 3 ||
      (t.clausulaRescisao !== undefined &&
        t.clausulaRescisao < c.jogador.valorMercado * 0.5) ||
      teto < base.salario
    ) {
      p.status = "rejeitada";
      p.etapa = "rejeicao";
      const i = c.mercado.interesses.find((x) => x.clubeId === p.clubeId);
      const texto =
        "O clube decidiu encerrar as conversas após considerar suas exigências incompatíveis.";
      if (i) encerrar(c, i, texto);
      else registrarNegociacao(c, p.clubeId, texto, p.id);
      c.relacionamentos.agente = limitar(c.relacionamentos.agente - 3);
      continue;
    }
    const clausulaMin = base.clausulaRescisao
      ? Math.max(c.jogador.valorMercado * 1.5, base.clausulaRescisao * 0.7)
      : 0;
    const aceita =
      t.salario <= teto &&
      excessoPapel <= 0 &&
      Math.abs(t.duracaoAnos - base.duracaoAnos) <= 1 &&
      (!clausulaMin || (t.clausulaRescisao ?? 0) >= clausulaMin);
    p.salario = aceita
      ? t.salario
      : Math.round(Math.min(teto, (p.salario + t.salario) / 2));
    p.duracaoAnos = aceita ? t.duracaoAnos : base.duracaoAnos;
    p.papelPrometido = aceita ? t.papelPrometido : papelMax;
    p.clausulaRescisao = aceita ? t.clausulaRescisao : base.clausulaRescisao;
    p.etapa = "proposta_jogador";
    registrarNegociacao(
      c,
      p.clubeId,
      aceita
        ? "O clube aceitou os termos. A assinatura aguarda sua confirmação."
        : p.rodadasNegociacao >= 3
          ? "O clube apresentou sua oferta final."
          : "O clube apresentou uma contraproposta contratual.",
      p.id,
      p,
    );
  }
}
export function avaliarPapelPrometido(c: EstadoCarreira) {
  if (estaSemClube(c)) return;
  const papel = PAPEIS_MERCADO.indexOf(c.jogador.contrato.papelEsperado);
  if (papel < 2 || c.jogador.lesao || c.jogador.suspensao) return;
  const partidas = (
    c.jogador.categoria === "base"
      ? c.temporada.partidasBase
      : c.temporada.partidas
  )
    .filter(
      (p) =>
        p.data >= c.jogador.contrato.dataInicio &&
        p.participacao &&
        c.clubeAtualId !== null &&
        [p.mandanteId, p.visitanteId].includes(c.clubeAtualId),
    )
    .slice(-5);
  if (
    partidas.length < 5 ||
    partidas.some((p) =>
      ["lesionado", "suspenso"].includes(p.participacao!.escalacao),
    )
  )
    return;
  const minutos = partidas.reduce((s, p) => s + p.participacao!.minutos, 0);
  if (minutos >= (papel >= 3 ? 270 : 135)) return;
  if (
    c.mercado.ultimaCobrancaPapel &&
    somarDias(c.mercado.ultimaCobrancaPapel, 28) > c.dataAtual
  )
    return;
  c.mercado.ultimaCobrancaPapel = c.dataAtual;
  c.jogador.moral = limitar(c.jogador.moral - 5);
  registrarNegociacao(c, clubeRefHistorico(c),
    "Os minutos recebidos estão abaixo do papel prometido. Seu agente vai cobrar espaço; sua moral caiu.",
  );
}
