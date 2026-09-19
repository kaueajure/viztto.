import type {
  Clube,
  Escalacao,
  EventoPartida,
  Jogador,
  Partida,
  Participacao,
  Posicao,
} from "@/dominio/entidades/modelos";
import type {
  DecisaoPartidaPendente,
  InstrucaoTreinador,
  ModificadoresPartida,
  ObjetivoPartida,
  TipoDecisaoPartida,
} from "@/dominio/matchday";
import {
  criarModificadoresNeutros,
} from "@/dominio/matchday";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import { determinarEscalacao } from "./escalacao";
import {
  ajustarClubePeloJogador,
  aproximarReservaEntrante,
  aproximarTitularSubstituido,
  calcularGolsEsperados,
  calcularNotaJogador,
  chanceEntradaBanco,
  qualidadeSetorialJogador,
} from "./motor-partida";

export type OpcaoDecisaoAplicada = { tipo: TipoDecisaoPartida; opcao: string };

export interface OpcoesMotorCausal {
  escalacaoPreparada?: Escalacao;
  elencoProfissional?: boolean;
  instrucao?: InstrucaoTreinador;
  objetivos?: ObjetivoPartida[];
  modificadores?: ModificadoresPartida;
  /** Decisões já tomadas (modo instantâneo ou retomada). */
  decisoesAplicadas?: OpcaoDecisaoAplicada[];
  /**
   * Se true, pausa na primeira decisão ainda não respondida.
   * Se false, decisões não aplicadas usam a opção neutra (primeira).
   */
  interativo?: boolean;
}

export interface EstadoMotorCausal {
  partida: Partida;
  mandante: Clube;
  visitante: Clube;
  mandanteEfetivo: Clube;
  visitanteEfetivo: Clube;
  jogador?: Jogador;
  clubeJogadorId?: string;
  incentivo: number;
  instrucao: InstrucaoTreinador;
  objetivos: ObjetivoPartida[];
  modificadores: ModificadoresPartida;
  decisoesAplicadas: OpcaoDecisaoAplicada[];
  interativo: boolean;
  momentosPlanejados: MomentoPlanejado[];
  indiceMomento: number;
  golsMandante: number;
  golsVisitante: number;
  eventos: EventoPartida[];
  participacao: Participacao | null;
  amareloRegistrado: boolean;
  intervaloAvaliado: boolean;
  entradaBancoRegistrada: boolean;
  fadigaOferecida: boolean;
  perdendoOferecido: boolean;
  concluido: boolean;
  decisaoPendente: DecisaoPartidaPendente | null;
  seedEstadoInicial: number;
}

type Lado = "mandante" | "visitante";

interface MomentoPlanejado {
  minuto: number;
  lado: Lado;
}

function fatorInstrucao(
  instrucao: InstrucaoTreinador,
  etapa: "progressao" | "criacao" | "chance" | "conversao" | "defesa" | "cartao",
): number {
  const tabela: Record<InstrucaoTreinador, Partial<Record<typeof etapa, number>>> = {
    profundidade: { progressao: 1.12, chance: 1.08, conversao: 1.05 },
    simples: { progressao: 0.94, criacao: 0.92, conversao: 0.96, cartao: 0.7 },
    finalizacoes: { chance: 1.15, conversao: 1.12, criacao: 0.95 },
    criacao: { criacao: 1.18, chance: 1.06, conversao: 0.97 },
    pressionar: { progressao: 1.1, defesa: 1.08, cartao: 1.15 },
    proteger: { progressao: 0.9, defesa: 1.15, conversao: 0.92, cartao: 0.85 },
    "evitar-riscos": { progressao: 0.92, cartao: 0.55, conversao: 0.94 },
  };
  return tabela[instrucao][etapa] ?? 1;
}

function fatorMod(
  mod: ModificadoresPartida,
  etapa: "progressao" | "criacao" | "chance" | "conversao" | "defesa" | "cartao",
): number {
  let f = 1;
  f += mod.intensidade * 0.08;
  f += mod.protagonismo * (etapa === "chance" || etapa === "conversao" ? 0.12 : 0.04);
  f += mod.risco * (etapa === "conversao" || etapa === "chance" ? 0.1 : etapa === "cartao" ? 0.2 : 0);
  f += mod.agressividade * (etapa === "defesa" || etapa === "cartao" ? 0.15 : 0.05);
  return limitar(f, 0.55, 1.55);
}

