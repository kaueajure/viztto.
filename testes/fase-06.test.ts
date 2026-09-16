import { describe, expect, it } from "vitest";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  obterSituacaoJanela,
  pesoFrequenciaPropostas,
  proximaAberturaJanela,
  resolverJanela,
} from "@/simulacao/transferencias/necessidade";
import {
  avaliarAlvo,
  avancarInteresses,
  conversarAgente,
  avaliarPedidoEmprestimoDiretoria,
  avaliarPedidoSaidaDiretoria,
  contrapropor,
} from "@/simulacao/transferencias/mercado-progressivo";
import {
  aposentarJogador,
  efetivarPreContratos,
  processarRetornoEmprestimo,
  responderProposta,
} from "@/simulacao/transferencias/mercado";
import { somarDias } from "@/utilitarios/formatacao";
import { estatisticasVazias } from "@/simulacao/temporada/estatisticas";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import type {
  EstadoCarreira,
  PropostaTransferencia,
} from "@/dominio/entidades/modelos";

function nova(dataInicio = "2026-07-01") {
  const liga = LIGAS_SUPORTADAS[0]!;
  const externa = LIGAS_SUPORTADAS.find((l) => l.id === "premier-league")!;
  const clubes = gerarClubesDemonstracao(liga).slice(0, 4);
  const c = criarCarreira({
    identidade: {
      nome: "Ana",
      sobrenome: "Costa",
      nacionalidade: "Brasil",
      idade: 22,
      posicao: "PD",
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 170,
      peso: 62,
      arquetipo: "criador",
    },
    liga,
    clubes,
    clubeId: clubes[0]!.id,
    origem: "demonstracao",
    seed: "fase-06",
    dataInicio,
    ligasMundo: [externa],
    clubesMundo: gerarClubesDemonstracao(externa).slice(0, 4),
  });
  c.jogador.overall = 77;
  c.jogador.potencialInterno = 82;
  c.jogador.reputacao = 40;
  c.jogador.valorMercado = 500_000;
  c.jogador.contrato.salario = 1500;
  c.jogador.status = "rotacao";
  c.jogador.notasRecentes = [7.5, 7.5, 7.5];
  c.jogador.forma = 75;
  c.registros.push({
    ano: 2026,
    clubeId: c.clubeAtualId,
    competicao: liga.nome,
    categoria: "profissional",
    estatisticas: {
      ...estatisticasVazias(),
      jogos: 10,
      minutos: 900,
      somaNotas: 75,
      gols: 4,
      assistencias: 3,
    },
  });
  const alvo = c.clubes[1]!;
  alvo.forcaGeral = 75;
  alvo.reputacao = 75;
  alvo.orcamento = 50_000_000;
  alvo.elenco = alvo.elenco.filter(
    (j) => j.posicaoPrincipal !== "PD" && !j.posicoesSecundarias.includes("PD"),
  );
  return c;
}

function oferta(
  c: EstadoCarreira,
  clubeId = c.clubes[1]!.id,
): PropostaTransferencia {
  const p: PropostaTransferencia = {
    id: `oferta-${c.propostas.length}`,
    clubeId,
    clubeOrigemId: c.clubeAtualId,
    tipo: "transferencia",
    salario: 2000,
    duracaoAnos: 4,
    papelPrometido: "titular",
    etapa: "proposta_jogador",
    data: c.dataAtual,
    validade: somarDias(c.dataAtual, 28),
    status: "pendente",
    valorTransferencia: 600_000,
    rodadasNegociacao: 0,
    ofertaInicial: { salario: 2000, duracaoAnos: 4, papelPrometido: "titular" },
  };
  c.propostas.push(p);
  return p;
}

