import type {
  Clube,
  Escalacao,
  Jogador,
  JogadorMundo,
  Posicao,
  SlotEscalacao,
  StatusElenco,
} from "@/dominio/entidades/modelos";
import {
  FORMACOES,
  SLOTS_FORMACAO,
  slotsCompativeis,
  type Formacao,
  type SlotFormacao,
} from "@/dominio/formacao";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";

export type CandidatoEscalacao = {
  id: string;
  nome: string;
  posicaoPrincipal: Posicao;
  posicoesSecundarias: Posicao[];
  posicaoBruta: string;
  overall: number;
  forma: number;
  moral: number;
  condicionamento: number;
  fadiga: number;
  confiancaTreinador: number;
  statusElenco: StatusElenco;
  lesionado: boolean;
  suspensao: number;
  ehUsuario: boolean;
};

/** Influência leve de papel/status — não deve travar titularidade contra forma/overall. */
export const PESO_STATUS: Record<StatusElenco, number> = {
  "estrela do time": 3.5,
  "jogador importante": 2.5,
  titular: 1.5,
  rotacao: 0.5,
  reserva: 0,
  promessa: -0.5,
  "categoria de base": -6,
};

/** Compatibilidade posicional 0–1. */
export function pesoCompatibilidade(
  candidato: Pick<
    CandidatoEscalacao,
    "posicaoPrincipal" | "posicoesSecundarias" | "posicaoBruta"
  >,
  slot: SlotFormacao,
): number {
  if (candidato.posicaoPrincipal === "GOL" && slot !== "GOL") return 0.05;
  if (slot === "GOL" && candidato.posicaoPrincipal !== "GOL") return 0.05;
  if (candidato.posicaoPrincipal === slot) return 1;
  if (slot === "SA" && ["CA", "MEI", "PD", "PE"].includes(candidato.posicaoPrincipal))
    return 0.85;
  if (candidato.posicoesSecundarias.includes(slot as Posicao)) return 0.9;

  const compativeis = slotsCompativeis(candidato.posicaoBruta);
  if (compativeis.includes(slot)) return 0.75;

  const grupoSlot: Record<string, string> = {
    GOL: "GOL",
    LD: "DEF",
    LE: "DEF",
    ZAG: "DEF",
    VOL: "MEI",
    MC: "MEI",
    MEI: "MEI",
    PD: "ATA",
    PE: "ATA",
    CA: "ATA",
    SA: "ATA",
  };
  const grupoPos: Record<Posicao, string> = {
    GOL: "GOL",
    LD: "DEF",
    LE: "DEF",
    ZAG: "DEF",
    VOL: "MEI",
    MC: "MEI",
    MEI: "MEI",
    PD: "ATA",
    PE: "ATA",
    CA: "ATA",
  };
  if (grupoSlot[slot] === grupoPos[candidato.posicaoPrincipal]) return 0.5;
  if (
    (grupoSlot[slot] === "MEI" && grupoPos[candidato.posicaoPrincipal] === "ATA") ||
    (grupoSlot[slot] === "ATA" && grupoPos[candidato.posicaoPrincipal] === "MEI")
  )
    return 0.35;
  return 0.12;
}

export function avaliarParaSlot(
  candidato: CandidatoEscalacao,
  slot: SlotFormacao,
  rotacaoTreinador = 50,
): number {
  if (candidato.lesionado || candidato.suspensao > 0) return -999;
  const compat = pesoCompatibilidade(candidato, slot);
  if (compat < 0.1) return -500;
  return (
    candidato.overall * compat +
    (candidato.forma - 50) * 0.2 +
    (candidato.moral - 50) * 0.06 +
    (candidato.condicionamento - 70) * 0.08 -
    candidato.fadiga * 0.15 +
    (candidato.confiancaTreinador - 50) * 0.1 +
    PESO_STATUS[candidato.statusElenco] +
    (candidato.ehUsuario ? rotacaoTreinador * 0.02 : 0)
  );
}

export function jogadorMundoComoCandidato(
  j: JogadorMundo,
): CandidatoEscalacao {
  return {
    id: j.id,
    nome: j.nome,
    posicaoPrincipal: j.posicaoPrincipal,
    posicoesSecundarias: j.posicoesSecundarias,
    posicaoBruta: j.posicao,
    overall: j.overall,
    forma: j.forma,
    moral: j.moral,
    condicionamento: j.condicionamento,
    fadiga: j.fadiga,
    confiancaTreinador: 55,
    statusElenco: j.statusElenco,
    lesionado: j.lesionado || !!j.lesao,
    suspensao: j.suspensao,
    ehUsuario: false,
  };
}

export function jogadorUsuarioComoCandidato(
  j: Jogador,
  incentivo = 0,
): CandidatoEscalacao {
  return {
    id: "usuario",
    nome: `${j.nome} ${j.sobrenome}`.trim(),
    posicaoPrincipal: j.posicao,
    posicoesSecundarias: j.posicaoSecundaria ? [j.posicaoSecundaria] : [],
    posicaoBruta: j.posicao,
    overall: j.overall,
    forma: j.forma,
    moral: j.moral,
    condicionamento: j.condicionamento,
    fadiga: j.fadiga,
    confiancaTreinador: incentivo * 10 + limitar(j.confianca + ((j.preparacao.historico.at(-1)?.nota ?? 55) - 55) * 0.15),
    statusElenco: j.status,
    lesionado: !!j.lesao,
    suspensao: j.suspensao,
    ehUsuario: true,
  };
}

