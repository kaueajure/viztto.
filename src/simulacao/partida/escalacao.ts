import { notaBase } from "../elenco/hierarquia";
import type { Clube, Escalacao, Jogador } from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import {
  escalarElencoCompleto,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
} from "@/simulacao/elenco/escalacao-elenco";

/** Lê a decisão já aplicada em prepararClubesRodada (mesma fonte da força). */
export function escalacaoUsuarioDoClube(clube: Clube): Escalacao | null {
  if (clube.titularesIds.includes("usuario") || clube.goleiroTitularId === "usuario")
    return "titular";
  if (clube.bancoIds.includes("usuario")) return "banco";
  return null;
}

export function determinarEscalacao(
  jogador: Jogador,
  clube: Clube,
  aleatorio: GeradorAleatorio,
  incentivo = 0,
  opcoes?: { escalacaoPreparada?: Escalacao; elencoProfissional?: boolean },
): Escalacao {
  if (jogador.lesao) return "lesionado";
  if (jogador.suspensao > 0) return "suspenso";
  if (opcoes?.escalacaoPreparada) return opcoes.escalacaoPreparada;

  const noProfissional =
    jogador.categoria === "profissional" || !!opcoes?.elencoProfissional;

  if (!noProfissional && jogador.categoria === "base") {
    const avaliacao = notaBase(jogador, clube) + incentivo + aleatorio.inteiro(-8, 8);
    return avaliacao > 6 ? "titular" : avaliacao > -10 ? "banco" : "nao relacionado";
  }

  const doClube = escalacaoUsuarioDoClube(clube);
  if (doClube) return doClube;

  const candidatos = [
    ...clube.elenco.map(jogadorMundoComoCandidato),
    jogadorUsuarioComoCandidato(jogador, incentivo),
  ];
  // Variação leve só quando não há escalação preparada (ex.: testes isolados).
  if (!opcoes?.elencoProfissional) {
    for (const c of candidatos) {
      if (c.ehUsuario) c.confiancaTreinador += aleatorio.inteiro(-3, 3);
    }
  }
  return escalarElencoCompleto(
    candidatos,
    clube.formacaoPreferida,
    clube.treinador,
  ).escalacaoUsuario;
}