function chanceParticipacao(
  jogador: Jogador,
  p: Participacao,
  minuto: number,
  ladoAtaque: boolean,
  instrucao: InstrucaoTreinador,
  mod: ModificadoresPartida,
): number {
  if (minuto <= p.entrada || minuto > p.saida || p.minutos <= 0) return 0;
  const pos = jogador.posicao;
  let base =
    pos === "GOL"
      ? ladoAtaque
        ? 0.02
        : 0.55
      : ["CA", "PD", "PE"].includes(pos)
        ? ladoAtaque
          ? 0.42
          : 0.12
        : pos === "MEI"
          ? ladoAtaque
            ? 0.38
            : 0.18
          : pos === "MC"
            ? ladoAtaque
              ? 0.32
              : 0.22
            : pos === "VOL"
              ? ladoAtaque
                ? 0.18
                : 0.36
              : pos === "ZAG"
                ? ladoAtaque
                  ? 0.1
                  : 0.4
                : ladoAtaque
                  ? 0.22
                  : 0.3;

  const a = jogador.atributos;
  const forma = 0.85 + jogador.forma / 350;
  const fadiga = 1 - jogador.fadiga / 280;
  const conf = 0.9 + jogador.confianca / 500;
  base *= forma * fadiga * conf;
  base *= 1 + mod.protagonismo * 0.25;
  base *= 1 + mod.intensidade * 0.1;

  if (instrucao === "criacao" && ["MC", "MEI", "PD", "PE"].includes(pos))
    base *= 1.12;
  if (instrucao === "finalizacoes" && ["CA", "PD", "PE", "MEI"].includes(pos))
    base *= 1.14;
  if (instrucao === "proteger" && ["ZAG", "VOL", "LD", "LE"].includes(pos))
    base *= 1.1;

  // Posicionamento / atributos relevantes
  if (ladoAtaque) {
    base *= 0.7 + a.posicionamento / 200;
  } else {
    base *= 0.7 + (a.antecipacao + a.marcacao) / 400;
  }

  return limitar(base, 0, 0.85);
}

function planejarMomentos(
  lambdaM: number,
  lambdaV: number,
  aleatorio: GeradorAleatorio,
): MomentoPlanejado[] {
  const totalAlvo = aleatorio.inteiro(36, 52);
  // Raiz amortece a diferença para permitir zebras sem anular a vantagem.
  const pesoM = Math.max(0.35, Math.sqrt(Math.max(0.2, lambdaM)));
  const pesoV = Math.max(0.35, Math.sqrt(Math.max(0.2, lambdaV)));
  const soma = pesoM + pesoV;
  const nM = Math.max(12, Math.round((totalAlvo * pesoM) / soma));
  const nV = Math.max(12, totalAlvo - nM);
  const momentos: MomentoPlanejado[] = [];
  for (let i = 0; i < nM; i++) {
    momentos.push({ minuto: aleatorio.inteiro(1, 90), lado: "mandante" });
  }
  for (let i = 0; i < nV; i++) {
    momentos.push({ minuto: aleatorio.inteiro(1, 90), lado: "visitante" });
  }
  momentos.sort((a, b) => a.minuto - b.minuto || (a.lado === "mandante" ? -1 : 1));
  return momentos;
}

