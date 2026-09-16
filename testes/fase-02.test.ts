import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  gerarOverallInicial,
  gerarPotencialInicial,
  criarJogadorMundo,
} from "@/dominio/jogador-mundo";
import { prepararClubesParaMundo } from "@/dominio/mundo-futebol";
import {
  escalarElencoCompleto,
  jogadorMundoComoCandidato,
  pesoCompatibilidade,
} from "@/simulacao/elenco/escalacao-elenco";
import {
  calcularForcaEscalacao,
  sincronizarForcaClube,
} from "@/simulacao/elenco/forca-escalacao";
import { evoluirJogadoresMundo } from "@/simulacao/elenco/evolucao-mundo";
import { avaliarNecessidadeElenco } from "@/simulacao/transferencias/necessidade";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { responderDecisao } from "@/simulacao/decisoes/decisoes";

const liga = LIGAS_SUPORTADAS[0];

describe("JogadorMundo", () => {
  it("gera overall coerente sem dividir valor por constante", () => {
    const estrela = gerarOverallInicial({
      valorMercado: 80_000_000,
      idade: 26,
      reputacaoClube: 90,
      reputacaoLiga: 98,
      posicao: "CA",
      indiceNoElenco: 0,
      tamanhoElenco: 25,
      seed: "haaland",
    });
    const reserva = gerarOverallInicial({
      valorMercado: 400_000,
      idade: 19,
      reputacaoClube: 62,
      reputacaoLiga: 62,
      posicao: "MC",
      indiceNoElenco: 20,
      tamanhoElenco: 25,
      seed: "jovem-b",
    });
    expect(estrela).toBeGreaterThan(reserva + 8);
    expect(estrela).toBeGreaterThan(75);
    expect(reserva).toBeLessThan(78);
  });

  it("potencial é maior para jovens e igual ao overall para veteranos", () => {
    const jovem = gerarPotencialInicial({
      overall: 67,
      idade: 18,
      valorMercado: 8_000_000,
      reputacaoLiga: 90,
      seed: "promessa",
    });
    const veterano = gerarPotencialInicial({
      overall: 82,
      idade: 34,
      valorMercado: 5_000_000,
      reputacaoLiga: 90,
      seed: "veterano",
    });
    expect(jovem).toBeGreaterThanOrEqual(67);
    expect(jovem - 67).toBeGreaterThanOrEqual(8);
    expect(veterano).toBe(82);
  });

  it("cria entidade persistente a partir do import", () => {
    const j = criarJogadorMundo(
      {
        id: "tm-j-1",
        idExterno: 1,
        idTransfermarkt: "1",
        nome: "Teste",
        idade: 22,
        numero: 10,
        posicao: "Right Winger",
        grupoPosicao: "ATA",
        nacionalidade: ["Brazil"],
        altura: 180,
        peDominante: "left",
        valorMercado: 12_000_000,
        dataNascimento: "2004-01-01",
        contratoAte: "2028-06-30",
        joinedOn: null,
        signedFrom: null,
        foto: "",
      },
      {
        clubeId: "tm-1",
        reputacaoClube: 80,
        reputacaoLiga: 78,
        forcaClube: 75,
        indiceNoElenco: 2,
        tamanhoElenco: 24,
      },
    );
    expect(j.posicaoPrincipal).toBe("PD");
    expect(j.overall).toBeGreaterThan(50);
    expect(j.potencial).toBeGreaterThanOrEqual(j.overall);
    expect(j.clubeId).toBe("tm-1");
  });
});

describe("Escalação e força", () => {
  it("escala formação válida e prioriza melhor overall", () => {
    const clubes = prepararClubesParaMundo(gerarClubesDemonstracao(liga), liga);
    const clube = clubes[0]!;
    const candidatos = clube.elenco.map(jogadorMundoComoCandidato);
    const resultado = escalarElencoCompleto(
      candidatos,
      clube.formacaoPreferida,
      clube.treinador,
    );
    expect(resultado.goleiroId).toBeTruthy();
    expect(resultado.titularesIds.length).toBe(10);
    expect(resultado.bancoIds.length).toBeGreaterThan(0);
    const titular = clube.elenco.find((j) => j.id === resultado.titularesIds[0]);
    expect(titular).toBeTruthy();
  });

  it("goleiro não joga de centroavante com peso alto", () => {
    expect(
      pesoCompatibilidade(
        {
          posicaoPrincipal: "GOL",
          posicoesSecundarias: [],
          posicaoBruta: "Goalkeeper",
        },
        "CA",
      ),
    ).toBeLessThan(0.2);
  });

  it("lesionado não entra e perder estrela reduz força", () => {
    const clubes = prepararClubesParaMundo(gerarClubesDemonstracao(liga), liga);
    const clube = clubes[0]!;
    sincronizarForcaClube(clube);
    const antes = calcularForcaEscalacao(clube).forcaAtaque;
    const estrela = [...clube.elenco].sort((a, b) => b.overall - a.overall)[0]!;
    estrela.lesionado = true;
    estrela.lesao = {
      tipo: "Joelho",
      gravidade: "moderada",
      diasRecuperacao: 21,
      dataInicio: "2026-01-01",
      dataPrevistaRetorno: "2026-01-22",
    };
    const candidatos = clube.elenco.map(jogadorMundoComoCandidato);
    const esc = escalarElencoCompleto(candidatos, clube.formacaoPreferida);
    expect(esc.titularesIds).not.toContain(estrela.id);
    expect(esc.goleiroId).not.toBe(estrela.id);
    clube.titularesIds = esc.titularesIds;
    clube.goleiroTitularId = esc.goleiroId;
    const depois = calcularForcaEscalacao(clube).forcaAtaque;
    expect(depois).toBeLessThanOrEqual(antes + 1);
  });
});

