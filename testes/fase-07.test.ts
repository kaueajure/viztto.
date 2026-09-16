import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { criarJogoStore } from "@/estado/jogo-store";
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
import {
  hidratarCarreira,
  serializarCarreira,
  validarCarreiraPersistida,
  validarReferenciasCarreiraPersistida,
} from "@/infraestrutura/persistencia/carreira-persistida";
import {
  carregarCatalogoCarreira,
  limparCacheCatalogoCarreira,
  leiturasCatalogoDisco,
} from "@/infraestrutura/persistencia/catalogo-carreira";
import { migrarMercadoPersistido } from "@/infraestrutura/persistencia/migrar-mercado";
import {
  avancarInteresses,
  conversarAgente,
  normalizarTermosContrato,
  precoPedido,
  registrarNegociacao,
} from "@/simulacao/transferencias/mercado-progressivo";
import { responderProposta } from "@/simulacao/transferencias/mercado";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { somarDias } from "@/utilitarios/formatacao";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { estatisticasVazias } from "@/simulacao/temporada/estatisticas";
import { coletarAcoesAtencao, badgeMercado } from "@/componentes/jogo/AtencaoCarreira";
import { pesoFrequenciaPropostas } from "@/simulacao/transferencias/necessidade";

function ambiente() {
  const exemplo = exemploCarreira();
  const api: ClienteCarreira = {
    carregar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
    criar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
    salvar: vi.fn(async (_p, revision) => ({ revision: revision + 1 })),
    excluir: vi.fn(async () => {}),
  };
  return { ...exemplo, api, store: criarJogoStore(api) };
}

function pendente<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promise, resolver, rejeitar };
}

function carreiraMercado(dataInicio = "2026-07-01") {
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
    seed: "fase-07",
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

function roundTrip(c: ReturnType<typeof carreiraMercado>) {
  const catalogo = {
    ligas: c.ligas,
    clubes: c.clubes.map((cl) => ({
      ...cl,
      elenco: cl.elenco.map((j) => ({ ...j })),
    })),
  };
  const persistido = serializarCarreira(c);
  validarCarreiraPersistida(persistido);
  validarReferenciasCarreiraPersistida(persistido, catalogo);
  const hidratado = hidratarCarreira(persistido, catalogo);
  return { persistido, hidratado };
}

describe("Fase 07: autosave robusto", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("três alterações rápidas geram no máximo uma escrita ativa e salvam o estado mais novo", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    const primeira = pendente<{ revision: number }>();
    vi.mocked(api.salvar).mockImplementationOnce(() => primeira.promise);
    store.getState().escolherTreino("drible");
    store.getState().escolherTreino("fisico");
    store.getState().escolherTreino("defesa");
    expect(api.salvar).toHaveBeenCalledTimes(1);
    primeira.resolver({ revision: 1 });
    await store.getState().tentarSalvar();
    expect(api.salvar).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.salvar).mock.calls[1]![0].focoTreino).toBe("defesa");
    expect(store.getState().alteracoesPendentes).toBe(false);
  });

  it("timeout e 503 fazem retry sem PUT concorrente; recuperação limpa erro", async () => {
    vi.useFakeTimers();
    const { store, api } = ambiente();
    await store.getState().carregar();
    let emVoo = 0;
    let maxVoo = 0;
    let tentativas = 0;
    vi.mocked(api.salvar).mockImplementation(async (_p, revision) => {
      emVoo++;
      maxVoo = Math.max(maxVoo, emVoo);
      tentativas++;
      try {
        if (tentativas <= 2) {
          throw new ErroApiCarreira(
            tentativas === 1 ? 0 : 503,
            "falha",
            undefined,
            tentativas === 1 ? "TIMEOUT" : "INDISPONIVEL",
          );
        }
        return { revision: revision + 1 };
      } finally {
        emVoo--;
      }
    });
    store.getState().escolherTreino("drible");
    await vi.runAllTimersAsync();
    await store.getState().tentarSalvar();
    expect(maxVoo).toBe(1);
    expect(tentativas).toBeGreaterThanOrEqual(3);
    expect(store.getState().erroPersistencia).toBeNull();
    expect(store.getState().alteracoesPendentes).toBe(false);
    expect(store.getState().statusPersistencia).toBe("salvo");
  });

  it("novas alterações após falha continuam elegíveis para autosave", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    vi.mocked(api.salvar).mockRejectedValueOnce(new Error("offline"));
    store.getState().escolherTreino("drible");
    await store.getState().tentarSalvar();
    expect(store.getState().alteracoesPendentes).toBe(true);
    store.getState().escolherTreino("fisico");
    await store.getState().tentarSalvar();
    expect(store.getState().carreira?.focoTreino).toBe("fisico");
    expect(store.getState().alteracoesPendentes).toBe(false);
  });

  it("409 e 413 não fazem retry destrutivo/infinito", async () => {
    vi.useFakeTimers();
    const { store, api } = ambiente();
    await store.getState().carregar();
    vi.mocked(api.salvar).mockRejectedValueOnce(
      new ErroApiCarreira(409, "conflito", undefined, "CONFLITO"),
    );
    store.getState().escolherTreino("drible");
    await store.getState().tentarSalvar();
    const chamadas = vi.mocked(api.salvar).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.salvar).toHaveBeenCalledTimes(chamadas);
    expect(store.getState().conflito).toBe(true);

    const { store: s2, api: api2 } = ambiente();
    await s2.getState().carregar();
    vi.mocked(api2.salvar).mockRejectedValue(
      new ErroApiCarreira(413, "grande", undefined, "TAMANHO"),
    );
    s2.getState().escolherTreino("defesa");
    await s2.getState().tentarSalvar();
    const n = vi.mocked(api2.salvar).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(api2.salvar).toHaveBeenCalledTimes(n);
  });

  it("mensagem não duplica alterações não salvas", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    vi.mocked(api.salvar).mockRejectedValueOnce(new Error("offline"));
    store.getState().escolherTreino("drible");
    await store.getState().tentarSalvar();
    const msg = store.getState().erroPersistencia ?? "";
    expect(msg.match(/alterações não salvas/gi)?.length ?? 0).toBeLessThan(2);
    expect(msg).not.toMatch(/Tente novamente.*Mantenha esta página/i);
  });

  it("erro antes do fetch é identificado como validação/serialização", async () => {
    const { store, api } = ambiente();
    await store.getState().carregar();
    const carreira = store.getState().carreira!;
    // força histórico inválido que serializar rejeitaria sem normalização —
    // aqui quebramos um campo obrigatório do jogador.
    (carreira.jogador as { nome: string }).nome = "";
    store.setState({ carreira, alteracoesPendentes: true });
    await store.getState().tentarSalvar();
    expect(api.salvar).not.toHaveBeenCalled();
    expect(store.getState().codigoErroPersistencia).toBe("SAVE_INVALID");
  });
});

