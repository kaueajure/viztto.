import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type {
  CategoriaCena,
  DefinicaoCena,
  HistoricoCenasCarreira,
  TipoCena,
} from "@/dominio/cenas";
import {
  criarHistoricoCenas,
  LIMITE_CENAS_POR_SEMANA,
} from "@/dominio/cenas";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar, somarDias } from "@/utilitarios/formatacao";
import { registrarEvento } from "@/simulacao/eventos/eventos";
import { avaliarHierarquia } from "@/simulacao/elenco/hierarquia";

function garantirCenas(c: EstadoCarreira): HistoricoCenasCarreira {
  if (!c.acompanhamento.cenas) {
    c.acompanhamento.cenas = criarHistoricoCenas();
  }
  return c.acompanhamento.cenas;
}

function emCooldown(
  hist: HistoricoCenasCarreira,
  tipo: TipoCena,
  dataAtual: string,
  dias: number,
): boolean {
  const ultima = hist.cooldowns[tipo];
  if (!ultima) return false;
  return somarDias(ultima, dias) > dataAtual;
}

function registrarCenaNoHistorico(
  c: EstadoCarreira,
  tipo: TipoCena,
  categoria: CategoriaCena,
  escolha?: string,
): void {
  const hist = garantirCenas(c);
  hist.registros.push({
    id: `cena-${tipo}-${c.dataAtual}-${hist.registros.length}`,
    tipo,
    categoria,
    data: c.dataAtual,
    escolha,
  });
  hist.registros = hist.registros.slice(-40);
  hist.cooldowns[tipo] = c.dataAtual;
  hist.ultimaCena = c.dataAtual;
}

type CandidatoCena = DefinicaoCena & { motivo: string };

