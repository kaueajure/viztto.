import type {
  Atributo,
  Clube,
  FocoTreino,
  Jogador,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { calcularEvolucao } from "../evolucao/evolucao";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";
export const FOCOS_TREINO: Record<
  FocoTreino,
  { nome: string; descricao: string; atributos: Atributo[]; carga: number }
> = {
  equilibrado: {
    nome: "Equilibrado",
    descricao: "Fundamentos da sua posição, com carga moderada.",
    atributos: [],
    carga: 10,
  },
  finalizacao: {
    nome: "Finalização",
    descricao: "Conclusão de jogadas, compostura e posicionamento.",
    atributos: ["finalizacao", "compostura", "posicionamento", "cabeceio"],
    carga: 16,
  },
  criacao: {
    nome: "Criação",
    descricao: "Passe, visão de jogo e tomada de decisão.",
    atributos: ["passeCurto", "passeLongo", "visao", "decisao"],
    carga: 12,
  },
  drible: {
    nome: "Drible",
    descricao: "Controle de bola, agilidade e um contra um.",
    atributos: ["drible", "dominio", "agilidade"],
    carga: 16,
  },
  velocidade: {
    nome: "Velocidade",
    descricao: "Explosão e sprints. Exige mais do físico.",
    atributos: ["aceleracao", "velocidade", "agilidade"],
    carga: 23,
  },
  fisico: {
    nome: "Físico",
    descricao: "Força, resistência e impulsão. Carga elevada.",
    atributos: ["forca", "resistencia", "impulsao"],
    carga: 23,
  },
  defesa: {
    nome: "Defesa",
    descricao: "Marcação, antecipação e fundamentos defensivos.",
    atributos: [
      "marcacao",
      "desarme",
      "antecipacao",
      "reflexos",
      "defesaGoleiro",
      "posicionamentoGoleiro",
    ],
    carga: 15,
  },
  recuperacao: {
    nome: "Recuperação",
    descricao: "Descanso ativo. Reduz a fadiga, sem desenvolvimento.",
    atributos: [],
    carga: -24,
  },
};
export function gerarLesao(
  jogador: Jogador,
  data: string,
  aleatorio: GeradorAleatorio,
  risco: number,
): boolean {
  if (jogador.lesao || !aleatorio.chance(risco)) return false;
  const dias = aleatorio.chance(0.08)
    ? aleatorio.inteiro(35, 84)
    : aleatorio.inteiro(7, 28);
  jogador.lesao = {
    tipo:
      dias > 34
        ? "Problema no joelho"
        : aleatorio.escolher([
            "Desconforto muscular",
            "Contusão",
            "Entorse",
            "Lesão muscular",
          ]),
    gravidade: dias > 34 ? "grave" : dias > 14 ? "moderada" : "leve",
    diasRecuperacao: dias,
    dataInicio: data,
    dataPrevistaRetorno: somarDias(data, dias),
  };
  return true;
}
export function processarTreinamento(
  jogador: Jogador,
  foco: FocoTreino,
  clube: Clube,
  data: string,
  aleatorio: GeradorAleatorio,
): number {
  const treino = FOCOS_TREINO[jogador.lesao ? "recuperacao" : foco];
  jogador.fadiga = limitar(jogador.fadiga - 22 + treino.carga);
  jogador.condicionamento = limitar(
    jogador.condicionamento + 12 - Math.max(0, treino.carga) * 0.3,
  );
  if (treino.carga < 0) return 0;
  jogador.confianca = limitar(
    jogador.confianca + (jogador.personalidade.disciplina > 45 ? 0.5 : -0.5),
  );
  gerarLesao(
    jogador,
    data,
    aleatorio,
    0.003 + jogador.fadiga * 0.0001 + Math.max(0, treino.carga - 15) * 0.0004,
  );
  const atributos =
    foco === "equilibrado"
      ? (Object.keys(PESOS_POSICOES[jogador.posicao]) as Atributo[])
      : treino.atributos;
  return calcularEvolucao(jogador, atributos, 8, clube);
}
