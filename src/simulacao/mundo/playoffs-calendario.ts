/**
 * Agenda playoffs de acesso/rebaixamento como Partidas reais no calendário,
 * para o Matchday / avanço semanal (não só simulação atômica no rollover).
 */
import type {
  Clube,
  EstadoCarreira,
  Partida,
  Temporada,
} from "@/dominio/entidades/modelos";
import {
  regrasMovimentoPorLigaId,
  type FormatoPlayoffAcesso,
  type RegrasMovimentoPar,
} from "@/dominio/constantes/regras-movimento";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { resolverConfrontoPlayoff } from "@/simulacao/mundo/playoff-divisao";
import { registrarEvento } from "@/simulacao/eventos/eventos";

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function temporadaDaLiga(
  carreira: EstadoCarreira,
  ligaId: string,
): Temporada | null {
  if (carreira.liga.id === ligaId) return carreira.temporada;
  return carreira.temporadasExternas[ligaId] ?? null;
}

function clubesOrdenados(
  carreira: EstadoCarreira,
  temporada: Temporada,
): Clube[] {
  const porId = new Map(carreira.clubes.map((c) => [c.id, c]));
  return temporada.classificacao
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .map((l) => porId.get(l.clubeId))
    .filter((c): c is Clube => !!c);
}

function ehPlayoff(p: Partida): boolean {
  return p.fase === "playoff" || p.id.startsWith("playoff-");
}

export function partidasLigaApenas(partidas: Partida[]): Partida[] {
  return partidas.filter((p) => !ehPlayoff(p));
}

function criarPartidaPlayoff(opts: {
  id: string;
  rodada: number;
  data: string;
  mandanteId: string;
  visitanteId: string;
  rotulo: string;
}): Partida {
  return {
    id: opts.id,
    rodada: opts.rodada,
    data: opts.data,
    mandanteId: opts.mandanteId,
    visitanteId: opts.visitanteId,
    categoria: "profissional",
    golsMandante: null,
    golsVisitante: null,
    eventos: [],
    participacao: null,
    fase: "playoff",
    rotuloCompeticao: opts.rotulo,
  };
}

function vencedorConfrontoDePartidas(
  partidas: Partida[],
  ids: string[],
  aleatorio: GeradorAleatorio,
): string | null {
  const jogos = partidas.filter((p) => ids.includes(p.id));
  if (!jogos.length || jogos.some((p) => p.golsMandante === null)) return null;
  if (jogos.length === 1) {
    const j = jogos[0]!;
    if (j.golsMandante === j.golsVisitante)
      return aleatorio.chance(0.5) ? j.mandanteId : j.visitanteId;
    return (j.golsMandante ?? 0) > (j.golsVisitante ?? 0)
      ? j.mandanteId
      : j.visitanteId;
  }
  // Ida/volta: agregado
  const ida = jogos[0]!;
  const volta = jogos[1]!;
  // Assume melhor campanha é mandante da volta (padrão do motor).
  const melhorId = volta.mandanteId;
  const piorId = volta.visitanteId;
  const golsMelhor =
    (ida.mandanteId === melhorId ? ida.golsMandante! : ida.golsVisitante!) +
    (volta.golsMandante ?? 0);
  const golsPior =
    (ida.mandanteId === piorId ? ida.golsMandante! : ida.golsVisitante!) +
    (volta.golsVisitante ?? 0);
  if (golsMelhor !== golsPior)
    return golsMelhor > golsPior ? melhorId : piorId;
  return aleatorio.chance(0.5) ? melhorId : piorId;
}

/**
 * Se o clube do jogador disputar playoff de acesso, agenda as partidas no
 * calendário e estende totalRodadas. Retorna true se a temporada NÃO deve
 * encerrar ainda.
 */
