import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TOL = 2;

/** Listas com scroll interno intencional — não falham por scrollHeight. */
export const SCROLL_LISTAS_OK = [
  ".vz-msg-lista",
  ".vz-cal-lista",
  ".vz-obj-lista",
] as const;

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ConsoleGuardOptions = {
  /** Allowlist explícita: regex contra o texto do console.error. */
  allowlist?: RegExp[];
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

/**
 * Cards que NÃO podem rolar internamente: scrollHeight ≤ clientHeight
 * e conteúdo essencial cabe no card.
 */
export async function expectCardsWithoutInternalScroll(
  page: Page,
  selectors: string[],
) {
  for (const sel of selectors) {
    const m = await page.locator(sel).first().evaluate((el) => {
      const style = getComputedStyle(el);
      const content = el.querySelector(
        ".vz-hero-info, .vz-card-head, .vz-valor, .vz-desemp-nums",
      );
      const target = (content as HTMLElement | null) ?? (el as HTMLElement);
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: style.overflowY,
        contentBottom:
          target.getBoundingClientRect().bottom -
          el.getBoundingClientRect().top,
      };
    });
    expect(
      m.scrollHeight,
      `${sel} scrollHeight ${m.scrollHeight} > clientHeight ${m.clientHeight} (overflowY=${m.overflowY})`,
    ).toBeLessThanOrEqual(m.clientHeight + TOL + 4);
    expect(
      m.contentBottom,
      `${sel} content bottom ${m.contentBottom} > clientHeight ${m.clientHeight}`,
    ).toBeLessThanOrEqual(m.clientHeight + TOL + 4);
  }
}

/** @deprecated Use expectCardsWithoutInternalScroll */
export async function expectNoCardInternalScroll(
  page: Page,
  selectors: string[],
) {
  return expectCardsWithoutInternalScroll(page, selectors);
}

/**
 * Listas com scroll intencional: container visível, footer/link acessível,
 * sem tratar overflowY:auto como falha.
 */
export async function expectScrollableListsHealthy(
  page: Page,
  selectors: readonly string[] = SCROLL_LISTAS_OK,
) {
  for (const sel of selectors) {
    const lista = page.locator(sel).first();
    if ((await lista.count()) === 0) continue;
    await expect(lista).toBeVisible();
    const card = lista.locator(
      "xpath=ancestor::*[contains(@class,'vz-card') or contains(@class,'vz-mensagens') or contains(@class,'vz-mini-cal') or contains(@class,'vz-objetivos')][1]",
    );
    const link = card.getByRole("link").first();
    if ((await link.count()) > 0) {
      await expect(link).toBeVisible();
    }
  }
}

/**
 * Por padrão, todo console.error falha o E2E.
 * Allowlist pequena e explícita apenas para erros esperados (ex.: abort de imagens.test).
 */
export async function attachConsoleGuard(
  page: Page,
  options: ConsoleGuardOptions = {},
) {
  const allowlist = options.allowlist ?? [
    /imagens\.test/i,
    /Failed to load resource.*net::ERR_FAILED/i,
    /Failed to load resource.*net::ERR_ABORTED/i,
  ];
  const errors: {
    type: string;
    text: string;
    url: string;
    location?: string;
  }[] = [];

  page.on("pageerror", (err) => {
    errors.push({
      type: "pageerror",
      text: err.message,
      url: page.url(),
      location: err.stack?.split("\n")[1]?.trim(),
    });
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (allowlist.some((re) => re.test(text))) return;
    const loc = msg.location();
    errors.push({
      type: "console.error",
      text,
      url: page.url(),
      location: loc.url
        ? `${loc.url}:${loc.lineNumber}:${loc.columnNumber}`
        : undefined,
    });
  });

  return {
    assertClean: () => {
      expect(
        errors,
        errors
          .map(
            (e) =>
              `[${e.type}] ${e.text}${e.location ? ` @ ${e.location}` : ""} (${e.url})`,
          )
          .join("\n"),
      ).toEqual([]);
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
  let payload: { carreira: Record<string, unknown>; revision: number } = {
    carreira,
    revision: base.revision ?? 1,
  };
  await page.route("**/api/carreira", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
      return;
    }
    if (method === "PUT" || method === "POST") {
      try {
        const body = route.request().postDataJSON() as {
          state?: Record<string, unknown>;
          revision?: number | null;
        } | null;
        const revBase =
          typeof body?.revision === "number"
            ? body.revision
            : payload.revision;
        // O client serializa v4; o fixture E2E é v2 embutido. Mescla só o jogador.
        if (body?.state?.jogador && typeof body.state.jogador === "object") {
          const atual = payload.carreira.jogador as Record<string, unknown>;
          const novo = body.state.jogador as Record<string, unknown>;
          payload = {
            carreira: {
              ...payload.carreira,
              dataAtual:
                (body.state.dataAtual as string) ?? payload.carreira.dataAtual,
              jogador: {
                ...atual,
                ...novo,
                preparacao: novo.preparacao ?? atual.preparacao,
                atributos: novo.atributos ?? atual.atributos,
                desenvolvimento: novo.desenvolvimento ?? atual.desenvolvimento,
                overall: novo.overall ?? atual.overall,
              },
            },
            revision: revBase + 1,
          };
        } else {
          payload = { ...payload, revision: revBase + 1 };
        }
      } catch {
        payload = { ...payload, revision: payload.revision + 1 };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          carreira: payload.carreira,
          revision: payload.revision,
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });
  await page.route("**/imagens.test/**", (route) => route.abort());
  const guard = await attachConsoleGuard(page);
  await page.goto("/carreira");
  await page.waitForSelector(".vz-home-grid", { timeout: 30_000 });
  return { guard, payload };
}
