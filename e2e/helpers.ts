import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TOL = 2;

function lerFixture(nome: string) {
  return JSON.parse(
    readFileSync(join(process.cwd(), "e2e", nome), "utf8"),
  ) as { carreira: unknown; revision: number };
}

export async function expectNoVerticalScroll(page: Page) {
  const m = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollHeight,
    docClient: document.documentElement.clientHeight,
    bodyScroll: document.body.scrollHeight,
    inner: window.innerHeight,
  }));
  expect(
    m.docScroll,
    `documentElement scrollHeight ${m.docScroll} > clientHeight ${m.docClient}`,
  ).toBeLessThanOrEqual(m.docClient + TOL);
  expect(
    m.bodyScroll,
    `body scrollHeight ${m.bodyScroll} > innerHeight ${m.inner}`,
  ).toBeLessThanOrEqual(m.inner + TOL);
  return m;
}

export async function expectNoHorizontalScroll(page: Page) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth + TOL);
  return m;
}

export async function expectVisibleInViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "boundingBox null").not.toBeNull();
  const vp = locator.page().viewportSize();
  expect(vp).toBeTruthy();
  const b = box!;
  expect(b.y + b.height).toBeGreaterThan(0);
  expect(b.y).toBeLessThan(vp!.height);
  expect(b.x + b.width).toBeGreaterThan(0);
  expect(b.x).toBeLessThan(vp!.width);
}

/** Carrega Home via mock de GET /api/carreira (sem banco, sem internet). */
export async function abrirHomeComFixture(
  page: Page,
  fixtureFile = "fixture-save.json",
) {
  const saveFixture = lerFixture(fixtureFile);
  await page.route("**/api/carreira", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(saveFixture),
      });
      return;
    }
    if (method === "PUT" || method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          carreira: saveFixture.carreira,
          revision: (saveFixture.revision ?? 1) + 1,
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });

  // Bloqueia hosts de imagem de fixture (sem internet).
  await page.route("**/imagens.test/**", (route) => route.abort());

  await page.goto("/carreira");
  await page.waitForSelector(".vz-home-grid", { timeout: 30_000 });
}
