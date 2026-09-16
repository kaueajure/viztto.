import "server-only";
import {
  mkdir,
  readFile,
  stat,
  writeFile,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const DIRETORIO = join(process.cwd(), ".cache", "viztto", "escudos");
const VALIDADE = 30 * 86400000;
const LIMITE_BYTES = 1024 * 1024;
const pendentes = new Map<number, Promise<Uint8Array>>();
let fila: Promise<unknown> = Promise.resolve();
let proximaConsulta = 0;
let indisponivelAte = 0;
const assinaturaPng = [137, 80, 78, 71, 13, 10, 26, 10];
export function validarPng(dados: Uint8Array): boolean {
  return (
    dados.length >= 24 &&
    dados.length <= LIMITE_BYTES &&
    assinaturaPng.every((valor, i) => dados[i] === valor)
  );
}
async function lerCache(
  id: number,
): Promise<{ dados: Uint8Array; recente: boolean } | null> {
  try {
    const caminho = join(DIRETORIO, `${id}.png`);
    const informacao = await stat(caminho);
    if (informacao.size > LIMITE_BYTES) return null;
    const dados = await readFile(caminho);
    return validarPng(dados)
      ? { dados, recente: Date.now() - informacao.mtimeMs < VALIDADE }
      : null;
  } catch {
    return null;
  }
}
async function guardar(id: number, dados: Uint8Array): Promise<void> {
  const temporario = join(DIRETORIO, `${id}-${randomUUID()}.tmp`);
  try {
    await mkdir(DIRETORIO, { recursive: true });
    await writeFile(temporario, dados);
    await rename(temporario, join(DIRETORIO, `${id}.png`));
    const arquivos = (await readdir(DIRETORIO)).filter((nome) =>
      /^\d+\.png$/.test(nome),
    );
    if (arquivos.length > 256) {
      const datas = await Promise.all(
        arquivos.map(async (nome) => ({
          nome,
          data: (await stat(join(DIRETORIO, nome))).mtimeMs,
        })),
      );
      datas.sort((a, b) => a.data - b.data);
      await Promise.all(
        datas
          .slice(0, arquivos.length - 256)
          .map((arquivo) => unlink(join(DIRETORIO, arquivo.nome))),
      );
    }
  } catch {
    await unlink(temporario).catch(() => undefined);
  }
}
async function baixar(id: number): Promise<Uint8Array> {
  if (Date.now() < indisponivelAte)
    throw new Error("CDN de escudos temporariamente indisponível.");
  const espera = proximaConsulta - Date.now();
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
  proximaConsulta = Date.now() + 350;
  try {
    const resposta = await fetch(
      `https://media.api-sports.io/football/teams/${id}.png`,
      {
        signal: AbortSignal.timeout(8000),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (!resposta.ok) {
      if (resposta.status === 429 || resposta.status >= 500)
        indisponivelAte = Date.now() + 60000;
      throw new Error("Escudo indisponível no provedor.");
    }
    if (
      !resposta.headers.get("content-type")?.startsWith("image/png") ||
      Number(resposta.headers.get("content-length")) > LIMITE_BYTES
    )
      throw new Error("Formato de escudo inválido.");
    const leitor = resposta.body?.getReader();
    if (!leitor) throw new Error("Escudo vazio.");
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > LIMITE_BYTES) {
        await leitor.cancel();
        throw new Error("Escudo muito grande.");
      }
      partes.push(value);
    }
    const dados = new Uint8Array(tamanho);
    let posicao = 0;
    for (const parte of partes) {
      dados.set(parte, posicao);
      posicao += parte.length;
    }
    if (!validarPng(dados)) throw new Error("Imagem de escudo inválida.");
    await guardar(id, dados);
    return dados;
  } catch (erro) {
    if (
      erro instanceof TypeError ||
      (erro instanceof Error && erro.name === "TimeoutError")
    )
      indisponivelAte = Date.now() + 60000;
    throw erro;
  }
}
export async function buscarEscudo(id: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 1000000)
    throw new Error("Identificador de clube inválido.");
  const cache = await lerCache(id);
  if (cache?.recente) return cache.dados;
  const atual = pendentes.get(id);
  if (atual) return atual;
  if (pendentes.size >= 32) {
    if (cache) return cache.dados;
    throw new Error("Muitos escudos em carregamento.");
  }
  const operacao = fila
    .catch(() => undefined)
    .then(() => baixar(id))
    .catch((erro) => {
      if (cache) return cache.dados;
      throw erro;
    });
  fila = operacao;
  pendentes.set(id, operacao);
  try {
    return await operacao;
  } finally {
    pendentes.delete(id);
  }
}
