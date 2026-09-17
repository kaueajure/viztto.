import type { JogadorExterno, Posicao } from "@/dominio/entidades/modelos";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";

export type ConfiancaMatch =
  | "exact"
  | "high"
  | "medium"
  | "low"
  | "unmatched";

export interface CandidatoSportmonks {
  id: number;
  nome: string;
  commonName?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  nationality?: string | null;
  teamName?: string | null;
  position?: string | null;
}

export interface ResultadoMatch {
  transfermarktId: string;
  sportmonksId: number | null;
  confianca: ConfiancaMatch;
  motivo: string;
  score: number;
}

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(nome: string): string[] {
  return normalizarNome(nome)
    .split(" ")
    .filter((t) => t.length > 1 && !["de", "da", "do", "dos", "das", "van", "von"].includes(t));
}

function similaridadeNome(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return Math.max(jaccard, 0.85);
  return jaccard;
}

function mesmaData(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.slice(0, 10) === b.slice(0, 10);
}

function posicaoCompativel(tm: string, sm?: string | null): boolean {
  if (!sm) return true;
  const pTm = mapearPosicaoPrincipal(tm);
  const pSm = mapearPosicaoPrincipal(sm);
  if (pTm === pSm) return true;
  const grupo: Record<Posicao, string> = {
    GOL: "G",
    LD: "D",
    LE: "D",
    ZAG: "D",
    VOL: "M",
    MC: "M",
    MEI: "M",
    PD: "A",
    PE: "A",
    CA: "A",
  };
  return grupo[pTm] === grupo[pSm];
}

/** Limiar mínimo para aplicar estatísticas automaticamente. */
export const LIMIAR_MATCH_SEGURO: ConfiancaMatch = "high";

export function confiancaAceita(c: ConfiancaMatch): boolean {
  return c === "exact" || c === "high";
}

/**
 * Avalia um candidato Sportmonks contra o jogador Transfermarkt canônico.
 * Matching duvidoso permanece unmatched (não aplica stats).
 */
export function pontuarMatch(
  jogador: Pick<
    JogadorExterno,
    "nome" | "dataNascimento" | "altura" | "posicao" | "nacionalidade"
  >,
  candidato: CandidatoSportmonks,
  clubeAtual?: string | null,
): { score: number; confianca: ConfiancaMatch; motivo: string } {
  const nomeScore = similaridadeNome(
    jogador.nome,
    candidato.nome ||
      `${candidato.firstname ?? ""} ${candidato.lastname ?? ""}` ||
      candidato.commonName ||
      "",
  );
  let score = nomeScore * 55;
  const motivos: string[] = [`nome:${nomeScore.toFixed(2)}`];

  if (mesmaData(jogador.dataNascimento, candidato.dateOfBirth)) {
    score += 30;
    motivos.push("dob");
  } else if (jogador.dataNascimento && candidato.dateOfBirth) {
    score -= 25;
    motivos.push("dob-diff");
  }

  if (
    jogador.altura &&
    candidato.height &&
    Math.abs(jogador.altura - candidato.height) <= 3
  ) {
    score += 5;
    motivos.push("altura");
  }

  if (posicaoCompativel(jogador.posicao, candidato.position)) {
    score += 5;
    motivos.push("pos");
  } else {
    score -= 8;
    motivos.push("pos-diff");
  }

  if (clubeAtual && candidato.teamName) {
    const clubScore = similaridadeNome(clubeAtual, candidato.teamName);
    score += clubScore * 8;
    motivos.push(`clube:${clubScore.toFixed(2)}`);
  }

  if (
    jogador.nacionalidade?.[0] &&
    candidato.nationality &&
    normalizarNome(jogador.nacionalidade[0]) ===
      normalizarNome(candidato.nationality)
  ) {
    score += 4;
    motivos.push("nac");
  }

  let confianca: ConfiancaMatch = "unmatched";
  if (score >= 92 && mesmaData(jogador.dataNascimento, candidato.dateOfBirth) && nomeScore >= 0.7)
    confianca = "exact";
  else if (score >= 80 && nomeScore >= 0.55) confianca = "high";
  else if (score >= 65) confianca = "medium";
  else if (score >= 50) confianca = "low";

  return { score, confianca, motivo: motivos.join(",") };
}

export function escolherMelhorMatch(
  jogador: Pick<
    JogadorExterno,
    "idTransfermarkt" | "nome" | "dataNascimento" | "altura" | "posicao" | "nacionalidade"
  >,
  candidatos: CandidatoSportmonks[],
  clubeAtual?: string | null,
): ResultadoMatch {
  let melhor: { c: CandidatoSportmonks; score: number; confianca: ConfiancaMatch; motivo: string } | null =
    null;
  let segundo = 0;
  for (const c of candidatos) {
    const r = pontuarMatch(jogador, c, clubeAtual);
    if (!melhor || r.score > melhor.score) {
      segundo = melhor?.score ?? 0;
      melhor = { c, ...r };
    } else if (r.score > segundo) segundo = r.score;
  }
  if (!melhor || !confiancaAceita(melhor.confianca)) {
    return {
      transfermarktId: jogador.idTransfermarkt,
      sportmonksId: null,
      confianca: melhor?.confianca ?? "unmatched",
      motivo: melhor ? `abaixo-limiar:${melhor.motivo}` : "sem-candidatos",
      score: melhor?.score ?? 0,
    };
  }
  // Homônimos: se segundo colocado está perto, não aplicar automaticamente
  if (
    segundo > 0 &&
    melhor.score - segundo < 8 &&
    (melhor.confianca !== "exact" || segundo >= melhor.score - 1)
  ) {
    return {
      transfermarktId: jogador.idTransfermarkt,
      sportmonksId: null,
      confianca: "medium",
      motivo: `ambiguo:${melhor.motivo}`,
      score: melhor.score,
    };
  }
  return {
    transfermarktId: jogador.idTransfermarkt,
    sportmonksId: melhor.c.id,
    confianca: melhor.confianca,
    motivo: melhor.motivo,
    score: melhor.score,
  };
}
