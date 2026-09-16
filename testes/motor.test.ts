import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  calcularOverall,
  criarAtributosUniformes,
  determinarCategoriaInicial,
} from "@/dominio/regras/jogador";
import { gerarCalendarioLiga } from "@/simulacao/temporada/gerador-calendario";
import { calcularClassificacao } from "@/simulacao/temporada/classificacao";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
import { simularPartida } from "@/simulacao/partida/motor-partida";
import { determinarEscalacao } from "@/simulacao/partida/escalacao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { iniciarProximaTemporada } from "@/aplicacao/casos-de-uso/temporada";
import { calcularEvolucao } from "@/simulacao/evolucao/evolucao";
import { responderProposta } from "@/simulacao/transferencias/mercado";
const liga = LIGAS_SUPORTADAS[0],
  clubes = gerarClubesDemonstracao(liga);
function nova(idade = 18) {
  return criarCarreira({
    identidade: {
      nome: "Kauê",
      sobrenome: "Silva",
      nacionalidade: "Brasil",
      idade,
      posicao: "PD",
      posicaoSecundaria: "CA",
      peDominante: "direito",
      altura: 178,
      peso: 72,
      arquetipo: "velocista",
    },
    liga,
    clubes,
    clubeId: clubes[0].id,
    origem: "demonstracao",
    seed: "teste-reproduzivel",
    dataInicio: "2026-01-05",
  });
}
describe("regras de domínio", () => {
  it("aplica idade mínima e separa a base", () => {
    expect(() => determinarCategoriaInicial(14)).toThrow();
    expect(nova(15).jogador.categoria).toBe("base");
    expect(nova(16).jogador.categoria).toBe("base");
    expect(nova(17).jogador.categoria).toBe("profissional");
  });
  it("overall usa os pesos da posição", () => {
    const a = criarAtributosUniformes(50);
    a.finalizacao = 99;
    expect(calcularOverall(a, "CA")).toBeGreaterThan(50);
    expect(calcularOverall(a, "ZAG")).toBe(50);
    a.reflexos = 99;
    expect(calcularOverall(a, "GOL")).toBeGreaterThan(50);
  });
  it("seed reproduz a sequência e permite retomada", () => {
    const a = new GeradorAleatorio(gerarSeedNumerica("a")),
      b = new GeradorAleatorio(gerarSeedNumerica("a"));
    for (let i = 0; i < 100; i++) expect(a.proximo()).toBe(b.proximo());
    const c = new GeradorAleatorio(a.estado);
    expect(a.proximo()).toBe(c.proximo());
  });
});
describe("calendário e tabela", () => {
  for (const quantidade of [3, 4, 8, 18, 20])
    it(`gera turno e returno com ${quantidade} clubes`, () => {
      const ids = Array.from({ length: quantidade }, (_, i) => String(i)),
        partidas = gerarCalendarioLiga(ids, "2026-01-01");
      expect(partidas).toHaveLength(quantidade * (quantidade - 1));
      const pares = new Set(
        partidas.map((p) => `${p.mandanteId}-${p.visitanteId}`),
      );
      expect(pares.size).toBe(partidas.length);
      for (const rodada of new Set(partidas.map((p) => p.rodada))) {
        const participantes = partidas
          .filter((p) => p.rodada === rodada)
          .flatMap((p) => [p.mandanteId, p.visitanteId]);
        expect(new Set(participantes).size).toBe(participantes.length);
      }
    });
  it("contabiliza pontos, saldo e empates", () => {
    const partidas = gerarCalendarioLiga(["a", "b"], "2026-01-01");
    partidas[0].golsMandante = 2;
    partidas[0].golsVisitante = 0;
    partidas[1].golsMandante = 1;
    partidas[1].golsVisitante = 1;
    const tabela = calcularClassificacao(["a", "b"], partidas);
    expect(tabela[0].pontos).toBe(4);
    expect(tabela[0].saldo).toBe(2);
    expect(tabela[1].pontos).toBe(1);
    expect(tabela.reduce((s, l) => s + l.golsPro, 0)).toBe(
      tabela.reduce((s, l) => s + l.golsContra, 0),
    );
  });
});
describe("simulação", () => {
  it("dá vantagem estatística ao forte sem impedir zebras", () => {
    const forte = {
        ...clubes[0],
        forcaAtaque: 90,
        forcaDefesa: 90,
        forcaMeio: 90,
      },
      fraco = { ...clubes[1], forcaAtaque: 60, forcaDefesa: 60, forcaMeio: 60 },
      a = new GeradorAleatorio(42),
      p = gerarCalendarioLiga([forte.id, fraco.id], "2026-01-01")[0];
    let vitorias = 0,
      derrotas = 0;
    for (let i = 0; i < 2000; i++) {
      const r = simularPartida(p, forte, fraco, a);
      if (r.golsMandante! > r.golsVisitante!) vitorias++;
      if (r.golsMandante! < r.golsVisitante!) derrotas++;
    }
    expect(vitorias).toBeGreaterThan(1400);
    expect(derrotas).toBeGreaterThan(0);
  });
  it("lesão e suspensão impedem escalação", () => {
    const c = nova();
    c.jogador.suspensao = 1;
    expect(
      determinarEscalacao(c.jogador, clubes[0], new GeradorAleatorio(1)),
    ).toBe("suspenso");
    c.jogador.lesao = {
      tipo: "Contusão",
      gravidade: "leve",
      diasRecuperacao: 7,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: "2026-01-12",
    };
    expect(
      determinarEscalacao(c.jogador, clubes[0], new GeradorAleatorio(1)),
    ).toBe("lesionado");
  });
  it("admite titulares, banco e não relacionados", () => {
    const j = nova().jogador,
      a = new GeradorAleatorio(7),
      estados = new Set<string>();
    j.categoria = "profissional";
    for (let i = 0; i < 100; i++) {
      j.overall = i < 30 ? 92 : 45 + (i % 15);
      j.confianca = 20 + (i % 70);
      j.forma = 30 + (i % 50);
      j.fadiga = i % 50;
      j.lesao =
        i % 19 === 0
          ? {
              tipo: "teste",
              gravidade: "leve",
              diasRecuperacao: 7,
              dataInicio: "2026-01-01",
              dataPrevistaRetorno: "2026-01-08",
            }
          : null;
      j.suspensao = i % 21 === 0 ? 1 : 0;
      estados.add(determinarEscalacao(j, clubes[0], a));
    }
    expect(estados.has("titular")).toBe(true);
    expect(estados.has("banco") || estados.has("nao relacionado")).toBe(true);
    expect(estados.has("lesionado") || estados.has("suspenso")).toBe(true);
  });
  it("evolução é acumulativa e limitada", () => {
    const c = nova(16),
      antes = c.jogador.atributos.finalizacao;
    calcularEvolucao(c.jogador, ["finalizacao"], 1, clubes[0]);
    expect(c.jogador.atributos.finalizacao).toBe(antes);
    expect(c.jogador.desenvolvimento.finalizacao).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++)
      calcularEvolucao(c.jogador, ["finalizacao"], 8, clubes[0]);
    expect(c.jogador.atributos.finalizacao).toBeGreaterThan(antes);
    expect(c.jogador.atributos.finalizacao).toBeLessThanOrEqual(99);
  });
  it("processa o mundo, preserva imutabilidade e reproduz o save", () => {
    const c = nova(),
      a = avancarSemana(c),
      b = avancarSemana(JSON.parse(JSON.stringify(c)));
    expect(a).toEqual(b);
    expect(c.temporada.rodadaAtual).toBe(0);
    expect(
      a.temporada.partidas.filter((p) => p.golsMandante !== null),
    ).toHaveLength(4);
    expect(
      a.temporada.partidasBase.filter((p) => p.golsMandante !== null),
    ).toHaveLength(4);
  });
  it("mantém cronologia e estatísticas compatíveis ao longo de temporadas", () => {
    let c = nova(15);
    for (let ano = 0; ano < 6; ano++) {
      while (!c.temporada.encerrada) {
        c = avancarSemana(c);
        for (const p of [
          ...c.temporada.partidas,
          ...c.temporada.partidasBase,
        ].filter((p) => p.golsMandante !== null)) {
          expect(
            p.eventos.filter(
              (e) => e.tipo === "gol" && e.clubeId === p.mandanteId,
            ),
          ).toHaveLength(p.golsMandante!);
          expect(
            p.eventos.filter(
              (e) => e.tipo === "gol" && e.clubeId === p.visitanteId,
            ),
          ).toHaveLength(p.golsVisitante!);
          if (p.participacao) {
            expect(
              p.participacao.gols + p.participacao.assistencias,
            ).toBeLessThanOrEqual(p.golsMandante! + p.golsVisitante!);
            expect(p.participacao.minutos).toBeGreaterThanOrEqual(0);
          }
        }
      }
      const historico = structuredClone(c.registros);
      c = iniciarProximaTemporada(c);
      expect(c.registros).toEqual(historico);
      expect(c.temporada.rodadaAtual).toBe(0);
    }
    expect(c.temporadasAnteriores).toHaveLength(6);
    expect(c.jogador.idade).toBe(21);
    expect(c.jogador.categoria).toBe("profissional");
    expect(c.registros.some((r) => r.categoria === "base")).toBe(true);
  });
  it("transferência muda vínculo sem apagar estatísticas", () => {
    let c = avancarSemana(nova());
    c.propostas.push({
      id: "proposta",
      clubeId: clubes[1].id,
      tipo: "transferencia",
      salario: 2000,
      duracaoAnos: 3,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: "2026-02-01",
      status: "pendente",
    });
    const historico = structuredClone(c.registros);
    c = responderProposta(c, "proposta", true);
    expect(c.clubeAtualId).toBe(clubes[1].id);
    expect(c.jogador.contrato.clubeId).toBe(clubes[1].id);
    expect(c.registros).toEqual(historico);
    expect(() => responderProposta(c, "proposta", true)).toThrow();
  });
});
describe("ciclo e decisões", () => {
  it("mantém estatísticas separadas após transferência e permite renovar", () => {
    let c = nova();
    c.jogador.overall = 95;
    c.jogador.confianca = 95;
    c = avancarSemana(c);
    const antes = structuredClone(c.registros);
    c.propostas.push({
      id: "troca",
      clubeId: clubes[1].id,
      tipo: "transferencia",
      salario: 3500,
      duracaoAnos: 2,
      papelPrometido: "rotacao",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: "2026-02-01",
      status: "pendente",
    });
    c = responderProposta(c, "troca", true);
    c.jogador.confianca = 95;
    c.jogador.overall = 99;
    c.jogador.status = "estrela do time";
    for (let i = 0; i < 6; i++) {
      c = avancarSemana(c);
      if (c.registros.some((r) => r.clubeId === clubes[1].id)) break;
    }
    expect(c.registros[0]).toEqual(antes[0]);
    expect(c.registros.some((r) => r.clubeId === clubes[1].id)).toBe(true);
    c.propostas.push({
      id: "renova",
      clubeId: clubes[1].id,
      tipo: "renovacao",
      salario: 4500,
      duracaoAnos: 4,
      papelPrometido: "titular",
      etapa: "proposta_jogador",
      data: c.dataAtual,
      validade: "2026-03-01",
      status: "pendente",
    });
    c = responderProposta(c, "renova", true);
    expect(c.jogador.contrato.salario).toBe(4500);
    expect(c.clubeAtualId).toBe(clubes[1].id);
  });
  it("recupera lesões e cumpre suspensão somente em partidas elegíveis", () => {
    let c = nova();
    c.jogador.lesao = {
      tipo: "Contusão",
      gravidade: "moderada",
      diasRecuperacao: 21,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: "2026-01-26",
    };
    c.focoTreino = "recuperacao";
    c = avancarSemana(c);
    expect(c.jogador.lesao?.diasRecuperacao).toBe(14);
    const p = c.temporada.partidas.find((p) => p.id === c.ultimaPartidaId)!;
    expect(p.participacao?.minutos).toBe(0);
    c = avancarSemana(avancarSemana(c));
    expect(c.jogador.lesao).toBeNull();
    c.jogador.suspensao = 1;
    c = avancarSemana(c);
    expect(
      c.temporada.partidas.find((p) => p.id === c.ultimaPartidaId)?.participacao
        ?.escalacao,
    ).toBe("suspenso");
    expect(c.jogador.suspensao).toBe(0);
  });
  it("não concede promoção automática aos 17 anos", () => {
    let c = nova(16);
    while (!c.temporada.encerrada) c = avancarSemana(c);
    c = iniciarProximaTemporada(c);
    c.jogador.overall = 45;
    c.jogador.confianca = 20;
    c.jogador.forma = 30;
    c = avancarSemana(c);
    expect(c.jogador.idade).toBe(17);
    expect(c.jogador.categoria).toBe("base");
  });
  it("uma temporada encerrada não pode simular novamente", () => {
    let c = nova();
    while (!c.temporada.encerrada) c = avancarSemana(c);
    expect(avancarSemana(c)).toBe(c);
    expect(c.temporadasAnteriores).toHaveLength(1);
  });
});
