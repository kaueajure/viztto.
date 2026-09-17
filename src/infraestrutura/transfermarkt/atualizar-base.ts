import "server-only";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import type { Liga } from "@/dominio/entidades/modelos";
import { validarDisponibilidadeLiga } from "@/infraestrutura/persistencia/base-futebol";
import {
  lerDadosLiga,
  salvarDadosLiga,
  obterDiretorioImportacao,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  enriquecerLigaComSportmonks,
  type RelatorioMatchingLiga,
} from "@/infraestrutura/sportmonks/enriquecer-liga";
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
  sportmonks?: {
    matched: number;
    unmatched: number;
    ambiguous: number;
    requests: number;
    cobertura: string;
  };
}
interface OpcoesAtualizacao {
  diretorio?: string;
  ligas?: Liga[];
  importar?: typeof importarLiga;
  informar?: (linha: string) => void;
  /** Se true, falha sem SPORTMONKS_API_TOKEN. Default: false (fallback TM). */
  exigirSportmonks?: boolean;
  enriquecer?: typeof enriquecerLigaComSportmonks;
}
export async function atualizarBaseFutebol(opcoes: OpcoesAtualizacao = {}) {
  const destino = opcoes.diretorio ?? obterDiretorioImportacao();
  await mkdir(join(destino, ".staging"), { recursive: true });
  const staging = await mkdtemp(join(destino, ".staging", "atualizacao-"));
  const importar = opcoes.importar ?? importarLiga;
  const enriquecer = opcoes.enriquecer ?? enriquecerLigaComSportmonks;
  const informar = opcoes.informar ?? console.log;
  const ligas = opcoes.ligas ?? LIGAS_SUPORTADAS;
  const inicio = Date.now();
  const resumo: ResumoAtualizacaoLiga[] = [];
  const relatoriosMatching: RelatorioMatchingLiga[] = [];
  let abortarTudo = false;
  informar(
    "════════════════════════════════════════\nVIZTTO — ATUALIZAÇÃO DA BASE DE FUTEBOL\nTransfermarkt + Sportmonks (enrichment)\n════════════════════════════════════════",
  );
  for (const [indice, liga] of ligas.entries()) {
    if (abortarTudo) break;
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
      if (!candidato)
        throw new Error("Snapshot de staging não encontrado após importação.");

      const temporadaLabel =
        TEMPORADAS_INICIAIS[liga.id]?.temporadaTransfermarkt ??
        String(candidato.temporada);
      const enriquecido = await enriquecer(liga, candidato.clubes, {
        informar,
        exigirToken: opcoes.exigirSportmonks,
        temporadaLabel,
      });
      relatoriosMatching.push(enriquecido.relatorio);
      item.sportmonks = {
        matched: enriquecido.relatorio.matched.length,
        unmatched: enriquecido.relatorio.unmatched.length,
        ambiguous: enriquecido.relatorio.ambiguous.length,
        requests: enriquecido.relatorio.requests,
        cobertura: enriquecido.relatorio.cobertura,
      };
      if (enriquecido.abortarPublicacao) {
        abortarTudo = true;
        item.erro =
          enriquecido.erro ??
          "Falha crítica Sportmonks — publicação abortada para preservar snapshots.";
        informar(`✗ ${liga.nome}: ${item.erro}`);
        resumo.push(item);
        break;
      }
      candidato.clubes = enriquecido.clubes;

      const validado = validarDisponibilidadeLiga(liga, candidato);
      if (!validado)
        throw new Error(
          resultado.motivoInterrupcao ??
            "Snapshot sem pelo menos dois clubes válidos ou com edição/status incompatível.",
        );
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

  try {
    const dirRel = join(process.cwd(), "relatorios");
    await mkdir(dirRel, { recursive: true });
    await writeFile(
      join(dirRel, "sportmonks-matching.json"),
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          ligas: relatoriosMatching.map((r) => ({
            ligaId: r.ligaId,
            cobertura: r.cobertura,
            total: r.total,
            matched: r.matched.length,
            unmatched: r.unmatched.length,
            ambiguous: r.ambiguous.length,
            requests: r.requests,
            amostrasUnmatched: r.unmatched.slice(0, 20),
            amostrasAmbiguous: r.ambiguous.slice(0, 20),
          })),
        },
        null,
        2,
      ),
    );
    informar(`Relatório de matching: relatorios/sportmonks-matching.json`);
  } catch {
    /* best-effort */
  }

  const temFalhas =
    abortarTudo ||
    resumo.some(
      (l) => !l.publicado || l.falhas.length > 0 || l.clubes !== l.total,
    );
  const duracaoSegundos = Math.round((Date.now() - inicio) / 1000);
  const jogadoresTm = resumo.reduce((s, l) => s + l.jogadores, 0);
  const matches = resumo.reduce((s, l) => s + (l.sportmonks?.matched ?? 0), 0);
  const unmatched = resumo.reduce(
    (s, l) => s + (l.sportmonks?.unmatched ?? 0),
    0,
  );
  informar(
    "\n════════════════════════════════════════\nATUALIZAÇÃO DE DADOS CONCLUÍDA\n════════════════════════════════════════",
  );
  informar(
    `Transfermarkt:\n${resumo.filter((l) => l.publicado).length}/${resumo.length} ligas publicadas\n${resumo.reduce((s, l) => s + l.clubes, 0)} clubes\n${jogadoresTm} jogadores`,
  );
  informar(
    `Sportmonks:\n${matches} matches confiáveis\n${unmatched} unmatched/fallback\n${resumo.reduce((s, l) => s + (l.sportmonks?.requests ?? 0), 0)} requests`,
  );
  for (const item of resumo)
    informar(
      `${!item.publicado ? "✗" : item.falhas.length ? "⚠" : "✓"} ${item.nome}: ${item.clubes}/${item.total}${item.erro ? ` · ${item.erro}` : ""}`,
    );
  informar(
    `Tempo: ${Math.floor(duracaoSegundos / 60)}m ${duracaoSegundos % 60}s`,
  );
  if (!temFalhas) await rm(staging, { recursive: true, force: true });
  else informar(`Diagnóstico da tentativa: ${staging}`);
  return { ligas: resumo, temFalhas, duracaoSegundos, abortarTudo };
}
