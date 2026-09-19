import type {
  EstadoCarreira,
  Escalacao,
  Jogador,
  Partida,
  Participacao,
} from "@/dominio/entidades/modelos";
import type {
  BriefingMatchday,
  ContextoPartida,
  InstrucaoTreinador,
  ObjetivoPartida,
} from "@/dominio/matchday";
import { avaliarHierarquia } from "@/simulacao/elenco/hierarquia";
import { determinarEscalacao } from "@/simulacao/partida/escalacao";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";

function rotuloEscalacao(e: Escalacao): string {
  switch (e) {
    case "titular":
      return "Você começa como titular.";
    case "banco":
      return "Você está no banco de reservas.";
    case "nao relacionado":
      return "Você ficou fora da lista.";
    case "lesionado":
      return "Você está lesionado e não joga.";
    case "suspenso":
      return "Você está suspenso.";
  }
}

export function escolherInstrucaoTreinador(
  jogador: Jogador,
  escalacao: Escalacao,
  adversarioForca: number,
  clubeForca: number,
  aleatorio: GeradorAleatorio,
): InstrucaoTreinador {
  if (jogador.amarelosAcumulados >= 2 || escalacao === "suspenso") {
    return "evitar-riscos";
  }
  if (adversarioForca > clubeForca + 6) {
    return aleatorio.escolher(["proteger", "simples", "pressionar"]);
  }
  if (adversarioForca < clubeForca - 5) {
    return aleatorio.escolher(["profundidade", "finalizacoes", "criacao"]);
  }
  const pos = jogador.posicao;
  if (pos === "GOL") return aleatorio.escolher(["simples", "proteger"]);
  if (["CA", "PD", "PE"].includes(pos))
    return aleatorio.escolher(["finalizacoes", "profundidade", "simples"]);
  if (["MEI", "MC"].includes(pos))
    return aleatorio.escolher(["criacao", "simples", "pressionar"]);
  if (["ZAG", "VOL"].includes(pos))
    return aleatorio.escolher(["proteger", "simples", "pressionar"]);
  return aleatorio.escolher(["simples", "criacao", "profundidade"]);
}

export function gerarObjetivosPartida(
  jogador: Jogador,
  escalacao: Escalacao,
  aleatorio: GeradorAleatorio,
): ObjetivoPartida[] {
  const objetivos: ObjetivoPartida[] = [];
  if (escalacao === "titular") {
    objetivos.push({
      id: "minutos",
      descricao: "Jogar pelo menos 60 minutos",
      criterio: "minutos",
      meta: 60,
    });
  } else if (escalacao === "banco") {
    objetivos.push({
      id: "entrar",
      descricao: "Entrar em campo",
      criterio: "minutos",
      meta: 1,
    });
  } else {
    objetivos.push({
      id: "manter-foco",
      descricao: "Manter a cabeça no jogo (sem impacto negativo grave)",
      criterio: "limpo",
      meta: 1,
    });
    return objetivos;
  }

  const pos = jogador.posicao;
  if (pos === "GOL") {
    objetivos.push({
      id: "defesas",
      descricao: "Fazer ao menos 3 defesas",
      criterio: "defesas",
      meta: 3,
    });
  } else if (["CA", "PD", "PE"].includes(pos)) {
    objetivos.push(
      aleatorio.escolher([
        {
          id: "gol",
          descricao: "Marcar um gol",
          criterio: "gol" as const,
          meta: 1,
        },
        {
          id: "nota",
          descricao: "Nota 7.0 ou mais",
          criterio: "nota" as const,
          meta: 7,
        },
      ]),
    );
  } else if (["MEI", "MC"].includes(pos)) {
    objetivos.push(
      aleatorio.escolher([
        {
          id: "chave",
          descricao: "Dar 2 passes-chave",
          criterio: "passes-chave" as const,
          meta: 2,
        },
        {
          id: "assist",
          descricao: "Dar uma assistência",
          criterio: "assistencia" as const,
          meta: 1,
        },
      ]),
    );
  } else {
    objetivos.push({
      id: "desarmes",
      descricao: "Vencer 3 desarmes",
      criterio: "desarmes",
      meta: 3,
    });
  }

  if (jogador.amarelosAcumulados >= 2) {
    objetivos.push({
      id: "sem-cartao",
      descricao: "Não receber cartão",
      criterio: "sem-cartao",
      meta: 1,
    });
  } else if (objetivos.length < 3) {
    objetivos.push({
      id: "nota-min",
      descricao: "Nota mínima 6.5",
      criterio: "nota",
      meta: 6.5,
    });
  }

  return objetivos.slice(0, 3);
}

export function avaliarObjetivosPartida(
  objetivos: ObjetivoPartida[],
  p: Participacao | null,
): ObjetivoPartida[] {
  return objetivos.map((o) => {
    let cumprido = false;
    if (!p) {
      cumprido = o.criterio === "limpo";
    } else {
      switch (o.criterio) {
        case "minutos":
          cumprido = p.minutos >= o.meta;
          break;
        case "nota":
          cumprido = (p.nota ?? 0) >= o.meta;
          break;
        case "gol":
          cumprido = p.gols >= o.meta;
          break;
        case "assistencia":
          cumprido = p.assistencias >= o.meta;
          break;
        case "sem-cartao":
          cumprido = p.amarelos === 0 && p.vermelhos === 0;
          break;
        case "desarmes":
          cumprido = p.desarmes >= o.meta;
          break;
        case "passes-chave":
          cumprido = p.passesChave >= o.meta;
          break;
        case "defesas":
          cumprido = p.defesas >= o.meta;
          break;
        case "limpo":
          cumprido = true;
          break;
      }
    }
    return { ...o, cumprido };
  });
}

