import { test, expect } from "@playwright/test";
import {
  abrirHomeComFixture,
  expectNoHorizontalScroll,
  expectNoVerticalScroll,
  expectVisibleInViewport,
} from "./helpers";

const ESSENCIAIS = [
  { sel: ".vz-hero", nome: "Hero" },
  { sel: ".vz-clube", nome: "Meu Clube" },
  { sel: ".vz-proximo", nome: "Próximo jogo" },
  { sel: ".vz-mini-cal", nome: "Calendário" },
  { sel: ".vz-mensagens", nome: "Mensagens" },
  { sel: ".vz-desempenho", nome: "Desempenho" },
  { sel: ".vz-objetivos", nome: "Objetivos" },
  { sel: ".vz-mercado-contrato", nome: "Mercado/Contrato" },
];

test.describe("Home desktop — viewport", () => {
  for (const vp of [
    { w: 1920, h: 1080 },
    { w: 1440, h: 900 },
    { w: 1366, h: 768 },
  ]) {
    test(`${vp.w}x${vp.h} sem scroll e blocos visíveis`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
      await page.waitForTimeout(200);

      const metrics = await expectNoVerticalScroll(page);
      await expectNoHorizontalScroll(page);

      for (const item of ESSENCIAIS) {
        await expectVisibleInViewport(page.locator(item.sel).first());
      }
      await expectVisibleInViewport(page.locator(".vz-cta-desktop").first());
      await expect(page.locator(".vz-cta-mobile-bar")).toBeHidden();
      await expect(page.locator(".vz-rail")).toHaveCount(0);

      await page.screenshot({
        path: `relatorios/e2e-home-${vp.w}x${vp.h}.png`,
        fullPage: false,
      });

      expect(metrics.docScroll).toBeLessThanOrEqual(metrics.docClient + 2);
    });
  }
});

test("Home mobile 390x844 — CTA mobile acessível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await expect(page.locator(".vz-cta-desktop")).toBeHidden();
  await expectVisibleInViewport(page.locator(".vz-cta-mobile").first());
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: "relatorios/e2e-home-390x844.png",
    fullPage: false,
  });
});

test("Home com faixa de atenção ainda cabe em 1366x768", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirHomeComFixture(page, "fixture-save.json");
  await expect(page.locator(".vz-rail")).toBeVisible();
  await expectNoVerticalScroll(page);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: "relatorios/e2e-home-1366x768-com-rail.png",
    fullPage: false,
  });
});

test("Home sem faixa não possui rail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirHomeComFixture(page, "fixture-save-sem-rail.json");
  await expect(page.locator(".vz-rail")).toHaveCount(0);
  await expectNoVerticalScroll(page);
});