function coletarCandidatos(
  c: EstadoCarreira,
  antes: EstadoCarreira,
): CandidatoCena[] {
  const candidatos: CandidatoCena[] = [];
  const j = c.jogador;
  const partida = [...c.temporada.partidas, ...c.temporada.partidasBase].find(
    (p) => p.id === c.ultimaPartidaId,
  );
  const p = partida?.participacao;
  const clube = c.clubes.find((x) => x.id === c.clubeAtualId);
  const antesClube = antes.clubes.find((x) => x.id === antes.clubeAtualId);
  const stats = c.registros.reduce(
    (s, r) => ({
      jogos: s.jogos + r.estatisticas.jogos,
      gols: s.gols + r.estatisticas.gols,
      assistencias: s.assistencias + r.estatisticas.assistencias,
      titularidades: s.titularidades + r.estatisticas.titularidades,
    }),
    { jogos: 0, gols: 0, assistencias: 0, titularidades: 0 },
  );

  // Marcos
  if (p && p.minutos > 0 && j.categoria === "profissional") {
    const estreiaPro = !antes.registros.some(
      (r) => r.categoria === "profissional" && r.estatisticas.jogos > 0,
    );
    if (estreiaPro && stats.jogos === 1) {
      candidatos.push({
        tipo: "estreia-profissional",
        categoria: "marco",
        prioridade: 95,
        cooldownDias: 9999,
        remetente: "Imprensa",
        titulo: "Estreia profissional",
        texto: `${j.nome} entra em campo pela primeira vez no profissional.`,
        motivo: "estreia",
      });
    }
  }
  if (p && p.escalacao === "titular" && stats.titularidades === 1) {
    candidatos.push({
      tipo: "primeira-titularidade",
      categoria: "marco",
      prioridade: 90,
      cooldownDias: 9999,
      remetente: "Treinador",
      titulo: "Primeira vez como titular",
      texto: "A comissão confiou a você a vaga no time inicial.",
      motivo: "titular",
    });
  }
  if (p && p.gols > 0 && stats.gols === p.gols) {
    candidatos.push({
      tipo: "primeiro-gol-marco",
      categoria: "marco",
      prioridade: 92,
      cooldownDias: 9999,
      remetente: "Imprensa",
      titulo: "O primeiro gol",
      texto: "Um marco que a carreira vai lembrar.",
      motivo: "gol",
    });
  }
  if (p && p.assistencias > 0 && stats.assistencias === p.assistencias) {
    candidatos.push({
      tipo: "primeira-assistencia",
      categoria: "marco",
      prioridade: 88,
      cooldownDias: 9999,
      remetente: "Imprensa",
      titulo: "Primeira assistência",
      texto: "Você abriu o caminho para um gol do time.",
      motivo: "assist",
    });
  }
  if (p && p.gols >= 3) {
    candidatos.push({
      tipo: "hat-trick-marco",
      categoria: "marco",
      prioridade: 94,
      cooldownDias: 180,
      remetente: "Imprensa",
      titulo: "Hat-trick",
      texto: `${j.nome} marca três vezes na mesma partida.`,
      motivo: "hattrick",
    });
  }
  for (const marco of [10, 50, 100] as const) {
    if (stats.jogos === marco) {
      candidatos.push({
        tipo: "marco-jogos",
        categoria: "marco",
        prioridade: 80,
        cooldownDias: 9999,
        remetente: "Imprensa",
        titulo: `${marco} partidas na carreira`,
        texto: `Você alcança a marca de ${marco} jogos oficiais.`,
        motivo: `jogos-${marco}`,
      });
    }
  }

  // Treinador
  const notas = j.notasRecentes;
  if (notas.length >= 3 && notas.slice(-3).every((n) => n >= 7.2)) {
    candidatos.push({
      tipo: "elogio-sequencia",
      categoria: "treinador",
      prioridade: 70,
      cooldownDias: 21,
      remetente: "Treinador",
      titulo: "Elogio da comissão",
      texto: `${clube?.treinador.nome ?? "O treinador"} reconhece sua sequência positiva.`,
      opcoes: [
        { id: "humilde", rotulo: "Agradecer e manter o foco" },
        { id: "cobrar", rotulo: "Pedir mais minutos" },
      ],
      motivo: "elogio",
    });
  }
  if (notas.length >= 3 && notas.slice(-3).every((n) => n < 6.2)) {
    candidatos.push({
      tipo: "cobranca-ruins",
      categoria: "treinador",
      prioridade: 72,
      cooldownDias: 21,
      remetente: "Treinador",
      titulo: "Cobrança no vestiário",
      texto: "As últimas atuações ficaram abaixo do nível exigido.",
      opcoes: [
        { id: "aceitar", rotulo: "Aceitar a cobrança" },
        { id: "contestar", rotulo: "Contestar publicamente" },
      ],
      motivo: "cobranca",
    });
  }

  const hAntes = avaliarHierarquia(antes);
  const hDepois = avaliarHierarquia(c);
  if (!hAntes.titular && hDepois.titular) {
    candidatos.push({
      tipo: "informar-titularidade",
      categoria: "treinador",
      prioridade: 85,
      cooldownDias: 60,
      remetente: "Treinador",
      titulo: "Você é o titular",
      texto: "A comissão confirma: a vaga é sua neste momento.",
      motivo: "virou-titular",
    });
    candidatos.push({
      tipo: "conquista-titularidade",
      categoria: "marco",
      prioridade: 86,
      cooldownDias: 120,
      remetente: "Imprensa",
      titulo: "Titularidade conquistada",
      texto: `${j.nome} assume a posição no time principal.`,
      motivo: "marco-titular",
    });
  }
  if (hAntes.titular && !hDepois.titular) {
    candidatos.push({
      tipo: "informar-perda-vaga",
      categoria: "treinador",
      prioridade: 84,
      cooldownDias: 45,
      remetente: "Treinador",
      titulo: "Você perdeu a vaga",
      texto: "Outro jogador passa à frente na disputa pela posição.",
      opcoes: [
        { id: "trabalhar", rotulo: "Trabalhar em silêncio" },
        { id: "cobrar", rotulo: "Cobrar explicações" },
      ],
      motivo: "perdeu-vaga",
    });
  }
  if (hDepois.ordem < hAntes.ordem - 1 && hAntes.ordem < 90) {
    candidatos.push({
      tipo: "mudanca-papel",
      categoria: "treinador",
      prioridade: 60,
      cooldownDias: 28,
      remetente: "Treinador",
      titulo: "Mudança de papel no elenco",
      texto: `Seu status agora é ${hDepois.rotulo}. ${hDepois.motivo}`,
      motivo: "papel",
    });
  }
  if (
    c.acompanhamento.promessa?.status === "ativa" &&
    c.acompanhamento.promessa.partidas >=
      Math.max(1, c.acompanhamento.promessa.limitePartidas - 1)
  ) {
    candidatos.push({
      tipo: "cobranca-promessa",
      categoria: "treinador",
      prioridade: 75,
      cooldownDias: 14,
      remetente: "Treinador",
      titulo: "Promessa em jogo",
      texto: "O prazo da promessa está acabando. A comissão observa de perto.",
      motivo: "promessa",
    });
  }

  // Concorrência
  if (clube && antesClube && c.clubeAtualId === antes.clubeAtualId) {
    const anteriores = new Set(antesClube.elenco.map((x) => x.id));
    const novo = clube.elenco.find(
      (x) =>
        !anteriores.has(x.id) &&
        (x.posicaoPrincipal === j.posicao ||
          x.posicoesSecundarias.includes(j.posicao)) &&
        x.overall >= j.overall - 2,
    );
    if (novo) {
      candidatos.push({
        tipo: "novo-contratado",
        categoria: "concorrencia",
        prioridade: 78,
        cooldownDias: 30,
        remetente: "Treinador",
        titulo: "Novo concorrente",
        texto: `O clube contratou ${novo.nome} (${novo.overall}) para sua posição.`,
        opcoes: [
          { id: "foco", rotulo: "Focar no trabalho" },
          { id: "agente", rotulo: "Falar com o agente" },
        ],
        motivo: "contratacao",
      });
    }
    const lesionado = clube.elenco.find(
      (x) =>
        x.lesionado &&
        x.posicaoPrincipal === j.posicao &&
        antesClube.elenco.some(
          (a) => a.id === x.id && !a.lesionado,
        ),
    );
    if (lesionado) {
      candidatos.push({
        tipo: "concorrente-lesionado",
        categoria: "concorrencia",
        prioridade: 65,
        cooldownDias: 21,
        remetente: "Treinador",
        titulo: "Concorrente indisponível",
        texto: `${lesionado.nome} se lesionou. Pode abrir espaço para você.`,
        motivo: "lesao-conc",
      });
    }
    const retornou = clube.elenco.find(
      (x) =>
        !x.lesionado &&
        x.posicaoPrincipal === j.posicao &&
        antesClube.elenco.some((a) => a.id === x.id && a.lesionado),
    );
    if (retornou) {
      candidatos.push({
        tipo: "concorrente-retornando",
        categoria: "concorrencia",
        prioridade: 64,
        cooldownDias: 21,
        remetente: "Treinador",
        titulo: "Concorrente de volta",
        texto: `${retornou.nome} retorna aos treinos. A disputa volta a apertar.`,
        motivo: "retorno-conc",
      });
    }
    if (hDepois.ordem < hAntes.ordem) {
      candidatos.push({
        tipo: "ultrapassou-concorrente",
        categoria: "concorrencia",
        prioridade: 55,
        cooldownDias: 28,
        remetente: "Treinador",
        titulo: "Você subiu na disputa",
        texto: "A comissão te coloca à frente de um concorrente direto.",
        motivo: "ultrapassou",
      });
    } else if (hDepois.ordem > hAntes.ordem && hAntes.ordem < 90) {
      candidatos.push({
        tipo: "ultrapassado-concorrente",
        categoria: "concorrencia",
        prioridade: 55,
        cooldownDias: 28,
        remetente: "Treinador",
        titulo: "Um concorrente te passou",
        texto: "Outro jogador ganhou preferência na sua posição.",
        motivo: "ultrapassado",
      });
    }
  }

  // Imprensa
  if (p && (p.nota ?? 0) >= 8.5) {
    candidatos.push({
      tipo: "grande-atuacao",
      categoria: "imprensa",
      prioridade: 68,
      cooldownDias: 21,
      remetente: "Imprensa",
      titulo: "Atuação em destaque",
      texto: `Nota ${p.nota!.toFixed(1)}. A imprensa quer saber se você se vê como titular absoluto.`,
      opcoes: [
        { id: "coletivo", rotulo: "Valorizar o coletivo" },
        { id: "individual", rotulo: "Assumir o protagonismo" },
        { id: "criticar", rotulo: "Cobrar mais reconhecimento" },
      ],
      motivo: "destaque",
    });
  }
  if (notas.length >= 3 && notas.slice(-3).every((n) => n < 6.0)) {
    candidatos.push({
      tipo: "sequencia-ruim-imprensa",
      categoria: "imprensa",
      prioridade: 66,
      cooldownDias: 21,
      remetente: "Imprensa",
      titulo: "Sequência sob crítica",
      texto: "A imprensa questiona seu momento.",
      opcoes: [
        { id: "diplomatica", rotulo: "Resposta diplomática" },
        { id: "confiante", rotulo: "Mostrar confiança" },
        { id: "provocativa", rotulo: "Criticar o treinador" },
      ],
      motivo: "critica",
    });
  }
  if (p && p.gols > 0 && stats.gols === p.gols) {
    candidatos.push({
      tipo: "primeiro-gol-imprensa",
      categoria: "imprensa",
      prioridade: 70,
      cooldownDias: 9999,
      remetente: "Imprensa",
      titulo: "Primeiro gol na imprensa",
      texto: "Os holofotes viram para o seu primeiro gol.",
      motivo: "gol-imprensa",
    });
  }
  if (clube && c.propostas.some((pr) => pr.status === "pendente")) {
    candidatos.push({
      tipo: "rumor-transferencia",
      categoria: "imprensa",
      prioridade: 58,
      cooldownDias: 28,
      remetente: "Imprensa",
      titulo: "Rumores de transferência",
      texto: "Circulam especulações sobre seu futuro.",
      opcoes: [
        { id: "ficar", rotulo: "Afirmar compromisso com o clube" },
        { id: "abrir", rotulo: "Deixar a porta aberta" },
      ],
      motivo: "rumor",
    });
  }
  if (hDepois.titular && j.confianca < 55) {
    candidatos.push({
      tipo: "discussao-titularidade",
      categoria: "imprensa",
      prioridade: 50,
      cooldownDias: 35,
      remetente: "Imprensa",
      titulo: "Titularidade em debate",
      texto: "Há dúvidas se você mantém a vaga nas próximas rodadas.",
      motivo: "debate-titular",
    });
  }

  // Agente
  const interesses = c.mercado.interesses?.length ?? 0;
  const interessesAntes = antes.mercado.interesses?.length ?? 0;
  if (interesses > interessesAntes) {
    candidatos.push({
      tipo: "interesse-aumentou",
      categoria: "agente",
      prioridade: 62,
      cooldownDias: 21,
      remetente: "Agente",
      titulo: "Interesse de mercado",
      texto: "Seu agente confirma: mais clubes passaram a te observar.",
      motivo: "interesse+",
    });
  } else if (interesses < interessesAntes && interessesAntes > 0) {
    candidatos.push({
      tipo: "interesse-esfriou",
      categoria: "agente",
      prioridade: 52,
      cooldownDias: 21,
      remetente: "Agente",
      titulo: "Interesse esfriou",
      texto: "Alguns clubes reduziram o acompanhamento.",
      motivo: "interesse-",
    });
  }
  if (interesses === 1 && interessesAntes === 0) {
    candidatos.push({
      tipo: "clube-observa",
      categoria: "agente",
      prioridade: 60,
      cooldownDias: 28,
      remetente: "Agente",
      titulo: "Um clube começou a observar",
      texto: "Há sondagens iniciais. Nada concreto ainda.",
      motivo: "observa",
    });
  }
  if (
    j.status === "reserva" &&
    j.moral < 45 &&
    j.personalidade.ambicao > 60
  ) {
    candidatos.push({
      tipo: "sugestao-saida",
      categoria: "agente",
      prioridade: 57,
      cooldownDias: 45,
      remetente: "Agente",
      titulo: "Sugestão de mudança",
      texto: "Seu agente sugere avaliar empréstimo ou transferência.",
      opcoes: [
        { id: "ouvir", rotulo: "Ouvir opções" },
        { id: "ficar", rotulo: "Quero ficar e lutar" },
      ],
      motivo: "saida",
    });
  }

  // Clube
  if (clube && clube.forma < 35 && clube.moral < 40) {
    candidatos.push({
      tipo: "crise-resultados",
      categoria: "clube",
      prioridade: 63,
      cooldownDias: 28,
      remetente: "Diretoria",
      titulo: "Crise de resultados",
      texto: "O ambiente no clube está tenso após a sequência ruim.",
      opcoes: [
        { id: "apoiar", rotulo: "Apoiar o grupo" },
        { id: "distanciar", rotulo: "Cuidar da própria carreira" },
      ],
      motivo: "crise",
    });
  }
  const classif = c.temporada.classificacao.find((l) => l.clubeId === c.clubeAtualId);
  if (classif && classif.posicao <= 3 && classif.jogos >= 5) {
    candidatos.push({
      tipo: "disputa-titulo",
      categoria: "clube",
      prioridade: 48,
      cooldownDias: 35,
      remetente: "Diretoria",
      titulo: "Disputa na ponta",
      texto: "O clube briga na parte de cima da tabela. Cada detalhe conta.",
      motivo: "titulo",
    });
  }

  return candidatos;
}

