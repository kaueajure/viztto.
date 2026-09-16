/** Formações-base do viztto (não oficiais do Transfermarkt). */
export const FORMACOES = [
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "4-1-4-1",
  "3-4-3",
  "3-5-2",
  "4-3-1-2",
  "4-2-2-2",
] as const;

export type Formacao = (typeof FORMACOES)[number];

export type GrupoPosicao = "GOL" | "DEF" | "MEI" | "ATA";

export type SlotFormacao =
  | "GOL"
  | "LD"
  | "ZAG"
  | "LE"
  | "VOL"
  | "MC"
  | "MEI"
  | "PD"
  | "PE"
  | "CA"
  | "SA";

/** Slots por formação, da defesa ao ataque (exceto goleiro). */
export const SLOTS_FORMACAO: Record<Formacao, SlotFormacao[]> = {
  "4-3-3": ["LE", "ZAG", "ZAG", "LD", "VOL", "MC", "MC", "PE", "CA", "PD"],
  "4-2-3-1": ["LE", "ZAG", "ZAG", "LD", "VOL", "VOL", "PE", "MEI", "PD", "CA"],
  "4-4-2": ["LE", "ZAG", "ZAG", "LD", "PE", "MC", "MC", "PD", "CA", "CA"],
  "4-1-4-1": ["LE", "ZAG", "ZAG", "LD", "VOL", "PE", "MC", "MC", "PD", "CA"],
  "3-4-3": ["ZAG", "ZAG", "ZAG", "LE", "MC", "MC", "LD", "PE", "CA", "PD"],
  "3-5-2": ["ZAG", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "LD", "CA", "CA"],
  "4-3-1-2": ["LE", "ZAG", "ZAG", "LD", "VOL", "MC", "MC", "MEI", "CA", "CA"],
  "4-2-2-2": ["LE", "ZAG", "ZAG", "LD", "VOL", "VOL", "MEI", "MEI", "CA", "CA"],
};

