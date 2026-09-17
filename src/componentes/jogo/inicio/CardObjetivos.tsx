import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { ChevronRight } from "lucide-react";

export function CardObjetivos({ carreira: c }: { carreira: EstadoCarreira }) {
  const objetivos = c.objetivos.slice(0, 4);
  return (
    <section className="vz-card vz-objetivos">
      <header className="vz-card-head">
        <h3>OBJETIVOS DA TEMPORADA</h3>
        <Link
          href="/carreira/objetivos"
          className="vz-card-arrow"
          aria-label="Abrir objetivos"
        >
          <ChevronRight size={18} />
        </Link>
      </header>
      {objetivos.length === 0 ? (
        <p className="vz-empty">Nenhum objetivo ativo.</p>
      ) : (
        <ul className="vz-obj-lista">
          {objetivos.map((o) => {
            const pct = o.meta > 0 ? Math.min(100, (o.progresso / o.meta) * 100) : 0;
            return (
              <li key={o.id} className={o.concluido ? "concluido" : ""}>
                <div className="vz-obj-topo">
                  <span>{o.titulo}</span>
                  <b>
                    {o.progresso}/{o.meta}
                  </b>
                </div>
                <div className="vz-progresso" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
