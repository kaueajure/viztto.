import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Clube, JogadorExterno, Liga } from "@/dominio/entidades/modelos";
import {
  mapeamentoSportmonks,
  type EstrategiaTemporadaSportmonks,
  type MapeamentoSportmonksLiga,
  type NivelCoberturaSportmonks,
} from "@/dominio/constantes/sportmonks-ligas";
import { ClienteSportmonks, ErroSportmonks, redigirSegredos } from "./cliente";
import {
  escolherMelhorMatch,
  confiancaAceita,
  normalizarNome,
  pontuarMatch,
  type CandidatoSportmonks,
  type ResultadoMatch,
} from "./matching";
import {
  calcularRatingViztto,
  normalizarDetailsSportmonks,
  type RatingMetadata,
  type StatsSportmonksNormalizadas,
} from "./rating-engine";
import {
  avaliarSaudeEnriquecimento,
  metricasVazias,
  taxaEnriquecimento,
  type CoverageHealth,
  type MetricasEnriquecimentoLiga,
  type NivelSaudeEnriquecimento,
  type StatusEnriquecimento,
} from "./saude-enriquecimento";

export type { StatusEnriquecimento } from "./saude-enriquecimento";
export { taxaEnriquecimento } from "./saude-enriquecimento";

export interface JogadorEnriquecido extends JogadorExterno {
  overall: number;
  potencial: number;
  atributos?: Record<string, number>;
  ratingMetadata?: RatingMetadata;
}

export interface RelatorioMatchingLiga {
  ligaId: string;
  cobertura: NivelCoberturaSportmonks;
  total: number;
  matched: ResultadoMatch[];
  unmatched: ResultadoMatch[];
  ambiguous: ResultadoMatch[];
  requests: number;
  /** Saúde agregada (saudavel / degradado / critico / fallback_esperado). */
  saude?: NivelSaudeEnriquecimento;
  metricas?: MetricasEnriquecimentoLiga;
  coverageHealth?: CoverageHealth;
  seasonId?: number | null;
  seasonStrategy?: EstrategiaTemporadaSportmonks;
  seasonMetodo?: string;
  mappingsStale?: number;
  motivoSaude?: string;
}

export interface OpcoesEnriquecimento {
  cliente?: ClienteSportmonks;
  mappingPath?: string;
  exigirToken?: boolean;
  informar?: (linha: string) => void;
  /** Ano/label da temporada Transfermarkt (para cache/season search). */
  temporadaLabel?: string;
  /** Snapshot oficial anterior já tinha enrichment Sportmonks/hybrid. */
  anteriorEnriquecido?: boolean;
  /** Taxa de enrichment do snapshot oficial anterior (0–1). */
  taxaEnriquecimentoAnterior?: number;
}

export interface ResultadoEnriquecimento {
  clubes: Clube[];
  relatorio: RelatorioMatchingLiga;
  status: StatusEnriquecimento;
  abortarPublicacao?: boolean;
  erro?: string;
}

/** Heurística: snapshot anterior tinha enrichment real (não só TM estimado). */
export function snapshotEstavaEnriquecido(
  clubes: Clube[] | null | undefined,
): boolean {
  return taxaEnriquecimento(clubes) >= 0.15;
}

type StatusMapping = "ativo" | "stale" | "manual";

interface EntradaMapping {
  sportmonksId: number;
  confiancaOriginal: string;
  nome?: string;
  dataNascimento?: string | null;
  atualizadoEm: string;
  manual?: boolean;
  lastValidatedAt?: string;
  status?: StatusMapping;
}

interface MappingPersistido {
  versao: 1 | 2;
  atualizadoEm: string;
  /** Formato v2. */
  entradas: Record<string, EntradaMapping>;
  /** Legacy v1 — migrado na leitura. */
  pares?: Record<string, number>;
}

