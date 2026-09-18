import type { Clube, Liga, Posicao } from "@/dominio/entidades/modelos";
import { criarTreinador } from "@/dominio/mundo-futebol";
import { estatisticasVazias } from "@/dominio/jogador-mundo";
import { overallAlvoDeMercado, potencialDe } from "@/dominio/regras/rating-mercado";
import { mediaPonderadaTitulares } from "@/simulacao/elenco/forca-escalacao";
import { gerarSeedNumerica, GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";

const POSICOES_DEMO: Posicao[] = [
  "GOL",
  "GOL",
  "LD",
  "ZAG",
  "ZAG",
  "LE",
  "VOL",
  "MC",
  "MC",
  "MEI",
  "PD",
  "PE",
  "CA",
  "CA",
  "MC",
  "ZAG",
];

export function gerarClubesDemonstracao(liga: Liga): Clube[] {
  return [
    "Atlético Aurora",
    "União Portuária",
    "Esportivo Vale",
    "Ferroviário Central",
    "Estrela do Norte",
    "Real Serrano",
    "Nacional da Ilha",
    "Clube Horizonte",
  ].map((nome, indice) => {
    const aleatorio = new GeradorAleatorio(
      gerarSeedNumerica(`${liga.id}-${indice}`),
    );
    // Prestígio demo: variação estável por clube, sem virar “força do elenco”.
    const reputacao = Math.round(
      limitar(liga.reputacao + aleatorio.inteiro(-8, 6) - indice, 45, 99),
    );
    const id = `demo-${liga.id}-${indice}`;
    const formacaoPreferida = "4-3-3" as const;
    const valoresBase = [
      25_000_000, 18_000_000, 12_000_000, 9_000_000, 7_000_000, 5_000_000,
      4_000_000, 3_500_000, 3_000_000, 2_500_000, 2_000_000, 1_500_000,
      1_200_000, 900_000, 600_000, 400_000,
    ].map((v) => Math.round(v * (0.55 + liga.forcaMedia / 200)));

    const elenco = POSICOES_DEMO.map((pos, i) => {
      const idade = aleatorio.inteiro(18, 34);
      const valorMercado = valoresBase[i] ?? 300_000;
      const overall = overallAlvoDeMercado({
        posicao: pos,
        idade,
        valorMercado,
        reputacaoLiga: liga.reputacao,
        indiceNoElenco: i,
        tamanhoElenco: POSICOES_DEMO.length,
      });
      const potencial = potencialDe(overall, idade, valorMercado);
      return {
        id: `${id}-j${i}`,
        idExterno: -(indice * 100 + i + 1),
        idTransfermarkt: `${id}-${i}`,
        nome: `Jogador ${nome.split(" ").slice(-1)[0]} ${i + 1}`,
        dataNascimento: null,
        idade,
        nacionalidade: [liga.pais],
        posicaoPrincipal: pos,
        posicoesSecundarias: [] as Posicao[],
        posicao: pos,
        grupoPosicao:
          pos === "GOL"
            ? ("GOL" as const)
            : ["LD", "ZAG", "LE"].includes(pos)
              ? ("DEF" as const)
              : ["VOL", "MC", "MEI"].includes(pos)
                ? ("MEI" as const)
                : ("ATA" as const),
        peDominante: "direito",
        altura: 175 + aleatorio.inteiro(0, 20),
        numero: i + 1,
        clubeId: id,
        overall,
        potencial,
        forma: 55,
        moral: 60,
        condicionamento: 85,
        fadiga: 10,
        valorMercado,
        salario: overall * 40,
        contratoAte: null,
        joinedOn: null,
        signedFrom: null,
        foto: "",
        lesionado: false,
        lesao: null,
        suspensao: 0,
        statusElenco: i < 11 ? ("titular" as const) : ("reserva" as const),
        estatisticasCarreira: estatisticasVazias(),
      };
    });

    const titulares = elenco.slice(0, 11);
    const banco = elenco.slice(11, 18);
    const forcaTitulares = mediaPonderadaTitulares(titulares.map((j) => j.overall));
    const forcaBanco =
      banco.reduce((s, j) => s + j.overall, 0) / Math.max(1, banco.length);
    const forcaGeral = Math.round(forcaTitulares * 0.9 + forcaBanco * 0.1);
    const mediaPos = (pred: (p: Posicao) => boolean) => {
      const xs = titulares.filter((j) => pred(j.posicaoPrincipal));
      return xs.length
        ? Math.round(xs.reduce((s, j) => s + j.overall, 0) / xs.length)
        : forcaGeral;
    };

    return {
      id,
      idExterno: -(indice + 1),
      idTransfermarkt: `demo-${indice}`,
      ligaId: liga.id,
      nome,
      nomeCurto: nome.split(" ").slice(-1)[0] ?? nome,
      nomeOficial: nome,
      codigo: nome
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3),
      pais: liga.pais,
      fundacao: 1920 + indice * 7,
      escudo: "",
      estadio: `Estádio ${nome.replace(/^(Clube|Atlético|Esportivo) /, "")}`,
      capacidadeEstadio: 20000 + indice * 3000,
      tamanhoElenco: elenco.length,
      idadeMedia: 26,
      valorElenco: elenco.reduce((s, j) => s + j.valorMercado, 0),
      registroTransferencias: null,
      formacaoPreferida,
      goleiroTitularId: elenco[0]!.id,
      titularesIds: elenco.slice(1, 11).map((j) => j.id),
      bancoIds: elenco.slice(11).map((j) => j.id),
      treinador: criarTreinador(id, formacaoPreferida, liga.id),
      reputacao,
      forcaGeral,
      forcaAtaque: mediaPos((p) => ["CA", "PD", "PE"].includes(p)),
      forcaMeio: mediaPos((p) => ["VOL", "MC", "MEI"].includes(p)),
      forcaDefesa: mediaPos((p) => ["GOL", "ZAG", "LD", "LE"].includes(p)),
      qualidadeBase: aleatorio.inteiro(45, 90),
      poderFinanceiro: Math.round(reputacao * 0.55 + forcaGeral * 0.45),
      orcamento: Math.round((reputacao * 0.55 + forcaGeral * 0.45) * 1_000_000),
      forma: 50,
      moral: 60,
      fadiga: 10,
      elenco,
      dadosBrutos: null,
    };
  });
}
