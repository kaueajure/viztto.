import "server-only";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import type { Liga } from "@/dominio/entidades/modelos";
import { validarPublicacaoLiga } from "@/infraestrutura/persistencia/base-futebol";
import {
  lerDadosLiga,
  lerDadosLigaEmDiretorio,
  obterDiretorioImportacao,
  publicarReleaseAtomica,
  salvarDadosLiga,
  type DadosLigaImportados,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  criarLoteCanonico,
  executarRatingsBot,
  aplicarResultados,
} from "@/infraestrutura/ratings/lote";
import {
  validarResultadoBot,
  type ResultadoBot,
} from "@/infraestrutura/ratings/contrato";
import { preflightRatings } from "@/infraestrutura/ratings/preflight";
import {
  avaliarSaudeRatings,
  metricasDaLiga,
  taxaEnriquecimento,
  type StatusEnriquecimento,
} from "@/infraestrutura/ratings/saude-ratings";
import { importarLiga, type ErroImportacaoClube } from "./importar-liga";

export type StatusPublicacaoLote =
  | "sucesso"
  | "sucesso_fallback_esperado"
  | "atualizacao_degradada"
  | "falha_critica"
  | "dry_run";
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
}
interface OpcoesAtualizacao {
  diretorio?: string;
  publicacao?: { modo: "isolada"; ligasEsperadas: string[] };
  permitirEnginePuro?: boolean;
  dryRun?: boolean;
  ligas?: Liga[];
  importar?: typeof importarLiga;
  informar?: (linha: string) => void;
  executarBot?: typeof executarRatingsBot;
  preflight?: typeof preflightRatings;
  providers?: string[];
  fixture?: string;
  cacheDir?: string;
  reportDir?: string;
}
/** Compatibilidade do helper de publicação; o mecanismo atômico é o mesmo. */
export async function publicarLoteAtomico(
  candidatos: Array<{ ligaId: string; dados: DadosLigaImportados }>,
  destino: string,
  _rollbackDir?: string,
) {
  await publicarReleaseAtomica(candidatos, destino);
}

