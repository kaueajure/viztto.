"use client";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import type { EstadoCarreira, Partida } from "@/dominio/entidades/modelos";
import { ROTULOS_INSTRUCAO } from "@/dominio/matchday";
import { Escudo } from "@/componentes/clube/Escudo";
import { X } from "lucide-react";

export function ResumoPartida({
  partida,
  carreira,
  fechar,
}: {
  partida: Partida;
  carreira: EstadoCarreira;
  fechar: () => void;
}) {
  useFocoModal(true, fechar);
  const mandante = carreira.clubes.find((c) => c.id === partida.mandanteId)!,
    visitante = carreira.clubes.find((c) => c.id === partida.visitanteId)!,
    p = partida.participacao;
  const ctx = partida.contextoMatchday;
  const acoes =
    partida.eventos.filter((e) => e.jogador && e.tipo !== "fim").slice(0, 6);

  return (
    <div className="sobreposicao">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumo-titulo"
        className="resumo-partida"
      >
        <header>
          <span className="sobretitulo">
            APITO FINAL / RODADA {partida.rodada}
          </span>
          <button
            autoFocus
            className="botao-icone"
            aria-label="Fechar resumo"
            onClick={fechar}
          >
            <X />
          </button>
        </header>
        <p className="rotulo" id="resumo-titulo">
          {carreira.liga.nome}
          {partida.categoria === "base" ? " · BASE" : ""} · {mandante.estadio}
        </p>
        <div className="placar-final">
          <div>
            <Escudo clube={mandante} tamanho={60} />
            <strong>{mandante.nome}</strong>
          </div>
          <b>
            {partida.golsMandante}
            <span>:</span>
            {partida.golsVisitante}
          </b>
          <div>
            <Escudo clube={visitante} tamanho={60} />
            <strong>{visitante.nome}</strong>
          </div>
        </div>
        {p && (
          <>
            <div className="desempenho">
              <div>
                <span className="rotulo">
                  {carreira.jogador.nome} {carreira.jogador.sobrenome}
                </span>
                <h2>
                  {p.minutos
                    ? `${p.minutos} MINUTOS`
                    : p.escalacao === "banco"
                      ? "NÃO SAIU DO BANCO"
                      : p.escalacao.replace("nao", "não").toUpperCase()}
                </h2>
              </div>
              <div className="nota-jogo">
                <span>NOTA</span>
                <strong>{p.nota?.toFixed(1) ?? "—"}</strong>
              </div>
            </div>
            <div className="estatisticas-linha pequenas">
              {[
                [p.gols, "Gols"],
                [p.assistencias, "Assistências"],
                [p.chutes, "Chutes"],
                [p.passes, "Passes"],
                [p.passesChave, "Passes-chave"],
                [p.desarmes, "Desarmes"],
                [p.defesas, "Defesas"],
                [p.faltas, "Faltas"],
                [p.amarelos, "Amarelos"],
                [p.vermelhos, "Vermelhos"],
              ].map(([n, rotulo]) => (
                <div key={rotulo}>
                  <strong>{n}</strong>
                  <span>{rotulo}</span>
                </div>
              ))}
            </div>
            <div className="impactos">
              <span>
                Confiança{" "}
                <b>
                  {(ctx?.impactoConfianca ?? p.confianca) >= 0 ? "+" : ""}
                  {ctx?.impactoConfianca ?? p.confianca}
                </b>
              </span>
              <span>
                Moral{" "}
                <b>
                  {(ctx?.impactoMoral ?? p.moral) >= 0 ? "+" : ""}
                  {ctx?.impactoMoral ?? p.moral}
                </b>
              </span>
              <span>
                Desenvolvimento <b>+{p.desenvolvimento}</b>
              </span>
              {ctx && (
                <span>
                  Treinador{" "}
                  <b>
                    {ctx.impactoTreinador >= 0 ? "+" : ""}
                    {ctx.impactoTreinador}
                  </b>
                </span>
              )}
            </div>
          </>
        )}
        {ctx && (
          <div className="matchday-pos-contexto">
            {ctx.instrucao && (
              <p>
                <span className="rotulo">Instrução</span>{" "}
                {ROTULOS_INSTRUCAO[ctx.instrucao]}
              </p>
            )}
            {ctx.objetivos.length > 0 && (
              <ul className="matchday-objetivos-resultado">
                {ctx.objetivos.map((o) => (
                  <li key={o.id} className={o.cumprido ? "cumprido" : "falhou"}>
                    {o.cumprido ? "✓" : "✗"} {o.descricao}
                  </li>
                ))}
              </ul>
            )}
            {ctx.impactoHierarquia && <p>{ctx.impactoHierarquia}</p>}
            {ctx.reacaoTreinador && <p>{ctx.reacaoTreinador}</p>}
            {ctx.reacaoImprensa && <p>{ctx.reacaoImprensa}</p>}
          </div>
        )}
        {acoes.length > 0 && (
          <div className="eventos-partida">
            <span className="rotulo">Principais ações</span>
            {acoes.map((e, i) => (
              <div key={i} className="destaque-evento">
                <b>{e.minuto}′</b>
                <span>{e.texto}</span>
              </div>
            ))}
          </div>
        )}
        <div className="eventos-partida">
          {partida.eventos.map((e, i) => (
            <div key={i} className={e.jogador ? "destaque-evento" : ""}>
              <b>{e.minuto}′</b>
              <span>{e.texto}</span>
              {e.tipo === "gol" && <span className="rotulo">GOL</span>}
            </div>
          ))}
        </div>
        <button className="botao principal largura-total" onClick={fechar}>
          Voltar à carreira
        </button>
      </section>
    </div>
  );
}
