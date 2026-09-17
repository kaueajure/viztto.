import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
function ler(rel: string) {
  return readFileSync(join(raiz, rel), "utf8");
}

describe("fase-12 UX v3 — regressões estruturais", () => {
  it("objetivos pessoais podem ser escolhidos na página Objetivos", () => {
    const painel = ler("src/componentes/jogo/PainelObjetivos.tsx");
    expect(painel).toMatch(/escolherObjetivo/);
    expect(painel).toMatch(/vz-obj-card/);
    expect(painel).toMatch(/avaliarDisponibilidadeObjetivo/);
    const inicio = ler("src/componentes/jogo/InicioCarreira.tsx");
    expect(inicio).not.toMatch(/escolherObjetivo/);
    expect(inicio).not.toMatch(/OBJETIVO PESSOAL/);
  });

  it("faixa expõe contador e central de ações", () => {
    const faixa = ler("src/componentes/jogo/FaixaAtencao.tsx");
    expect(faixa).toMatch(/pendência/);
    expect(faixa).toMatch(/Central de ações/);
    expect(faixa).toMatch(/coletarAcoesAtencao/);
  });

  it("alerta de contrato aponta para /carreira/contrato", () => {
    const atencao = ler("src/componentes/jogo/AtencaoCarreira.tsx");
    expect(atencao).toMatch(/href: "\/carreira\/contrato"/);
    expect(atencao).not.toMatch(
      /id: "contrato"[\s\S]*href: "\/carreira\/jogador"/,
    );
  });

  it("CTA desktop e mobile existem sem !important duplicado", () => {
    const central = ler("src/componentes/jogo/CentralCarreira.tsx");
    expect(central).toMatch(/vz-cta-desktop/);
    expect(central).toMatch(/vz-cta-mobile-bar/);
    expect(central).toMatch(/vz-cta-mobile/);
    const css = ler("src/app/globals.css");
    expect(css).toMatch(/\.vz-cta-desktop\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.vz-cta-mobile-bar/);
    expect(css).not.toMatch(
      /\.vz-cta-desktop\s*\{\s*display:\s*none\s*!important/,
    );
  });

  it("produção não expõe window.__VZ_JOGO__ sem guarda de NODE_ENV", () => {
    const store = ler("src/estado/jogo-store.ts");
    expect(store).toMatch(/NODE_ENV\s*!==\s*["']production["']/);
    const hid = ler("src/componentes/jogo/Hidratacao.tsx");
    expect(hid).not.toMatch(/__VZ_JOGO__/);
    const central = ler("src/componentes/jogo/CentralCarreira.tsx");
    expect(central).not.toMatch(/__VZ_JOGO__/);
  });

  it("calendário não usa categoria do jogador após seleção manual", () => {
    const cal = ler("src/componentes/jogo/CalendarioCompeticao.tsx");
    expect(cal).not.toMatch(
      /partidasCal\s*=\s*\n?\s*c\.jogador\.categoria\s*===\s*"base"/,
    );
    expect(cal).toMatch(/categoria === "base"/);
  });

  it("mundo não faz fallback silencioso para temporada da liga atual", () => {
    const mundo = ler("src/componentes/jogo/CalendarioCompeticao.tsx");
    expect(mundo).not.toMatch(
      /temporadasExternas\[ligaSel\.id\]\s*\?\?\s*c\.temporada/,
    );
    expect(mundo).toMatch(/mundo-indisponivel|não estão disponíveis/);
  });

  it("retry de ligas não usa location.reload", () => {
    const criacao = ler("src/componentes/jogador/CriacaoCarreira.tsx");
    expect(criacao).not.toMatch(/location\.reload/);
    expect(criacao).toMatch(/tentativaLigas/);
  });

  it("Mundo do Futebol usa temporadasExternas e seletor de liga", () => {
    const mundo = ler("src/componentes/jogo/CalendarioCompeticao.tsx");
    expect(mundo).toMatch(/temporadasExternas/);
    expect(mundo).toMatch(/vz-liga-select/);
    expect(mundo).toMatch(/Minha liga/);
  });

  it("wizard: busca de clube, erros de campo e confirmação com história", () => {
    const criacao = ler("src/componentes/jogador/CriacaoCarreira.tsx");
    expect(criacao).toMatch(/buscaClube/);
    expect(criacao).toMatch(/vz-campo-erro/);
    expect(criacao).toMatch(/Sua história/);
    expect(criacao).toMatch(/seedAtual/);
    expect(criacao).toMatch(/clubesFiltrados/);
  });

  it("sparkline enganosa de valor de mercado foi removida", () => {
    const card = ler("src/componentes/jogo/inicio/CardMercadoContrato.tsx");
    expect(card).not.toMatch(/notasRecentes/);
    expect(card).not.toMatch(/vz-spark/);
  });

  it("coletarAcoesAtencao não limita artificialmente a 4", () => {
    const atencao = ler("src/componentes/jogo/AtencaoCarreira.tsx");
    expect(atencao).not.toMatch(/\.slice\(0,\s*4\)/);
  });

  it("seed da história usa valor síncrono (seedAtual) sem corrida de setState", () => {
    const criacao = ler("src/componentes/jogador/CriacaoCarreira.tsx");
    expect(criacao).toMatch(/const seedAtual = seed \|\| crypto\.randomUUID\(\)/);
    expect(criacao).toMatch(/sortearHistoria\(seedAtual/);
  });

  it("troca de posição revalida escolhas da História", () => {
    const criacao = ler("src/componentes/jogador/CriacaoCarreira.tsx");
    expect(criacao).toMatch(/CAPITULOS\.filter/);
    expect(criacao).toMatch(/opcoes\[c\]\.some/);
  });

  it("Mundo externo não oferece Base sem partidasBase da liga atual", () => {
    const mundo = ler("src/componentes/jogo/CalendarioCompeticao.tsx");
    expect(mundo).toMatch(/ehMinhaLiga &&/);
    expect(mundo).toMatch(/partidasBase\.length/);
  });

  it("demo vira badge e erros flutuam sem empilhar faixas no grid", () => {
    const central = ler("src/componentes/jogo/CentralCarreira.tsx");
    expect(central).toMatch(/vz-badge-demo/);
    expect(central).toMatch(/vz-shell-floats/);
    expect(central).not.toMatch(/faixa-demonstracao/);
  });
});
