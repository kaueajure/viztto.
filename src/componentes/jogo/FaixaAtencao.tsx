"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import {
  coletarAcoesAtencao,
  type AcaoAtencao,
} from "./AtencaoCarreira";
import { DecisoesInicio } from "./DecisoesInicio";
import { PropostasInicio } from "./PropostasInicio";
import { X } from "lucide-react";
import { useFocoModal } from "@/componentes/interface/useFocoModal";

type Painel = "central" | "decisoes" | "propostas" | null;

function abrirTipo(acao: AcaoAtencao): "decisoes" | "propostas" | "link" | "nenhum" {
  if (acao.id.startsWith("dec-")) return "decisoes";
  if (acao.id.startsWith("prop-")) return "propostas";
  if (acao.href) return "link";
  return "nenhum";
}

/** Faixa compacta: ação principal + contador. Central lista todas as pendências. */
export function FaixaAtencao({ carreira: c }: { carreira: EstadoCarreira }) {
  const acoes = coletarAcoesAtencao(c);
  const principal = acoes[0];
  const extras = Math.max(0, acoes.length - 1);
  const [painel, definirPainel] = useState<Painel>(null);
  const tituloId = useId();
  useFocoModal(!!painel, () => definirPainel(null), painel ?? "fechado");

  const decisoesPendentes = (c.decisoes ?? []).filter((d) => !d.resolvida).length;
  const propostasPendentes = c.propostas.filter(
    (p) => p.status === "pendente" && p.validade >= c.dataAtual,
  ).length;

  // Após responder a última decisão/proposta, fecha o overlay vazio.
  useEffect(() => {
    if (painel === "decisoes" && decisoesPendentes === 0) definirPainel(null);
    if (painel === "propostas" && propostasPendentes === 0) definirPainel(null);
  }, [painel, decisoesPendentes, propostasPendentes]);

  if (!principal) return null;

  const tipoPrincipal = abrirTipo(principal);

  return (
    <>
      <div className="vz-rail" role="status">
        <span className="vz-rail-label">AÇÃO NECESSÁRIA</span>
        <p className="vz-rail-texto">
          {principal.titulo}
          {principal.detalhe ? ` · ${principal.detalhe}` : ""}
        </p>
        {tipoPrincipal === "decisoes" || tipoPrincipal === "propostas" ? (
          <button
            type="button"
            className="vz-rail-cta"
            onClick={() => definirPainel(tipoPrincipal)}
          >
            {principal.cta ?? "Ver"}
          </button>
        ) : principal.href ? (
          <Link href={principal.href} className="vz-rail-cta">
            {principal.cta ?? "Ver"}
          </Link>
        ) : null}
        {extras > 0 && (
          <button
            type="button"
            className="vz-rail-mais"
            onClick={() => definirPainel("central")}
          >
            +{extras} pendência{extras > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {painel === "central" && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className="dialogo vz-dialogo-acoes"
          >
            <div className="linha-titulo">
              <h2 id={tituloId}>Central de ações</h2>
              <button
                className="botao-icone"
                aria-label="Fechar"
                onClick={() => definirPainel(null)}
              >
                <X />
              </button>
            </div>
            <ol className="vz-central-acoes">
              {acoes.map((acao, i) => {
                const tipo = abrirTipo(acao);
                return (
                  <li key={acao.id}>
                    <span className="vz-central-idx">{i + 1}</span>
                    <div>
                      <b>{acao.titulo}</b>
                      {acao.detalhe && <p>{acao.detalhe}</p>}
                    </div>
                    {tipo === "decisoes" ? (
                      <button
                        type="button"
                        className="botao-texto"
                        onClick={() => definirPainel("decisoes")}
                      >
                        {acao.cta ?? "Responder"}
                      </button>
                    ) : tipo === "propostas" ? (
                      <button
                        type="button"
                        className="botao-texto"
                        onClick={() => definirPainel("propostas")}
                      >
                        {acao.cta ?? "Responder"}
                      </button>
                    ) : acao.href ? (
                      <Link
                        href={acao.href}
                        className="botao-texto"
                        onClick={() => definirPainel(null)}
                      >
                        {acao.cta ?? "Ver"}
                      </Link>
                    ) : (
                      <span className="texto-suave">Informativo</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}

      {painel === "decisoes" && decisoesPendentes > 0 && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${tituloId}-sub`}
            className="dialogo vz-dialogo-acoes"
          >
            <div className="linha-titulo">
              <h2 id={`${tituloId}-sub`}>Decisões</h2>
              <button
                className="botao-icone"
                aria-label="Fechar"
                onClick={() => definirPainel(null)}
              >
                <X />
              </button>
            </div>
            <DecisoesInicio carreira={c} />
            {acoes.length > 1 && (
              <button
                type="button"
                className="botao-texto espaco"
                onClick={() => definirPainel("central")}
              >
                ← Voltar à central
              </button>
            )}
          </section>
        </div>
      )}

      {painel === "propostas" && propostasPendentes > 0 && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${tituloId}-prop`}
            className="dialogo vz-dialogo-acoes"
          >
            <div className="linha-titulo">
              <h2 id={`${tituloId}-prop`}>Propostas</h2>
              <button
                className="botao-icone"
                aria-label="Fechar"
                onClick={() => definirPainel(null)}
              >
                <X />
              </button>
            </div>
            <PropostasInicio carreira={c} />
            {acoes.length > 1 && (
              <button
                type="button"
                className="botao-texto espaco"
                onClick={() => definirPainel("central")}
              >
                ← Voltar à central
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