function aplicarConsequenciaEscolha(
  c: EstadoCarreira,
  tipo: TipoCena,
  opcao: string,
): void {
  const j = c.jogador;
  if (tipo === "elogio-sequencia") {
    if (opcao === "humilde") {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 3);
      j.personalidade.disciplina = limitar(j.personalidade.disciplina + 0.4);
      j.moral = limitar(j.moral + 1);
    } else {
      j.confianca = limitar(j.confianca + 2);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 2);
      j.reputacao = limitar(j.reputacao + 0.3);
    }
  } else if (tipo === "cobranca-ruins" || tipo === "informar-perda-vaga") {
    if (opcao === "aceitar" || opcao === "trabalhar") {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 2);
      j.moral = limitar(j.moral - 1);
      j.personalidade.profissionalismo = limitar(
        j.personalidade.profissionalismo + 0.5,
      );
    } else {
      j.reputacao = limitar(j.reputacao + 0.8);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 5);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 2);
      j.moral = limitar(j.moral + 1);
      // Desejo de saída: marca via moral baixa + reputação (sem duplicar mercado)
    }
  } else if (tipo === "grande-atuacao" || tipo === "sequencia-ruim-imprensa") {
    if (opcao === "coletivo" || opcao === "diplomatica") {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 2);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria + 1);
    } else if (opcao === "individual" || opcao === "confiante") {
      j.confianca = limitar(j.confianca + 3);
      j.reputacao = limitar(j.reputacao + 0.5);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 1);
    } else {
      j.reputacao = limitar(j.reputacao + 1.2);
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador - 6);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 3);
      j.moral = limitar(j.moral + 2);
    }
  } else if (tipo === "novo-contratado" || tipo === "sugestao-saida") {
    if (opcao === "agente" || opcao === "ouvir") {
      c.relacionamentos.agente = limitar(c.relacionamentos.agente + 3);
      j.personalidade.ambicao = limitar(j.personalidade.ambicao + 0.5);
      j.moral = limitar(j.moral + 1);
    } else {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 2);
      j.personalidade.lealdade = limitar(j.personalidade.lealdade + 0.4);
    }
  } else if (tipo === "rumor-transferencia") {
    if (opcao === "ficar") {
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria + 3);
      j.personalidade.lealdade = limitar(j.personalidade.lealdade + 0.6);
    } else {
      c.relacionamentos.agente = limitar(c.relacionamentos.agente + 2);
      j.reputacao = limitar(j.reputacao + 0.4);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 2);
    }
  } else if (tipo === "crise-resultados") {
    if (opcao === "apoiar") {
      c.relacionamentos.treinador = limitar(c.relacionamentos.treinador + 2);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria + 2);
      j.moral = limitar(j.moral - 1);
    } else {
      j.confianca = limitar(j.confianca + 1);
      c.relacionamentos.diretoria = limitar(c.relacionamentos.diretoria - 2);
    }
  }
}

