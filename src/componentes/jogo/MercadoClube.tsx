import Link from "next/link";
import { ConversaTreinador } from "@/componentes/clube/ConversaTreinador";
import { MercadoAgente } from "./MercadoAgente";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { PainelEquipe } from "@/componentes/clube/PainelEquipe";
import { dinheiro, formatarData } from "@/utilitarios/formatacao";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
import { criarMercado } from "@/dominio/mercado";

export function MercadoClube({
  carreira: c,
  secao,
}: {
  carreira: EstadoCarreira;
  secao: "mercado" | "clube";
}) {
  const livre = estaSemClube(c);
  const clube = livre
    ? undefined
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const ultimo = c.clubes.find((cl) => cl.id === c.ultimoClubeId);
  const contrato = c.jogador.contrato;
  const dias = Math.max(
    0,
    Math.ceil(
      (Date.parse(contrato.dataTermino) - Date.parse(c.dataAtual)) / 86400000,
    ),
  );

  if (secao === "clube") {
    if (livre || !clube) {
      const m = c.mercado ?? criarMercado();
      const observando = m.interesses.filter(
        (i) => i.status !== "encerrado",
      ).length;
      const clubesMercado = c.clubes.filter(
        (cl) => cl.id !== c.ultimoClubeId,
      ).length;
      return (
        <div className="vz-pagina">
          <header className="vz-page-head">
            <p className="vz-card-sub">CLUBE</p>
            <h1>Você está sem clube</h1>
          </header>
          <section className="vz-card vz-hero-compacto">
            <p>
              {ultimo
                ? `Seu último vínculo com o ${ultimo.nome} terminou.`
                : "Você não possui vínculo ativo com nenhum clube."}
            </p>
            <p className="texto-suave">
              {clubesMercado} clubes disponíveis no mercado
              {observando > 0
                ? ` · ${observando} acompanhando sua situação`
                : ""}
              {semanasSemClube(c) > 0
                ? ` · ${semanasSemClube(c)} semana(s) sem clube`
                : ""}
            </p>
            <Link className="botao principal" href="/carreira/mercado">
              Ver o mercado
            </Link>
          </section>
        </div>
      );
    }
    return (
      <>
        <p className="sobretitulo">CLUBE</p>
        <h1>{clube.nome}</h1>
        <ConversaTreinador carreira={c} />
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
          <Link className="botao secundario" href="/carreira/contrato">
            Gerenciar contrato →
          </Link>
        </section>
      </>
    );
  }

  return <MercadoAgente carreira={c} />;
}
