import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { EstatisticasLinha } from "@/componentes/interface/Elementos";
import { PainelUltimaPartida } from "@/componentes/partida/PainelUltimaPartida";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";

export function PainelDesempenho({
  carreira: c,
}: {
  carreira: EstadoCarreira;
}) {
  const estatisticas = somarEstatisticas(
    c.registros
      .filter((r) => r.ano === c.temporada.ano)
      .map((r) => r.estatisticas),
  );
  const nota =
    estatisticas.jogos > 0
      ? (estatisticas.somaNotas / estatisticas.jogos).toFixed(2)
      : "—";
  const notas = c.jogador.notasRecentes.slice(-8);

  return (
    <div className="vz-pagina">
      <header className="vz-page-head">
        <p className="vz-card-sub">PERFORMANCE</p>
        <h1>Desempenho</h1>
        <p className="texto-suave">
          {formatarTemporada(c.liga.id, c.temporada.ano)} · Nota média {nota}
        </p>
      </header>

      <section className="vz-card vz-hero-compacto">
        <EstatisticasLinha estatisticas={estatisticas} />
        <dl className="vz-contrato-dl">
          <div>
            <dt>Titularidades</dt>
            <dd>{estatisticas.titularidades}</dd>
          </div>
          <div>
            <dt>Minutos</dt>
            <dd>{estatisticas.minutos}</dd>
          </div>
          <div>
            <dt>Cartões</dt>
            <dd>
              {estatisticas.amarelos}A / {estatisticas.vermelhos}V
            </dd>
          </div>
        </dl>
      </section>

      <div className="grade-dupla espaco">
        <section className="vz-card">
          <h3>Forma recente</h3>
          <div className="vz-forma-bolinhas vz-forma-grande">
            {notas.length === 0 ? (
              <p className="vz-empty">Sem notas registradas.</p>
            ) : (
              notas.map((n, i) => (
                <span key={i} className="vz-nota-chip">
                  {n.toFixed(1)}
                </span>
              ))
            )}
          </div>
        </section>
        <section className="vz-card">
          <h3>Histórico</h3>
          <p className="texto-suave">
            Consulte a temporada completa e registros anteriores.
          </p>
          <Link href="/carreira/historico" className="vz-card-link">
            Ver estatísticas →
          </Link>
        </section>
      </div>

      <div className="espaco">
        <PainelUltimaPartida carreira={c} abrirDetalhes={() => undefined} />
      </div>
    </div>
  );
}