function resolverEscalacaoEParticipacao(
  partida: Partida,
  mandante: Clube,
  visitante: Clube,
  aleatorio: GeradorAleatorio,
  jogador: Jogador | undefined,
  clubeJogadorId: string | undefined,
  incentivo: number,
  opcoes: OpcoesMotorCausal,
  modificadores: ModificadoresPartida,
): {
  participacao: Participacao | null;
  mandanteEfetivo: Clube;
  visitanteEfetivo: Clube;
} {
  let mandanteEfetivo = mandante;
  let visitanteEfetivo = visitante;
  if (!jogador || !clubeJogadorId) {
    return { participacao: null, mandanteEfetivo, visitanteEfetivo };
  }

  const clube = clubeJogadorId === mandante.id ? mandante : visitante;
  const oponente = clubeJogadorId === mandante.id ? visitante : mandante;
  const escalacao = determinarEscalacao(jogador, clube, aleatorio, incentivo, {
    escalacaoPreparada: opcoes.escalacaoPreparada,
    elencoProfissional: opcoes.elencoProfissional,
  });

  let entrada =
    escalacao === "titular"
      ? 0
      : escalacao === "banco" &&
          aleatorio.chance(chanceEntradaBanco(jogador, clube, oponente))
        ? aleatorio.chance(0.035)
          ? aleatorio.inteiro(15, 44)
          : aleatorio.inteiro(55, 85)
        : 90;
  let saida =
    entrada === 90
      ? 90
      : escalacao === "titular"
        ? aleatorio.inteiro(60, 90)
        : 90;

  if (modificadores.pedirSubstituicao && entrada < 90 && saida > entrada + 5) {
    saida = Math.min(saida, aleatorio.inteiro(entrada + 5, Math.min(85, saida)));
  }

  const amarelos = 0;
  const vermelhos = 0;
  const minutos = saida - entrada;
  const proporcao = minutos / 90;
  const participacao: Participacao = {
    escalacao,
    entrada,
    saida,
    minutos,
    gols: 0,
    assistencias: 0,
    chutes: 0,
    passes: Math.round(aleatorio.inteiro(18, 55) * proporcao),
    passesChave: 0,
    desarmes: 0,
    amarelos,
    vermelhos,
    faltas: 0,
    defesas: 0,
    nota: null,
    confianca: 0,
    moral: 0,
    desenvolvimento: 0,
  };

  const jaNaEscalacao =
    clube.titularesIds.includes("usuario") ||
    clube.goleiroTitularId === "usuario";
  const parceiroNoSlot = jaNaEscalacao
    ? minutos < 90
      ? aproximarReservaEntrante(clube, jogador.posicao)
      : null
    : aproximarTitularSubstituido(clube, jogador.posicao);
  const clubeAjustado = ajustarClubePeloJogador(
    clube,
    jogador,
    minutos,
    jaNaEscalacao,
    parceiroNoSlot,
  );
  if (clubeJogadorId === mandante.id) mandanteEfetivo = clubeAjustado;
  else visitanteEfetivo = clubeAjustado;

  return { participacao, mandanteEfetivo, visitanteEfetivo };
}

function definirDecisao(
  tipo: TipoDecisaoPartida,
  minuto: number,
): DecisaoPartidaPendente {
  const defs: Record<
    TipoDecisaoPartida,
    Omit<DecisaoPartidaPendente, "id" | "minuto">
  > = {
    amarelo: {
      tipo: "amarelo",
      titulo: "Cartão amarelo",
      texto: "Você recebeu um amarelo. Como segue o jogo?",
      opcoes: [
        { id: "neutro", rotulo: "Reduzir intensidade" },
        { id: "agressivo", rotulo: "Continuar agressivo" },
      ],
    },
    "intervalo-ruim": {
      tipo: "intervalo-ruim",
      titulo: "Intervalo",
      texto: "O primeiro tempo não foi bom. Qual postura no retorno?",
      opcoes: [
        { id: "neutro", rotulo: "Jogar simples" },
        { id: "risco", rotulo: "Assumir mais riscos" },
      ],
    },
    "entrada-banco": {
      tipo: "entrada-banco",
      titulo: "Você entra em campo",
      texto: "A comissão te coloca. Qual abordagem?",
      opcoes: [
        { id: "neutro", rotulo: "Equilibrar" },
        { id: "atacar", rotulo: "Atacar" },
        { id: "proteger", rotulo: "Proteger o resultado" },
      ],
    },
    perdendo: {
      tipo: "perdendo",
      titulo: "Placar desfavorável",
      texto: "O time está atrás no placar. Você busca protagonismo?",
      opcoes: [
        { id: "neutro", rotulo: "Seguir o plano" },
        { id: "protagonismo", rotulo: "Buscar protagonismo" },
      ],
    },
    fadiga: {
      tipo: "fadiga",
      titulo: "Fadiga alta",
      texto: "As pernas pesam. Pedir para sair ou continuar?",
      opcoes: [
        { id: "neutro", rotulo: "Continuar" },
        { id: "sair", rotulo: "Pedir substituição" },
      ],
    },
  };
  const d = defs[tipo];
  return {
    id: `dec-partida-${tipo}-${minuto}`,
    minuto,
    ...d,
  };
}

