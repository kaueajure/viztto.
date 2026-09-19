"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useEffect, useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { formatarData } from "@/utilitarios/formatacao";
import { EstatisticasLinha, Vazio } from "@/componentes/interface/Elementos";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { useJogoStore } from "@/estado/jogo-store";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";

export function NoticiasHistorico({
  carreira: c,
  secao,
}: {
  carreira: EstadoCarreira;
  secao: "noticias" | "historico";
}) {
  const [filtro, definirFiltro] = useState("Todos"),
    [abertaId, definirAbertaId] = useState<string | null>(null),
    lerTodas = useJogoStore((s) => s.lerNoticias),
    lerNoticia = useJogoStore((s) => s.lerNoticia);

  // Ao abrir Mensagens, marca como lidas as que estão na lista filtrada atual.
  useEffect(() => {
    if (secao !== "noticias") return;
    const ids = c.noticias
      .filter((n) => !n.lida && (filtro === "Todos" || n.remetente === filtro))
      .map((n) => n.id);
    if (ids.length) lerNoticia(ids);
  }, [secao]); // eslint-disable-line react-hooks/exhaustive-deps -- só ao entrar na tela

  return (
    <>
      <p className="sobretitulo">
        {secao === "historico" ? "ESTATÍSTICAS" : "MENSAGENS"}
      </p>
      <div className="linha-titulo">
        <h1>
          {secao === "historico" ? "Estatísticas" : "Mensagens"}
        </h1>
        {secao === "noticias" && (
          <button className="botao-texto" onClick={lerTodas}>
            Marcar todas como lidas
          </button>
        )}
      </div>
      {secao === "noticias" ? (
        <>
          <div className="filtros">
            {[
              "Todos",
              "Treinador",
              "Diretoria",
              "Agente",
              "Departamento médico",
              "Imprensa",
            ].map((f) => (
              <button
                key={f}
                className={filtro === f ? "ativo" : ""}
                onClick={() => definirFiltro(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="lista-noticias">
            {c.noticias
              .filter((n) => filtro === "Todos" || n.remetente === filtro)
              .map((n) => {
                const expandida = abertaId === n.id;
                return (
                  <article
                    key={n.id}
                    className={`noticia ${!n.lida ? "nao-lida" : ""}${expandida ? " aberta" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      definirAbertaId(expandida ? null : n.id);
                      if (!n.lida) lerNoticia([n.id]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        definirAbertaId(expandida ? null : n.id);
                        if (!n.lida) lerNoticia([n.id]);
                      }
                    }}
                  >
                    <div>
                      <span className="rotulo">{n.remetente}</span>
                      <time>{formatarData(n.data)}</time>
                    </div>
                    <section>
                      <h2>{n.titulo}</h2>
                      <p>{n.texto}</p>
                    </section>
                  </article>
                );
              })}
            {!c.noticias.some(
              (n) => filtro === "Todos" || n.remetente === filtro,
            ) && (
              <Vazio texto="Nenhuma mensagem deste remetente. Novidades chegam conforme a carreira avança." />
            )}
          </div>
        </>
      ) : (
        <>
          <section className="painel espaco">
            <h2>TOTAIS DA CARREIRA</h2>
            <EstatisticasLinha
              estatisticas={somarEstatisticas(
                c.registros.map((r) => r.estatisticas),
              )}
            />
          </section>
          <section className="painel espaco">
            <h2>POR TEMPORADA, CLUBE E COMPETIÇÃO</h2>
            {!c.registros.length ? (
              <Vazio texto="Seu histórico de estatísticas começa na primeira participação em campo." />
            ) : (
              <div className="tabela-rolagem">
                <table className="tabela-liga">
                  <thead>
                    <tr>
                      <th>Ano</th>
                      <th>Clube / competição</th>
                      <th>J</th>
                      <th>Tit.</th>
                      <th>Min.</th>
                      <th>G</th>
                      <th>A</th>
                      <th>CA</th>
                      <th>CV</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...c.registros].reverse().map((r, i) => (
                      <tr key={i}>
                        <td>{formatarTemporada(c.liga.id, r.ano)}</td>
                        <td>
                          {c.clubes.find((cl) => cl.id === r.clubeId)?.nome}
                          <small>
                            {r.competicao} ·{" "}
                            {r.categoria === "base" ? "Base" : "Profissional"}
                          </small>
                        </td>
                        <td>{r.estatisticas.jogos}</td>
                        <td>{r.estatisticas.titularidades}</td>
                        <td>{r.estatisticas.minutos}</td>
                        <td>{r.estatisticas.gols}</td>
                        <td>{r.estatisticas.assistencias}</td>
                        <td>{r.estatisticas.amarelos}</td>
                        <td>{r.estatisticas.vermelhos}</td>
                        <td>
                          {(
                            r.estatisticas.somaNotas /
                            Math.max(1, r.estatisticas.jogos)
                          ).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {c.temporadasAnteriores.map((t) => {
            const ligaIdTemp =
              t.ligaId ??
              c.clubes.find((cl) => cl.id === t.campeaoId)?.ligaId ??
              c.liga.id;
            const clubeNaTemporada =
              c.registros.find((r) => r.ano === t.ano)?.clubeId ??
              t.campeaoId;
            const temBase =
              t.classificacaoBase.length > 0 &&
              c.registros.some(
                (r) => r.ano === t.ano && r.categoria === "base",
              );
            return (
              <details
                className="painel espaco"
                key={`${t.ano}-${ligaIdTemp}`}
              >
                <summary>
                  Temporada {formatarTemporada(ligaIdTemp, t.ano)} · Campeão:{" "}
                  {c.clubes.find((cl) => cl.id === t.campeaoId)?.nome}
                </summary>
                <TabelaLiga
                  linhas={t.classificacao}
                  clubes={c.clubes}
                  clubeAtualId={clubeNaTemporada}
                  ligaId={ligaIdTemp}
                  temporadaEncerrada
                  ligasNoUniverso={c.ligas.map((l) => l.id)}
                />
                {temBase && (
                  <>
                    <h3>Categoria de base</h3>
                    <TabelaLiga
                      linhas={t.classificacaoBase}
                      clubes={c.clubes}
                      clubeAtualId={clubeNaTemporada}
                      ligaId={ligaIdTemp}
                      temporadaEncerrada
                      ligasNoUniverso={c.ligas.map((l) => l.id)}
                    />
                  </>
                )}
              </details>
            );
          })}
          <section className="linha-historico">
            <h2>SUA HISTÓRIA</h2>
            {[...c.eventos].reverse().map((e) => (
              <article key={e.id}>
                <time>{formatarData(e.data)}</time>
                <div>
                  <h3>{e.titulo}</h3>
                  <p>{e.texto}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}
