import type { Atributo, Posicao } from "@/dominio/entidades/modelos";

export type CategoriaExercicio =
  | "ataque"
  | "passe"
  | "tecnica"
  | "fisico"
  | "defesa"
  | "goleiro";

export type MecanicaExercicio =
  | "barra-timing"
  | "zonas-gol"
  | "timing-contato"
  | "timing-direcao"
  | "companheiros"
  | "passe-janela"
  | "barra-forca"
  | "sequencia"
  | "manter-zona"
  | "reacao"
  | "segurar-barra"
  | "desarme-timing"
  | "linhas-passe"
  | "reflexo-regiao"
  | "direcao-gk"
  | "posicionar-gk";

export type ExercicioId =
  | "penaltis"
  | "finalizacao-colocada"
  | "finalizacao-primeira"
  | "cabecalho"
  | "passe-rapido"
  | "passe-profundidade"
  | "cruzamento"
  | "drible"
  | "dominio"
  | "arrancada"
  | "resistencia"
  | "desarme"
  | "interceptacao"
  | "goleiro-reflexos"
  | "goleiro-penaltis"
  | "goleiro-posicionamento";

export interface ExercicioTreino {
  id: ExercicioId;
  nome: string;
  descricao: string;
  instrucao: string;
  categoria: CategoriaExercicio;
  /** Posições para as quais o exercício aparece em "Recomendados". */
  recomendadoPara: Posicao[];
  /** Se true, só goleiros veem no catálogo filtrado de recomendações exclusivas. */
  exclusivoGoleiro?: boolean;
  primario: Atributo;
  secundarios: Atributo[];
  terciarios?: Atributo[];
  mecanica: MecanicaExercicio;
  tentativas: number;
}