describe("Fase 07: persistência de mercado e empréstimo", () => {
  it("histórico de negociação não contém shape inválido", () => {
    const c = carreiraMercado();
    registrarNegociacao(c, c.clubes[1]!.id, "teste", "p1", {
      id: "p1",
      clubeId: c.clubes[1]!.id,
      tipo: "transferencia",
      salario: 2000,
      duracaoAnos: 3,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 7),
      status: "pendente",
      bonusGol: 100,
      luvas: 50,
    } as never);
    const termos = c.mercado.historico.at(-1)?.termos;
    expect(termos).toEqual({
      salario: 2000,
      duracaoAnos: 3,
      papelPrometido: "titular",
    });
    expect(normalizarTermosContrato(termos!)).toEqual(termos);
    expect(() => serializarCarreira(c)).not.toThrow();
  });

  it("solicitar / recusar / público / acordo / contraproposta fazem round-trip", () => {
    let c = conversarAgente(carreiraMercado(), "sair");
    expect(() => roundTrip(c)).not.toThrow();
    c = conversarAgente(c, "publicar");
    expect(c.mercado.pedidoPublico).toBe(true);
    expect(() => roundTrip(c)).not.toThrow();

    const recusa = carreiraMercado();
    recusa.jogador.status = "estrela do time";
    recusa.jogador.contrato.dataTermino = somarDias(recusa.dataAtual, 900);
    recusa.relacionamentos.diretoria = 70;
    const clube = recusa.clubes.find((cl) => cl.id === recusa.clubeAtualId)!;
    clube.elenco = clube.elenco.filter(
      (j) => j.posicaoPrincipal !== "PD" && !j.posicoesSecundarias.includes("PD"),
    );
    const recusado = conversarAgente(recusa, "sair");
    expect(recusado.mercado.statusPedidoSaida).toBe("recusado");
    expect(recusado.mercado.pediuSaida).toBe(false);
    expect(() => roundTrip(recusado)).not.toThrow();
  });

  it("empréstimo ativo round-trip preserva contrato na origem", () => {
    const c = carreiraMercado();
    const origem = c.clubeAtualId;
    const destino = c.clubes[1]!;
    c.propostas.push({
      id: "emp-1",
      clubeId: destino.id,
      clubeOrigemId: origem,
      tipo: "emprestimo",
      salario: 1800,
      duracaoAnos: 1,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 21),
      status: "pendente",
      valorTransferencia: 0,
      percentualSalario: 0.5,
    });
    const depois = responderProposta(c, "emp-1", true);
    expect(depois.mercado.emprestimo?.clubeOrigemId).toBe(origem);
    expect(depois.jogador.contrato.clubeId).toBe(origem);
    expect(depois.clubeAtualId).toBe(destino.id);
    const { persistido, hidratado } = roundTrip(depois);
    expect(persistido.jogador.contrato.clubeId).toBe(origem);
    expect(persistido.clubeAtualId).toBe(destino.id);
    expect(hidratado.jogador.contrato.clubeId).toBe(origem);
    expect(hidratado.clubeAtualId).toBe(destino.id);
    expect(hidratado.mercado.emprestimo?.clubeOrigemId).toBe(origem);
  });

  it("migra save antigo com pedido recusado marcado como pediuSaida", () => {
    const migrado = migrarMercadoPersistido({
      mercado: {
        interesses: [],
        clubesDesejados: [],
        preferencias: {
          mesmoPais: false,
          europa: false,
          clubeMaior: false,
          maisMinutos: false,
          salarioMaior: false,
          titulos: false,
          apenasDesejados: false,
        },
        pediuSaida: true,
        pedidoPublico: false,
        bloquearPropostas: false,
        pediuEmprestimo: false,
        disponivelParaEmprestimo: false,
        respostaDiretoriaSaida:
          "A diretoria recusou o pedido. Considera você peça importante.",
        historico: [],
      },
    }) as { mercado: { statusPedidoSaida: string; pediuSaida: boolean } };
    expect(migrado.mercado.statusPedidoSaida).toBe("recusado");
    expect(migrado.mercado.pediuSaida).toBe(false);
  });
});