describe("Fase 6: janelas oficiais", () => {
  it("janeiro = janela aberta", () => {
    expect(resolverJanela("2027-01-15")).toBe("inverno");
    expect(obterSituacaoJanela("2027-01-15").aberta).toBe(true);
  });
  it("fevereiro = janela aberta", () => {
    expect(resolverJanela("2027-02-10")).toBe("inverno");
  });
  it("julho = janela aberta", () => {
    expect(resolverJanela("2027-07-01")).toBe("verao");
  });
  it("junho = fechada", () => {
    expect(resolverJanela("2027-06-20")).toBe("fechada");
  });
  it("agosto = fechada", () => {
    expect(resolverJanela("2027-08-05")).toBe("fechada");
  });
  it("novembro = fechada", () => {
    expect(resolverJanela("2027-11-12")).toBe("fechada");
  });
  it("calcula próxima abertura", () => {
    expect(proximaAberturaJanela("2027-03-10")).toBe("2027-07-01");
    expect(proximaAberturaJanela("2027-06-20")).toBe("2027-07-01");
    expect(proximaAberturaJanela("2027-08-05")).toBe("2028-01-01");
    expect(proximaAberturaJanela("2027-12-15")).toBe("2028-01-01");
  });
  it("define pesos de frequência testáveis", () => {
    expect(pesoFrequenciaPropostas("2027-01-01")).toBe(1);
    expect(pesoFrequenciaPropostas("2027-02-01")).toBe(0.75);
    expect(pesoFrequenciaPropostas("2027-07-01")).toBe(1);
    expect(pesoFrequenciaPropostas("2027-06-01")).toBe(0.45);
    expect(pesoFrequenciaPropostas("2027-12-01")).toBe(0.45);
    expect(pesoFrequenciaPropostas("2027-04-01")).toBe(0.18);
  });
});

describe("Fase 6: propostas e acordos futuros", () => {
  it("proposta pode surgir fora da janela via interesse", () => {
    const c = nova("2026-04-01");
    c.dataAtual = "2026-04-01";
    const antes = c.mercado.interesses.length;
    for (let i = 0; i < 8; i++) {
      c.dataAtual = somarDias(c.dataAtual, 7);
      avancarInteresses(c);
    }
    expect(c.mercado.interesses.length).toBeGreaterThanOrEqual(antes);
  });

  it("proposta aceita fora da janela NÃO troca clube imediatamente", () => {
    const c = nova();
    c.dataAtual = "2026-04-15";
    const p = oferta(c);
    const origem = c.clubeAtualId;
    const depois = responderProposta(c, p.id, true);
    expect(depois.clubeAtualId).toBe(origem);
    expect(depois.propostas[0]!.etapa).toBe("acordo_futuro");
  });

  it("acordo de abril agenda transferência para julho", () => {
    const c = nova();
    c.dataAtual = "2026-04-15";
    const p = oferta(c);
    const depois = responderProposta(c, p.id, true);
    expect(depois.propostas[0]!.efetivarEm).toBe("2026-07-01");
  });

  it("acordo de agosto agenda transferência para janeiro seguinte", () => {
    const c = nova();
    c.dataAtual = "2026-08-05";
    const p = oferta(c);
    const depois = responderProposta(c, p.id, true);
    expect(depois.propostas[0]!.efetivarEm).toBe("2027-01-01");
  });

  it("ao chegar à janela, acordo futuro é efetivado", () => {
    let c = nova();
    c.dataAtual = "2026-04-15";
    const destino = c.clubes[1]!.id;
    const p = oferta(c, destino);
    c = responderProposta(c, p.id, true);
    expect(c.clubeAtualId).not.toBe(destino);
    c.dataAtual = "2026-07-01";
    c = efetivarPreContratos(c);
    expect(c.clubeAtualId).toBe(destino);
    expect(c.propostas[0]!.etapa).toBe("concluida");
  });

  it("acordo definitivo impede dois contratos futuros simultâneos", () => {
    let c = nova();
    c.dataAtual = "2026-04-15";
    const p1 = oferta(c, c.clubes[1]!.id);
    c = responderProposta(c, p1.id, true);
    expect(c.propostas.find((p) => p.id === p1.id)!.etapa).toBe(
      "acordo_futuro",
    );
    c.clubes[2]!.orcamento = 50_000_000;
    const p2 = oferta(c, c.clubes[2]!.id);
    expect(() => responderProposta(c, p2.id, true)).toThrow("acordo");
  });

  it("contraproposta continua funcionando", () => {
    const c = nova();
    oferta(c);
    const depois = contrapropor(c, "oferta-0", {
      salario: 2500,
      duracaoAnos: 3,
      papelPrometido: "titular",
    });
    expect(depois.propostas[0]!.contrapropostaPendente?.salario).toBe(2500);
  });
});

