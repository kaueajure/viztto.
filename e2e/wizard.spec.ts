import { test, expect } from "@playwright/test";
import {
  expectNoHorizontalScroll,
  expectNoVerticalScroll,
  expectVisibleInViewport,
} from "./helpers";

test.describe("Wizard criação", () => {
  test("1366x768 — chrome fixo e footer acessível", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/nova-carreira");
    await expectVisibleInViewport(page.locator(".vz-wizard-head"));
    await expectVisibleInViewport(page.locator(".vz-wizard-steps"));
    await expectVisibleInViewport(page.locator(".vz-wizard-foot"));
    await expectNoVerticalScroll(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({
      path: "relatorios/e2e-wizard-identidade.png",
      fullPage: false,
    });
  });

  test("fluxo história + erros contextuais + busca clube", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/nova-carreira");
    await page.waitForSelector('input[placeholder="Seu nome"]');
    await page.locator(".vz-wizard-foot .botao.principal").click();
    await expect(page.locator(".vz-campo-erro").first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByPlaceholder("Seu nome").fill("Lucas");
    await page.getByPlaceholder("Seu sobrenome").fill("Silva");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await expect(page.getByRole("heading", { name: /Perfil em campo/i })).toBeVisible();

    await page.locator('input[type="number"]').first().fill("15");
    await page.getByRole("button", { name: "CA" }).first().click();
    await page.getByRole("button", { name: /Continuar/ }).click();

    await expect(page.locator(".vz-hist-progress")).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.locator(".vz-hist-card").first().click();
      await page.locator(".vz-wizard-foot button").last().click();
      await page.waitForTimeout(200);
    }
    await expect(page.getByRole("heading", { name: /História concluída|Escolha a liga/i })).toBeVisible();
    if (await page.getByRole("heading", { name: /História concluída/i }).count()) {
      await page.locator(".vz-wizard-foot button").last().click();
    }

    await expect(page.getByRole("heading", { name: /Escolha a liga/i })).toBeVisible();
    const liga = page.locator(".vz-liga-card").first();
    await liga.click();
    await page.locator(".vz-wizard-foot button").last().click();
    await page.waitForSelector(".vz-clube-scroll", { timeout: 30_000 });

    const clubInfo = await page.evaluate(() => {
      const sc = document.querySelector(".vz-clube-scroll");
      return {
        pageOverflow:
          document.documentElement.scrollHeight - window.innerHeight,
        scrollH: sc?.scrollHeight ?? 0,
        clientH: sc?.clientHeight ?? 0,
        items: sc?.querySelectorAll("button").length ?? 0,
      };
    });
    expect(clubInfo.pageOverflow).toBeLessThanOrEqual(2);
    expect(clubInfo.items).toBeGreaterThan(1);
    if (clubInfo.scrollH > clubInfo.clientH + 2) {
      expect(clubInfo.scrollH).toBeGreaterThan(clubInfo.clientH);
    }

    await page.locator(".vz-clube-item").first().click();
    const selected = await page.locator(".vz-clube-item.selecionada").textContent();
    await page.locator(".vz-busca-clube input").fill("zzzz-nao-existe");
    await expect(page.getByText(/Nenhum clube/i)).toBeVisible();
    await expect(page.locator(".vz-clube-detalhe h2")).toBeVisible();
    await page.locator(".vz-busca-clube input").fill("");
    await expect(page.locator(".vz-clube-item.selecionada")).toContainText(
      selected?.trim().slice(0, 3) ?? "",
    );

    await page.locator(".vz-wizard-foot button").last().click();
    await expect(page.getByText(/Sua história/i).first()).toBeVisible();
    await page.screenshot({
      path: "relatorios/e2e-wizard-confirmacao.png",
      fullPage: false,
    });
  });

  test("Championship — 24 clubes, scroll interno, busca, footer visível", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route("**/api/carreira", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 404, body: "{}" });
        return;
      }
      await route.fulfill({ status: 200, body: "{}" });
    });

    await page.goto("/nova-carreira");
    await page.getByPlaceholder("Seu nome").fill("Lucas");
    await page.getByPlaceholder("Seu sobrenome").fill("Silva");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('input[type="number"]').first().fill("18");
    await page.getByRole("button", { name: "CA" }).first().click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    for (let i = 0; i < 4; i++) {
      await page.locator(".vz-hist-card").first().click();
      await page.locator(".vz-wizard-foot button").last().click();
      await page.waitForTimeout(150);
    }
    if (
      await page.getByRole("heading", { name: /História concluída/i }).count()
    ) {
      await page.locator(".vz-wizard-foot button").last().click();
    }

    await expect(
      page.getByRole("heading", { name: /Escolha a liga/i }),
    ).toBeVisible();
    await page.locator(".vz-liga-card", { hasText: "Championship" }).click();
    await page.locator(".vz-wizard-foot button").last().click();
    await page.waitForSelector(".vz-clube-scroll", { timeout: 30_000 });

    const info = await page.evaluate(() => {
      const sc = document.querySelector(".vz-clube-scroll");
      const first = sc?.querySelector(".vz-clube-item");
      return {
        items: sc?.querySelectorAll(".vz-clube-item").length ?? 0,
        scrollH: sc?.scrollHeight ?? 0,
        clientH: sc?.clientHeight ?? 0,
        pageOverflow:
          document.documentElement.scrollHeight - window.innerHeight,
        firstName: first?.textContent?.trim() ?? "",
      };
    });
    expect(info.items).toBe(24);
    expect(info.scrollH).toBeGreaterThan(info.clientH);
    expect(info.pageOverflow).toBeLessThanOrEqual(2);
    await expectVisibleInViewport(page.locator(".vz-wizard-foot"));
    await expectVisibleInViewport(page.locator(".vz-wizard-preview"));

    await page.locator(".vz-clube-item").first().click();
    const selectedName = (
      await page.locator(".vz-clube-item.selecionada").textContent()
    )?.trim();
    await page.locator(".vz-busca-clube input").fill("zzzz-filtro-vazio");
    await expect(page.getByText(/Nenhum clube/i)).toBeVisible();
    await expect(page.locator(".vz-clube-detalhe")).toContainText(
      selectedName?.slice(0, 4) ?? "x",
    );
    await page.locator(".vz-busca-clube input").fill("");
    await expect(page.locator(".vz-clube-item")).toHaveCount(24);
  });

  test("Retry de ligas preserva identidade e história", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    let ligasHits = 0;
    await page.route("**/api/carreira", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 404, body: "{}" });
        return;
      }
      await route.fulfill({ status: 200, body: "{}" });
    });
    await page.route("**/api/futebol/ligas", async (route) => {
      ligasHits += 1;
      if (ligasHits === 1) {
        await route.fulfill({ status: 500, body: "erro" });
        return;
      }
      await route.continue();
    });

    await page.goto("/nova-carreira");
    await page.getByPlaceholder("Seu nome").fill("Kaue");
    await page.getByPlaceholder("Seu sobrenome").fill("Santos");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('input[type="number"]').first().fill("16");
    await page.getByRole("button", { name: "PD" }).first().click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    for (let i = 0; i < 4; i++) {
      await page.locator(".vz-hist-card").first().click();
      await page.locator(".vz-wizard-foot button").last().click();
      await page.waitForTimeout(120);
    }
    if (
      await page.getByRole("heading", { name: /História concluída/i }).count()
    ) {
      await page.locator(".vz-wizard-foot button").last().click();
    }

    await expect(page.getByText(/Não foi possível carregar as ligas/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /Tentar novamente/i }).click();
    await expect(
      page.getByRole("heading", { name: /Escolha a liga/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".vz-wizard-preview")).toContainText(/Kaue/i);
    await expect(page.locator(".vz-liga-card").first()).toBeVisible();
    expect(ligasHits).toBeGreaterThanOrEqual(2);
  });
});