export function aplicarOpcaoDecisaoPartida(
  modificadores: ModificadoresPartida,
  tipo: TipoDecisaoPartida,
  opcao: string,
): ModificadoresPartida {
  const m = { ...modificadores };
  if (tipo === "amarelo") {
    if (opcao === "agressivo") {
      m.agressividade += 0.35;
      m.risco += 0.2;
    } else {
      m.agressividade -= 0.25;
      m.intensidade -= 0.1;
    }
  } else if (tipo === "intervalo-ruim") {
    if (opcao === "risco") {
      m.risco += 0.4;
      m.protagonismo += 0.2;
    } else {
      m.risco -= 0.15;
      m.intensidade -= 0.05;
    }
  } else if (tipo === "entrada-banco") {
    if (opcao === "atacar") {
      m.protagonismo += 0.45;
      m.risco += 0.2;
    } else if (opcao === "proteger") {
      m.protagonismo -= 0.1;
      m.intensidade -= 0.15;
    }
  } else if (tipo === "perdendo") {
    if (opcao === "protagonismo") {
      m.protagonismo += 0.5;
      m.risco += 0.25;
      m.intensidade += 0.2;
    }
  } else if (tipo === "fadiga") {
    if (opcao === "sair") m.pedirSubstituicao = true;
    else m.intensidade += 0.1;
  }
  return m;
}

function opcaoNeutra(tipo: TipoDecisaoPartida): string {
  return "neutro";
}

function decisaoJaAplicada(
  aplicadas: OpcaoDecisaoAplicada[],
  tipo: TipoDecisaoPartida,
): OpcaoDecisaoAplicada | undefined {
  return aplicadas.find((d) => d.tipo === tipo);
}

function tentarOferecerDecisao(
  estado: EstadoMotorCausal,
  tipo: TipoDecisaoPartida,
  minuto: number,
): boolean {
  if (decisaoJaAplicada(estado.decisoesAplicadas, tipo)) return false;
  if (estado.decisaoPendente) return false;

  if (estado.interativo) {
    estado.decisaoPendente = definirDecisao(tipo, minuto);
    return true;
  }

  // Instantâneo: consome a decisão com opção neutra (mesmo caminho que “seguir plano”).
  const opcao = opcaoNeutra(tipo);
  estado.decisoesAplicadas.push({ tipo, opcao });
  estado.modificadores = aplicarOpcaoDecisaoPartida(
    estado.modificadores,
    tipo,
    opcao,
  );
  return false;
}

