import "server-only";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import type { Liga } from "@/dominio/entidades/modelos";
import { validarDisponibilidadeLiga } from "@/infraestrutura/persistencia/base-futebol";
import {
  lerDadosLiga,
  salvarDadosLiga,
  obterDiretorioImportacao,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  enriquecerLigaComSportmonks,
  snapshotEstavaEnriquecido,
  type RelatorioMatchingLiga,
  type StatusEnriquecimento,
} from "@/infraestrutura/sportmonks/enriquecer-liga";
import { importarLiga, type ErroImportacaoClube } from "./importar-liga";

export type StatusPublicacaoLote =
  | "sucesso"
  | "sucesso_fallback_esperado"
  | "atualizacao_degradada"
  | "falha_critica";

export interface ResumoAtualizacaoLiga {
  ligaId: string;
  nome: string;
  publicado: boolean;
  prontoEmStaging: boolean;
  total: number;
  clubes: number;
  jogadores: number;
  falhas: ErroImportacaoClube[];
  erro?: string;
  statusEnriquecimento?: StatusEnriquecimento;
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
  /** Se true, falha sem SPORTMONKS_API_TOKEN. Default: false. */
  exigirSportmonks?: boolean;
  enriquecer?: typeof enriquecerLigaComSportmonks;
}

interface CandidatoStaging {
  liga: Liga;
  dados: DadosLigaImportados;
  item: ResumoAtualizacaoLiga;
}

/**
 * Publica o lote de staging → destino de forma controlada.
 * Escreve todos os .tmp primeiro; só então renomeia. Em falha no meio dos renames,
 * tenta rollback dos já publicados a partir do backup em `rollbackDir`.
 */