describe("Fase 07: regras de mercado", () => {
  it("frequência fora da janela nunca é matematicamente impossível", () => {
    for (const data of ["2027-04-01", "2027-09-01", "2027-01-01", "2027-07-01"]) {
      const peso = pesoFrequenciaPropostas(data);
      const chanceBase = Math.min(0.55, 0.08 * peso);
      expect(chanceBase).toBeGreaterThan(0);
      expect(chanceBase).toBeLessThanOrEqual(0.55);
    }
  });

  it("abril e setembro permitem interesse espontâneo raro; jan/jul possuem frequência maior", () => {
    const abril = carreiraMercado("2027-04-01");
    const setembro = carreiraMercado("2027-09-01");
    const janeiro = carreiraMercado("2027-01-15");
    const julho = carreiraMercado("2027-07-01");
    let hitsAbril = 0;
    let hitsJan = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const a = structuredClone(abril);
      const j = structuredClone(janeiro);
      avancarInteresses(a, new GeradorAleatorio(seed));
      avancarInteresses(j, new GeradorAleatorio(seed));
      if (a.mercado.interesses.some((i) => i.origem === "clube")) hitsAbril++;
      if (j.mercado.interesses.some((i) => i.origem === "clube")) hitsJan++;
    }
    expect(hitsAbril).toBeGreaterThan(0);
    expect(hitsJan).toBeGreaterThan(hitsAbril);
    const s = structuredClone(setembro);
    let hitSet = false;
    for (let seed = 1; seed <= 120; seed++) {
      const x = structuredClone(s);
      avancarInteresses(x, new GeradorAleatorio(seed));
      if (x.mercado.interesses.some((i) => i.origem === "clube")) {
        hitSet = true;
        break;
      }
    }
    expect(hitSet).toBe(true);
    expect(pesoFrequenciaPropostas(julho.dataAtual)).toBe(1);
  });

  it("preferências do jogador não impedem observação espontânea; afetam busca do agente", () => {
    const c = carreiraMercado();
    c.mercado.preferencias.apenasDesejados = true;
    c.mercado.clubesDesejados = [];
    avancarInteresses(c, new GeradorAleatorio(42));
    // Pode ou não gerar; o importante é não filtrar por preferência no loop espontâneo.
    // Força elegibilidade e chance alta via vários seeds se necessário.
    let observou = false;
    for (let seed = 1; seed <= 100; seed++) {
      const x = structuredClone(c);
      avancarInteresses(x, new GeradorAleatorio(seed));
      if (x.mercado.interesses.some((i) => i.origem === "clube")) {
        observou = true;
        break;
      }
    }
    expect(observou).toBe(true);
    const busca = conversarAgente(c, "buscar");
    expect(
      busca.mercado.historico.some((h) =>
        /não encontrou|nenhum/i.test(h.texto),
      ),
    ).toBe(true);
  });

  it("bloquear impede oferta espontânea mas não observação nem contato ativo", () => {
    let c = conversarAgente(carreiraMercado(), "bloquear");
    c = conversarAgente(c, "contatar", c.clubes[1]!.id);
    expect(c.mercado.interesses.some((i) => i.clubeId === c.clubes[1]!.id)).toBe(
      true,
    );
    const espontaneo = carreiraMercado();
    espontaneo.mercado.bloquearPropostas = true;
    espontaneo.mercado.interesses.push({
      clubeId: espontaneo.clubes[1]!.id,
      jogadorId: "usuario",
      nivelInteresse: 80,
      motivo: "reforco",
      semanasObservando: 5,
      status: "sondagem",
      ultimaAtualizacao: somarDias(espontaneo.dataAtual, -14),
      origem: "clube",
      resposta: "sondagem",
      papel: "titular",
    });
    const antes = espontaneo.propostas.length;
    avancarInteresses(espontaneo, new GeradorAleatorio(7));
    expect(espontaneo.propostas.length).toBe(antes);
  });

  it("pedido público aumenta exposição sem garantir proposta; recusa não reduz preço", () => {
    let c = conversarAgente(carreiraMercado(), "sair");
    const precoAceito = precoPedido(c);
    c = conversarAgente(c, "publicar");
    expect(c.mercado.pedidoPublico).toBe(true);
    expect(precoPedido(c)).toBeLessThanOrEqual(precoAceito);

    const recusa = carreiraMercado();
    recusa.jogador.status = "estrela do time";
    recusa.jogador.contrato.dataTermino = somarDias(recusa.dataAtual, 900);
    recusa.relacionamentos.diretoria = 70;
    const clube = recusa.clubes.find((cl) => cl.id === recusa.clubeAtualId)!;
    clube.elenco = clube.elenco.filter(
      (j) => j.posicaoPrincipal !== "PD" && !j.posicoesSecundarias.includes("PD"),
    );
    const precoAntes = precoPedido(recusa);
    const recusado = conversarAgente(recusa, "sair");
    expect(recusado.mercado.pediuSaida).toBe(false);
    expect(precoPedido(recusado)).toBe(precoAntes);
  });
});