/**
 * Gera até LIMITE_CENAS_POR_SEMANA cenas coerentes com o estado.
 * Reutiliza DecisaoPendente para escolhas e EventoCarreira para informações.
 */
export function gerarCenasSemana(
  carreira: EstadoCarreira,
  antes: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  if (carreira.decisoes.some((d) => !d.resolvida)) return;
  const hist = garantirCenas(carreira);
  if (hist.ultimaCena && somarDias(hist.ultimaCena, 5) > carreira.dataAtual) {
    // Evita semana lotada; ainda permite marcos de prioridade alta
  }

  const candidatos = coletarCandidatos(carreira, antes)
    .filter((cand) => !emCooldown(hist, cand.tipo, carreira.dataAtual, cand.cooldownDias))
    .sort((a, b) => b.prioridade - a.prioridade);

  let geradas = 0;
  const categoriasUsadas = new Set<CategoriaCena>();

  for (const cand of candidatos) {
    if (geradas >= LIMITE_CENAS_POR_SEMANA) break;
    if (categoriasUsadas.has(cand.categoria) && cand.prioridade < 85) continue;
    // Marcos quase sempre passam; demais precisam de um pouco de RNG
    if (cand.categoria !== "marco" && cand.prioridade < 80 && !aleatorio.chance(0.55))
      continue;

    registrarCenaNoHistorico(carreira, cand.tipo, cand.categoria);

    if (cand.opcoes && cand.opcoes.length > 0) {
      carreira.decisoes.push({
        id: `cena-${cand.tipo}-${carreira.dataAtual}`,
        data: carreira.dataAtual,
        tipo: `cena:${cand.tipo}`,
        remetente: cand.remetente,
        titulo: cand.titulo,
        texto: cand.texto,
        opcoes: cand.opcoes,
        resolvida: false,
      });
      geradas++;
      categoriasUsadas.add(cand.categoria);
      // Só uma decisão por semana via cenas
      break;
    }

    registrarEvento(
      carreira,
      `cena-${cand.tipo}`,
      cand.titulo,
      cand.texto,
      cand.remetente,
      cand.categoria === "marco",
    );
    geradas++;
    categoriasUsadas.add(cand.categoria);
  }
}

