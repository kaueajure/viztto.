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

/** Alternativas compatíveis por posição (criação = adaptação). GOL sem secundária. */
export const POSICOES_ALTERNATIVAS: Record<Posicao, readonly Posicao[]> = {
  GOL: [],
  LD: ["LE", "VOL", "PD"],
  LE: ["LD", "VOL", "PE"],
  ZAG: ["VOL"],
  VOL: ["MC", "ZAG"],
  MC: ["VOL", "MEI"],
  MEI: ["MC", "PD", "PE", "CA"],
  PD: ["PE", "MEI", "CA"],
  PE: ["PD", "MEI", "CA"],
  CA: ["PD", "PE", "MEI"],
};

export const esquemaIdentidadeBase = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome precisa ter pelo menos 2 caracteres.")
    .max(30, "Nome muito longo."),
  sobrenome: z
    .string()
    .trim()
    .min(2, "Informe seu sobrenome.")
    .max(40, "Sobrenome muito longo."),
  nacionalidade: z
    .string()
    .trim()
    .min(2, "Informe a nacionalidade.")
    .max(40, "Nacionalidade muito longa."),
  idade: z
    .number({ error: "Informe uma idade válida." })
    .int("Idade deve ser um número inteiro.")
    .min(15, "Idade mínima: 15 anos.")
    .max(40, "Idade máxima: 40 anos."),
  posicao: z.enum(
    ["GOL", "LD", "ZAG", "LE", "VOL", "MC", "MEI", "PD", "PE", "CA"],
    { error: "Selecione uma posição." },
  ),
  posicaoSecundaria: z.enum(
    ["", "GOL", "LD", "ZAG", "LE", "VOL", "MC", "MEI", "PD", "PE", "CA"],
    { error: "Posição secundária inválida." },
  ),
  peDominante: z.enum(["direito", "esquerdo", "ambos"], {
    error: "Selecione o pé dominante.",
  }),
  altura: z
    .number({ error: "Informe a altura." })
    .int("Altura deve ser um número inteiro.")
    .min(150, "Altura mínima: 150 cm.")
    .max(215, "Altura máxima: 215 cm."),
  peso: z
    .number({ error: "Informe o peso." })
    .int("Peso deve ser um número inteiro.")
    .min(45, "Peso mínimo: 45 kg.")
    .max(120, "Peso máximo: 120 kg."),
  arquetipo: z.enum(
    [
      "artilheiro",
      "criador",
      "velocista",
      "marcador",
      "equilibrado",
      "paredao",
    ],
    { error: "Selecione um arquétipo." },
  ),
});

/** Identidade na criação — valida secundária compatível com a principal. */
export const esquemaIdentidade = esquemaIdentidadeBase.superRefine((v, ctx) => {
  if (!v.posicaoSecundaria) return;
  const ok = POSICOES_ALTERNATIVAS[v.posicao].includes(
    v.posicaoSecundaria as Posicao,
  );
  if (!ok) {
    ctx.addIssue({
      code: "custom",
      path: ["posicaoSecundaria"],
      message: "Posição secundária incompatível com a principal.",
    });
  }
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
  // Parecer baseado no que a comissão observa, sem ler o teto oculto.
  const observado = jogador.overall + Math.max(0, 23 - jogador.idade) * 2 + jogador.reputacao * 0.08;
  return observado >= 86 ? "Sinais de uma promessa excepcional"
    : observado >= 77 ? "Grande promessa aos olhos da comissão"
    : observado >= 68 ? "Perfil promissor, ainda em avaliação"
    : "Desenvolvimento em observação";
}
