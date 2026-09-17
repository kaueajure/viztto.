import { ConversaContrato } from "@/componentes/clube/ConversaContrato";
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
      return (
        <>
          <p className="sobretitulo">CLUBE</p>
          <h1>Sem clube</h1>
          <ConversaTreinador carreira={c} />
          <ConversaContrato carreira={c} />
          <section className="painel espaco">
            <div className="linha-titulo">
              <h2>SEU VÍNCULO</h2>
              {ultimo && <Escudo clube={ultimo} tamanho={40} />}
            </div>
            <dl className="ficha">
              <div>
                <dt>Status</dt>
                <dd>Sem contrato · agente livre</dd>
              </div>
              <div>
                <dt>Último clube</dt>
                <dd>{ultimo?.nome ?? "—"}</dd>
              </div>
              <div>
                <dt>Tempo sem clube</dt>
                <dd>
                  {semanasSemClube(c) > 0
                    ? `${semanasSemClube(c)} semana(s)`
                    : "Recém-liberado"}
                </dd>
              </div>
            </dl>
          </section>
        </>
      );
    }
    return (
      <>
        <p className="sobretitulo">CLUBE</p>
        <h1>{clube.nome}</h1>
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
