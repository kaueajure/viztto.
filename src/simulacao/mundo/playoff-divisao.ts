import type { Clube, Partida } from "@/dominio/entidades/modelos";
import type { FormatoPlayoffAcesso } from "@/dominio/constantes/regras-movimento";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { simularPartida } from "@/simulacao/partida/motor-partida";

function partidaVazia(
  id: string,
  mandanteId: string,
  visitanteId: string,
  data: string,
): Partida {
  return {
    id,
    rodada: 0,
    data,
    mandanteId,
    visitanteId,
    categoria: "profissional",
    golsMandante: null,
    golsVisitante: null,
    eventos: [],
    participacao: null,
  };
}

/** Simula um jogo e devolve placar (NPC, motor existente). */
function placar(
  mandante: Clube,
  visitante: Clube,
  aleatorio: GeradorAleatorio,
  data: string,
  sufixo: string,
): { gm: number; gv: number } {
  const r = simularPartida(
    partidaVazia(`playoff-${sufixo}`, mandante.id, visitante.id, data),
    mandante,
    visitante,
    aleatorio,
  );
  return { gm: r.golsMandante ?? 0, gv: r.golsVisitante ?? 0 };
}

/**
 * Resolve confronto em jogo único ou ida/volta.
 * Empate no agregado → pênaltis determinísticos via RNG (sem away goals).
 */
export function resolverConfrontoPlayoff(
  melhor: Clube,
  pior: Clube,
  aleatorio: GeradorAleatorio,
  opcoes: { idaVolta: boolean; data: string; id: string },
): string {
  if (!opcoes.idaVolta) {
    // Final em casa do melhor classificado.
    const p = placar(melhor, pior, aleatorio, opcoes.data, `${opcoes.id}-u`);
    if (p.gm !== p.gv) return p.gm > p.gv ? melhor.id : pior.id;
    return aleatorio.chance(0.5) ? melhor.id : pior.id;
  }
  // Ida: pior em casa; volta: melhor em casa.
  const ida = placar(pior, melhor, aleatorio, opcoes.data, `${opcoes.id}-ida`);
  const volta = placar(
    melhor,
    pior,
    aleatorio,
    opcoes.data,
    `${opcoes.id}-volta`,
  );
  const golsMelhor = ida.gv + volta.gm;
  const golsPior = ida.gm + volta.gv;
  if (golsMelhor !== golsPior) return golsMelhor > golsPior ? melhor.id : pior.id;
  return aleatorio.chance(0.5) ? melhor.id : pior.id;
}

/**
 * Playoff de acesso na divisão inferior.
 * `classificados` = clubes ordenados por posição (índice 0 = 1º).
 * Retorna o id do clube promovido pelo playoff (além dos acessos diretos).
 */
export function resolverPlayoffAcesso(
  classificados: Clube[],
  formato: FormatoPlayoffAcesso,
  aleatorio: GeradorAleatorio,
  data: string,
): string {
  const porPos = (pos: number) => {
    const c = classificados[pos - 1];
    if (!c) throw new Error(`Playoff: posição ${pos} inexistente.`);
    return c;
  };

  if (formato.chave === "chave_4") {
    const a = porPos(formato.posicoes[0]!); // 3
    const b = porPos(formato.posicoes[3]!); // 6
    const c = porPos(formato.posicoes[1]!); // 4
    const d = porPos(formato.posicoes[2]!); // 5
    const sf1 = resolverConfrontoPlayoff(a, b, aleatorio, {
      idaVolta: formato.idaVoltaSemifinal,
      data,
      id: "sf1",
    });
    const sf2 = resolverConfrontoPlayoff(c, d, aleatorio, {
      idaVolta: formato.idaVoltaSemifinal,
      data,
      id: "sf2",
    });
    const f1 = classificados.find((x) => x.id === sf1)!;
    const f2 = classificados.find((x) => x.id === sf2)!;
    // Melhor campanha = menor índice na tabela.
    const i1 = classificados.findIndex((x) => x.id === sf1);
    const i2 = classificados.findIndex((x) => x.id === sf2);
    const [melhor, pior] = i1 <= i2 ? [f1, f2] : [f2, f1];
    return resolverConfrontoPlayoff(melhor, pior, aleatorio, {
      idaVolta: !formato.finalJogoUnico,
      data,
      id: "final",
    });
  }

  // chave_3: 4×5 → vencedor × 3
  const p3 = porPos(formato.posicoes[0]!);
  const p4 = porPos(formato.posicoes[1]!);
  const p5 = porPos(formato.posicoes[2]!);
  const semi = resolverConfrontoPlayoff(p4, p5, aleatorio, {
    idaVolta: formato.idaVoltaSemifinal,
    data,
    id: "sf45",
  });
  const adversario = classificados.find((x) => x.id === semi)!;
  return resolverConfrontoPlayoff(p3, adversario, aleatorio, {
    idaVolta: !formato.finalJogoUnico,
    data,
    id: "final3",
  });
}

/** Playoff entre divisão superior e inferior (ex.: Bundesliga 16º × 2.BL 3º). */
export function resolverPlayoffInterdivisional(
  clubeSuperior: Clube,
  clubeInferior: Clube,
  aleatorio: GeradorAleatorio,
  data: string,
  idaVolta: boolean,
): { vencedorId: string; superiorPermanece: boolean } {
  const vencedorId = resolverConfrontoPlayoff(
    clubeSuperior,
    clubeInferior,
    aleatorio,
    { idaVolta, data, id: "inter" },
  );
  return {
    vencedorId,
    superiorPermanece: vencedorId === clubeSuperior.id,
  };
}
