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
): Escalacao {
  if (jogador.lesao) return "lesionado";
  if (jogador.suspensao > 0) return "suspenso";
  if (jogador.categoria === "base") {
    const mediaRecente = jogador.notasRecentes.length
      ? jogador.notasRecentes.reduce((a, b) => a + b, 0) /
        jogador.notasRecentes.length
      : 6.5;
    const avaliacao =
      (jogador.overall - (clube.qualidadeBase - 8)) * 1.2 +
      (jogador.confianca - 50) * 0.35 +
      (mediaRecente - 6.5) * 3 +
      aleatorio.inteiro(-8, 8);
    return avaliacao > 6 ? "titular" : avaliacao > -10 ? "banco" : "nao relacionado";
  }
  const candidatos = [
    ...clube.elenco.map(jogadorMundoComoCandidato),
    jogadorUsuarioComoCandidato(jogador),
  ];
  // pequena variação semanal
  for (const c of candidatos) {
    if (c.ehUsuario) c.confiancaTreinador += aleatorio.inteiro(-3, 3);
  }
  const resultado = escalarElencoCompleto(
    candidatos,
    clube.formacaoPreferida,
    clube.treinador,
  );
  return resultado.escalacaoUsuario;
}
