import type {
  Clube,
  Contrato,
  EstadoCarreira,
  HistoricoContrato,
} from "@/dominio/entidades/modelos";
import { criarCooldownsTreinador } from "@/dominio/desenvolvimento";
import { registrarEvento } from "@/simulacao/eventos/eventos";
import { registrarNegociacao } from "@/simulacao/transferencias/mercado-progressivo";
import { somarDias } from "@/utilitarios/formatacao";

export function estaSemClube(c: EstadoCarreira): boolean {
  return c.clubeAtualId === null;
}

export function clubeAtual(c: EstadoCarreira): Clube | undefined {
  return c.clubeAtualId
    ? c.clubes.find((cl) => cl.id === c.clubeAtualId)
    : undefined;
}

export function semanasSemClube(c: EstadoCarreira): number {
  if (!c.agenteLivreDesde) return 0;
  return Math.max(
    0,
    Math.floor(
      (Date.parse(c.dataAtual) - Date.parse(c.agenteLivreDesde)) / 604800000,
    ),
  );
}

export function arquivarContrato(
  contrato: Contrato,
  dataFim: string,
  motivo: HistoricoContrato["motivoSaida"],
): HistoricoContrato {
  return {
    clubeId: contrato.clubeId,
    salario: contrato.salario,
    dataInicio: contrato.dataInicio,
    dataTermino: dataFim,
    papelEsperado: contrato.papelEsperado,
    tipo: contrato.tipo,
    motivoSaida: motivo,
  };
}

/** Tem acordo já aceito para mudar de clube imediatamente (ou no dia). */
export function temAcordoDefinitivoPendente(c: EstadoCarreira): boolean {
  return c.propostas.some(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro") &&
      (!p.efetivarEm || p.efetivarEm <= c.dataAtual),
  );
}

/** Pré-contrato aguardando o fim do vínculo (ainda não na data de efetivação). */
export function temPreContratoAguardando(c: EstadoCarreira): boolean {
  return c.propostas.some(
    (p) =>
      p.status === "aceita" &&
      p.etapa === "acordo" &&
      !!p.efetivarEm &&
      p.efetivarEm > c.dataAtual,
  );
}

/**
 * Transforma o jogador em agente livre.
 * Não cria vínculo provisório nem reduz salário automaticamente.
 */
export function tornarAgenteLivre(
  c: EstadoCarreira,
  motivo: "fim_contrato" | "fim_emprestimo_sem_contrato" = "fim_contrato",
): void {
  if (estaSemClube(c)) return;
  const j = c.jogador;
  const antigoId = c.clubeAtualId!;
  const antigo = c.clubes.find((cl) => cl.id === antigoId);
  const nomeClube = antigo?.nome ?? "seu clube";

  c.historicoContratos = [
    ...c.historicoContratos,
    arquivarContrato(
      j.contrato,
      c.dataAtual < j.contrato.dataTermino
        ? c.dataAtual
        : j.contrato.dataTermino,
      motivo === "fim_emprestimo_sem_contrato" ? "fim_contrato" : "fim_contrato",
    ),
  ].slice(-20);

  c.ultimoClubeId = antigoId;
  c.clubeAtualId = null;
  c.agenteLivreDesde = c.dataAtual;

  // Encerra empréstimo: não há vínculo empregatício sem contrato de origem.
  delete c.mercado.emprestimo;
  c.mercado.pediuEmprestimo = false;
  c.mercado.disponivelParaEmprestimo = false;

  // Relacionamentos de clube deixam de ser ativos (histórico permanece nos números).
  const a = c.acompanhamento;
  if (a.promessa?.status === "ativa") {
    a.promessa.status = "encerrada";
    registrarEvento(
      c,
      "promessa",
      "Compromisso com a comissão anterior encerrado",
      "O fim do contrato encerrou a promessa do treinador anterior.",
      "Treinador",
      false,
    );
  }
  a.adaptacao = null;
  a.cooldownsTreinador = criarCooldownsTreinador();
  a.papelAceito = null;
  a.proximoPedidoContrato = null;
  a.base = {
    ultimaAvaliacao: null,
    texto: null,
    treinosProfissional: 0,
    conviteAte: null,
  };
  if (a.objetivoPessoal && !a.objetivoPessoal.concluido) {
    const tipo = a.objetivoPessoal.tipo;
    if (tipo === "titular" || tipo === "minutos" || tipo === "renovacao") {
      a.objetivoPessoal = null;
      registrarEvento(
        c,
        "objetivo",
        "Objetivo pessoal suspenso",
        "Sem clube, objetivos ligados a minutos, titularidade ou renovação foram suspensos. Escolha um novo foco quando assinar.",
        "Agente",
        false,
      );
    }
  }

  j.status = "reserva";
  // Contrato permanece como snapshot do último vínculo; salário não é mais pago.
  j.contrato = {
    ...j.contrato,
    clubeId: antigoId,
    salario: 0,
    dataTermino: c.dataAtual < j.contrato.dataTermino ? c.dataAtual : j.contrato.dataTermino,
  };

  registrarEvento(
    c,
    "fim-contrato",
    "FIM DE CONTRATO",
    `Seu vínculo com o ${nomeClube} chegou ao fim. Você agora é agente livre e pode negociar com outros clubes.`,
    "Agente",
  );
  registrarNegociacao(
    c,
    antigoId,
    "Seu contrato terminou. Você agora está sem clube. Busque oportunidades, contate um clube específico, ajuste expectativa salarial ou reveja preferências de liga/país.",
  );
}

