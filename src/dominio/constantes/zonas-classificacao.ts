/**
 * Zonas de classificação — UI lê daqui; acesso/rebaixamento derivam de
 * `regras-movimento.ts` (mesma fonte da simulação). Faixas continentais
 * permanecem configuráveis até existir domínio continental completo.
 */
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  regrasMovimentoPorLigaId,
  type RegrasMovimentoPar,
} from "@/dominio/constantes/regras-movimento";

export type TipoZonaClassificacao =
  | "campeao"
  | "lider"
  | "champions"
  | "europa"
  | "conference"
  | "libertadores"
  | "sulamericana"
  | "acesso"
  | "playoff_acesso"
  | "playoff_rebaixamento"
  | "rebaixamento"
  | "normal";

export type FaixaZonaClassificacao = {
  tipo: Exclude<TipoZonaClassificacao, "campeao" | "lider" | "normal">;
  de: number;
  ate: number;
  label: string;
  requerLigaId?: string;
};

export type RegrasZonaLiga = {
  ligaId: string;
  faixas: FaixaZonaClassificacao[];
};

/** Faixas continentais / cosméticas (não movem clubes). */
const FAIXAS_CONTINENTAIS: Record<string, FaixaZonaClassificacao[]> = {
  brasileirao: [
    { tipo: "libertadores", de: 1, ate: 6, label: "Libertadores" },
    { tipo: "sulamericana", de: 7, ate: 12, label: "Sul-Americana" },
  ],
  "premier-league": [
    { tipo: "champions", de: 1, ate: 4, label: "Champions League" },
    { tipo: "europa", de: 5, ate: 5, label: "Europa League" },
    { tipo: "conference", de: 6, ate: 6, label: "Conference League" },
  ],
  "la-liga": [
    { tipo: "champions", de: 1, ate: 4, label: "Champions League" },
    { tipo: "europa", de: 5, ate: 5, label: "Europa League" },
    { tipo: "conference", de: 6, ate: 6, label: "Conference League" },
  ],
  "serie-a": [
    { tipo: "champions", de: 1, ate: 4, label: "Champions League" },
    { tipo: "europa", de: 5, ate: 5, label: "Europa League" },
    { tipo: "conference", de: 6, ate: 6, label: "Conference League" },
  ],
  bundesliga: [
    { tipo: "champions", de: 1, ate: 4, label: "Champions League" },
    { tipo: "europa", de: 5, ate: 5, label: "Europa League" },
    { tipo: "conference", de: 6, ate: 6, label: "Conference League" },
  ],
  "ligue-1": [
    { tipo: "champions", de: 1, ate: 3, label: "Champions League" },
    { tipo: "europa", de: 4, ate: 4, label: "Europa League" },
    { tipo: "conference", de: 5, ate: 5, label: "Conference League" },
  ],
};

function faixasMovimento(
  ligaId: string,
  par: RegrasMovimentoPar,
): FaixaZonaClassificacao[] {
  const meta = LIGAS_SUPORTADAS.find((l) => l.id === ligaId);
  const n = meta?.quantidadeClubes ?? 20;
  const faixas: FaixaZonaClassificacao[] = [];

  if (ligaId === par.divisaoSuperiorId) {
    if (par.rebaixamentoDireto > 0) {
      faixas.push({
        tipo: "rebaixamento",
        de: n - par.rebaixamentoDireto + 1,
        ate: n,
        label: "Rebaixamento",
        requerLigaId: par.divisaoInferiorId,
      });
    }
    for (const pos of par.playoffRebaixamentoPosicoes) {
      faixas.push({
        tipo: "playoff_rebaixamento",
        de: pos,
        ate: pos,
        label: "Playoff de rebaixamento",
        requerLigaId: par.divisaoInferiorId,
      });
    }
  }

  if (ligaId === par.divisaoInferiorId) {
    if (par.promocaoDireta > 0) {
      faixas.push({
        tipo: "acesso",
        de: 1,
        ate: par.promocaoDireta,
        label:
          par.promocaoDireta >= 2 && (par.playoffAcesso || par.playoffInterdivisional)
            ? "Acesso direto"
            : "Acesso",
        requerLigaId: par.divisaoSuperiorId,
      });
    }
    if (par.playoffAcesso) {
      const ps = par.playoffAcesso.posicoes;
      faixas.push({
        tipo: "playoff_acesso",
        de: Math.min(...ps),
        ate: Math.max(...ps),
        label: "Playoff de acesso",
        requerLigaId: par.divisaoSuperiorId,
      });
    } else if (
      par.playoffInterdivisional &&
      typeof par.playoffInterdivisional.adversarioInferior === "number"
    ) {
      const p = par.playoffInterdivisional.adversarioInferior;
      faixas.push({
        tipo: "playoff_acesso",
        de: p,
        ate: p,
        label: "Playoff de acesso",
        requerLigaId: par.divisaoSuperiorId,
      });
    }
  }

  return faixas;
}