function processarMomento(
  estado: EstadoMotorCausal,
  momento: MomentoPlanejado,
  aleatorio: GeradorAleatorio,
): void {
  const ataque =
    momento.lado === "mandante" ? estado.mandanteEfetivo : estado.visitanteEfetivo;
  const defesa =
    momento.lado === "mandante" ? estado.visitanteEfetivo : estado.mandanteEfetivo;
  const clubeAtaque =
    momento.lado === "mandante" ? estado.mandante : estado.visitante;
  const usuarioNoAtaque =
    !!estado.jogador &&
    estado.clubeJogadorId === ataque.id &&
    !!estado.participacao;
  const usuarioNaDefesa =
    !!estado.jogador &&
    estado.clubeJogadorId === defesa.id &&
    !!estado.participacao;

  const qSetor = estado.jogador
    ? qualidadeSetorialJogador(estado.jogador)
    : null;
  const a = estado.jogador?.atributos;
  const instrucao = estado.instrucao;
  const mod = estado.modificadores;
  const p = estado.participacao;

  const forcaProg =
    (ataque.forcaMeio - defesa.forcaMeio) * 0.008 +
    (ataque.forcaAtaque - defesa.forcaDefesa) * 0.006;
  const pProgressao = limitar(
    0.58 +
      forcaProg +
      (fatorInstrucao(instrucao, "progressao") - 1) * 0.25 +
      (fatorMod(mod, "progressao") - 1) * 0.25 +
      (aleatorio.proximo() - 0.5) * 0.12,
    0.28,
    0.88,
  );

  if (!aleatorio.chance(pProgressao)) return;

  // Usuário ajuda na progressão?
  if (
    usuarioNoAtaque &&
    p &&
    a &&
    aleatorio.chance(
      chanceParticipacao(
        estado.jogador!,
        p,
        momento.minuto,
        true,
        instrucao,
        mod,
      ) * 0.55,
    )
  ) {
    p.passes += 1;
    const progOk = aleatorio.chance(
      limitar(
        0.4 +
          (a.dominio + a.drible + a.agilidade) / 400 +
          (a.velocidade + a.aceleracao) / 500,
        0.2,
        0.9,
      ),
    );
    if (!progOk) return;
  }

  const pCriacao = limitar(
    0.5 +
      (ataque.forcaMeio - 70) * 0.004 +
      (fatorInstrucao(instrucao, "criacao") - 1) * 0.3 +
      (fatorMod(mod, "criacao") - 1) * 0.25 +
      (aleatorio.proximo() - 0.5) * 0.1,
    0.22,
    0.85,
  );
  if (!aleatorio.chance(pCriacao)) {
    // Defesa pode interceptar com o usuário
    if (
      usuarioNaDefesa &&
      p &&
      a &&
      aleatorio.chance(
        chanceParticipacao(
          estado.jogador!,
          p,
          momento.minuto,
          false,
          instrucao,
          mod,
        ),
      )
    ) {
      if (
        aleatorio.chance(
          limitar(
            0.35 +
              (a.desarme + a.marcacao + a.antecipacao) / 360 *
                fatorInstrucao(instrucao, "defesa") *
                fatorMod(mod, "defesa"),
            0.1,
            0.85,
          ),
        )
      ) {
        p.desarmes++;
        if (aleatorio.chance(0.25)) {
          estado.eventos.push({
            minuto: momento.minuto,
            tipo: "desarme",
            clubeId: defesa.id,
            jogador: true,
            texto: `Desarme importante de ${estado.jogador!.nome}`,
          });
        }
      }
    }
    return;
  }

  let assistenciaUsuario = false;
  if (
    usuarioNoAtaque &&
    p &&
    a &&
    estado.jogador!.posicao !== "GOL" &&
    aleatorio.chance(
      chanceParticipacao(
        estado.jogador!,
        p,
        momento.minuto,
        true,
        instrucao,
        mod,
      ) *
        (0.5 + a.visao / 200),
    )
  ) {
    p.passesChave++;
    assistenciaUsuario = aleatorio.chance(
      limitar(0.25 + (a.visao + a.passeCurto + a.decisao) / 450, 0.1, 0.7),
    );
    if (aleatorio.chance(0.35)) {
      estado.eventos.push({
        minuto: momento.minuto,
        tipo: "passe-chave",
        clubeId: ataque.id,
        jogador: true,
        texto: `Passe-chave de ${estado.jogador!.nome}`,
      });
    }
  }

  const pChance = limitar(
    0.4 +
      (ataque.forcaAtaque - defesa.forcaDefesa) * 0.005 +
      (fatorInstrucao(instrucao, "chance") - 1) * 0.3 +
      (fatorMod(mod, "chance") - 1) * 0.25 +
      (aleatorio.proximo() - 0.5) * 0.1,
    0.18,
    0.8,
  );
  if (!aleatorio.chance(pChance)) return;

  let finalizadorUsuario = false;
  if (
    usuarioNoAtaque &&
    p &&
    a &&
    estado.jogador!.posicao !== "GOL" &&
    aleatorio.chance(
      chanceParticipacao(
        estado.jogador!,
        p,
        momento.minuto,
        true,
        instrucao,
        mod,
      ) *
        (0.55 + a.posicionamento / 220),
    )
  ) {
    finalizadorUsuario = true;
    p.chutes++;
  }

  // Chance importante narrada
  if (finalizadorUsuario || aleatorio.chance(0.22)) {
    estado.eventos.push({
      minuto: momento.minuto,
      tipo: "chance",
      clubeId: ataque.id,
      jogador: finalizadorUsuario,
      texto: finalizadorUsuario
        ? `${estado.jogador!.nome} finaliza`
        : `Chance clara para ${clubeAtaque.codigo}`,
    });
  }

  // Goleiro/defesa do usuário
  if (usuarioNaDefesa && p && a && estado.jogador!.posicao === "GOL") {
    const defesaChance = limitar(
      0.35 +
        (a.reflexos + a.defesaGoleiro + a.posicionamentoGoleiro) / 400 *
          fatorMod(mod, "defesa"),
      0.15,
      0.8,
    );
    if (aleatorio.chance(defesaChance)) {
      p.defesas++;
      estado.eventos.push({
        minuto: momento.minuto,
        tipo: "defesa",
        clubeId: defesa.id,
        jogador: true,
        texto: `Grande defesa de ${estado.jogador!.nome}`,
      });
      return;
    }
  }

  const compostura = finalizadorUsuario && a ? a.compostura : 55;
  const finalizacao = finalizadorUsuario && a ? a.finalizacao : ataque.forcaAtaque;
  const pGol = limitar(
    0.16 +
      (finalizacao - 60) * 0.003 +
      (compostura - 50) * 0.0015 +
      (ataque.forcaAtaque - defesa.forcaDefesa) * 0.0035 +
      (fatorInstrucao(instrucao, "conversao") - 1) * 0.18 +
      (fatorMod(mod, "conversao") - 1) * 0.2 +
      (qSetor && finalizadorUsuario ? (qSetor.ataque - 60) * 0.002 : 0) +
      (aleatorio.proximo() - 0.5) * 0.1,
    0.05,
    0.42,
  );

  if (!aleatorio.chance(pGol)) {
    // Falta/cartão possível do usuário na disputa
    if (
      usuarioNaDefesa &&
      p &&
      a &&
      aleatorio.chance(
        0.04 *
          fatorInstrucao(instrucao, "cartao") *
          fatorMod(mod, "cartao") *
          (0.7 + a.agressividade / 200) *
          (1.3 - estado.jogador!.personalidade.disciplina / 200),
      )
    ) {
      p.faltas++;
      if (!estado.amareloRegistrado && aleatorio.chance(0.55)) {
        p.amarelos = 1;
        estado.amareloRegistrado = true;
        estado.eventos.push({
          minuto: momento.minuto,
          tipo: "cartao",
          clubeId: defesa.id,
          jogador: true,
          texto: `Amarelo para ${estado.jogador!.nome}`,
        });
        tentarOferecerDecisao(estado, "amarelo", momento.minuto);
      } else if (
        estado.amareloRegistrado &&
        p.amarelos >= 1 &&
        aleatorio.chance(0.12 * fatorMod(mod, "cartao"))
      ) {
        p.vermelhos = 1;
        p.saida = momento.minuto;
        p.minutos = Math.max(0, p.saida - p.entrada);
        estado.eventos.push({
          minuto: momento.minuto,
          tipo: "cartao",
          clubeId: defesa.id,
          jogador: true,
          texto: `Vermelho para ${estado.jogador!.nome}`,
        });
      }
    }
    return;
  }

  // GOL
  if (momento.lado === "mandante") estado.golsMandante++;
  else estado.golsVisitante++;

  if (finalizadorUsuario && p) p.gols++;
  if (assistenciaUsuario && p && !finalizadorUsuario) p.assistencias++;

  estado.eventos.push({
    minuto: momento.minuto,
    tipo: "gol",
    clubeId: ataque.id,
    jogador: !!(finalizadorUsuario || assistenciaUsuario),
    texto: finalizadorUsuario
      ? `Gol de ${estado.jogador!.nome}!`
      : assistenciaUsuario
        ? `Gol de ${clubeAtaque.codigo}. Assistência de ${estado.jogador!.nome}.`
        : `Gol de ${clubeAtaque.nome}`,
  });
}

