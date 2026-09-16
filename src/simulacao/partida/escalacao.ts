import type { Clube, Escalacao, Jogador } from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
export function determinarEscalacao(
  jogador: Jogador,
  clube: Clube,
  aleatorio: GeradorAleatorio,
): Escalacao {
  if (jogador.lesao) return "lesionado";
  if (jogador.suspensao > 0) return "suspenso";
  const setor = ["CA", "PD", "PE"].includes(jogador.posicao)
    ? clube.forcaAtaque
    : ["MC", "MEI", "VOL"].includes(jogador.posicao)
      ? clube.forcaMeio
      : clube.forcaDefesa;
  const concorrencia = setor - (jogador.categoria === "base" ? 19 : 3);
  const mediaRecente = jogador.notasRecentes.length
    ? jogador.notasRecentes.reduce((a, b) => a + b, 0) /
      jogador.notasRecentes.length
    : 6.5;
  const avaliacao =
    (jogador.overall - concorrencia) * 1.5 +
    (jogador.confianca - 50) * 0.4 +
    (jogador.forma - 50) * 0.15 +
    (jogador.moral - 50) * 0.08 -
    jogador.fadiga * 0.18 +
    (mediaRecente - 6.5) * 4 +
    aleatorio.inteiro(-12, 12);
  return avaliacao > 4
    ? "titular"
    : avaliacao > -20
      ? "banco"
      : "nao relacionado";
}
