import { PLANOS, prioridadesDaPosicao } from "@/dominio/planos-desenvolvimento";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { IntensidadeTreino, AvaliacaoTreino } from "@/dominio/desenvolvimento";
import { registrarEvento } from "../eventos/eventos";
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
/** Com plano ativo, só recuperação permanece como foco rápido explícito. */
export function focoTreinoEfetivo(
  foco: FocoTreino,
  planoId: string | null | undefined,
): FocoTreino {
  if (!planoId) return foco;
  return foco === "recuperacao" ? "recuperacao" : "equilibrado";
}

export function processarTreinamento(
  jogador: Jogador,
  foco: FocoTreino,
  clube: Clube | null,
  data: string,
  aleatorio: GeradorAleatorio,
): number {
  const preparacao = jogador.preparacao;
  const focoUsado = focoTreinoEfetivo(foco, preparacao.planoId);
  const recuperacao = !!jogador.lesao || focoUsado === "recuperacao";
  const treino = FOCOS_TREINO[recuperacao ? "recuperacao" : focoUsado];
  const fatorCarga = { leve: 0.65, normal: 1, intenso: 1.65 }[preparacao.intensidade];
  const nota = recuperacao ? 0 : avaliarTreino(jogador, aleatorio);
  const confiancaAntes = jogador.confianca;
  // Com plano, a carga segue a intensidade do plano (via equilibrado), nunca um foco oculto.
  jogador.fadiga = limitar(jogador.fadiga - 15 + (recuperacao ? -24 : treino.carga * fatorCarga * (clube ? 1 : 0.85)));
  jogador.condicionamento = limitar(jogador.condicionamento + 10 - Math.max(0, treino.carga) * fatorCarga * 0.4 + (clube ? 0 : 2));
  let progresso = 0;
  if (!recuperacao) {
    // Sem clube: não gera confiança de treinador; moral sobe menos.
    if (clube) {
      jogador.confianca = limitar(jogador.confianca + (nota - 52) / 18);
      jogador.moral = limitar(jogador.moral + (nota - 55) / 60);
    } else {
      jogador.moral = limitar(jogador.moral + (nota - 55) / 120);
    }
    jogador.forma = limitar(jogador.forma * .97 + nota * .03);
    const plano = PLANOS.find(p => p.id === preparacao.planoId && p.posicoes.includes(jogador.posicao));
    const atributos = plano?.atributos ?? (focoUsado === "equilibrado" ? Object.keys(PESOS_POSICOES[jogador.posicao]) as Atributo[] : treino.atributos);
    const pontos = 5 * (.45 + nota / 100) * (preparacao.intensidade === 'intenso' ? 1.12 : preparacao.intensidade === 'leve' ? .7 : 1);
    progresso = calcularEvolucao(jogador, atributos, pontos, clube);
    const prioridades = preparacao.prioridades.filter(a => prioridadesDaPosicao(jogador.posicao).includes(a));
    progresso += calcularEvolucao(jogador, prioridades, pontos * .35, clube);
    gerarLesao(jogador,data,aleatorio,.002 + jogador.fadiga * .00012 + (preparacao.intensidade === 'intenso' ? .003 : 0));
  }
  const avaliacao: AvaliacaoTreino = recuperacao ? 'Recuperação' : nota >= 82 ? 'Excelente' : nota >= 69 ? 'Muito bom' : nota >= 55 ? 'Bom' : nota >= 40 ? 'Regular' : 'Ruim';
  preparacao.historico = [...preparacao.historico,{data,avaliacao,nota,confianca:jogador.confianca-confiancaAntes,progresso}].slice(-8);
  return progresso;
}
export function avaliarTreino(j: Jogador, rng: GeradorAleatorio): number {
  const recente = j.preparacao.historico.filter(t => t.avaliacao !== 'Recuperação').slice(-3);
  const media = recente.length ? recente.reduce((s,t) => s+t.nota,0)/recente.length : 55;
  return limitar(12 + j.personalidade.profissionalismo * .27 + j.personalidade.disciplina * .17 + j.moral * .12 + j.condicionamento * .12 - j.fadiga * .2 + media * .07 + (j.idade < 24 ? 3 : 0) + (j.preparacao.planoId ? 2 : 0) + rng.inteiro(-8,8));
}
export function configurarDesenvolvimento(estado: EstadoCarreira, planoId: string, prioridades: Atributo[], intensidade: IntensidadeTreino): EstadoCarreira {
  const plano = PLANOS.find(p => p.id === planoId && p.posicoes.includes(estado.jogador.posicao));
  if (!plano || prioridades.length > 2 || new Set(prioridades).size !== prioridades.length || prioridades.some(a => !prioridadesDaPosicao(estado.jogador.posicao).includes(a)) || !['leve','normal','intenso'].includes(intensidade))
    throw new Error('Escolha um plano da sua posição, até duas prioridades e uma intensidade válida.');
  const c = structuredClone(estado);
  c.jogador.preparacao = {...c.jogador.preparacao,planoId,prioridades:[...prioridades],intensidade};
  // Evita foco oculto (ex.: velocidade) continuar puxando carga com o plano ativo.
  if (c.focoTreino !== "recuperacao") c.focoTreino = "equilibrado";
  registrarEvento(c,'plano','Plano de desenvolvimento atualizado',`${plano.nome}. Intensidade ${intensidade}; ${prioridades.length} prioridade(s) individual(is).`,'Treinador',false);
  return c;
}

/** Foco rápido: com plano, só recuperação ou ritmo do plano (equilibrado). */
export function escolherFocoTreino(
  estado: EstadoCarreira,
  foco: FocoTreino,
): EstadoCarreira {
  if (!Object.hasOwn(FOCOS_TREINO, foco))
    throw new Error("Escolha um foco de treino válido.");
  if (
    estado.jogador.preparacao.planoId &&
    foco !== "recuperacao" &&
    foco !== "equilibrado"
  )
    throw new Error(
      "Com plano ativo, use apenas recuperação ou o ritmo do plano.",
    );
  return { ...estado, focoTreino: foco };
}
