import Link from "next/link";
import type { EstadoCarreira, Partida } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
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

export function CardDesempenho({
  carreira: c,
  abrirResumo,
}: {
  carreira: EstadoCarreira;
  abrirResumo?: () => void;
}) {
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
  const circunferencia = 2 * Math.PI * 28;
  const progresso = nota == null ? 0 : Math.min(1, Math.max(0, nota / 10));
  const offset = circunferencia * (1 - progresso);

  const ultima = [...c.temporada.partidas, ...c.temporada.partidasBase].find(
    (p) => p.id === c.ultimaPartidaId,
  );
  const mandante = c.clubes.find((cl) => cl.id === ultima?.mandanteId);
  const visitante = c.clubes.find((cl) => cl.id === ultima?.visitanteId);
  const notaUltima = ultima?.participacao?.nota;

  return (
    <section className="vz-card vz-desempenho">
      <header className="vz-card-head">
        <h3>Desempenho</h3>
        <Link
          href="/carreira/desempenho"
          className="vz-card-arrow"
          aria-label="Abrir desempenho"
        >
          <ChevronRight size={16} />
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
            <span>Ast.</span>
          </div>
        </div>
        <div className="vz-nota-anillo" aria-label="Nota média">
          <svg viewBox="0 0 72 72" width="64" height="64">
            <circle cx="36" cy="36" r="28" className="vz-anel-fundo" />
            <circle
              cx="36"
              cy="36"
              r="28"
              className="vz-anel-valor"
              strokeDasharray={circunferencia}
              strokeDashoffset={offset}
            />
          </svg>
          <div>
            <strong>{nota == null ? "—" : nota.toFixed(1)}</strong>
            <span>Nota</span>
          </div>
        </div>
      </div>
      <div className="vz-forma">
        <span className="vz-forma-label">Forma</span>
        <div className="vz-forma-bolinhas">
          {forma.length === 0 ? (
            <span className="vz-empty">—</span>
          ) : (
            forma.map((r, i) => (
              <span key={`${r}-${i}`} className={`vz-forma-${r.toLowerCase()}`}>
                {r}
              </span>
            ))
          )}
        </div>
      </div>
      {ultima && mandante && visitante && (
        <div className="vz-ultima-linha">
          <div className="vz-ultima-placar">
            <Escudo clube={mandante} tamanho={18} />
            <b>
              {ultima.golsMandante ?? "–"} × {ultima.golsVisitante ?? "–"}
            </b>
            <Escudo clube={visitante} tamanho={18} />
            {notaUltima != null && (
              <span className="vz-ultima-nota">{notaUltima.toFixed(1)}</span>
            )}
          </div>
          {abrirResumo && (
            <button type="button" className="vz-card-link" onClick={abrirResumo}>
              Detalhes →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
