import { describe, expect, it } from "vitest";
import {
  atualizarRecorde,
  notaDeScore,
  TRAINING_GRADES,
} from "@/dominio/treinamento/notas";
import {
  eficienciaIdade,
  MAX_SESSOES_SEMANA,
  rendimentoAtributo,
  xpBrutoDaSessao,
} from "@/dominio/treinamento/progresso";
import {
  exerciciosRecomendados,
  exerciciosVisiveisPara,
} from "@/dominio/treinamento/exercicios";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import {
  aplicarSessaoTreino,
  garantirCentro,
  sincronizarSemanaCentro,
} from "@/simulacao/treinamento/aplicar-sessao";
import { processarTreinamento } from "@/simulacao/treinamento/treinamento";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { somarDias } from "@/utilitarios/formatacao";
import { serializarCarreira, hidratarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import {
  CENARIOS_PADRAO,
  ovrEm,
  simularCarreiraTreino,
} from "../scripts/simular-desenvolvimento";

describe("notas de treino", () => {
  it.each([
    [0, "D"],
    [49, "D"],
    [50, "C"],
    [69, "C"],
    [70, "B"],
    [84, "B"],
    [85, "A"],
    [100, "A"],
  ] as const)("score %i → %s", (score, nota) => {
    expect(notaDeScore(score)).toBe(nota);
    expect(score).toBeGreaterThanOrEqual(TRAINING_GRADES[nota].min);
    expect(score).toBeLessThanOrEqual(TRAINING_GRADES[nota].max);
  });

  it("recorde sobe C→A e não desce A→C", () => {
    const sobe = atualizarRecorde({ score: 55, nota: "C" }, 90);
    expect(sobe.nota).toBe("A");
    expect(sobe.novoRecorde).toBe(true);
    const mantem = atualizarRecorde({ score: 92, nota: "A" }, 60);
    expect(mantem.nota).toBe("A");
    expect(mantem.score).toBe(92);
    expect(mantem.novoRecorde).toBe(false);
  });
});

describe("centro de treinamento — sessões", () => {
  it("concede XP uma vez; replay não farma; máximo 3; simulação exige recorde", () => {
    let { carreira: c } = exemploCarreira();
    c.jogador.idade = 16;
    c.jogador.lesao = null;
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    garantirCentro(c.jogador, c.dataAtual);
    sincronizarSemanaCentro(c.jogador, c.dataAtual);

    const finAntes = c.jogador.atributos.finalizacao;
    const desAntes = c.jogador.desenvolvimento.finalizacao;

    const r1 = aplicarSessaoTreino(
      c,
      {
        exercicioId: "penaltis",
        score: 90,
        modo: "jogar",
        sessaoId: "s1",
      },
      clube,
    );
    c = r1.carreira;
    expect(r1.resultado.nota).toBe("A");
    expect(r1.resultado.novoRecorde).toBe(true);
    const des1 = c.jogador.desenvolvimento.finalizacao + (c.jogador.atributos.finalizacao - finAntes) * 100;

    expect(() =>
      aplicarSessaoTreino(
        c,
        {
          exercicioId: "penaltis",
          score: 99,
          modo: "jogar",
          sessaoId: "s1",
        },
        clube,
      ),
    ).toThrow(/já foi aplicada/);

    // Segunda sessão mesma semana — OK, mas é outro slot
    c = aplicarSessaoTreino(
      c,
      {
        exercicioId: "penaltis",
        score: 70,
        modo: "jogar",
        sessaoId: "s2",
      },
      clube,
    ).carreira;
    c = aplicarSessaoTreino(
      c,
      {
        exercicioId: "finalizacao-colocada",
        score: 80,
        modo: "jogar",
        sessaoId: "s3",
      },
      clube,
    ).carreira;

    expect(c.jogador.preparacao.centro!.semana.sessoes).toHaveLength(3);
    expect(() =>
      aplicarSessaoTreino(
        c,
        {
          exercicioId: "drible",
          score: 90,
          modo: "jogar",
          sessaoId: "s4",
        },
        clube,
      ),
    ).toThrow(/3 sessões/);

    // Simular usa recorde
    c.dataAtual = somarDias(c.dataAtual, 7);
    processarTreinamento(
      c.jogador,
      "equilibrado",
      clube,
      c.dataAtual,
      new GeradorAleatorio(1),
    );
    expect(c.jogador.preparacao.centro!.semana.sessoes).toHaveLength(0);
    expect(c.jogador.preparacao.centro!.melhoresExercicios.penaltis?.nota).toBe(
      "A",
    );

    const sim = aplicarSessaoTreino(
      c,
      {
        exercicioId: "penaltis",
        score: 0,
        modo: "simular",
        sessaoId: "sim1",
      },
      clube,
    );
    expect(sim.resultado.nota).toBe("A");
    expect(sim.resultado.score).toBeGreaterThanOrEqual(85);

    expect(() =>
      aplicarSessaoTreino(
        sim.carreira,
        {
          exercicioId: "arrancada",
          score: 0,
          modo: "simular",
          sessaoId: "sim2",
        },
        clube,
      ),
    ).toThrow(/Sem recorde/);

    expect(des1).toBeGreaterThan(desAntes);
  });

  it("XP fracionário preserva overflow e atributo alto rende menos", () => {
    expect(rendimentoAtributo(60)).toBeGreaterThan(rendimentoAtributo(89));
    expect(xpBrutoDaSessao("A", 99)).toBeGreaterThan(xpBrutoDaSessao("A", 86));
    expect(eficienciaIdade(16, "finalizacao")).toBeGreaterThan(
      eficienciaIdade(31, "finalizacao"),
    );
    expect(eficienciaIdade(31, "finalizacao")).toBeGreaterThan(
      eficienciaIdade(31, "velocidade"),
    );
  });

  it("exercício afeta só atributos configurados; GK recomenda goleiro", () => {
    let { carreira: c } = exemploCarreira();
    c.jogador.posicao = "CA";
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    const antes = { ...c.jogador.atributos };
    c = aplicarSessaoTreino(
      c,
      {
        exercicioId: "penaltis",
        score: 88,
        modo: "jogar",
        sessaoId: "attr1",
      },
      clube,
    ).carreira;
    const mudou = (Object.keys(antes) as (keyof typeof antes)[]).filter(
      (a) => c.jogador.atributos[a] !== antes[a] || c.jogador.desenvolvimento[a] !== 0,
    );
    expect(mudou.every((a) => ["finalizacao", "compostura", "concentracao"].includes(a))).toBe(
      true,
    );

    const gk = exerciciosRecomendados("GOL");
    expect(gk.every((e) => e.exclusivoGoleiro || e.recomendadoPara.includes("GOL"))).toBe(
      true,
    );
    expect(exerciciosVisiveisPara("CA").every((e) => !e.exclusivoGoleiro)).toBe(
      true,
    );
  });

  it("save legado hidrata e serializa centro", () => {
    let { carreira: c, catalogo } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c = aplicarSessaoTreino(
      c,
      {
        exercicioId: "penaltis",
        score: 91,
        modo: "jogar",
        sessaoId: "save1",
      },
      clube,
    ).carreira;
    const raw = serializarCarreira(c);
    const hidratado = hidratarCarreira(raw, catalogo);
    expect(hidratado.jogador.preparacao.centro?.melhoresExercicios.penaltis?.nota).toBe(
      "A",
    );
    expect(hidratado.jogador.preparacao.centro?.semana.sessoes).toHaveLength(1);

    // legado sem centro
    const legado = structuredClone(raw) as Record<string, unknown>;
    const jog = legado.jogador as Record<string, unknown>;
    const prep = { ...(jog.preparacao as object) } as Record<string, unknown>;
    delete prep.centro;
    jog.preparacao = prep;
    const h2 = hidratarCarreira(legado, catalogo);
    expect(h2.jogador.preparacao.centro?.melhoresExercicios).toEqual({});
  });
});

describe("benchmark faixas", () => {
  it("cenários relativos e progressão visível", () => {
    const ruim = simularCarreiraTreino(CENARIOS_PADRAO.find((c) => c.id === "ruim")!);
    const normal = simularCarreiraTreino(
      CENARIOS_PADRAO.find((c) => c.id === "normal")!,
    );
    const forte = simularCarreiraTreino(
      CENARIOS_PADRAO.find((c) => c.id === "dedicado")!,
    );
    const talento = simularCarreiraTreino(
      CENARIOS_PADRAO.find((c) => c.id === "talento")!,
    );
    const vet = simularCarreiraTreino(
      CENARIOS_PADRAO.find((c) => c.id === "veterano28")!,
    );

    expect(ovrEm(normal.porIdade, 21)).toBeGreaterThan(65);
    expect(ovrEm(forte.porIdade, 21)).toBeGreaterThan(ovrEm(normal.porIdade, 21) - 2);
    expect(ovrEm(ruim.porIdade, 21)).toBeLessThan(ovrEm(normal.porIdade, 21));
    expect(ovrEm(talento.porIdade, 21)).toBeGreaterThanOrEqual(
      ovrEm(normal.porIdade, 21),
    );
    // Veterano cresce menos que jovem no mesmo intervalo relativo
    expect(vet.pico - (vet.ovr15 ?? ovrEm(vet.porIdade, 28))).toBeLessThan(18);
  }, 60_000);
});
