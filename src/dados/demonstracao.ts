import type { Clube, Liga } from "@/dominio/entidades/modelos";
import { gerarSeedNumerica, GeradorAleatorio } from "@/utilitarios/aleatorio";

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
    return {
      id: `demo-${liga.id}-${indice}`,
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
      tamanhoElenco: 0,
      idadeMedia: null,
      valorElenco: null,
      registroTransferencias: null,
      formacaoPreferida: "4-3-3" as const,
      goleiroTitularId: null,
      titularesIds: [],
      reputacao: forca,
      forcaGeral: forca,
      forcaAtaque: forca + aleatorio.inteiro(-4, 4),
      forcaMeio: forca + aleatorio.inteiro(-4, 4),
      forcaDefesa: forca + aleatorio.inteiro(-4, 4),
      qualidadeBase: aleatorio.inteiro(45, 90),
      poderFinanceiro: forca,
      forma: 50,
      moral: 60,
      fadiga: 10,
      elenco: [],
      dadosBrutos: null,
    };
  });
}