export function iniciarMotorCausal(
  partida: Partida,
  mandante: Clube,
  visitante: Clube,
  aleatorio: GeradorAleatorio,
  jogador?: Jogador,
  clubeJogadorId?: string,
  incentivo = 0,
  opcoes: OpcoesMotorCausal = {},
): EstadoMotorCausal {
  const modificadores = {
    ...criarModificadoresNeutros(),
    ...(opcoes.modificadores ?? {}),
  };
  // Reaplica decisões já tomadas (ordem importa para o estado, não para RNG aqui)
  let mods = modificadores;
  for (const d of opcoes.decisoesAplicadas ?? []) {
    mods = aplicarOpcaoDecisaoPartida(mods, d.tipo, d.opcao);
  }

  const { participacao, mandanteEfetivo, visitanteEfetivo } =
    resolverEscalacaoEParticipacao(
      partida,
      mandante,
      visitante,
      aleatorio,
      jogador,
      clubeJogadorId,
      incentivo,
      opcoes,
      mods,
    );

  const momentoRodada = partida.rodada / 40;
  const lambdaM = calcularGolsEsperados(
    mandanteEfetivo,
    visitanteEfetivo,
    true,
    momentoRodada,
  );
  const lambdaV = calcularGolsEsperados(
    visitanteEfetivo,
    mandanteEfetivo,
    false,
    momentoRodada,
  );
  const momentosPlanejados = planejarMomentos(lambdaM, lambdaV, aleatorio);

  return {
    partida: { ...partida, eventos: [], golsMandante: null, golsVisitante: null },
    mandante,
    visitante,
    mandanteEfetivo,
    visitanteEfetivo,
    jogador,
    clubeJogadorId,
    incentivo,
    instrucao: opcoes.instrucao ?? "simples",
    objetivos: opcoes.objetivos ?? [],
    modificadores: mods,
    decisoesAplicadas: [...(opcoes.decisoesAplicadas ?? [])],
    interativo: !!opcoes.interativo,
    momentosPlanejados,
    indiceMomento: 0,
    golsMandante: 0,
    golsVisitante: 0,
    eventos: [],
    participacao,
    amareloRegistrado: false,
    intervaloAvaliado: false,
    entradaBancoRegistrada: false,
    fadigaOferecida: false,
    perdendoOferecido: false,
    concluido: false,
    decisaoPendente: null,
    seedEstadoInicial: aleatorio.estado,
  };
}

