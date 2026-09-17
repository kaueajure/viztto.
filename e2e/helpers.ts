import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TOL = 2;

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function lerFixture(nome: string) {
  return JSON.parse(
    readFileSync(join(process.cwd(), "e2e", nome), "utf8"),
  ) as { carreira: unknown; revision: number };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
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

/** Elemento parcialmente na viewport (qualquer interseção). */
export async function expectPartiallyVisibleInViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "boundingBox null").not.toBeNull();
  const vp = locator.page().viewportSize()!;
  const b = box!;
  expect(b.y + b.height).toBeGreaterThan(0);
  expect(b.y).toBeLessThan(vp.height);
  expect(b.x + b.width).toBeGreaterThan(0);
  expect(b.x).toBeLessThan(vp.width);
}

/** Elemento completamente dentro do viewport. */
export async function expectFullyVisibleInViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "boundingBox null").not.toBeNull();
  const vp = locator.page().viewportSize()!;
  const b = box!;
  expect(b.y, "top").toBeGreaterThanOrEqual(-TOL);
  expect(b.x, "left").toBeGreaterThanOrEqual(-TOL);
  expect(b.y + b.height, "bottom").toBeLessThanOrEqual(vp.height + TOL);
  expect(b.x + b.width, "right").toBeLessThanOrEqual(vp.width + TOL);
}

/** Compat: exige visibilidade total. */
export async function expectVisibleInViewport(locator: Locator) {
  await expectFullyVisibleInViewport(locator);
}

export async function expectNoCardInternalScroll(
  page: Page,
  selectors: string[],
) {
  for (const sel of selectors) {
    const m = await page.locator(sel).first().evaluate((el) => {
      const style = getComputedStyle(el);
      // Mede o bloco de conteúdo, não decorações absolutas.
      const content = el.querySelector(
        ".vz-hero-info, .vz-card-head, .vz-valor, .vz-desemp-nums",
      );
      const target = (content as HTMLElement | null) ?? (el as HTMLElement);
      return {
        scroll: el.scrollHeight,
        client: el.clientHeight,
        overflowY: style.overflowY,
        contentBottom:
          target.getBoundingClientRect().bottom -
          el.getBoundingClientRect().top,
      };
    });
    // Overflow hidden no card: conteúdo principal deve caber na altura do card.
    expect(
      m.contentBottom,
      `${sel} content bottom ${m.contentBottom} > clientHeight ${m.client}`,
    ).toBeLessThanOrEqual(m.client + TOL + 4);
  }
}

export async function attachConsoleGuard(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/imagens\.test|Failed to load resource.*net::ERR_FAILED/i.test(text))
      return;
    if (/hydration|Minified React error|Warning: /i.test(text)) {
      errors.push(`console: ${text}`);
    }
  });
  return {
    assertClean: () => {
      expect(errors, errors.join("\n")).toEqual([]);
    },
    errors,
  };
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

  await page.route("**/imagens.test/**", (route) => route.abort());

  const guard = await attachConsoleGuard(page);
  await page.goto("/carreira");
  await page.waitForSelector('[data-testid="home-dashboard"], .vz-home-grid', {
    timeout: 30_000,
  });
  return { fixture: saveFixture, guard };
}

export async function abrirComFixtureMutada(
  page: Page,
  mutar: (carreira: Record<string, unknown>) => void,
  baseFile = "fixture-save-sem-rail.json",
) {
  const base = lerFixture(baseFile);
  const carreira = structuredClone(base.carreira) as Record<string, unknown>;
  mutar(carreira);
  const payload = { carreira, revision: base.revision ?? 1 };
  await page.route("**/api/carreira", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...payload, revision: payload.revision + 1 }),
    });
  });
  await page.route("**/imagens.test/**", (route) => route.abort());
  const guard = await attachConsoleGuard(page);
  await page.goto("/carreira");
  await page.waitForSelector(".vz-home-grid", { timeout: 30_000 });
  return { guard, payload };
}
