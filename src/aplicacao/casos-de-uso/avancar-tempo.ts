import type {
  EstadoCarreira,
  Partida,
  Clube,
  Atributo,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { simularPartida } from "@/simulacao/partida/motor-partida";
import {
  processarTreinamento,
  gerarLesao,
} from "@/simulacao/treinamento/treinamento";
import {
  aplicarDeclinio,
  calcularEvolucao,
} from "@/simulacao/evolucao/evolucao";
import {
  avaliarMercado,
  calcularValorMercado,
} from "@/simulacao/transferencias/mercado";
import {
  registrarEvento,
  atualizarObjetivos,
} from "@/simulacao/eventos/eventos";
import { calcularClassificacao } from "@/simulacao/temporada/classificacao";
import { registrarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";
import { finalizarTemporada } from "./temporada";
function aplicarDesempenho(
  carreira: EstadoCarreira,
  partida: Partida,
  clube: Clube,
  aleatorio: GeradorAleatorio,
): void {
  const p = partida.participacao!,
    j = carreira.jogador;
  const estreia = !carreira.registros.some(
    (r) => r.categoria === j.categoria && r.estatisticas.jogos > 0,
  );
  const primeiroGol = !carreira.registros.some(
    (r) => r.categoria === j.categoria && r.estatisticas.gols > 0,
  );
  registrarEstatisticas(carreira, partida);
  if (p.minutos > 0) {
    j.notasRecentes = [...j.notasRecentes, p.nota!].slice(-5);
    j.forma = limitar(j.forma * 0.7 + ((p.nota! - 3) / 7) * 100 * 0.3);
    j.confianca = limitar(j.confianca + p.confianca);
    j.moral = limitar(j.moral + p.moral);
    j.fadiga = limitar(j.fadiga + p.minutos * 0.3);
    j.condicionamento = limitar(j.condicionamento - p.minutos * 0.22);
    j.ritmo = limitar(j.ritmo + 8);
    j.reputacao = limitar(
      j.reputacao + ((p.nota! - 6.5) * carreira.liga.reputacao) / 500,
    );
    p.desenvolvimento = calcularEvolucao(
      j,
      Object.keys(PESOS_POSICOES[j.posicao]) as Atributo[],
      (p.minutos / 90) * Math.max(1, p.nota! - 4) * 1.6,
      clube,
    );
    j.amarelosAcumulados += p.amarelos;
    if (p.vermelhos) j.suspensao = 2;
    if (j.amarelosAcumulados >= carreira.liga.regras.amarelosSuspensao) {
      j.suspensao = Math.max(1, j.suspensao);
      j.amarelosAcumulados = 0;
    }
    gerarLesao(j, carreira.dataAtual, aleatorio, 0.008 + j.fadiga * 0.0002);
    if (estreia)
      registrarEvento(
        carreira,
        "estreia",
        `A primeira vez em campo${j.categoria === "base" ? " na base" : ""}`,
        `${j.nome} fez sua estreia com ${p.minutos} minutos.`,
      );
    if (p.gols && primeiroGol)
      registrarEvento(
        carreira,
        "primeiro-gol",
        `O primeiro gol de ${j.nome}`,
        `Um marco na carreira ${j.categoria === "base" ? "na base" : "profissional"}.`,
      );
    if (p.gols >= 3)
      registrarEvento(
        carreira,
        "hat-trick",
        `Três gols e uma tarde para lembrar`,
        `${j.nome} anota um hat-trick.`,
      );
    else if (p.nota! >= 8)
      registrarEvento(
        carreira,
        "destaque",
        aleatorio.escolher([
          `${j.nome} ganha os holofotes`,
          `Atuação de destaque para ${j.nome}`,
        ]),
        `Nota ${p.nota!.toFixed(1)} na rodada ${partida.rodada}.`,
        "Imprensa",
        false,
      );
    if (j.notasRecentes.length === 5 && j.notasRecentes.every((n) => n < 6.4))
      registrarEvento(
        carreira,
        "fase-ruim",
        "Comissão cobra uma reação",
        "As últimas atuações ficaram abaixo do esperado. Seu espaço será reavaliado.",
        "Treinador",
        false,
      );
  } else {
    p.moral = p.escalacao === "lesionado" ? -1 : -2;
    j.ritmo = limitar(j.ritmo - 4);
    j.moral = limitar(j.moral + p.moral);
  }
  if (p.escalacao === "suspenso") j.suspensao = Math.max(0, j.suspensao - 1);
}
function avaliarPromocao(carreira: EstadoCarreira, clube: Clube): void {
  const j = carreira.jogador;
  if (j.categoria !== "base") return;
  const media =
    j.notasRecentes.reduce((a, b) => a + b, 0) /
    Math.max(1, j.notasRecentes.length);
  const pronto =
    j.overall >= clube.forcaGeral - 13 &&
    j.confianca > 64 &&
    j.forma > 52 &&
    media > 6.5;
  const precoce =
    j.idade >= 16 &&
    j.potencialInterno >= 86 &&
    j.overall >= clube.forcaGeral - 8 &&
    j.confianca > 75;
  if ((j.idade >= 17 && pronto) || precoce || j.idade >= 20) {
    j.categoria = "profissional";
    j.status = "promessa";
    j.confianca = 55;
    j.suspensao = 0;
    j.amarelosAcumulados = 0;
    j.contrato = {
      ...j.contrato,
      tipo: "profissional",
      salario: Math.max(700, j.overall * 25),
      papelEsperado: "promessa",
      dataInicio: carreira.dataAtual,
      dataTermino: somarDias(carreira.dataAtual, 730),
    };
    registrarEvento(
      carreira,
      "promocao",
      `${j.nome} é promovido ao profissional`,
      j.idade >= 20
        ? "Você encerrou o ciclo da base e terá de disputar espaço no elenco principal."
        : "A comissão reconheceu seu desenvolvimento. Começa a disputa por espaço no elenco principal.",
      "Treinador",
    );
  }
}
export function avancarSemana(estado: EstadoCarreira): EstadoCarreira {
  if (estado.temporada.encerrada) return estado;
  const carreira = structuredClone(estado),
    aleatorio = new GeradorAleatorio(carreira.estadoAleatorio),
    j = carreira.jogador;
  const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!;
  carreira.dataAtual = somarDias(carreira.dataAtual, 7);
  carreira.ultimaPartidaId = null;
  if (j.lesao) {
    j.lesao.diasRecuperacao = Math.max(0, j.lesao.diasRecuperacao - 7);
    if (j.lesao.diasRecuperacao === 0) {
      j.lesao = null;
      registrarEvento(
        carreira,
        "retorno",
        "Liberado pelo departamento médico",
        "Você pode voltar aos treinos e à disputa por uma vaga.",
        "Departamento médico",
      );
    } else j.confianca = limitar(j.confianca - 0.5);
  }
  const estavaLesionado = !!j.lesao;
  processarTreinamento(
    j,
    carreira.focoTreino,
    clube,
    carreira.dataAtual,
    aleatorio,
  );
  aplicarDeclinio(j);
  const rodada = ++carreira.temporada.rodadaAtual;
  const mapa = new Map(carreira.clubes.map((c) => [c.id, c]));
  for (const chave of ["partidas", "partidasBase"] as const) {
    carreira.temporada[chave] = carreira.temporada[chave].map((partida) => {
      if (partida.rodada !== rodada) return partida;
      const pertence =
        partida.categoria === j.categoria &&
        [partida.mandanteId, partida.visitanteId].includes(clube.id);
      const resultado = simularPartida(
        partida,
        mapa.get(partida.mandanteId)!,
        mapa.get(partida.visitanteId)!,
        aleatorio,
        pertence ? j : undefined,
        pertence ? clube.id : undefined,
      );
      if (pertence) {
        carreira.ultimaPartidaId = resultado.id;
        aplicarDesempenho(carreira, resultado, clube, aleatorio);
      }
      return resultado;
    });
  }
  for (const c of carreira.clubes) {
    const partida = carreira.temporada.partidas.find(
      (p) =>
        p.rodada === rodada && [p.mandanteId, p.visitanteId].includes(c.id),
    );
    if (!partida) continue;
    const saldo =
      c.id === partida.mandanteId
        ? partida.golsMandante! - partida.golsVisitante!
        : partida.golsVisitante! - partida.golsMandante!;
    c.forma = limitar(
      c.forma * 0.8 + (saldo > 0 ? 75 : saldo === 0 ? 50 : 25) * 0.2,
    );
    c.moral = limitar(c.moral + Math.sign(saldo) * 3);
    c.fadiga = aleatorio.inteiro(10, 30);
  }
  const ids = carreira.clubes.map((c) => c.id),
    regras = carreira.liga.regras;
  carreira.temporada.classificacao = calcularClassificacao(
    ids,
    carreira.temporada.partidas,
    regras.pontosVitoria,
    regras.pontosEmpate,
  );
  carreira.temporada.classificacaoBase = calcularClassificacao(
    ids,
    carreira.temporada.partidasBase,
    regras.pontosVitoria,
    regras.pontosEmpate,
  );
  if (!estavaLesionado && j.lesao)
    registrarEvento(
      carreira,
      "lesao",
      `${j.nome} ficará afastado`,
      `${j.lesao.tipo}. Retorno previsto para ${j.lesao.dataPrevistaRetorno}.`,
      "Departamento médico",
    );
  const idadeInicial = carreira.identidadeInicial.idade;
  j.idade =
    idadeInicial +
    Math.floor(
      (Date.parse(carreira.dataAtual) - Date.parse(carreira.dataInicio)) /
        31557600000,
    );
  avaliarPromocao(carreira, clube);
  if (j.categoria === "profissional") {
    const anterior = j.status;
    j.status =
      j.confianca > 90 && j.overall > clube.forcaGeral + 5
        ? "estrela do time"
        : j.confianca > 82
          ? "jogador importante"
          : j.confianca > 70 && j.overall >= clube.forcaGeral - 5
            ? "titular"
            : j.confianca > 55
              ? "rotacao"
              : "reserva";
    if (
      ["titular", "jogador importante", "estrela do time"].includes(anterior) &&
      ["reserva", "rotacao"].includes(j.status)
    )
      registrarEvento(
        carreira,
        "espaco",
        "Seu espaço no elenco diminuiu",
        "A comissão vai observar seu desempenho nas próximas semanas.",
        "Treinador",
      );
  }
  atualizarObjetivos(carreira);
  j.valorMercado = calcularValorMercado(j, carreira.liga, carreira.dataAtual);
  avaliarMercado(carreira, aleatorio);
  if (j.contrato.dataTermino < carreira.dataAtual) {
    j.contrato.dataTermino = somarDias(carreira.dataAtual, 90);
    j.contrato.salario = Math.round(j.contrato.salario * 0.9);
    registrarEvento(
      carreira,
      "vinculo-provisorio",
      "Vínculo provisório por 90 dias",
      "Sem acordo de longo prazo, você permanece com salário reduzido enquanto seu agente procura opções.",
      "Agente",
    );
  }
  carreira.estadoAleatorio = aleatorio.estado;
  return rodada >= carreira.temporada.totalRodadas
    ? finalizarTemporada(carreira)
    : carreira;
}
export const simularProximaPartida = avancarSemana;