/** Monta regras de zona para uma liga (movimento + continental). */
export function regrasZonaDaLiga(ligaId: string): RegrasZonaLiga {
  const par = regrasMovimentoPorLigaId(ligaId);
  const movimento = par ? faixasMovimento(ligaId, par) : [];
  const continental = FAIXAS_CONTINENTAIS[ligaId] ?? [];
  return { ligaId, faixas: [...continental, ...movimento] };
}

/** Compat: mapa estático gerado do catálogo. */
export const REGRAS_ZONA_POR_LIGA: Record<string, RegrasZonaLiga> =
  Object.fromEntries(
    LIGAS_SUPORTADAS.map((l) => [l.id, regrasZonaDaLiga(l.id)]),
  );

export type ZonaClassificacao = {
  tipo: TipoZonaClassificacao;
  label: string;
};

export type OpcoesZonaClassificacao = {
  temporadaEncerrada: boolean;
  ligasNoUniverso: ReadonlySet<string> | readonly string[];
};

function conjuntoLigas(
  ligas: OpcoesZonaClassificacao["ligasNoUniverso"],
): ReadonlySet<string> {
  return ligas instanceof Set ? ligas : new Set(ligas);
}

function faixaAplicavel(
  faixa: FaixaZonaClassificacao,
  ligas: ReadonlySet<string>,
): boolean {
  if (!faixa.requerLigaId) return true;
  return ligas.has(faixa.requerLigaId);
}

/** Resolve a zona de uma posição (domínio — sem lógica no React). */
export function obterZonaClassificacao(
  ligaId: string,
  posicao: number,
  opcoes: OpcoesZonaClassificacao,
): ZonaClassificacao {
  if (posicao === 1) {
    return opcoes.temporadaEncerrada
      ? { tipo: "campeao", label: "Campeão" }
      : { tipo: "lider", label: "Líder" };
  }

  const regras = regrasZonaDaLiga(ligaId);
  const ligas = conjuntoLigas(opcoes.ligasNoUniverso);

  const movimentoTipos = new Set([
    "acesso",
    "playoff_acesso",
    "playoff_rebaixamento",
    "rebaixamento",
  ]);
  for (const faixa of regras.faixas.filter((f) => movimentoTipos.has(f.tipo))) {
    if (!faixaAplicavel(faixa, ligas)) continue;
    if (posicao >= faixa.de && posicao <= faixa.ate) {
      return { tipo: faixa.tipo, label: faixa.label };
    }
  }
  for (const faixa of regras.faixas.filter((f) => !movimentoTipos.has(f.tipo))) {
    if (!faixaAplicavel(faixa, ligas)) continue;
    if (posicao >= faixa.de && posicao <= faixa.ate) {
      return { tipo: faixa.tipo, label: faixa.label };
    }
  }
  return { tipo: "normal", label: "" };
}

const ORDEM_LEGENDA: TipoZonaClassificacao[] = [
  "campeao",
  "lider",
  "libertadores",
  "sulamericana",
  "champions",
  "europa",
  "conference",
  "acesso",
  "playoff_acesso",
  "playoff_rebaixamento",
  "rebaixamento",
];

export function legendasZonaClassificacao(
  ligaId: string,
  opcoes: OpcoesZonaClassificacao,
): ZonaClassificacao[] {
  const regras = regrasZonaDaLiga(ligaId);
  const itens: ZonaClassificacao[] = [
    opcoes.temporadaEncerrada
      ? { tipo: "campeao", label: "Campeão" }
      : { tipo: "lider", label: "Líder" },
  ];
  const ligas = conjuntoLigas(opcoes.ligasNoUniverso);
  const vistos = new Set<TipoZonaClassificacao>([itens[0]!.tipo]);
  for (const faixa of regras.faixas) {
    if (!faixaAplicavel(faixa, ligas)) continue;
    if (vistos.has(faixa.tipo)) continue;
    vistos.add(faixa.tipo);
    itens.push({ tipo: faixa.tipo, label: faixa.label });
  }
  return itens.sort(
    (a, b) => ORDEM_LEGENDA.indexOf(a.tipo) - ORDEM_LEGENDA.indexOf(b.tipo),
  );
}

export function classeZonaClassificacao(tipo: TipoZonaClassificacao): string {
  if (tipo === "normal") return "";
  return `zona-${tipo.replace(/_/g, "-")}`;
}
