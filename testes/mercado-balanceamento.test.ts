import { describe, expect, it } from "vitest";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import { avaliarAlvo, avancarInteresses, conversarAgente } from "@/simulacao/transferencias/mercado-progressivo";
import { reputacaoCompativel } from "@/simulacao/transferencias/necessidade";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";

function carreiraMercado() {
  const { carreira: c } = exemploCarreira();
  c.jogador.categoria = "profissional";
  c.jogador.idade = 20;
  c.jogador.overall = 68;
  c.jogador.potencialInterno = 86;
  c.jogador.reputacao = 48;
  c.jogador.forma = 72;
  c.registros = [
    {
      ano: 2026,
      clubeId: c.clubeAtualId!,
      competicao: c.liga.nome,
      categoria: "profissional",
      estatisticas: {
        jogos: 18,
        titularidades: 14,
        minutos: 1200,
        gols: 4,
        assistencias: 3,
        amarelos: 2,
        vermelhos: 0,
        somaNotas: 120,
      },
    },
  ];
  c.jogador.notasRecentes = [7.2, 7.0, 7.4, 6.8, 7.1];
  return c;
}

describe("mercado — progressão e variedade", () => {
  it("clubes do mesmo nível / um pouco acima aceitam contato do agente", () => {
    const c = carreiraMercado();
    const atual = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
    const alvo = c.clubes.find(
      (cl) =>
        cl.id !== c.clubeAtualId &&
        cl.forcaGeral >= atual.forcaGeral - 2 &&
        cl.forcaGeral <= atual.forcaGeral + 8 &&
        cl.reputacao < 90,
    )!;
    alvo.orcamento = Math.max(alvo.orcamento, 50_000_000);
    const a = avaliarAlvo(c, alvo);
    expect(a.compativel).toBe(true);
    expect(a.viavel).toBe(true);
    const depois = conversarAgente(c, "contatar", alvo.id);
    const i = depois.mercado.interesses.find((x) => x.clubeId === alvo.id)!;
    expect(i.status).not.toBe("encerrado");
  });

  it("jovem com potencial alto consegue viabilidade em clube melhor (não gigante)", () => {
    const c = carreiraMercado();
    c.jogador.overall = 66;
    c.jogador.potencialInterno = 88;
    c.jogador.idade = 19;
    const melhor = [...c.clubes]
      .filter((cl) => cl.id !== c.clubeAtualId && cl.reputacao < 90)
      .sort((a, b) => b.forcaGeral - a.forcaGeral)[0]!;
    // Garante gap de clube melhor, sem saturar a posição.
    melhor.forcaGeral = Math.max(melhor.forcaGeral, c.jogador.overall + 10);
    melhor.reputacao = Math.min(88, melhor.forcaGeral + 2);
    melhor.orcamento = Math.max(melhor.orcamento, 80_000_000);
    melhor.elenco = melhor.elenco.filter((j) => j.posicaoPrincipal !== c.jogador.posicao);
    const a = avaliarAlvo(c, melhor);
    expect(a.compativel).toBe(true);
    expect(a.viavel).toBe(true);
  });

  it("gigante ainda rejeita jogador mediano sem potencial de elite", () => {
    const c = carreiraMercado();
    const elite = c.clubes.find((cl) => cl.id !== c.clubeAtualId)!;
    elite.forcaGeral = 92;
    elite.reputacao = 95;
    elite.elenco = [
      ...elite.elenco,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...elite.elenco[0]!,
        id: `pd-elite-${i}`,
        posicaoPrincipal: c.jogador.posicao,
        posicoesSecundarias: [],
        overall: 90 - i,
        lesionado: false,
        lesao: null,
      })),
    ];
    c.jogador.overall = 68;
    c.jogador.potencialInterno = 78;
    const a = avaliarAlvo(c, elite);
    expect(a.viavel).toBe(false);
    const depois = conversarAgente(c, "contatar", elite.id);
    expect(
      depois.mercado.interesses.find((x) => x.clubeId === elite.id)!.status,
    ).toBe("encerrado");
  });

  it("interesses espontâneos variam entre clubes ao longo das semanas", () => {
    const c = carreiraMercado();
    for (const cl of c.clubes) {
      cl.orcamento = Math.max(cl.orcamento, 40_000_000);
    }
    c.dataAtual = "2026-07-08"; // janela de verão
    const vistos = new Set<string>();
    for (let s = 0; s < 24; s++) {
      avancarInteresses(c, new GeradorAleatorio(1000 + s * 17));
      for (const i of c.mercado.interesses) {
        if (i.status !== "encerrado") vistos.add(i.clubeId);
      }
      c.dataAtual = new Date(Date.parse(c.dataAtual) + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      // Limpa interesses encerrados antigos para permitir novos.
      c.mercado.interesses = c.mercado.interesses.filter(
        (i) => i.status !== "encerrado" || (i.reabrirEm ?? "") <= c.dataAtual,
      );
    }
    expect(vistos.size).toBeGreaterThanOrEqual(3);
  });

  it("com OVR/reputação maiores, clubes mais fortes passam a ser viáveis", () => {
    const base = carreiraMercado();
    const alvos = [...base.clubes]
      .filter((cl) => cl.id !== base.clubeAtualId && cl.reputacao < 90)
      .sort((a, b) => b.forcaGeral - a.forcaGeral)
      .slice(0, 3);
    for (const cl of alvos) {
      cl.forcaGeral = 82;
      cl.reputacao = 84;
      cl.orcamento = Math.max(cl.orcamento, 70_000_000);
      cl.elenco = cl.elenco.filter(
        (j) => j.posicaoPrincipal !== base.jogador.posicao,
      );
    }

    const fraco = carreiraMercado();
    fraco.jogador.overall = 62;
    fraco.jogador.potencialInterno = 72;
    fraco.jogador.reputacao = 28;
    fraco.jogador.idade = 25;
    const forte = carreiraMercado();
    forte.jogador.overall = 78;
    forte.jogador.potencialInterno = 86;
    forte.jogador.reputacao = 58;
    forte.jogador.idade = 23;

    for (const cl of alvos) {
      for (const c of [fraco, forte]) {
        const dst = c.clubes.find((x) => x.id === cl.id)!;
        dst.forcaGeral = cl.forcaGeral;
        dst.reputacao = cl.reputacao;
        dst.orcamento = cl.orcamento;
        dst.elenco = structuredClone(cl.elenco);
      }
    }

    const viaveisFracos = alvos.filter((cl) =>
      avaliarAlvo(fraco, fraco.clubes.find((x) => x.id === cl.id)!).viavel,
    );
    const viaveisFortes = alvos.filter((cl) =>
      avaliarAlvo(forte, forte.clubes.find((x) => x.id === cl.id)!).viavel,
    );
    expect(viaveisFracos.length).toBe(0);
    expect(viaveisFortes.length).toBeGreaterThanOrEqual(2);
  });

  it("reputacaoCompativel abre espaço para jovem com potencial acima do clube", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes[1]!;
    clube.forcaGeral = 76;
    clube.reputacao = 78;
    expect(reputacaoCompativel(67, 88, 19, clube)).toBe(true);
    expect(reputacaoCompativel(58, 70, 28, clube)).toBe(false);
  });
});
