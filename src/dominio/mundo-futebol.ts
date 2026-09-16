import type {
  Clube,
  EstiloTatico,
  Liga,
  Treinador,
} from "@/dominio/entidades/modelos";
import type { Formacao } from "@/dominio/formacao";
import { hidratarElencoClube } from "@/dominio/jogador-mundo";
import { reescalarClube } from "@/simulacao/elenco/escalacao-elenco";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";

const NOMES_TREINADOR = [
  "Carlos Mendes",
  "Rui Albuquerque",
  "Paolo Ricci",
  "Hans Weber",
  "Julien Moreau",
  "Diego Vargas",
  "Marcus Holm",
  "Igor Petrov",
  "André Costa",
  "Luis Navarro",
];

const ESTILOS: EstiloTatico[] = [
  "posse",
  "direto",
  "equilibrado",
  "contra-ataque",
];

export function criarTreinador(
  clubeId: string,
  formacao: Formacao,
  seed: string,
): Treinador {
  const aleatorio = new GeradorAleatorio(gerarSeedNumerica(`tec-${seed}-${clubeId}`));
  return {
    id: `tec-${clubeId}`,
    nome: aleatorio.escolher(NOMES_TREINADOR),
    formacaoPreferida: formacao,
    estilo: aleatorio.escolher(ESTILOS),
    preferenciaJovens: aleatorio.inteiro(25, 90),
    disciplina: aleatorio.inteiro(35, 95),
    rotacao: aleatorio.inteiro(30, 85),
    paciencia: aleatorio.inteiro(30, 90),
  };
}

/** Prepara clubes importados para o universo vivo da carreira. */
export function prepararClubesParaMundo(
  clubes: Clube[],
  liga: Liga,
): Clube[] {
  return clubes.map((bruto) => {
    const clube = structuredClone(bruto);
    clube.bancoIds = clube.bancoIds ?? [];
    clube.orcamento =
      clube.orcamento ??
      Math.round(clube.poderFinanceiro * 1_200_000 + (clube.valorElenco ?? 0) * 0.08);
    clube.elenco = hidratarElencoClube(clube.elenco as never, clube, liga);
    clube.treinador =
      clube.treinador ??
      criarTreinador(clube.id, clube.formacaoPreferida, liga.id);
    clube.treinador.formacaoPreferida = clube.formacaoPreferida;
    reescalarClube(clube);
    sincronizarForcaClube(clube);
    clube.tamanhoElenco = clube.elenco.length;
    return clube;
  });
}

export function orcamentoAproximado(clube: Clube): number {
  return clube.orcamento > 0
    ? clube.orcamento
    : Math.round(clube.poderFinanceiro * 1_200_000);
}
