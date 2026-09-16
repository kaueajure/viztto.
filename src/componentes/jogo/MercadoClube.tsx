import { ConversaContrato } from "@/componentes/clube/ConversaContrato";
import { ConversaTreinador } from "@/componentes/clube/ConversaTreinador";
import { MercadoAgente } from "./MercadoAgente";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { PainelEquipe } from "@/componentes/clube/PainelEquipe";
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
        <ConversaTreinador carreira={c} />
        <ConversaContrato carreira={c} />
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

  return <MercadoAgente carreira={c} />;
}
