import Link from "next/link";
import type { EstadoCarreira, Partida } from "@/dominio/entidades/modelos";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { ChevronRight } from "lucide-react";

function formaDoClube(
  partidas: Partida[],
  clubeId: string | null,
): ("V" | "E" | "D")[] {
  if (!clubeId) return [];
  return partidas
    .filter(
      (p) =>
        p.golsMandante !== null &&
        [p.mandanteId, p.visitanteId].includes(clubeId),
    )
    .slice(-5)
    .map((p) => {
      const casa = p.mandanteId === clubeId;
      const gm = p.golsMandante!;
      const gv = p.golsVisitante!;
      const gols = casa ? gm : gv;
      const contra = casa ? gv : gm;
      if (gols > contra) return "V";
      if (gols < contra) return "D";
      return "E";
    });
}

export function CardDesempenho({ carreira: c }: { carreira: EstadoCarreira }) {
  const estatisticas = somarEstatisticas(
    c.registros
      .filter((r) => r.ano === c.temporada.ano)
      .map((r) => r.estatisticas),
  );
  const nota =
    estatisticas.jogos > 0
      ? estatisticas.somaNotas / estatisticas.jogos
      : null;
  const forma = formaDoClube(
    [...c.temporada.partidas, ...c.temporada.partidasBase],
    c.clubeAtualId,
  );
  const circunferencia = 2 * Math.PI * 36;
  const progresso = nota == null ? 0 : Math.min(1, Math.max(0, nota / 10));
  const offset = circunferencia * (1 - progresso);

  return (
    <section className="vz-card vz-desempenho">
      <header className="vz-card-head">
        <h3>DESEMPENHO DA TEMPORADA</h3>
        <Link
          href="/carreira/desempenho"
          className="vz-card-arrow"
          aria-label="Abrir desempenho"
        >
          <ChevronRight size={18} />
        </Link>
      </header>
      <div className="vz-desemp-corpo">
        <div className="vz-desemp-nums">
          <div>
            <strong>{estatisticas.jogos}</strong>
            <span>Jogos</span>
          </div>
          <div>
            <strong>{estatisticas.gols}</strong>
            <span>Gols</span>
          </div>
          <div>
            <strong>{estatisticas.assistencias}</strong>
            <span>Assistências</span>
          </div>
        </div>
        <div className="vz-nota-anillo" aria-label="Nota média">
          <svg viewBox="0 0 88 88" width="88" height="88">
            <circle cx="44" cy="44" r="36" className="vz-anel-fundo" />
            <circle
              cx="44"
              cy="44"
              r="36"
              className="vz-anel-valor"
              strokeDasharray={circunferencia}
              strokeDashoffset={offset}
            />
          </svg>
          <div>
            <strong>{nota == null ? "—" : nota.toFixed(1)}</strong>
            <span>Nota média</span>
          </div>
        </div>
      </div>
      <div className="vz-forma">
        <span className="vz-forma-label">ÚLTIMOS JOGOS</span>
        <div className="vz-forma-bolinhas">
          {forma.length === 0 ? (
            <span className="vz-empty">Sem resultados ainda</span>
          ) : (
            forma.map((r, i) => (
              <span key={`${r}-${i}`} className={`vz-forma-${r.toLowerCase()}`}>
                {r}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