/** Efeitos semanais enquanto agente livre (treino individual + erosão leve). */
export function processarSemanaAgenteLivre(c: EstadoCarreira): void {
  if (!estaSemClube(c)) return;
  const j = c.jogador;
  const semanas = semanasSemClube(c);
  // Ritmo e forma caem gradualmente; atributos não são destruídos.
  if (semanas >= 2) {
    j.ritmo = Math.max(20, j.ritmo - (semanas >= 8 ? 2.5 : 1.2));
    j.forma = Math.max(35, j.forma - (semanas >= 12 ? 1.5 : 0.6));
  }
  if (semanas >= 12) {
    j.reputacao = Math.max(0, j.reputacao - 0.15);
  }
  // Condicionamento: treino individual mantém parcialmente (feito em processarTreinamento).
}

/** Ao assinar com novo clube, limpa estado de agente livre. */
export function limparEstadoAgenteLivre(c: EstadoCarreira): void {
  c.agenteLivreDesde = null;
}

/** Contratação de agente livre: imediata, fora da janela, sem taxa. */
export function podeRegistrarAgenteLivreImediato(c: EstadoCarreira): boolean {
  return estaSemClube(c);
}

export function diasAteFimContrato(c: EstadoCarreira): number | null {
  if (estaSemClube(c)) return null;
  return Math.ceil(
    (Date.parse(c.jogador.contrato.dataTermino) - Date.parse(c.dataAtual)) /
      86400000,
  );
}

export function alertaFimContrato(c: EstadoCarreira): {
  nivel: "leve" | "importante" | "forte" | "urgente";
  dias: number;
  texto: string;
} | null {
  const dias = diasAteFimContrato(c);
  if (dias === null || dias > 365 || dias < 0) return null;
  const temAcordo = c.propostas.some(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" ||
        p.etapa === "acordo_futuro" ||
        p.tipo === "renovacao"),
  );
  const semAcordo =
    !temAcordo &&
    !c.propostas.some(
      (p) => p.tipo === "renovacao" && p.status === "pendente",
    );
  if (dias <= 31) {
    return {
      nivel: "urgente",
      dias,
      texto: semAcordo
        ? `Seu contrato termina em ${dias} dia(s) e você ainda não possui acordo para a próxima temporada.`
        : `Seu contrato termina em ${dias} dia(s).`,
    };
  }
  if (dias <= 92)
    return {
      nivel: "forte",
      dias,
      texto: `Contrato termina em cerca de ${Math.ceil(dias / 30)} mês(es). ${semAcordo ? "Negocie renovação ou um destino." : ""}`.trim(),
    };
  if (dias <= 183)
    return {
      nivel: "importante",
      dias,
      texto: `Faltam cerca de ${Math.ceil(dias / 30)} meses para o fim do contrato.`,
    };
  return {
    nivel: "leve",
    dias,
    texto: `Contrato válido até ${c.jogador.contrato.dataTermino}.`,
  };
}

/** Utilitário para testes/UI: data N dias após. */
export function daquiA(data: string, dias: number): string {
  return somarDias(data, dias);
}
