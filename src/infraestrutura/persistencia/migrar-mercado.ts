import type { MercadoCarreira } from "@/dominio/mercado";

type StatusPedidoSaida = MercadoCarreira["statusPedidoSaida"];

/**
 * Prefixo de histórico gravado pelo motor ao registrar o pedido.
 * Mais estável que o texto livre da diretoria.
 */
const PREFIXO_HISTORICO_ACEITO =
  /^Pedido privado de transferência registrado|^Seu pedido de saída se tornou público/i;
const PREFIXO_HISTORICO_RECUSADO =
  /^Pedido de transferência analisado/i;

/**
 * Último recurso: saves antigos inconsistentes (ex.: pediuSaida=true com
 * resposta de recusa) sem statusPedidoSaida nem histórico estruturado.
 * Documentado e coberto por teste; não é o caminho principal.
 */
function statusPorTextoLivre(resposta: string): StatusPedidoSaida | null {
  if (/recusou|recusado|negou|negado/i.test(resposta)) return "recusado";
  if (/aceitou|autorizou|disponibiliz/i.test(resposta)) return "aceito";
  return null;
}

function statusDoHistorico(
  historico: unknown,
): StatusPedidoSaida | null {
  if (!Array.isArray(historico)) return null;
  for (let i = historico.length - 1; i >= 0; i--) {
    const entrada = historico[i];
    if (!entrada || typeof entrada !== "object") continue;
    const texto = String((entrada as { texto?: unknown }).texto ?? "");
    if (PREFIXO_HISTORICO_RECUSADO.test(texto)) return "recusado";
    if (PREFIXO_HISTORICO_ACEITO.test(texto)) return "aceito";
  }
  return null;
}

/**
 * Inferência determinística de statusPedidoSaida para saves pré-campo.
 * Ordem: campo estruturado → pedidoPublico → historico (prefixos do motor) →
 * pediuSaida → fallback textual da resposta (último recurso).
 */
export function inferirStatusPedidoSaida(
  mercado: Record<string, unknown>,
): StatusPedidoSaida {
  const atual = mercado.statusPedidoSaida;
  if (atual === "nenhum" || atual === "aceito" || atual === "recusado") {
    return atual;
  }

  if (mercado.pedidoPublico === true) return "aceito";

  const doHistorico = statusDoHistorico(mercado.historico);
  if (doHistorico) return doHistorico;

  if (mercado.pediuSaida === true) {
    const textual = statusPorTextoLivre(
      String(mercado.respostaDiretoriaSaida ?? ""),
    );
    // Save legado inconsistente: pediuSaida=true mas resposta de recusa.
    if (textual === "recusado") return "recusado";
    return "aceito";
  }

  if (typeof mercado.respostaDiretoriaSaida === "string" && mercado.respostaDiretoriaSaida) {
    const textual = statusPorTextoLivre(mercado.respostaDiretoriaSaida);
    if (textual) return textual;
  }

  return "nenhum";
}

/** Migra campos de mercado de saves Fase 05/06 sem perder progresso. */
export function migrarMercadoPersistido(valor: unknown): unknown {
  if (!valor || typeof valor !== "object") return valor;
  const raiz = valor as Record<string, unknown>;
  const mercado = raiz.mercado;
  if (!mercado || typeof mercado !== "object") return valor;
  const m = { ...(mercado as Record<string, unknown>) };

  const status = inferirStatusPedidoSaida(m);
  m.statusPedidoSaida = status;
  if (status === "aceito") m.pediuSaida = true;
  else m.pediuSaida = false;

  // Novidade ≠ estado: respostas já existentes sem flag viram "não lidas"
  // para o jogador poder limpar o badge; sem resposta → lidas.
  if (typeof m.respostaSaidaLida !== "boolean") {
    m.respostaSaidaLida = !(
      typeof m.respostaDiretoriaSaida === "string" &&
      m.respostaDiretoriaSaida.length > 0 &&
      status !== "nenhum"
    );
  }
  if (typeof m.respostaEmprestimoLida !== "boolean") {
    m.respostaEmprestimoLida = !(
      typeof m.respostaDiretoriaEmprestimo === "string" &&
      m.respostaDiretoriaEmprestimo.length > 0 &&
      m.pediuEmprestimo === true
    );
  }

  if (Array.isArray(m.historico)) {
    m.historico = m.historico.map((entrada) => {
      if (!entrada || typeof entrada !== "object") return entrada;
      const h = { ...(entrada as Record<string, unknown>) };
      if (h.termos && typeof h.termos === "object") {
        const t = h.termos as Record<string, unknown>;
        const termos: Record<string, unknown> = {
          salario: t.salario,
          duracaoAnos: t.duracaoAnos,
          papelPrometido: t.papelPrometido,
        };
        if (typeof t.clausulaRescisao === "number")
          termos.clausulaRescisao = t.clausulaRescisao;
        h.termos = termos;
      }
      return h;
    });
  }

  return { ...raiz, mercado: m };
}
