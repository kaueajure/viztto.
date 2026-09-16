import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { criarTemporada } from "@/simulacao/temporada/gerador-calendario";
import { registrarEvento } from "@/simulacao/eventos/eventos";
export function finalizarTemporada(estado: EstadoCarreira): EstadoCarreira {
  if (estado.temporada.encerrada) return estado;
  if (estado.temporada.rodadaAtual < estado.temporada.totalRodadas)
    throw new Error("Ainda há rodadas para disputar.");
  const carreira = structuredClone(estado),
    t = carreira.temporada;
  t.encerrada = true;
  const campeao = t.classificacao[0].clubeId,
    campeaoBase = t.classificacaoBase[0].clubeId;
  carreira.temporadasAnteriores.push({
    ano: t.ano,
    campeaoId: campeao,
    campeaoBaseId: campeaoBase,
    classificacao: structuredClone(t.classificacao),
    classificacaoBase: structuredClone(t.classificacaoBase),
  });
  const clube = carreira.clubes.find((c) => c.id === campeao)!;
  clube.reputacao = Math.min(100, clube.reputacao + 1);
  registrarEvento(
    carreira,
    "temporada",
    `${clube.nome} conquista a liga`,
    `${formatarTemporada(carreira.liga.id, t.ano)} chega ao fim. A classificação final e as estatísticas foram preservadas.`,
  );
  const tituloId =
    carreira.jogador.categoria === "base" ? campeaoBase : campeao;
  if (tituloId === carreira.clubeAtualId) {
    carreira.jogador.reputacao = Math.min(100, carreira.jogador.reputacao + 4);
    registrarEvento(
      carreira,
      "titulo",
      `Campeão ${carreira.jogador.categoria === "base" ? "da base" : "nacional"}!`,
      "Uma conquista para a história da sua carreira.",
    );
  }
  return carreira;
}
export function iniciarProximaTemporada(
  estado: EstadoCarreira,
): EstadoCarreira {
  if (!estado.temporada.encerrada)
    throw new Error("Termine a temporada atual primeiro.");
  const carreira = structuredClone(estado),
    ano = carreira.temporada.ano + 1;
  const inicio = `${ano}${carreira.dataInicio.slice(4)}`;
  carreira.dataAtual = inicio;
  carreira.jogador.idade =
    carreira.identidadeInicial.idade +
    ano -
    Number(carreira.dataInicio.slice(0, 4));
  if (
    carreira.jogador.lesao &&
    carreira.jogador.lesao.dataPrevistaRetorno <= inicio
  )
    carreira.jogador.lesao = null;
  else if (carreira.jogador.lesao)
    carreira.jogador.lesao.diasRecuperacao = Math.ceil(
      (Date.parse(carreira.jogador.lesao.dataPrevistaRetorno) -
        Date.parse(inicio)) /
        86400000,
    );
  carreira.jogador.fadiga = 5;
  carreira.jogador.condicionamento = 95;
  carreira.jogador.amarelosAcumulados = 0;
  carreira.jogador.notasRecentes = [];
  carreira.temporada = criarTemporada(carreira.clubes, ano, inicio);
  carreira.ultimaPartidaId = null;
  for (const proposta of carreira.propostas)
    if (proposta.status === "pendente" && proposta.validade < inicio)
      proposta.status = "expirada";
  registrarEvento(
    carreira,
    "nova-temporada",
    `A temporada ${formatarTemporada(carreira.liga.id, ano)} começa`,
    "Calendário renovado. Novas oportunidades para escrever sua história.",
    "Diretoria",
  );
  return carreira;
}
