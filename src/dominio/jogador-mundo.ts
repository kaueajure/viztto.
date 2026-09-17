import type {
  Atributos,
  EstatisticasJogador,
  JogadorMundo,
  Liga,
  Posicao,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import { grupoPosicao, type GrupoPosicao } from "@/dominio/formacao";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
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

/** Overall inicial coerente — não é valorMercado / constante. */
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
  const aleatorio = new GeradorAleatorio(gerarSeedNumerica(entrada.seed));
  const valor = Math.max(0, entrada.valorMercado ?? 0);
  const logValor =
    valor > 0 ? Math.log10(valor + 1) : 5.5 + aleatorio.proximo() * 0.8;
  // log10: 5≈100k, 6≈1M, 7≈10M, 8≈100M → escala ~48–92
  let overall = 38 + logValor * 6.2;

  const idade = entrada.idade;
  if (idade <= 18) overall -= 4;
  else if (idade <= 21) overall -= 1.5;
  else if (idade >= 22 && idade <= 28) overall += 2.5;
  else if (idade >= 29 && idade <= 32) overall += 1;
  else if (idade >= 33) overall -= (idade - 32) * 1.2;

  overall += (entrada.reputacaoLiga - 80) * 0.12;
  overall += (entrada.reputacaoClube - 70) * 0.08;

  if (["CA", "PD", "PE", "MEI"].includes(entrada.posicao)) overall += 0.8;
  if (entrada.posicao === "GOL") overall -= 0.5;

  const fracao =
    entrada.tamanhoElenco > 1
      ? entrada.indiceNoElenco / (entrada.tamanhoElenco - 1)
      : 0.5;
  // titulares aparentes (início da lista ordenada por valor) sobem um pouco
  overall += (0.45 - fracao) * 8;

  overall += aleatorio.inteiro(-3, 3);
  return Math.round(limitar(overall, 48, 94));
}

export function gerarPotencialInicial(entrada: {
  overall: number;
  idade: number;
  valorMercado: number | null;
  reputacaoLiga: number;
  seed: string;
}): number {
  const aleatorio = new GeradorAleatorio(gerarSeedNumerica(`pot-${entrada.seed}`));
  const idade = entrada.idade;
  if (idade >= 32) return entrada.overall;
  if (idade >= 29) return Math.min(99, entrada.overall + aleatorio.inteiro(0, 2));

  let margem = 0;
  if (idade <= 18) margem = aleatorio.inteiro(12, 22);
  else if (idade <= 21) margem = aleatorio.inteiro(8, 18);
  else if (idade <= 24) margem = aleatorio.inteiro(4, 12);
  else margem = aleatorio.inteiro(1, 6);

  const valor = entrada.valorMercado ?? 0;
  if (idade <= 22 && valor > 15_000_000) margem += 3;
  if (entrada.reputacaoLiga >= 90 && idade <= 21) margem += 2;

  return Math.round(limitar(entrada.overall + margem, entrada.overall, 97));
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
    if ("overall" in jogador && typeof jogador.overall === "number" && "potencial" in jogador) {
      return {
        ...jogador,
        clubeId: clube.id,
        idade: jogador.idade ?? 24,
      } as JogadorMundo;
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
