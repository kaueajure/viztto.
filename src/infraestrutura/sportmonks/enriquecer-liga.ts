import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Clube, JogadorExterno, Liga } from "@/dominio/entidades/modelos";
import {
  mapeamentoSportmonks,
  type NivelCoberturaSportmonks,
} from "@/dominio/constantes/sportmonks-ligas";
import { ClienteSportmonks, ErroSportmonks, redigirSegredos } from "./cliente";
import {
  escolherMelhorMatch,
  confiancaAceita,
  type CandidatoSportmonks,
  type ResultadoMatch,
} from "./matching";
import {
  calcularRatingViztto,
  normalizarDetailsSportmonks,
  type RatingMetadata,
  type StatsSportmonksNormalizadas,
} from "./rating-engine";

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
}

export interface OpcoesEnriquecimento {
  cliente?: ClienteSportmonks;
  mappingPath?: string;
  exigirToken?: boolean;
  informar?: (linha: string) => void;
  /** Ano/label da temporada Transfermarkt (para cache/season search). */
  temporadaLabel?: string;
}

interface MappingPersistido {
  versao: 1;
  atualizadoEm: string;
  pares: Record<string, number>; // transfermarktId → sportmonksId
}

async function carregarMapping(path: string): Promise<MappingPersistido> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as MappingPersistido;
  } catch {
    return { versao: 1, atualizadoEm: new Date().toISOString(), pares: {} };
  }
}

async function salvarMapping(path: string, mapping: MappingPersistido) {
  await mkdir(join(path, ".."), { recursive: true });
  mapping.atualizadoEm = new Date().toISOString();
  await writeFile(path, JSON.stringify(mapping, null, 2));
}

function relancarSeAuth(erro: unknown): void {
  if (erro instanceof ErroSportmonks && erro.codigo === "auth") throw erro;
}

async function resolverSeasonId(
  cliente: ClienteSportmonks,
  ligaSmId: number,
  nomeBusca: string | null,
  preferido: number | null,
  temporadaLabel: string,
): Promise<number | null> {
  if (preferido) return preferido;
  try {
    const liga = await cliente.getJson<{
      data?: { currentseason?: { id?: number }; currentSeason?: { id?: number } };
    }>(`/leagues/${ligaSmId}`, { include: "currentSeason" }, {
      cacheKey: `league-${ligaSmId}-current-${temporadaLabel}`,
      cacheTtlMs: 7 * 86_400_000,
    });
    const cur =
      liga.data?.currentSeason?.id ?? liga.data?.currentseason?.id ?? null;
    if (cur) return cur;
  } catch (erro) {
    relancarSeAuth(erro);
    /* tenta busca */
  }
  if (!nomeBusca) return null;
  try {
    const seasons = await cliente.getJson<{
      data?: Array<{ id: number; name?: string; league_id?: number }>;
    }>(`/seasons/search/${encodeURIComponent(nomeBusca)}`, {
      filters: `seasonLeagues:${ligaSmId}`,
    }, { cacheKey: `season-search-${ligaSmId}-${temporadaLabel}` });
    const lista = seasons.data ?? [];
    const porAno = lista.find((s) =>
      String(s.name ?? "").includes(temporadaLabel.slice(0, 4)),
    );
    return porAno?.id ?? lista[0]?.id ?? null;
  } catch (erro) {
    relancarSeAuth(erro);
    return null;
  }
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
    nationality: null,
    teamName: teamName ?? null,
    position: p.position
      ? String((p.position as { name?: string }).name ?? p.position)
      : null,
  };
}

/**
 * Enriquece elenco de uma liga já importada do Transfermarkt.
 * Sem token / cobertura D: aplica Rating Engine em modo fallback.
 */
