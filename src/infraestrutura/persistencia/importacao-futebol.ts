import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Clube } from "@/dominio/entidades/modelos";
import type { ErroImportacaoClube } from "@/infraestrutura/transfermarkt/importar-liga";
import { esquemaDadosLigaImportados } from "@/infraestrutura/transfermarkt/esquemas";

export type StatusImportacaoLiga =
  "em_andamento" | "parcial" | "completo" | "interrompido";

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

let diretorioBase =
  process.env.VIZTTO_IMPORTACAO_DIR ?? join(process.cwd(), "src/dados/futebol");

export function definirDiretorioImportacao(caminho: string): void {
  diretorioBase = caminho;
}

export function obterDiretorioImportacao(): string {
  return diretorioBase;
}

function caminhoArquivo(ligaId: string, diretorio: string): string {
  if (!/^[a-z0-9-]+$/.test(ligaId))
    throw new Error("Identificador de liga inválido.");
  return join(diretorio, `${ligaId}.json`);
}

export function clubeComElencoCompleto(clube: Clube): boolean {
  return clube.elenco.length > 0 && Boolean(clube.idTransfermarkt);
}

export async function lerDadosLiga(
  ligaId: string,
  diretorio = diretorioBase,
): Promise<DadosLigaImportados | null> {
  try {
    const bruto = await readFile(caminhoArquivo(ligaId, diretorio), "utf8");
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
