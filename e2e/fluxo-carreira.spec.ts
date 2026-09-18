import { test, expect } from "@playwright/test";
import { abrirComFixtureMutada, abrirHomeComFixture } from "./helpers";

test("Calendário Base/Profissional respeita seleção manual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirComFixtureMutada(page, (c) => {
    const j = c.jogador as Record<string, unknown>;
    j.categoria = "base";
    const t = c.temporada as {
      partidas: Record<string, unknown>[];
      partidasBase: Record<string, unknown>[];
      totalRodadas: number;
      rodadaAtual: number;
    };
    const clubes = c.clubes as { id: string }[];
    const a = clubes[0]!.id;
    const b = clubes[1]!.id;
    t.rodadaAtual = 1;
    const base = {
      rodada: 1,
      mandanteId: a,
      visitanteId: b,
      golsMandante: null,
      golsVisitante: null,
      data: "2026-06-08",
      eventos: [],
      participacao: null,
    };
    t.partidas = [
      { ...base, id: "PARTIDA-PRO-TEST", categoria: "profissional", data: "2026-06-08" },
    ];
    t.partidasBase = [
      { ...base, id: "PARTIDA-BASE-TEST", categoria: "base", data: "2026-06-07" },
    ];
  });

  await page.goto("/carreira/calendario");
  await page.waitForSelector('[data-testid="pagina-calendario"]');

  await page.getByRole("button", { name: "Base", exact: true }).click();
  await expect(page.locator('[data-partida-id="PARTIDA-BASE-TEST"]')).toBeVisible();
  await expect(page.locator('[data-partida-id="PARTIDA-PRO-TEST"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Profissional", exact: true }).click();
  await expect(page.locator('[data-partida-id="PARTIDA-PRO-TEST"]')).toBeVisible();
  await expect(page.locator('[data-partida-id="PARTIDA-BASE-TEST"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Base", exact: true }).click();
  await expect(page.locator('[data-partida-id="PARTIDA-BASE-TEST"]')).toBeVisible();
});

test("Mundo — liga externa sem temporada mostra estado vazio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  let externaId = "";
  await abrirComFixtureMutada(page, (c) => {
    const ligas = c.ligas as { id: string; nome: string }[];
    const atual = (c.liga as { id: string }).id;
    const externa = ligas.find((l) => l.id !== atual)!;
    externaId = externa.id;
    externa.nome = "ENG_TEST_LEAGUE";
    c.temporadasExternas = {};
  });

  await page.goto("/carreira/competicao");
  await page.waitForSelector('[data-testid="pagina-mundo"]');
  await page.getByTestId("mundo-liga-select").selectOption(externaId);
  await expect(page.getByTestId("mundo-indisponivel")).toBeVisible();
  await expect(page.getByText(/não estão disponíveis/i)).toBeVisible();
  await expect(page.locator(".tabela-liga")).toHaveCount(0);
});

test("Central de ações — +pendências e focus Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirComFixtureMutada(page, (c) => {
    const dataAtual = (c as { dataAtual: string }).dataAtual;
    c.decisoes = [
      {
        id: "dec-e2e-1",
        data: dataAtual,
        tipo: "treinador",
        remetente: "Treinador",
        titulo: "Decisão E2E A",
        texto: "Teste",
        opcoes: [
          { id: "a", rotulo: "Ok" },
          { id: "b", rotulo: "Não" },
        ],
        resolvida: false,
      },
      {
        id: "dec-e2e-2",
        data: dataAtual,
        tipo: "treinador",
        remetente: "Treinador",
        titulo: "Decisão E2E B",
        texto: "Teste 2",
        opcoes: [
          { id: "a", rotulo: "Ok" },
          { id: "b", rotulo: "Não" },
        ],
        resolvida: false,
      },
    ];
    const prep = (c.jogador as { preparacao: { planoId: string | null } })
      .preparacao;
    prep.planoId = null;
  });

  await expect(page.locator(".vz-rail")).toBeVisible();
  await expect(page.locator(".vz-rail-mais")).toContainText(/pendência/);
  await page.locator(".vz-rail-mais").click();
  await expect(page.getByRole("dialog", { name: /Central de ações/i })).toBeVisible();
  const nAcoes = await page.locator(".vz-central-acoes li").count();
  expect(nAcoes).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Navegação principal — URLs e headings", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");

  const rotas: [string, RegExp][] = [
    ["/carreira/jogador", /Ana|Teste/i],
    ["/carreira/calendario", /Calendário/i],
    ["/carreira/noticias", /Mensagens/i],
    ["/carreira/mercado", /Mercado/i],
    ["/carreira/contrato", /Contrato/i],
    ["/carreira/objetivos", /Objetivos/i],
    ["/carreira/historico", /Estatísticas/i],
    ["/carreira/treinamento", /Treinamento|Treino/i],
    ["/carreira/competicao", /Mundo do futebol/i],
  ];

  for (const [url, heading] of rotas) {
    await page.goto(url);
    await expect(page).toHaveURL(new RegExp(url.replace("/", "\\/")));
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
      timeout: 15_000,
    });
  }
});

async function assertFocusTrapConfiguracoes(
  page: import("@playwright/test").Page,
  acao: "Excluir carreira" | "Reiniciar carreira",
) {
  const trigger = page.getByRole("button", {
    name: /Configurações da carreira/i,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /OPÇÕES DA CARREIRA/i });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );

  await page.getByRole("button", { name: acao }).click();
  await expect(
    page.getByRole("heading", {
      name: acao.startsWith("Excluir")
        ? /Excluir esta carreira/i
        : /Recomeçar esta carreira/i,
    }),
  ).toBeVisible();

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      `Tab #${i} escapou do diálogo`,
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

test("Configurações — focus trap após Excluir", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await assertFocusTrapConfiguracoes(page, "Excluir carreira");
});

test("Configurações — focus trap após Reiniciar", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await assertFocusTrapConfiguracoes(page, "Reiniciar carreira");
});
