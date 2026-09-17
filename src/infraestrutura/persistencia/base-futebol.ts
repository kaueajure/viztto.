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

/** Política para leitura pública (aceita parcial utilizável). */
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

export interface ResultadoValidacaoPublicacao {
  ok: boolean;
  motivo?: string;
  dados?: DadosLigaImportados & { status: "completo" };
}

/**
 * Gate estrito para SUBSTITUIR snapshot oficial.
 * Parcial / regressão de clubes NÃO publica.
 */
export function validarPublicacaoLiga(
  liga: Liga,
  candidato: DadosLigaImportados | null,
  anteriorOficial: DadosLigaImportados | null,
  opcoes?: {
    /** Quantidade esperada consciente (mudança de formato entre temporadas). */
    clubesEsperados?: number;
  },
): ResultadoValidacaoPublicacao {
  const base = validarDisponibilidadeLiga(liga, candidato);
  if (!base)
    return { ok: false, motivo: "Snapshot inválido para o calendário da liga." };

  if (base.status !== "completo")
    return {
      ok: false,
      motivo: `Snapshot parcial (${base.clubes.length}/${base.progresso.total}) não substitui base oficial.`,
    };

  if (base.erros.length > 0)
    return {
      ok: false,
      motivo: `${base.erros.length} clube(s) com falha — publicação oficial bloqueada.`,
    };

  if (base.progresso.falhas > 0)
    return {
      ok: false,
      motivo: `Progresso com ${base.progresso.falhas} falha(s) — publicação bloqueada.`,
    };

  if (base.clubes.length !== base.progresso.total)
    return {
      ok: false,
      motivo: `Cobertura incompleta: ${base.clubes.length}/${base.progresso.total} clubes.`,
    };

  const cal = TEMPORADAS_INICIAIS[liga.id];
  const esperados =
    opcoes?.clubesEsperados ??
    cal?.clubesEsperados ??
    liga.quantidadeClubes;

  if (base.clubes.length !== esperados)
    return {
      ok: false,
      motivo: `Esperados ${esperados} clubes, obtidos ${base.clubes.length}.`,
    };

  if (anteriorOficial) {
    const prev = clubesProntosParaJogo(anteriorOficial).length;
    // Com esperados explícitos, mudança consciente de formato já foi validada acima.
    if (base.clubes.length < prev && opcoes?.clubesEsperados == null && cal?.clubesEsperados == null)
      return {
        ok: false,
        motivo: `Regressão de cobertura: oficial tinha ${prev} clubes, novo tem ${base.clubes.length}.`,
      };
  }

  return {
    ok: true,
    dados: { ...base, status: "completo" },
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
