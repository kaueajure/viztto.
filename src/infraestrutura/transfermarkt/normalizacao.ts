import type { Clube, JogadorExterno, Liga } from "@/dominio/entidades/modelos";
import {
  escolherFormacaoPreferida,
  escalarTitulares,
  grupoPosicao,
} from "@/dominio/formacao";
import { criarTreinador } from "@/dominio/mundo-futebol";
import { overallAlvoDeMercado } from "@/dominio/regras/rating-mercado";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import type { z } from "zod";
import {
  esquemaClubPlayers,
  esquemaClubProfile,
} from "./esquemas";

type Perfil = z.infer<typeof esquemaClubProfile>;
type ElencoApi = z.infer<typeof esquemaClubPlayers>;

function idNumerico(id: string): number {
  const n = Number.parseInt(id, 10);
  if (Number.isFinite(n)) return n;
  return gerarSeedNumerica(id);
}

function codigoDeNome(nome: string): string {
  const partes = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "CLU";
  if (partes.length === 1) return partes[0]!.slice(0, 3).toUpperCase();
  return partes
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Prestígio/tamanho do clube — separado da força atual do elenco. */
export function reputacaoInstitucional(
  liga: Pick<Liga, "reputacao" | "divisao">,
  valorElenco: number | null,
): number {
  const logValor =
    valorElenco && valorElenco > 0
      ? Math.log10(valorElenco + 1)
      : 6.5;
  // ~7≈10M, 8≈100M, 9≈1B → prestígio de elenco 45–98
  const prestigioValor = limitar(28 + (logValor - 6) * 18, 40, 98);
  const baseLiga = liga.reputacao - (liga.divisao > 1 ? 6 : 0);
  return Math.round(limitar(baseLiga * 0.55 + prestigioValor * 0.45, 40, 99));
}

/** Força provisória só até o Rating Engine aplicar OVR real. */
function forcaProvisoriaDoElenco(
  liga: Liga,
  elenco: JogadorExterno[],
): {
  forcaGeral: number;
  forcaAtaque: number;
  forcaMeio: number;
  forcaDefesa: number;
} {
  if (!elenco.length) {
    const f = Math.round(liga.forcaMedia);
    return {
      forcaGeral: f,
      forcaAtaque: f,
      forcaMeio: f,
      forcaDefesa: f,
    };
  }
  const ordenados = [...elenco].sort(
    (a, b) => (b.valorMercado ?? 0) - (a.valorMercado ?? 0),
  );
  const ovrs = ordenados.map((j, i) =>
    overallAlvoDeMercado({
      posicao: mapearPosicaoPrincipal(j.posicao),
      idade: j.idade ?? 24,
      valorMercado: j.valorMercado,
      reputacaoLiga: liga.reputacao,
      indiceNoElenco: i,
      tamanhoElenco: ordenados.length,
    }),
  );
  const xi = ovrs.slice(0, 11);
  const banco = ovrs.slice(11, 18);
  const mediaXi =
    xi.reduce((s, n) => s + n, 0) / Math.max(1, xi.length);
  const mediaBanco = banco.length
    ? banco.reduce((s, n) => s + n, 0) / banco.length
    : mediaXi * 0.92;
  const forcaGeral = Math.round(mediaXi * 0.9 + mediaBanco * 0.1);
  return {
    forcaGeral,
    forcaAtaque: forcaGeral,
    forcaMeio: forcaGeral,
    forcaDefesa: forcaGeral,
  };
}

/** Snapshot de importação (hidratado para JogadorMundo na criação da carreira). */
export function normalizarJogadores(elencoApi: ElencoApi): JogadorExterno[] {
  return elencoApi.players.map((jogador) => {
    const idTransfermarkt = String(jogador.id);
    return {
      id: `tm-j-${idTransfermarkt}`,
      idExterno: idNumerico(idTransfermarkt),
      idTransfermarkt,
      nome: jogador.name,
      idade: jogador.age ?? null,
      numero: null,
      posicao: jogador.position,
      grupoPosicao: grupoPosicao(jogador.position),
      nacionalidade: jogador.nationality ?? [],
      altura: jogador.height ?? null,
      peDominante: jogador.foot ?? null,
      valorMercado: jogador.marketValue ?? null,
      dataNascimento: jogador.dateOfBirth ?? null,
      contratoAte: jogador.contract ?? null,
      joinedOn: jogador.joinedOn ?? null,
      signedFrom: jogador.signedFrom ?? null,
      foto: "",
    };
  });
}

export function normalizarClube(
  liga: Liga,
  perfil: Perfil,
  elenco: JogadorExterno[],
  bruto?: Record<string, unknown>,
): Clube {
  const idTransfermarkt = String(perfil.id);
  const aleatorio = new GeradorAleatorio(
    gerarSeedNumerica(`clube-tm-${idTransfermarkt}`),
  );
  const valorElenco = perfil.currentMarketValue ?? null;
  const reputacao = reputacaoInstitucional(liga, valorElenco);
  const forcas = forcaProvisoriaDoElenco(liga, elenco);

  const formacaoPreferida = escolherFormacaoPreferida(
    elenco.map((j) => ({
      id: j.id,
      posicao: j.posicao,
      valorMercado: j.valorMercado,
      idade: j.idade,
    })),
  );
  const { goleiroId, titularIds } = escalarTitulares(
    elenco.map((j) => ({
      id: j.id,
      posicao: j.posicao,
      valorMercado: j.valorMercado,
      idade: j.idade,
    })),
    formacaoPreferida,
  );

  const fundacao = perfil.foundedOn
    ? Number(perfil.foundedOn.slice(0, 4))
    : null;
  const id = `tm-${idTransfermarkt}`;
  const treinador = criarTreinador(id, formacaoPreferida, liga.id);
  const poderFinanceiro = Math.round(
    limitar(reputacao * 0.55 + forcas.forcaGeral * 0.45, 40, 98),
  );

  return {
    id,
    idExterno: idNumerico(idTransfermarkt),
    idTransfermarkt,
    ligaId: liga.id,
    nome: perfil.name,
    nomeCurto: perfil.name,
    nomeOficial: perfil.officialName ?? null,
    codigo: codigoDeNome(perfil.name),
    pais: perfil.league?.countryName ?? liga.pais,
    fundacao: Number.isFinite(fundacao) ? fundacao : null,
    escudo: perfil.image ?? "",
    estadio: perfil.stadiumName || "Estádio não informado",
    capacidadeEstadio: perfil.stadiumSeats ?? null,
    tamanhoElenco: perfil.squad?.size ?? elenco.length,
    idadeMedia: perfil.squad?.averageAge ?? null,
    valorElenco,
    registroTransferencias: perfil.currentTransferRecord ?? null,
    formacaoPreferida,
    goleiroTitularId: goleiroId,
    titularesIds: titularIds,
    bancoIds: [],
    treinador,
    reputacao,
    forcaGeral: forcas.forcaGeral,
    forcaAtaque: forcas.forcaAtaque,
    forcaMeio: forcas.forcaMeio,
    forcaDefesa: forcas.forcaDefesa,
    // qualidadeBase ainda usa seed estável (infraestrutura da base, não força do A).
    qualidadeBase: aleatorio.inteiro(45, 95),
    poderFinanceiro,
    orcamento: Math.round(
      poderFinanceiro * 1_200_000 + (valorElenco ?? 0) * 0.08,
    ),
    forma: 50,
    moral: 60,
    fadiga: 10,
    // Snapshot de importação; hidratado para JogadorMundo em prepararClubesParaMundo.
    elenco: elenco as Clube["elenco"],
    dadosBrutos: bruto ?? null,
  };
}
