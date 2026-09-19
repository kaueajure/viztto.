"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    [rodada, definirRodada] = useState(() => {
      const atual = c.temporada.rodadaAtual;
      const total = c.temporada.totalRodadas;
      // Abre na próxima rodada ainda não disputada, se existir.
      const proxima = atual < total ? atual + 1 : Math.max(1, atual);
      return Math.min(total, Math.max(1, proxima));
    }),
    [aba, definirAba] = useState<AbaMundo>("classificacao"),
    [ligaId, definirLigaId] = useState(c.liga.id);

  const ligaSel = c.ligas.find((l) => l.id === ligaId) ?? c.liga;
  const ehMinhaLiga = ligaSel.id === c.liga.id;

  /** Liga externa sem temporada: nunca cair na temporada da liga atual. */
  const temporada: Temporada | null = useMemo(() => {
    if (ehMinhaLiga) return c.temporada;
    return c.temporadasExternas[ligaSel.id] ?? null;
  }, [c.temporada, c.temporadasExternas, ehMinhaLiga, ligaSel.id]);

  useEffect(() => {
    if (!temporada) return;
    definirRodada((r) => Math.min(Math.max(1, r), temporada.totalRodadas));
  }, [temporada]);

  const temBase =
    ehMinhaLiga &&
    !!temporada &&
    temporada.partidasBase.length > 0 &&
    temporada.classificacaoBase.length > 0;

  const categoriaEfetiva: "profissional" | "base" =
    temBase && categoria === "base" ? "base" : "profissional";

  const partidas =
    temporada == null
      ? []
      : categoriaEfetiva === "base"
        ? temporada.partidasBase
        : temporada.partidas;
  const tabela =
    temporada == null
      ? []
      : categoriaEfetiva === "base"
        ? temporada.classificacaoBase
        : temporada.classificacao;

  const clubesLiga = c.clubes.filter((cl) => cl.ligaId === ligaSel.id);

  if (secao === "calendario") {
    const partidasCal =
      categoria === "base" && c.temporada.partidasBase.length > 0
        ? c.temporada.partidasBase
        : c.temporada.partidas;
    return (
      <div className="vz-pagina" data-testid="pagina-calendario">
        <header className="vz-page-head linha-titulo">
          <div>
            <p className="vz-card-sub">
              {c.liga.nome} · {formatarTemporada(c.liga.id, c.temporada.ano)}
            </p>
            <h1>Calendário</h1>
          </div>
          <div className="alternador">
            <button
              type="button"
              className={categoria === "profissional" ? "ativo" : ""}
              aria-pressed={categoria === "profissional"}
              onClick={() => definirCategoria("profissional")}
            >
              Profissional
            </button>
            {c.temporada.partidasBase.length > 0 && (
              <button
                type="button"
                className={categoria === "base" ? "ativo" : ""}
                aria-pressed={categoria === "base"}
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
            <div className="seletor-rodada">
              <button
                type="button"
                className="botao secundario"
                disabled={rodada <= 1}
                onClick={() => definirRodada((r) => Math.max(1, r - 1))}
                aria-label="Rodada anterior"
              >
                ← Anterior
              </button>
              <label>
                Rodada
                <select
                  value={Math.min(rodada, c.temporada.totalRodadas)}
                  onChange={(e) => definirRodada(Number(e.target.value))}
                >
                  {Array.from({ length: c.temporada.totalRodadas }, (_, i) => (
                    <option value={i + 1} key={i}>
                      {String(i + 1).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="botao secundario"
                disabled={rodada >= c.temporada.totalRodadas}
                onClick={() =>
                  definirRodada((r) =>
                    Math.min(c.temporada.totalRodadas, r + 1),
                  )
                }
                aria-label="Próxima rodada"
              >
                Próxima →
              </button>
            </div>
          </div>
          <ListaJogos
            carreira={c}
            partidas={partidasCal}
            rodada={Math.min(rodada, c.temporada.totalRodadas)}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="vz-pagina" data-testid="pagina-mundo">
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
            data-testid="mundo-liga-select"
          >
            {c.ligas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
                {l.id === c.liga.id ? " · Minha liga" : ""}
              </option>
            ))}
          </select>
        </label>
        {temporada && (
          <p className="texto-suave">
            {formatarTemporada(ligaSel.id, temporada.ano)}
            {ehMinhaLiga ? " · Sua competição" : " · Liga externa"}
          </p>
        )}
      </header>

      {!temporada ? (
        <section className="painel" role="status" data-testid="mundo-indisponivel">
          <p className="vz-empty-title">Dados indisponíveis</p>
          <p className="vz-empty">
            Dados desta competição não estão disponíveis nesta carreira.
          </p>
        </section>
      ) : (
        <>
          {temBase && (
            <div className="alternador espaco">
              <button
                type="button"
                className={categoriaEfetiva === "profissional" ? "ativo" : ""}
                aria-pressed={categoriaEfetiva === "profissional"}
                onClick={() => definirCategoria("profissional")}
              >
                Profissional
              </button>
              <button
                type="button"
                className={categoriaEfetiva === "base" ? "ativo" : ""}
                aria-pressed={categoriaEfetiva === "base"}
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
                ligaId={ligaSel.id}
                temporadaEncerrada={!!temporada?.encerrada}
                ligasNoUniverso={c.ligas.map((l) => l.id)}
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
                    data-testid="mundo-rodada"
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
        </>
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
    <ul className="lista-jogos" data-testid="lista-jogos">
      {jogos.map((p) => {
        const m = c.clubes.find((cl) => cl.id === p.mandanteId);
        const v = c.clubes.find((cl) => cl.id === p.visitanteId);
        if (!m || !v) return null;
        const placar =
          p.golsMandante != null
            ? `${p.golsMandante} × ${p.golsVisitante}`
            : "×";
        const meu =
          c.clubeAtualId != null &&
          [p.mandanteId, p.visitanteId].includes(c.clubeAtualId);
        return (
          <li
            key={p.id}
            className={`linha-jogo${meu ? " meu-jogo" : ""}`}
            data-partida-id={p.id}
          >
            <time dateTime={p.data}>{formatarData(p.data)}</time>
            <div className="time-mandante">
              <span>{m.codigo}</span>
              <Escudo clube={m} tamanho={28} />
            </div>
            <strong>{placar}</strong>
            <div className="time-visitante">
              <Escudo clube={v} tamanho={28} />
              <span>{v.codigo}</span>
            </div>
            <span className="rotulo">{meu ? "SEU JOGO" : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}
