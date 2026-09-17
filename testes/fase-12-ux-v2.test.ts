import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(process.cwd());

function ler(rel: string) {
  return readFileSync(join(raiz, rel), "utf8");
}

describe("fase-12 UX v2 — arquitetura Home", () => {
  const inicio = ler("src/componentes/jogo/InicioCarreira.tsx");
  const central = ler("src/componentes/jogo/CentralCarreira.tsx");

  it("Home não empilha CentralSemana / Propostas / Decisões / Última partida / Avançar", () => {
    expect(inicio).not.toMatch(/CentralSemana/);
    expect(inicio).not.toMatch(/PropostasInicio/);
    expect(inicio).not.toMatch(/DecisoesInicio/);
    expect(inicio).not.toMatch(/PainelUltimaPartida/);
    expect(inicio).not.toMatch(/vz-avancar-semana/);
    expect(inicio).toMatch(/FaixaAtencao/);
    expect(inicio).toMatch(/vz-home-grid/);
  });

  it("CTA avançar semana fica no topbar do shell", () => {
    expect(central).toMatch(/vz-cta-semana/);
    expect(central).toMatch(/Avançar semana/);
  });

  it("sidebar chama Treinamento, não Personalização", () => {
    expect(central).toMatch(/\["treinamento", "Treinamento"/);
    expect(central).not.toMatch(/\["treinamento", "Personalização"/);
  });

  it("FaixaAtencao preserva propostas e decisões em overlay", () => {
    const faixa = ler("src/componentes/jogo/FaixaAtencao.tsx");
    expect(faixa).toMatch(/DecisoesInicio/);
    expect(faixa).toMatch(/PropostasInicio/);
    expect(faixa).toMatch(/vz-rail/);
  });

  it("Desempenho inclui última partida compacta", () => {
    const card = ler("src/componentes/jogo/inicio/CardDesempenho.tsx");
    expect(card).toMatch(/vz-ultima-linha/);
    expect(card).toMatch(/abrirResumo/);
  });
});

describe("fase-12 UX v2 — criação de carreira", () => {
  const criacao = ler("src/componentes/jogador/CriacaoCarreira.tsx");
  const historia = ler("src/componentes/jogador/SuaHistoria.tsx");

  it("usa shell wizard viewport com footer fixo", () => {
    expect(criacao).toMatch(/vz-wizard/);
    expect(criacao).toMatch(/vz-wizard-foot/);
    expect(criacao).toMatch(/vz-clube-scroll/);
    expect(criacao).not.toMatch(/Base local Transfermarkt/);
  });

  it("posição usa cards agrupados e pé segmented", () => {
    expect(criacao).toMatch(/vz-pos-grid/);
    expect(criacao).toMatch(/vz-segmented/);
  });

  it("história tem progresso de capítulos", () => {
    expect(historia).toMatch(/vz-hist-progress/);
    expect(historia).toMatch(/Origem/);
    expect(historia).toMatch(/Chegada/);
  });

  it("ligas agrupadas por país e clubes com scroll interno", () => {
    expect(criacao).toMatch(/vz-liga-pais/);
    expect(criacao).toMatch(/vz-clube-scroll/);
  });
});