export function processarPlayoffsCalendario(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): boolean {
  const clubeId = carreira.clubeAtualId;
  if (!clubeId) return false;

  const par = regrasMovimentoPorLigaId(carreira.liga.id);
  if (!par?.playoffAcesso) return false;

  // Só agenda playoff de acesso na divisão inferior (ex.: Série B 3º–6º).
  if (carreira.liga.id !== par.divisaoInferiorId) return false;

  const tempInf = carreira.temporada;
  const tempSup = temporadaDaLiga(carreira, par.divisaoSuperiorId);

  // Playoff de acesso só depende da tabela da inferior.
  // Barragem interdivisional (Alemanha/França) exige a superior pronta.
  if (par.playoffInterdivisional) {
    if (!tempSup) return false;
    const supTemPlayoffPendente = tempSup.partidas.some(
      (p) => ehPlayoff(p) && p.golsMandante === null,
    );
    const supRegularOk =
      tempSup.encerrada ||
      (tempSup.rodadaAtual >= tempSup.totalRodadas && !supTemPlayoffPendente);
    if (!supRegularOk) return false;
  }

  const classInf = clubesOrdenados(carreira, tempInf);
  const posJogador = classInf.findIndex((c) => c.id === clubeId) + 1;
  if (!par.playoffAcesso.posicoes.includes(posJogador)) {
    // Jogador não está no playoff — deixa o fluxo atômico no rollover.
    return false;
  }

  const rotulo = `Playoff · ${carreira.liga.nome}`;
  const existentes = tempInf.partidas.filter((p) => ehPlayoff(p));

  if (existentes.length === 0) {
    return agendarSemifinais(
      carreira,
      par,
      classInf,
      aleatorio,
      rotulo,
      clubeId,
    );
  }

  // Semifinais concluídas? Agenda final se o jogador avançou.
  const pendentes = existentes.filter((p) => p.golsMandante === null);
  if (pendentes.length > 0) {
    const maxRodada = Math.max(
      ...existentes.map((p) => p.rodada),
      tempInf.rodadaAtual,
    );
    tempInf.totalRodadas = Math.max(tempInf.totalRodadas, maxRodada);
    return true;
  }

  // Todas as partidas de playoff atuais jogadas — precisa de final?
  const jaTemFinal = existentes.some((p) => p.id.includes("-final"));
  if (!jaTemFinal) {
    return agendarFinalSeAvancou(
      carreira,
      par,
      classInf,
      aleatorio,
      rotulo,
      clubeId,
      existentes,
    );
  }

  // Playoffs do jogador concluídos — pode encerrar a temporada.
  return false;
}

