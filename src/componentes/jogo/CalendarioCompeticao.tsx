"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { EstadoCarreira, Temporada } from "@/dominio/entidades/modelos";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";

type AbaMundo = "classificacao" | "resultados" | "clubes";

/** Calendário = partidas do contexto do jogador. Competição = hub multi-liga. */
export function CalendarioCompeticao({
  carreira: c,
  secao,
}: {
  carreira: EstadoCarreira;
  secao: "calendario" | "competicao";
}) {
  const [categoria, definirCategoria] = useState<"profissional" | "base">(
      c.jogador.categoria === "base" ? "base" : "profissional",
    ),
    [rodada, definirRodada] = useState(
      Math.min(c.temporada.totalRodadas, Math.max(1, c.temporada.rodadaAtual)),
    ),
    [aba, definirAba] = useState<AbaMundo>("classificacao"),
    [ligaId, definirLigaId] = useState(c.liga.id);

  const ligaSel = c.ligas.find((l) => l.id === ligaId) ?? c.liga;
  const ehMinhaLiga = ligaSel.id === c.liga.id;

  const temporada: Temporada = useMemo(() => {
    if (ehMinhaLiga) return c.temporada;
    return c.temporadasExternas[ligaSel.id] ?? c.temporada;
  }, [c.temporada, c.temporadasExternas, ehMinhaLiga, ligaSel.id]);

  const temBase =
    ehMinhaLiga &&
    temporada.partidasBase.length > 0 &&
    temporada.classificacaoBase.length > 0;

  const categoriaEfetiva =
    !temBase || categoria !== "base" ? "profissional" : "base";

  const partidas =
      categoriaEfetiva === "base" ? temporada.partidasBase : temporada.partidas,
    tabela =
      categoriaEfetiva === "base"
        ? temporada.classificacaoBase
        : temporada.classificacao;

  const clubesLiga = c.clubes.filter((cl) => cl.ligaId === ligaSel.id);

  if (secao === "calendario") {
    const partidasCal =
      c.jogador.categoria === "base" && c.temporada.partidasBase.length
        ? c.temporada.partidasBase
        : c.temporada.partidas;
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
            {c.temporada.partidasBase.length > 0 && (
              <button
                className={categoria === "base" ? "ativo" : ""}
                onClick={() => definirCategoria("base")}
              >
                Base
              </button>
            )}
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
          <ListaJogos
            carreira={c}
            partidas={
              categoria === "base" && c.temporada.partidasBase.length
                ? c.temporada.partidasBase
                : partidasCal
            }
            rodada={rodada}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="vz-pagina">
      <header className="vz-page-head">
        <p className="vz-card-sub">COMPETIÇÕES</p>
        <h1>Mundo do futebol</h1>
        <label className="vz-liga-select">
          <span className="sr-only">Competição</span>
          <select
            value={ligaSel.id}
            onChange={(e) => {
              definirLigaId(e.target.value);
              definirRodada(1);
              definirCategoria("profissional");
            }}
            aria-label="Selecionar competição"
          >
            {c.ligas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
                {l.id === c.liga.id ? " · Minha liga" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="texto-suave">
          {formatarTemporada(ligaSel.id, temporada.ano)}
          {ehMinhaLiga ? " · Sua competição" : " · Liga externa"}
        </p>
      </header>

      {temBase && (
        <div className="alternador espaco">
          <button
            className={categoriaEfetiva === "profissional" ? "ativo" : ""}
            onClick={() => definirCategoria("profissional")}
          >
            Profissional
          </button>
          <button
            className={categoriaEfetiva === "base" ? "ativo" : ""}
            onClick={() => definirCategoria("base")}
          >
            Base
          </button>
        </div>
      )}

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
        {ehMinhaLiga && (
          <Link href="/carreira/calendario" className="vz-subnav-link">
            Calendário completo →
          </Link>
        )}
      </nav>

      {aba === "classificacao" && (
        <section className="painel">
          <TabelaLiga
            linhas={tabela}
            clubes={clubesLiga}
            clubeAtualId={ehMinhaLiga ? c.clubeAtualId : null}
          />
        </section>
      )}

      {aba === "resultados" && (
        <section className="painel">
          <div className="linha-titulo">
            <h2>Rodada</h2>
            <label className="seletor-rodada">
              <select
                value={Math.min(rodada, temporada.totalRodadas)}
                onChange={(e) => definirRodada(Number(e.target.value))}
              >
                {Array.from({ length: temporada.totalRodadas }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {String(i + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ListaJogos
            carreira={c}
            partidas={partidas}
            rodada={Math.min(rodada, temporada.totalRodadas)}
          />
        </section>
      )}

      {aba === "clubes" && (
        <section className="painel">
          <ul className="vz-lista-clubes">
            {clubesLiga.map((cl) => {
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
  const jogos = partidas.filter((p) => p.rodada === rodada);
  if (jogos.length === 0)
    return <p className="vz-empty">Nenhum jogo nesta rodada.</p>;
  return (
    <ul className="lista-jogos">
      {jogos.map((p) => {
        const m = c.clubes.find((cl) => cl.id === p.mandanteId);
        const v = c.clubes.find((cl) => cl.id === p.visitanteId);
        if (!m || !v) return null;
        const placar =
          p.golsMandante != null
            ? `${p.golsMandante} × ${p.golsVisitante}`
            : "×";
        return (
          <li key={p.id}>
            <time>{formatarData(p.data)}</time>
            <Escudo clube={m} tamanho={24} />
            <span>{m.codigo}</span>
            <b>{placar}</b>
            <span>{v.codigo}</span>
            <Escudo clube={v} tamanho={24} />
          </li>
        );
      })}
    </ul>
  );
}
