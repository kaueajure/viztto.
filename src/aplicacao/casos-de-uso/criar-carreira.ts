import { criarMercado } from "@/dominio/mercado";
import type {
  Clube,
  EstadoCarreira,
  IdentidadeJogador,
  Liga,
  Atributo,
} from "@/dominio/entidades/modelos";
import {
  calcularOverall,
  criarAtributosUniformes,
  determinarCategoriaInicial,
  esquemaIdentidade,
  PESOS_POSICOES,
} from "@/dominio/regras/jogador";
import { prepararClubesParaMundo } from "@/dominio/mundo-futebol";
import { gerarSeedNumerica, GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { criarTemporada } from "@/simulacao/temporada/gerador-calendario";
import { calcularValorMercado } from "@/simulacao/transferencias/mercado";
import { resolverJanela } from "@/simulacao/transferencias/necessidade";
import { criarTemporadasExternas } from "@/simulacao/mundo/avancar-ligas";
import { registrarEvento } from "@/simulacao/eventos/eventos";

export interface EntradaCarreira {
  identidade: IdentidadeJogador;
  liga: Liga;
  clubes: Clube[];
  clubeId: string;
  origem: EstadoCarreira["origem"];
  seed: string;
  dataInicio: string;
  /** Outras ligas já importadas para o mundo paralelo. */
  ligasMundo?: Liga[];
  clubesMundo?: Clube[];
}

export function criarCarreira(entrada: EntradaCarreira): EstadoCarreira {
  const identidade = esquemaIdentidade.parse(entrada.identidade),
    clubeEntrada = entrada.clubes.find((c) => c.id === entrada.clubeId);
  if (!clubeEntrada || entrada.clubes.length < 2)
    throw new Error("Selecione um clube de uma liga válida.");

  const clubesPrincipais = prepararClubesParaMundo(
    entrada.clubes,
    entrada.liga,
  );
  const ligasExtra = (entrada.ligasMundo ?? []).filter(
    (l) => l.id !== entrada.liga.id,
  );
  const clubesExtra = (entrada.clubesMundo ?? [])
    .filter((c) => c.ligaId !== entrada.liga.id)
    .flatMap((c) => {
      const liga = ligasExtra.find((l) => l.id === c.ligaId);
      if (!liga) return [];
      return prepararClubesParaMundo([c], liga);
    });

  const clubes = [...clubesPrincipais, ...clubesExtra];
  const ligas = [entrada.liga, ...ligasExtra];
  const clube = clubes.find((c) => c.id === entrada.clubeId)!;

  const aleatorio = new GeradorAleatorio(gerarSeedNumerica(entrada.seed)),
    categoria = determinarCategoriaInicial(identidade.idade);
  const atributos = criarAtributosUniformes(40),
    base = identidade.idade < 17 ? 49 : identidade.idade < 20 ? 59 : 65;
  const destaques: Record<IdentidadeJogador["arquetipo"], Atributo[]> = {
    artilheiro: ["finalizacao", "compostura", "cabeceio"],
    criador: ["visao", "passeCurto", "passeLongo"],
    velocista: ["velocidade", "aceleracao", "drible"],
    marcador: ["desarme", "marcacao", "forca"],
    equilibrado: [],
    paredao: ["reflexos", "defesaGoleiro", "saida"],
  };
  for (const atributo of Object.keys(atributos) as Atributo[])
    atributos[atributo] = limitar(
      base +
        aleatorio.inteiro(-12, 8) +
        (PESOS_POSICOES[identidade.posicao][atributo] ? 7 : 0) +
        (destaques[identidade.arquetipo].includes(atributo) ? 7 : 0),
      1,
      99,
    );
  const overall = calcularOverall(atributos, identidade.posicao);
  const ano = Number(entrada.dataInicio.slice(0, 4));
  const carreira: EstadoCarreira = {
    versao: 2,
    id: entrada.seed,
    seed: entrada.seed,
    estadoAleatorio: 0,
    dataAtual: entrada.dataInicio,
    dataInicio: entrada.dataInicio,
    identidadeInicial: identidade,
    clubeInicialId: clube.id,
    clubeAtualId: clube.id,
    liga: entrada.liga,
    ligas,
    clubes,
    origem: entrada.origem,
    jogador: {
      ...identidade,
      atributos,
      desenvolvimento: criarAtributosUniformes(0),
      overall,
      potencialInterno: Math.max(overall, aleatorio.inteiro(68, 94)),
      personalidade: {
        profissionalismo: aleatorio.inteiro(35, 95),
        ambicao: aleatorio.inteiro(30, 95),
        lealdade: aleatorio.inteiro(30, 95),
        disciplina: aleatorio.inteiro(35, 95),
        temperamento: aleatorio.inteiro(30, 95),
        adaptabilidade: aleatorio.inteiro(30, 95),
        lideranca: aleatorio.inteiro(25, 90),
      },
      categoria,
      status: categoria === "base" ? "categoria de base" : "reserva",
      moral: 70,
      forma: 55,
      condicionamento: 95,
      fadiga: 8,
      ritmo: 40,
      confianca: 50,
      reputacao: 10,
      valorMercado: 0,
      contrato: {
        clubeId: clube.id,
        salario: categoria === "base" ? 150 : Math.round(overall * 25),
        dataInicio: entrada.dataInicio,
        dataTermino: somarDias(entrada.dataInicio, 730),
        papelEsperado: categoria === "base" ? "categoria de base" : "rotacao",
        tipo: categoria,
        bonusGol: 0,
      },
      lesao: null,
      suspensao: 0,
      amarelosAcumulados: 0,
      notasRecentes: [],
    },
    temporada: criarTemporada(clubesPrincipais, ano, entrada.dataInicio),
    temporadasExternas: criarTemporadasExternas(
      ligas,
      entrada.liga.id,
      clubes,
      ano,
      entrada.dataInicio,
    ),
    focoTreino: "equilibrado",
    mercado: criarMercado(),
    propostas: [],
    transferenciasRecentes: [],
    janelaTransferencias: resolverJanela(entrada.dataInicio),
    relacionamentos: { treinador: 50, diretoria: 50, agente: 60 },
    decisoes: [],
    noticias: [],
    eventos: [],
    objetivos: [
      {
        id: "jogos",
        titulo: "Participar de 5 jogos",
        meta: 5,
        progresso: 0,
        concluido: false,
      },
      {
        id: "gol",
        titulo: "Marcar o primeiro gol",
        meta: 1,
        progresso: 0,
        concluido: false,
      },
      {
        id: "assistencia",
        titulo: "Dar a primeira assistência",
        meta: 1,
        progresso: 0,
        concluido: false,
      },
      {
        id: "confianca",
        titulo: "Conquistar a confiança da comissão",
        meta: 75,
        progresso: 50,
        concluido: false,
      },
    ],
    registros: [],
    temporadasAnteriores: [],
    ultimaPartidaId: null,
  };
  carreira.jogador.valorMercado = calcularValorMercado(
    carreira.jogador,
    carreira.liga,
    carreira.dataAtual,
  );
  registrarEvento(
    carreira,
    "inicio",
    `${identidade.nome} chega ao ${clube.nome}`,
    categoria === "base"
      ? "Seu lugar é na base. Treine, conquiste minutos e mostre à comissão que está pronto."
      : "Uma nova etapa no elenco profissional. Sua escalação depende do que você mostrar.",
    "Treinador",
  );
  carreira.estadoAleatorio = aleatorio.estado;
  return carreira;
}
