import type { Clube, Jogador, JogadorMundo, Posicao } from "@/dominio/entidades/modelos";
import { SLOTS_FORMACAO, type SlotFormacao } from "@/dominio/formacao";
import { mapearPosicaoPrincipal } from "@/dominio/jogador-mundo";
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

function media(valores: number[], fallback: number): number {
  if (!valores.length) return fallback;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Média ponderada dos 11: 3 melhores 1.15, 5 médios 1.0, 3 fracos 0.9. */
export function mediaPonderadaTitulares(overalls: number[]): number {
  if (!overalls.length) return 55;
  const ord = [...overalls].sort((a, b) => b - a);
  let soma = 0;
  let pesos = 0;
  for (let i = 0; i < ord.length; i++) {
    const peso = i < 3 ? 1.15 : i < 8 ? 1.0 : 0.9;
    soma += ord[i]! * peso;
    pesos += peso;
  }
  return soma / pesos;
}

/**
 * Força da equipe a partir dos 11 titulares + profundidade do banco.
 * Reputação institucional NÃO entra — só qualidade atual do elenco.
 */
export function calcularForcaEscalacao(
  clube: Clube,
  opcoes?: { jogadorUsuario?: Jogador; incluirUsuarioNosTitulares?: boolean },
): ForcaEscalacao {
  const porId = new Map(clube.elenco.map((j) => [j.id, j]));
  const slots = SLOTS_FORMACAO[clube.formacaoPreferida];
  const fallbackElenco = media(
    clube.elenco.map((j) => j.overall),
    55,
  );
  const ataque: number[] = [];
  const meio: number[] = [];
  const defesa: number[] = [];
  const overallsXi: number[] = [];

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
      return {
        qualidade: usuario.overall * Math.max(0.75, adeq),
        overall: usuario.overall,
      };
    }
    if (!j) {
      return {
        qualidade: fallbackElenco * 0.85,
        overall: fallbackElenco * 0.85,
      };
    }
    const adeq = pesoCompatibilidade(jogadorMundoComoCandidato(j), slot);
    let ov = j.overall;
    if (j.atributos) {
      const q = qualidadeSetorialDeOverall(j);
      if (["CA", "PD", "PE", "SA"].includes(slot))
        ov = ov * 0.85 + q.ataque * 0.15;
      else if (["VOL", "MC", "MEI"].includes(slot))
        ov = ov * 0.85 + q.meio * 0.15;
      else if (slot === "GOL") ov = ov * 0.8 + q.defesa * 0.2;
      else ov = ov * 0.85 + q.defesa * 0.15;
    }
    return {
      qualidade: ov * Math.max(0.75, adeq),
      overall: j.overall,
    };
  };

  const goleiroEntidade =
    clube.goleiroTitularId === "usuario" && opcoes?.jogadorUsuario
      ? null
      : porId.get(clube.goleiroTitularId ?? "") ?? null;
  const golAvaliado = avaliarJogador(
    goleiroEntidade,
    "GOL",
    clube.goleiroTitularId === "usuario" ? opcoes?.jogadorUsuario : undefined,
  );
  const goleiro = golAvaliado.qualidade;
  overallsXi.push(golAvaliado.overall);

  clube.titularesIds.forEach((id, i) => {
    const slot = slots[i] ?? "MC";
    const ehUsuario = id === "usuario";
    const j = ehUsuario ? null : porId.get(id) ?? null;
    const valor = avaliarJogador(
      j,
      slot,
      ehUsuario ? opcoes?.jogadorUsuario : undefined,
    );
    overallsXi.push(valor.overall);
    if (["CA", "PD", "PE", "SA"].includes(slot)) ataque.push(valor.qualidade);
    else if (["VOL", "MC", "MEI"].includes(slot)) meio.push(valor.qualidade);
    else defesa.push(valor.qualidade);
  });

  const idsTitulares = new Set([
    ...(clube.goleiroTitularId ? [clube.goleiroTitularId] : []),
    ...clube.titularesIds,
  ]);
  const reservas = (clube.bancoIds?.length
    ? clube.bancoIds
    : clube.elenco
        .map((j) => j.id)
        .filter((id) => !idsTitulares.has(id))
        .slice(0, 7)
  )
    .map((id) => porId.get(id))
    .filter((j): j is JogadorMundo => !!j)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7);

  const forcaTitulares = mediaPonderadaTitulares(overallsXi);
  const forcaBanco = media(
    reservas.map((j) => j.overall),
    forcaTitulares * 0.92,
  );
  const forcaGeral = limitar(
    forcaTitulares * 0.9 + forcaBanco * 0.1,
    45,
    96,
  );

  const forcaAtaque = media(ataque, forcaTitulares);
  const forcaMeio = media(meio, forcaTitulares);
  const forcaDefesa = media([...defesa, goleiro], forcaTitulares);

  return {
    forcaGeral: Math.round(forcaGeral),
    forcaAtaque: Math.round(forcaAtaque),
    forcaMeio: Math.round(forcaMeio),
    forcaDefesa: Math.round(forcaDefesa),
    forcaGoleiro: Math.round(goleiro),
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

/**
 * Recalcula titulares/banco e forças a partir do elenco já com OVR
 * (snapshots pós-Rating Engine, sem hidratar JogadorMundo completo).
 */
export function sincronizarForcaSnapshot(clube: Clube): ForcaEscalacao {
  type Mini = {
    id: string;
    overall: number;
    posicaoPrincipal: Posicao;
    posicaoBruta: string;
    valorMercado: number;
  };
  const elenco = clube.elenco as Array<{
    id: string;
    overall?: number;
    posicao?: string;
    posicaoPrincipal?: Posicao;
    valorMercado?: number | null;
  }>;
  const minis: Mini[] = elenco.map((j) => ({
    id: j.id,
    overall:
      typeof j.overall === "number"
        ? j.overall
        : 50,
    posicaoPrincipal:
      j.posicaoPrincipal ??
      mapearPosicaoPrincipal(j.posicao ?? "Central Midfield"),
    posicaoBruta: j.posicao ?? j.posicaoPrincipal ?? "Central Midfield",
    valorMercado: j.valorMercado ?? 0,
  }));

  const formacao = clube.formacaoPreferida ?? "4-3-3";
  const slots = SLOTS_FORMACAO[formacao];
  const usados = new Set<string>();

  const escolher = (slot: SlotFormacao): Mini | null => {
    let melhor: Mini | null = null;
    let nota = -Infinity;
    for (const c of minis) {
      if (usados.has(c.id)) continue;
      const adeq = pesoCompatibilidade(
        {
          posicaoPrincipal: c.posicaoPrincipal,
          posicoesSecundarias: [],
          posicaoBruta: c.posicaoBruta,
        },
        slot,
      );
      if (adeq < 0.1) continue;
      const n = c.overall * adeq;
      if (n > nota) {
        nota = n;
        melhor = c;
      }
    }
    if (melhor) usados.add(melhor.id);
    return melhor;
  };

  const gol = escolher("GOL");
  clube.goleiroTitularId = gol?.id ?? null;
  const titulares: Mini[] = [];
  const titularesIds: string[] = [];
  for (const slot of slots) {
    const j = escolher(slot);
    if (j) {
      titulares.push(j);
      titularesIds.push(j.id);
    }
  }
  clube.titularesIds = titularesIds;

  const banco = minis
    .filter((j) => !usados.has(j.id))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7);
  clube.bancoIds = banco.map((j) => j.id);

  // Monta proxy mínimo compatível com calcularForcaEscalacao
  const proxyElenco = minis.map((m) => ({
    id: m.id,
    overall: m.overall,
    posicaoPrincipal: m.posicaoPrincipal,
    posicoesSecundarias: [] as Posicao[],
    posicao: m.posicaoBruta,
    forma: 70,
    moral: 70,
    condicionamento: 88,
    fadiga: 10,
    atributos: undefined,
    statusElenco: "titular" as const,
    lesionado: false,
    lesao: null,
    suspensao: 0,
  }));
  const original = clube.elenco;
  clube.elenco = proxyElenco as Clube["elenco"];
  const forca = sincronizarForcaClube(clube);
  clube.elenco = original;
  return forca;
}
