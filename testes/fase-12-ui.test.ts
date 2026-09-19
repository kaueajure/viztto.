import { describe, expect, it } from "vitest";
import {
  atributosResumo,
  dataCarreiraTopo,
  peDominanteRotulo,
  tempoRelativoNoticia,
} from "@/utilitarios/apresentacao-carreira";
import type { Atributos } from "@/dominio/entidades/modelos";

describe("apresentação carreira UI", () => {
  it("formata data da carreira no topo", () => {
    expect(dataCarreiraTopo("2026-03-15")).toMatch(/15 MAR 2026 \| DOM/);
  });

  it("deriva resumo de atributos sem inventar escala", () => {
    const r = atributosResumo({
      aceleracao: 80,
      velocidade: 76,
      finalizacao: 71,
      passeCurto: 74,
      passeLongo: 78,
      drible: 80,
      desarme: 48,
      marcacao: 50,
      antecipacao: 46,
      forca: 60,
      resistencia: 64,
    } as Atributos);
    expect(r.map((x) => x.sigla)).toEqual([
      "RIT",
      "FIN",
      "PAS",
      "DRI",
      "DEF",
      "FÍS",
    ]);
    expect(r.find((x) => x.sigla === "FIN")?.valor).toBe(71);
  });

  it("rótulos de pé e tempo relativo", () => {
    expect(peDominanteRotulo("direito")).toBe("Destro");
    expect(tempoRelativoNoticia("2026-03-15", "2026-03-15")).toBe("Hoje");
    expect(tempoRelativoNoticia("2026-03-14", "2026-03-15")).toBe("Ontem");
  });

  it(
    "rotas de seções novas existem no gerador estático",
    async () => {
      const mod = await import("@/app/carreira/[secao]/page");
      const params = mod.generateStaticParams();
      const secoes = params.map((p) => p.secao);
      expect(secoes).toEqual(
        expect.arrayContaining(["desempenho", "contrato", "objetivos"]),
      );
    },
    15_000,
  );
});
