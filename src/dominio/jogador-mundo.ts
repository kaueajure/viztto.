import type {
  Atributos,
  EstatisticasJogador,
  JogadorMundo,
  Liga,
  Posicao,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import { grupoPosicao, type GrupoPosicao } from "@/dominio/formacao";
import {
  overallAlvoDeMercado,
  potencialDe,
} from "@/dominio/regras/rating-mercado";
import { limitar } from "@/utilitarios/formatacao";

export interface DadosImportadosJogador {
  id: string;
  idExterno: number;
  idTransfermarkt: string;
  nome: string;
  idade: number | null;
  numero: number | null;
  posicao: string;
  grupoPosicao: GrupoPosicao;
  nacionalidade: string[];
  altura: number | null;
  peDominante: string | null;
  valorMercado: number | null;
  dataNascimento: string | null;
  contratoAte: string | null;
  joinedOn: string | null;
  signedFrom: string | null;
  foto: string;
}

const POSICOES: Posicao[] = [
  "GOL",
  "LD",
  "ZAG",
  "LE",
  "VOL",
  "MC",
  "MEI",
  "PD",
  "PE",
  "CA",
];

export function estatisticasVazias(): EstatisticasJogador {
  return {
    jogos: 0,
    titularidades: 0,
    minutos: 0,
    gols: 0,
    assistencias: 0,
    amarelos: 0,
    vermelhos: 0,
    somaNotas: 0,
  };
}

export function mapearPosicaoPrincipal(posicao: string): Posicao {
  const p = posicao
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (p.includes("goal") || p.includes("goleiro") || p === "gk") return "GOL";
  if (p.includes("right-back") || p.includes("right back") || p === "rb")
    return "LD";
  if (p.includes("left-back") || p.includes("left back") || p === "lb")
    return "LE";
  if (
    p.includes("centre-back") ||
    p.includes("center-back") ||
    p.includes("zagueiro") ||
    p.includes("sweeper")
  )
    return "ZAG";
  if (
    p.includes("defensive mid") ||
    p.includes("volante") ||
    p.includes("holding")
  )
    return "VOL";
  if (
    p.includes("attacking mid") ||
    p.includes("mezzala") ||
    p.includes("trequartista")
  )
    return "MEI";
  if (
    p.includes("left winger") ||
    p.includes("left wing") ||
    (p.includes("left") && p.includes("mid"))
  )
    return "PE";
  if (
    p.includes("right winger") ||
    p.includes("right wing") ||
    (p.includes("right") && p.includes("mid"))
  )
    return "PD";
  if (
    p.includes("centre-forward") ||
    p.includes("center-forward") ||
    p.includes("striker") ||
    p.includes("second striker")
  )
    return "CA";
  if (p.includes("mid")) return "MC";
  if (p.includes("winger") || p.includes("wing")) return "PD";
  if (p.includes("forward") || p.includes("attack")) return "CA";
  if (POSICOES.includes(posicao as Posicao)) return posicao as Posicao;
  const g = grupoPosicao(posicao);
  if (g === "GOL") return "GOL";
  if (g === "ATA") return "CA";
  if (g === "MEI") return "MC";
  return "ZAG";
}

export function mapearPosicoesSecundarias(
  principal: Posicao,
  posicaoBruta: string,
): Posicao[] {
  const p = posicaoBruta.toLowerCase();
  const sec: Posicao[] = [];
  if (principal === "PD" || principal === "PE") sec.push("MEI", "CA");
  if (principal === "CA") sec.push("MEI", "PD", "PE");
  if (principal === "MEI") sec.push("MC", "PD", "PE");
  if (principal === "MC") sec.push("VOL", "MEI");
  if (principal === "VOL") sec.push("MC", "ZAG");
  if (principal === "LD" || principal === "LE") sec.push("ZAG");
  if (principal === "ZAG") {
    if (p.includes("left")) sec.push("LE");
    if (p.includes("right")) sec.push("LD");
  }
  return [...new Set(sec.filter((s) => s !== principal))];
}

/** Overall inicial — mesma curva do Rating Engine (determinístico, âncora MV). */
export function gerarOverallInicial(entrada: {
  valorMercado: number | null;
  idade: number;
  reputacaoClube: number;
  reputacaoLiga: number;
  posicao: Posicao;
  indiceNoElenco: number;
  tamanhoElenco: number;
  seed: string;
}): number {
  return overallAlvoDeMercado({
    posicao: entrada.posicao,
    idade: entrada.idade,
    valorMercado: entrada.valorMercado,
    reputacaoLiga: entrada.reputacaoLiga,
    indiceNoElenco: entrada.indiceNoElenco,
    tamanhoElenco: entrada.tamanhoElenco,
  });
}

export function gerarPotencialInicial(entrada: {
  overall: number;
  idade: number;
  valorMercado: number | null;
  reputacaoLiga: number;
  seed: string;
}): number {
  return potencialDe(entrada.overall, entrada.idade, entrada.valorMercado);
}

function statusInicial(overall: number, forcaClube: number): StatusElenco {
  const delta = overall - forcaClube;
  if (delta >= 8) return "estrela do time";
  if (delta >= 4) return "jogador importante";
  if (delta >= -2) return "titular";
  if (delta >= -8) return "rotacao";
  if (overall + 12 >= forcaClube) return "reserva";
  return "promessa";
}

export function criarJogadorMundo(
  bruto: DadosImportadosJogador & {
    overall?: number;
    potencial?: number;
    atributos?: Atributos;
    ratingMetadata?: JogadorMundo["ratingMetadata"];
  },
  contexto: {
    clubeId: string;
    reputacaoClube: number;
    reputacaoLiga: number;
    forcaClube: number;
    indiceNoElenco: number;
    tamanhoElenco: number;
  },
): JogadorMundo {
  const idade = bruto.idade ?? 24;
  const posicaoPrincipal = mapearPosicaoPrincipal(bruto.posicao);
  // Snapshot enriquecido (ratings externos/Rating Engine) tem precedência — não regenera.
  const overall =
    typeof bruto.overall === "number"
      ? Math.round(limitar(bruto.overall, 40, 99))
      : gerarOverallInicial({
          valorMercado: bruto.valorMercado,
          idade,
          reputacaoClube: contexto.reputacaoClube,
          reputacaoLiga: contexto.reputacaoLiga,
          posicao: posicaoPrincipal,
          indiceNoElenco: contexto.indiceNoElenco,
          tamanhoElenco: contexto.tamanhoElenco,
          seed: `${bruto.id}-${contexto.clubeId}`,
        });
  const potencial =
    typeof bruto.potencial === "number"
      ? Math.max(overall, Math.round(limitar(bruto.potencial, overall, 99)))
      : gerarPotencialInicial({
          overall,
          idade,
          valorMercado: bruto.valorMercado,
          reputacaoLiga: contexto.reputacaoLiga,
          seed: bruto.id,
        });
  const salario = Math.round(
    Math.max(800, (bruto.valorMercado ?? overall * 80_000) * 0.0012),
  );

  return {
    id: bruto.id,
    idExterno: bruto.idExterno,
    idTransfermarkt: bruto.idTransfermarkt,
    nome: bruto.nome,
    dataNascimento: bruto.dataNascimento,
    idade,
    nacionalidade: bruto.nacionalidade,
    posicaoPrincipal,
    posicoesSecundarias: mapearPosicoesSecundarias(
      posicaoPrincipal,
      bruto.posicao,
    ),
    posicao: bruto.posicao,
    grupoPosicao: bruto.grupoPosicao || grupoPosicao(bruto.posicao),
    peDominante: bruto.peDominante,
    altura: bruto.altura,
    numero: bruto.numero,
    clubeId: contexto.clubeId,
    overall,
    potencial,
    ...(bruto.atributos ? { atributos: bruto.atributos } : {}),
    ...(bruto.ratingMetadata ? { ratingMetadata: bruto.ratingMetadata } : {}),
    forma: 55 + (overall % 10),
    moral: 60,
    condicionamento: 88,
    fadiga: 12,
    valorMercado: bruto.valorMercado ?? Math.round(90_000 * Math.exp((overall - 55) * 0.11)),
    salario,
    contratoAte: bruto.contratoAte,
    joinedOn: bruto.joinedOn,
    signedFrom: bruto.signedFrom,
    foto: bruto.foto,
    lesionado: false,
    lesao: null,
    suspensao: 0,
    statusElenco: statusInicial(overall, contexto.forcaClube),
    estatisticasCarreira: estatisticasVazias(),
  };
}

export function hidratarElencoClube(
  elenco: DadosImportadosJogador[] | JogadorMundo[],
  clube: {
    id: string;
    reputacao: number;
    forcaGeral: number;
  },
  liga: Pick<Liga, "reputacao">,
): JogadorMundo[] {
  const ordenados = [...elenco].sort(
    (a, b) => (b.valorMercado ?? 0) - (a.valorMercado ?? 0),
  );
  return ordenados.map((jogador, indice) => {
    const mundo = jogador as JogadorMundo;
    const jaCompleto =
      typeof mundo.overall === "number" &&
      typeof mundo.potencial === "number" &&
      typeof mundo.posicaoPrincipal === "string" &&
      Array.isArray(mundo.posicoesSecundarias) &&
      typeof mundo.forma === "number";
    // JogadorMundo já hidratado: preserva forma/moral/status. Snapshot só com
    // overall/potencial (ratings) ainda passa por criarJogadorMundo.
    if (jaCompleto) {
      return {
        ...mundo,
        clubeId: clube.id,
        idade: mundo.idade ?? 24,
      };
    }
    return criarJogadorMundo(jogador as DadosImportadosJogador, {
      clubeId: clube.id,
      reputacaoClube: clube.reputacao,
      reputacaoLiga: liga.reputacao,
      forcaClube: clube.forcaGeral,
      indiceNoElenco: indice,
      tamanhoElenco: ordenados.length,
    });
  });
}