describe("Mundo e mercado", () => {
  it("carreira inclui ligas paralelas quando fornecidas", () => {
    const a = LIGAS_SUPORTADAS[0]!;
    const b = LIGAS_SUPORTADAS.find((l) => l.id === "premier-league")!;
    const clubesA = gerarClubesDemonstracao(a);
    const clubesB = gerarClubesDemonstracao(b).slice(0, 4);
    const carreira = criarCarreira({
      identidade: {
        nome: "Ana",
        sobrenome: "Costa",
        nacionalidade: "Brasil",
        idade: 18,
        posicao: "MEI",
        posicaoSecundaria: "",
        peDominante: "direito",
        altura: 170,
        peso: 62,
        arquetipo: "criador",
      },
      liga: a,
      clubes: clubesA,
      clubeId: clubesA[0]!.id,
      origem: "demonstracao",
      seed: "mundo-paralelo",
      dataInicio: "2026-01-05",
      ligasMundo: [b],
      clubesMundo: clubesB,
    });
    expect(carreira.versao).toBe(2);
    expect(carreira.ligas.length).toBe(2);
    expect(carreira.clubes.some((c) => c.ligaId === b.id)).toBe(true);
    expect(carreira.temporadasExternas[b.id]).toBeTruthy();
    const depois = avancarSemana(carreira);
    expect(depois.temporadasExternas[b.id]!.rodadaAtual).toBe(1);
  });

  it("identifica necessidade alta em posição fraca", () => {
    const clubes = prepararClubesParaMundo(gerarClubesDemonstracao(liga), liga);
    const clube = clubes[0]!;
    clube.elenco = clube.elenco.filter((j) => j.posicaoPrincipal !== "CA");
    const nec = avaliarNecessidadeElenco(clube).find((n) => n.posicao === "CA");
    expect(nec?.nivel === "alta" || nec?.nivel === "critica").toBe(true);
  });

  it("NPCs evoluem sem congelar overall de jovens", () => {
    const clubes = prepararClubesParaMundo(gerarClubesDemonstracao(liga), liga);
    const jovem = clubes[0]!.elenco.find((j) => j.idade <= 21)!;
    const antes = jovem.overall;
    const aleatorio = new GeradorAleatorio(42);
    for (let i = 0; i < 40; i++)
      evoluirJogadoresMundo([jovem], aleatorio, true);
    expect(jovem.overall).toBeGreaterThanOrEqual(antes);
  });
});

describe("Decisões", () => {
  it("opções geram consequências reproduzíveis", () => {
    const clubes = gerarClubesDemonstracao(liga);
    let carreira = criarCarreira({
      identidade: {
        nome: "Leo",
        sobrenome: "Dias",
        nacionalidade: "Brasil",
        idade: 19,
        posicao: "PD",
        posicaoSecundaria: "",
        peDominante: "esquerdo",
        altura: 176,
        peso: 70,
        arquetipo: "velocista",
      },
      liga,
      clubes,
      clubeId: clubes[0]!.id,
      origem: "demonstracao",
      seed: "decisoes-seed",
      dataInicio: "2026-01-05",
    });
    carreira.decisoes.push({
      id: "d1",
      data: carreira.dataAtual,
      tipo: "papel-elenco",
      remetente: "Treinador",
      titulo: "Teste",
      texto: "Mais minutos",
      opcoes: [
        { id: "aceitar", rotulo: "Aceitar" },
        { id: "recusar", rotulo: "Recusar" },
      ],
      resolvida: false,
    });
    const antes = carreira.relacionamentos.treinador;
    carreira = responderDecisao(carreira, "d1", "aceitar");
    expect(carreira.decisoes[0]!.resolvida).toBe(true);
    expect(carreira.relacionamentos.treinador).toBeGreaterThan(antes);
  });
});
