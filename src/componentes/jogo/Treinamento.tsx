"use client";

import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { CentroTreinamento } from "@/componentes/treinamento/CentroTreinamento";

/** Entrada da aba Treinamento — Centro de Treinamento jogável. */
export function Treinamento({ carreira }: { carreira: EstadoCarreira }) {
  return <CentroTreinamento carreira={carreira} />;
}
