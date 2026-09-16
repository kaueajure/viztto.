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
      ligaId: liga.id,
      nome,
      codigo: nome
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3),
      pais: liga.pais,
      fundacao: 1920 + indice * 7,
      escudo: "",
      estadio: `Estádio ${nome.replace(/^(Clube|Atlético|Esportivo) /, "")}`,
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
    };
  });
}
