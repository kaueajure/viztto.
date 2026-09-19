import type { EstadoCarreira, Liga, Partida } from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import { simularPartida } from "@/simulacao/partida/motor-partida";
import { calcularClassificacao } from "@/simulacao/temporada/classificacao";
import { criarTemporada } from "@/simulacao/temporada/gerador-calendario";
import { reescalarClube } from "@/simulacao/elenco/escalacao-elenco";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import {
  evoluirJogadoresMundo,
  podeAposentar,
} from "@/simulacao/elenco/evolucao-mundo";

/** Avança ligas externas com simulação intermediária. */
export function avancarLigasExternas(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  for (const liga of carreira.ligas) {
    if (liga.id === carreira.liga.id) continue;
    let temporada = carreira.temporadasExternas[liga.id];
    if (!temporada) continue;
    if (temporada.encerrada) continue;

    const clubesLiga = carreira.clubes.filter((c) => c.ligaId === liga.id);
    if (clubesLiga.length < 2) continue;

    const rodada = ++temporada.rodadaAtual;
    const mapa = new Map(clubesLiga.map((c) => [c.id, c]));
    const partidaPorClube = new Map<string, Partida>();

    for (const chave of ["partidas", "partidasBase"] as const) {
      const lista = temporada[chave];
      for (let i = 0; i < lista.length; i++) {
        const partida = lista[i]!;
        if (partida.rodada !== rodada) continue;
        const resultado = simularPartida(
          partida,
          mapa.get(partida.mandanteId)!,
          mapa.get(partida.visitanteId)!,
          aleatorio,
        );
        lista[i] = resultado;
        if (chave === "partidas") {
          partidaPorClube.set(resultado.mandanteId, resultado);
          partidaPorClube.set(resultado.visitanteId, resultado);
        }
      }
    }

    for (const c of clubesLiga) {
      const partida = partidaPorClube.get(c.id);
      if (partida?.golsMandante != null) {
        const saldo =
          c.id === partida.mandanteId
            ? partida.golsMandante! - partida.golsVisitante!
            : partida.golsVisitante! - partida.golsMandante!;
        c.forma = limitar(
          c.forma * 0.85 + (saldo > 0 ? 70 : saldo === 0 ? 50 : 30) * 0.15,
        );
        c.moral = limitar(c.moral + Math.sign(saldo) * 2);
      }
      evoluirJogadoresMundo(c.elenco, aleatorio, false);
      c.elenco = c.elenco.filter((j) => !podeAposentar(j, aleatorio));
      // Reescala a cada 2 rodadas nas ligas externas (determinístico); força toda semana.
      if (rodada % 2 === 0) reescalarClube(c, aleatorio);
      sincronizarForcaClube(c);
    }

    temporada.classificacao = calcularClassificacao(
      clubesLiga.map((c) => c.id),
      temporada.partidas,
      liga.regras.pontosVitoria,
      liga.regras.pontosEmpate,
    );
    temporada.classificacaoBase = calcularClassificacao(
      clubesLiga.map((c) => c.id),
      temporada.partidasBase,
      liga.regras.pontosVitoria,
      liga.regras.pontosEmpate,
    );

    if (rodada >= temporada.totalRodadas) {
      temporada.encerrada = true;
      const campeao = temporada.classificacao[0]?.clubeId ?? clubesLiga[0]!.id;
      carreira.temporadasAnteriores.push({
        ano: temporada.ano,
        campeaoId: campeao,
        campeaoBaseId: temporada.classificacaoBase[0]!.clubeId,
        ligaId: liga.id,
        classificacao: temporada.classificacao,
        classificacaoBase: temporada.classificacaoBase,
      });
    }
    carreira.temporadasExternas[liga.id] = temporada;
  }
}

export function criarTemporadasExternas(
  ligas: Liga[],
  ligaPrincipalId: string,
  clubes: EstadoCarreira["clubes"],
  ano: number,
  dataInicio: string,
): Record<string, EstadoCarreira["temporada"]> {
  const mapa: Record<string, EstadoCarreira["temporada"]> = {};
  for (const liga of ligas) {
    if (liga.id === ligaPrincipalId) continue;
    const doGrupo = clubes.filter((c) => c.ligaId === liga.id);
    if (doGrupo.length < 2) continue;
    mapa[liga.id] = criarTemporada(doGrupo, ano, dataInicio);
  }
  return mapa;
}