/**
 * Avança a simulação até o fim, até uma decisão pendente, ou até `ateMinuto`.
 */
export function avancarMotorCausal(
  estado: EstadoMotorCausal,
  aleatorio: GeradorAleatorio,
  ateMinuto = 90,
): EstadoMotorCausal {
  if (estado.concluido || estado.decisaoPendente) return estado;

  const p = estado.participacao;

  // Entrada do banco
  if (
    p &&
    p.escalacao === "banco" &&
    p.entrada < 90 &&
    !estado.entradaBancoRegistrada &&
    p.entrada <= ateMinuto
  ) {
    estado.entradaBancoRegistrada = true;
    estado.eventos.push({
      minuto: p.entrada,
      tipo: "substituicao",
      clubeId: estado.clubeJogadorId!,
      jogador: true,
      texto: `${estado.jogador!.nome} entra em campo`,
    });
    if (tentarOferecerDecisao(estado, "entrada-banco", p.entrada)) return estado;
  }

  while (estado.indiceMomento < estado.momentosPlanejados.length) {
    const momento = estado.momentosPlanejados[estado.indiceMomento]!;
    if (momento.minuto > ateMinuto) break;

    // Intervalo
    if (!estado.intervaloAvaliado && momento.minuto > 45) {
      estado.intervaloAvaliado = true;
      estado.eventos.push({
        minuto: 45,
        tipo: "intervalo",
        clubeId: "",
        jogador: false,
        texto: "Intervalo",
      });
      const notaParc =
        (estado.participacao?.chutes ?? 0) +
        (estado.participacao?.passesChave ?? 0) * 1.5 +
        (estado.participacao?.gols ?? 0) * 3;
      if (
        estado.participacao &&
        estado.participacao.minutos > 0 &&
        estado.participacao.entrada < 45 &&
        notaParc < 1.5
      ) {
        if (tentarOferecerDecisao(estado, "intervalo-ruim", 45)) return estado;
      }
    }

    processarMomento(estado, momento, aleatorio);
    estado.indiceMomento++;
    if (estado.decisaoPendente) return estado;

    // Perdendo
    if (
      estado.jogador &&
      estado.clubeJogadorId &&
      estado.participacao &&
      estado.participacao.minutos > 0 &&
      momento.minuto >= 55 &&
      !estado.perdendoOferecido
    ) {
      const golsPro =
        estado.clubeJogadorId === estado.mandante.id
          ? estado.golsMandante
          : estado.golsVisitante;
      const golsContra =
        estado.clubeJogadorId === estado.mandante.id
          ? estado.golsVisitante
          : estado.golsMandante;
      if (golsPro < golsContra) {
        estado.perdendoOferecido = true;
        if (tentarOferecerDecisao(estado, "perdendo", momento.minuto))
          return estado;
      }
    }

    // Fadiga
    if (
      estado.jogador &&
      estado.participacao &&
      estado.jogador.fadiga > 70 &&
      momento.minuto >= 60 &&
      estado.participacao.entrada < momento.minuto &&
      !estado.fadigaOferecida
    ) {
      estado.fadigaOferecida = true;
      if (tentarOferecerDecisao(estado, "fadiga", momento.minuto)) return estado;
    }
  }

  if (ateMinuto >= 90 && estado.indiceMomento >= estado.momentosPlanejados.length) {
    return finalizarMotorCausal(estado, aleatorio);
  }
  return estado;
}

