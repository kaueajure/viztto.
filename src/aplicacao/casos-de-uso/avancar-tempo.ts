import type { EstadoCarreira, Clube } from "@/dominio/entidades/modelos";
import {
  prepararSemana,
  simularRodadaCompleta,
  finalizarSemana,
} from "./fases-semana";
import {
  aplicarDesempenho,
  avaliarPromocao,
} from "@/simulacao/carreira/desempenho";

export { aplicarDesempenho, avaliarPromocao };

/** Avança uma semana completa (Matchday instantâneo embutido). */
export function avancarSemana(estado: EstadoCarreira): EstadoCarreira {
  if (estado.aposentado)
    throw new Error(
      "Esta carreira está aposentada. Você pode consultar o histórico, mas não avançar como jogador ativo.",
    );
  if (estado.temporada.encerrada) return estado;
  const ctx = prepararSemana(estado);
  simularRodadaCompleta(ctx);
  return finalizarSemana(ctx);
}

/** Reexport para testes/legado que importavam daqui. */
export type { Clube };