export interface ResultadoEscalacaoElenco {
  formacao: Formacao;
  goleiroId: string | null;
  titularesIds: string[];
  bancoIds: string[];
  naoRelacionadosIds: string[];
  slots: SlotEscalacao[];
  escalacaoUsuario: Escalacao;
}

export function escalarElencoCompleto(
  candidatos: CandidatoEscalacao[],
  formacao: Formacao = "4-3-3",
  treinador?: { rotacao?: number; formacaoPreferida?: Formacao },
): ResultadoEscalacaoElenco {
  const formacaoFinal =
    treinador?.formacaoPreferida &&
    (FORMACOES as readonly string[]).includes(treinador.formacaoPreferida)
      ? treinador.formacaoPreferida
      : formacao;
  const rotacao = treinador?.rotacao ?? 50;
  const usados = new Set<string>();
  const slots: SlotEscalacao[] = [];

  const escolher = (slot: SlotFormacao): string | null => {
    let melhor: CandidatoEscalacao | null = null;
    let nota = -Infinity;
    for (const c of candidatos) {
      if (usados.has(c.id)) continue;
      const n = avaliarParaSlot(c, slot, rotacao);
      if (n > nota) {
        nota = n;
        melhor = c;
      }
    }
    if (!melhor || nota < -100) return null;
    usados.add(melhor.id);
    slots.push({ slot, jogadorId: melhor.id, adequacao: pesoCompatibilidade(melhor, slot) });
    return melhor.id;
  };

  const goleiroId = escolher("GOL");
  const titularesIds: string[] = [];
  for (const slot of SLOTS_FORMACAO[formacaoFinal]) {
    const id = escolher(slot);
    if (id) titularesIds.push(id);
  }

  const restantes = candidatos
    .filter((c) => !usados.has(c.id) && !c.lesionado && c.suspensao <= 0)
    .sort(
      (a, b) =>
        b.overall + b.forma * 0.1 - (a.overall + a.forma * 0.1),
    );
  const bancoIds = restantes.slice(0, 7).map((c) => c.id);
  const bancoSet = new Set(bancoIds);
  for (const id of bancoIds) usados.add(id);
  const naoRelacionadosIds = candidatos
    .filter((c) => !usados.has(c.id))
    .map((c) => c.id);

  let escalacaoUsuario: Escalacao = "nao relacionado";
  if (titularesIds.includes("usuario") || goleiroId === "usuario")
    escalacaoUsuario = "titular";
  else if (bancoSet.has("usuario")) escalacaoUsuario = "banco";
  else {
    const usuario = candidatos.find((c) => c.ehUsuario);
    if (usuario?.lesionado) escalacaoUsuario = "lesionado";
    else if (usuario && usuario.suspensao > 0) escalacaoUsuario = "suspenso";
  }

  return {
    formacao: formacaoFinal,
    goleiroId,
    titularesIds,
    bancoIds,
    naoRelacionadosIds,
    slots,
    escalacaoUsuario,
  };
}

export function concorrentesNaPosicao(
  candidatos: CandidatoEscalacao[],
  posicao: Posicao,
  limite = 5,
): { candidato: CandidatoEscalacao; nota: number }[] {
  const slot = posicao as SlotFormacao;
  return candidatos
    .map((c) => ({ candidato: c, nota: avaliarParaSlot(c, slot) }))
    .filter((x) => x.nota > -100)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite);
}

export function aplicarEscalacaoAoClube(
  clube: Clube,
  resultado: ResultadoEscalacaoElenco,
): void {
  clube.formacaoPreferida = resultado.formacao;
  clube.goleiroTitularId = resultado.goleiroId;
  clube.titularesIds = resultado.titularesIds;
  clube.bancoIds = resultado.bancoIds;
}

/** Reavalia titulares do clube a partir do elenco (sem usuário). */
export function reescalarClube(clube: Clube, aleatorio?: GeradorAleatorio): void {
  const candidatos = clube.elenco.map(jogadorMundoComoCandidato);
  if (aleatorio) {
    for (const c of candidatos) {
      c.forma = limitar(c.forma + aleatorio.inteiro(-2, 2));
    }
  }
  const resultado = escalarElencoCompleto(
    candidatos,
    clube.formacaoPreferida,
    clube.treinador,
  );
  aplicarEscalacaoAoClube(clube, resultado);
  for (const j of clube.elenco) {
    if (resultado.goleiroId === j.id || resultado.titularesIds.includes(j.id))
      j.statusElenco =
        j.overall >= clube.forcaGeral + 5 ? "jogador importante" : "titular";
    else if (resultado.bancoIds.includes(j.id)) j.statusElenco = "rotacao";
    else if (j.statusElenco !== "categoria de base") j.statusElenco = "reserva";
  }
}
