import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { CentralSemana } from "./CentralSemana";
import { Check } from "lucide-react";

const ROTULOS_PESSOAL: Record<string, string> = {
  titular: "Conquistar titularidade",
  minutos: "Aumentar minutos",
  tecnica: "Evoluir tecnicamente",
  emprestimo: "Buscar empréstimo",
  transferencia: "Buscar transferência",
  renovacao: "Renovar contrato",
};

export function PainelObjetivos({ carreira: c }: { carreira: EstadoCarreira }) {
  const temporada = c.objetivos;
  const pessoal = c.acompanhamento.objetivoPessoal;

  return (
    <div className="vz-pagina">
      <header className="vz-page-head">
        <p className="vz-card-sub">METAS</p>
        <h1>Objetivos</h1>
      </header>

      <CentralSemana carreira={c} />

      <section className="vz-card espaco">
        <h3>Temporada</h3>
        {temporada.length === 0 ? (
          <p className="vz-empty">Nenhum objetivo de temporada.</p>
        ) : (
          <ul className="vz-obj-lista">
            {temporada.map((o) => {
              const pct =
                o.meta > 0 ? Math.min(100, (o.progresso / o.meta) * 100) : 0;
              return (
                <li key={o.id} className={o.concluido ? "concluido" : ""}>
                  <div className="vz-obj-topo">
                    <span>
                      {o.concluido && (
                        <Check size={14} className="vz-check" aria-hidden />
                      )}
                      {o.titulo}
                    </span>
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

      {pessoal && (
        <section className="vz-card espaco">
          <h3>Pessoais</h3>
          <div className="vz-obj-topo">
            <span>
              {ROTULOS_PESSOAL[pessoal.tipo] ?? pessoal.tipo}
              {pessoal.concluido && (
                <Check size={14} className="vz-check" aria-hidden />
              )}
            </span>
            <b>{Math.round(pessoal.progresso)}%</b>
          </div>
          <div className="vz-progresso" aria-hidden="true">
            <span style={{ width: `${Math.min(100, pessoal.progresso)}%` }} />
          </div>
        </section>
      )}
    </div>
  );
}
