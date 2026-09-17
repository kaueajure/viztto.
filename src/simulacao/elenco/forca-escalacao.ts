import type { Clube, Jogador, JogadorMundo } from "@/dominio/entidades/modelos";
import { SLOTS_FORMACAO, type SlotFormacao } from "@/dominio/formacao";
import { pesoCompatibilidade, jogadorMundoComoCandidato } from "./escalacao-elenco";
import { limitar } from "@/utilitarios/formatacao";
import { qualidadeSetorialJogador } from "@/simulacao/partida/motor-partida";

function qualidadeSetorialDeOverall(j: JogadorMundo): {
  ataque: number;
  meio: number;
  defesa: number;
} {
  if (!j.atributos)
    return { ataque: j.overall, meio: j.overall, defesa: j.overall };
  return qualidadeSetorialJogador({
    posicao: j.posicaoPrincipal,
    overall: j.overall,
    atributos: j.atributos,
  } as Jogador);
}

export interface ForcaEscalacao {
  forcaGeral: number;
  forcaAtaque: number;
  forcaMeio: number;
  forcaDefesa: number;
  forcaGoleiro: number;
}

function efetividade(
  overall: number,
  forma: number,
  moral: number,
  condicionamento: number,
  fadiga: number,
  adequacao: number,
): number {
  return (
    overall *
      adequacao *
      (0.75 + forma / 400) *
      (0.9 + moral / 1000) *
      (0.85 + condicionamento / 700) *
      (1 - fadiga / 250)
  );
}

function media(valores: number[], fallback: number): number {
  if (!valores.length) return fallback;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/**
 * Força da equipe a partir dos 11 titulares (+ goleiro).
 * Atributos institucionais do clube entram como influência secundária.
 */
export function calcularForcaEscalacao(
  clube: Clube,
  opcoes?: { jogadorUsuario?: Jogador; incluirUsuarioNosTitulares?: boolean },
): ForcaEscalacao {
  const porId = new Map(clube.elenco.map((j) => [j.id, j]));
  const slots = SLOTS_FORMACAO[clube.formacaoPreferida];
  const ataque: number[] = [];
  const meio: number[] = [];
  const defesa: number[] = [];
  let goleiro = clube.forcaDefesa * 0.9;

  const avaliarJogador = (
    j: JogadorMundo | null,
    slot: SlotFormacao,
    usuario?: Jogador,
  ) => {
    if (usuario && (!j || j.id === "usuario")) {
      const cand = {
        posicaoPrincipal: usuario.posicao,
        posicoesSecundarias: usuario.posicaoSecundaria
          ? [usuario.posicaoSecundaria]
          : [],
        posicaoBruta: usuario.posicao,
      };
      const adeq = pesoCompatibilidade(cand, slot);
      return efetividade(
        usuario.overall,
        usuario.forma,
        usuario.moral,
        usuario.condicionamento,
        usuario.fadiga,
        adeq,
      );
    }
    if (!j) return clube.forcaGeral * 0.85;
    const adeq = pesoCompatibilidade(jogadorMundoComoCandidato(j), slot);
    let ov = j.overall;
    if (j.atributos) {
      // Atributos diferenciam perfis de mesmo overall (leve, sem reescrever o motor).
      const q = qualidadeSetorialDeOverall(j);
      if (["CA", "PD", "PE", "SA"].includes(slot))
        ov = ov * 0.72 + q.ataque * 0.28;
      else if (["VOL", "MC", "MEI"].includes(slot))
        ov = ov * 0.72 + q.meio * 0.28;
      else if (slot === "GOL") ov = ov * 0.65 + q.defesa * 0.35;
      else ov = ov * 0.75 + q.defesa * 0.25;
    }
    return efetividade(
      ov,
      j.forma,
      j.moral,
      j.condicionamento,
      j.fadiga,
      adeq,
    );
  };

  const goleiroEntidade =
    clube.goleiroTitularId === "usuario" && opcoes?.jogadorUsuario
      ? null
      : porId.get(clube.goleiroTitularId ?? "") ?? null;
  goleiro = avaliarJogador(
    goleiroEntidade,
    "GOL",
    clube.goleiroTitularId === "usuario" ? opcoes?.jogadorUsuario : undefined,
  );

  clube.titularesIds.forEach((id, i) => {
    const slot = slots[i] ?? "MC";
    const ehUsuario = id === "usuario";
    const j = ehUsuario ? null : porId.get(id) ?? null;
    const valor = avaliarJogador(
      j,
      slot,
      ehUsuario ? opcoes?.jogadorUsuario : undefined,
    );
    if (["CA", "PD", "PE", "SA"].includes(slot)) ataque.push(valor);
    else if (["VOL", "MC", "MEI"].includes(slot)) meio.push(valor);
    else defesa.push(valor);
  });

  const forcaAtaque = media(ataque, clube.forcaAtaque);
  const forcaMeio = media(meio, clube.forcaMeio);
  const forcaDefesa = media([...defesa, goleiro * 0.35], clube.forcaDefesa);
  const qualidadeEscalacao =
    (forcaAtaque + forcaMeio + forcaDefesa + goleiro) / 4;

  // identidade institucional (secundária)
  const institucional =
    clube.reputacao * 0.15 +
    (clube.treinador?.disciplina ?? 50) * 0.04 +
    clube.forma * 0.05 +
    clube.moral * 0.03;

  const forcaGeral = limitar(
    qualidadeEscalacao * 0.82 + institucional * 0.18,
    45,
    96,
  );

  return {
    forcaGeral: Math.round(forcaGeral * 10) / 10,
    forcaAtaque: Math.round(forcaAtaque * 10) / 10,
    forcaMeio: Math.round(forcaMeio * 10) / 10,
    forcaDefesa: Math.round(forcaDefesa * 10) / 10,
    forcaGoleiro: Math.round(goleiro * 10) / 10,
  };
}

/** Atualiza forças do clube in-place a partir da escalação atual. */
export function sincronizarForcaClube(
  clube: Clube,
  jogadorUsuario?: Jogador,
): ForcaEscalacao {
  const forca = calcularForcaEscalacao(clube, {
    jogadorUsuario,
    incluirUsuarioNosTitulares: true,
  });
  clube.forcaGeral = forca.forcaGeral;
  clube.forcaAtaque = forca.forcaAtaque;
  clube.forcaMeio = forca.forcaMeio;
  clube.forcaDefesa = forca.forcaDefesa;
  return forca;
}