export function montarContextoPosJogo(
  briefing: BriefingMatchday,
  partida: Partida,
  carreira: EstadoCarreira,
  treinadorAntes: number,
): ContextoPartida {
  const p = partida.participacao;
  const objetivos = avaliarObjetivosPartida(briefing.objetivos, p);
  const cumpridos = objetivos.filter((o) => o.cumprido).length;
  const impactoTreinador =
    (p?.confianca ?? 0) * 0.35 +
    (cumpridos - objetivos.length * 0.5) * 2;

  let reacaoTreinador: string | null = null;
  let reacaoImprensa: string | null = null;
  let impactoHierarquia: string | null = null;

  if (p && p.minutos > 0) {
    if ((p.nota ?? 0) >= 8) {
      reacaoTreinador = "O treinador elogiou sua atuação no vestiário.";
      reacaoImprensa = "A imprensa destacou você entre os melhores em campo.";
    } else if ((p.nota ?? 0) < 5.5) {
      reacaoTreinador = "A comissão cobrou mais intensidade e concentração.";
      reacaoImprensa = "Sua atuação gerou críticas na imprensa local.";
    } else if (cumpridos === objetivos.length) {
      reacaoTreinador = "Você cumpriu o combinado. A comissão anotou positivamente.";
    }

    if (p.escalacao === "titular" && (p.nota ?? 0) >= 7.5) {
      impactoHierarquia = "Bom sinal na disputa pela posição.";
    } else if (p.escalacao === "titular" && (p.nota ?? 0) < 5.8) {
      impactoHierarquia = "Atuação abaixo do esperado — a vaga pode oscilar.";
    } else if (p.escalacao === "banco" && p.minutos > 0 && (p.nota ?? 0) >= 7) {
      impactoHierarquia = "Entrada positiva fortalece sua candidatura.";
    }
  } else if (briefing.escalacao === "nao relacionado") {
    reacaoTreinador = "A comissão manteve você fora da lista nesta rodada.";
  }

  const deltaRel = carreira.relacionamentos.treinador - treinadorAntes;
  if (!reacaoTreinador && Math.abs(deltaRel) >= 1) {
    reacaoTreinador =
      deltaRel > 0
        ? "Sua relação com o treinador melhorou um pouco."
        : "Houve um desgaste leve com a comissão.";
  }

  return {
    instrucao: briefing.instrucao,
    objetivos,
    impactoTreinador: Math.round(impactoTreinador * 10) / 10,
    impactoHierarquia,
    reacaoImprensa,
    reacaoTreinador,
  };
}

/**
 * Monta o briefing a partir do estado já preparado da semana
 * (escalação definida, rodada incrementada).
 */
export function montarBriefingMatchday(
  carreira: EstadoCarreira,
  partida: Partida,
  escalacao: Escalacao,
  aleatorio: GeradorAleatorio,
): BriefingMatchday {
  const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!;
  const mandante = carreira.clubes.find((c) => c.id === partida.mandanteId)!;
  const visitante = carreira.clubes.find((c) => c.id === partida.visitanteId)!;
  const ehMandante = partida.mandanteId === clube.id;
  const adversario = ehMandante ? visitante : mandante;
  const hierarquia = avaliarHierarquia(carreira);
  const instrucao = escolherInstrucaoTreinador(
    carreira.jogador,
    escalacao,
    adversario.forcaGeral,
    clube.forcaGeral,
    aleatorio,
  );
  const objetivos = gerarObjetivosPartida(
    carreira.jogador,
    escalacao,
    aleatorio,
  );

  return {
    partidaId: partida.id,
    rodada: partida.rodada,
    data: partida.data,
    categoria: partida.categoria,
    competicao:
      partida.categoria === "base"
        ? `${carreira.liga.nome} · Sub-20`
        : carreira.liga.nome,
    estadio: mandante.estadio,
    mandanteId: partida.mandanteId,
    visitanteId: partida.visitanteId,
    adversarioId: adversario.id,
    mandante: ehMandante,
    posicao: carreira.jogador.posicao,
    escalacao,
    formaClube: clube.forma,
    formaAdversario: adversario.forma,
    forcaClube: clube.forcaGeral,
    forcaAdversario: adversario.forcaGeral,
    concorrentes: hierarquia.concorrentes
      .filter((c) => !c.usuario)
      .slice(0, 3)
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        overall: c.overall,
        disponivel: c.disponivel,
      })),
    instrucao,
    objetivos,
    textoSituacao: rotuloEscalacao(escalacao),
  };
}

/** Estima escalação sem consumir o RNG da carreira (cópia). */
export function estimarEscalacaoProxima(
  carreira: EstadoCarreira,
  escalacaoPreparada: Escalacao | null,
  elencoProfissional: boolean,
): Escalacao {
  const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
  if (!clube) return "nao relacionado";
  const rng = new GeradorAleatorio(carreira.estadoAleatorio);
  return determinarEscalacao(carreira.jogador, clube, rng, 0, {
    escalacaoPreparada: escalacaoPreparada ?? undefined,
    elencoProfissional,
  });
}
