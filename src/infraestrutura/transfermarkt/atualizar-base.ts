import "server-only";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import type { Liga } from "@/dominio/entidades/modelos";
import { validarDisponibilidadeLiga } from "@/infraestrutura/persistencia/base-futebol";
import {
  lerDadosLiga,
  salvarDadosLiga,
  obterDiretorioImportacao,
} from "@/infraestrutura/persistencia/importacao-futebol";
import { importarLiga, type ErroImportacaoClube } from "./importar-liga";

export interface ResumoAtualizacaoLiga {
  ligaId: string;
  nome: string;
  publicado: boolean;
  total: number;
  clubes: number;
  jogadores: number;
  falhas: ErroImportacaoClube[];
  erro?: string;
}
interface OpcoesAtualizacao {
  diretorio?: string;
  ligas?: Liga[];
  importar?: typeof importarLiga;
  informar?: (linha: string) => void;
}
export async function atualizarBaseFutebol(opcoes: OpcoesAtualizacao = {}) {
  const destino = opcoes.diretorio ?? obterDiretorioImportacao();
  await mkdir(join(destino, ".staging"), { recursive: true });
  const staging = await mkdtemp(join(destino, ".staging", "atualizacao-"));
  const importar = opcoes.importar ?? importarLiga;
  const informar = opcoes.informar ?? console.log;
  const ligas = opcoes.ligas ?? LIGAS_SUPORTADAS;
  const inicio = Date.now();
  const resumo: ResumoAtualizacaoLiga[] = [];
  informar(
    "════════════════════════════════════════\nVIZTTO — ATUALIZAÇÃO DA BASE DE FUTEBOL\n════════════════════════════════════════",
  );
  // A ordem é intencional: nunca há duas ligas importando/publicando em paralelo.
  for (const [indice, liga] of ligas.entries()) {
    informar(
      `\n[${indice + 1}/${ligas.length}] ${liga.nome}\nCompetição: ${liga.idTransfermarkt}`,
    );
    const item: ResumoAtualizacaoLiga = {
      ligaId: liga.id,
      nome: liga.nome,
      publicado: false,
      total: 0,
      clubes: 0,
      jogadores: 0,
      falhas: [],
    };
    try {
      const resultado = await importar(liga, {
        forcar: true,
        diretorio: staging,
        aoProgresso: (p) => {
          item.total = p.total;
          const concluido = p.importados + p.falhas;
          const barras = p.total ? Math.round((concluido / p.total) * 20) : 0;
          informar(
            `[${"█".repeat(barras)}${"░".repeat(20 - barras)}] ${concluido}/${p.total} · ${p.importados} atualizados · ${p.falhas} falhas${p.clubeAtual ? ` · Atualizando: ${p.clubeAtual}` : ""}`,
          );
        },
      });
      item.falhas = resultado.erros;
      const candidato = await lerDadosLiga(liga.id, staging);
      const validado = validarDisponibilidadeLiga(liga, candidato);
      if (!validado)
        throw new Error(
          resultado.motivoInterrupcao ??
            "Snapshot sem pelo menos dois clubes válidos ou com edição/status incompatível.",
        );
      // Publica somente clubes da atualização atual; placeholders e falhos ficam no staging.
      validado.progresso = {
        total: resultado.progresso.total,
        importados: validado.clubes.length,
        falhas: resultado.erros.length,
        clubeAtual: null,
      };
      await salvarDadosLiga(validado, destino);
      item.publicado = true;
      item.total = resultado.progresso.total;
      item.clubes = validado.clubes.length;
      item.jogadores = validado.clubes.reduce(
        (total, clube) => total + clube.elenco.length,
        0,
      );
      informar(
        `${item.falhas.length ? "⚠" : "✓"} ${liga.nome}: ${item.clubes}/${item.total} clubes, ${item.jogadores} jogadores.`,
      );
    } catch (erro) {
      item.erro = erro instanceof Error ? erro.message : String(erro);
      // Erros de escrita/leitura são reportados também, sem interromper as ligas seguintes.
      try {
        item.falhas =
          (await lerDadosLiga(liga.id, staging))?.erros ?? item.falhas;
      } catch (leitura) {
        item.erro += ` Falha ao ler staging: ${leitura instanceof Error ? leitura.message : String(leitura)}`;
      }
      informar(
        `✗ ${liga.nome}: ${item.erro} Snapshot anterior preservado, se existente.`,
      );
    }
    for (const falha of item.falhas)
      informar(`  - ${falha.nome}: ${falha.motivo}`);
    resumo.push(item);
  }
  const temFalhas = resumo.some(
    (l) => !l.publicado || l.falhas.length > 0 || l.clubes !== l.total,
  );
  const duracaoSegundos = Math.round((Date.now() - inicio) / 1000);
  informar(
    "\n════════════════════════════════════════\nRESUMO\n════════════════════════════════════════",
  );
  for (const item of resumo)
    informar(
      `${!item.publicado ? "✗" : item.falhas.length ? "⚠" : "✓"} ${item.nome}: ${item.clubes}/${item.total}${item.erro ? ` · ${item.erro}` : ""}`,
    );
  informar(
    `${resumo.length} ligas · ${resumo.reduce((s, l) => s + l.clubes, 0)} clubes publicados · ${resumo.reduce((s, l) => s + l.jogadores, 0)} jogadores · ${resumo.reduce((s, l) => s + l.falhas.length + (l.erro ? 1 : 0), 0)} falhas · ${duracaoSegundos}s`,
  );
  if (!temFalhas) await rm(staging, { recursive: true, force: true });
  else informar(`Diagnóstico da tentativa: ${staging}`);
  return { ligas: resumo, temFalhas, duracaoSegundos };
}