export function responderCena(
  carreira: EstadoCarreira,
  tipoDecisao: string,
  opcaoId: string,
): boolean {
  if (!tipoDecisao.startsWith("cena:")) return false;
  const tipo = tipoDecisao.slice(5) as TipoCena;
  aplicarConsequenciaEscolha(carreira, tipo, opcaoId);
  const hist = garantirCenas(carreira);
  const ultimo = hist.registros.filter((r) => r.tipo === tipo).at(-1);
  if (ultimo) ultimo.escolha = opcaoId;

  const textos: Record<string, string> = {
    humilde: "Você agradeceu e reforçou o trabalho coletivo.",
    cobrar: "Você pediu mais espaço — a comissão registrou o pedido.",
    aceitar: "Você engoliu a cobrança e voltou ao trabalho.",
    contestar: "A contestação pública aumentou sua exposição e o atrito.",
    trabalhar: "Você escolheu responder em campo.",
    coletivo: "A resposta coletiva agradou a comissão.",
    individual: "Você assumiu o protagonismo na entrevista.",
    criticar: "A crítica repercutiu — e desgastou relações.",
    diplomatica: "Tom diplomático aliviou a pressão.",
    confiante: "A confiança ganhou manchete.",
    provocativa: "Criticar o treinador elevou o conflito.",
    foco: "Você manteve o foco na disputa interna.",
    agente: "O agente passa a buscar alternativas com mais intensidade.",
    ouvir: "Você autorizou o agente a explorar o mercado.",
    ficar: "Você reforçou o compromisso com o clube.",
    abrir: "A porta ficou entreaberta para o mercado.",
    apoiar: "Você se posicionou com o grupo na crise.",
    distanciar: "Você priorizou a própria carreira neste momento.",
  };
  registrarEvento(
    carreira,
    "cena-resposta",
    "Sua resposta ecoou",
    textos[opcaoId] ?? "Sua escolha foi registrada na carreira.",
    "Imprensa",
    false,
  );
  return true;
}
