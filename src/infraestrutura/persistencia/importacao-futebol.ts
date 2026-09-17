import "server-only";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Clube } from "@/dominio/entidades/modelos";
import type { ErroImportacaoClube } from "@/infraestrutura/transfermarkt/importar-liga";
import { esquemaDadosLigaImportados } from "@/infraestrutura/transfermarkt/esquemas";

export type StatusImportacaoLiga =
  | "em_andamento"
  | "parcial"
  | "completo"
  | "interrompido";

export interface ProgressoImportacao {
  total: number;
  importados: number;
  falhas: number;
  clubeAtual: string | null;
}

export interface DadosLigaImportados {
  ligaId: string;
  temporada: number;
  temporadaTransfermarkt?: string;
  inicio: string;
  importadoEm: string;
  atualizadoEm: string;
  status: StatusImportacaoLiga;
  progresso: ProgressoImportacao;
  clubes: Clube[];
  erros: ErroImportacaoClube[];
  motivoInterrupcao?: string | null;
}

/** Ponteiro ativo da release — único arquivo trocado atomicamente. */
export interface ManifestoAtivo {
  versao: 1;
  releaseId: string;
  atualizadoEm: string;
  ligas: string[];
}

let diretorioBase =
  process.env.VIZTTO_IMPORTACAO_DIR ?? join(process.cwd(), "src/dados/futebol");

export function definirDiretorioImportacao(caminho: string): void {
  diretorioBase = caminho;
}

export function obterDiretorioImportacao(): string {
  return diretorioBase;
}

export function caminhoReleases(diretorio = diretorioBase): string {
  return join(diretorio, "releases");
}

export function caminhoManifestoAtivo(diretorio = diretorioBase): string {
  return join(diretorio, "active.json");
}

export function caminhoRelease(
  releaseId: string,
  diretorio = diretorioBase,
): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(releaseId))
    throw new Error("Identificador de release inválido.");
  return join(caminhoReleases(diretorio), releaseId);
}

function caminhoArquivo(ligaId: string, diretorio: string): string {
  if (!/^[a-z0-9-]+$/.test(ligaId))
    throw new Error("Identificador de liga inválido.");
  return join(diretorio, `${ligaId}.json`);
}

export function clubeComElencoCompleto(clube: Clube): boolean {
  return clube.elenco.length > 0 && Boolean(clube.idTransfermarkt);
}

export async function lerManifestoAtivo(
  diretorio = diretorioBase,
): Promise<ManifestoAtivo | null> {
  try {
    const bruto = JSON.parse(
      await readFile(caminhoManifestoAtivo(diretorio), "utf8"),
    ) as ManifestoAtivo;
    if (
      bruto?.versao !== 1 ||
      typeof bruto.releaseId !== "string" ||
      !Array.isArray(bruto.ligas)
    )
      return null;
    return bruto;
  } catch {
    return null;
  }
}

/**
 * Resolve o diretório de leitura da liga:
 * 1) release apontada por active.json (se existir e válida);
 * 2) layout legado plano `diretorio/<liga>.json`.
 */
export async function resolverDiretorioLeituraLiga(
  ligaId: string,
  diretorio = diretorioBase,
): Promise<string> {
  const ativo = await lerManifestoAtivo(diretorio);
  if (ativo) {
    const releaseDir = caminhoRelease(ativo.releaseId, diretorio);
    try {
      await readFile(caminhoArquivo(ligaId, releaseDir));
      return releaseDir;
    } catch {
      /* release quebrada → legado */
    }
  }
  return diretorio;
}

export async function lerDadosLiga(
  ligaId: string,
  diretorio = diretorioBase,
): Promise<DadosLigaImportados | null> {
  const origem = await resolverDiretorioLeituraLiga(ligaId, diretorio);
  try {
    const bruto = await readFile(caminhoArquivo(ligaId, origem), "utf8");
    return esquemaDadosLigaImportados.parse(
      JSON.parse(bruto),
    ) as DadosLigaImportados;
  } catch (erro) {
    if (
      erro instanceof SyntaxError ||
      (erro instanceof Error && erro.name === "ZodError") ||
      (erro as NodeJS.ErrnoException).code === "ENOENT"
    )
      return null;
    throw erro;
  }
}