function migrarMapping(bruto: MappingPersistido): MappingPersistido {
  if (bruto.versao >= 2 && bruto.entradas) return bruto;
  const entradas: Record<string, EntradaMapping> = { ...(bruto.entradas ?? {}) };
  for (const [tm, sm] of Object.entries(bruto.pares ?? {})) {
    if (!entradas[tm]) {
      entradas[tm] = {
        sportmonksId: sm,
        confiancaOriginal: "legacy",
        atualizadoEm: bruto.atualizadoEm ?? new Date().toISOString(),
        status: "ativo",
      };
    }
  }
  return {
    versao: 2,
    atualizadoEm: bruto.atualizadoEm ?? new Date().toISOString(),
    entradas,
  };
}

async function carregarMapping(path: string): Promise<MappingPersistido> {
  try {
    const bruto = JSON.parse(await readFile(path, "utf8")) as MappingPersistido;
    return migrarMapping(bruto);
  } catch {
    return { versao: 2, atualizadoEm: new Date().toISOString(), entradas: {} };
  }
}

async function salvarMapping(path: string, mapping: MappingPersistido) {
  await mkdir(join(path, ".."), { recursive: true });
  mapping.atualizadoEm = new Date().toISOString();
  mapping.versao = 2;
  await writeFile(
    path,
    JSON.stringify(
      {
        versao: 2,
        atualizadoEm: mapping.atualizadoEm,
        entradas: mapping.entradas,
      },
      null,
      2,
    ),
  );
}

