import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { POSICOES } from "@/dominio/regras/jogador";
import {
  alturaMetros,
  atributosResumo,
  peDominanteRotulo,
} from "@/utilitarios/apresentacao-carreira";

export function HeroJogador({ carreira: c }: { carreira: EstadoCarreira }) {
  const j = c.jogador;
  const attrs = atributosResumo(j.atributos);
  return (
    <section className="vz-hero" aria-label="Seu jogador">
      <div className="vz-hero-decor" aria-hidden="true">
        <span className="vz-hero-numero">{j.posicao}</span>
        <span className="vz-hero-script">Mais que um jogo</span>
        <ul className="vz-hero-tags">
          <li>Evolução</li>
          <li>Disciplina</li>
          <li>Conquistas</li>
          <li>Legado</li>
        </ul>
      </div>
      <div className="vz-hero-silhueta" aria-hidden="true">
        <div className="vz-hero-avatar">
          <span>
            {j.nome.charAt(0)}
            {j.sobrenome.charAt(0)}
          </span>
          <small>{j.posicao}</small>
        </div>
      </div>
      <div className="vz-hero-info">
        <h2 className="vz-hero-nome">
          <span>{j.nome.toUpperCase()}</span>
          <span>{j.sobrenome.toUpperCase()}</span>
        </h2>
        <p className="vz-hero-meta">
          {POSICOES[j.posicao]} ({j.posicao})
        </p>
        <p className="vz-hero-detalhes">
          <span className="vz-flag" title={j.nacionalidade}>
            {j.nacionalidade.slice(0, 2).toUpperCase()}
          </span>
          <span>{j.idade} anos</span>
          <span>{alturaMetros(j.altura)}</span>
          <span>{peDominanteRotulo(j.peDominante)}</span>
        </p>
        <div className="vz-hero-stats">
          <div className="vz-ovr">
            <span>GER</span>
            <strong>{j.overall}</strong>
          </div>
          <div className="vz-attr-grid">
            {attrs.map((a) => (
              <div key={a.sigla}>
                <span>{a.sigla}</span>
                <b>{a.valor}</b>
              </div>
            ))}
          </div>
        </div>
        <Link href="/carreira/jogador" className="vz-hero-link">
          Ver perfil completo →
        </Link>
      </div>
    </section>
  );
}