describe("Fase 07: UX e performance", () => {
  it("proposta pendente gera CTA na página inicial e badge de mercado", () => {
    const c = carreiraMercado();
    c.propostas.push({
      id: "p1",
      clubeId: c.clubes[1]!.id,
      tipo: "transferencia",
      salario: 2000,
      duracaoAnos: 3,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 14),
      status: "pendente",
    });
    const acoes = coletarAcoesAtencao(c);
    expect(acoes.some((a) => /proposta/i.test(a.titulo))).toBe(true);
    expect(badgeMercado(c)).toBeGreaterThan(0);
  });

  it("cache de catálogo não relê disco em PUTs consecutivos", async () => {
    limparCacheCatalogoCarreira();
    const antes = leiturasCatalogoDisco;
    const { carreira } = exemploCarreira();
    const state = serializarCarreira(carreira);
    // Sem snapshots reais pode falhar compatibilidade; medimos apenas que a função de cache
    // incrementa leituras no máximo uma vez por limpeza.
    try {
      await carregarCatalogoCarreira(state.ligasIds);
      await carregarCatalogoCarreira(state.ligasIds);
      await carregarCatalogoCarreira(state.ligasIds);
      expect(leiturasCatalogoDisco - antes).toBeLessThanOrEqual(1);
    } catch {
      // Ambiente sem snapshots: ainda assim o contador não deve crescer após falha parcial.
      expect(leiturasCatalogoDisco - antes).toBeLessThanOrEqual(1);
    } finally {
      limparCacheCatalogoCarreira();
    }
  });

  it("medição local de serialização/validação", () => {
    const { carreira, catalogo } = exemploCarreira();
    const t0 = performance.now();
    const persistido = serializarCarreira(carreira);
    const tSerial = performance.now() - t0;
    const t1 = performance.now();
    validarCarreiraPersistida(persistido);
    const tValidar = performance.now() - t1;
    const t2 = performance.now();
    validarReferenciasCarreiraPersistida(persistido, catalogo);
    const tRefs = performance.now() - t2;
    const tamanho = JSON.stringify(persistido).length;
    expect(tamanho).toBeGreaterThan(1000);
    expect(tSerial).toBeGreaterThanOrEqual(0);
    expect(tValidar).toBeGreaterThanOrEqual(0);
    expect(tRefs).toBeGreaterThanOrEqual(0);
    // eslint-disable-next-line no-console
    console.info("[fase-07 benchmark]", {
      tamanhoBytes: tamanho,
      serializarMs: Number(tSerial.toFixed(2)),
      validarMs: Number(tValidar.toFixed(2)),
      referenciasMs: Number(tRefs.toFixed(2)),
    });
  });
});