describe("Fase 6: avaliação de clubes pelo agente", () => {
  it("clube específico pode rejeitar contato do agente", () => {
    const c = nova();
    const elite = c.clubes[1]!;
    elite.forcaGeral = 92;
    elite.reputacao = 95;
    elite.elenco = [
      ...elite.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...elite.elenco[0]!,
        id: `pd-elite-${i}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 90 - i,
        lesionado: false,
        lesao: null,
      })),
    ];
    c.jogador.overall = 68;
    c.jogador.potencialInterno = 78;
    const depois = conversarAgente(c, "contatar", elite.id);
    const i = depois.mercado.interesses.find((x) => x.clubeId === elite.id)!;
    expect(i.status).toBe("encerrado");
    expect(i.resposta.toLowerCase()).toMatch(/interesse|opções|nível/);
  });

  it("clube específico pode apenas observar", () => {
    const c = nova();
    c.jogador.reputacao = 30;
    c.registros[0]!.estatisticas.minutos = 200;
    const depois = conversarAgente(c, "contatar", c.clubes[1]!.id);
    const i = depois.mercado.interesses.find((x) => x.clubeId === c.clubes[1]!.id)!;
    expect(["observando", "interessado", "sondagem", "encerrado"]).toContain(
      i.status,
    );
  });

  it("clube específico pode aceitar conversar", () => {
    const c = nova();
    const a = avaliarAlvo(c, c.clubes[1]!);
    expect(a.viavel).toBe(true);
    const depois = conversarAgente(c, "contatar", c.clubes[1]!.id);
    expect(depois.mercado.interesses[0]!.status).not.toBe("encerrado");
  });

  it("clube sem necessidade na posição tende a rejeitar", () => {
    const c = nova();
    const clube = c.clubes[1]!;
    clube.elenco = [
      ...clube.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...clube.elenco[0]!,
        id: `pd-${i}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 80,
        lesionado: false,
        lesao: null,
      })),
    ];
    expect(avaliarAlvo(c, clube).viavel).toBe(false);
  });

  it("clube sem orçamento rejeita", () => {
    const c = nova();
    c.clubes[1]!.orcamento = 1000;
    expect(avaliarAlvo(c, c.clubes[1]!).viavel).toBe(false);
    expect(avaliarAlvo(c, c.clubes[1]!).resposta.toLowerCase()).toMatch(
      /orçamento|folha|empréstimo/,
    );
  });

  it("clube com necessidade real possui maior interesse", () => {
    const c = nova();
    const carente = c.clubes[1]!;
    const saturado = structuredClone(carente);
    saturado.id = "sat";
    saturado.elenco = [
      ...saturado.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...saturado.elenco[0]!,
        id: `sat-pd-${i}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 82,
        lesionado: false,
        lesao: null,
      })),
    ];
    expect(avaliarAlvo(c, carente).score).toBeGreaterThan(
      avaliarAlvo(c, saturado).score,
    );
  });

  it("clube com elenco muito superior não contrata promessa incompatível", () => {
    const c = nova();
    c.jogador.idade = 18;
    c.jogador.overall = 60;
    c.jogador.potencialInterno = 88;
    const elite = c.clubes.find((cl) => cl.ligaId !== c.liga.id) ?? c.clubes[1]!;
    elite.forcaGeral = 90;
    elite.reputacao = 92;
    elite.elenco = [
      ...elite.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...elite.elenco[0]!,
        id: `elite-pd-${i}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 88 - i,
        lesionado: false,
        lesao: null,
      })),
    ];
    expect(avaliarAlvo(c, elite).viavel).toBe(false);
  });
});

