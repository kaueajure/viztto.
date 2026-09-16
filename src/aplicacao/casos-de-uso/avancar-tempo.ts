import { gerarContextoSemana, avisarConcorrencia } from "@/simulacao/decisoes/contexto";
import { registrarResumoSemanal } from "@/simulacao/carreira/acompanhamento";
import { avaliarBase, relacionadoProfissional } from "@/simulacao/base/formacao";
import { avaliarHierarquia, bonusPromessa } from "@/simulacao/elenco/hierarquia";
import { atualizarCompromissos } from "@/simulacao/elenco/treinador";
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
  efetivarPreContratos,
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
import {
  escalarElencoCompleto,
  aplicarEscalacaoAoClube,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
  reescalarClube,
} from "@/simulacao/elenco/escalacao-elenco";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import {
  evoluirJogadoresMundo,
  podeAposentar,
} from "@/simulacao/elenco/evolucao-mundo";
import { avancarLigasExternas } from "@/simulacao/mundo/avancar-ligas";
import { gerarDecisoesSemana } from "@/simulacao/decisoes/decisoes";

function aplicarDesempenho(
  carreira: EstadoCarreira,
  partida: Partida,
  clube: Clube,
  aleatorio: GeradorAleatorio,
): void {
  const p = partida.participacao!,
    j = carreira.jogador;
  const estreia = !carreira.registros.some(
    (r) => r.categoria === partida.categoria && r.estatisticas.jogos > 0,
  );
  const primeiroGol = !carreira.registros.some(
    (r) => r.categoria === partida.categoria && r.estatisticas.gols > 0,
  );
  registrarEstatisticas(carreira, partida);
  if (p.minutos > 0) {
    j.notasRecentes = [...j.notasRecentes, p.nota!].slice(-5);
    j.forma = limitar(j.forma * 0.7 + ((p.nota! - 3) / 7) * 100 * 0.3);
    j.confianca = limitar(j.confianca + p.confianca);
    carreira.relacionamentos.treinador = limitar(
      carreira.relacionamentos.treinador + p.confianca * 0.35,
    );
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

export function avaliarPromocao(carreira: EstadoCarreira, clube: Clube): void {
  const j = carreira.jogador;
  if (j.categoria !== "base") return;
  const media =
    j.notasRecentes.reduce((a, b) => a + b, 0) /
    Math.max(1, j.notasRecentes.length);
  const treinos = j.preparacao.historico.filter(t => t.avaliacao !== "Recuperação");
  const mediaTreino = treinos.length ? treinos.reduce((s,t) => s+t.nota,0)/treinos.length : 0;
  const pronto =
    j.overall >= clube.forcaGeral - 13 &&
    j.confianca > 64 &&
    j.forma > 52 &&
    (media > 6.5 || (mediaTreino >= 72 && carreira.acompanhamento.base.treinosProfissional >= 4));
  const precoce =
    j.idade >= 16 &&
    j.potencialInterno >= 86 &&
    j.overall >= clube.forcaGeral - 8 &&
    j.confianca > 75 && mediaTreino >= 65;
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

function prepararClubesRodada(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  const j = carreira.jogador;
  for (const c of carreira.clubes) {
    if (c.ligaId !== carreira.liga.id) continue;
    const candidatos = c.elenco.map(jogadorMundoComoCandidato);
    if (c.id === carreira.clubeAtualId && j.categoria === "profissional") {
      candidatos.push(jogadorUsuarioComoCandidato(j, bonusPromessa(carreira)));
    }
    const resultado = escalarElencoCompleto(
      candidatos,
      c.formacaoPreferida,
      c.treinador,
    );
    aplicarEscalacaoAoClube(c, resultado);
    sincronizarForcaClube(c, c.id === carreira.clubeAtualId ? j : undefined);
    if (c.id !== carreira.clubeAtualId) {
      evoluirJogadoresMundo(c.elenco, aleatorio, true);
      c.elenco = c.elenco.filter((jog) => !podeAposentar(jog, aleatorio));
    } else {
      evoluirJogadoresMundo(c.elenco, aleatorio, true);
    }
  }
}

export function avancarSemana(estado: EstadoCarreira): EstadoCarreira {
  if (estado.aposentado)
    throw new Error(
      "Esta carreira está aposentada. Você pode consultar o histórico, mas não avançar como jogador ativo.",
    );
  if (estado.temporada.encerrada) return estado;
  const hierarquiaAntes = avaliarHierarquia(estado);
  const carreira = structuredClone(estado),
    aleatorio = new GeradorAleatorio(carreira.estadoAleatorio),
    j = carreira.jogador;
  if (!carreira.relacionamentos)
    carreira.relacionamentos = { treinador: 50, diretoria: 50, agente: 60 };
  if (!carreira.decisoes) carreira.decisoes = [];
  if (!carreira.transferenciasRecentes) carreira.transferenciasRecentes = [];
  if (!carreira.ligas?.length) carreira.ligas = [carreira.liga];
  if (!carreira.temporadasExternas) carreira.temporadasExternas = {};

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

  avaliarBase(carreira);
  const convocado = relacionadoProfissional(carreira);
  const motivoParticipacao = avaliarHierarquia(carreira).motivo;
  const categoriaSemana = convocado ? 'profissional' : j.categoria;
  if (convocado) registrarEvento(carreira,'base-relacionado','Relacionado para o profissional','A comissão chamou você para suprir uma ausência na sua posição. O vínculo com a base permanece.','Treinador',false);
  prepararClubesRodada(carreira, aleatorio);

  const rodada = ++carreira.temporada.rodadaAtual;
  const mapa = new Map(carreira.clubes.map((c) => [c.id, c]));
  for (const chave of ["partidas", "partidasBase"] as const) {
    carreira.temporada[chave] = carreira.temporada[chave].map((partida) => {
      if (partida.rodada !== rodada) return partida;
      const pertence =
        partida.categoria === categoriaSemana &&
        [partida.mandanteId, partida.visitanteId].includes(clube.id);
      const resultado = simularPartida(
        partida,
        mapa.get(partida.mandanteId)!,
        mapa.get(partida.visitanteId)!,
        aleatorio,
        pertence ? convocado ? { ...j, categoria: "profissional" } : j : undefined,
        pertence ? clube.id : undefined,
        pertence ? bonusPromessa(carreira) : 0,
      );
      if (pertence) {
        carreira.ultimaPartidaId = resultado.id;
        aplicarDesempenho(carreira, resultado, clube, aleatorio);
      }
      return resultado;
    });
  }
  for (const c of carreira.clubes.filter(
    (x) => x.ligaId === carreira.liga.id,
  )) {
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
    if (c.id === clube.id) reescalarClube(c);
    sincronizarForcaClube(c, c.id === clube.id ? j : undefined);
  }

  avancarLigasExternas(carreira, aleatorio);

  const ids = carreira.clubes
      .filter((c) => c.ligaId === carreira.liga.id)
      .map((c) => c.id),
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
    const candidatos = [
      ...clube.elenco.map(jogadorMundoComoCandidato),
      jogadorUsuarioComoCandidato(j, bonusPromessa(carreira)),
    ];
    const esc = escalarElencoCompleto(
      candidatos,
      clube.formacaoPreferida,
      clube.treinador,
    );
    aplicarEscalacaoAoClube(clube, esc);
    sincronizarForcaClube(clube, j);
    j.status =
      esc.escalacaoUsuario === "titular"
        ? j.confianca > 90 && j.overall > clube.forcaGeral + 5
          ? "estrela do time"
          : j.confianca > 82
            ? "jogador importante"
            : "titular"
        : esc.escalacaoUsuario === "banco"
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
  atualizarCompromissos(carreira);
  const hierarquiaDepois = avaliarHierarquia(carreira);
  if (hierarquiaDepois.ordem < hierarquiaAntes.ordem || (!hierarquiaAntes.titular && hierarquiaDepois.titular))
    registrarEvento(carreira, 'hierarquia', hierarquiaDepois.titular ? 'Você conquistou a vaga' : 'Você subiu na hierarquia', `Agora você é a ${hierarquiaDepois.ordem}ª opção de ${j.posicao}. ${hierarquiaDepois.motivo}`, 'Treinador', false);
  atualizarObjetivos(carreira);
  j.valorMercado = calcularValorMercado(j, carreira.liga, carreira.dataAtual);
  avaliarMercado(carreira, aleatorio);
  avisarConcorrencia(carreira, estado);
  gerarContextoSemana(carreira, aleatorio);
  gerarDecisoesSemana(carreira, aleatorio);
  if (
    j.contrato.dataTermino < carreira.dataAtual &&
    !carreira.propostas.some(
      (p) => p.status === "aceita" && p.etapa === "acordo",
    )
  ) {
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
  registrarResumoSemanal(carreira, estado, motivoParticipacao);
  carreira.estadoAleatorio = aleatorio.estado;
  return efetivarPreContratos(
    rodada >= carreira.temporada.totalRodadas
      ? finalizarTemporada(carreira)
      : carreira,
  );
}
