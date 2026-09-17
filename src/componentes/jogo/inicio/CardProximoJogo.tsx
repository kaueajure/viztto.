import Link from "next/link";
import type { EstadoCarreira, Partida } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";
import { ChevronRight } from "lucide-react";

export function CardProximoJogo({
  carreira: c,
  proxima,
  livre,
  jogaBase,
}: {
  carreira: EstadoCarreira;
  proxima?: Partida;
  livre: boolean;
  jogaBase: boolean;
}) {
  const mandante = c.clubes.find((cl) => cl.id === proxima?.mandanteId);
  const visitante = c.clubes.find((cl) => cl.id === proxima?.visitanteId);

  return (
    <section className="vz-card vz-proximo">
      <header className="vz-card-head">
        <div>
          <h3>PRÓXIMO JOGO</h3>
          <p className="vz-card-sub">
            {c.liga.nome}
            {jogaBase ? " · Sub-20" : ""}
          </p>
        </div>
        <Link
          href="/carreira/calendario"
          className="vz-card-arrow"
          aria-label="Abrir calendário"
        >
          <ChevronRight size={18} />
        </Link>
      </header>

      {livre ? (
        <div className="vz-empty-block">
          <p className="vz-empty-title">Buscando oportunidade</p>
          <p>Sem partidas de clube até assinar um novo contrato.</p>
        </div>
      ) : c.temporada.encerrada ? (
        <div className="vz-empty-block">
          <p className="vz-empty-title">Temporada encerrada</p>
          <p>Avance para a próxima temporada no painel inferior.</p>
        </div>
      ) : mandante && visitante && proxima ? (
        <div className="vz-proximo-corpo">
          <div className="vz-proximo-times">
            <div>
              <Escudo clube={mandante} tamanho={56} />
              <span title={mandante.nome}>{mandante.codigo}</span>
            </div>
            <b>VS</b>
            <div>
              <Escudo clube={visitante} tamanho={56} />
              <span title={visitante.nome}>{visitante.codigo}</span>
            </div>
          </div>
          <div className="vz-proximo-meta">
            <p>{formatarData(proxima.data)}</p>
            <p>Rodada {proxima.rodada}</p>
            <p>{mandante.estadio}</p>
          </div>
        </div>
      ) : (
        <div className="vz-empty-block">
          <p className="vz-empty-title">Calendário encerrado</p>
          <p>Não há próximos compromissos nesta temporada.</p>
        </div>
      )}
    </section>
  );
}
