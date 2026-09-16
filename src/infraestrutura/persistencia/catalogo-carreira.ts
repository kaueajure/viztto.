import "server-only";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { obterDadosLigaDisponivel } from "./base-futebol";
import {
  ErroCompatibilidadeSave,
  type CatalogoCarreira,
} from "./carreira-persistida";

let cacheCatalogo: CatalogoCarreira | null = null;
let carregandoCatalogo: Promise<CatalogoCarreira> | null = null;
/** Contador de leituras de disco (testes / medição). */
export let leiturasCatalogoDisco = 0;

async function carregarCatalogoCompleto(): Promise<CatalogoCarreira> {
  const catalogo: CatalogoCarreira = { ligas: [], clubes: [] };
  leiturasCatalogoDisco++;
  for (const liga of LIGAS_SUPORTADAS) {
    const dados = await obterDadosLigaDisponivel(liga);
    if (!dados) continue;
    catalogo.ligas.push({ ...liga, quantidadeClubes: dados.clubes.length });
    catalogo.clubes.push(...dados.clubes);
  }
  return catalogo;
}

/** Cache em memória do processo: snapshots versionados não mudam sem redeploy. */
export async function carregarCatalogoCarreira(
  ids: string[],
): Promise<CatalogoCarreira> {
  if (!cacheCatalogo) {
    carregandoCatalogo ??= carregarCatalogoCompleto().then((c) => {
      cacheCatalogo = c;
      return c;
    }).finally(() => { carregandoCatalogo = null; });
    await carregandoCatalogo;
  }
  const catalogo = cacheCatalogo!;
  for (const id of ids) {
    if (!catalogo.ligas.some((l) => l.id === id))
      throw new ErroCompatibilidadeSave();
  }
  return catalogo;
}

export function limparCacheCatalogoCarreira() {
  cacheCatalogo = null;
  carregandoCatalogo = null;
  leiturasCatalogoDisco = 0;
}
