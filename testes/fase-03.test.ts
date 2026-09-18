import { describe, expect, it } from "vitest";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  avaliarNecessidadeElenco,
  clubePodePagar,
} from "@/simulacao/transferencias/necessidade";
import {
  avaliarAlvo,
  avancarInteresses,
  conversarAgente,
  definirPreferencias,
  contrapropor,
  processarContrapropostas,
  avaliarOfertaClube,
  precoPedido,
  avaliarPapelPrometido,
} from "@/simulacao/transferencias/mercado-progressivo";
import {
  responderProposta,
  efetivarPreContratos,
} from "@/simulacao/transferencias/mercado";
import { somarDias } from "@/utilitarios/formatacao";
import { estatisticasVazias } from "@/simulacao/temporada/estatisticas";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import type {
  EstadoCarreira,
  PropostaTransferencia,
} from "@/dominio/entidades/modelos";

function nova() {
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
    seed: "fase-03",
    dataInicio: "2026-07-01",
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
    clubeId: c.clubeAtualId!,
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
function semana(c: EstadoCarreira) {
  c.dataAtual = somarDias(c.dataAtual, 7);
  avancarInteresses(c);
}
function oferta(c: EstadoCarreira, clubeId = c.clubes[1]!.id) {
  const p: PropostaTransferencia = {
    id: "oferta-teste",
    clubeId,
    clubeOrigemId: c.clubeAtualId!,
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

describe("Fase 3: análise esportiva", () => {
  it("identifica necessidade por posição e não busca mais um titular em elenco saturado", () => {
    const c = nova(),
      clube = c.clubes[1]!;
    expect(
      avaliarNecessidadeElenco(clube).find((n) => n.posicao === "PD")!.nivel,
    ).toBe("critica");
    expect(avaliarAlvo(c, clube).viavel).toBe(true);
    const modelo = clube.elenco[0]!;
    clube.elenco.push(
      ...Array.from({ length: 5 }, (_, n) => ({
        ...structuredClone(modelo),
        id: `pd-${n}`,
        posicaoPrincipal: "PD" as const,
        posicoesSecundarias: [],
        overall: 85,
      })),
    );
    expect(avaliarAlvo(c, clube).viavel).toBe(false);
    expect(avaliarAlvo(c, clube).resposta).toContain("opções melhores");
  });
  it("lesão longa aumenta necessidade mesmo com titular forte", () => {
    const c = nova(),
      clube = c.clubes[1]!,
      j = clube.elenco[0]!;
    j.posicaoPrincipal = "PD";
    j.overall = 85;
    j.posicoesSecundarias = [];
    expect(
      avaliarNecessidadeElenco(clube).find((n) => n.posicao === "PD")!.nivel,
    ).toBe("baixa");
    j.lesionado = true;
    j.lesao = {
      tipo: "Joelho",
      gravidade: "grave",
      diasRecuperacao: 150,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: somarDias(c.dataAtual, 150),
    };
    expect(avaliarAlvo(c, clube).nec.nivel).toBe("critica");
    expect(avaliarAlvo(c, clube).motivo).toBe("lesao");
  });
  it("promessa jovem tem potencial percebido e papel de desenvolvimento", () => {
    const c = nova(),
      clube = c.clubes[1]!;
    c.jogador.idade = 17;
    c.jogador.overall = 65;
    c.jogador.potencialInterno = 94;
    clube.forcaGeral = 83;
    clube.reputacao = 90;
    const a = avaliarAlvo(c, clube);
    expect(a.viavel).toBe(true);
    expect(a.papel).toBe("promessa");
    expect(a.potencialPercebido).toBeLessThan(c.jogador.potencialInterno);
  });
  it("rejeita jogador fraco incompatível com clube grande", () => {
    const c = nova();
    c.jogador.overall = 50;
    c.jogador.potencialInterno = 60;
    expect(avaliarAlvo(c, c.clubes[1]!).viavel).toBe(false);
  });
  it("não inventa orçamento quando o saldo é zero", () => {
    const c = nova();
    c.clubes[1]!.orcamento = 0;
    expect(clubePodePagar(c.clubes[1]!, 1000)).toBe(false);
    expect(avaliarAlvo(c, c.clubes[1]!).viavel).toBe(false);
  });
});

describe("Fase 3: observação e agente", () => {
  it("não envia propostas no primeiro mês e acumula interesse antes de negociar", () => {
    const c = nova();
    const etapas = new Set<string>();
    for (let n = 0; n < 4; n++) {
      semana(c);
      expect(c.propostas).toHaveLength(0);
    }
    for (let n = 0; n < 14; n++) {
      semana(c);
      etapas.add(
        c.mercado.interesses.find((i) => i.clubeId === c.clubes[1]!.id)!.status,
      );
    }
    expect(etapas.has("sondagem")).toBe(true);
    expect(etapas.has("negociando")).toBe(true);
    expect(c.propostas.some((p) => p.clubeId === c.clubes[1]!.id)).toBe(true);
    expect(
      c.propostas.filter((p) => p.status === "pendente").length,
    ).toBeLessThanOrEqual(2);
    expect(c.clubeAtualId).toBe(c.clubeInicialId);
  });
  it("jogador já conhecido pode receber proposta cedo com justificativa forte", () => {
    const c = nova();
    c.jogador.reputacao = 95;
    c.jogador.overall = 90;
    for (let n = 0; n < 4; n++) semana(c);
    expect(c.propostas.some((p) => p.clubeId === c.clubes[1]!.id)).toBe(true);
    expect(
      c.mercado.historico.some((h) =>
        h.texto.includes("relatórios anteriores"),
      ),
    ).toBe(true);
  });
  it("sem evidência nem necessidade forte não inicia observação", () => {
    const c = nova();
    c.registros = [];
    c.jogador.reputacao = 10;
    c.jogador.potencialInterno = c.jogador.overall;
    c.jogador.notasRecentes = [];
    const clube = c.clubes[1]!;
    clube.elenco[0]!.posicaoPrincipal = "PD";
    clube.elenco[0]!.overall = 73;
    expect(avaliarAlvo(c, clube).evidencia).toBe(false);
    avancarInteresses(c);
    expect(c.mercado.interesses.some((i) => i.clubeId === clube.id)).toBe(
      false,
    );
  });
  it("contato do agente abre observação, não garante proposta, e não pode ser repetido", () => {
    let c = nova();
    const id = c.clubes[1]!.id;
    c = conversarAgente(c, "contatar", id);
    expect(c.mercado.interesses[0]!.status).toBe("observando");
    expect(
      /Aceitamos conversar|Interessados como promessa/.test(
        c.mercado.interesses[0]!.resposta ?? "",
      ),
    ).toBe(true);
    expect(c.propostas).toHaveLength(0);
    expect(() => conversarAgente(c, "contatar", id)).toThrow();
    const antes = c.mercado.interesses[0]!.nivelInteresse;
    avancarInteresses(c);
    expect(c.mercado.interesses[0]!.nivelInteresse).toBe(antes);
  });
  it("agente recebe recusa fundamentada e preserva o estado original", () => {
    const c = nova();
    c.jogador.overall = 45;
    c.jogador.potencialInterno = 50;
    const depois = conversarAgente(c, "contatar", c.clubes[1]!.id);
    expect(depois.mercado.interesses[0]!.status).toBe("encerrado");
    expect(depois.mercado.interesses[0]!.resposta).toContain("Sem interesse");
    expect(c.mercado.interesses).toHaveLength(0);
  });
  it("preferências restringem contatos a clubes desejados", () => {
    let c = nova();
    const id = c.clubes[1]!.id;
    c = definirPreferencias(
      c,
      { ...c.mercado.preferencias, apenasDesejados: true },
      [id],
    );
    c = conversarAgente(c, "buscar");
    expect(c.mercado.interesses.map((i) => i.clubeId)).toEqual([id]);
  });
  it("pedido privado não pune diretoria; pedido público tem consequência uma única vez", () => {
    let c = nova();
    const antes = c.relacionamentos.diretoria;
    c = conversarAgente(c, "sair");
    expect(c.relacionamentos.diretoria).toBe(antes);
    c = conversarAgente(c, "publicar");
    expect(c.relacionamentos.diretoria).toBe(antes - 12);
    c = conversarAgente(c, "sair");
    c = conversarAgente(c, "publicar");
    expect(c.relacionamentos.diretoria).toBe(antes - 12);
    expect(c.mercado.pediuSaida).toBe(true);
  });
  it("más atuações reduzem interesse e lesão longa encerra negociação", () => {
    let c = conversarAgente(nova(), "contatar", nova().clubes[1]!.id);
    const i = c.mercado.interesses[0]!;
    i.nivelInteresse = 70;
    i.status = "sondagem";
    c.jogador.notasRecentes = [5, 5, 5];
    semana(c);
    expect(i.nivelInteresse).toBeLessThan(70);
    i.status = "negociando";
    oferta(c);
    c.jogador.lesao = {
      tipo: "Joelho",
      gravidade: "grave",
      diasRecuperacao: 150,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: somarDias(c.dataAtual, 150),
    };
    semana(c);
    expect(i.status).toBe("encerrado");
    expect(c.propostas[0]!.status).toBe("rejeitada");
  });
});

describe("Fase 3: negociação", () => {
  it("clube atual aceita, pede mais ou recusa conforme o valor e pedido de saída", () => {
    const c = nova();
    const pedido = precoPedido(c);
    expect(avaliarOfertaClube(c, pedido)).toBe("aceitar");
    expect(avaliarOfertaClube(c, pedido * 0.8)).toBe("pedir-mais");
    expect(avaliarOfertaClube(c, pedido * 0.5)).toBe("rejeitar");
    c.mercado.pediuSaida = true;
    expect(precoPedido(c)).toBeLessThan(pedido);
  });
  it("contraproposta aguarda uma semana e termos próximos podem ser aceitos", () => {
    let c = nova();
    const p = oferta(c);
    c = contrapropor(c, p.id, {
      salario: 2300,
      duracaoAnos: 3,
      papelPrometido: "titular",
    });
    expect(() => responderProposta(c, p.id, true)).toThrow();
    processarContrapropostas(c);
    expect(c.propostas[0]!.contrapropostaPendente).toBeTruthy();
    c.dataAtual = somarDias(c.dataAtual, 7);
    processarContrapropostas(c);
    expect(c.propostas[0]!.salario).toBe(2300);
    expect(c.propostas[0]!.duracaoAnos).toBe(3);
    expect(c.clubeAtualId).toBe(c.clubeInicialId);
    expect(c.mercado.historico.at(-1)!.texto).toContain("aceitou os termos");
  });
  it("clube faz contraproposta e limita a negociação a três rodadas", () => {
    let c = nova();
    oferta(c);
    for (let n = 0; n < 3; n++) {
      c = contrapropor(c, "oferta-teste", {
        salario: 3000,
        duracaoAnos: 1,
        papelPrometido: "titular",
      });
      c.dataAtual = somarDias(c.dataAtual, 7);
      processarContrapropostas(c);
      expect(c.propostas[0]!.salario).toBeLessThan(3000);
    }
    expect(c.propostas[0]!.rodadasNegociacao).toBe(3);
    expect(() =>
      contrapropor(c, "oferta-teste", {
        salario: 3000,
        duracaoAnos: 1,
        papelPrometido: "titular",
      }),
    ).toThrow("oferta final");
  });
  it("exigência absurda encerra a conversa", () => {
    let c = nova();
    oferta(c);
    c = contrapropor(c, "oferta-teste", {
      salario: 1_000_000,
      duracaoAnos: 5,
      papelPrometido: "estrela do time",
    });
    c.dataAtual = somarDias(c.dataAtual, 7);
    processarContrapropostas(c);
    expect(c.propostas[0]!.status).toBe("rejeitada");
    expect(c.mercado.historico.at(-1)!.texto).toContain(
      "exigências incompatíveis",
    );
  });
  it("não aceita termos inválidos nem oferta sem orçamento", () => {
    const c = nova();
    oferta(c);
    expect(() =>
      contrapropor(c, "oferta-teste", {
        salario: NaN,
        duracaoAnos: 3,
        papelPrometido: "titular",
      }),
    ).toThrow();
    c.clubes[1]!.orcamento = 100;
    expect(() => responderProposta(c, "oferta-teste", true)).toThrow(
      "orçamento",
    );
  });
  it("transfere apenas após assinatura, paga o clube vendedor e preserva papel e cláusula", () => {
    const c = nova();
    const p = oferta(c);
    p.clausulaRescisao = 3_000_000;
    const saldo = c.clubes[1]!.orcamento,
      vendedor = c.clubes[0]!.orcamento;
    const depois = responderProposta(c, p.id, true);
    expect(depois.clubes[1]!.orcamento).toBe(saldo - p.valorTransferencia!);
    expect(depois.clubes[0]!.orcamento).toBe(vendedor + p.valorTransferencia!);
    expect(depois.jogador.contrato.papelEsperado).toBe("titular");
    expect(depois.jogador.contrato.clausulaRescisao).toBe(3_000_000);
  });
  it("agenda transferência fora da janela e sondagem não pode ser aceita", () => {
    const c = nova();
    const p = oferta(c);
    c.dataAtual = "2026-09-01";
    p.validade = "2026-10-01";
    const depois = responderProposta(c, p.id, true);
    expect(depois.clubeAtualId).toBe(c.clubeAtualId);
    expect(depois.propostas[0]!.etapa).toBe("acordo_futuro");
    expect(depois.propostas[0]!.efetivarEm).toBe("2027-01-01");
    c.dataAtual = "2026-08-01";
    p.etapa = "sondagem";
    p.status = "pendente";
    expect(() => responderProposta(c, p.id, true)).toThrow("formal");
  });
  it("pré-contrato internacional aguarda fim do vínculo e mantém a liga consistente", () => {
    let c = nova();
    c.dataAtual = "2026-09-01";
    c.jogador.contrato.dataTermino = "2026-09-10";
    const destino = c.clubes.find((cl) => cl.ligaId !== c.liga.id)!;
    destino.orcamento = 50_000_000;
    const p = oferta(c, destino.id);
    p.preContrato = true;
    p.efetivarEm = "2026-09-11";
    p.valorTransferencia = 0;
    c = responderProposta(c, p.id, true);
    expect(c.clubeAtualId).toBe(c.clubeInicialId);
    expect(c.propostas[0]!.etapa).toBe("acordo");
    c = efetivarPreContratos(c);
    expect(c.clubeAtualId).toBe(c.clubeInicialId);
    c.dataAtual = "2026-09-11";
    c = efetivarPreContratos(c);
    expect(c.clubeAtualId).toBe(destino.id);
    expect(c.liga.id).toBe(destino.ligaId);
    expect(c.propostas[0]!.etapa).toBe("concluida");
  });
  it("promessa não sofre a mesma cobrança de minutos de um titular", () => {
    const c = nova();
    c.jogador.contrato.papelEsperado = "titular";
    const partidas = c.temporada.partidas
      .filter((p) => [p.mandanteId, p.visitanteId].includes(c.clubeAtualId!))
      .slice(0, 5);
    for (const p of partidas)
      p.participacao = {
        escalacao: "banco",
        entrada: 80,
        saida: 90,
        minutos: 10,
        gols: 0,
        assistencias: 0,
        chutes: 0,
        passes: 0,
        passesChave: 0,
        desarmes: 0,
        amarelos: 0,
        vermelhos: 0,
        faltas: 0,
        defesas: 0,
        nota: 6,
        confianca: 0,
        moral: 0,
        desenvolvimento: 0,
      };
    const promessa = structuredClone(c);
    promessa.jogador.contrato.papelEsperado = "promessa";
    const moral = c.jogador.moral;
    avaliarPapelPrometido(c);
    avaliarPapelPrometido(promessa);
    expect(c.jogador.moral).toBe(moral - 5);
    expect(promessa.jogador.moral).toBe(moral);
  });
  it("saves novos preservam observação, contraproposta e preferências; antigos ganham defaults", () => {
    let c = nova();
    c = conversarAgente(c, "contatar", c.clubes[1]!.id);
    oferta(c);
    c = contrapropor(c, "oferta-teste", {
      salario: 2300,
      duracaoAnos: 3,
      papelPrometido: "titular",
      clausulaRescisao: 5_000_000,
    });
    const carregado = validarSave(JSON.parse(JSON.stringify(c)));
    expect(carregado.mercado).toEqual(c.mercado);
    expect(carregado.propostas[0]!.contrapropostaPendente).toEqual(
      c.propostas[0]!.contrapropostaPendente,
    );
    const antigo = JSON.parse(JSON.stringify(nova()));
    delete antigo.mercado;
    expect(validarSave(antigo).mercado.interesses).toEqual([]);
  });
});
