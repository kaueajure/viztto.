import { notaBase } from "../elenco/hierarquia";
import type { Clube, Escalacao, Jogador } from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import {
  escalarElencoCompleto,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
} from "@/simulacao/elenco/escalacao-elenco";

export function determinarEscalacao(
  jogador: Jogador,
  clube: Clube,
  aleatorio: GeradorAleatorio,
  incentivo = 0,
): Escalacao {
  if (jogador.lesao) return "lesionado";
  if (jogador.suspensao > 0) return "suspenso";
  if (jogador.categoria === "base") {
    const avaliacao = notaBase(jogador, clube) + incentivo + aleatorio.inteiro(-8, 8);
    return avaliacao > 6 ? "titular" : avaliacao > -10 ? "banco" : "nao relacionado";
  }
  const candidatos = [
    ...clube.elenco.map(jogadorMundoComoCandidato),
    jogadorUsuarioComoCandidato(jogador),
  ];
  // pequena variação semanal
  for (const c of candidatos) {
    if (c.ehUsuario) c.confiancaTreinador += aleatorio.inteiro(-3, 3) + incentivo * 10;
  }
  const resultado = escalarElencoCompleto(
    candidatos,
    clube.formacaoPreferida,
    clube.treinador,
  );
  return resultado.escalacaoUsuario;
}
