import type {
  Atributos,
  Clube,
  Escalacao,
  Jogador,
  Partida,
  Participacao,
  Posicao,
  StatusElenco,
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

function fatorEstadoJogador(jogador: Jogador): number {
  return (
    (0.75 + jogador.forma / 400) *
    (0.9 + jogador.moral / 1000) *
    (0.85 + jogador.condicionamento / 700) *
    (1 - jogador.fadiga / 250)
  );
}

/** Qualidade setorial bruta a partir dos atributos da posição (criação/conversão/defesa). */
export function qualidadeSetorialJogador(jogador: Jogador): {
  ataque: number;
  meio: number;
  defesa: number;
} {
  const a = jogador.atributos;

  switch (jogador.posicao) {
    case "GOL":
      return {
        ataque: 28,
        meio: 32,
        defesa:
          (a.reflexos * 2.2 +
            a.defesaGoleiro * 2.2 +
            a.posicionamentoGoleiro * 1.4 +
            a.agilidade +
            a.concentracao) /
          7.8,
      };
    case "CA":
      return {
        ataque:
          (a.finalizacao * 3 + a.posicionamento * 2 + a.compostura * 2 + a.cabeceio) /
          8,
        meio: (a.passeCurto + a.visao + a.dominio) / 3,
        defesa: (a.forca + a.antecipacao) / 2,
      };
    case "PD":
    case "PE":
      return {
        ataque:
          (a.finalizacao * 2 + a.drible * 2 + a.cruzamento + a.velocidade * 1.5) /
          6.5,
        meio: (a.passeCurto + a.visao + a.cruzamento) / 3,
        defesa: (a.aceleracao + a.resistencia) / 2,
      };
    case "MEI":
      return {
        ataque: (a.finalizacao + a.drible + a.posicionamento) / 3,
        meio:
          (a.visao * 3 + a.passeCurto * 2 + a.decisao * 1.5 + a.dominio) / 7.5,
        defesa: (a.antecipacao + a.desarme) / 2,
      };
    case "MC":
      return {
        ataque: (a.finalizacao + a.passeLongo) / 2,
        meio:
          (a.passeCurto * 2.5 + a.visao * 2 + a.passeLongo * 1.5 + a.decisao) / 7,
        defesa: (a.desarme + a.resistencia + a.antecipacao) / 3,
      };
    case "VOL":
      return {
        ataque: (a.passeCurto + a.finalizacao) / 2,
        meio: (a.passeCurto + a.visao + a.decisao) / 3,
        defesa:
          (a.desarme * 2 + a.marcacao * 2 + a.antecipacao * 1.5 + a.forca) / 6.5,
      };
    case "ZAG":
      return {
        ataque: (a.cabeceio + a.passeCurto) / 2,
        meio: (a.passeCurto + a.passeLongo) / 2,
        defesa:
          (a.marcacao * 2.5 +
            a.desarme * 2 +
            a.antecipacao * 1.5 +
            a.forca +
            a.cabeceio) /
          8,
      };
    case "LD":
    case "LE":
      return {
        ataque: (a.cruzamento * 1.5 + a.velocidade + a.passeCurto) / 3.5,
        meio: (a.passeCurto + a.cruzamento + a.resistencia) / 3,
        defesa:
          (a.desarme * 2 + a.marcacao * 1.5 + a.antecipacao + a.velocidade) / 5.5,
      };
    default:
      return {
        ataque: jogador.overall,
        meio: jogador.overall,
        defesa: jogador.overall,
      };
  }
}

function pesosSetor(posicao: Posicao): {
  ataque: number;
  meio: number;
  defesa: number;
} {
  if (posicao === "GOL") return { ataque: 0.04, meio: 0.05, defesa: 0.42 };
  if (["CA", "PD", "PE"].includes(posicao))
    return { ataque: 0.34, meio: 0.12, defesa: 0.06 };
  if (posicao === "MEI") return { ataque: 0.18, meio: 0.32, defesa: 0.08 };
  if (posicao === "MC") return { ataque: 0.1, meio: 0.3, defesa: 0.12 };
  if (posicao === "VOL") return { ataque: 0.06, meio: 0.18, defesa: 0.26 };
  if (posicao === "ZAG") return { ataque: 0.05, meio: 0.08, defesa: 0.34 };
  return { ataque: 0.12, meio: 0.16, defesa: 0.24 }; // laterais
}

/**
 * Contribuição setorial ponderada por minutos no slot.
 * Titular A 60' + reserva B 30' ≈ A*(60/90) + B*(30/90).
 *
 * `substituido`: jogador NPC que saiu (overall/attrs); se omitido no banco,
 * usa a média do setor do clube como proxy do titular removido.
 */
export function ajustarClubePeloJogador(
  clube: Clube,
  jogador: Jogador,
  minutos: number,
  jaNaEscalacao: boolean,
  substituido?: { overall: number; atributos?: Atributos; posicao?: Posicao } | null,
): Clube {
  if (minutos <= 0 && !jaNaEscalacao) return clube;

  const prop = limitar(minutos / 90, 0, 1);
  const propRestante = 1 - prop;
  const fator = fatorEstadoJogador(jogador);
  const q = qualidadeSetorialJogador(jogador);
  const pesos = pesosSetor(jogador.posicao);
  const ataqueUser = q.ataque * fator;
  const meioUser = q.meio * fator;
  const defesaUser = q.defesa * fator;
  const refUser = jogador.overall * fator;

  let dAtaque: number;
  let dMeio: number;
  let dDefesa: number;

  if (jaNaEscalacao) {
    // Já embutido com overall×90': troca por qualidade×minutos (tempo fora sai do slot).
    dAtaque = (ataqueUser * prop - refUser) * pesos.ataque;
    dMeio = (meioUser * prop - refUser) * pesos.meio;
    dDefesa = (defesaUser * prop - refUser) * pesos.defesa;
  } else {
    // Banco: força ainda contém o titular substituído por 90'.
    // Slot efetivo = substituído*(1-prop) + usuário*prop.
    const ovSub = substituido?.overall ?? clube.forcaGeral;
    const qSub = substituido?.atributos
      ? qualidadeSetorialDeAtributos(
          substituido.atributos,
          substituido.posicao ?? jogador.posicao,
          ovSub,
        )
      : { ataque: ovSub, meio: ovSub, defesa: ovSub };
    const ataqueSlot = qSub.ataque * propRestante + ataqueUser * prop;
    const meioSlot = qSub.meio * propRestante + meioUser * prop;
    const defesaSlot = qSub.defesa * propRestante + defesaUser * prop;
    dAtaque = (ataqueSlot - ovSub) * pesos.ataque;
    dMeio = (meioSlot - ovSub) * pesos.meio;
    dDefesa = (defesaSlot - ovSub) * pesos.defesa;
  }

  return {
    ...clube,
    forcaAtaque: limitar(clube.forcaAtaque + dAtaque, 35, 99),
    forcaMeio: limitar(clube.forcaMeio + dMeio, 35, 99),
    forcaDefesa: limitar(clube.forcaDefesa + dDefesa, 35, 99),
  };
}

function qualidadeSetorialDeAtributos(
  a: Atributos,
  posicao: Posicao,
  fallback: number,
): { ataque: number; meio: number; defesa: number } {
  return qualidadeSetorialJogador({
    posicao,
    overall: fallback,
    atributos: a,
  } as Jogador);
}

/** NPC titular mais próximo da posição do usuário (proxy do substituído). */
export function aproximarTitularSubstituido(
  clube: Clube,
  posicao: Posicao,
): { overall: number; atributos?: Atributos; posicao?: Posicao } | null {
  const ids = [
    ...(clube.goleiroTitularId ? [clube.goleiroTitularId] : []),
    ...clube.titularesIds,
  ].filter((id) => id !== "usuario");
  const elenco = clube.elenco;
  const candidatos = ids
    .map((id) => elenco.find((j) => j.id === id))
    .filter(Boolean);
  if (!candidatos.length) return null;
  const mesmoGrupo = candidatos.filter(
    (j) => j!.posicaoPrincipal === posicao || j!.posicoesSecundarias.includes(posicao),
  );
  const escolhido = (mesmoGrupo[0] ?? candidatos[0])!;
  return {
    overall: escolhido.overall,
    atributos: escolhido.atributos,
    posicao: escolhido.posicaoPrincipal,
  };
}

const BONUS_STATUS_ENTRADA: Record<StatusElenco, number> = {
  "estrela do time": 0.28,
  "jogador importante": 0.22,
  titular: 0.18,
  rotacao: 0.14,
  promessa: 0.12,
  reserva: 0.02,
  "categoria de base": -0.06,
};

/**
 * Chance de um reserva entrar — varia por posição, papel, confiança,
 * fadiga/forma do elenco, rotação do treinador e necessidade pré-jogo.
 * Goleiros permanecem em faixa bem mais baixa.
 */
export function chanceEntradaBanco(
  jogador: Jogador,
  clube: Clube,
  oponente: Clube,
): number {
  if (jogador.posicao === "GOL") {
    return limitar(
      0.045 +
        clube.fadiga * 0.0012 +
        Math.max(0, clube.treinador.rotacao - 70) * 0.0006,
      0.02,
      0.14,
    );
  }

  let chance = 0.3 + (BONUS_STATUS_ENTRADA[jogador.status] ?? 0);
  chance += (jogador.confianca - 50) * 0.0025;
  chance += clube.fadiga * 0.005;
  chance += (50 - clube.forma) * 0.0015;
  chance += (50 - clube.moral) * 0.001;
  chance += (clube.treinador.rotacao - 50) * 0.0035;

  if (jogador.idade <= 21 || jogador.status === "promessa") {
    chance += 0.06 + clube.treinador.preferenciaJovens * 0.0015;
  }

  if (["CA", "PD", "PE", "MEI"].includes(jogador.posicao)) chance += 0.08;
  else if (["MC", "VOL"].includes(jogador.posicao)) chance += 0.04;
  else if (jogador.posicao === "ZAG") chance -= 0.06;
  else if (["LD", "LE"].includes(jogador.posicao)) chance += 0.02;

  // Necessidade tática pré-jogo (adversário mais forte → buscar impacto).
  chance += limitar(
    (oponente.forcaGeral - clube.forcaGeral) * 0.008,
    -0.08,
    0.12,
  );

  return limitar(chance, 0.08, 0.92);
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
  opcoesEscalacao?: { escalacaoPreparada?: Escalacao; elencoProfissional?: boolean },
): Partida {
  if (partida.golsMandante !== null) return partida;

  const resultado: Partida = {
    ...partida,
    eventos: [],
    golsMandante: null,
    golsVisitante: null,
  };

  let mandanteEfetivo = mandante;
  let visitanteEfetivo = visitante;

  if (jogador && clubeJogadorId) {
    const clube = clubeJogadorId === mandante.id ? mandante : visitante;
    const oponente = clubeJogadorId === mandante.id ? visitante : mandante;
    const escalacao = determinarEscalacao(
      jogador,
      clube,
      aleatorio,
      incentivo,
      opcoesEscalacao,
    );
    const entrada =
      escalacao === "titular"
        ? 0
        : escalacao === "banco" &&
            aleatorio.chance(chanceEntradaBanco(jogador, clube, oponente))
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

    const jaNaEscalacao =
      clube.titularesIds.includes("usuario") ||
      clube.goleiroTitularId === "usuario";
    const substituido = !jaNaEscalacao
      ? aproximarTitularSubstituido(clube, jogador.posicao)
      : null;
    const clubeAjustado = ajustarClubePeloJogador(
      clube,
      jogador,
      minutos,
      jaNaEscalacao,
      substituido,
    );
    if (clubeJogadorId === mandante.id) mandanteEfetivo = clubeAjustado;
    else visitanteEfetivo = clubeAjustado;
  }

  const momento = partida.rodada / 40;
  resultado.golsMandante = aleatorio.poisson(
    calcularGolsEsperados(mandanteEfetivo, visitanteEfetivo, true, momento),
  );
  resultado.golsVisitante = aleatorio.poisson(
    calcularGolsEsperados(visitanteEfetivo, mandanteEfetivo, false, momento),
  );

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
