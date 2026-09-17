"use client";
import Link from "next/link";
import { useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { coletarAcoesAtencao } from "./AtencaoCarreira";
import { DecisoesInicio } from "./DecisoesInicio";
import { PropostasInicio } from "./PropostasInicio";
import { X } from "lucide-react";
import { useFocoModal } from "@/componentes/interface/useFocoModal";

/** Faixa compacta (~36px). Só a ação mais urgente. Painéis completos abrem em overlay. */
export function FaixaAtencao({ carreira: c }: { carreira: EstadoCarreira }) {
  const acoes = coletarAcoesAtencao(c);
  const principal = acoes[0];
  const [painel, definirPainel] = useState<"decisoes" | "propostas" | null>(
    null,
  );
  useFocoModal(!!painel, () => definirPainel(null));

  const temDecisoes = (c.decisoes ?? []).some((d) => !d.resolvida);
  const temPropostas = c.propostas.some(
    (p) => p.status === "pendente" && p.validade >= c.dataAtual,
  );

  if (!principal && !temDecisoes && !temPropostas) return null;

  const acao = principal ?? {
    id: "fallback",
    titulo: temDecisoes
      ? "Há uma decisão pendente"
      : "Há uma proposta aguardando",
    cta: "Ver",
    href: temPropostas ? "/carreira/mercado" : undefined,
  };

  function abrirAcao() {
    if (temDecisoes && (acao.id.startsWith("dec-") || !temPropostas)) {
      definirPainel("decisoes");
      return;
    }
    if (temPropostas && (acao.id.startsWith("prop-") || acao.href?.includes("mercado"))) {
      definirPainel("propostas");
      return;
    }
  }

  const precisaOverlay =
    acao.id.startsWith("dec-") ||
    acao.id.startsWith("prop-") ||
    (!acao.href && (temDecisoes || temPropostas));

  return (
    <>
      <div className="vz-rail" role="status">
        <span className="vz-rail-label">AÇÃO NECESSÁRIA</span>
        <p className="vz-rail-texto">
          {acao.titulo}
          {acao.detalhe ? ` · ${acao.detalhe}` : ""}
        </p>
        {precisaOverlay ? (
          <button type="button" className="vz-rail-cta" onClick={abrirAcao}>
            {acao.cta ?? "Ver"}
          </button>
        ) : acao.href ? (
          <Link href={acao.href} className="vz-rail-cta">
            {acao.cta ?? "Ver"}
          </Link>
        ) : null}
      </div>

      {painel && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="acoes-urgentes-titulo"
            className="dialogo vz-dialogo-acoes"
          >
            <div className="linha-titulo">
              <h2 id="acoes-urgentes-titulo">
                {painel === "decisoes" ? "Decisões" : "Propostas"}
              </h2>
              <button
                className="botao-icone"
                aria-label="Fechar"
                onClick={() => definirPainel(null)}
              >
                <X />
              </button>
            </div>
            {painel === "decisoes" ? (
              <DecisoesInicio carreira={c} />
            ) : (
              <PropostasInicio carreira={c} />
            )}
          </section>
        </div>
      )}
    </>
  );
}
