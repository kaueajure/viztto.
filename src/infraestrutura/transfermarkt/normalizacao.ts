import type { Clube, JogadorExterno, Liga } from "@/dominio/entidades/modelos";
import {
  escolherFormacaoPreferida,
  escalarTitulares,
  grupoPosicao,
} from "@/dominio/formacao";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
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
  const forca = liga.forcaMedia + aleatorio.inteiro(-10, 10);
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

  return {
    id: `tm-${idTransfermarkt}`,
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
    valorElenco: perfil.currentMarketValue ?? null,
    registroTransferencias: perfil.currentTransferRecord ?? null,
    formacaoPreferida,
    goleiroTitularId: goleiroId,
    titularesIds: titularIds,
    reputacao: forca,
    forcaGeral: forca,
    forcaAtaque: forca + aleatorio.inteiro(-4, 4),
    forcaMeio: forca + aleatorio.inteiro(-4, 4),
    forcaDefesa: forca + aleatorio.inteiro(-4, 4),
    qualidadeBase: aleatorio.inteiro(45, 95),
    poderFinanceiro: forca,
    forma: 50,
    moral: 60,
    fadiga: 10,
    elenco,
    dadosBrutos: bruto ?? null,
  };
}
