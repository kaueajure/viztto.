import { test, expect } from "@playwright/test";
import {
  abrirHomeComFixture,
  attachConsoleGuard,
  expectCardsWithoutInternalScroll,
  expectFullyVisibleInViewport,
  expectNoHorizontalScroll,
  expectNoVerticalScroll,
  expectScrollableListsHealthy,
} from "./helpers";

const CARDS = [
  ".vz-hero",
  ".vz-clube",
  ".vz-proximo",
  ".vz-mini-cal",
  ".vz-mensagens",
  ".vz-desempenho",
  ".vz-objetivos",
  ".vz-mercado-contrato",
];

/** Viewports cobrindo desktop → tablet → mobile, incl. faixa 769–900. */
const VIEWPORTS = [
  { w: 1920, h: 1080, cols: 3, sidebar: "fixed", cta: "desktop" },
  { w: 1440, h: 900, cols: 3, sidebar: "fixed", cta: "desktop" },
  { w: 1366, h: 768, cols: 3, sidebar: "fixed", cta: "desktop" },
  { w: 1100, h: 800, cols: 2, sidebar: "fixed", cta: "desktop" },
  { w: 1024, h: 768, cols: 2, sidebar: "fixed", cta: "desktop" },
  { w: 900, h: 900, cols: 1, sidebar: "drawer", cta: "desktop" },
  { w: 834, h: 1112, cols: 1, sidebar: "drawer", cta: "desktop" },
  { w: 800, h: 1280, cols: 1, sidebar: "drawer", cta: "desktop" },
  { w: 768, h: 1024, cols: 1, sidebar: "drawer", cta: "mobile" },
  { w: 390, h: 844, cols: 1, sidebar: "drawer", cta: "mobile" },
] as const;

async function gridColumns(page: import("@playwright/test").Page) {
  return page.locator(".vz-home-grid").evaluate((el) => {
    const t = getComputedStyle(el).gridTemplateColumns;
    return t.split(/\s+/).filter(Boolean).length;
  });
}

async function sidebarHidden(page: import("@playwright/test").Page) {
  return page.locator(".vz-shell .barra-lateral").evaluate((el) => {
    const t = getComputedStyle(el).transform;
    return t.includes("matrix") && !t.startsWith("none");
  });
}

test.describe("Home — breakpoints e viewports", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.w}x${vp.h} — grid/sidebar/CTA/overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const { guard } = await abrirHomeComFixture(
        page,
        "fixture-save-sem-rail.json",
      );
      await page.waitForTimeout(120);

      await expectNoHorizontalScroll(page);
      const cols = await gridColumns(page);
      expect(cols, `esperado ${vp.cols} colunas`).toBe(vp.cols);

      if (vp.sidebar === "drawer") {
        expect(await sidebarHidden(page)).toBe(true);
        await expect(page.locator(".abrir-menu")).toBeVisible();
      } else {
        expect(await sidebarHidden(page)).toBe(false);
      }

      if (vp.cta === "mobile") {
        await expect(page.locator(".vz-cta-desktop")).toBeHidden();
        await expectFullyVisibleInViewport(
          page
            .getByTestId("advance-week-mobile")
            .or(page.locator(".vz-cta-mobile")),
        );
      } else {
        await expect(page.locator(".vz-cta-mobile-bar")).toBeHidden();
        await expectFullyVisibleInViewport(
          page
            .getByTestId("advance-week")
            .or(page.locator(".vz-cta-desktop"))
            .first(),
        );
      }

      // Em viewports altos com scroll de página permitido (≤1100), não exigir
      // zero scroll vertical de documento; cards devem permanecer legíveis.
      if (vp.w > 1100) {
        await expectNoVerticalScroll(page);
        for (const sel of CARDS) {
          await expectFullyVisibleInViewport(page.locator(sel).first());
        }
        await expectCardsWithoutInternalScroll(page, CARDS);
      } else {
        for (const sel of CARDS) {
          await expect(page.locator(sel).first()).toBeVisible();
        }
        await expectScrollableListsHealthy(page);
      }

      guard.assertClean();
    });
  }
});

test("1366x768 — conteúdo interno essencial dos cards", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");

  await expectFullyVisibleInViewport(page.locator(".vz-hero-nome").first());
  await expectFullyVisibleInViewport(page.locator(".vz-ovr").first());
  await expectFullyVisibleInViewport(page.locator(".vz-clube").first());
  await expectFullyVisibleInViewport(page.locator(".vz-proximo").first());
  await expect(page.locator(".vz-cal-lista li").first()).toBeVisible();
  const nCal = await page.locator(".vz-cal-lista li").count();
  expect(nCal).toBeGreaterThanOrEqual(1);
  await expect(
    page.getByRole("link", { name: /Calendário completo/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ver todas|mensagens/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ver objetivos|objetivos/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ver contrato|contrato/i }).first(),
  ).toBeVisible();
  await expect(page.locator(".vz-valor")).toBeVisible();
  await expectScrollableListsHealthy(page);
});

test("Home com faixa de atenção ainda cabe em 1366x768", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirHomeComFixture(page, "fixture-save.json");
  await expect(page.locator(".vz-rail")).toBeVisible();
  await expectNoVerticalScroll(page);
  await expectNoHorizontalScroll(page);
  for (const sel of CARDS) {
    await expectFullyVisibleInViewport(page.locator(sel).first());
  }
});

test("Home sem faixa não possui rail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await expect(page.locator(".vz-rail")).toHaveCount(0);
  await expectNoVerticalScroll(page);
});

test("console.error genérico falha o guard", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const guard = await attachConsoleGuard(page);
  await page.goto("about:blank");
  await page.evaluate(() => console.error("erro E2E proposital"));
  expect(() => guard.assertClean()).toThrow(/erro E2E proposital/);
});
