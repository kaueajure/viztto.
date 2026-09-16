import type {
  Clube,
  Jogador,
  Partida,
  Participacao,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import { determinarEscalacao } from "./escalacao";
export function calcularGolsEsperados(
  ataque: Clube,
  defesa: Clube,
  mandante: boolean,
  momento = 0,
): number {
  const diferenca =
    (ataque.forcaAtaque - defesa.forcaDefesa) * 0.034 +
    (ataque.forcaMeio - defesa.forcaMeio) * 0.014;
  const estado =
    (ataque.forma - defesa.forma) * 0.003 +
    (ataque.moral - 50) * 0.002 -
    ataque.fadiga * 0.003;
  return limitar(
    (mandante ? 1.48 : 1.1) * Math.exp(diferenca + estado + momento * 0.025),
    0.15,
    4.8,
  );
}
export function calcularNotaJogador(
  p: Participacao,
  posicao: Jogador["posicao"],
  sofridos: number,
  qualidade: number,
): number {
  const defensivo = ["ZAG", "LD", "LE", "VOL"].includes(posicao);
  const bonus =
    posicao === "GOL"
      ? Math.min(1.7, p.defesas * 0.18) +
        (sofridos === 0 ? 0.65 : -sofridos * 0.2)
      : defensivo
        ? Math.min(1.3, p.desarmes * 0.16) +
          (sofridos === 0 ? 0.45 : -sofridos * 0.08)
        : p.passesChave * 0.1;
  return (
    Math.round(
      limitar(
        6 +
          qualidade +
          p.gols * 0.85 +
          p.assistencias * 0.55 +
          bonus -
          p.amarelos * 0.25 -
          p.vermelhos * 1.4,
        3,
        10,
      ) * 10,
    ) / 10
  );
}
export function simularPartida(
  partida: Partida,
  mandante: Clube,
  visitante: Clube,
  aleatorio: GeradorAleatorio,
  jogador?: Jogador,
  clubeJogadorId?: string,
  incentivo = 0,
): Partida {
  if (partida.golsMandante !== null) return partida;
  const resultado: Partida = {
    ...partida,
    eventos: [],
    golsMandante: aleatorio.poisson(
      calcularGolsEsperados(mandante, visitante, true, partida.rodada / 40),
    ),
    golsVisitante: aleatorio.poisson(
      calcularGolsEsperados(visitante, mandante, false, partida.rodada / 40),
    ),
  };
  if (jogador && clubeJogadorId) {
    const clube = clubeJogadorId === mandante.id ? mandante : visitante;
    const escalacao = determinarEscalacao(jogador, clube, aleatorio, incentivo);
    const entrada =
      escalacao === "titular"
        ? 0
        : escalacao === "banco" &&
            aleatorio.chance(jogador.posicao === "GOL" ? 0.07 : 0.65)
          ? aleatorio.chance(0.035)
            ? aleatorio.inteiro(15, 44)
            : aleatorio.inteiro(55, 85)
          : 90;
    let saida =
      entrada === 90
        ? 90
        : escalacao === "titular"
          ? aleatorio.inteiro(60, 90)
          : 90;
    const amarelos =
      entrada < 90 &&
      aleatorio.chance(
        0.055 +
          (100 - jogador.personalidade.disciplina) * 0.001 +
          jogador.atributos.agressividade * 0.0007,
      )
        ? 1
        : 0;
    const vermelhos =
      entrada < 90 &&
      aleatorio.chance(
        0.002 + (100 - jogador.personalidade.temperamento) * 0.00008,
      )
        ? 1
        : 0;
    if (vermelhos) saida = aleatorio.inteiro(entrada + 1, saida);
    const minutos = saida - entrada,
      proporcao = minutos / 90;
    const p: Participacao = {
      escalacao,
      entrada,
      saida,
      minutos,
      gols: 0,
      assistencias: 0,
      chutes: 0,
      passes: Math.round(aleatorio.inteiro(20, 65) * proporcao),
      passesChave: 0,
      desarmes: 0,
      amarelos,
      vermelhos,
      faltas: Math.round(aleatorio.inteiro(0, 4) * proporcao),
      defesas: 0,
      nota: null,
      confianca: 0,
      moral: 0,
      desenvolvimento: 0,
    };
    resultado.participacao = p;
  }
  for (const [clube, gols] of [
    [mandante, resultado.golsMandante!],
    [visitante, resultado.golsVisitante!],
  ] as const) {
    for (let indice = 0; indice < gols; indice++) {
      const minuto = aleatorio.inteiro(1, 90),
        p = resultado.participacao;
      const emCampo =
        p &&
        clube.id === clubeJogadorId &&
        minuto > p.entrada &&
        minuto <= p.saida;
      const ofensivo =
        jogador && ["CA", "PD", "PE", "MEI"].includes(jogador.posicao);
      const chanceGol =
        jogador?.posicao === "GOL" ? 0.001 : ofensivo ? 0.24 : 0.055;
      const golJogador =
        !!emCampo &&
        aleatorio.chance(
          chanceGol * (0.6 + (jogador?.atributos.finalizacao ?? 50) / 120),
        );
      const assistencia =
        !!emCampo &&
        !golJogador &&
        aleatorio.chance(
          jogador?.posicao === "GOL"
            ? 0.008
            : (0.14 * (jogador?.atributos.visao ?? 50)) / 65,
        );
      if (p) {
        if (golJogador) p.gols++;
        if (assistencia) p.assistencias++;
      }
      resultado.eventos.push({
        minuto,
        tipo: "gol",
        clubeId: clube.id,
        jogador: golJogador || assistencia,
        texto: golJogador
          ? `Gol de ${jogador!.nome}!`
          : assistencia
            ? `Gol de ${clube.codigo}. Assistência de ${jogador!.nome}.`
            : `Gol de ${clube.nome}`,
      });
    }
  }
  const p = resultado.participacao;
  if (p && jogador && p.minutos > 0) {
    const proporcao = p.minutos / 90,
      defensivo = ["ZAG", "LD", "LE", "VOL"].includes(jogador.posicao);
    p.chutes = Math.max(
      p.gols,
      Math.round(
        aleatorio.inteiro(
          0,
          ["CA", "PD", "PE"].includes(jogador.posicao)
            ? 6
            : jogador.posicao === "GOL"
              ? 0
              : 3,
        ) * proporcao,
      ),
    );
    p.passesChave = Math.max(
      p.assistencias,
      Math.round(
        aleatorio.inteiro(
          0,
          ["MC", "MEI", "PD", "PE"].includes(jogador.posicao) ? 5 : 2,
        ) * proporcao,
      ),
    );
    p.desarmes = Math.round(
      aleatorio.inteiro(0, defensivo ? 9 : 3) * proporcao,
    );
    p.defesas =
      jogador.posicao === "GOL"
        ? Math.round(aleatorio.inteiro(1, 10) * proporcao)
        : 0;
    const sofridos =
      clubeJogadorId === mandante.id
        ? resultado.golsVisitante!
        : resultado.golsMandante!;
    p.nota = calcularNotaJogador(
      p,
      jogador.posicao,
      sofridos,
      (aleatorio.proximo() - 0.5) * 1.3 + (jogador.forma - 50) * 0.006,
    );
    p.confianca = Math.round((p.nota - 6.5) * 3);
    p.moral = Math.round((p.nota - 6.4) * 2);
    if (p.amarelos)
      resultado.eventos.push({
        minuto: aleatorio.inteiro(p.entrada + 1, p.saida),
        tipo: "cartao",
        clubeId: clubeJogadorId!,
        jogador: true,
        texto: `Amarelo para ${jogador.nome}`,
      });
    if (p.vermelhos)
      resultado.eventos.push({
        minuto: p.saida,
        tipo: "cartao",
        clubeId: clubeJogadorId!,
        jogador: true,
        texto: `Vermelho para ${jogador.nome}`,
      });
    if (p.entrada > 0)
      resultado.eventos.push({
        minuto: p.entrada,
        tipo: "substituicao",
        clubeId: clubeJogadorId!,
        jogador: true,
        texto: `${jogador.nome} entra em campo`,
      });
    if (p.saida < 90 && !p.vermelhos)
      resultado.eventos.push({
        minuto: p.saida,
        tipo: "substituicao",
        clubeId: clubeJogadorId!,
        jogador: true,
        texto: `${jogador.nome} é substituído`,
      });
    if (p.defesas)
      resultado.eventos.push({
        minuto: aleatorio.inteiro(p.entrada + 1, p.saida),
        tipo: "defesa",
        clubeId: clubeJogadorId!,
        jogador: true,
        texto: `Grande defesa de ${jogador.nome}`,
      });
  }
  resultado.eventos.push({
    minuto: 93,
    tipo: "fim",
    clubeId: "",
    jogador: false,
    texto: "Fim de jogo",
  });
  resultado.eventos.sort((a, b) => a.minuto - b.minuto);
  return resultado;
}
