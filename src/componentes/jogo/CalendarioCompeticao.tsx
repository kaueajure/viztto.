"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import Link from "next/link";
import { useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";

type AbaMundo = "classificacao" | "resultados" | "clubes";

/** Calendário = partidas da liga. Competição = hub Mundo do Futebol (dados existentes). */
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
    ),
    [aba, definirAba] = useState<AbaMundo>("classificacao");
  const partidas =
      categoria === "base" ? c.temporada.partidasBase : c.temporada.partidas,
    tabela =
      categoria === "base"
        ? c.temporada.classificacaoBase
        : c.temporada.classificacao;

  if (secao === "calendario") {
    return (
      <div className="vz-pagina">
        <header className="vz-page-head linha-titulo">
          <div>
            <p className="vz-card-sub">
              {c.liga.nome} · {formatarTemporada(c.liga.id, c.temporada.ano)}
            </p>
            <h1>Calendário</h1>
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
        </header>
        <section className="painel">
          <div className="linha-titulo">
            <h2>Jogos da liga</h2>
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
          <ListaJogos carreira={c} partidas={partidas} rodada={rodada} />
        </section>
      </div>
    );
  }

  return (
    <div className="vz-pagina">
      <header className="vz-page-head linha-titulo">
        <div>
          <p className="vz-card-sub">
            {c.liga.nome} · {formatarTemporada(c.liga.id, c.temporada.ano)}
          </p>
          <h1>Mundo do futebol</h1>
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
      </header>

      <nav className="vz-subnav" aria-label="Mundo do futebol">
        {(
          [
            ["classificacao", "Classificação"],
            ["resultados", "Resultados"],
            ["clubes", "Clubes"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            type="button"
            className={aba === id ? "ativo" : ""}
            onClick={() => definirAba(id)}
          >
            {nome}
          </button>
        ))}
        <Link href="/carreira/calendario" className="vz-subnav-link">
          Calendário completo →
        </Link>
      </nav>

      {aba === "classificacao" && (
        <section className="painel">
          <TabelaLiga
            linhas={tabela}
            clubes={c.clubes}
            clubeAtualId={c.clubeAtualId}
          />
        </section>
      )}

      {aba === "resultados" && (
        <section className="painel">
          <div className="linha-titulo">
            <h2>Rodada</h2>
            <label className="seletor-rodada">
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
          <ListaJogos carreira={c} partidas={partidas} rodada={rodada} />
        </section>
      )}

      {aba === "clubes" && (
        <section className="painel">
          <ul className="vz-lista-clubes">
            {c.clubes
              .filter((cl) => cl.ligaId === c.liga.id)
              .map((cl) => {
                const pos = tabela.find((l) => l.clubeId === cl.id);
                return (
                  <li key={cl.id}>
                    <Escudo clube={cl} tamanho={28} />
                    <div>
                      <b>{cl.nome}</b>
                      <span>{cl.estadio}</span>
                    </div>
                    <span className="vz-lista-meta">
                      Força {cl.forcaGeral}
                      {pos ? ` · ${pos.posicao}º` : ""}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListaJogos({
  carreira: c,
  partidas,
  rodada,
}: {
  carreira: EstadoCarreira;
  partidas: EstadoCarreira["temporada"]["partidas"];
  rodada: number;
}) {
  return (
    <div className="lista-jogos">
      {partidas
        .filter((p) => p.rodada === rodada)
        .map((p) => {
          const m = c.clubes.find((cl) => cl.id === p.mandanteId)!;
          const v = c.clubes.find((cl) => cl.id === p.visitanteId)!;
          return (
            <div
              className={`linha-jogo ${c.clubeAtualId != null && [m.id, v.id].includes(c.clubeAtualId) ? "meu-jogo" : ""}`}
              key={p.id}
            >
              <time>{formatarData(p.data)}</time>
              <div className="time-mandante">
                <span>{m.nome}</span>
                <Escudo clube={m} tamanho={28} />
              </div>
              <strong>
                {p.golsMandante === null
                  ? "×"
                  : `${p.golsMandante} : ${p.golsVisitante}`}
              </strong>
              <div className="time-visitante">
                <Escudo clube={v} tamanho={28} />
                <span>{v.nome}</span>
              </div>
              <span className="rotulo">
                {p.golsMandante === null ? "Agendado" : "Encerrado"}
              </span>
            </div>
          );
        })}
    </div>
  );
}
