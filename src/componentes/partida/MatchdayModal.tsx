"use client";

import { useEffect, useRef, useState } from "react";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import { useAcaoOcupada } from "@/componentes/interface/useAcaoOcupada";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { SessaoMatchdayUI } from "@/aplicacao/casos-de-uso/sessao-matchday";
import { ROTULOS_INSTRUCAO } from "@/dominio/matchday";
import { Escudo } from "@/componentes/clube/Escudo";
import { ResumoPartida } from "./ResumoPartida";
import { X } from "lucide-react";

const BLOCO_MINUTOS = 4;

export function MatchdayModal({
  carreira,
  sessao,
  onComecar,
  onAvancarAte,
  onPularFim,
  onDecidir,
  onFechar,
}: {
  carreira: EstadoCarreira;
  sessao: SessaoMatchdayUI;
  onComecar: () => void;
  onAvancarAte: (minuto: number) => void;
  onPularFim: () => void;
  onDecidir: (opcaoId: string) => void;
  onFechar: () => void;
}) {
  useFocoModal(true, onFechar);
  const [velocidade, definirVelocidade] = useState<1 | 2>(1);
  const pedindoAvanco = useRef(false);
  const cronologiaRef = useRef<HTMLDivElement>(null);
  const { ocupado, executar } = useAcaoOcupada();
  const [rotuloBusy, setRotuloBusy] = useState("Processando…");

  useEffect(() => {
    if (sessao.fase !== "ao-vivo") return;
    if (sessao.pausado || sessao.decisao) return;
    if (sessao.minutoAtual >= 90) return;

    const ms = velocidade === 2 ? 350 : 700;
    const id = window.setTimeout(() => {
      if (pedindoAvanco.current) return;
      pedindoAvanco.current = true;
      onAvancarAte(Math.min(90, sessao.minutoAtual + BLOCO_MINUTOS));
      pedindoAvanco.current = false;
    }, ms);
    return () => window.clearTimeout(id);
  }, [
    sessao.fase,
    sessao.pausado,
    sessao.decisao,
    sessao.minutoAtual,
    velocidade,
    onAvancarAte,
  ]);

  useEffect(() => {
    const el = cronologiaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sessao.eventosVisiveis.length, sessao.minutoAtual]);

  if (sessao.fase === "pos" && sessao.partida) {
    return (
      <ResumoPartida
        partida={sessao.partida}
        carreira={carreira}
        fechar={onFechar}
      />
    );
  }

  const b = sessao.briefing;
  const mandante = carreira.clubes.find((c) => c.id === b.mandanteId)!;
  const visitante = carreira.clubes.find((c) => c.id === b.visitanteId)!;
  const adversario = carreira.clubes.find((c) => c.id === b.adversarioId)!;

  if (sessao.fase === "ao-vivo") {
    const eventos = sessao.eventosVisiveis;
    const recentes = eventos.slice(-12);
    const destaque = [...eventos]
      .reverse()
      .find((e) => e.tipo === "gol" || (e.jogador && e.tipo !== "fim"));

    return (
      <div className="sobreposicao">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="matchday-vivo-titulo"
          className="resumo-partida matchday-modal matchday-vivo"
          aria-busy={ocupado}
        >
          <div className="matchday-vivo-topo">
            <header>
              <span className="sobretitulo">
                MATCHDAY · {sessao.minutoAtual}′
                {sessao.minutoAtual <= 45
                  ? " · 1º TEMPO"
                  : sessao.minutoAtual < 90
                    ? " · 2º TEMPO"
                    : ""}
              </span>
              <button
                className="botao-icone"
                aria-label="Fechar"
                onClick={onFechar}
                disabled={ocupado}
              >
                <X />
              </button>
            </header>
            <p className="rotulo" id="matchday-vivo-titulo">
              {b.competicao} · {b.estadio}
            </p>
            <div className="placar-final">
              <div>
                <Escudo clube={mandante} tamanho={48} />
                <strong>{mandante.codigo}</strong>
              </div>
              <b>
                {sessao.golsMandante}
                <span>:</span>
                {sessao.golsVisitante}
              </b>
              <div>
                <Escudo clube={visitante} tamanho={48} />
                <strong>{visitante.codigo}</strong>
              </div>
            </div>

            <div className="matchday-pressao" aria-hidden>
              <span>{mandante.codigo}</span>
              <div className="matchday-pressao-barra">
                <i style={{ width: `${sessao.pressaoMandante}%` }} />
              </div>
              <span>{visitante.codigo}</span>
            </div>
            <p className="rotulo matchday-pressao-rotulo">
              Pressão aproximada · {sessao.pressaoMandante}% –{" "}
              {sessao.pressaoVisitante}%
            </p>

            {destaque && (
              <div
                className={`matchday-destaque-vivo${destaque.tipo === "gol" ? " gol" : ""}${destaque.jogador ? " jogador" : ""}`}
              >
                <b>{destaque.minuto}′</b>
                <span>{destaque.texto}</span>
                {destaque.tipo === "gol" && <em>GOL</em>}
              </div>
            )}
          </div>

          <div
            ref={cronologiaRef}
            className="eventos-partida matchday-cronologia"
          >
            {recentes.map((e, i) => (
              <div
                key={`${e.minuto}-${e.tipo}-${i}`}
                className={[
                  e.jogador ? "destaque-evento" : "",
                  e.tipo === "gol" ? "evento-gol" : "",
                  e.tipo === "cartao" ? "evento-cartao" : "",
                  e.tipo === "substituicao" ? "evento-sub" : "",
                  e.tipo === "intervalo" ? "evento-intervalo" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <b>{e.minuto}′</b>
                <span>{e.texto}</span>
                {e.tipo === "gol" && <span className="rotulo">GOL</span>}
              </div>
            ))}
          </div>

          <div className="matchday-vivo-rodape">
            {sessao.decisao ? (
              <div className="matchday-decisao">
                <h3>{sessao.decisao.titulo}</h3>
                <p>{sessao.decisao.texto}</p>
                <div className="matchday-opcoes">
                  {sessao.decisao.opcoes.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`botao principal${ocupado ? " ocupado" : ""}`}
                      disabled={ocupado}
                      aria-busy={ocupado}
                      onClick={() => {
                        setRotuloBusy("Aplicando…");
                        void executar(() => onDecidir(o.id));
                      }}
                    >
                      {ocupado ? rotuloBusy : o.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="matchday-controles">
                <button
                  type="button"
                  className={`botao${velocidade === 1 ? " principal" : ""}`}
                  disabled={ocupado}
                  onClick={() => definirVelocidade(1)}
                >
                  1x
                </button>
                <button
                  type="button"
                  className={`botao${velocidade === 2 ? " principal" : ""}`}
                  disabled={ocupado}
                  onClick={() => definirVelocidade(2)}
                >
                  2x
                </button>
                <button
                  type="button"
                  className={`botao${ocupado ? " ocupado" : ""}`}
                  disabled={ocupado}
                  aria-busy={ocupado}
                  onClick={() => {
                    setRotuloBusy("Finalizando…");
                    void executar(() => onPularFim());
                  }}
                >
                  {ocupado ? rotuloBusy : "Pular para o fim"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="sobreposicao">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="matchday-pre-titulo"
        className="resumo-partida matchday-modal"
        aria-busy={ocupado}
      >
        <header>
          <span className="sobretitulo">MATCHDAY · RODADA {b.rodada}</span>
          <button
            autoFocus
            className="botao-icone"
            aria-label="Fechar"
            onClick={onFechar}
            disabled={ocupado}
          >
            <X />
          </button>
        </header>
        <p className="rotulo" id="matchday-pre-titulo">
          {b.competicao} · {b.estadio}
        </p>
        <div className="placar-final">
          <div>
            <Escudo clube={mandante} tamanho={56} />
            <strong>{mandante.nome}</strong>
          </div>
          <b>VS</b>
          <div>
            <Escudo clube={visitante} tamanho={56} />
            <strong>{visitante.nome}</strong>
          </div>
        </div>
        <div className="matchday-briefing">
          <p>
            <span className="rotulo">Adversário</span> {adversario.nome} · forma{" "}
            {Math.round(b.formaAdversario)} · força{" "}
            {Math.round(b.forcaAdversario)}
          </p>
          <p>
            <span className="rotulo">Seu clube</span> forma{" "}
            {Math.round(b.formaClube)} · força {Math.round(b.forcaClube)}
          </p>
          <p>
            <span className="rotulo">Posição</span> {b.posicao} ·{" "}
            {b.textoSituacao}
          </p>
          <p>
            <span className="rotulo">Instrução</span>{" "}
            {ROTULOS_INSTRUCAO[b.instrucao]}
          </p>
          {b.concorrentes.length > 0 && (
            <p>
              <span className="rotulo">Concorrência</span>{" "}
              {b.concorrentes
                .map(
                  (c) =>
                    `${c.nome} (${c.overall})${c.disponivel ? "" : " · indisponível"}`,
                )
                .join(" · ")}
            </p>
          )}
          <div className="matchday-objetivos">
            <span className="rotulo">Objetivos</span>
            <ul>
              {b.objetivos.map((o) => (
                <li key={o.id}>{o.descricao}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="matchday-acoes">
          <button
            type="button"
            className={`botao principal${ocupado ? " ocupado" : ""}`}
            disabled={ocupado}
            aria-busy={ocupado}
            onClick={() => {
              setRotuloBusy("Iniciando partida…");
              void executar(() => onComecar());
            }}
          >
            {ocupado ? rotuloBusy : "Começar partida"}
          </button>
        </div>
      </section>
    </div>
  );
}
