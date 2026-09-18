import { test, expect } from "@playwright/test";
import { abrirComFixtureMutada } from "./helpers";

/**
 * Joga o pênalti com a lógica real de score:
 * posiciona o cursor no centro verde via hook de teste e dispara CHUTAR.
 * Não injeta nota/score final — só controla o input do minigame.
 */
async function chutarCentroVerde(page: import("@playwright/test").Page) {
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __vizttoTreinoBarra?: unknown })
          .__vizttoTreinoBarra,
    );
    await page.evaluate(() => {
      const api = (
        window as unknown as {
          __vizttoTreinoBarra: { setPos: (n: number) => void; chutar: () => void };
        }
      ).__vizttoTreinoBarra;
      api.setPos(0.5);
      api.chutar();
    });
    if (i < 4) {
      await expect(page.getByTestId("treino-tentativa")).toContainText(
        `Tentativa ${i + 2} / 5`,
        { timeout: 3000 },
      );
    }
  }
}

test("Centro de treinamento — pênalti, slot, persistência e simular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirComFixtureMutada(page, (c) => {
    const j = c.jogador as Record<string, unknown>;
    j.lesao = null;
    j.idade = 17;
    const prep = {
      ...((j.preparacao as object) ?? {}),
      centro: {
        progressoAtributos: {},
        melhoresExercicios: {},
        semana: { chave: "", sessoes: [] },
      },
    };
    j.preparacao = prep;
  });

  await page.goto("/carreira/treinamento");
  await expect(page.getByTestId("treino-semana")).toBeVisible();
  await expect(page.getByText(/0 \/ 3 sessões/i)).toBeVisible();

  await page.getByTestId("jogar-penaltis").first().click();
  await expect(page.getByTestId("modal-treino")).toBeVisible();
  await expect(page.getByTestId("minigame-penaltis")).toBeVisible();

  await chutarCentroVerde(page);
  const erro = page.getByTestId("treino-resultado-erro");
  const ok = page.getByTestId("treino-resultado");
  await expect(ok.or(erro)).toBeVisible({ timeout: 10000 });
  if (await erro.isVisible()) {
    throw new Error(
      `Treino não aplicado: ${await page.locator(".aviso").textContent()}`,
    );
  }
  await expect(page.getByTestId("resultado-nota")).toHaveText(/NOTA A/);
  await expect(page.getByTestId("resultado-score")).toHaveText(/9\d|100/);
  await page.getByTestId("concluir-treino").click();

  await expect(page.getByTestId("slot-treino-0")).toContainText(/CONCLUÍDO/i);
  await expect(page.getByTestId("simular-penaltis").first()).toBeVisible();

  await page.reload();
  await page.goto("/carreira/treinamento");
  await expect(page.getByTestId("slot-treino-0")).toContainText(/CONCLUÍDO/i);
  await expect(page.getByTestId("simular-penaltis").first()).toBeVisible();
});

test("Centro — limite de 3 sessões", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await abrirComFixtureMutada(page, (c) => {
    const j = c.jogador as Record<string, unknown>;
    j.lesao = null;
    const data = (c as { dataAtual: string }).dataAtual;
    const d = new Date(`${data}T12:00:00Z`);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const chave = d.toISOString().slice(0, 10);
    j.preparacao = {
      ...((j.preparacao as object) ?? {}),
      centro: {
        progressoAtributos: {},
        melhoresExercicios: {
          penaltis: { score: 90, nota: "A", realizados: 3 },
          "passe-rapido": { score: 80, nota: "B", realizados: 2 },
          drible: { score: 75, nota: "B", realizados: 1 },
        },
        semana: {
          chave,
          sessoes: [
            {
              id: "a",
              exercicioId: "penaltis",
              score: 90,
              nota: "A",
              modo: "jogar",
              aplicada: true,
            },
            {
              id: "b",
              exercicioId: "passe-rapido",
              score: 80,
              nota: "B",
              modo: "simular",
              aplicada: true,
            },
            {
              id: "c",
              exercicioId: "drible",
              score: 75,
              nota: "B",
              modo: "jogar",
              aplicada: true,
            },
          ],
        },
      },
    };
  });

  await page.goto("/carreira/treinamento");
  await expect(page.getByTestId("limite-sessoes")).toBeVisible();
  await expect(page.getByTestId("jogar-penaltis").first()).toBeDisabled();
  await expect(page.getByText("TODOS OS EXERCÍCIOS")).toBeVisible();
});
