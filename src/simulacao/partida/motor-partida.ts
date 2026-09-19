import type {
  Atributos,
  Clube,
  Jogador,
  Partida,
  Participacao,
  Posicao,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import {
  simularPartidaCausal,
  type OpcoesMotorCausal,
} from "./motor-causal";

export type { OpcoesMotorCausal };

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

export type ParceiroSlot = {
  overall: number;
  atributos?: Atributos;
  posicao?: Posicao;
};

/**
 * Contribuição setorial ponderada por minutos no slot.
 * slot = titular*(minutosTitular/90) + substituto*(minutosSubstituto/90)
 *
 * `parceiroNoSlot`:
 * - titular que sai cedo → reserva entrante (via aproximarReservaEntrante);
 * - reserva que entra → titular substituído (via aproximarTitularSubstituido);
 * - omitido → proxy `clube.forcaGeral`.
 *
 * Baseline embutida na força do clube: overall do usuário (titular) ou do
 * parceiro (banco). Evita double-counting: só um parceiro por ajuste.
 */
export function ajustarClubePeloJogador(
  clube: Clube,
  jogador: Jogador,
  minutos: number,
  jaNaEscalacao: boolean,
  parceiroNoSlot?: ParceiroSlot | null,
): Clube {
  if (minutos <= 0 && !jaNaEscalacao) return clube;

  const prop = limitar(minutos / 90, 0, 1);
  const fator = fatorEstadoJogador(jogador);
  const q = qualidadeSetorialJogador(jogador);
  const pesos = pesosSetor(jogador.posicao);
  const ataqueUser = q.ataque * fator;
  const meioUser = q.meio * fator;
  const defesaUser = q.defesa * fator;
  const refUser = jogador.overall * fator;

  const { ataque, meio, defesa, overall } = resolverContribuicaoSlot(
    { ataque: ataqueUser, meio: meioUser, defesa: defesaUser },
    prop,
    parceiroNoSlot,
    jogador.posicao,
    clube.forcaGeral,
  );

  // Titular: clube já embute overall×90' do usuário.
  // Banco: clube ainda embute o titular substituído (parceiro) por 90'.
  const baseline = jaNaEscalacao ? refUser : overall;

  return {
    ...clube,
    forcaAtaque: limitar(clube.forcaAtaque + (ataque - baseline) * pesos.ataque, 35, 99),
    forcaMeio: limitar(clube.forcaMeio + (meio - baseline) * pesos.meio, 35, 99),
    forcaDefesa: limitar(clube.forcaDefesa + (defesa - baseline) * pesos.defesa, 35, 99),
  };
}

/** Slot efetivo = user*prop + parceiro*(1-prop). */
export function resolverContribuicaoSlot(
  user: { ataque: number; meio: number; defesa: number },
  propMinutos: number,
  parceiro: ParceiroSlot | null | undefined,
  posicaoFallback: Posicao,
  ovFallback: number,
): { ataque: number; meio: number; defesa: number; overall: number } {
  const prop = limitar(propMinutos, 0, 1);
  const resto = 1 - prop;
  const ovParceiro = parceiro?.overall ?? ovFallback;
  const qParceiro = parceiro?.atributos
    ? qualidadeSetorialDeAtributos(
        parceiro.atributos,
        parceiro.posicao ?? posicaoFallback,
        ovParceiro,
      )
    : { ataque: ovParceiro, meio: ovParceiro, defesa: ovParceiro };
  return {
    ataque: user.ataque * prop + qParceiro.ataque * resto,
    meio: user.meio * prop + qParceiro.meio * resto,
    defesa: user.defesa * prop + qParceiro.defesa * resto,
    overall: ovParceiro,
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
): ParceiroSlot | null {
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

/**
 * NPC reserva plausível para cobrir o slot quando o usuário (titular) sai.
 * Ordem determinística: principal → secundária → resto do banco.
 */
export function aproximarReservaEntrante(
  clube: Clube,
  posicao: Posicao,
): ParceiroSlot | null {
  const ids = (clube.bancoIds ?? []).filter((id) => id !== "usuario");
  const elenco = clube.elenco;
  const candidatos = ids
    .map((id) => elenco.find((j) => j.id === id))
    .filter(Boolean);
  if (!candidatos.length) return null;
  const principal = candidatos.filter((j) => j!.posicaoPrincipal === posicao);
  const secundaria = candidatos.filter((j) =>
    j!.posicoesSecundarias.includes(posicao),
  );
  const escolhido = (principal[0] ?? secundaria[0] ?? candidatos[0])!;
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
  opcoesEscalacao?: OpcoesMotorCausal,
): Partida {
  return simularPartidaCausal(
    partida,
    mandante,
    visitante,
    aleatorio,
    jogador,
    clubeJogadorId,
    incentivo,
    opcoesEscalacao ?? {},
  );
}
