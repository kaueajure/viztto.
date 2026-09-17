import Link from "next/link";
import type { Clube, EstadoCarreira, Partida } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { diaDoMes, mesAnoCurto } from "@/utilitarios/apresentacao-carreira";
import { ChevronRight } from "lucide-react";

function linhaJogo(
  p: Partida,
  clubes: Clube[],
  meuId: string | null | undefined,
) {
  const mandante = clubes.find((c) => c.id === p.mandanteId)!;
  const visitante = clubes.find((c) => c.id === p.visitanteId)!;
  const casa = meuId === p.mandanteId;
  return {
    dia: diaDoMes(p.data),
    mandante,
    visitante,
    local: casa ? "casa" : "fora",
  };
}

export function CardMiniCalendario({
  carreira: c,
  proximos,
}: {
  carreira: EstadoCarreira;
  proximos: Partida[];
}) {
  const clubeId = c.clubeAtualId;
  return (
    <section className="vz-card vz-mini-cal">
      <header className="vz-card-head">
        <div>
          <h3>CALENDÁRIO</h3>
          <p className="vz-card-sub">{mesAnoCurto(c.dataAtual)}</p>
        </div>
        <Link
          href="/carreira/calendario"
          className="vz-card-arrow"
          aria-label="Abrir calendário"
        >
          <ChevronRight size={18} />
        </Link>
      </header>
      {proximos.length === 0 ? (
        <p className="vz-empty">Sem jogos agendados.</p>
      ) : (
        <ul className="vz-cal-lista">
          {proximos.slice(0, 3).map((p) => {
            const item = linhaJogo(p, c.clubes, clubeId);
            return (
              <li key={p.id}>
                <span className="vz-cal-dia">{item.dia}</span>
                <Escudo clube={item.mandante} tamanho={22} />
                <span className="vz-cal-x">X</span>
                <Escudo clube={item.visitante} tamanho={22} />
                <span className="vz-cal-codigos">
                  {item.mandante.codigo} x {item.visitante.codigo}
                </span>
                <span className="vz-cal-local">({item.local})</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
