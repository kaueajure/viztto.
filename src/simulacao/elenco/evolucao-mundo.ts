import type { JogadorMundo } from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";

/** Evolução simplificada de NPCs (lote semanal). */
export function evoluirJogadoresMundo(
  elenco: JogadorMundo[],
  aleatorio: GeradorAleatorio,
  detalhado: boolean,
): void {
  for (const j of elenco) {
    if (j.lesao) {
      j.lesao.diasRecuperacao = Math.max(0, j.lesao.diasRecuperacao - 7);
      if (j.lesao.diasRecuperacao === 0) {
        j.lesao = null;
        j.lesionado = false;
      }
      continue;
    }

    j.fadiga = limitar(j.fadiga * 0.85 + aleatorio.inteiro(0, 8));
    j.condicionamento = limitar(j.condicionamento + aleatorio.inteiro(-2, 3));
    j.forma = limitar(j.forma * 0.9 + aleatorio.inteiro(40, 70) * 0.1);
    j.moral = limitar(j.moral + aleatorio.inteiro(-2, 2));

    if (detalhado && aleatorio.chance(0.012 + j.fadiga * 0.00015)) {
      const dias = aleatorio.inteiro(7, 28);
      j.lesionado = true;
      j.lesao = {
        tipo: aleatorio.escolher(["Distensão", "Contusão", "Fadiga muscular"]),
        gravidade: dias > 20 ? "moderada" : "leve",
        diasRecuperacao: dias,
        dataInicio: "1970-01-01",
        dataPrevistaRetorno: "1970-01-01",
      };
    }

    const margem = j.potencial - j.overall;
    if (j.idade <= 24 && margem > 0 && aleatorio.chance(detalhado ? 0.35 : 0.12)) {
      j.overall = Math.min(j.potencial, j.overall + (aleatorio.chance(0.2) ? 1 : 0));
    } else if (j.idade >= 32 && aleatorio.chance(detalhado ? 0.25 : 0.1)) {
      j.overall = Math.max(50, j.overall - 1);
      j.potencial = Math.min(j.potencial, j.overall);
    } else if (j.idade >= 35 && aleatorio.chance(0.08)) {
      j.overall = Math.max(48, j.overall - 1);
    }

    j.valorMercado = Math.round(
      j.valorMercado *
        (1 +
          (j.idade < 27 ? 0.004 : j.idade > 32 ? -0.008 : 0) +
          aleatorio.inteiro(-2, 2) / 1000),
    );

    if (j.suspensao > 0) j.suspensao -= 1;
  }
}

export function podeAposentar(
  j: JogadorMundo,
  aleatorio: GeradorAleatorio,
): boolean {
  if (j.idade < 34) return false;
  const chance =
    j.idade >= 38 ? 0.35 : j.idade >= 36 ? 0.18 : j.idade === 35 ? 0.08 : 0.03;
  return aleatorio.chance(chance) && j.overall < 72;
}
