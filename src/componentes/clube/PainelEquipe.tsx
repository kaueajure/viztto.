"use client";
import { useMemo, useState } from "react";
import type { Clube, Jogador, JogadorMundo } from "@/dominio/entidades/modelos";
import { montarLinhasCampo } from "@/dominio/formacao";
import {
  concorrentesNaPosicao,
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
} from "@/simulacao/elenco/escalacao-elenco";
import { Escudo } from "@/componentes/clube/Escudo";
import { Barra } from "@/componentes/interface/Elementos";
import { dinheiro } from "@/utilitarios/formatacao";

type Aba = "visao" | "elenco" | "formacao" | "banco" | "concorrencia";

function formatarValor(valor: number | null | undefined): string {
  if (valor == null || valor <= 0) return "—";
  return dinheiro(valor);
}

function jogadorPorId(elenco: JogadorMundo[], id: string | null) {
  if (!id || id === "usuario") return null;
  return elenco.find((j) => j.id === id) ?? null;
}

function TabelaGrupo({
  titulo,
  jogadores,
}: {
  titulo: string;
  jogadores: JogadorMundo[];
}) {
  if (!jogadores.length) return null;
  return (
    <section className="elenco-grupo">
      <h3>{titulo}</h3>
      <table className="tabela-elenco">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pos</th>
            <th>OVR</th>
            <th>Idade</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jogadores.map((j) => (
            <tr key={j.id}>
              <td>{j.numero ?? "—"}</td>
              <td>
                <strong>{j.nome}</strong>
              </td>
              <td>{j.posicaoPrincipal}</td>
              <td>{j.overall}</td>
              <td>{j.idade}</td>
              <td>{formatarValor(j.valorMercado)}</td>
              <td>{j.statusElenco}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PainelEquipe({
  clube,
  jogadorUsuario,
}: {
  clube: Clube;
  jogadorUsuario?: Jogador;
}) {
  const [aba, definirAba] = useState<Aba>("visao");
  const grupos = useMemo(() => {
    const ordem = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 } as const;
    const ordenados = [...clube.elenco].sort((a, b) => {
      const g = ordem[a.grupoPosicao] - ordem[b.grupoPosicao];
      if (g) return g;
      return b.overall - a.overall;
    });
    return {
      GOL: ordenados.filter((j) => j.grupoPosicao === "GOL"),
      DEF: ordenados.filter((j) => j.grupoPosicao === "DEF"),
      MEI: ordenados.filter((j) => j.grupoPosicao === "MEI"),
      ATA: ordenados.filter((j) => j.grupoPosicao === "ATA"),
    };
  }, [clube.elenco]);

  const linhas = useMemo(
    () =>
      montarLinhasCampo(
        clube.formacaoPreferida,
        clube.goleiroTitularId,
        clube.titularesIds,
      ),
    [clube.formacaoPreferida, clube.goleiroTitularId, clube.titularesIds],
  );

  const banco = useMemo(
    () =>
      (clube.bancoIds ?? [])
        .map((id) => jogadorPorId(clube.elenco, id))
        .filter(Boolean) as JogadorMundo[],
    [clube.bancoIds, clube.elenco],
  );

  const concorrencia = useMemo(() => {
    if (!jogadorUsuario) return [];
    const candidatos = [
      ...clube.elenco.map(jogadorMundoComoCandidato),
      jogadorUsuarioComoCandidato(jogadorUsuario),
    ];
    return concorrentesNaPosicao(candidatos, jogadorUsuario.posicao, 6);
  }, [clube.elenco, jogadorUsuario]);

  return (
    <section className="painel equipe-clube">
      <header className="equipe-cabecalho">
        <Escudo clube={clube} tamanho={64} />
        <div>
          <p className="sobretitulo">CLUBE</p>
          <h2>{clube.nome}</h2>
          <p className="texto-suave">
            {clube.treinador?.nome
              ? `Técnico: ${clube.treinador.nome} · `
              : ""}
            {clube.estadio}
            {clube.pais ? ` · ${clube.pais}` : ""}
          </p>
        </div>
      </header>

      <nav className="abas-equipe" aria-label="Seções do clube">
        {(
          [
            ["visao", "Visão geral"],
            ["elenco", "Elenco"],
            ["formacao", "Formação"],
            ["banco", "Banco"],
            ["concorrencia", "Concorrência"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            className={aba === id ? "ativa" : ""}
            aria-pressed={aba === id}
            onClick={() => definirAba(id)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {aba === "visao" && (
        <div className="equipe-visao">
          <dl className="ficha">
            <div>
              <dt>Formação</dt>
              <dd>{clube.formacaoPreferida}</dd>
            </div>
            <div>
              <dt>Plantel</dt>
              <dd>{clube.elenco.length} jogadores</dd>
            </div>
            <div>
              <dt>Orçamento</dt>
              <dd>{formatarValor(clube.orcamento)}</dd>
            </div>
            <div>
              <dt>Estilo</dt>
              <dd>{clube.treinador?.estilo ?? "—"}</dd>
            </div>
          </dl>
          <Barra nome="Ataque (escalação)" valor={clube.forcaAtaque} />
          <Barra nome="Meio (escalação)" valor={clube.forcaMeio} />
          <Barra nome="Defesa (escalação)" valor={clube.forcaDefesa} />
          <Barra nome="Reputação" valor={clube.reputacao} />
        </div>
      )}

      {aba === "elenco" && (
        <div className="equipe-elenco">
          {!clube.elenco.length ? (
            <p className="estado-vazio">Nenhum jogador neste clube.</p>
          ) : (
            <>
              <TabelaGrupo titulo="Goleiros" jogadores={grupos.GOL} />
              <TabelaGrupo titulo="Defensores" jogadores={grupos.DEF} />
              <TabelaGrupo titulo="Meio-campistas" jogadores={grupos.MEI} />
              <TabelaGrupo titulo="Atacantes" jogadores={grupos.ATA} />
            </>
          )}
        </div>
      )}

      {aba === "formacao" && (
        <div className="equipe-formacao">
          <div className="linha-titulo">
            <h3>Titulares · {clube.formacaoPreferida}</h3>
          </div>
          <div className="campo-formacao" role="img" aria-label="Campo tático">
            {linhas.map((linha, i) => (
              <div className="linha-campo" key={i}>
                {linha.map((slot) => {
                  const doElenco = jogadorPorId(clube.elenco, slot.jogadorId);
                  const rotulo =
                    slot.jogadorId === "usuario" && jogadorUsuario
                      ? `${jogadorUsuario.nome} · ${jogadorUsuario.overall}`
                      : doElenco
                        ? `${doElenco.nome.split(" ").slice(-1)[0]} · ${doElenco.overall}`
                        : "—";
                  return (
                    <div className="slot-campo" key={`${slot.slot}-${i}`}>
                      <span className="slot-pos">{slot.slot}</span>
                      <strong>{rotulo}</strong>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === "banco" && (
        <div className="equipe-elenco">
          {!banco.length ? (
            <p className="estado-vazio">Nenhum reserva selecionado.</p>
          ) : (
            <TabelaGrupo titulo="Reservas" jogadores={banco} />
          )}
        </div>
      )}

      {aba === "concorrencia" && (
        <div className="equipe-elenco">
          {!jogadorUsuario ? (
            <p className="estado-vazio">
              Concorrência disponível durante a carreira.
            </p>
          ) : (
            <ol className="lista-concorrencia">
              {concorrencia.map((item, i) => (
                <li
                  key={item.candidato.id}
                  className={item.candidato.ehUsuario ? "voce" : ""}
                >
                  <span>{i + 1}.</span>
                  <strong>
                    {item.candidato.nome}
                    {item.candidato.ehUsuario ? " (você)" : ""}
                  </strong>
                  <span>OVR {item.candidato.overall}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