function agendarSemifinais(
  carreira: EstadoCarreira,
  par: RegrasMovimentoPar,
  classInf: Clube[],
  aleatorio: GeradorAleatorio,
  rotulo: string,
  clubeId: string,
): boolean {
  const fmt = par.playoffAcesso!;
  const porPos = (pos: number) => classInf[pos - 1];
  const t = carreira.temporada;
  const baseRodada = t.rodadaAtual;
  let data = carreira.dataAtual;

  const chaves =
    fmt.chave === "chave_4"
      ? [
          {
            id: "sf1",
            melhor: porPos(fmt.posicoes[0]!)!,
            pior: porPos(fmt.posicoes[3]!)!,
          },
          {
            id: "sf2",
            melhor: porPos(fmt.posicoes[1]!)!,
            pior: porPos(fmt.posicoes[2]!)!,
          },
        ]
      : [
          {
            id: "sf45",
            melhor: porPos(fmt.posicoes[1]!)!,
            pior: porPos(fmt.posicoes[2]!)!,
          },
        ];

  let rodada = baseRodada;
  let agendouUsuario = false;

  for (const chave of chaves) {
    const envolveUsuario =
      chave.melhor.id === clubeId || chave.pior.id === clubeId;
    if (envolveUsuario) {
      rodada = baseRodada + 1;
      data = somarDias(carreira.dataAtual, 7);
      if (fmt.idaVoltaSemifinal) {
        t.partidas.push(
          criarPartidaPlayoff({
            id: `playoff-${par.id}-${chave.id}-ida`,
            rodada,
            data,
            mandanteId: chave.pior.id,
            visitanteId: chave.melhor.id,
            rotulo: `${rotulo} · Semifinal (ida)`,
          }),
        );
        rodada++;
        data = somarDias(data, 7);
        t.partidas.push(
          criarPartidaPlayoff({
            id: `playoff-${par.id}-${chave.id}-volta`,
            rodada,
            data,
            mandanteId: chave.melhor.id,
            visitanteId: chave.pior.id,
            rotulo: `${rotulo} · Semifinal (volta)`,
          }),
        );
      } else {
        t.partidas.push(
          criarPartidaPlayoff({
            id: `playoff-${par.id}-${chave.id}-u`,
            rodada,
            data,
            mandanteId: chave.melhor.id,
            visitanteId: chave.pior.id,
            rotulo: `${rotulo} · Semifinal`,
          }),
        );
      }
      agendouUsuario = true;
    } else {
      // NPC × NPC: resolve agora e guarda vencedor em partida fantasma já concluída
      // (para a final saber o adversário).
      const vencedorId = resolverConfrontoPlayoff(
        chave.melhor,
        chave.pior,
        aleatorio,
        {
          idaVolta: fmt.idaVoltaSemifinal,
          data: carreira.dataAtual,
          id: chave.id,
        },
      );
      t.partidas.push({
        ...criarPartidaPlayoff({
          id: `playoff-${par.id}-${chave.id}-npc`,
          rodada: baseRodada,
          data: carreira.dataAtual,
          mandanteId: chave.melhor.id,
          visitanteId: chave.pior.id,
          rotulo: `${rotulo} · Semifinal (NPC)`,
        }),
        golsMandante: vencedorId === chave.melhor.id ? 1 : 0,
        golsVisitante: vencedorId === chave.pior.id ? 1 : 0,
      });
    }
  }

  if (!agendouUsuario) return false;

  const maxRodada = Math.max(...t.partidas.map((p) => p.rodada));
  t.totalRodadas = Math.max(t.totalRodadas, maxRodada);
  t.encerrada = false;

  registrarEvento(
    carreira,
    "divisao",
    "Playoffs de acesso definidos",
    "Sua equipe está no mata-mata de acesso. As partidas entram no calendário das próximas semanas.",
    "Imprensa",
    true,
  );
  return true;
}

