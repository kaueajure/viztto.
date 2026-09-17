import Link from "next/link";
import type { EstadoCarreira, LinhaClassificacao } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
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
  const semanas = semanasSemClube(c);

  if (livre) {
    return (
      <section className="vz-card vz-clube">
        <header className="vz-card-head">
          <h3>Agente livre</h3>
          <Link
            href="/carreira/mercado"
            className="vz-card-arrow"
            aria-label="Abrir transferências"
          >
            <ChevronRight size={16} />
          </Link>
        </header>
        <div className="vz-clube-corpo">
          <div>
            <h4>Sem vínculo</h4>
            <p>
              {clube
                ? `Último: ${clube.nome}`
                : "Contrato encerrado"}
              {semanas > 0 ? ` · ${semanas} sem.` : ""}
            </p>
          </div>
          {clube && <Escudo clube={clube} tamanho={56} />}
        </div>
        <Link href="/carreira/mercado" className="vz-card-link">
          Buscar oportunidades →
        </Link>
      </section>
    );
  }

  if (!clube) {
    return (
      <section className="vz-card vz-clube">
        <header className="vz-card-head">
          <h3>Meu clube</h3>
        </header>
        <p className="vz-empty">Sem vínculo clubístico.</p>
      </section>
    );
  }

  return (
    <section className="vz-card vz-clube">
      <header className="vz-card-head">
        <h3>Meu clube</h3>
        <Link
          href="/carreira/clube"
          className="vz-card-arrow"
          aria-label="Abrir clube"
        >
          <ChevronRight size={16} />
        </Link>
      </header>
      <div className="vz-clube-corpo">
        <div>
          <h4>{clube.nome}</h4>
          <p>{c.liga.nome}</p>
        </div>
        <Escudo clube={clube} tamanho={56} />
      </div>
      {linha ? (
        <div className="vz-clube-metricas">
          <div>
            <span>Pos</span>
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
        Ver tabela →
      </Link>
    </section>
  );
}
