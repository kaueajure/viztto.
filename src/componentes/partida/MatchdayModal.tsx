"use client";

import { useFocoModal } from "@/componentes/interface/useFocoModal";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { SessaoMatchdayUI } from "@/aplicacao/casos-de-uso/sessao-matchday";
import { ROTULOS_INSTRUCAO } from "@/dominio/matchday";
import { Escudo } from "@/componentes/clube/Escudo";
import { ResumoPartida } from "./ResumoPartida";
import { X } from "lucide-react";

export function MatchdayModal({
  carreira,
  sessao,
  onInstantaneo,
  onComecar,
  onDecidir,
  onFechar,
}: {
  carreira: EstadoCarreira;
  sessao: SessaoMatchdayUI;
  onInstantaneo: () => void;
  onComecar: () => void;
  onDecidir: (opcaoId: string) => void;
  onFechar: () => void;
}) {
  useFocoModal(true, onFechar);

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
    return (
      <div className="sobreposicao">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="matchday-vivo-titulo"
          className="resumo-partida matchday-modal"
        >
          <header>
            <span className="sobretitulo">MATCHDAY · {sessao.minutoAtual}′</span>
            <button
              className="botao-icone"
              aria-label="Fechar"
              onClick={onFechar}
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
          <div className="eventos-partida matchday-cronologia">
            {sessao.eventosVisiveis.slice(-8).map((e, i) => (
              <div key={`${e.minuto}-${i}`} className={e.jogador ? "destaque-evento" : ""}>
                <b>{e.minuto}′</b>
                <span>{e.texto}</span>
              </div>
            ))}
          </div>
          {sessao.decisao && (
            <div className="matchday-decisao">
              <h3>{sessao.decisao.titulo}</h3>
              <p>{sessao.decisao.texto}</p>
              <div className="matchday-opcoes">
                {sessao.decisao.opcoes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="botao principal"
                    onClick={() => onDecidir(o.id)}
                  >
                    {o.rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  // Pré-jogo
  return (
    <div className="sobreposicao">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="matchday-pre-titulo"
        className="resumo-partida matchday-modal"
      >
        <header>
          <span className="sobretitulo">MATCHDAY · RODADA {b.rodada}</span>
          <button
            autoFocus
            className="botao-icone"
            aria-label="Fechar"
            onClick={onFechar}
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
          <b>
            VS
          </b>
          <div>
            <Escudo clube={visitante} tamanho={56} />
            <strong>{visitante.nome}</strong>
          </div>
        </div>
        <div className="matchday-briefing">
          <p>
            <span className="rotulo">Adversário</span> {adversario.nome} · forma{" "}
            {Math.round(b.formaAdversario)} · força {Math.round(b.forcaAdversario)}
          </p>
          <p>
            <span className="rotulo">Seu clube</span> forma {Math.round(b.formaClube)} ·
            força {Math.round(b.forcaClube)}
          </p>
          <p>
            <span className="rotulo">Posição</span> {b.posicao} · {b.textoSituacao}
          </p>
          <p>
            <span className="rotulo">Instrução</span>{" "}
            {ROTULOS_INSTRUCAO[b.instrucao]}
          </p>
          {b.concorrentes.length > 0 && (
            <p>
              <span className="rotulo">Concorrência</span>{" "}
              {b.concorrentes
                .map((c) => `${c.nome} (${c.overall})${c.disponivel ? "" : " · indisponível"}`)
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
          <button type="button" className="botao principal" onClick={onComecar}>
            Acompanhar partida
          </button>
          <button type="button" className="botao" onClick={onInstantaneo}>
            Simular instantaneamente
          </button>
        </div>
      </section>
    </div>
  );
}
