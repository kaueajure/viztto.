import "server-only";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import type { Liga } from "@/dominio/entidades/modelos";
import type { LigaDisponivel } from "@/dominio/regras/liga";
import {
  clubesProntosParaJogo,
  lerDadosLiga,
  type DadosLigaImportados,
} from "./importacao-futebol";

/** Política única para leitura pública e publicação da base oficial. */
export function validarDisponibilidadeLiga(
  liga: Liga,
  dados: DadosLigaImportados | null,
) {
  const calendario = TEMPORADAS_INICIAIS[liga.id];
  if (
    !dados ||
    !calendario ||
    dados.ligaId !== liga.id ||
    dados.temporada !== calendario.ano ||
    dados.inicio !== calendario.inicio ||
    (dados.temporadaTransfermarkt &&
      dados.temporadaTransfermarkt !== calendario.temporadaTransfermarkt) ||
    !["completo", "parcial"].includes(dados.status)
  )
    return null;
  const clubes = clubesProntosParaJogo(dados);
  if (clubes.length < 2) return null;
  const status =
    dados.status === "completo" &&
    dados.erros.length === 0 &&
    clubes.length === dados.progresso.total
      ? "completo"
      : "parcial";
  return { ...dados, clubes, status } as DadosLigaImportados & {
    status: "completo" | "parcial";
  };
}

export async function obterDadosLigaDisponivel(liga: Liga, diretorio?: string) {
  return validarDisponibilidadeLiga(
    liga,
    await lerDadosLiga(liga.id, diretorio),
  );
}

export async function obterLigasDisponiveis(
  diretorio?: string,
): Promise<LigaDisponivel[]> {
  const disponiveis: LigaDisponivel[] = [];
  for (const liga of LIGAS_SUPORTADAS) {
    const dados = await obterDadosLigaDisponivel(liga, diretorio);
    if (dados)
      disponiveis.push({
        ...liga,
        quantidadeClubes: dados.clubes.length,
        clubesDisponiveis: dados.clubes.length,
        temporada: dados.temporada,
        inicio: dados.inicio,
        atualizadoEm: dados.atualizadoEm,
        status: dados.status,
      });
  }
  return disponiveis;
}