export const EXERCICIOS: readonly ExercicioTreino[] = [
  {
    id: "penaltis",
    nome: "Pênaltis",
    descricao: "Pare o indicador o mais perto possível do centro verde.",
    instrucao: "Pare o indicador o mais próximo possível do centro verde.",
    categoria: "ataque",
    recomendadoPara: ["CA", "PD", "PE", "MEI"],
    primario: "finalizacao",
    secundarios: ["compostura"],
    terciarios: ["concentracao"],
    mecanica: "barra-timing",
    tentativas: 5,
  },
  {
    id: "finalizacao-colocada",
    nome: "Finalização colocada",
    descricao: "Acerte a zona do gol que acender antes do tempo acabar.",
    instrucao: "Clique na zona acesa o mais rápido possível.",
    categoria: "ataque",
    recomendadoPara: ["CA", "PD", "PE", "MEI"],
    primario: "finalizacao",
    secundarios: ["compostura"],
    terciarios: ["posicionamento"],
    mecanica: "zonas-gol",
    tentativas: 5,
  },
  {
    id: "finalizacao-primeira",
    nome: "Finalização de primeira",
    descricao: "Acerte o timing no momento em que a bola entra na zona verde.",
    instrucao: "Finalize quando o indicador estiver na zona verde.",
    categoria: "ataque",
    recomendadoPara: ["CA", "PD", "PE"],
    primario: "finalizacao",
    secundarios: ["dominio"],
    terciarios: ["agilidade"],
    mecanica: "timing-contato",
    tentativas: 5,
  },
  {
    id: "cabecalho",
    nome: "Cabeceio",
    descricao: "Acerte o timing do cruzamento e escolha a direção.",
    instrucao: "No momento certo, escolha esquerda, centro ou direita.",
    categoria: "ataque",
    recomendadoPara: ["CA", "ZAG"],
    primario: "cabeceio",
    secundarios: ["impulsao"],
    terciarios: ["posicionamento"],
    mecanica: "timing-direcao",
    tentativas: 5,
  },
  {
    id: "passe-rapido",
    nome: "Passe rápido",
    descricao: "Identifique o companheiro livre e passe a tempo.",
    instrucao: "Clique no companheiro que ficar livre.",
    categoria: "passe",
    recomendadoPara: ["MEI", "MC", "VOL", "LD", "LE"],
    primario: "passeCurto",
    secundarios: ["visao"],
    terciarios: ["decisao"],
    mecanica: "companheiros",
    tentativas: 6,
  },
  {
    id: "passe-profundidade",
    nome: "Passe em profundidade",
    descricao: "Ache a janela entre a linha defensiva e o atacante.",
    instrucao: "Passe no timing certo — nem cedo demais, nem tarde.",
    categoria: "passe",
    recomendadoPara: ["MEI", "MC", "PD", "PE"],
    primario: "visao",
    secundarios: ["passeLongo"],
    terciarios: ["passeCurto"],
    mecanica: "passe-janela",
    tentativas: 5,
  },
  {
    id: "cruzamento",
    nome: "Cruzamento",
    descricao: "Ajuste a força na zona-alvo para achar o colega na área.",
    instrucao: "Solte na força ideal marcada na barra.",
    categoria: "passe",
    recomendadoPara: ["LD", "LE", "PD", "PE"],
    primario: "cruzamento",
    secundarios: ["passeLongo"],
    terciarios: ["visao"],
    mecanica: "barra-forca",
    tentativas: 5,
  },
  {
    id: "drible",
    nome: "Drible",
    descricao: "Reproduza a sequência de direções antes que o tempo acabe.",
    instrucao: "Repita a sequência mostrada.",
    categoria: "tecnica",
    recomendadoPara: ["PD", "PE", "MEI", "MC"],
    primario: "drible",
    secundarios: ["agilidade"],
    terciarios: ["dominio"],
    mecanica: "sequencia",
    tentativas: 5,
  },
  {
    id: "dominio",
    nome: "Domínio / primeiro toque",
    descricao: "Mantenha o cursor dentro da zona móvel.",
    instrucao: "Fique dentro da zona verde o tempo todo.",
    categoria: "tecnica",
    recomendadoPara: ["CA", "PD", "PE", "MEI", "MC", "VOL"],
    primario: "dominio",
    secundarios: ["agilidade"],
    terciarios: ["compostura"],
    mecanica: "manter-zona",
    tentativas: 3,
  },
  {
    id: "arrancada",
    nome: "Arrancada",
    descricao: "Reaja ao sinal e dispare o sprint.",
    instrucao: "Espere o VAI! e reaja o mais rápido possível.",
    categoria: "fisico",
    recomendadoPara: ["PD", "PE", "CA", "LD", "LE"],
    primario: "aceleracao",
    secundarios: ["velocidade"],
    terciarios: ["agilidade"],
    mecanica: "reacao",
    tentativas: 5,
  },
  {
    id: "resistencia",
    nome: "Resistência",
    descricao: "Mantenha o indicador na zona ideal por alguns segundos.",
    instrucao: "Segure o indicador dentro da zona sem exagerar.",
    categoria: "fisico",
    recomendadoPara: ["VOL", "ZAG", "LD", "LE", "MC"],
    primario: "resistencia",
    secundarios: ["forca"],
    terciarios: ["concentracao"],
    mecanica: "segurar-barra",
    tentativas: 1,
  },
  {
    id: "desarme",
    nome: "Desarme",
    descricao: "Desarme no momento certo quando o atacante entra na zona.",
    instrucao: "Desarme no timing ideal — cedo demais é falta.",
    categoria: "defesa",
    recomendadoPara: ["ZAG", "VOL", "LD", "LE"],
    primario: "desarme",
    secundarios: ["marcacao"],
    terciarios: ["antecipacao"],
    mecanica: "desarme-timing",
    tentativas: 5,
  },
  {
    id: "interceptacao",
    nome: "Interceptação",
    descricao: "Leia a linha de passe e corte antes da bola chegar.",
    instrucao: "Escolha esquerda, centro ou direita a tempo.",
    categoria: "defesa",
    recomendadoPara: ["ZAG", "VOL", "MC"],
    primario: "antecipacao",
    secundarios: ["marcacao"],
    terciarios: ["posicionamento"],
    mecanica: "linhas-passe",
    tentativas: 6,
  },
  {
    id: "goleiro-reflexos",
    nome: "Goleiro — reflexos",
    descricao: "Toque na região do gol que acender.",
    instrucao: "Clique na região acesa antes que apague.",
    categoria: "goleiro",
    recomendadoPara: ["GOL"],
    exclusivoGoleiro: true,
    primario: "reflexos",
    secundarios: ["agilidade"],
    terciarios: ["concentracao"],
    mecanica: "reflexo-regiao",
    tentativas: 8,
  },
  {
    id: "goleiro-penaltis",
    nome: "Goleiro — pênaltis",
    descricao: "Leia a indicação e escolha o lado do mergulho.",
    instrucao: "Escolha esquerda, centro ou direita.",
    categoria: "goleiro",
    recomendadoPara: ["GOL"],
    exclusivoGoleiro: true,
    primario: "reflexos",
    secundarios: ["posicionamentoGoleiro"],
    terciarios: ["concentracao"],
    mecanica: "direcao-gk",
    tentativas: 5,
  },
  {
    id: "goleiro-posicionamento",
    nome: "Goleiro — posicionamento",
    descricao: "Posicione-se no ângulo certo conforme o atacante se move.",
    instrucao: "Mova o marcador para cobrir o ângulo do chute.",
    categoria: "goleiro",
    recomendadoPara: ["GOL"],
    exclusivoGoleiro: true,
    primario: "posicionamentoGoleiro",
    secundarios: ["defesaGoleiro"],
    terciarios: ["antecipacao"],
    mecanica: "posicionar-gk",
    tentativas: 5,
  },
] as const;

export const EXERCICIOS_POR_ID: Record<ExercicioId, ExercicioTreino> =
  Object.fromEntries(EXERCICIOS.map((e) => [e.id, e])) as Record<
    ExercicioId,
    ExercicioTreino
  >;

export function exercicioPorId(id: string): ExercicioTreino | undefined {
  return EXERCICIOS_POR_ID[id as ExercicioId];
}

export function exerciciosVisiveisPara(posicao: Posicao): ExercicioTreino[] {
  if (posicao === "GOL") {
    return EXERCICIOS.filter(
      (e) => e.exclusivoGoleiro || e.recomendadoPara.includes("GOL"),
    );
  }
  return EXERCICIOS.filter((e) => !e.exclusivoGoleiro);
}

export function exerciciosRecomendados(posicao: Posicao): ExercicioTreino[] {
  return exerciciosVisiveisPara(posicao).filter((e) =>
    e.recomendadoPara.includes(posicao),
  );
}

export const ROTULOS_CATEGORIA: Record<CategoriaExercicio, string> = {
  ataque: "Ataque",
  passe: "Passe",
  tecnica: "Técnica",
  fisico: "Físico",
  defesa: "Defesa",
  goleiro: "Goleiro",
};
