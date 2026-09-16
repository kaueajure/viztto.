import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { Barra, Vazio } from "@/componentes/interface/Elementos";
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
  return (
    <>
      <p className="sobretitulo">
        {secao === "mercado" ? "AGENTE / CONTRATOS" : "ESTRUTURA / ELENCO"}
      </p>
      <h1>
        {secao === "mercado" ? "SEU PRÓXIMO PASSO." : clube.nome.toUpperCase()}
      </h1>
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
          <h2>ESTRUTURA DO CLUBE</h2>
          <p className="texto-suave">
            {clube.estadio} · {clube.pais}
            {clube.fundacao ? ` · Desde ${clube.fundacao}` : ""}
          </p>
          <Barra nome="Ataque" valor={clube.forcaAtaque} />
          <Barra nome="Meio-campo" valor={clube.forcaMeio} />
          <Barra nome="Defesa" valor={clube.forcaDefesa} />
          <Barra nome="Qualidade da base" valor={clube.qualidadeBase} />
          <Barra nome="Reputação" valor={clube.reputacao} />
          <p className="texto-suave">
            Forças e estrutura são avaliações do universo viztto, não
            classificações oficiais.
          </p>
        </section>
      </div>
      {secao === "mercado" && (
        <section className="painel espaco">
          <div className="linha-titulo">
            <h2>PROPOSTAS RECEBIDAS</h2>
            <span className="rotulo">{pendentes.length} EM ABERTO</span>
          </div>
          {!pendentes.length ? (
            <Vazio
              texto={
                c.jogador.categoria === "base"
                  ? "Seu agente acompanha seu desenvolvimento. As propostas profissionais surgem após a promoção."
                  : "Nenhuma proposta em aberto. O interesse depende do seu desempenho, nível e das necessidades dos clubes."
              }
            />
          ) : (
            <div className="espaco">
              <p>
                As propostas aguardam sua decisão na tela inicial da carreira.
              </p>
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
                  {p.tipo === "renovacao" ? "Renovação" : "Transferência"}
                </span>
                <b>{p.status}</b>
              </div>
            ))}
          <p className="texto-suave">
            Nesta fase, as transferências acontecem entre clubes da liga
            importada. Renovações são propostas pela diretoria no último ano do
            vínculo.
          </p>
        </section>
      )}
    </>
  );
}
