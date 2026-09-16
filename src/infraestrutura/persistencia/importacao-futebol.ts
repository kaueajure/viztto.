import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  process.env.VIZTTO_IMPORTACAO_DIR ??
  join(process.cwd(), "src/dados/futebol");

export function definirDiretorioImportacao(caminho: string): void {
  diretorioBase = caminho;
}

export function obterDiretorioImportacao(): string {
  return diretorioBase;
}

function caminhoArquivo(ligaId: string): string {
  return join(diretorioBase, `${ligaId}.json`);
}

export function clubeComElencoCompleto(clube: Clube): boolean {
  return clube.elenco.length > 0 && Boolean(clube.idTransfermarkt);
}

export async function lerDadosLiga(
  ligaId: string,
): Promise<DadosLigaImportados | null> {
  try {
    const bruto = await readFile(caminhoArquivo(ligaId), "utf8");
    return esquemaDadosLigaImportados.parse(JSON.parse(bruto)) as DadosLigaImportados;
  } catch {
    return null;
  }
}

export async function salvarDadosLiga(
  dados: DadosLigaImportados,
): Promise<void> {
  const validado = esquemaDadosLigaImportados.parse(dados);
  await mkdir(diretorioBase, { recursive: true });
  const destino = caminhoArquivo(validado.ligaId);
  const temporario = join(
    diretorioBase,
    `${validado.ligaId}-${randomUUID()}.tmp`,
  );
  await writeFile(temporario, JSON.stringify(validado, null, 2), "utf8");
  await rename(temporario, destino);
}

export function clubesProntosParaJogo(dados: DadosLigaImportados): Clube[] {
  return dados.clubes.filter(clubeComElencoCompleto);
}