function extrairNacionalidade(p: Record<string, unknown>): string | null {
  const n = p.nationality ?? p.country;
  if (typeof n === "string") return n;
  if (n && typeof n === "object") {
    const o = n as { name?: string; nationality?: string };
    return o.name ?? o.nationality ?? null;
  }
  if (Array.isArray(p.nationalities) && p.nationalities[0]) {
    const first = p.nationalities[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object")
      return (first as { name?: string }).name ?? null;
  }
  return null;
}

function candidatoDePlayer(p: Record<string, unknown>, teamName?: string): CandidatoSportmonks {
  return {
    id: Number(p.id),
    nome: String(p.name ?? p.display_name ?? ""),
    commonName: (p.common_name as string) ?? null,
    firstname: (p.firstname as string) ?? null,
    lastname: (p.lastname as string) ?? null,
    dateOfBirth: (p.date_of_birth as string) ?? null,
    height: typeof p.height === "number" ? p.height : null,
    nationality: extrairNacionalidade(p),
    teamName: teamName ?? null,
    position: p.position
      ? String((p.position as { name?: string }).name ?? p.position)
      : null,
  };
}

/**
 * Valida mapping persistido.
 * Automático: só reutiliza como exact/high se o sportmonksId estiver nos candidatos ATUAIS.
 * Manual: pode diferir (aceita sem candidato atual).
 */
export function validarMappingPersistido(
  j: JogadorExterno,
  entrada: EntradaMapping,
  candidato?: CandidatoSportmonks,
): { ok: boolean; stale: boolean; motivo: string } {
  if (entrada.manual || entrada.status === "manual") {
    if (candidato) {
      const r = pontuarMatch(j, candidato);
      if (r.score < 50) {
        return {
          ok: false,
          stale: true,
          motivo: "manual-incompativel-com-candidato-atual",
        };
      }
    }
    return { ok: true, stale: false, motivo: "manual" };
  }

  // Automático: ID ausente da resposta atual → stale (não aceitar só por nome/dob).
  if (!candidato) {
    return { ok: false, stale: true, motivo: "mapping-stale:id-ausente" };
  }

  if (entrada.confiancaOriginal === "legacy") {
    const r = pontuarMatch(j, candidato);
    if (!confiancaAceita(r.confianca)) {
      return { ok: false, stale: true, motivo: "legacy-abaixo-limiar" };
    }
    return { ok: true, stale: false, motivo: "legacy-validado" };
  }

  if (entrada.nome) {
    const nJ = normalizarNome(j.nome);
    const nM = normalizarNome(entrada.nome);
    if (nJ !== nM && !nJ.includes(nM) && !nM.includes(nJ)) {
      return { ok: false, stale: true, motivo: "nome-divergente" };
    }
  }
  if (entrada.dataNascimento && j.dataNascimento) {
    if (entrada.dataNascimento.slice(0, 10) !== j.dataNascimento.slice(0, 10)) {
      return { ok: false, stale: true, motivo: "dob-divergente" };
    }
  }

  const r = pontuarMatch(j, candidato);
  if (!confiancaAceita(r.confianca) && r.score < 75) {
    return { ok: false, stale: true, motivo: "candidato-atual-abaixo-limiar" };
  }
  return { ok: true, stale: false, motivo: "mapping-validado" };
}

function relancarSeAuth(erro: unknown): void {
  if (erro instanceof ErroSportmonks && erro.codigo === "auth") throw erro;
}

/** Anos no label TM vs nome da season SM (aceita cruzamento 2025/2026). */
export function temporadaAnoCompativel(
  nomeSeason: string,
  temporadaLabel: string,
): boolean {
  const anosLabel: string[] = temporadaLabel.match(/\d{4}/g) ?? [];
  if (!anosLabel.length) return true;
  const anosSeason: string[] = nomeSeason.match(/\d{4}/g) ?? [];
  if (!anosSeason.length) return false;
  return anosLabel.some((ano) => {
    const n = Number(ano);
    return (
      anosSeason.includes(ano) ||
      anosSeason.includes(String(n - 1)) ||
      anosSeason.includes(String(n + 1))
    );
  });
}

export interface ResultadoResolverSeason {
  seasonId: number | null;
  metodo: string;
  erro?: string;
}

async function validarSeasonPertenceLiga(
  cliente: ClienteSportmonks,
  seasonId: number,
  ligaSmId: number,
  temporadaLabel: string,
): Promise<{ ok: boolean; nome?: string; erro?: string }> {
  try {
    const resp = await cliente.getJson<{
      data?: {
        id?: number;
        name?: string;
        league_id?: number;
        league?: { id?: number };
      };
    }>(`/seasons/${seasonId}`, { include: "league" }, {
      cacheKey: `season-validate-${seasonId}`,
      cacheTtlMs: 7 * 86_400_000,
    });
    const s = resp.data;
    const leagueId = s?.league_id ?? s?.league?.id;
    if (leagueId != null && leagueId !== ligaSmId) {
      return {
        ok: false,
        erro: `season ${seasonId} pertence à liga ${leagueId}, esperado ${ligaSmId}`,
      };
    }
    const nome = String(s?.name ?? "");
    if (nome && !temporadaAnoCompativel(nome, temporadaLabel)) {
      return {
        ok: false,
        nome,
        erro: `season ${seasonId} (${nome}) incompatível com temporada ${temporadaLabel}`,
      };
    }
    return { ok: true, nome };
  } catch (erro) {
    relancarSeAuth(erro);
    // Sem detalhe da season: não afirma validade cegamente.
    return {
      ok: false,
      erro: `falha ao validar season ${seasonId}`,
    };
  }
}

/**
 * Resolve seasonId sem fallback cego para currentSeason.
 * Prioridade: preferido → busca → current (só se strategy === "current").
 */
export async function resolverSeasonId(
  cliente: ClienteSportmonks,
  mapa: Pick<
    MapeamentoSportmonksLiga,
    "idSportmonks" | "nomeTemporadaBusca" | "seasonIdPreferido" | "seasonStrategy"
  >,
  temporadaLabel: string,
): Promise<ResultadoResolverSeason> {
  const ligaSmId = mapa.idSportmonks;
  if (ligaSmId == null) {
    return { seasonId: null, metodo: "sem-liga", erro: "liga Sportmonks ausente" };
  }

  const tentarValidar = async (
    id: number,
    metodo: string,
  ): Promise<ResultadoResolverSeason> => {
    const v = await validarSeasonPertenceLiga(
      cliente,
      id,
      ligaSmId,
      temporadaLabel,
    );
    if (!v.ok) {
      return { seasonId: null, metodo, erro: v.erro };
    }
    return { seasonId: id, metodo };
  };

  if (mapa.seasonIdPreferido != null) {
    const r = await tentarValidar(mapa.seasonIdPreferido, "preferido");
    if (r.seasonId != null) return r;
    if (mapa.seasonStrategy === "preferido") {
      return {
        seasonId: null,
        metodo: "preferido",
        erro: r.erro ?? "seasonIdPreferido inválido",
      };
    }
    // Preferido inválido com strategy busca/current: tenta próximos passos.
  } else if (mapa.seasonStrategy === "preferido") {
    return {
      seasonId: null,
      metodo: "preferido",
      erro: "seasonStrategy=preferido exige seasonIdPreferido",
    };
  }

  const nomeBusca = mapa.nomeTemporadaBusca;
  if (nomeBusca) {
    try {
      const seasons = await cliente.getJson<{
        data?: Array<{ id: number; name?: string; league_id?: number }>;
      }>(
        `/seasons/search/${encodeURIComponent(nomeBusca)}`,
        { filters: `seasonLeagues:${ligaSmId}` },
        { cacheKey: `season-search-${ligaSmId}-${temporadaLabel}` },
      );
      const lista = (seasons.data ?? []).filter(
        (s) => s.league_id == null || s.league_id === ligaSmId,
      );
      const porAno = lista.find((s) =>
        temporadaAnoCompativel(String(s.name ?? ""), temporadaLabel),
      );
      if (porAno) {
        const r = await tentarValidar(porAno.id, "busca");
        if (r.seasonId != null) return r;
      }
      // Sem match de ano: NÃO pegar lista[0] silenciosamente (ano errado).
      return {
        seasonId: null,
        metodo: "busca",
        erro: `nenhuma season compatível com ${temporadaLabel} via busca "${nomeBusca}"`,
      };
    } catch (erro) {
      relancarSeAuth(erro);
      if (mapa.seasonStrategy !== "current") {
        return {
          seasonId: null,
          metodo: "busca",
          erro: "falha na busca de temporada",
        };
      }
    }
  } else if (mapa.seasonStrategy === "busca") {
    return {
      seasonId: null,
      metodo: "busca",
      erro: "nomeTemporadaBusca ausente para strategy=busca",
    };
  }

  if (mapa.seasonStrategy === "current") {
    try {
      const liga = await cliente.getJson<{
        data?: {
          currentseason?: { id?: number };
          currentSeason?: { id?: number };
        };
      }>(`/leagues/${ligaSmId}`, { include: "currentSeason" }, {
        cacheKey: `league-${ligaSmId}-current-${temporadaLabel}`,
        cacheTtlMs: 7 * 86_400_000,
      });
      const cur =
        liga.data?.currentSeason?.id ?? liga.data?.currentseason?.id ?? null;
      if (cur) {
        const r = await tentarValidar(cur, "current");
        if (r.seasonId != null) return r;
        return {
          seasonId: null,
          metodo: "current",
          erro: r.erro ?? "currentSeason inválida para a temporada",
        };
      }
    } catch (erro) {
      relancarSeAuth(erro);
    }
    return {
      seasonId: null,
      metodo: "current",
      erro: "currentSeason não disponível",
    };
  }

  return {
    seasonId: null,
    metodo: mapa.seasonStrategy,
    erro: "temporada Sportmonks não resolvida",
  };
}

function abortarPorDegradacao(
  opcoes: OpcoesEnriquecimento,
  mapa: ReturnType<typeof mapeamentoSportmonks>,
  motivo: string,
  relatorioBase: RelatorioMatchingLiga,
): ResultadoEnriquecimento | null {
  const cobreSm = mapa.cobertura === "A" || mapa.cobertura === "B";
  if (cobreSm && opcoes.anteriorEnriquecido) {
    return {
      clubes: [],
      relatorio: {
        ...relatorioBase,
        saude: "critico",
        motivoSaude: motivo,
      },
      status: "falha_critica",
      abortarPublicacao: true,
      erro: `ATUALIZAÇÃO DEGRADADA evitada: ${motivo}. Snapshot enriquecido anterior preservado.`,
    };
  }
  return null;
}

function contarJogadores(clubes: Clube[]): number {
  return clubes.reduce((s, c) => s + c.elenco.length, 0);
}

/**
 * Enriquece elenco de uma liga já importada do Transfermarkt.
 * Sem token / cobertura D: aplica Rating Engine em modo fallback.
 */
export async function enriquecerLigaComSportmonks(
  liga: Liga,
  clubes: Clube[],
  opcoes: OpcoesEnriquecimento = {},
): Promise<ResultadoEnriquecimento> {
  const informar = opcoes.informar ?? (() => undefined);
  const mapa = mapeamentoSportmonks(liga);
  const mappingPath =
    opcoes.mappingPath ??
    join(process.cwd(), ".cache", "sportmonks", "mapping-transfermarkt.json");
  const mapping = await carregarMapping(mappingPath);
  const jogadoresTm = contarJogadores(clubes);
  const metricas = metricasVazias({
    timesEsperados: clubes.length,
    jogadoresTm,
  });
  const relatorio: RelatorioMatchingLiga = {
    ligaId: liga.id,
    cobertura: mapa.cobertura,
    total: 0,
    matched: [],
    unmatched: [],
    ambiguous: [],
    requests: 0,
    metricas,
    seasonStrategy: mapa.seasonStrategy,
    mappingsStale: 0,
  };

  const enriquecerFallback = (
    j: JogadorExterno,
    clube: Clube,
    indice: number,
    total: number,
  ) => {
    const r = calcularRatingViztto({
      seed: `${j.id}-${clube.id}`,
      nome: j.nome,
      posicaoBruta: j.posicao,
      idade: j.idade ?? 24,
      valorMercado: j.valorMercado,
      altura: j.altura,
      reputacaoLiga: liga.reputacao,
      reputacaoClube: clube.reputacao,
      forcaMediaLiga: liga.forcaMedia,
      indiceNoElenco: indice,
      tamanhoElenco: total,
      cobertura: mapa.cobertura,
      stats: null,
      seasonLabel: opcoes.temporadaLabel ?? "",
    });
    return {
      ...j,
      overall: r.overall,
      potencial: r.potencial,
      atributos: r.atributos,
      ratingMetadata: r.metadata,
    } satisfies JogadorEnriquecido;
  };

  const finalizarComSaude = (
    clubesOut: Clube[],
    statusPreferido?: StatusEnriquecimento,
    erro?: string,
  ): ResultadoEnriquecimento => {
    const taxaAtual = taxaEnriquecimento(clubesOut);
    const avaliacao = avaliarSaudeEnriquecimento({
      cobertura: mapa.cobertura,
      metricas,
      taxaAtual,
      taxaAnterior: opcoes.taxaEnriquecimentoAnterior,
      anteriorEnriquecido: opcoes.anteriorEnriquecido,
    });
    relatorio.metricas = { ...metricas };
    relatorio.saude = avaliacao.saude;
    relatorio.coverageHealth = avaliacao.coverageHealth;
    relatorio.motivoSaude = avaliacao.motivo ?? erro;

    let status = statusPreferido ?? avaliacao.status;
    let abortar = avaliacao.abortarPublicacao;
    let msg = erro ?? avaliacao.motivo;

    // Cobertura D nunca aborta por saúde.
    if (mapa.cobertura === "D") {
      status = "fallback_esperado";
      abortar = false;
      relatorio.saude = "fallback_esperado";
    }

    if (abortar) {
      return {
        clubes: [],
        relatorio,
        status: "falha_critica",
        abortarPublicacao: true,
        erro: `ATUALIZAÇÃO DEGRADADA evitada: ${msg}. Snapshot enriquecido anterior preservado.`,
      };
    }

    return {
      clubes: clubesOut,
      relatorio,
      status,
      erro: msg && status !== "ok" ? msg : undefined,
    };
  };

  const aplicarFallbackTodos = (
    status: StatusEnriquecimento,
    erro?: string,
  ): ResultadoEnriquecimento => {
    metricas.fallback = jogadoresTm;
    metricas.matches = 0;
    metricas.comStats = 0;
    const clubesOut = clubes.map((c) => ({
      ...c,
      elenco: c.elenco.map((j, i) =>
        enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
      ) as unknown as Clube["elenco"],
    }));
    relatorio.total = jogadoresTm;
    return finalizarComSaude(clubesOut, status, erro);
  };

  if (mapa.cobertura === "D" || mapa.idSportmonks == null) {
    informar(`  Sportmonks: cobertura ${mapa.cobertura} — fallback Transfermarkt.`);
    const clubesOut = clubes.map((c) => ({
      ...c,
      elenco: c.elenco.map((j, i) =>
        enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
      ) as unknown as Clube["elenco"],
    }));
    relatorio.total = jogadoresTm;
    metricas.fallback = jogadoresTm;
    relatorio.unmatched = clubesOut.flatMap((c) =>
      c.elenco.map((j) => ({
        transfermarktId: (j as unknown as JogadorExterno).idTransfermarkt,
        sportmonksId: null,
        confianca: "unmatched" as const,
        motivo: "cobertura-D",
        score: 0,
      })),
    );
    return finalizarComSaude(clubesOut, "fallback_esperado", "cobertura-D");
  }

  let cliente = opcoes.cliente;
  try {
    cliente ??= new ClienteSportmonks();
  } catch (erro) {
    const msg = redigirSegredos(
      erro instanceof Error ? erro.message : String(erro),
    );
    if (opcoes.exigirToken) {
      relatorio.saude = "critico";
      return {
        clubes,
        relatorio,
        status: "falha_critica",
        abortarPublicacao: true,
        erro: msg,
      };
    }
    const bloqueio = abortarPorDegradacao(
      opcoes,
      mapa,
      "token Sportmonks ausente",
      relatorio,
    );
    if (bloqueio) {
      informar(`✗ ${bloqueio.erro}`);
      return bloqueio;
    }
    informar(`  Sportmonks: token ausente — ratings estimados (Transfermarkt).`);
    return aplicarFallbackTodos(
      opcoes.anteriorEnriquecido ? "degradado" : "fallback_esperado",
      msg,
    );
  }

  try {
    const season = await resolverSeasonId(
      cliente,
      mapa,
      opcoes.temporadaLabel ?? "2026",
    );
    relatorio.seasonId = season.seasonId;
    relatorio.seasonMetodo = season.metodo;
    if (!season.seasonId) {
      const motivo =
        season.erro ?? "temporada Sportmonks não resolvida";
      const bloqueio = abortarPorDegradacao(opcoes, mapa, motivo, relatorio);
      if (bloqueio) {
        informar(`✗ ${bloqueio.erro}`);
        return bloqueio;
      }
      informar(`  Sportmonks: temporada não resolvida — fallback.`);
      return aplicarFallbackTodos(
        opcoes.anteriorEnriquecido ? "degradado" : "fallback_esperado",
        motivo,
      );
    }
    const seasonId = season.seasonId;

    const statsPorSmId = new Map<number, StatsSportmonksNormalizadas>();
    const candidatosPorClube = new Map<string, CandidatoSportmonks[]>();

    type TeamRow = { id: number; name?: string };
    let teams: TeamRow[] = [];
    try {
      teams = await cliente.getTodasPaginas<TeamRow>(
        `/teams/seasons/${seasonId}`,
        {},
        { cacheKeyPrefix: `teams-${seasonId}` },
      );
    } catch (erro) {
      relancarSeAuth(erro);
      metricas.requestsFalhos++;
      teams = [];
    }
    metricas.timesEncontrados = teams.length;

    const teamsLimite = teams.slice(0, Math.max(40, clubes.length + 5));
    for (const team of teamsLimite) {
      metricas.squadsSolicitados++;
      try {
        const squad = await cliente.getJson<{
          data?: Array<{
            player_id?: number;
            player?: Record<string, unknown>;
            details?: Array<{
              type_id?: number;
              value?: unknown;
              type?: { code?: string; name?: string; developer_name?: string };
            }>;
            minutes?: number;
            appearances?: number;
          }>;
        }>(
          `/squads/seasons/${seasonId}/teams/${team.id}`,
          { include: "player;player.nationality;details.type" },
          { cacheKey: `squad-${seasonId}-${team.id}` },
        );
        const rows = squad.data ?? [];
        const cands: CandidatoSportmonks[] = [];
        for (const row of rows) {
          const player = row.player;
          if (!player?.id) continue;
          const cand = candidatoDePlayer(player, team.name);
          cands.push(cand);
          const stats = normalizarDetailsSportmonks(
            row.details,
            row.appearances ?? 0,
            row.minutes ?? 0,
          );
          statsPorSmId.set(cand.id, stats);
        }
        candidatosPorClube.set(String(team.id), cands);
        metricas.squadsObtidos++;
      } catch {
        metricas.squadsFalhos++;
        metricas.requestsFalhos++;
      }
    }

    if (!teams.length && (mapa.cobertura === "A" || mapa.cobertura === "B")) {
      const bloqueio = abortarPorDegradacao(
        opcoes,
        mapa,
        "Sportmonks sem times/stats na temporada",
        relatorio,
      );
      if (bloqueio) {
        bloqueio.relatorio = {
          ...bloqueio.relatorio,
          requests: cliente.requests,
          metricas: { ...metricas },
        };
        informar(`✗ ${bloqueio.erro}`);
        return bloqueio;
      }
    }

    const todosCandidatos = [...candidatosPorClube.values()].flat();
    metricas.candidatosSm = todosCandidatos.length;
    const porSmId = new Map(todosCandidatos.map((c) => [c.id, c]));
    const clubesOut: Clube[] = [];
    let mappingsStale = 0;

    for (const clube of clubes) {
      const elencoOrd = [...clube.elenco].sort(
        (a, b) =>
          ((b as unknown as JogadorExterno).valorMercado ?? 0) -
          ((a as unknown as JogadorExterno).valorMercado ?? 0),
      );
      const novoElenco: JogadorEnriquecido[] = [];
      for (let i = 0; i < elencoOrd.length; i++) {
        const j = elencoOrd[i]! as unknown as JogadorExterno;
        relatorio.total++;
        const entradaMap = mapping.entradas[j.idTransfermarkt];
        let smId: number | null = null;
        let match: ResultadoMatch;
        const agora = new Date().toISOString();

        if (entradaMap) {
          const cand = porSmId.get(entradaMap.sportmonksId);
          const validacao = validarMappingPersistido(j, entradaMap, cand);
          if (validacao.ok) {
            smId = entradaMap.sportmonksId;
            const confiancaReuse =
              entradaMap.confiancaOriginal === "exact" ? "exact" : "high";
            match = {
              transfermarktId: j.idTransfermarkt,
              sportmonksId: smId,
              confianca: confiancaReuse,
              motivo: `${validacao.motivo}:${entradaMap.confiancaOriginal}`,
              score: 90,
            };
            mapping.entradas[j.idTransfermarkt] = {
              ...entradaMap,
              lastValidatedAt: agora,
              status: entradaMap.manual ? "manual" : "ativo",
            };
          } else {
            if (validacao.stale) {
              mappingsStale++;
              mapping.entradas[j.idTransfermarkt] = {
                ...entradaMap,
                status: "stale",
                lastValidatedAt: agora,
              };
            }
            match = escolherMelhorMatch(j, todosCandidatos, clube.nome);
            if (match.sportmonksId && confiancaAceita(match.confianca)) {
              smId = match.sportmonksId;
              mapping.entradas[j.idTransfermarkt] = {
                sportmonksId: smId,
                confiancaOriginal: match.confianca,
                nome: j.nome,
                dataNascimento: j.dataNascimento,
                atualizadoEm: agora,
                lastValidatedAt: agora,
                status: "ativo",
              };
            } else if (!validacao.stale) {
              delete mapping.entradas[j.idTransfermarkt];
            }
          }
        } else {
          let cands = todosCandidatos;
          if (!cands.length) {
            try {
              const busca = await cliente.getJson<{
                data?: Record<string, unknown>[];
              }>(
                `/players/search/${encodeURIComponent(j.nome)}`,
                {},
                { cacheKey: `search-${j.idTransfermarkt}` },
              );
              cands = (busca.data ?? []).map((p) => candidatoDePlayer(p));
            } catch {
              metricas.requestsFalhos++;
              cands = [];
            }
          }
          match = escolherMelhorMatch(j, cands, clube.nome);
          if (match.sportmonksId && confiancaAceita(match.confianca)) {
            smId = match.sportmonksId;
            mapping.entradas[j.idTransfermarkt] = {
              sportmonksId: smId,
              confiancaOriginal: match.confianca,
              nome: j.nome,
              dataNascimento: j.dataNascimento,
              atualizadoEm: agora,
              lastValidatedAt: agora,
              status: "ativo",
            };
          }
        }

        if (match.confianca === "medium" || match.confianca === "low")
          relatorio.ambiguous.push(match);
        else if (match.sportmonksId && confiancaAceita(match.confianca))
          relatorio.matched.push(match);
        else relatorio.unmatched.push(match);

        const stats =
          smId && confiancaAceita(match.confianca)
            ? statsPorSmId.get(smId) ?? null
            : null;

        let statsFinais = stats;
        if (smId && confiancaAceita(match.confianca) && !statsFinais) {
          try {
            const pl = await cliente.getJson<{
              data?: {
                statistics?: Array<{
                  season_id?: number;
                  details?: Array<{
                    type_id?: number;
                    value?: unknown;
                    type?: {
                      code?: string;
                      name?: string;
                      developer_name?: string;
                    };
                  }>;
                }>;
              };
            }>(
              `/players/${smId}`,
              {
                include: "statistics.details.type",
                filters: `playerStatisticSeasons:${seasonId}`,
              },
              { cacheKey: `player-stats-${smId}-${seasonId}` },
            );
            const block =
              pl.data?.statistics?.find((s) => s.season_id === seasonId) ??
              pl.data?.statistics?.[0];
            statsFinais = normalizarDetailsSportmonks(block?.details);
          } catch {
            metricas.requestsFalhos++;
            statsFinais = null;
          }
        }

        const rating = calcularRatingViztto({
          seed: `${j.id}-${clube.id}`,
          nome: j.nome,
          posicaoBruta: j.posicao,
          idade: j.idade ?? 24,
          valorMercado: j.valorMercado,
          altura: j.altura,
          reputacaoLiga: liga.reputacao,
          reputacaoClube: clube.reputacao,
          forcaMediaLiga: liga.forcaMedia,
          indiceNoElenco: i,
          tamanhoElenco: elencoOrd.length,
          cobertura: mapa.cobertura,
          stats: statsFinais,
          sportmonksPlayerId: smId ?? undefined,
          seasonLabel: String(seasonId),
          matchConfidence: match.confianca,
        });

        if (
          rating.metadata.source === "sportmonks" ||
          rating.metadata.source === "hybrid"
        ) {
          metricas.comStats++;
        } else {
          metricas.fallback++;
        }

        novoElenco.push({
          ...j,
          overall: rating.overall,
          potencial: rating.potencial,
          atributos: rating.atributos,
          ratingMetadata: rating.metadata,
        });
      }
      clubesOut.push({
        ...clube,
        elenco: novoElenco as unknown as unknown as Clube["elenco"],
      });
    }

    metricas.matches = relatorio.matched.length;
    relatorio.mappingsStale = mappingsStale;
    relatorio.requests = cliente.requests;
    await salvarMapping(mappingPath, mapping);

    const resultado = finalizarComSaude(clubesOut);
    informar(
      `  Sportmonks: ${relatorio.matched.length} matches · ${relatorio.unmatched.length} unmatched · ${relatorio.ambiguous.length} ambíguos · ${relatorio.requests} reqs · saúde=${relatorio.saude}`,
    );
    if (resultado.abortarPublicacao) {
      informar(`✗ ${resultado.erro}`);
    }
    return resultado;
  } catch (erro) {
    const msg = redigirSegredos(
      erro instanceof Error ? erro.message : String(erro),
      process.env.SPORTMONKS_API_TOKEN,
    );
    if (erro instanceof ErroSportmonks && erro.codigo === "auth") {
      relatorio.saude = "critico";
      return {
        clubes,
        relatorio,
        status: "falha_critica",
        abortarPublicacao: true,
        erro: msg,
      };
    }
    metricas.requestsFalhos++;
    const bloqueio = abortarPorDegradacao(opcoes, mapa, msg, relatorio);
    if (bloqueio) {
      informar(`✗ ${bloqueio.erro}`);
      return bloqueio;
    }
    informar(`  Sportmonks falhou (${msg}) — fallback Transfermarkt.`);
    return aplicarFallbackTodos(
      opcoes.anteriorEnriquecido ? "degradado" : "fallback_esperado",
      msg,
    );
  }
}
