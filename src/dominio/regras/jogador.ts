import { z } from "zod";
import {
  NOMES_ATRIBUTOS,
  type Atributo,
  type Atributos,
  type Categoria,
  type Jogador,
  type Posicao,
} from "../entidades/modelos";
export const POSICOES: Record<Posicao, string> = {
  GOL: "Goleiro",
  LD: "Lateral direito",
  ZAG: "Zagueiro",
  LE: "Lateral esquerdo",
  VOL: "Volante",
  MC: "Meio-campista central",
  MEI: "Meia ofensivo",
  PD: "Ponta direita",
  PE: "Ponta esquerda",
  CA: "Centroavante",
};
export const esquemaIdentidade = z.object({
  nome: z.string().trim().min(2).max(30),
  sobrenome: z.string().trim().min(2).max(40),
  nacionalidade: z.string().trim().min(2).max(40),
  idade: z.number().int().min(15).max(40),
  posicao: z.enum([
    "GOL",
    "LD",
    "ZAG",
    "LE",
    "VOL",
    "MC",
    "MEI",
    "PD",
    "PE",
    "CA",
  ]),
  posicaoSecundaria: z.enum([
    "",
    "GOL",
    "LD",
    "ZAG",
    "LE",
    "VOL",
    "MC",
    "MEI",
    "PD",
    "PE",
    "CA",
  ]),
  peDominante: z.enum(["direito", "esquerdo", "ambos"]),
  altura: z.number().int().min(150).max(215),
  peso: z.number().int().min(45).max(120),
  arquetipo: z.enum([
    "artilheiro",
    "criador",
    "velocista",
    "marcador",
    "equilibrado",
    "paredao",
  ]),
});
export const PESOS_POSICOES: Record<
  Posicao,
  Partial<Record<Atributo, number>>
> = {
  GOL: {
    reflexos: 5,
    posicionamentoGoleiro: 4,
    defesaGoleiro: 5,
    saida: 3,
    reposicao: 2,
    agilidade: 2,
    concentracao: 2,
  },
  LD: {
    velocidade: 3,
    resistencia: 3,
    cruzamento: 4,
    desarme: 3,
    marcacao: 2,
    passeCurto: 2,
    antecipacao: 1,
  },
  LE: {
    aceleracao: 3,
    resistencia: 3,
    cruzamento: 4,
    desarme: 3,
    marcacao: 2,
    passeCurto: 2,
    antecipacao: 1,
  },
  ZAG: {
    marcacao: 5,
    desarme: 5,
    forca: 3,
    antecipacao: 3,
    cabeceio: 3,
    impulsao: 2,
    concentracao: 2,
  },
  VOL: {
    desarme: 4,
    marcacao: 3,
    passeCurto: 3,
    antecipacao: 3,
    resistencia: 2,
    decisao: 2,
    forca: 2,
  },
  MC: {
    passeCurto: 5,
    passeLongo: 4,
    visao: 4,
    dominio: 2,
    resistencia: 3,
    decisao: 3,
  },
  MEI: {
    visao: 5,
    passeCurto: 4,
    drible: 3,
    dominio: 3,
    finalizacao: 2,
    decisao: 3,
  },
  PD: {
    velocidade: 4,
    aceleracao: 3,
    drible: 5,
    cruzamento: 3,
    finalizacao: 3,
    dominio: 2,
  },
  PE: {
    velocidade: 4,
    aceleracao: 3,
    drible: 5,
    cruzamento: 3,
    finalizacao: 3,
    compostura: 2,
  },
  CA: {
    finalizacao: 6,
    posicionamento: 4,
    velocidade: 2,
    cabeceio: 3,
    compostura: 4,
    forca: 1,
  },
};
export function calcularOverall(
  atributos: Atributos,
  posicao: Posicao,
): number {
  const pesos = Object.entries(PESOS_POSICOES[posicao]) as [Atributo, number][];
  return Math.round(
    pesos.reduce(
      (soma, [atributo, peso]) => soma + atributos[atributo] * peso,
      0,
    ) / pesos.reduce((soma, [, peso]) => soma + peso, 0),
  );
}
export function determinarCategoriaInicial(idade: number): Categoria {
  if (!Number.isInteger(idade) || idade < 15 || idade > 40)
    throw new Error("A idade deve estar entre 15 e 40 anos.");
  return idade < 17 ? "base" : "profissional";
}
export function criarAtributosUniformes(valor: number): Atributos {
  return Object.fromEntries(
    Object.keys(NOMES_ATRIBUTOS).map((chave) => [chave, valor]),
  ) as Atributos;
}
export function avaliarPotencial(jogador: Jogador): string {
  return jogador.potencialInterno >= 90
    ? "Uma das principais promessas da geração"
    : jogador.potencialInterno >= 82
      ? "Grande promessa"
      : jogador.potencialInterno >= 72
        ? "Pode se tornar um bom jogador"
        : "Potencial limitado";
}