export async function enriquecerLigaComSportmonks(
  liga: Liga,
  clubes: Clube[],
  opcoes: OpcoesEnriquecimento = {},
): Promise<{
  clubes: Clube[];
  relatorio: RelatorioMatchingLiga;
  abortarPublicacao?: boolean;
  erro?: string;
}> {
  const informar = opcoes.informar ?? (() => undefined);
  const mapa = mapeamentoSportmonks(liga);
  const mappingPath =
    opcoes.mappingPath ??
    join(process.cwd(), ".cache", "sportmonks", "mapping-transfermarkt.json");
  const mapping = await carregarMapping(mappingPath);
  const relatorio: RelatorioMatchingLiga = {
    ligaId: liga.id,
    cobertura: mapa.cobertura,
    total: 0,
    matched: [],
    unmatched: [],
    ambiguous: [],
    requests: 0,
  };

  const enriquecerFallback = (j: JogadorExterno, clube: Clube, indice: number, total: number) => {
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

  if (mapa.cobertura === "D" || mapa.idSportmonks == null) {
    informar(`  Sportmonks: cobertura ${mapa.cobertura} — fallback Transfermarkt.`);
    const clubesOut = clubes.map((c) => ({
      ...c,
      elenco: c.elenco.map((j, i) =>
        enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
      ) as unknown as Clube["elenco"],
    }));
    relatorio.total = clubesOut.reduce((s, c) => s + c.elenco.length, 0);
    relatorio.unmatched = clubesOut.flatMap((c) =>
      c.elenco.map((j) => ({
        transfermarktId: (j as unknown as JogadorExterno).idTransfermarkt,
        sportmonksId: null,
        confianca: "unmatched" as const,
        motivo: "cobertura-D",
        score: 0,
      })),
    );
    return { clubes: clubesOut, relatorio };
  }

  let cliente = opcoes.cliente;
  try {
    cliente ??= new ClienteSportmonks();
  } catch (erro) {
    if (opcoes.exigirToken) {
      return {
        clubes,
        relatorio,
        abortarPublicacao: true,
        erro: redigirSegredos(
          erro instanceof Error ? erro.message : String(erro),
        ),
      };
    }
    informar(
      `  Sportmonks: token ausente — ratings estimados (Transfermarkt).`,
    );
    return {
      clubes: clubes.map((c) => ({
        ...c,
        elenco: c.elenco.map((j, i) =>
          enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
        ) as unknown as Clube["elenco"],
      })),
      relatorio,
    };
  }

  try {
    const seasonId = await resolverSeasonId(
      cliente,
      mapa.idSportmonks,
      mapa.nomeTemporadaBusca,
      mapa.seasonIdPreferido,
      opcoes.temporadaLabel ?? "2026",
    );
    if (!seasonId) {
      informar(`  Sportmonks: temporada não resolvida — fallback.`);
      return {
        clubes: clubes.map((c) => ({
          ...c,
          elenco: c.elenco.map((j, i) =>
            enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
          ) as unknown as Clube["elenco"],
        })),
        relatorio,
      };
    }

    const statsPorSmId = new Map<number, StatsSportmonksNormalizadas>();
    const candidatosPorClube = new Map<string, CandidatoSportmonks[]>();

    // Busca times da temporada (agregado) e squads com player+details
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
      teams = [];
    }

    for (const team of teams.slice(0, 40)) {
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
          { include: "player;details.type" },
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
      } catch {
        /* time sem squad — segue */
      }
    }

    const todosCandidatos = [...candidatosPorClube.values()].flat();
    const clubesOut: Clube[] = [];

    for (const clube of clubes) {
      const elencoOrd = [...clube.elenco].sort(
        (a, b) => ((b as unknown as JogadorExterno).valorMercado ?? 0) - ((a as unknown as JogadorExterno).valorMercado ?? 0),
      );
      const novoElenco: JogadorEnriquecido[] = [];
      for (let i = 0; i < elencoOrd.length; i++) {
        const j = elencoOrd[i]! as unknown as JogadorExterno;
        relatorio.total++;
        let smId = mapping.pares[j.idTransfermarkt] ?? null;
        let match: ResultadoMatch;
        if (smId) {
          match = {
            transfermarktId: j.idTransfermarkt,
            sportmonksId: smId,
            confianca: "exact",
            motivo: "mapping-persistido",
            score: 100,
          };
        } else {
          // Prioriza candidatos; se vazio, tenta search por nome (custo extra)
          let cands = todosCandidatos;
          if (!cands.length) {
            try {
              const busca = await cliente.getJson<{ data?: Record<string, unknown>[] }>(
                `/players/search/${encodeURIComponent(j.nome)}`,
                {},
                { cacheKey: `search-${j.idTransfermarkt}` },
              );
              cands = (busca.data ?? []).map((p) => candidatoDePlayer(p));
            } catch {
              cands = [];
            }
          }
          match = escolherMelhorMatch(j, cands, clube.nome);
          if (match.sportmonksId && confiancaAceita(match.confianca)) {
            mapping.pares[j.idTransfermarkt] = match.sportmonksId;
            smId = match.sportmonksId;
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

        // Se matched mas sem stats no squad, tenta endpoint do jogador
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
                    type?: { code?: string; name?: string; developer_name?: string };
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
            const block = pl.data?.statistics?.find((s) => s.season_id === seasonId)
              ?? pl.data?.statistics?.[0];
            statsFinais = normalizarDetailsSportmonks(block?.details);
          } catch {
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

        novoElenco.push({
          ...j,
          overall: rating.overall,
          potencial: rating.potencial,
          atributos: rating.atributos,
          ratingMetadata: rating.metadata,
        });
      }
      clubesOut.push({ ...clube, elenco: novoElenco as unknown as unknown as Clube["elenco"] });
    }

    relatorio.requests = cliente.requests;
    await salvarMapping(mappingPath, mapping);
    informar(
      `  Sportmonks: ${relatorio.matched.length} matches · ${relatorio.unmatched.length} unmatched · ${relatorio.ambiguous.length} ambíguos · ${relatorio.requests} reqs`,
    );
    return { clubes: clubesOut, relatorio };
  } catch (erro) {
    const msg = redigirSegredos(
      erro instanceof Error ? erro.message : String(erro),
      process.env.SPORTMONKS_API_TOKEN,
    );
    if (erro instanceof ErroSportmonks && erro.codigo === "auth") {
      return {
        clubes,
        relatorio,
        abortarPublicacao: true,
        erro: msg,
      };
    }
    informar(`  Sportmonks falhou (${msg}) — fallback Transfermarkt.`);
    return {
      clubes: clubes.map((c) => ({
        ...c,
        elenco: c.elenco.map((j, i) =>
          enriquecerFallback(j as unknown as JogadorExterno, c, i, c.elenco.length),
        ) as unknown as Clube["elenco"],
      })),
      relatorio,
      erro: msg,
    };
  }
}
