"use client";

import { useState } from "react";
import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { EstatisticasLinha } from "@/componentes/interface/Elementos";
import { PainelUltimaPartida } from "@/componentes/partida/PainelUltimaPartida";
import { ResumoPartida } from "@/componentes/partida/ResumoPartida";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";

export function PainelDesempenho({
  carreira: c,
}: {
  carreira: EstadoCarreira;
}) {
  const [resumo, definirResumo] = useState(false);
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
  const ultima = [...c.temporada.partidas, ...c.temporada.partidasBase].find(
    (p) => p.id === c.ultimaPartidaId,
  );

  return (
    <div className="vz-pagina vz-pagina-desempenho" data-testid="pagina-desempenho">
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

      <div className="grade-dupla">
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

      <div className="vz-desemp-ultima">
        <PainelUltimaPartida
          carreira={c}
          abrirDetalhes={() => {
            if (ultima) definirResumo(true);
          }}
        />
      </div>

      {resumo && ultima && (
        <ResumoPartida
          partida={ultima}
          carreira={c}
          fechar={() => definirResumo(false)}
        />
      )}
    </div>
  );
}
