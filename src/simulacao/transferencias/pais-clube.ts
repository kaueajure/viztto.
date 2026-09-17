import type { Clube, EstadoCarreira } from "@/dominio/entidades/modelos";

/** Pré-contrato internacional exige países distintos (não só ligas distintas). */
export function clubesDePaisesDiferentes(
  origem: Clube,
  destino: Clube,
): boolean {
  return origem.pais !== destino.pais;
}

/**
 * Clube dono do vínculo contratual.
 * Em empréstimo, `jogador.contrato.clubeId` continua sendo o clube de origem.
 */
export function clubeDoContrato(c: EstadoCarreira): Clube | undefined {
  return c.clubes.find((cl) => cl.id === c.jogador.contrato.clubeId);
}
