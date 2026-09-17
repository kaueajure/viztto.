import { quedaSeveraEnriquecimento } from "@/infraestrutura/ratings/saude-ratings";
import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile, readdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  normalizarRatingMetadata,
  esquemaRatingMetadata,
} from "@/dominio/rating-metadata";
import {
  publicarReleaseAtomica,
  lerDadosLiga,
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { validarSnapshotsVersionados } from "@/infraestrutura/persistencia/validar-snapshots-git";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";

const dirs: string[] = [];
async function temporario() {
  const dir = await mkdtemp(join(tmpdir(), "viztto-v3-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});

function snapshot(liga = LIGAS_SUPORTADAS[0]): DadosLigaImportados {
  const cal = TEMPORADAS_INICIAIS[liga.id];
  const modelo = gerarClubesDemonstracao(liga)[0];
  const clubes = Array.from({ length: liga.quantidadeClubes }, (_, i) => {
    const c = structuredClone(modelo);
    c.id = `${liga.id}-c${i}`;
    c.nome = `Equipe ${i}`;
    c.idTransfermarkt = c.id;
    c.elenco = Array.from({ length: 25 }, (_, j) => ({
      ...structuredClone(modelo.elenco[j % modelo.elenco.length]),
      id: `${c.id}-j${j}`,
      idTransfermarkt: `${c.id}-j${j}`,
      clubeId: c.id,
      nome: `Atleta ${i} Numero ${j}`,
      dataNascimento: `${1990 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-${String(j + 1).padStart(2, "0")}`,
    }));
    c.tamanhoElenco = 25;
    return c;
  });
  return {
    ligaId: liga.id,
    temporada: cal.ano,
    temporadaTransfermarkt: cal.temporadaTransfermarkt,
    inicio: cal.inicio,
    importadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    status: "completo",
    progresso: {
      total: clubes.length,
      importados: clubes.length,
      falhas: 0,
      clubeAtual: null,
    },
    clubes,
    erros: [],
  };
}

it("publica 13; rejeita 12, 1, duplicada e inesperada preservando active", async () => {
  const dir = await temporario();
  const todos = LIGAS_SUPORTADAS.map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  await publicarReleaseAtomica(todos, dir);
  const antes = await readFile(join(dir, "active.json"), "utf8");
  for (const candidatos of [
    todos.slice(0, 12),
    todos.slice(0, 1),
    [...todos.slice(0, 12), todos[0]],
    [...todos.slice(0, 12), { ...todos[12], ligaId: "inesperada" }],
  ]) {
    await expect(publicarReleaseAtomica(candidatos, dir)).rejects.toThrow();
    expect(await readFile(join(dir, "active.json"), "utf8")).toBe(antes);
  }
  for (const liga of LIGAS_SUPORTADAS)
    expect((await lerDadosLiga(liga.id, dir))?.ligaId).toBe(liga.id);
});

it("permite universo isolado de duas ligas apenas explicitamente", async () => {
  const dir = await temporario();
  const candidatos = LIGAS_SUPORTADAS.slice(0, 2).map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  await expect(publicarReleaseAtomica(candidatos, dir)).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
  await publicarReleaseAtomica(candidatos, dir, {
    publicacao: {
      modo: "isolada",
      ligasEsperadas: candidatos.map((c) => c.ligaId),
    },
  });
  expect(await lerDadosLiga(candidatos[1].ligaId, dir)).not.toBeNull();
});

it.each([
  [0.15, 0.05, true],
  [0.35, 0.12, true],
  [0.7, 0.4, false],
  [0.7, 0.1, true],
  [0.35, 0.33, false],
])("queda %s → %s: severa=%s", (anterior, atual, severa) => {
  expect(quedaSeveraEnriquecimento(atual as number, anterior as number)).toBe(
    severa,
  );
});

it("normalizador seleciona conhecidos, save permanece strict", () => {
  const metadata = {
    source: "external",
    confidence: "high",
    minutes: 1800,
    extraField: "futuro",
  };
  expect(normalizarRatingMetadata(metadata)).toEqual({
    source: "external",
    confidence: "high",
    minutes: 1800,
  });
  expect(esquemaRatingMetadata.safeParse(metadata).success).toBe(false);
  expect(
    normalizarRatingMetadata({ ...metadata, confidence: "invalida" }),
  ).toBeUndefined();
});

it("clone lógico versionado lê todas as ligas e referência ausente é rejeitada", async () => {
  const dir = await temporario(),
    clone = await temporario();
  const todos = LIGAS_SUPORTADAS.map((l) => ({
    ligaId: l.id,
    dados: snapshot(l),
  }));
  for (const c of todos) await salvarDadosLiga(c.dados, dir);
  const { releaseId } = await publicarReleaseAtomica(todos, dir);
  expect((await readdir(dir)).sort()).toEqual(["active.json", "releases"]);
  await cp(dir, clone, { recursive: true });
  const ler = async (caminho: string) => {
    try {
      return await readFile(
        join(clone, caminho.replace("src/dados/futebol/", "")),
        "utf8",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  };
  await validarSnapshotsVersionados(ler);
  for (const l of LIGAS_SUPORTADAS)
    expect((await lerDadosLiga(l.id, clone))?.ligaId).toBe(l.id);
  await rm(join(clone, "releases", releaseId), { recursive: true });
  await expect(validarSnapshotsVersionados(ler)).rejects.toThrow("ausente");
  await expect(lerDadosLiga("premier-league", clone)).rejects.toThrow(
    "NÃO será usado",
  );
});

// Respostas seguem GET Team Squad by Team and Season ID: data[] + player + details.type.
it("save completo rejeita metadata com extras", async () => {
  const { exemploCarreira } = await import("./auxiliar-carreira-persistida");
  const { serializarCarreira, validarCarreiraPersistida } =
    await import("@/infraestrutura/persistencia/carreira-persistida");
  const save = serializarCarreira(exemploCarreira().carreira);
  Object.assign(save.clubesDinamicos[0].elenco[0], {
    ratingMetadata: {
      source: "external",
      confidence: "high",
      campoFuturo: "x",
    },
  });
  expect(() => validarCarreiraPersistida(save)).toThrow();
});
