import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  TEMPORADAS_INICIAIS,
  formatarTemporada,
} from "@/dominio/constantes/temporadas-iniciais";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { obterLigasDisponiveis } from "@/infraestrutura/persistencia/base-futebol";
import {
  salvarDadosLiga,
  lerDadosLiga,
  definirDiretorioImportacao,
  obterDiretorioImportacao,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import { importarLiga } from "@/infraestrutura/transfermarkt/importar-liga";
import { GET as obterClubes } from "@/app/api/futebol/route";
import { GET as obterLigas } from "@/app/api/futebol/ligas/route";
import { NextRequest } from "next/server";
import {
  mockTransfermarktBrasil,
  respostaJson,
} from "./auxiliar-mock-importacao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import type { Liga } from "@/dominio/entidades/modelos";

let dir: string;
const original = obterDiretorioImportacao();
const liga = { ...LIGAS_SUPORTADAS[0]!, quantidadeClubes: 3 };
function snapshot(l: Liga = liga): DadosLigaImportados {
  const calendario = TEMPORADAS_INICIAIS[l.id]!;
  return {
    ligaId: l.id,
    temporada: calendario.ano,
    temporadaTransfermarkt: calendario.temporadaTransfermarkt,
    inicio: calendario.inicio,
    importadoEm: "2026-09-16T12:00:00Z",
    atualizadoEm: "2026-09-16T12:00:00Z",
    status: "completo",
    progresso: { total: 3, importados: 3, falhas: 0, clubeAtual: null },
    clubes: gerarClubesDemonstracao(l)
      .slice(0, 3)
      .map((c, i) => ({ ...c, idTransfermarkt: String(i + 1) })),
    erros: [],
  };
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "viztto-fase04-"));
  definirDiretorioImportacao(dir);
});
afterEach(async () => {
  definirDiretorioImportacao(original);
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe("catálogo de 13 ligas", () => {
  it("tem IDs únicos e divisões corretas na ordem dos países", () => {
    expect(LIGAS_SUPORTADAS.map((l) => [l.idTransfermarkt, l.divisao])).toEqual(
      [
        ["BRA1", 1],
        ["BRA2", 2],
        ["BRA3", 3],
        ["GB1", 1],
        ["GB2", 2],
        ["ES1", 1],
        ["ES2", 2],
        ["IT1", 1],
        ["IT2", 2],
        ["L1", 1],
        ["L2", 2],
        ["FR1", 1],
        ["FR2", 2],
      ],
    );
    expect(new Set(LIGAS_SUPORTADAS.map((l) => l.id)).size).toBe(13);
    expect(new Set(LIGAS_SUPORTADAS.map((l) => l.idTransfermarkt)).size).toBe(
      13,
    );
  });
  it("separa ano exibido do identificador Transfermarkt e cobre todos os calendários", () => {
    for (const l of LIGAS_SUPORTADAS) {
      expect(TEMPORADAS_INICIAIS[l.id]).toBeTruthy();
      expect(formatarTemporada(l.id, 2026)).toBe(
        l.pais === "Brasil" ? "2026" : "2026/27",
      );
      if (l.pais === "Brasil")
        expect(TEMPORADAS_INICIAIS[l.id]!.temporadaTransfermarkt).toBe("2025");
    }
  });
});
describe("disponibilidade local", () => {
  it("não lista ligas ausentes ou JSON inválido", async () => {
    expect(await obterLigasDisponiveis()).toEqual([]);
    await writeFile(join(dir, `${liga.id}.json`), "{invalido");
    expect(await obterLigasDisponiveis()).toEqual([]);
    await writeFile(
      join(dir, `${liga.id}.json`),
      JSON.stringify({ ligaId: liga.id }),
    );
    expect(await obterLigasDisponiveis()).toEqual([]);
  });
  it("lista liga parcial com contagem real sem clube vazio ou falho", async () => {
    const dados = snapshot();
    dados.clubes.push({ ...dados.clubes[0]!, id: "vazio", elenco: [] });
    dados.status = "parcial";
    dados.progresso.total = 4;
    dados.erros = [
      { clubeId: dados.clubes[0]!.id, nome: "Falho", motivo: "Falha atual" },
    ];
    await salvarDadosLiga(dados);
    const ligas = await obterLigasDisponiveis();
    expect(ligas).toHaveLength(1);
    expect(ligas[0]!.clubesDisponiveis).toBe(2);
    expect(ligas[0]!.quantidadeClubes).toBe(2);
    expect(ligas[0]!.status).toBe("parcial");
    const resposta = await obterClubes(
      new NextRequest(`http://localhost/api/futebol?liga=${liga.id}`),
    );
    expect(
      (await resposta.json()).clubes.map((c: { id: string }) => c.id),
    ).toEqual(dados.clubes.slice(1, 3).map((c) => c.id));
  });
  it.each([
    "temporada",
    "inicio",
    "temporadaTransfermarkt",
    "status",
    "poucos",
  ])("exclui snapshot incompatível: %s", async (caso) => {
    const dados = snapshot();
    if (caso === "temporada") dados.temporada = 2024;
    if (caso === "inicio") dados.inicio = "2024-01-01";
    if (caso === "temporadaTransfermarkt")
      dados.temporadaTransfermarkt = "2024";
    if (caso === "status") dados.status = "em_andamento";
    if (caso === "poucos") dados.clubes = dados.clubes.slice(0, 1);
    await salvarDadosLiga(dados);
    expect(await obterLigasDisponiveis()).toEqual([]);
  });
  it("as duas rotas são somente leitura e não fazem fetch externo", async () => {
    await salvarDadosLiga(snapshot());
    const consulta = vi.fn();
    vi.stubGlobal("fetch", consulta);
    const resposta = await obterLigas();
    expect((await resposta.json()).ligas).toHaveLength(1);
    const clubes = await obterClubes(
      new NextRequest(`http://localhost/api/futebol?liga=${liga.id}`),
    );
    expect(clubes.status).toBe(200);
    expect(consulta).not.toHaveBeenCalled();
  });
  it("segunda divisão inicia carreira e outras divisões integram o mundo, inclusive no save legado", async () => {
    const b = LIGAS_SUPORTADAS[1]!,
      c = LIGAS_SUPORTADAS[2]!;
    await salvarDadosLiga(snapshot(b));
    await salvarDadosLiga(snapshot(c));
    const ligas = await obterLigasDisponiveis();
    expect(ligas.map((l) => l.id)).toEqual([b.id, c.id]);
    const clubes = snapshot(b).clubes;
    const carreira = criarCarreira({
      identidade: {
        nome: "Ana",
        sobrenome: "Costa",
        nacionalidade: "Brasil",
        idade: 18,
        posicao: "PD",
        posicaoSecundaria: "",
        peDominante: "direito",
        altura: 170,
        peso: 60,
        arquetipo: "criador",
      },
      liga: b,
      clubes,
      clubeId: clubes[0]!.id,
      origem: "api",
      seed: "fase04",
      dataInicio: TEMPORADAS_INICIAIS[b.id]!.inicio,
      ligasMundo: [c],
      clubesMundo: snapshot(c).clubes,
    });
    expect(carreira.liga.divisao).toBe(2);
    expect(carreira.temporadasExternas[c.id]).toBeTruthy();
    const legado = JSON.parse(JSON.stringify(carreira));
    delete legado.liga.divisao;
    legado.ligas.forEach((l: { divisao?: number }) => delete l.divisao);
    const restaurado = validarSave(legado);
    expect(restaurado.liga.divisao).toBe(2);
    expect(restaurado.ligas[1]!.divisao).toBe(3);
  });
  it("frontend não possui POST, polling nem catálogo de opções hardcoded", async () => {
    const texto = await readFile(
      "src/componentes/jogador/CriacaoCarreira.tsx",
      "utf8",
    );
    expect(texto).not.toMatch(
      /api\/futebol\/importar|setInterval|setTimeout|precisaImportar|LIGAS_CRIACAO|LIGAS_SUPORTADAS|method:\s*["']POST/,
    );
    expect(texto).toContain("/api/futebol/ligas");
    expect(texto).toContain("l.clubesDisponiveis");
  });
});
describe("atualização segura", () => {
  it("continua após falha, preserva snapshot anterior e executa sequencialmente", async () => {
    const anterior = snapshot();
    await salvarDadosLiga(anterior);
    let simultaneas = 0,
      maximo = 0;
    const importar: typeof importarLiga = vi.fn(async (l, opcoes) => {
      simultaneas++;
      maximo = Math.max(maximo, simultaneas);
      try {
        if (l.id === liga.id) throw new Error("API indisponível");
        const dados = snapshot(l);
        await salvarDadosLiga(dados, opcoes?.diretorio);
        return {
          ...dados,
          temporadaTransfermarkt: dados.temporadaTransfermarkt!,
        };
      } finally {
        simultaneas--;
      }
    });
    const resumo = await atualizarBaseFutebol({
      diretorio: dir,
      ligas: LIGAS_SUPORTADAS.slice(0, 3),
      importar,
      informar: () => {},
    });
    expect(maximo).toBe(1);
    expect(importar).toHaveBeenCalledTimes(1); // aborta no primeiro erro — lote atômico
    expect(resumo.temFalhas).toBe(true);
    expect(resumo.publicou).toBe(false);
    expect(resumo.ligas.every((l) => !l.publicado)).toBe(true);
    expect(await lerDadosLiga(liga.id)).toEqual(anterior);
  });
  it("não publica snapshot parcial (falhas de clube) — oficiais intactos", async () => {
    const anterior = snapshot();
    await salvarDadosLiga(anterior);
    const importar: typeof importarLiga = async (l, opcoes) => {
      const dados = snapshot(l);
      dados.status = "parcial";
      dados.erros = [
        { clubeId: dados.clubes[0]!.id, nome: "Falhou", motivo: "Falha" },
      ];
      dados.progresso = {
        total: 3,
        importados: 2,
        falhas: 1,
        clubeAtual: null,
      };
      await salvarDadosLiga(dados, opcoes?.diretorio);
      return {
        ...dados,
        temporadaTransfermarkt: dados.temporadaTransfermarkt!,
      };
    };
    const resumo = await atualizarBaseFutebol({
      diretorio: dir,
      ligas: [liga],
      importar,
      informar: () => {},
    });
    expect(resumo.temFalhas).toBe(true);
    expect(resumo.ligas[0]!.publicado).toBe(false);
    expect(resumo.publicou).toBe(false);
    expect(await lerDadosLiga(liga.id)).toEqual(anterior);
  });
  it("processa todas as 13 ligas por padrão sem acessar a rede", async () => {
    const ordem: string[] = [];
    const importar: typeof importarLiga = async (l, opcoes) => {
      ordem.push(l.id);
      expect(opcoes?.forcar).toBe(true);
      expect(opcoes?.diretorio).toContain("viztto-import-");
      const dados = snapshot(l);
      await salvarDadosLiga(dados, opcoes?.diretorio);
      return {
        ...dados,
        temporadaTransfermarkt: dados.temporadaTransfermarkt!,
      };
    };
    const consulta = vi.fn();
    vi.stubGlobal("fetch", consulta);
    const resumo = await atualizarBaseFutebol({
      diretorio: dir,
      importar,
      informar: () => {},
      ligas: LIGAS_SUPORTADAS.map((l) => ({ ...l, quantidadeClubes: 3 })),
      permitirEnginePuro: true,
      executarBot: async (lote) => ({
        version: 1,
        batchId: lote.batchId,
        players: lote.players.map((p) => ({
          id: p.id,
          transfermarktId: p.transfermarktId,
          sources: [],
        })),
        providers: {},
        diagnostics: {},
      }),
    });
    expect(ordem).toEqual(LIGAS_SUPORTADAS.map((l) => l.id));
    expect(resumo.temFalhas).toBe(false);
    expect(resumo.ligas.every((l) => l.publicado)).toBe(true);
    expect(await obterLigasDisponiveis()).toHaveLength(13);
    expect(consulta).not.toHaveBeenCalled();
  });
  it("resultado inválido no staging não sobrescreve o snapshot oficial", async () => {
    const anterior = snapshot();
    await salvarDadosLiga(anterior);
    const importar: typeof importarLiga = async (l, opcoes) => {
      await writeFile(join(opcoes!.diretorio!, `${l.id}.json`), "{inválido");
      return { ...snapshot(l), temporadaTransfermarkt: "2025" };
    };
    const resumo = await atualizarBaseFutebol({
      diretorio: dir,
      ligas: [liga],
      importar,
      informar: () => {},
    });
    expect(resumo.temFalhas).toBe(true);
    expect(resumo.ligas[0]!.publicado).toBe(false);
    expect(await lerDadosLiga(liga.id)).toEqual(anterior);
  });
  it("forçar atualização não reaproveita elenco antigo quando clube falha", async () => {
    vi.stubGlobal("fetch", mockTransfermarktBrasil());
    await importarLiga(liga, {
      baseUrl: "https://tm.test",
      esperar: async () => {},
    });
    const mock = mockTransfermarktBrasil();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/clubs/614/profile") ? respostaJson({}, 404) : mock(url),
      ),
    );
    const resultado = await importarLiga(liga, {
      baseUrl: "https://tm.test",
      forcar: true,
      esperar: async () => {},
    });
    expect(resultado.clubes).toHaveLength(2);
    expect(
      (await lerDadosLiga(liga.id))!.clubes.find((c) => c.id === "tm-614")!
        .elenco,
    ).toEqual([]);
  });
  it("rejeita edição errada retornada pela API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaJson({
          id: "BRA1",
          name: "Série A",
          seasonId: "2024",
          clubs: [
            { id: "1", name: "A" },
            { id: "2", name: "B" },
          ],
        }),
      ),
    );
    await expect(
      importarLiga(liga, {
        baseUrl: "https://tm.test",
        esperar: async () => {},
      }),
    ).rejects.toThrow("incompatível");
    expect(await lerDadosLiga(liga.id)).toBeNull();
  });
});
