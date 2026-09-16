"use client";
import { Contraproposta } from "./Contraproposta";
import { obterSituacaoJanela } from "@/simulacao/transferencias/necessidade";
import { useEffect, useRef, useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
import { dinheiro, formatarData } from "@/utilitarios/formatacao";
export function PropostasInicio({ carreira }: { carreira: EstadoCarreira }) {
  const responder = useJogoStore((s) => s.responder);
  const [confirmacao, definirConfirmacao] = useState<string | null>(null);
  const painel = useRef<HTMLElement>(null);
  const anteriores = useRef(new Set<string>());
  const propostas = carreira.propostas.filter(
    (p) => p.status === "pendente" && p.validade >= carreira.dataAtual,
  );
  const ids = propostas.map((p) => p.id).join("|");
  useEffect(() => {
    const atuais = ids ? ids.split("|") : [];
    if (atuais.some((id) => !anteriores.current.has(id)))
      painel.current?.scrollIntoView({ block: "start", behavior: "instant" });
    anteriores.current = new Set(atuais);
  }, [ids]);
  if (!propostas.length) return null;
  const janela = obterSituacaoJanela(carreira.dataAtual);
  return (
    <section
      ref={painel}
      className="propostas-inicio"
      aria-label="Propostas pendentes"
    >
      <div className="linha-titulo">
        <h2>SEU AGENTE TEM NOVIDADES</h2>
        <span role="status">
          {propostas.length} proposta{propostas.length > 1 ? "s" : ""}{" "}
          aguardando resposta
        </span>
      </div>
      {propostas.map((proposta) => {
        const clube = carreira.clubes.find((c) => c.id === proposta.clubeId)!;
        const formal =
          !proposta.contrapropostaPendente &&
          ["proposta_jogador", "negociacao"].includes(proposta.etapa);
        const podeAceitar = formal;
        const agendada =
          formal &&
          proposta.tipo !== "renovacao" &&
          !proposta.preContrato &&
          !janela.aberta;
        const tipoRotulo =
          proposta.tipo === "renovacao"
            ? "RENOVAÇÃO DE CONTRATO"
            : proposta.tipo === "emprestimo"
              ? "PROPOSTA DE EMPRÉSTIMO"
              : "PROPOSTA DE TRANSFERÊNCIA";
        return (
          <article className="oferta-inicio" key={proposta.id}>
            <div className="nome-clube">
              <Escudo clube={clube} tamanho={42} />
              <div>
                <span className="sobretitulo">{tipoRotulo}</span>
                <h3>{clube.nome}</h3>
              </div>
            </div>
            <div className="condicoes-oferta">
              <b>{dinheiro(proposta.salario)} / semana</b>
              <span>
                {proposta.duracaoAnos} anos · Papel:{" "}
                {(proposta.papelPrometido ?? "rotacao").replace(
                  "rotacao",
                  "rotação",
                )}{" "}
                · Elenco {clube.forcaGeral}
              </span>
              {proposta.etapa === "sondagem" && (
                <span>Sondagem (ainda sem oferta formal)</span>
              )}
              {proposta.preContrato && (
                <span>
                  Pré-contrato · chegada após o vínculo atual:{" "}
                  {formatarData(proposta.efetivarEm!)}
                </span>
              )}
              {agendada && (
                <span>
                  Janela fechada: ao aceitar, a mudança fica agendada para{" "}
                  {formatarData(janela.proximaAbertura)}.
                </span>
              )}
              {proposta.tipo === "emprestimo" && (
                <span>
                  Empréstimo · clube cobre{" "}
                  {Math.round((proposta.percentualSalario ?? 0.5) * 100)}% do
                  salário
                </span>
              )}
              {proposta.clausulaRescisao && (
                <span>Cláusula: {dinheiro(proposta.clausulaRescisao)}</span>
              )}
              {!!proposta.bonusGol && (
                <span>Bônus por gol: {dinheiro(proposta.bonusGol)}</span>
              )}
              {!!proposta.luvas && (
                <span>Luvas: {dinheiro(proposta.luvas)}</span>
              )}
              {!podeAceitar && !proposta.contrapropostaPendente && (
                <span>Aguarde uma oferta contratual formal.</span>
              )}
              <span>Responder até {formatarData(proposta.validade)}</span>
            </div>
            <div className="acoes-oferta">
              {confirmacao === proposta.id ? (
                <>
                  <p>
                    {proposta.tipo === "renovacao"
                      ? "Confirmar o novo contrato?"
                      : agendada
                        ? `Confirmar o acordo com ${clube.nome}? Você permanece no clube atual até ${formatarData(janela.proximaAbertura)}.`
                        : `Confirmar sua transferência para ${clube.nome}?`}
                  </p>
                  <div className="acoes">
                    <button
                      className="botao principal"
                      disabled={!podeAceitar}
                      onClick={() => {
                        responder(proposta.id, true);
                        definirConfirmacao(null);
                      }}
                    >
                      Confirmar aceite
                    </button>
                    <button
                      className="botao secundario"
                      onClick={() => definirConfirmacao(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="acoes">
                  <button
                    className="botao principal"
                    disabled={!podeAceitar}
                    onClick={() => definirConfirmacao(proposta.id)}
                  >
                    Aceitar proposta
                  </button>
                  <button
                    className="botao secundario"
                    onClick={() => responder(proposta.id, false)}
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
            {proposta.tipo !== "emprestimo" && (
              <Contraproposta
                key={`${proposta.id}-${proposta.rodadasNegociacao ?? 0}`}
                proposta={proposta}
                clube={clube.nome}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}