export function responderDecisaoMotor(
  estado: EstadoMotorCausal,
  opcaoId: string,
  aleatorio: GeradorAleatorio,
): EstadoMotorCausal {
  if (!estado.decisaoPendente) return estado;
  const tipo = estado.decisaoPendente.tipo;
  estado.decisoesAplicadas.push({ tipo, opcao: opcaoId });
  estado.modificadores = aplicarOpcaoDecisaoPartida(
    estado.modificadores,
    tipo,
    opcaoId,
  );
  estado.decisaoPendente = null;

  // Pedido de substituição: encurta minutos se ainda em campo
  if (estado.modificadores.pedirSubstituicao && estado.participacao) {
    const p = estado.participacao;
    if (p.saida > p.entrada + 5 && p.vermelhos === 0) {
      const novo = Math.min(
        p.saida,
        Math.max(p.entrada + 5, aleatorio.inteiro(65, 82)),
      );
      if (novo < p.saida) {
        p.saida = novo;
        p.minutos = p.saida - p.entrada;
        estado.eventos.push({
          minuto: p.saida,
          tipo: "substituicao",
          clubeId: estado.clubeJogadorId!,
          jogador: true,
          texto: `${estado.jogador!.nome} pede para sair e é substituído`,
        });
      }
    }
  }

  return avancarMotorCausal(estado, aleatorio);
}

export function finalizarMotorCausal(
  estado: EstadoMotorCausal,
  aleatorio: GeradorAleatorio,
): EstadoMotorCausal {
  const p = estado.participacao;
  if (p && estado.jogador && p.minutos > 0) {
    // Substituição de saída (titular) se ainda não narrada
    if (
      p.saida < 90 &&
      !p.vermelhos &&
      !estado.eventos.some(
        (e) =>
          e.tipo === "substituicao" &&
          e.jogador &&
          e.texto.includes("substituído"),
      )
    ) {
      estado.eventos.push({
        minuto: p.saida,
        tipo: "substituicao",
        clubeId: estado.clubeJogadorId!,
        jogador: true,
        texto: `${estado.jogador.nome} é substituído`,
      });
    }

    // Garante coerência mínima: chutes >= gols, passes-chave >= assistências
    p.chutes = Math.max(p.chutes, p.gols);
    p.passesChave = Math.max(p.passesChave, p.assistencias);
    p.faltas = Math.max(p.faltas, p.amarelos);

    const sofridos =
      estado.clubeJogadorId === estado.mandante.id
        ? estado.golsVisitante
        : estado.golsMandante;
    p.nota = calcularNotaJogador(
      p,
      estado.jogador.posicao,
      sofridos,
      (aleatorio.proximo() - 0.5) * 1.1 + (estado.jogador.forma - 50) * 0.006,
    );
    p.confianca = Math.round((p.nota - 6.5) * 3);
    p.moral = Math.round((p.nota - 6.4) * 2);
  }

  estado.eventos.push({
    minuto: 93,
    tipo: "fim",
    clubeId: "",
    jogador: false,
    texto: "Fim de jogo",
  });
  estado.eventos.sort((a, b) => a.minuto - b.minuto);

  estado.partida = {
    ...estado.partida,
    golsMandante: estado.golsMandante,
    golsVisitante: estado.golsVisitante,
    eventos: estado.eventos,
    participacao: estado.participacao,
  };
  estado.concluido = true;
  return estado;
}

/** Simula a partida por completo (equivalente ao modo instantâneo). */
export function simularPartidaCausal(
  partida: Partida,
  mandante: Clube,
  visitante: Clube,
  aleatorio: GeradorAleatorio,
  jogador?: Jogador,
  clubeJogadorId?: string,
  incentivo = 0,
  opcoes: OpcoesMotorCausal = {},
): Partida {
  if (partida.golsMandante !== null) return partida;
  let estado = iniciarMotorCausal(
    partida,
    mandante,
    visitante,
    aleatorio,
    jogador,
    clubeJogadorId,
    incentivo,
    { ...opcoes, interativo: false },
  );
  estado = avancarMotorCausal(estado, aleatorio, 90);
  // Segurança: se ainda houver decisão (não deveria no modo não-interativo)
  while (estado.decisaoPendente) {
    estado = responderDecisaoMotor(
      estado,
      opcaoNeutra(estado.decisaoPendente.tipo),
      aleatorio,
    );
  }
  if (!estado.concluido) estado = finalizarMotorCausal(estado, aleatorio);
  return estado.partida;
}