export async function atualizarBaseFutebol(opcoes: OpcoesAtualizacao = {}) {
  if (opcoes.publicacao && !opcoes.diretorio)
    throw new Error("Publicação isolada exige diretório explícito.");
  const destino = opcoes.diretorio ?? obterDiretorioImportacao();
  const informar = opcoes.informar ?? console.log;
  const inicio = Date.now();
  const ligas = opcoes.ligas ?? LIGAS_SUPORTADAS;
  const resumo: ResumoAtualizacaoLiga[] = [];
  const candidatos: Array<{
    liga: Liga;
    dados: DadosLigaImportados;
    anterior: DadosLigaImportados | null;
  }> = [];
  // Staging sempre fora dos oficiais, inclusive dry-run.
  const staging = await mkdtemp(join(tmpdir(), "viztto-import-"));
  const reportDir = opcoes.reportDir ?? "relatorios";
  let publicou = false,
    abortarTudo = false;
  let statusLote: StatusPublicacaoLote = "falha_critica";
  const saude = [];
  informar(
    "VIZTTO — TRANSFERMARKT → RATINGS BOT → RATING ENGINE → RELEASE ATÔMICA",
  );
  try {
    if (!ligas.length || new Set(ligas.map((l) => l.id)).size !== ligas.length)
      throw new Error("Universo de ligas vazio ou duplicado.");
    if (!opcoes.providers?.length)
      informar(
        "Nenhum provider externo habilitado. A release não será publicada somente com Rating Engine." +
          (opcoes.permitirEnginePuro
            ? " Autorizado por --allow-engine-only."
            : " Use --allow-engine-only para autorizar explicitamente."),
      );
    // Configuração inválida aborta antes de qualquer request ao Transfermarkt.
    for (const linha of await (opcoes.preflight ?? preflightRatings)(
      opcoes.providers ?? [],
      { cacheDir: opcoes.cacheDir },
    ))
      informar(linha);
    // Importa e valida TODAS as ligas antes do único processo Python.
    for (const liga of ligas) {
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
      resumo.push(item);
      informar(`Transfermarkt: ${liga.nome}`);
      const r = await (opcoes.importar ?? importarLiga)(liga, {
        forcar: true,
        diretorio: staging,
      });
      item.falhas = r.erros;
      const dados = await lerDadosLigaEmDiretorio(liga.id, staging);
      const anterior = await lerDadosLiga(liga.id, destino);
      if (!dados) throw new Error(`Staging ausente: ${liga.id}`);
      const validacao = validarPublicacaoLiga(liga, dados, anterior, {
        clubesEsperados:
          TEMPORADAS_INICIAIS[liga.id]?.clubesEsperados ??
          liga.quantidadeClubes,
      });
      if (!validacao.ok || !validacao.dados)
        throw new Error(validacao.motivo ?? "Liga incompleta.");
      item.total = dados.progresso.total;
      item.clubes = dados.clubes.length;
      item.jogadores = dados.clubes.reduce((n, c) => n + c.elenco.length, 0);
      candidatos.push({ liga, dados: validacao.dados, anterior });
    }
    const universo = candidatos.map((c) => ({
      liga: c.liga,
      clubes: c.dados.clubes,
    }));
    const lote = criarLoteCanonico(universo);
    let resultado: ResultadoBot;
    let falhaBot = false;
    try {
      resultado = await (opcoes.executarBot ?? executarRatingsBot)(lote, {
        diretorio: join(staging, "ratings"),
        cacheDir: opcoes.cacheDir,
        reportPath: join(reportDir, "ratings-import.json"),
        providers: opcoes.providers,
        fixture: opcoes.fixture,
        dryRun: opcoes.dryRun,
      });
    } catch (erro) {
      // Contrato inválido/falha completa nunca autoriza substituir base enriquecida.
      if (
        !opcoes.permitirEnginePuro ||
        candidatos.some((c) => taxaEnriquecimento(c.anterior?.clubes) > 0)
      )
        throw erro;
      falhaBot = true;
      resultado = {
        version: 1,
        batchId: lote.batchId,
        players: lote.players.map((p) => ({
          id: p.id,
          transfermarktId: p.transfermarktId,
          sources: [],
        })),
        providers: {},
        diagnostics: {},
      };
    }
    resultado = validarResultadoBot(resultado, lote);
    if (
      !opcoes.publicacao &&
      Object.values(resultado.providers).some((p) => p.synthetic)
    )
      throw new Error(
        "Provider sintético não pode alimentar publicação oficial.",
      );
    const configurados = Object.values(resultado.providers);
    // Provider ausente não é falha; provider selecionado que falhou inteiro é.
    falhaBot ||=
      configurados.length > 0 &&
      configurados.every((p) => p.status === "failed");
    informar(
      configurados.length
        ? `Providers externos: ${Object.entries(resultado.providers)
            .map(([nome, p]) => `${nome} (${p.status})`)
            .join(", ")}`
        : "Providers externos habilitados: nenhum — todos os jogadores usarão o Rating Engine.",
    );
    const enriquecidas = aplicarResultados(universo, resultado);
    for (const [i, c] of candidatos.entries()) {
      c.dados.clubes = enriquecidas[i].clubes;
      const item = resumo[i];
      const ids = new Set(
        c.dados.clubes.flatMap((c) => c.elenco.map((j) => j.id)),
      );
      const avaliacao = avaliarSaudeRatings(
        metricasDaLiga(
          ids,
          resultado,
          taxaEnriquecimento(c.dados.clubes),
          taxaEnriquecimento(c.anterior?.clubes),
        ),
        opcoes.permitirEnginePuro,
        falhaBot,
      );
      saude.push({ ligaId: c.liga.id, ...avaliacao });
      item.statusEnriquecimento = avaliacao.status;
      if (avaliacao.abortarPublicacao) throw new Error(avaliacao.motivo);
      await salvarDadosLiga(c.dados, staging);
      const validacao = validarPublicacaoLiga(c.liga, c.dados, c.anterior);
      if (!validacao.ok) throw new Error(validacao.motivo);
      item.prontoEmStaging = true;
    }
    if (opcoes.dryRun) statusLote = "dry_run";
    else {
      await publicarReleaseAtomica(
        candidatos.map((c) => ({ ligaId: c.liga.id, dados: c.dados })),
        destino,
        { publicacao: opcoes.publicacao },
      );
      publicou = true;
      for (const item of resumo) item.publicado = true;
      statusLote = resumo.some((r) => r.statusEnriquecimento === "degradado")
        ? "atualizacao_degradada"
        : resumo.some((r) => r.statusEnriquecimento === "fallback_esperado")
          ? "sucesso_fallback_esperado"
          : "sucesso";
    }
  } catch (erro) {
    abortarTudo = true;
    const mensagem =
      erro instanceof Error ? erro.message : "Falha na atualização";
    if (resumo.length) resumo[resumo.length - 1].erro = mensagem;
    informar(`Lote bloqueado: ${mensagem}`);
  }
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    join(reportDir, "saude-ratings.json"),
    JSON.stringify({ statusLote, ligas: saude, resumo }, null, 2),
  );
  if (publicou || opcoes.dryRun)
    await rm(staging, { recursive: true, force: true });
  else informar(`Diagnóstico: ${staging}`);
  informar(`Status: ${statusLote}`);
  return {
    ligas: resumo,
    temFalhas: abortarTudo,
    duracaoSegundos: Math.round((Date.now() - inicio) / 1000),
    abortarTudo,
    publicou,
    statusLote,
  };
}