describe("Fase 6: agente — bloquear, saída e empréstimo", () => {
  it("bloquear propostas impede novas propostas espontâneas", () => {
    const c = conversarAgente(nova(), "bloquear");
    expect(c.mercado.bloquearPropostas).toBe(true);
    const antes = c.mercado.interesses.length;
    for (let i = 0; i < 6; i++) {
      c.dataAtual = somarDias(c.dataAtual, 7);
      avancarInteresses(c);
    }
    expect(c.mercado.interesses.filter((i) => i.origem === "clube").length).toBe(
      0,
    );
    expect(c.mercado.interesses.length).toBe(antes);
  });

  it("bloquear propostas NÃO impede contato ativo pelo agente", () => {
    let c = conversarAgente(nova(), "bloquear");
    c = conversarAgente(c, "contatar", c.clubes[1]!.id);
    expect(c.mercado.interesses.some((i) => i.clubeId === c.clubes[1]!.id)).toBe(
      true,
    );
  });

  it("desbloquear propostas volta a permitir abordagens", () => {
    let c = conversarAgente(nova(), "bloquear");
    c = conversarAgente(c, "desbloquear");
    expect(c.mercado.bloquearPropostas).toBe(false);
  });

  it("solicitar transferência cria estado correto", () => {
    const c = conversarAgente(nova(), "sair");
    expect(c.mercado.pediuSaida).toBe(true);
    expect(c.mercado.pedidoPublico).toBe(false);
    expect(c.mercado.respostaDiretoriaSaida).toBeTruthy();
  });

  it("solicitar transferência não garante saída", () => {
    const c = conversarAgente(nova(), "sair");
    expect(c.clubeAtualId).toBe(c.clubeInicialId);
  });

  it("diretoria pode recusar pedido", () => {
    const c = nova();
    c.jogador.status = "estrela do time";
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, 900);
    c.relacionamentos.diretoria = 70;
    const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
    clube.elenco = clube.elenco.filter(
      (j) => j.posicaoPrincipal !== "PD" && !j.posicoesSecundarias.includes("PD"),
    );
    const d = avaliarPedidoSaidaDiretoria(c);
    expect(d.aceitaNegociar).toBe(false);
  });

  it("pedido público gera consequências próprias", () => {
    let c = conversarAgente(nova(), "sair");
    const dir = c.relacionamentos.diretoria;
    const tre = c.relacionamentos.treinador;
    c = conversarAgente(c, "publicar");
    expect(c.mercado.pedidoPublico).toBe(true);
    expect(c.relacionamentos.diretoria).toBeLessThan(dir);
    expect(c.relacionamentos.treinador).toBeLessThan(tre);
  });

  it("solicitar empréstimo pode ser aceito", () => {
    const c = nova();
    c.jogador.status = "reserva";
    c.jogador.idade = 20;
    c.jogador.overall = 65;
    c.jogador.contrato.dataInicio = somarDias(c.dataAtual, -200);
    const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
    // Garante profundidade mínima para a diretoria não negar por elenco curto.
    while (
      clube.elenco.filter(
        (j) =>
          j.posicaoPrincipal === "PD" || j.posicoesSecundarias.includes("PD"),
      ).length < 3
    ) {
      clube.elenco.push({
        ...clube.elenco[0]!,
        id: `pd-depth-${clube.elenco.length}`,
        posicaoPrincipal: "PD",
        posicoesSecundarias: [],
        overall: 70,
        lesionado: false,
        lesao: null,
      });
    }
    const d = avaliarPedidoEmprestimoDiretoria(c);
    expect(d.aceita).toBe(true);
    const depois = conversarAgente(c, "emprestar");
    expect(depois.mercado.disponivelParaEmprestimo).toBe(true);
  });

  it("solicitar empréstimo pode ser recusado", () => {
    const c = nova();
    c.jogador.status = "titular";
    c.jogador.contrato.dataInicio = somarDias(c.dataAtual, -200);
    const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
    clube.elenco = clube.elenco.filter(
      (j) => j.posicaoPrincipal !== "PD" && !j.posicoesSecundarias.includes("PD"),
    );
    const d = avaliarPedidoEmprestimoDiretoria(c);
    expect(d.aceita).toBe(false);
  });

  it("clube interessado em empréstimo também avalia necessidade", () => {
    const c = nova();
    c.mercado.disponivelParaEmprestimo = true;
    const saturado = c.clubes[1]!;
    saturado.elenco = [
      ...saturado.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...saturado.elenco[0]!,
        id: `emp-pd-${i}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 85,
        lesionado: false,
        lesao: null,
      })),
    ];
    expect(avaliarAlvo(c, saturado).saturado).toBe(true);
  });

  it("empréstimo respeita janela", () => {
    const c = nova();
    c.dataAtual = "2026-04-15";
    c.mercado.disponivelParaEmprestimo = true;
    const p: PropostaTransferencia = {
      id: "emp-1",
      clubeId: c.clubes[1]!.id,
      clubeOrigemId: c.clubeAtualId,
      tipo: "emprestimo",
      salario: 1500,
      duracaoAnos: 1,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 21),
      status: "pendente",
      valorTransferencia: 0,
      percentualSalario: 0.5,
    };
    c.propostas.push(p);
    const depois = responderProposta(c, p.id, true);
    expect(depois.clubeAtualId).toBe(c.clubeAtualId);
    expect(depois.propostas[0]!.etapa).toBe("acordo_futuro");
    expect(depois.propostas[0]!.efetivarEm).toBe("2026-07-01");
  });

  it("retorno de empréstimo funciona", () => {
    const c = nova();
    const origem = c.clubeAtualId;
    const destino = c.clubes[1]!.id;
    c.clubeAtualId = destino;
    c.mercado.emprestimo = {
      clubeOrigemId: origem,
      retornoEm: c.dataAtual,
      percentualSalario: 0.5,
    };
    processarRetornoEmprestimo(c);
    expect(c.clubeAtualId).toBe(origem);
    expect(c.mercado.emprestimo).toBeUndefined();
  });
});

describe("Fase 6: aposentadoria e persistência", () => {
  it("aposentadoria exige confirmação no fluxo de UI (dois passos no agente)", () => {
    // A UI exige clique em "Quero me aposentar" e depois "Confirmar aposentadoria".
    // No domínio, aposentarJogador só encerra após chamada explícita.
    const c = nova();
    expect(c.aposentado).toBeFalsy();
    const depois = aposentarJogador(c);
    expect(depois.aposentado).toBe(true);
  });

  it("aposentadoria preserva histórico", () => {
    const c = nova();
    c.registros.push({
      ano: 2025,
      clubeId: c.clubeAtualId,
      competicao: "Liga",
      categoria: "profissional",
      estatisticas: { ...estatisticasVazias(), jogos: 20, gols: 5 },
    });
    const depois = aposentarJogador(c);
    expect(depois.registros.length).toBeGreaterThan(0);
    expect(depois.eventos.some((e) => e.tipo === "aposentadoria")).toBe(true);
  });

  it("aposentado não consegue avançar carreira ativa", () => {
    const c = aposentarJogador(nova());
    expect(() => avancarSemana(c)).toThrow(/aposentad/i);
  });

  it("aposentado não recebe propostas", () => {
    const c = aposentarJogador(nova());
    const antes = c.mercado.interesses.length;
    for (let i = 0; i < 4; i++) {
      c.dataAtual = somarDias(c.dataAtual, 7);
      avancarInteresses(c);
    }
    expect(c.mercado.interesses.length).toBe(antes);
    expect(() => conversarAgente(c, "buscar")).toThrow(/encerrada/i);
  });

  it("saves antigos continuam carregando", () => {
    const antigo = JSON.parse(JSON.stringify(nova()));
    delete antigo.mercado.bloquearPropostas;
    delete antigo.mercado.pediuEmprestimo;
    delete antigo.mercado.disponivelParaEmprestimo;
    delete antigo.aposentado;
    const carregado = validarSave(antigo);
    expect(carregado.mercado.bloquearPropostas).toBe(false);
    expect(carregado.mercado.disponivelParaEmprestimo).toBe(false);
    expect(carregado.aposentado).toBeFalsy();
  });

  it("os novos estados persistem após reload", () => {
    let c = conversarAgente(nova(), "bloquear");
    c = conversarAgente(c, "sair");
    c = conversarAgente(c, "emprestar");
    c.dataAtual = "2026-04-01";
    oferta(c);
    c = responderProposta(c, "oferta-0", true);
    const carregado = validarSave(JSON.parse(JSON.stringify(c)));
    expect(carregado.mercado.bloquearPropostas).toBe(true);
    expect(carregado.mercado.pediuSaida).toBe(true);
    expect(carregado.propostas[0]!.etapa).toBe("acordo_futuro");
  });
});
