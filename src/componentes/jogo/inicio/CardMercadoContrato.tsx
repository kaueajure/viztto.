import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { dinheiro } from "@/utilitarios/formatacao";
import { mesContrato } from "@/utilitarios/apresentacao-carreira";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
import { ChevronRight } from "lucide-react";

export function CardMercadoContrato({
  carreira: c,
}: {
  carreira: EstadoCarreira;
}) {
  const j = c.jogador;
  const livre = estaSemClube(c);

  return (
    <section className="vz-card vz-mercado-contrato">
      <header className="vz-card-head">
        <h3>VALOR DE MERCADO</h3>
        <Link
          href="/carreira/contrato"
          className="vz-card-arrow"
          aria-label="Abrir contrato"
        >
          <ChevronRight size={18} />
        </Link>
      </header>
      <div className="vz-valor">
        <strong>{dinheiro(j.valorMercado)}</strong>
      </div>
      <div className="vz-contrato-bloco">
        <h4>CONTRATO</h4>
        {livre ? (
          <p className="vz-empty">Agente livre — sem vínculo ativo.</p>
        ) : (
          <dl className="vz-contrato-dl">
            <div>
              <dt>Salário semanal</dt>
              <dd>{dinheiro(j.contrato.salario)}</dd>
            </div>
            <div>
              <dt>Fim do contrato</dt>
              <dd>{mesContrato(j.contrato.dataTermino)}</dd>
            </div>
            {j.contrato.clausulaRescisao != null && (
              <div>
                <dt>Cláusula de rescisão</dt>
                <dd>{dinheiro(j.contrato.clausulaRescisao)}</dd>
              </div>
            )}
          </dl>
        )}
        <Link href="/carreira/contrato" className="vz-card-link">
          Ver contrato →
        </Link>
      </div>
    </section>
  );
}
