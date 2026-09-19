import type {
  EstadoCarreira,
  Partida,
  Clube,
  Atributo,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { gerarLesao } from "@/simulacao/treinamento/treinamento";
import { calcularEvolucao } from "@/simulacao/evolucao/evolucao";
import { registrarEvento } from "@/simulacao/eventos/eventos";
import { registrarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { PESOS_POSICOES } from "@/dominio/regras/jogador";

export function aplicarDesempenho(
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
      (p.minutos / 90) * Math.max(1, p.nota! - 4) * 1.05,
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
        `A primeira vez em campo${partida.categoria === "base" ? " na base" : ""}`,
        `${j.nome} fez sua estreia com ${p.minutos} minutos.`,
      );
    if (p.gols && primeiroGol)
      registrarEvento(
        carreira,
        "primeiro-gol",
        `O primeiro gol de ${j.nome}`,
        `Um marco na carreira ${partida.categoria === "base" ? "na base" : "profissional"}.`,
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
  const treinos = j.preparacao.historico.filter(
    (t) => t.avaliacao !== "Recuperação",
  );
  const mediaTreino = treinos.length
    ? treinos.reduce((s, t) => s + t.nota, 0) / treinos.length
    : 0;
  const pronto =
    j.overall >= clube.forcaGeral - 13 &&
    j.confianca > 64 &&
    j.forma > 52 &&
    (media > 6.5 ||
      (mediaTreino >= 72 &&
        carreira.acompanhamento.base.treinosProfissional >= 4));
  const precoce =
    j.idade >= 16 &&
    j.potencialInterno >= 86 &&
    j.overall >= clube.forcaGeral - 8 &&
    j.confianca > 75 &&
    mediaTreino >= 65;
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