export async function publicarLoteAtomico(
  candidatos: Array<{ ligaId: string; dados: DadosLigaImportados }>,
  destino: string,
  rollbackDir: string,
): Promise<void> {
  await mkdir(destino, { recursive: true });
  await mkdir(rollbackDir, { recursive: true });
  const preparados: Array<{ ligaId: string; tmp: string; final: string; backup?: string }> =
    [];

  for (const c of candidatos) {
    const anterior = await lerDadosLiga(c.ligaId, destino);
    if (anterior) {
      await salvarDadosLiga(anterior, rollbackDir);
    }
    const final = join(destino, `${c.ligaId}.json`);
    const tmp = join(destino, `${c.ligaId}-${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(c.dados, null, 2), "utf8");
    preparados.push({
      ligaId: c.ligaId,
      tmp,
      final,
      backup: anterior ? join(rollbackDir, `${c.ligaId}.json`) : undefined,
    });
  }

  const publicados: typeof preparados = [];
  try {
    for (const p of preparados) {
      await rename(p.tmp, p.final);
      publicados.push(p);
    }
  } catch (erro) {
    for (const p of publicados.reverse()) {
      if (p.backup) await rename(p.backup, p.final);
      else await rm(p.final, { force: true });
    }
    for (const p of preparados) {
      await rm(p.tmp, { force: true }).catch(() => undefined);
    }
    throw erro;
  }
}

function classificarLote(
  resumo: ResumoAtualizacaoLiga[],
  abortar: boolean,
  publicou: boolean,
): StatusPublicacaoLote {
  if (abortar || !publicou) return "falha_critica";
  if (resumo.some((l) => l.statusEnriquecimento === "degradado"))
    return "atualizacao_degradada";
  if (
    resumo.some(
      (l) =>
        l.statusEnriquecimento === "fallback_esperado" ||
        (l.falhas.length > 0 && l.prontoEmStaging),
    )
  )
    return "sucesso_fallback_esperado";
  return "sucesso";
}

export async function atualizarBaseFutebol(opcoes: OpcoesAtualizacao = {}) {
  const destino = opcoes.diretorio ?? obterDiretorioImportacao();
  await mkdir(join(destino, ".staging"), { recursive: true });
  const staging = await mkdtemp(join(destino, ".staging", "atualizacao-"));
  const rollbackDir = await mkdtemp(join(destino, ".staging", "rollback-"));
  const importar = opcoes.importar ?? importarLiga;
  const enriquecer = opcoes.enriquecer ?? enriquecerLigaComSportmonks;
  const informar = opcoes.informar ?? console.log;
  const ligas = opcoes.ligas ?? LIGAS_SUPORTADAS;
  const inicio = Date.now();
  const resumo: ResumoAtualizacaoLiga[] = [];
  const relatoriosMatching: RelatorioMatchingLiga[] = [];
  const prontos: CandidatoStaging[] = [];
  let abortarTudo = false;
  let motivoAbort = "";

  informar(
    "════════════════════════════════════════\nVIZTTO — ATUALIZAÇÃO DA BASE DE FUTEBOL\nTransfermarkt + Sportmonks (enrichment)\nLote atômico: nada oficial até validar tudo\n════════════════════════════════════════",
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
      prontoEmStaging: false,
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
      const anteriorOficial = await lerDadosLiga(liga.id, destino);
      const enriquecido = await enriquecer(liga, candidato.clubes, {
        informar,
        exigirToken: opcoes.exigirSportmonks,
        temporadaLabel,
        anteriorEnriquecido: snapshotEstavaEnriquecido(anteriorOficial?.clubes),
      });
      relatoriosMatching.push(enriquecido.relatorio);
      item.statusEnriquecimento = enriquecido.status;
      item.sportmonks = {
        matched: enriquecido.relatorio.matched.length,
        unmatched: enriquecido.relatorio.unmatched.length,
        ambiguous: enriquecido.relatorio.ambiguous.length,
        requests: enriquecido.relatorio.requests,
        cobertura: enriquecido.relatorio.cobertura,
      };

      if (enriquecido.abortarPublicacao) {
        abortarTudo = true;
        motivoAbort =
          enriquecido.erro ??
          "Falha crítica Sportmonks — lote não será publicado.";
        item.erro = motivoAbort;
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
      // Persiste apenas no staging — oficial intacto até o lote fechar.
      await salvarDadosLiga(validado, staging);
      item.prontoEmStaging = true;
      item.total = resultado.progresso.total;
      item.clubes = validado.clubes.length;
      item.jogadores = validado.clubes.reduce(
        (total, clube) => total + clube.elenco.length,
        0,
      );
      prontos.push({ liga, dados: validado, item });
      informar(
        `${item.falhas.length ? "⚠" : "✓"} ${liga.nome}: staging OK · ${item.clubes}/${item.total} clubes · ${item.statusEnriquecimento ?? "ok"}`,
      );
    } catch (erro) {
      abortarTudo = true;
      item.erro = erro instanceof Error ? erro.message : String(erro);
      motivoAbort = item.erro;
      try {
        item.falhas =
          (await lerDadosLiga(liga.id, staging))?.erros ?? item.falhas;
      } catch (leitura) {
        item.erro += ` Falha ao ler staging: ${leitura instanceof Error ? leitura.message : String(leitura)}`;
      }
      informar(
        `✗ ${liga.nome}: ${item.erro} — lote abortado; oficiais intactos.`,
      );
    }
    for (const falha of item.falhas)
      informar(`  - ${falha.nome}: ${falha.motivo}`);
    resumo.push(item);
  }

  // Lote incompleto: qualquer liga solicitada que não entrou em staging → abort.
  if (!abortarTudo && prontos.length !== ligas.length) {
    abortarTudo = true;
    motivoAbort = "Nem todas as ligas solicitadas ficaram prontas em staging.";
  }

  let publicou = false;
  if (!abortarTudo && prontos.length === ligas.length) {
    try {
      informar(`\nPublicando lote atômico (${prontos.length} ligas)…`);
      await publicarLoteAtomico(
        prontos.map((p) => ({ ligaId: p.liga.id, dados: p.dados })),
        destino,
        rollbackDir,
      );
      publicou = true;
      for (const p of prontos) p.item.publicado = true;
      informar("✓ Lote publicado. Base oficial atualizada.");
    } catch (erro) {
      abortarTudo = true;
      motivoAbort =
        erro instanceof Error ? erro.message : "Falha na publicação atômica.";
      informar(`✗ Publicação abortada/revertida: ${motivoAbort}`);
    }
  } else {
    informar(
      `\n✗ Nenhuma alteração oficial. ${motivoAbort || "Lote incompleto."}`,
    );
  }

  try {
    const dirRel = join(process.cwd(), "relatorios");
    await mkdir(dirRel, { recursive: true });
    await writeFile(
      join(dirRel, "sportmonks-matching.json"),
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          statusLote: classificarLote(resumo, abortarTudo, publicou),
          motivoAbort: motivoAbort || null,
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

  const statusLote = classificarLote(resumo, abortarTudo, publicou);
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
  informar(`Status do lote: ${statusLote.toUpperCase()}`);
  informar(
    `Transfermarkt:\n${resumo.filter((l) => l.publicado).length}/${ligas.length} ligas publicadas\n${resumo.reduce((s, l) => s + l.clubes, 0)} clubes\n${jogadoresTm} jogadores`,
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
  if (publicou && !abortarTudo) {
    await rm(staging, { recursive: true, force: true });
    await rm(rollbackDir, { recursive: true, force: true });
  } else {
    informar(`Diagnóstico: staging=${staging}`);
  }
  return {
    ligas: resumo,
    temFalhas:
      !publicou ||
      statusLote === "atualizacao_degradada" ||
      resumo.some(
        (l) => !l.publicado || l.falhas.length > 0 || l.clubes !== l.total,
      ),
    duracaoSegundos,
    abortarTudo,
    publicou,
    statusLote,
  };
}
