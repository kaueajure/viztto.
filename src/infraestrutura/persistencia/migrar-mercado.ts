import type { MercadoCarreira } from "@/dominio/mercado";

type StatusPedidoSaida = MercadoCarreira["statusPedidoSaida"];

function statusDeSaveAntigo(mercado: Record<string, unknown>): StatusPedidoSaida {
  const resposta = String(mercado.respostaDiretoriaSaida ?? "");
  if (/recusou|recusado|negou|negado/i.test(resposta)) return "recusado";
  if (mercado.pediuSaida === true) return "aceito";
  return "nenhum";
}

/** Migra campos de mercado de saves Fase 05/06 sem perder progresso. */
export function migrarMercadoPersistido(valor: unknown): unknown {
  if (!valor || typeof valor !== "object") return valor;
  const raiz = valor as Record<string, unknown>;
  const mercado = raiz.mercado;
  if (!mercado || typeof mercado !== "object") return valor;
  const m = { ...(mercado as Record<string, unknown>) };

  if (
    m.statusPedidoSaida !== "nenhum" &&
    m.statusPedidoSaida !== "aceito" &&
    m.statusPedidoSaida !== "recusado"
  ) {
    const status = statusDeSaveAntigo(m);
    m.statusPedidoSaida = status;
    if (status === "recusado") m.pediuSaida = false;
    if (status === "aceito") m.pediuSaida = true;
    if (status === "nenhum") m.pediuSaida = false;
  } else if (m.statusPedidoSaida === "aceito") {
    m.pediuSaida = true;
  } else if (m.statusPedidoSaida === "recusado" || m.statusPedidoSaida === "nenhum") {
    m.pediuSaida = false;
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
