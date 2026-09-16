import "server-only";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { obterDadosLigaDisponivel } from "./base-futebol";
import {
  ErroCompatibilidadeSave,
  type CatalogoCarreira,
} from "./carreira-persistida";

export async function carregarCatalogoCarreira(
  ids: string[],
): Promise<CatalogoCarreira> {
  const catalogo: CatalogoCarreira = { ligas: [], clubes: [] };
  // Identidades podem ter mudado de clube/liga no deploy; procurar em todos os snapshots.
  for (const liga of LIGAS_SUPORTADAS) {
    const dados = await obterDadosLigaDisponivel(liga);
    if (!dados) {
      if (ids.includes(liga.id)) throw new ErroCompatibilidadeSave();
      continue;
    }
    catalogo.ligas.push({ ...liga, quantidadeClubes: dados.clubes.length });
    catalogo.clubes.push(...dados.clubes);
  }
  return catalogo;
}
