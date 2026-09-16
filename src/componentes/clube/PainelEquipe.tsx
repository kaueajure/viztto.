"use client";
import { useMemo, useState } from "react";
import type { Clube, JogadorExterno } from "@/dominio/entidades/modelos";
import { montarLinhasCampo } from "@/dominio/formacao";
import { Escudo } from "@/componentes/clube/Escudo";
import { Barra } from "@/componentes/interface/Elementos";
import { dinheiro } from "@/utilitarios/formatacao";

type Aba = "visao" | "elenco" | "formacao";

function formatarValor(valor: number | null | undefined): string {
  if (valor == null || valor <= 0) return "—";
  return dinheiro(valor);
}

function jogadorPorId(elenco: JogadorExterno[], id: string | null) {
  if (!id) return null;
  return elenco.find((j) => j.id === id) ?? null;
}

function TabelaGrupo({
  titulo,
  jogadores,
}: {
  titulo: string;
  jogadores: JogadorExterno[];
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
            <th>Idade</th>
            <th>Nac.</th>
            <th>Valor</th>
            <th>Contrato</th>
          </tr>
        </thead>
        <tbody>
          {jogadores.map((j) => (
            <tr key={j.id}>
              <td>{j.numero ?? "—"}</td>
              <td>
                <strong>{j.nome}</strong>
              </td>
              <td>{j.posicao}</td>
              <td>{j.idade ?? "—"}</td>
              <td>{j.nacionalidade[0] ?? "—"}</td>
              <td>{formatarValor(j.valorMercado)}</td>
              <td>{j.contratoAte ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PainelEquipe({ clube }: { clube: Clube }) {
  const [aba, definirAba] = useState<Aba>("visao");
  const grupos = useMemo(() => {
    const ordem = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 } as const;
    const ordenados = [...clube.elenco].sort((a, b) => {
      const g = ordem[a.grupoPosicao] - ordem[b.grupoPosicao];
      if (g) return g;
      return (b.valorMercado ?? 0) - (a.valorMercado ?? 0);
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

  return (
    <section className="painel equipe-clube">
      <header className="equipe-cabecalho">
        <Escudo clube={clube} tamanho={64} />
        <div>
          <p className="sobretitulo">CLUBE</p>
          <h2>{clube.nome}</h2>
          <p className="texto-suave">
            {clube.estadio}
            {clube.capacidadeEstadio
              ? ` · ${clube.capacidadeEstadio.toLocaleString("pt-BR")} lugares`
              : ""}
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
              <dt>Nome oficial</dt>
              <dd>{clube.nomeOficial ?? clube.nome}</dd>
            </div>
            <div>
              <dt>Fundação</dt>
              <dd>{clube.fundacao ?? "—"}</dd>
            </div>
            <div>
              <dt>Plantel</dt>
              <dd>{clube.tamanhoElenco ?? clube.elenco.length} jogadores</dd>
            </div>
            <div>
              <dt>Idade média</dt>
              <dd>
                {clube.idadeMedia != null
                  ? clube.idadeMedia.toFixed(1)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Valor do elenco</dt>
              <dd>{formatarValor(clube.valorElenco)}</dd>
            </div>
            <div>
              <dt>Formação-base (viztto)</dt>
              <dd>{clube.formacaoPreferida}</dd>
            </div>
          </dl>
          <Barra nome="Ataque" valor={clube.forcaAtaque} />
          <Barra nome="Meio-campo" valor={clube.forcaMeio} />
          <Barra nome="Defesa" valor={clube.forcaDefesa} />
          <Barra nome="Reputação" valor={clube.reputacao} />
          <p className="texto-suave">
            Forças e formação-base são avaliações do universo viztto, não dados
            oficiais do Transfermarkt.
          </p>
        </div>
      )}

      {aba === "elenco" && (
        <div className="equipe-elenco">
          {!clube.elenco.length ? (
            <p className="estado-vazio">Nenhum jogador importado neste clube.</p>
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
            <h3>Formação-base {clube.formacaoPreferida}</h3>
            <span className="rotulo">VIZTTO</span>
          </div>
          <p className="texto-suave">
            Escalação inicial determinada pelo viztto a partir das posições e
            valores de mercado do plantel importado.
          </p>
          <div className="campo-formacao" role="img" aria-label="Campo tático">
            {linhas.map((linha, i) => (
              <div className="linha-campo" key={i}>
                {linha.map((slot) => {
                  const jogador = jogadorPorId(clube.elenco, slot.jogadorId);
                  return (
                    <div className="slot-campo" key={`${slot.slot}-${i}-${slot.jogadorId}`}>
                      <span className="slot-pos">{slot.slot}</span>
                      <strong>{jogador?.nome?.split(" ").slice(-1)[0] ?? "—"}</strong>
                      <span className="slot-meta">
                        {jogador?.posicao ?? "vago"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
