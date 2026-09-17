import { test, expect } from "@playwright/test";
import {
  abrirHomeComFixture,
  expectFullyVisibleInViewport,
  expectNoCardInternalScroll,
  expectNoHorizontalScroll,
  expectNoVerticalScroll,
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

const DESKTOP = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
];

test.describe("Home desktop — viewport", () => {
  for (const vp of DESKTOP) {
    test(`${vp.w}x${vp.h} sem scroll e blocos totalmente visíveis`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const { guard } = await abrirHomeComFixture(
        page,
        "fixture-save-sem-rail.json",
      );
      await page.waitForTimeout(150);

      const metrics = await expectNoVerticalScroll(page);
      await expectNoHorizontalScroll(page);

      for (const sel of CARDS) {
        await expectFullyVisibleInViewport(page.locator(sel).first());
      }
      await expectFullyVisibleInViewport(
        page.getByTestId("advance-week").or(page.locator(".vz-cta-desktop")).first(),
      );
      await expect(page.locator(".vz-cta-mobile-bar")).toBeHidden();
      await expect(page.locator(".vz-rail")).toHaveCount(0);

      await expectNoCardInternalScroll(page, CARDS);

      await page.screenshot({
        path: `relatorios/e2e-home-${vp.w}x${vp.h}.png`,
        fullPage: false,
      });
      expect(metrics.docScroll).toBeLessThanOrEqual(metrics.docClient + 2);
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
});

test("Home mobile 390x844 — CTA mobile acessível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await expect(page.locator(".vz-cta-desktop")).toBeHidden();
  await expectFullyVisibleInViewport(
    page.getByTestId("advance-week-mobile").or(page.locator(".vz-cta-mobile")),
  );
  await expectNoHorizontalScroll(page);
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

test("1024x768 e 768x1024 — sem overflow horizontal", async ({ page }) => {
  for (const vp of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(vp);
    await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
    await expectNoHorizontalScroll(page);
  }
});
