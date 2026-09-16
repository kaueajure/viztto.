import type { Clube, Liga, Posicao } from "@/dominio/entidades/modelos";
import { criarTreinador } from "@/dominio/mundo-futebol";
import { estatisticasVazias, mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
import { gerarSeedNumerica, GeradorAleatorio } from "@/utilitarios/aleatorio";

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
      ),
      forca = liga.forcaMedia + aleatorio.inteiro(-14, 10);
    const id = `demo-${liga.id}-${indice}`;
    const formacaoPreferida = "4-3-3" as const;
    const elenco = POSICOES_DEMO.map((pos, i) => {
      const overall = forca + aleatorio.inteiro(-8, 6) - Math.floor(i / 4);
      return {
        id: `${id}-j${i}`,
        idExterno: -(indice * 100 + i + 1),
        idTransfermarkt: `demo-${indice}-${i}`,
        nome: `Jogador ${nome.split(" ").slice(-1)[0]} ${i + 1}`,
        dataNascimento: null,
        idade: aleatorio.inteiro(18, 34),
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
        potencial: overall + aleatorio.inteiro(0, 8),
        forma: 55,
        moral: 60,
        condicionamento: 85,
        fadiga: 10,
        valorMercado: Math.round(80_000 * Math.exp((overall - 55) * 0.1)),
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
    void mapearPosicaoPrincipal;
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
      reputacao: forca,
      forcaGeral: forca,
      forcaAtaque: forca + aleatorio.inteiro(-4, 4),
      forcaMeio: forca + aleatorio.inteiro(-4, 4),
      forcaDefesa: forca + aleatorio.inteiro(-4, 4),
      qualidadeBase: aleatorio.inteiro(45, 90),
      poderFinanceiro: forca,
      orcamento: forca * 1_000_000,
      forma: 50,
      moral: 60,
      fadiga: 10,
      elenco,
      dadosBrutos: null,
    };
  });
}