function agendarFinalSeAvancou(
  carreira: EstadoCarreira,
  par: RegrasMovimentoPar,
  classInf: Clube[],
  aleatorio: GeradorAleatorio,
  rotulo: string,
  clubeId: string,
  existentes: Partida[],
): boolean {
  const fmt = par.playoffAcesso!;
  const t = carreira.temporada;

  // Descobre vencedores das semis
  let vencedorUsuario: string | null = null;
  let vencedorOutro: string | null = null;

  if (fmt.chave === "chave_4") {
    const sf1Ids = existentes
      .filter((p) => p.id.includes("-sf1-"))
      .map((p) => p.id);
    const sf2Ids = existentes
      .filter((p) => p.id.includes("-sf2-"))
      .map((p) => p.id);
    const v1 = vencedorConfrontoDePartidas(existentes, sf1Ids, aleatorio);
    const v2 = vencedorConfrontoDePartidas(existentes, sf2Ids, aleatorio);
    if (!v1 || !v2) return false;
    if (v1 === clubeId || v2 === clubeId) {
      vencedorUsuario = v1 === clubeId ? v1 : v2;
      vencedorOutro = v1 === clubeId ? v2 : v1;
    } else {
      // Jogador eliminado — final NPC resolvida na hora para o rollover.
      const i1 = classInf.findIndex((c) => c.id === v1);
      const i2 = classInf.findIndex((c) => c.id === v2);
      const melhor = i1 <= i2 ? classInf[i1]! : classInf[i2]!;
      const pior = melhor.id === v1 ? classInf[i2]! : classInf[i1]!;
      const vencedorId = resolverConfrontoPlayoff(melhor, pior, aleatorio, {
        idaVolta: !fmt.finalJogoUnico,
        data: carreira.dataAtual,
        id: "final-npc",
      });
      t.partidas.push({
        ...criarPartidaPlayoff({
          id: `playoff-${par.id}-final-npc`,
          rodada: t.rodadaAtual,
          data: carreira.dataAtual,
          mandanteId: melhor.id,
          visitanteId: pior.id,
          rotulo: `${rotulo} · Final (NPC)`,
        }),
        golsMandante: vencedorId === melhor.id ? 1 : 0,
        golsVisitante: vencedorId === pior.id ? 1 : 0,
      });
      return false;
    }
  } else {
    // chave_3: SF 4×5; vencedor × 3º
    const sfIds = existentes
      .filter((p) => p.id.includes("-sf45-") || p.id.includes("-sf45"))
      .map((p) => p.id);
    const vSemi = vencedorConfrontoDePartidas(existentes, sfIds, aleatorio);
    const p3 = classInf[fmt.posicoes[0]! - 1];
    if (!vSemi || !p3) return false;
    if (clubeId !== vSemi && clubeId !== p3.id) return false;
    vencedorUsuario = clubeId;
    vencedorOutro = clubeId === p3.id ? vSemi : p3.id;
  }

  if (!vencedorUsuario || !vencedorOutro) return false;

  const melhor =
    classInf.findIndex((c) => c.id === vencedorUsuario) <=
    classInf.findIndex((c) => c.id === vencedorOutro)
      ? vencedorUsuario
      : vencedorOutro;
  const pior = melhor === vencedorUsuario ? vencedorOutro : vencedorUsuario;

  const rodada = t.rodadaAtual + 1;
  const data = somarDias(carreira.dataAtual, 7);
  if (fmt.finalJogoUnico) {
    t.partidas.push(
      criarPartidaPlayoff({
        id: `playoff-${par.id}-final-u`,
        rodada,
        data,
        mandanteId: melhor,
        visitanteId: pior,
        rotulo: `${rotulo} · Final`,
      }),
    );
  } else {
    t.partidas.push(
      criarPartidaPlayoff({
        id: `playoff-${par.id}-final-ida`,
        rodada,
        data,
        mandanteId: pior,
        visitanteId: melhor,
        rotulo: `${rotulo} · Final (ida)`,
      }),
    );
    t.partidas.push(
      criarPartidaPlayoff({
        id: `playoff-${par.id}-final-volta`,
        rodada: rodada + 1,
        data: somarDias(data, 7),
        mandanteId: melhor,
        visitanteId: pior,
        rotulo: `${rotulo} · Final (volta)`,
      }),
    );
  }

  const maxRodada = Math.max(...t.partidas.map((p) => p.rodada));
  t.totalRodadas = Math.max(t.totalRodadas, maxRodada);

  registrarEvento(
    carreira,
    "divisao",
    "Final de acesso marcada",
    "Você avançou no playoff. A final entra no calendário.",
    "Imprensa",
    true,
  );
  return true;
}

/** Lê o campeão do playoff de acesso a partir das partidas (se existir). */
export function lerVencedorPlayoffAcesso(
  temporada: Temporada,
  formato: FormatoPlayoffAcesso,
  aleatorio: GeradorAleatorio,
  parId: string,
): string | null {
  const finais = temporada.partidas.filter(
    (p) => p.id.startsWith(`playoff-${parId}-final`) && ehPlayoff(p),
  );
  if (finais.length && finais.every((p) => p.golsMandante !== null)) {
    return vencedorConfrontoDePartidas(
      temporada.partidas,
      finais.map((p) => p.id),
      aleatorio,
    );
  }
  // Semifinal NPC-only path already resolved in atomic resolver — null = use sim.
  void formato;
  return null;
}
