import Link from "next/link";
import type { EstadoCarreira, LinhaClassificacao } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
import { ChevronRight } from "lucide-react";

export function CardMeuClube({
  carreira: c,
  linha,
}: {
  carreira: EstadoCarreira;
  linha?: LinhaClassificacao;
}) {
  const livre = estaSemClube(c);
  const clube = livre
    ? c.clubes.find((cl) => cl.id === c.ultimoClubeId)
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);

  if (!clube) {
    return (
      <section className="vz-card vz-clube">
        <header className="vz-card-head">
          <h3>MEU CLUBE</h3>
        </header>
        <p className="vz-empty">Sem vínculo clubístico no momento.</p>
        <Link href="/carreira/mercado" className="vz-card-link">
          Ir ao mercado →
        </Link>
      </section>
    );
  }

  return (
    <section className="vz-card vz-clube">
      <header className="vz-card-head">
        <h3>MEU CLUBE</h3>
        <Link
          href="/carreira/clube"
          className="vz-card-arrow"
          aria-label="Abrir clube"
        >
          <ChevronRight size={18} />
        </Link>
      </header>
      <div className="vz-clube-corpo">
        <div>
          <h4>{clube.nome}</h4>
          <p>{c.liga.nome}{livre ? " · último clube" : ""}</p>
        </div>
        <Escudo clube={clube} tamanho={72} />
      </div>
      {linha ? (
        <div className="vz-clube-metricas">
          <div>
            <span>Posição</span>
            <b>{linha.posicao}º</b>
          </div>
          <div>
            <span>PTS</span>
            <b>{linha.pontos}</b>
          </div>
          <div>
            <span>VIT</span>
            <b>{linha.vitorias}</b>
          </div>
          <div>
            <span>SG</span>
            <b>
              {linha.saldo > 0 ? "+" : ""}
              {linha.saldo}
            </b>
          </div>
        </div>
      ) : (
        <p className="vz-empty">Classificação indisponível.</p>
      )}
      <Link href="/carreira/competicao" className="vz-card-link">
        Ver tabela completa →
      </Link>
    </section>
  );
}
