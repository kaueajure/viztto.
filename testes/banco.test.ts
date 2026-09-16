import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { obterDatabaseUrl } from "@/infraestrutura/banco/configuracao.mjs";
import { careerSaves } from "@/infraestrutura/banco/schema";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";

vi.mock("server-only", () => ({}));
const script = fileURLToPath(new URL("../scripts/db.mjs", import.meta.url));

afterEach(async () => {
  const { encerrarBanco } = await import("@/infraestrutura/banco/conexao");
  await encerrarBanco();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("fundação PostgreSQL", () => {
  it("importa infraestrutura sem exigir configuração ou abrir conexão", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const { obterBanco } = await import("@/infraestrutura/banco/conexao");
    expect(obterBanco).toBeTypeOf("function");
    expect(obterBanco).toThrow("DATABASE_URL não definida");
  });

  it.each([
    "",
    "https://usuario:segredo@localhost/banco",
    "postgresql://localhost",
  ])(
    "rejeita configuração ausente ou inválida sem revelar seu conteúdo (%#)",
    (valor) => {
      vi.stubEnv("DATABASE_URL", valor);
      expect(obterDatabaseUrl).toThrow(/DATABASE_URL (não definida|inválida)/);
      try {
        obterDatabaseUrl();
      } catch (erro) {
        expect(String(erro)).not.toContain("segredo");
      }
    },
  );

  it("reutiliza o pool e o ORM após recarregar módulos", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://teste:teste@127.0.0.1:1/teste");
    const { obterBanco } = await import("@/infraestrutura/banco/conexao");
    const db = obterBanco(); // Postgres.js não conecta até a primeira consulta.
    expect(obterBanco()).toBe(db);
    vi.resetModules();
    const recarregado = await import("@/infraestrutura/banco/conexao");
    expect(recarregado.obterBanco()).toBe(db);
    await recarregado.encerrarBanco();
    expect(recarregado.obterBanco()).not.toBe(db);
  });

  it.each(["check", "migrate"])(
    "CLI %s falha claramente sem DATABASE_URL",
    (comando) => {
      const env = { ...process.env };
      delete env.DATABASE_URL;
      const resultado = spawnSync(
        process.execPath,
        ["--conditions=react-server", script, comando],
        {
          env,
          encoding: "utf8",
          timeout: 15_000,
        },
      );
      expect(resultado.status).toBe(1);
      expect(resultado.stderr).toContain("DATABASE_URL não definida");
    },
  );

  it("bloqueia importação da conexão fora do ambiente server-only", () => {
    const cliente = fileURLToPath(
      new URL("../src/infraestrutura/banco/cliente.mjs", import.meta.url),
    );
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const resultado = spawnSync(process.execPath, [cliente], {
      env,
      encoding: "utf8",
    });
    expect(resultado.status).not.toBe(0);
    expect(resultado.stderr).toContain(
      "cannot be imported from a Client Component",
    );
  });

  it.skipIf(!process.env.VIZTTO_TEST_DATABASE_URL)(
    "preserva o EstadoCarreira completo em JSONB, datas, UUIDs e defaults no PostgreSQL",
    async () => {
      // Somente banco de teste explicitamente fornecido, com migrations já aplicadas.
      vi.stubEnv("DATABASE_URL", process.env.VIZTTO_TEST_DATABASE_URL!);
      const { obterBanco } = await import("@/infraestrutura/banco/conexao");
      const db = obterBanco();
      const liga = LIGAS_SUPORTADAS[0]!;
      const clubes = gerarClubesDemonstracao(liga).slice(0, 4);
      const state = criarCarreira({
        identidade: {
          nome: "Ana",
          sobrenome: "Teste",
          nacionalidade: "Brasil",
          idade: 22,
          posicao: "PD",
          posicaoSecundaria: "",
          peDominante: "direito",
          altura: 170,
          peso: 62,
          arquetipo: "criador",
        },
        liga,
        clubes,
        clubeId: clubes[0]!.id,
        origem: "demonstracao",
        seed: "id-do-dominio-nao-e-uuid",
        dataInicio: "2026-06-01",
      });
      const rollback = new Error("Rollback intencional do teste");
      await expect(
        db.transaction(async (tx) => {
          const [salvo] = await tx
            .insert(careerSaves)
            .values({
              saveVersion: 3,
              name: "Carreira de teste",
              gameDate: state.dataAtual,
              state: serializarCarreira(state),
            })
            .returning();
          expect(salvo.id).toMatch(/^[0-9a-f-]{36}$/);
          expect(salvo.id).not.toBe(state.id);
          expect(salvo.currentClubId).toBeNull();
          expect(salvo.currentLeagueId).toBeNull();
          expect(salvo.createdAt).toBeInstanceOf(Date);
          expect(salvo.updatedAt).toEqual(salvo.createdAt);
          const [lido] = await tx
            .select()
            .from(careerSaves)
            .where(eq(careerSaves.id, salvo.id));
          expect(lido.state).toEqual(
            JSON.parse(JSON.stringify(serializarCarreira(state))),
          );
          expect(lido.gameDate).toBe("2026-06-01");
          const id = "f5ec7b7d-9e47-4f86-943a-78638a3f5210";
          const [explicito] = await tx
            .insert(careerSaves)
            .values({
              id,
              saveVersion: 3,
              name: "UUID da aplicação",
              gameDate: state.dataAtual,
              currentClubId: state.clubeAtualId,
              currentLeagueId: state.liga.id,
              state: serializarCarreira(state),
            })
            .returning();
          expect(explicito.id).toBe(id);
          expect(explicito.currentClubId).toBe(state.clubeAtualId);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    },
  );
});
