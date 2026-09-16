import type {
  Clube,
  EstadoCarreira,
  PropostaTransferencia,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import {
  criarMercado,
  PAPEIS_MERCADO,
  type InteresseClube,
  type PreferenciasCarreira,
  type TermosContrato,
} from "@/dominio/mercado";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { registrarEvento } from "../eventos/eventos";
import { somarEstatisticas } from "../temporada/estatisticas";
import {
  avaliarNecessidadeElenco,
  ligaDoClube,
  resolverJanela,
} from "./necessidade";

const diasContrato = (c: EstadoCarreira) =>
  Math.ceil(
    (Date.parse(c.jogador.contrato.dataTermino) - Date.parse(c.dataAtual)) /
      86400000,
  );
export function registrarNegociacao(
  c: EstadoCarreira,
  clubeId: string,
  texto: string,
  propostaId?: string,
  termos?: TermosContrato,
) {
  c.mercado ??= criarMercado();
  c.mercado.historico.push({
    id: `neg-${c.mercado.historico.length}-${c.dataAtual}`,
    data: c.dataAtual,
    clubeId,
    texto,
    propostaId,
    termos: termos ? { ...termos } : undefined,
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
  const origem = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
  const importancia = PAPEIS_MERCADO.indexOf(c.jogador.status);
  const fator =
    0.65 +
    Math.min(3, Math.max(0, diasContrato(c)) / 365) * 0.2 +
    Math.max(0, importancia - 2) * 0.12;
  const preco =
    c.jogador.valorMercado *
    fator *
    (c.mercado?.pediuSaida ? 0.85 : 1) *
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
  if (
    papel === "jogador importante" &&
    j.overall >= clube.forcaGeral + 8 &&
    j.reputacao >= 65
  )
    papel = "estrela do time";
  const salario = Math.round(
    Math.max(500, j.contrato.salario * 1.1, j.valorMercado * 0.0015),
  );
  const preContrato = diasContrato(c) <= 180 && clube.ligaId !== c.liga.id;
  const custo = preContrato ? 0 : precoPedido(c);
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
  const evidencia =
    stats.minutos >= 450 ||
    j.reputacao >= 55 ||
    (promessa && potencialPercebido >= clube.forcaGeral + 10) ||
    (nec.nivel === "critica" && pronto) ||
    (diasContrato(c) <= 180 && pronto) ||
    excepcional;
  const score = limitar(
    necessidade +
      (j.overall - clube.forcaGeral) * 1.5 +
      (promessa ? 20 : 0) +
      j.reputacao * 0.2 +
      Math.min(12, stats.minutos / 90) +
      (nota - 6.5) * 8 +
      (j.forma - 50) * 0.15 +
      Math.min(10, (producao / Math.max(1, stats.minutos / 90)) * 10) +
      (c.liga.reputacao - ligaDoClube(c, clube.id).reputacao) * 0.1,
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
  };
}
function atendePreferencias(
  c: EstadoCarreira,
  clube: Clube,
  a: ReturnType<typeof avaliarAlvo>,
) {
  const p = c.mercado.preferencias;
  const atual = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
  const europa = [
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
  ];
  return (
    (!p.apenasDesejados || c.mercado.clubesDesejados.includes(clube.id)) &&
    (!p.mesmoPais || clube.pais === atual.pais) &&
    (!p.europa || europa.includes(clube.ligaId)) &&
    (!p.clubeMaior || clube.reputacao > atual.reputacao) &&
    (!p.maisMinutos || PAPEIS_MERCADO.indexOf(a.papel) >= 3) &&
    (!p.salarioMaior || a.salario > c.jogador.contrato.salario) &&
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
export function conversarAgente(
  estado: EstadoCarreira,
  acao: "contatar" | "buscar" | "sair" | "publicar" | "permanecer",
  clubeId?: string,
): EstadoCarreira {
  const c = structuredClone(estado);
  c.mercado ??= criarMercado();
  if (acao === "sair" || acao === "publicar" || acao === "permanecer") {
    if (acao === "publicar" && !c.mercado.pediuSaida)
      throw new Error("Converse primeiro com o agente sobre sua saída.");
    if (acao === "publicar" && !c.mercado.pedidoPublico) {
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 12);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 6);
    }
    if (acao === "sair" && !c.mercado.pediuSaida)
      c.jogador.moral = limitar(c.jogador.moral - 3);
    c.mercado.pediuSaida = acao !== "permanecer";
    c.mercado.pedidoPublico =
      acao === "permanecer"
        ? false
        : c.mercado.pedidoPublico || acao === "publicar";
    registrarNegociacao(
      c,
      c.clubeAtualId,
      acao === "permanecer"
        ? "Você decidiu permanecer e voltou a considerar renovações."
        : acao === "publicar"
          ? "Seu pedido de saída se tornou público. A diretoria e o treinador reagiram."
          : "Seu agente recebeu um pedido privado de saída e vai buscar opções compatíveis.",
    );
    return c;
  }
  if (c.jogador.categoria === "base")
    throw new Error(
      "Seu agente poderá negociar após sua promoção ao profissional.",
    );
  const candidatos =
    acao === "contatar"
      ? c.clubes.filter((cl) => cl.id === clubeId && cl.id !== c.clubeAtualId)
      : c.clubes
          .filter(
            (cl) =>
              cl.id !== c.clubeAtualId &&
              atendePreferencias(c, cl, avaliarAlvo(c, cl)),
          )
          .sort(
            (a, b) =>
              Number(c.mercado.clubesDesejados.includes(b.id)) -
                Number(c.mercado.clubesDesejados.includes(a.id)) ||
              avaliarAlvo(c, b).score - avaliarAlvo(c, a).score,
          )
          .slice(0, 3);
  if (!candidatos.length)
    throw new Error(
      "Nenhum clube disponível corresponde ao pedido. Revise suas preferências.",
    );
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
    observar(c, clube, "agente");
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
  registrarNegociacao(
    c,
    c.clubeAtualId,
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
  const pre = a.preContrato && resolverJanela(c.dataAtual) === "fechada";
  const pedido = pre ? 0 : precoPedido(c);
  const limite = Math.max(
    0,
    Math.min(clube.orcamento - a.salario * 52, c.jogador.valorMercado * 1.8),
  );
  if (i.ofertaClube === undefined) {
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
  const resposta = pre ? "aceitar" : avaliarOfertaClube(c, i.ofertaClube);
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
    clubeOrigemId: c.clubeAtualId,
    tipo: "transferencia",
    etapa: "proposta_jogador",
    data: c.dataAtual,
    validade: somarDias(c.dataAtual, 21),
    status: "pendente",
    valorTransferencia: i.ofertaClube,
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
    "Acordo de contratação autorizado. O clube apresentou uma oferta contratual ao jogador.",
    proposta.id,
    termos,
  );
}
export function avancarInteresses(c: EstadoCarreira) {
  c.mercado ??= criarMercado();
  if (
    c.jogador.categoria === "base" ||
    c.propostas.some((p) => p.status === "aceita" && p.etapa === "acordo")
  )
    return;
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
      atendePreferencias(c, clube, a)
    ) {
      c.mercado.interesses = c.mercado.interesses.filter((x) => x !== i);
      observar(c, clube, i.origem);
      continue;
    }
    if (!i) {
      if (
        a.viavel &&
        a.evidencia &&
        a.score >= 25 &&
        atendePreferencias(c, clube, a)
      )
        observar(
          c,
          clube,
          c.mercado.pediuSaida || c.mercado.clubesDesejados.includes(clube.id)
            ? "agente"
            : "clube",
        );
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
          (p.status === "aceita" && p.etapa === "acordo")),
    );
    if (pendente?.etapa === "acordo") continue;
    if (!a.viavel || (c.jogador.lesao?.diasRecuperacao ?? 0) >= 60) {
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
        : Math.max(2, Math.min(14, a.score / 5));
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
    if (i.status === "negociando") {
      if (resolverJanela(c.dataAtual) !== "fechada" || a.preContrato)
        negociarClubes(c, clube, i, a);
    } else if (
      i.status === "sondagem" &&
      i.nivelInteresse >= 65 &&
      a.evidencia &&
      (resolverJanela(c.dataAtual) !== "fechada" || a.preContrato)
    ) {
      if (
        c.propostas.filter(
          (p) => p.status === "pendente" && p.tipo === "transferencia",
        ).length >= 2
      )
        continue;
      i.status = "negociando";
      registrarNegociacao(
        c,
        clube.id,
        "Interesse sério: o clube decidiu abrir a negociação de contratação.",
      );
    } else if (i.status === "interessado" && i.nivelInteresse >= 45) {
      i.status = "sondagem";
      registrarNegociacao(
        c,
        clube.id,
        "Após acompanhar suas atuações, o clube fez uma sondagem ao agente.",
      );
    } else if (i.status === "observando" && i.nivelInteresse >= 20) {
      i.status = "interessado";
      registrarNegociacao(
        c,
        clube.id,
        "O relatório de observação evoluiu para interesse inicial.",
      );
    }
    i.resposta = a.resposta;
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
  registrarNegociacao(
    c,
    c.clubeAtualId,
    "Os minutos recebidos estão abaixo do papel prometido. Seu agente vai cobrar espaço; sua moral caiu.",
  );
}
