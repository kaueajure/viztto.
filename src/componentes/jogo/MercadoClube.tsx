import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { PainelEquipe } from "@/componentes/clube/PainelEquipe";
import { Vazio } from "@/componentes/interface/Elementos";
import { dinheiro, formatarData } from "@/utilitarios/formatacao";

export function MercadoClube({
  carreira: c,
  secao,
}: {
  carreira: EstadoCarreira;
  secao: "mercado" | "clube";
}) {
  const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!,
    contrato = c.jogador.contrato,
    pendentes = c.propostas.filter((p) => p.status === "pendente"),
    dias = Math.max(
      0,
      Math.ceil(
        (Date.parse(contrato.dataTermino) - Date.parse(c.dataAtual)) / 86400000,
      ),
    );

  if (secao === "clube") {
    return (
      <>
        <p className="sobretitulo">ESTRUTURA / EQUIPE</p>
        <h1>{clube.nome.toUpperCase()}</h1>
        <PainelEquipe clube={clube} jogadorUsuario={c.jogador} />
        <section className="painel espaco">
          <div className="linha-titulo">
            <h2>SEU VÍNCULO</h2>
            <Escudo clube={clube} tamanho={40} />
          </div>
          <dl className="ficha">
            <div>
              <dt>Contrato</dt>
              <dd>
                {contrato.tipo === "base"
                  ? "Formação / categoria de base"
                  : "Profissional"}
              </dd>
            </div>
            <div>
              <dt>Salário semanal</dt>
              <dd>{dinheiro(contrato.salario)}</dd>
            </div>
            <div>
              <dt>Término</dt>
              <dd>
                {formatarData(contrato.dataTermino)} · {dias} dias
              </dd>
            </div>
            <div>
              <dt>Papel esperado</dt>
              <dd>{contrato.papelEsperado.replace("rotacao", "rotação")}</dd>
            </div>
          </dl>
        </section>
      </>
    );
  }

  return (
    <>
      <p className="sobretitulo">AGENTE / CONTRATOS</p>
      <h1>SEU PRÓXIMO PASSO.</h1>
      <div className="grade-dupla espaco">
        <section className="painel">
          <div className="linha-titulo">
            <h2>VÍNCULO ATUAL</h2>
            <Escudo clube={clube} tamanho={48} />
          </div>
          <h3>{clube.nome}</h3>
          <dl className="ficha">
            <div>
              <dt>Vínculo</dt>
              <dd>
                {contrato.tipo === "base"
                  ? "Formação / categoria de base"
                  : "Contrato profissional"}
              </dd>
            </div>
            <div>
              <dt>Salário semanal</dt>
              <dd>{dinheiro(contrato.salario)}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{formatarData(contrato.dataInicio)}</dd>
            </div>
            <div>
              <dt>Término</dt>
              <dd>{formatarData(contrato.dataTermino)}</dd>
            </div>
            <div>
              <dt>Tempo restante</dt>
              <dd>{dias} dias</dd>
            </div>
            <div>
              <dt>Papel esperado</dt>
              <dd>{contrato.papelEsperado.replace("rotacao", "rotação")}</dd>
            </div>
            <div>
              <dt>Valor de mercado</dt>
              <dd>{dinheiro(c.jogador.valorMercado)}</dd>
            </div>
          </dl>
        </section>
        <section className="painel">
          <h2>CLUBE ATUAL</h2>
          <p className="texto-suave">
            {clube.estadio} · {clube.pais}
            {clube.fundacao ? ` · Desde ${clube.fundacao}` : ""}
          </p>
          <p className="texto-suave">
            Formação-base {clube.formacaoPreferida} ·{" "}
            {clube.elenco.length} jogadores no plantel
          </p>
          <Link className="botao-texto" href="/carreira/clube">
            Ver equipe completa
          </Link>
        </section>
      </div>
      <section className="painel espaco">
        <div className="linha-titulo">
          <h2>PROPOSTAS RECEBIDAS</h2>
          <span className="rotulo">{pendentes.length} EM ABERTO</span>
        </div>
        <p className="texto-suave">
          Janela: {c.janelaTransferencias === "fechada" ? "fechada" : c.janelaTransferencias}
          {c.ligas.length > 1
            ? ` · ${c.ligas.length} ligas no mundo`
            : ""}
        </p>
        {!pendentes.length ? (
          <Vazio
            texto={
              c.jogador.categoria === "base"
                ? "Seu agente acompanha seu desenvolvimento. As propostas profissionais surgem após a promoção."
                : "Nenhuma proposta em aberto. O interesse depende do desempenho e das necessidades dos clubes."
            }
          />
        ) : (
          <div className="espaco">
            <p>As propostas aguardam sua decisão na tela inicial da carreira.</p>
            <Link className="botao principal espaco" href="/carreira">
              Ver propostas no início
            </Link>
          </div>
        )}
        {c.propostas
          .filter((p) => p.status !== "pendente")
          .slice(-6)
          .reverse()
          .map((p) => (
            <div className="proposta-arquivada" key={p.id}>
              <span>
                {c.clubes.find((cl) => cl.id === p.clubeId)?.nome} ·{" "}
                {p.status}
                {p.papelPrometido ? ` · ${p.papelPrometido}` : ""}
              </span>
            </div>
          ))}
      </section>
      {(c.transferenciasRecentes?.length ?? 0) > 0 && (
        <section className="painel espaco">
          <h2>TRANSFERÊNCIAS NO MUNDO</h2>
          {c.transferenciasRecentes.slice(0, 8).map((t) => (
            <div className="proposta-arquivada" key={t.id}>
              <span>
                {t.nomeJogador}:{" "}
                {c.clubes.find((cl) => cl.id === t.deClubeId)?.nome ?? "?"} →{" "}
                {c.clubes.find((cl) => cl.id === t.paraClubeId)?.nome ?? "?"}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