/** Lê snapshot de um diretório específico (staging/release), sem manifesto. */
export async function lerDadosLigaEmDiretorio(
  ligaId: string,
  diretorioLiga: string,
): Promise<DadosLigaImportados | null> {
  try {
    const bruto = await readFile(caminhoArquivo(ligaId, diretorioLiga), "utf8");
    return esquemaDadosLigaImportados.parse(
      JSON.parse(bruto),
    ) as DadosLigaImportados;
  } catch (erro) {
    if (
      erro instanceof SyntaxError ||
      (erro instanceof Error && erro.name === "ZodError") ||
      (erro as NodeJS.ErrnoException).code === "ENOENT"
    )
      return null;
    throw erro;
  }
}

export async function salvarDadosLiga(
  dados: DadosLigaImportados,
  diretorio = diretorioBase,
): Promise<void> {
  const validado = esquemaDadosLigaImportados.parse(dados);
  await mkdir(diretorio, { recursive: true });
  const destino = caminhoArquivo(validado.ligaId, diretorio);
  const temporario = join(diretorio, `${validado.ligaId}-${randomUUID()}.tmp`);
  await writeFile(temporario, JSON.stringify(validado, null, 2), "utf8");
  await rename(temporario, destino);
}

/**
 * Publica release completa: escreve todos os JSON em releases/<id>/,
 * valida, depois troca UM active.json atomicamente.
 * Morte do processo antes da troca do manifesto → release antiga permanece ativa.
 */
export async function publicarReleaseAtomica(
  candidatos: Array<{ ligaId: string; dados: DadosLigaImportados }>,
  destinoRaiz: string,
): Promise<{ releaseId: string }> {
  const releaseId = `r-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const releaseDir = caminhoRelease(releaseId, destinoRaiz);
  await mkdir(releaseDir, { recursive: true });

  try {
    for (const c of candidatos) {
      await salvarDadosLiga(c.dados, releaseDir);
      const lido = await lerDadosLigaEmDiretorio(c.ligaId, releaseDir);
      if (!lido)
        throw new Error(`Release inválida após escrita: ${c.ligaId}`);
    }

    const manifesto: ManifestoAtivo = {
      versao: 1,
      releaseId,
      atualizadoEm: new Date().toISOString(),
      ligas: candidatos.map((c) => c.ligaId),
    };
    const manifestoPath = caminhoManifestoAtivo(destinoRaiz);
    const tmp = join(
      destinoRaiz,
      `active-${randomUUID()}.tmp`,
    );
    await mkdir(destinoRaiz, { recursive: true });
    await writeFile(tmp, JSON.stringify(manifesto, null, 2), "utf8");
    // Troca única atômica do ponteiro — até aqui a release antiga (ou legado) permanece.
    await rename(tmp, manifestoPath);

    // Espelha no layout legado para ferramentas/inspeção (não é a fonte de verdade).
    for (const c of candidatos) {
      await salvarDadosLiga(c.dados, destinoRaiz);
    }

    await limparReleasesAntigas(destinoRaiz, 2);
    return { releaseId };
  } catch (erro) {
    await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
    throw erro;
  }
}

/** Mantém a release ativa + a anterior; remove o resto. */
export async function limparReleasesAntigas(
  destinoRaiz: string,
  manter = 2,
): Promise<void> {
  const ativo = await lerManifestoAtivo(destinoRaiz);
  const root = caminhoReleases(destinoRaiz);
  let nomes: string[] = [];
  try {
    nomes = await readdir(root);
  } catch {
    return;
  }
  const ordenados = nomes
    .filter((n) => n.startsWith("r-"))
    .sort()
    .reverse();
  const preservar = new Set<string>();
  if (ativo) preservar.add(ativo.releaseId);
  for (const n of ordenados) {
    if (preservar.size >= manter) break;
    preservar.add(n);
  }
  for (const n of ordenados) {
    if (preservar.has(n)) continue;
    await rm(join(root, n), { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

export function clubesProntosParaJogo(dados: DadosLigaImportados): Clube[] {
  const falhos = new Set(dados.erros.map((e) => e.clubeId));
  const vistos = new Set<string>();
  return dados.clubes.filter((clube) => {
    if (
      clube.ligaId !== dados.ligaId ||
      falhos.has(clube.id) ||
      vistos.has(clube.id) ||
      !clubeComElencoCompleto(clube)
    )
      return false;
    vistos.add(clube.id);
    return true;
  });
}
