"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";
export function CalendarioCompeticao({
  carreira: c,
  secao,
}: {
  carreira: EstadoCarreira;
  secao: "calendario" | "competicao";
}) {
  const [categoria, definirCategoria] = useState(c.jogador.categoria),
    [rodada, definirRodada] = useState(
      Math.min(c.temporada.totalRodadas, Math.max(1, c.temporada.rodadaAtual)),
    );
  const partidas =
      categoria === "base" ? c.temporada.partidasBase : c.temporada.partidas,
    tabela =
      categoria === "base"
        ? c.temporada.classificacaoBase
        : c.temporada.classificacao;
  return (
    <>
      <div className="linha-titulo">
        <div>
          <p className="sobretitulo">
            {c.liga.nome} / {formatarTemporada(c.liga.id, c.temporada.ano)}
          </p>
          <h1>{secao === "competicao" ? "Mundo do futebol" : "Calendário"}</h1>
        </div>
        <div className="alternador">
          <button
            className={categoria === "profissional" ? "ativo" : ""}
            onClick={() => definirCategoria("profissional")}
          >
            Profissional
          </button>
          <button
            className={categoria === "base" ? "ativo" : ""}
            onClick={() => definirCategoria("base")}
          >
            Base
          </button>
        </div>
      </div>
      {secao === "competicao" && (
        <section className="painel tabela-completa">
          <TabelaLiga
            linhas={tabela}
            clubes={c.clubes}
            clubeAtualId={c.clubeAtualId}
          />
          <p className="texto-suave">
            Desempate: vitórias, saldo de gols e gols pró. Sem acesso e
            rebaixamento nesta fase.
          </p>
        </section>
      )}
      <section className="painel espaco">
        <div className="linha-titulo">
          <h2>
            {secao === "competicao" ? "RESULTADOS DA RODADA" : "JOGOS DA LIGA"}
          </h2>
          <label className="seletor-rodada">
            Rodada
            <select
              value={rodada}
              onChange={(e) => definirRodada(Number(e.target.value))}
            >
              {Array.from({ length: c.temporada.totalRodadas }, (_, i) => (
                <option value={i + 1} key={i}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="lista-jogos">
          {partidas
            .filter((p) => p.rodada === rodada)
            .map((p) => {
              const m = c.clubes.find((cl) => cl.id === p.mandanteId)!,
                v = c.clubes.find((cl) => cl.id === p.visitanteId)!;
              return (
                <div
                  className={`linha-jogo ${c.clubeAtualId != null && [m.id, v.id].includes(c.clubeAtualId) ? "meu-jogo" : ""}`}
                  key={p.id}
                >
                  <time>{formatarData(p.data)}</time>
                  <div className="time-mandante">
                    <span>{m.nome}</span>
                    <Escudo clube={m} tamanho={30} />
                  </div>
                  <strong>
                    {p.golsMandante === null
                      ? "×"
                      : `${p.golsMandante} : ${p.golsVisitante}`}
                  </strong>
                  <div className="time-visitante">
                    <Escudo clube={v} tamanho={30} />
                    <span>{v.nome}</span>
                  </div>
                  <span className="rotulo">
                    {p.golsMandante === null ? "AGENDADO" : "ENCERRADO"}
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </>
  );
}
