import { describe, expect, it } from "vitest";
import {
  ovrDeValorMercado,
  overallAlvoDeMercado,
  potencialDe,
} from "@/dominio/regras/rating-mercado";
import { calcularRatingViztto } from "@/infraestrutura/ratings/rating-engine";
import { calcularOverall } from "@/dominio/regras/jogador";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";

describe("curva de mercado → OVR", () => {
  it("ancoras principais (interpolação)", () => {
    expect(ovrDeValorMercado(50_000)).toBeCloseTo(50, 0);
    expect(ovrDeValorMercado(1_000_000)).toBeCloseTo(63, 0);
    expect(ovrDeValorMercado(10_000_000)).toBeCloseTo(74, 0);
    expect(ovrDeValorMercado(100_000_000)).toBeCloseTo(88, 0);
    expect(ovrDeValorMercado(150_000_000)).toBeCloseTo(91, 0);
  });

  it("é determinístico e sem RNG", () => {
    const a = overallAlvoDeMercado({
      posicao: "CA",
      idade: 25,
      valorMercado: 20_000_000,
      reputacaoLiga: 90,
      indiceNoElenco: 1,
      tamanhoElenco: 25,
    });
    const b = overallAlvoDeMercado({
      posicao: "CA",
      idade: 25,
      valorMercado: 20_000_000,
      reputacaoLiga: 90,
      indiceNoElenco: 1,
      tamanhoElenco: 25,
    });
    expect(a).toBe(b);
  });

  it("liga ajusta no máximo ±2", () => {
    const base = {
      posicao: "MC" as const,
      idade: 25,
      valorMercado: 5_000_000,
      indiceNoElenco: 5,
      tamanhoElenco: 25,
    };
    const alto = overallAlvoDeMercado({ ...base, reputacaoLiga: 98 });
    const baixo = overallAlvoDeMercado({ ...base, reputacaoLiga: 50 });
    expect(alto - baixo).toBeLessThanOrEqual(4);
  });

  it("€1m não vira elite; €100m fica alto", () => {
    expect(
      overallAlvoDeMercado({
        posicao: "CA",
        idade: 25,
        valorMercado: 1_000_000,
        reputacaoLiga: 98,
        indiceNoElenco: 0,
        tamanhoElenco: 25,
      }),
    ).toBeLessThan(78);
    expect(
      overallAlvoDeMercado({
        posicao: "CA",
        idade: 25,
        valorMercado: 100_000_000,
        reputacaoLiga: 78,
        indiceNoElenco: 10,
        tamanhoElenco: 25,
      }),
    ).toBeGreaterThanOrEqual(84);
  });

  it("potencial nunca abaixo do OVR; jovens caros sobem", () => {
    const ovr = 78;
    expect(potencialDe(ovr, 18, 50_000_000)).toBeGreaterThanOrEqual(ovr + 8);
    expect(potencialDe(ovr, 32, 10_000_000)).toBe(ovr);
  });

  it("atributos calibrados batem o OVR alvo", () => {
    const r = calcularRatingViztto({
      seed: "x",
      nome: "Teste",
      posicaoBruta: "Centre-Forward",
      idade: 26,
      valorMercado: 40_000_000,
      altura: 185,
      reputacaoLiga: 90,
      reputacaoClube: 85,
      forcaMediaLiga: 80,
      indiceNoElenco: 0,
      tamanhoElenco: 25,
    });
    const pos = mapearPosicaoPrincipal("Centre-Forward");
    expect(Math.abs(calcularOverall(r.atributos, pos) - r.overall)).toBeLessThanOrEqual(2);
    expect(r.metadata.calibrationVersion).toBe("engine-v2-market");
  });
});