export interface JogadorParaFormacao {
  id: string;
  posicao: string;
  valorMercado: number | null;
  idade: number | null;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function grupoPosicao(posicao: string): GrupoPosicao {
  const p = normalizarTexto(posicao);
  if (
    p.includes("goal") ||
    p.includes("goleiro") ||
    p === "gk" ||
    p.includes("keeper")
  )
    return "GOL";
  if (
    p.includes("attack") ||
    p.includes("forward") ||
    p.includes("striker") ||
    p.includes("centre-forward") ||
    p.includes("center-forward") ||
    p.includes("winger") ||
    p.includes("second striker") ||
    p.includes("atacante") ||
    p.includes("ponta") ||
    p.includes("centroavante")
  )
    return "ATA";
  if (
    p.includes("midfield") ||
    p.includes("meio") ||
    p.includes("defensive mid") ||
    p.includes("attacking mid") ||
    p.includes("central mid") ||
    p.includes("volante") ||
    p.includes("meia")
  )
    return "MEI";
  return "DEF";
}

export function slotsCompativeis(posicao: string): SlotFormacao[] {
  const p = normalizarTexto(posicao);
  const grupo = grupoPosicao(posicao);
  if (grupo === "GOL") return ["GOL"];
  if (p.includes("right-back") || p.includes("right back") || p === "rb")
    return ["LD", "ZAG"];
  if (p.includes("left-back") || p.includes("left back") || p === "lb")
    return ["LE", "ZAG"];
  if (
    p.includes("centre-back") ||
    p.includes("center-back") ||
    p.includes("central defender") ||
    p.includes("zagueiro")
  )
    return ["ZAG"];
  if (p.includes("sweeper")) return ["ZAG"];
  if (
    p.includes("defensive mid") ||
    p.includes("defensive midfield") ||
    p.includes("volante") ||
    p.includes("holding")
  )
    return ["VOL", "MC"];
  if (
    p.includes("attacking mid") ||
    p.includes("attacking midfield") ||
    p.includes("mezzala") ||
    p.includes("trequartista")
  )
    return ["MEI", "MC", "SA"];
  if (p.includes("central mid") || p.includes("midfield"))
    return ["MC", "VOL", "MEI"];
  if (
    p.includes("left winger") ||
    p.includes("left midfield") ||
    p.includes("left wing")
  )
    return ["PE", "MEI", "CA"];
  if (
    p.includes("right winger") ||
    p.includes("right midfield") ||
    p.includes("right wing")
  )
    return ["PD", "MEI", "CA"];
  if (p.includes("second striker") || p.includes("second-striker"))
    return ["SA", "CA", "MEI"];
  if (
    p.includes("centre-forward") ||
    p.includes("center-forward") ||
    p.includes("striker") ||
    p.includes("forward")
  )
    return ["CA", "SA"];
  if (grupo === "ATA") return ["CA", "PE", "PD", "SA"];
  if (grupo === "MEI") return ["MC", "VOL", "MEI"];
  return ["ZAG", "LD", "LE"];
}

function qualidade(jogador: JogadorParaFormacao): number {
  const valor = jogador.valorMercado ?? 0;
  const idade = jogador.idade ?? 28;
  const fatorIdade = idade >= 18 && idade <= 29 ? 1.05 : idade <= 33 ? 1 : 0.9;
  return valor * fatorIdade + (jogador.valorMercado == null ? 1_000_000 : 0);
}

function contarPorGrupo(elenco: JogadorParaFormacao[]) {
  const contagem = { GOL: 0, DEF: 0, MEI: 0, ATA: 0, zagueiros: 0, laterais: 0, volantes: 0, pontas: 0, cas: 0 };
  for (const j of elenco) {
    const g = grupoPosicao(j.posicao);
    contagem[g]++;
    const p = normalizarTexto(j.posicao);
    if (p.includes("centre-back") || p.includes("center-back") || p.includes("zagueiro"))
      contagem.zagueiros++;
    if (p.includes("back") && (p.includes("left") || p.includes("right")))
      contagem.laterais++;
    if (p.includes("defensive mid") || p.includes("volante")) contagem.volantes++;
    if (p.includes("winger") || p.includes("wing")) contagem.pontas++;
    if (p.includes("forward") || p.includes("striker") || p.includes("centre-forward"))
      contagem.cas++;
  }
  return contagem;
}

/** Escolhe formação de forma determinística a partir da composição do elenco. */
export function escolherFormacaoPreferida(
  elenco: JogadorParaFormacao[],
): Formacao {
  const c = contarPorGrupo(elenco);
  if (c.zagueiros >= 4 && c.laterais < 2 && c.cas >= 2) return "3-5-2";
  if (c.zagueiros >= 4 && c.pontas >= 2) return "3-4-3";
  if (c.volantes >= 2 && c.cas === 1 && c.pontas >= 2) return "4-2-3-1";
  if (c.volantes >= 1 && c.cas === 1 && c.MEI >= 4) return "4-1-4-1";
  if (c.cas >= 2 && c.pontas < 2 && c.MEI >= 3) return "4-3-1-2";
  if (c.cas >= 2 && c.volantes >= 2) return "4-2-2-2";
  if (c.cas >= 2) return "4-4-2";
  if (c.pontas >= 2) return "4-3-3";
  return "4-3-3";
}

export function escalarTitulares(
  elenco: JogadorParaFormacao[],
  formacao: Formacao,
): { goleiroId: string | null; titularIds: string[] } {
  const usados = new Set<string>();
  const ordenados = [...elenco].sort((a, b) => qualidade(b) - qualidade(a));

  const escolher = (slot: SlotFormacao): string | null => {
    const candidato = ordenados.find((j) => {
      if (usados.has(j.id)) return false;
      return slotsCompativeis(j.posicao).includes(slot);
    });
    if (candidato) {
      usados.add(candidato.id);
      return candidato.id;
    }
    const reserva = ordenados.find((j) => {
      if (usados.has(j.id)) return false;
      if (slot === "GOL") return grupoPosicao(j.posicao) === "GOL";
      if (["ZAG", "LD", "LE"].includes(slot))
        return grupoPosicao(j.posicao) === "DEF";
      if (["VOL", "MC", "MEI"].includes(slot))
        return grupoPosicao(j.posicao) === "MEI";
      return grupoPosicao(j.posicao) === "ATA";
    });
    if (reserva) {
      usados.add(reserva.id);
      return reserva.id;
    }
    return null;
  };

  const goleiroId = escolher("GOL");
  const titularIds: string[] = [];
  for (const slot of SLOTS_FORMACAO[formacao]) {
    const id = escolher(slot);
    if (id) titularIds.push(id);
  }
  return { goleiroId, titularIds };
}

export function montarLinhasCampo(
  formacao: Formacao,
  goleiroId: string | null,
  titularIds: string[],
): { slot: SlotFormacao; jogadorId: string | null }[][] {
  const slots = SLOTS_FORMACAO[formacao];
  const pares = slots.map((slot, i) => ({
    slot,
    jogadorId: titularIds[i] ?? null,
  }));
  const linhas: { slot: SlotFormacao; jogadorId: string | null }[][] = [];
  // Agrupa por linha visual aproximada
  const mapaLinhas: Record<Formacao, SlotFormacao[][]> = {
    "4-3-3": [["CA"], ["PE", "PD"], ["MC", "MC"], ["VOL"], ["LE", "ZAG", "ZAG", "LD"]],
    "4-2-3-1": [["CA"], ["PE", "MEI", "PD"], ["VOL", "VOL"], ["LE", "ZAG", "ZAG", "LD"]],
    "4-4-2": [["CA", "CA"], ["PE", "MC", "MC", "PD"], ["LE", "ZAG", "ZAG", "LD"]],
    "4-1-4-1": [["CA"], ["PE", "MC", "MC", "PD"], ["VOL"], ["LE", "ZAG", "ZAG", "LD"]],
    "3-4-3": [["PE", "CA", "PD"], ["LE", "MC", "MC", "LD"], ["ZAG", "ZAG", "ZAG"]],
    "3-5-2": [["CA", "CA"], ["LE", "VOL", "MC", "MC", "LD"], ["ZAG", "ZAG", "ZAG"]],
    "4-3-1-2": [["CA", "CA"], ["MEI"], ["VOL", "MC", "MC"], ["LE", "ZAG", "ZAG", "LD"]],
    "4-2-2-2": [["CA", "CA"], ["MEI", "MEI"], ["VOL", "VOL"], ["LE", "ZAG", "ZAG", "LD"]],
  };
  const estrutura = mapaLinhas[formacao];
  const fila = [...pares];
  for (const linhaSlots of estrutura) {
    const linha: { slot: SlotFormacao; jogadorId: string | null }[] = [];
    for (const slot of linhaSlots) {
      const idx = fila.findIndex((p) => p.slot === slot);
      if (idx >= 0) {
        linha.push(fila.splice(idx, 1)[0]!);
      } else {
        linha.push({ slot, jogadorId: null });
      }
    }
    linhas.push(linha);
  }
  linhas.push([{ slot: "GOL", jogadorId: goleiroId }]);
  return linhas;
}
