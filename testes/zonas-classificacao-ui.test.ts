import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classeZonaClassificacao,
  legendasZonaClassificacao,
  obterZonaClassificacao,
  REGRAS_ZONA_POR_LIGA,
} from "@/dominio/constantes/zonas-classificacao";

const UNIVERSO_COMPLETO = Object.keys(REGRAS_ZONA_POR_LIGA);

describe("zonas de classificação (config central)", () => {
  it("líder durante a temporada e campeão ao encerrar", () => {
    expect(
      obterZonaClassificacao("brasileirao", 1, {
        temporadaEncerrada: false,
        ligasNoUniverso: UNIVERSO_COMPLETO,
      }),
    ).toEqual({ tipo: "lider", label: "Líder" });
    expect(
      obterZonaClassificacao("brasileirao", 1, {
        temporadaEncerrada: true,
        ligasNoUniverso: UNIVERSO_COMPLETO,
      }),
    ).toEqual({ tipo: "campeao", label: "Campeão" });
  });

  it("Brasileirão: Libertadores, Sul-Americana e rebaixamento", () => {
    const opts = {
      temporadaEncerrada: false,
      ligasNoUniverso: UNIVERSO_COMPLETO,
    };
    expect(obterZonaClassificacao("brasileirao", 4, opts).tipo).toBe(
      "libertadores",
    );
    expect(obterZonaClassificacao("brasileirao", 8, opts).tipo).toBe(
      "sulamericana",
    );
    expect(obterZonaClassificacao("brasileirao", 18, opts).tipo).toBe(
      "rebaixamento",
    );
    expect(obterZonaClassificacao("brasileirao", 14, opts).tipo).toBe(
      "normal",
    );
  });

  it("Premier League não lista Libertadores", () => {
    const legendas = legendasZonaClassificacao("premier-league", {
      temporadaEncerrada: false,
      ligasNoUniverso: UNIVERSO_COMPLETO,
    });
    expect(legendas.map((l) => l.tipo)).toContain("champions");
    expect(legendas.map((l) => l.tipo)).toContain("europa");
    expect(legendas.map((l) => l.tipo)).not.toContain("libertadores");
    expect(legendas.map((l) => l.tipo)).not.toContain("sulamericana");
  });

  it("Série B: acesso sem rebaixamento fictício (sem Série C)", () => {
    const opts = {
      temporadaEncerrada: false,
      ligasNoUniverso: UNIVERSO_COMPLETO,
    };
    expect(obterZonaClassificacao("brasileirao-b", 2, opts).tipo).toBe(
      "acesso",
    );
    expect(obterZonaClassificacao("brasileirao-b", 18, opts).tipo).toBe(
      "normal",
    );
    const legendas = legendasZonaClassificacao("brasileirao-b", opts);
    expect(legendas.map((l) => l.tipo)).toContain("acesso");
    expect(legendas.map((l) => l.tipo)).not.toContain("rebaixamento");
  });

  it("Championship: acesso direto e playoff", () => {
    const opts = {
      temporadaEncerrada: false,
      ligasNoUniverso: UNIVERSO_COMPLETO,
    };
    expect(obterZonaClassificacao("championship", 1, opts).tipo).toBe("lider");
    expect(obterZonaClassificacao("championship", 2, opts).tipo).toBe("acesso");
    expect(obterZonaClassificacao("championship", 4, opts).tipo).toBe(
      "playoff_acesso",
    );
  });

  it("rebaixamento some se a divisão inferior não está no universo", () => {
    const semB = obterZonaClassificacao("brasileirao", 18, {
      temporadaEncerrada: false,
      ligasNoUniverso: ["brasileirao"],
    });
    expect(semB.tipo).toBe("normal");
  });

  it("classe CSS deriva do tipo sem números mágicos no componente", () => {
    expect(classeZonaClassificacao("libertadores")).toBe("zona-libertadores");
    expect(classeZonaClassificacao("playoff_acesso")).toBe(
      "zona-playoff-acesso",
    );
    expect(classeZonaClassificacao("normal")).toBe("");
  });
});

describe("navegação — sidebar única", () => {
  const central = readFileSync(
    join(process.cwd(), "src/componentes/jogo/CentralCarreira.tsx"),
    "utf8",
  );

  it("remove TOP_NAV / navbar superior de seções", () => {
    expect(central).not.toMatch(/TOP_NAV/);
    expect(central).not.toMatch(/vz-top-nav/);
    expect(central).not.toMatch(/Minha Carreira/);
  });

  it("sidebar contém Clube e Mundo do Futebol além dos itens principais", () => {
    expect(central).toMatch(/\["clube", "Clube"/);
    expect(central).toMatch(/\["competicao", "Mundo do Futebol"/);
    expect(central).toMatch(/\["", "Início"/);
    expect(central).toMatch(/\["calendario", "Calendário"/);
    expect(central).toMatch(/\["treinamento", "Treinamento"/);
  });

  it("TabelaLiga não hardcoda posições continentais", () => {
    const tabela = readFileSync(
      join(process.cwd(), "src/componentes/partida/TabelaLiga.tsx"),
      "utf8",
    );
    expect(tabela).not.toMatch(/posicao\s*<=\s*4/);
    expect(tabela).not.toMatch(/posicao\s*>=\s*17/);
    expect(tabela).toMatch(/obterZonaClassificacao/);
  });
});
