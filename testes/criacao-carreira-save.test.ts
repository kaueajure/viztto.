import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { sortearHistoria } from "@/dominio/historia-formacao";
import {
  hidratarElencoClube,
  type DadosImportadosJogador,
} from "@/dominio/jogador-mundo";
import { classificarFalha, criarJogoStore } from "@/estado/jogo-store";
import { CODIGOS_ERRO_SAVE } from "@/infraestrutura/persistencia/codigos-erro";
import { serializarCarreira } from "@/infraestrutura/persistencia/carreira-persistida";
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from "@/infraestrutura/persistencia/cliente-carreira";
import { ZodError } from "zod";
import { exemploCarreira } from "./auxiliar-carreira-persistida";

const SNAPSHOT_POR_LIGA: Record<string, string> = {
  brasileirao: "brasileirao.json",
  "brasileirao-b": "brasileirao-b.json",
  "premier-league": "premier-league.json",
  championship: "championship.json",
  "la-liga": "la-liga.json",
  "la-liga-2": "la-liga-2.json",
  "serie-a": "serie-a.json",
  "serie-b": "serie-b.json",
  bundesliga: "bundesliga.json",
  "bundesliga-2": "bundesliga-2.json",
  "ligue-1": "ligue-1.json",
  "ligue-2": "ligue-2.json",
};

function carregarSnapshot(ligaId: string) {
  const arquivo = SNAPSHOT_POR_LIGA[ligaId];
  if (!arquivo) throw new Error(`Snapshot ausente: ${ligaId}`);
  return JSON.parse(
    readFileSync(join(process.cwd(), "src/dados/futebol", arquivo), "utf8"),
  ) as { clubes: unknown[]; inicio: string };
}

describe("criação de carreira → persistência", () => {
  it("hidrata snapshot enriquecido com posicaoPrincipal e forma", () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const { clubes } = carregarSnapshot("brasileirao");
    const bruto = (clubes[0] as { elenco: DadosImportadosJogador[] }).elenco[0]! as DadosImportadosJogador & {
      overall: number;
      potencial: number;
    };
    expect(bruto.overall).toBeTypeOf("number");
    expect(
      (bruto as { posicaoPrincipal?: string }).posicaoPrincipal,
    ).toBeUndefined();

    const out = hidratarElencoClube(
      [bruto],
      { id: "tm-1023", reputacao: 80, forcaGeral: 75 },
      liga,
    );
    expect(out[0]!.posicaoPrincipal).toBeTruthy();
    expect(Array.isArray(out[0]!.posicoesSecundarias)).toBe(true);
    expect(out[0]!.forma).toBeTypeOf("number");
    expect(out[0]!.moral).toBeTypeOf("number");
    expect(out[0]!.overall).toBe(bruto.overall);
  });

  it("criarCarreira + serializarCarreira com clubes da API", () => {
    const liga = LIGAS_SUPORTADAS.find((l) => l.id === "brasileirao")!;
    const snapshot = carregarSnapshot("brasileirao");
    const seed = "teste-criacao-save-api";
    const posicao = "MEI" as const;
    const historia = Object.fromEntries(
      Object.entries(sortearHistoria(seed, posicao)).map(([k, v]) => [
        k,
        v[0]!.id,
      ]),
    ) as Record<"origem" | "destaque" | "dificuldade" | "chegada", string>;

    const carreira = criarCarreira({
      identidade: {
        nome: "Teste",
        sobrenome: "Save",
        nacionalidade: "Brasil",
        idade: 17,
        posicao,
        posicaoSecundaria: "MC",
        peDominante: "direito",
        altura: 178,
        peso: 72,
        arquetipo: "criador",
      },
      liga,
      clubes: snapshot.clubes as never,
      clubeId: (snapshot.clubes[0] as { id: string }).id,
      origem: "api",
      seed,
      dataInicio: snapshot.inicio,
      historia,
    });

    expect(carreira.clubes.length).toBeGreaterThanOrEqual(2);
    for (const j of carreira.clubes[0]!.elenco) {
      expect(j.posicaoPrincipal).toBeTruthy();
      expect(Array.isArray(j.posicoesSecundarias)).toBe(true);
      expect(j.forma).toBeTypeOf("number");
    }

    const persistido = serializarCarreira(carreira);
    expect(persistido.versao).toBe(4);
    expect(persistido.clubesDinamicos.length).toBe(carreira.clubes.length);
    expect(persistido.jogador.perfilFormacao.origem).toBe("historia");
  });

  it("iniciar chama api.criar quando a carreira é válida", async () => {
    const { entrada, carreira } = exemploCarreira();
    const api: ClienteCarreira = {
      carregar: vi.fn(async () => null),
      criar: vi.fn(async () => ({ carreira, revision: 0 })),
      salvar: vi.fn(async () => ({ revision: 1 })),
      excluir: vi.fn(async () => {}),
    };
    const store = criarJogoStore(api);
    await store.getState().carregar();
    expect(await store.getState().iniciar(entrada)).toBe(true);
    expect(api.criar).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(api.criar).mock.calls[0]![0];
    expect(payload.versao).toBe(4);
    expect(payload.id).toBe(entrada.seed);
  });

  it("identidade inválida não chama api.criar e não mascara como rede", async () => {
    const { entrada } = exemploCarreira();
    const api: ClienteCarreira = {
      carregar: vi.fn(async () => null),
      criar: vi.fn(async () => {
        throw new Error("não deveria chamar criar");
      }),
      salvar: vi.fn(async () => ({ revision: 1 })),
      excluir: vi.fn(async () => {}),
    };
    const store = criarJogoStore(api);
    await store.getState().carregar();
    const invalida = {
      ...entrada,
      identidade: { ...entrada.identidade, nome: "" },
    };
    expect(await store.getState().iniciar(invalida)).toBe(false);
    expect(api.criar).not.toHaveBeenCalled();
    expect(store.getState().erro).toBe(
      "Não foi possível validar o progresso para salvar. Suas alterações continuam nesta página.",
    );
  });

  it("classificarFalha: Zod/TypeError → SAVE_INVALID; rede → NETWORK_ERROR", () => {
    const zod = classificarFalha(
      new ZodError([
        {
          code: "invalid_type",
          expected: "number",
          path: ["forma"],
          message: "Invalid input: expected number, received undefined",
        },
      ]),
    );
    expect(zod.codigo).toBe(CODIGOS_ERRO_SAVE.SAVE_INVALID);
    expect(zod.retentavel).toBe(false);
    expect(zod.mensagem).toContain("Não foi possível validar");

    const typeErr = classificarFalha(
      new TypeError("Cannot read properties of undefined (reading 'includes')"),
    );
    expect(typeErr.codigo).toBe(CODIGOS_ERRO_SAVE.SAVE_INVALID);
    expect(typeErr.retentavel).toBe(false);
    expect(typeErr.mensagem).not.toContain("Tentaremos novamente automaticamente");

    const rede = classificarFalha(
      new ErroApiCarreira(
        0,
        "Falha de rede",
        undefined,
        CODIGOS_ERRO_SAVE.NETWORK_ERROR,
      ),
    );
    expect(rede.codigo).toBe(CODIGOS_ERRO_SAVE.NETWORK_ERROR);
    expect(rede.retentavel).toBe(true);
    expect(rede.mensagem).toContain("Tentaremos novamente automaticamente");
  });
});
