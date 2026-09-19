import type {
  EstadoCarreira,
  Escalacao,
  Jogador,
  Partida,
  Participacao,
  StatusElenco,
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
  contexto?: {
    forcaAdversario: number;
    forcaClube: number;
    instrucao: InstrucaoTreinador;
    status: StatusElenco;
  },
): ObjetivoPartida[] {
  const objetivos: ObjetivoPartida[] = [];
  const adversarioForte =
    (contexto?.forcaAdversario ?? 70) > (contexto?.forcaClube ?? 70) + 4;
  const instrucao = contexto?.instrucao;

  if (escalacao === "titular") {
    objetivos.push({
      id: "minutos",
      descricao: adversarioForte
        ? "Completar pelo menos 70 minutos"
        : "Jogar pelo menos 60 minutos",
      criterio: "minutos",
      meta: adversarioForte ? 70 : 60,
    });
  } else if (escalacao === "banco") {
    objetivos.push({
      id: "entrar",
      descricao: "Entrar e causar impacto (nota ≥ 6.5 se jogar)",
      criterio: "nota",
      meta: 6.5,
    });
    objetivos.push({
      id: "min-banco",
      descricao: "Conseguir minutos em campo",
      criterio: "minutos",
      meta: 1,
    });
    if (["CA", "PD", "PE", "MEI"].includes(jogador.posicao)) {
      objetivos.push({
        id: "chance-banco",
        descricao: "Participar de gol ou assistência",
        criterio: "participar-gol",
        meta: 1,
      });
    }
    return objetivos.slice(0, 3);
  } else {
    objetivos.push({
      id: "manter-foco",
      descricao: "Manter a cabeça no jogo",
      criterio: "limpo",
      meta: 1,
    });
    return objetivos;
  }

  const pos = jogador.posicao;
  if (pos === "GOL") {
    objetivos.push({
      id: "defesas",
      descricao: adversarioForte
        ? "Fazer ao menos 4 defesas"
        : "Fazer ao menos 2 defesas",
      criterio: "defesas",
      meta: adversarioForte ? 4 : 2,
    });
  } else if (["CA", "PD", "PE"].includes(pos)) {
    if (instrucao === "finalizacoes") {
      objetivos.push({
        id: "chutes",
        descricao: "Conseguir 2+ finalizações",
        criterio: "chutes",
        meta: 2,
      });
    } else {
      objetivos.push(
        aleatorio.escolher([
          {
            id: "chutes",
            descricao: "Conseguir 2+ finalizações",
            criterio: "chutes" as const,
            meta: 2,
          },
          {
            id: "participar",
            descricao: "Participar de um gol",
            criterio: "participar-gol" as const,
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
    }
  } else if (["MEI", "MC"].includes(pos)) {
    objetivos.push(
      aleatorio.escolher([
        {
          id: "chave",
          descricao: instrucao === "criacao" ? "Dar 2 passes-chave" : "Dar 1 passe-chave",
          criterio: "passes-chave" as const,
          meta: instrucao === "criacao" ? 2 : 1,
        },
        {
          id: "assist",
          descricao: "Dar uma assistência",
          criterio: "assistencia" as const,
          meta: 1,
        },
        {
          id: "nota-mei",
          descricao: "Nota mínima 6.8",
          criterio: "nota" as const,
          meta: 6.8,
        },
      ]),
    );
  } else {
    objetivos.push(
      aleatorio.escolher([
        {
          id: "desarmes",
          descricao: "Vencer 2 desarmes",
          criterio: "desarmes" as const,
          meta: 2,
        },
        {
          id: "sem-cartao",
          descricao: "Evitar cartão",
          criterio: "sem-cartao" as const,
          meta: 1,
        },
        {
          id: "nota-def",
          descricao: "Nota mínima 6.5",
          criterio: "nota" as const,
          meta: 6.5,
        },
      ]),
    );
  }

  if (jogador.amarelosAcumulados >= 2 || instrucao === "evitar-riscos") {
    objetivos.push({
      id: "sem-cartao-2",
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
    } else if (o.criterio === "nota" && p.minutos === 0 && o.id === "entrar") {
      cumprido = false;
    } else {
      switch (o.criterio) {
        case "minutos":
          cumprido = p.minutos >= o.meta;
          break;
        case "nota":
          cumprido = p.minutos > 0 && (p.nota ?? 0) >= o.meta;
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
        case "chutes":
          cumprido = p.chutes >= o.meta;
          break;
        case "participar-gol":
          cumprido = p.gols + p.assistencias >= o.meta;
          break;
        case "limpo":
          cumprido = true;
          break;
      }
    }
    return { ...o, cumprido };
  });
}

/**
 * Calcula consequências alinhadas ao que `aplicarDesempenho` efetivamente aplica.
 */
export function montarContextoPosJogo(
  briefing: BriefingMatchday,
  partida: Partida,
  carreira: EstadoCarreira,
  _treinadorAntes: number,
): ContextoPartida {
  const p = partida.participacao;
  const objetivos = avaliarObjetivosPartida(briefing.objetivos, p);
  const cumpridos = objetivos.filter((o) => o.cumprido).length;
  const impactoConfianca = p?.confianca ?? 0;
  const impactoMoral = p?.moral ?? (p ? (p.escalacao === "lesionado" ? -1 : -2) : 0);
  const bonusObjetivos =
    p && p.minutos > 0 ? (cumpridos - objetivos.length * 0.5) * 1.5 : 0;
  // Mesma base de aplicarDesempenho (confianca * 0.35) + bônus de objetivos aplicado junto
  const impactoTreinador =
    Math.round((impactoConfianca * 0.35 + bonusObjetivos) * 10) / 10;
  const impactoReputacao =
    p && p.minutos > 0 && p.nota != null
      ? Math.round(
          (((p.nota - 6.5) * carreira.liga.reputacao) / 500) * 100,
        ) / 100
      : 0;

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
    } else if (cumpridos === objetivos.length && objetivos.length > 0) {
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

  if (!reacaoTreinador && Math.abs(impactoTreinador) >= 1) {
    reacaoTreinador =
      impactoTreinador > 0
        ? "Sua relação com o treinador melhorou um pouco."
        : "Houve um desgaste leve com a comissão.";
  }

  return {
    instrucao: briefing.instrucao,
    objetivos,
    impactoTreinador,
    impactoConfianca,
    impactoMoral,
    impactoReputacao,
    impactoHierarquia,
    reacaoImprensa,
    reacaoTreinador,
  };
}

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
    {
      forcaAdversario: adversario.forcaGeral,
      forcaClube: clube.forcaGeral,
      instrucao,
      status: carreira.jogador.status,
    },
  );

  return {
    partidaId: partida.id,
    rodada: partida.rodada,
    data: partida.data,
    categoria: partida.categoria,
    competicao:
      partida.rotuloCompeticao ??
      (partida.fase === "playoff"
        ? `Playoff · ${carreira.liga.nome}`
        : partida.categoria === "base"
          ? `${carreira.liga.nome} · Sub-20`
          : carreira.liga.nome),
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
