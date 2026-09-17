"use client";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import type { ObjetivoPessoalTipo } from "@/dominio/desenvolvimento";
import {
  OBJETIVOS_PESSOAIS,
  avaliarDisponibilidadeObjetivo,
  rotuloObjetivo,
} from "@/simulacao/carreira/acompanhamento";
import { useJogoStore } from "@/estado/jogo-store";
import { Check } from "lucide-react";
import { useState } from "react";

const DESC: Record<ObjetivoPessoalTipo, string> = {
  titular: "Ganhe espaço e consolide a titularidade.",
  minutos: "Aumente sua participação em campo.",
  tecnica: "Desenvolva os atributos-chave da sua posição.",
  emprestimo: "Busque minutos em outro clube.",
  transferencia: "Abra caminho para uma mudança de ares.",
  renovacao: "Negocie a extensão do seu vínculo.",
};

export function PainelObjetivos({ carreira: c }: { carreira: EstadoCarreira }) {
  const temporada = c.objetivos;
  const pessoal = c.acompanhamento.objetivoPessoal;
  const escolher = useJogoStore((s) => s.escolherObjetivo);
  const [erro, definirErro] = useState<string | null>(null);
  const tipos = Object.keys(OBJETIVOS_PESSOAIS) as ObjetivoPessoalTipo[];
  const ativo = pessoal && !pessoal.concluido ? pessoal : null;
  const podeTrocar = !c.aposentado;

  function selecionar(tipo: ObjetivoPessoalTipo) {
    definirErro(null);
    try {
      escolher(tipo);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível definir o objetivo.");
    }
  }

  return (
    <div className="vz-pagina">
      <header className="vz-page-head">
        <p className="vz-card-sub">METAS</p>
        <h1>Objetivos</h1>
      </header>

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

      <section className="vz-card espaco" aria-labelledby="obj-pessoal-titulo">
        <h3 id="obj-pessoal-titulo">Objetivo pessoal</h3>

        {ativo && (
          <div className="vz-obj-atual">
            <p className="vz-card-sub">Objetivo atual</p>
            <b>{rotuloObjetivo(c, ativo.tipo)}</b>
            <div className="vz-obj-topo">
              <span>{DESC[ativo.tipo]}</span>
              <b>{Math.round(ativo.progresso)}%</b>
            </div>
            <div className="vz-progresso" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ativo.progresso)}%` }} />
            </div>
          </div>
        )}

        {pessoal?.concluido && !ativo && (
          <p className="vz-empty">
            Último objetivo concluído: {rotuloObjetivo(c, pessoal.tipo)}.
          </p>
        )}

        {erro && (
          <p className="aviso erro" role="alert">
            {erro}
          </p>
        )}

        {podeTrocar ? (
          <>
            <p className="vz-card-sub espaco">
              {ativo ? "Trocar foco" : "Escolha seu foco"}
            </p>
            <div className="vz-obj-grid">
              {tipos.map((tipo) => {
                const disp = avaliarDisponibilidadeObjetivo(c, tipo);
                const selecionado = ativo?.tipo === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    className={`vz-obj-card${selecionado ? " selecionada" : ""}`}
                    disabled={!disp.disponivel || selecionado}
                    aria-pressed={selecionado}
                    onClick={() => selecionar(tipo)}
                  >
                    <strong>{rotuloObjetivo(c, tipo)}</strong>
                    <span>{DESC[tipo]}</span>
                    {!disp.disponivel && disp.motivo && (
                      <small>{disp.motivo}</small>
                    )}
                    {selecionado && <small>Em andamento</small>}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="texto-suave">Carreira encerrada — objetivos indisponíveis.</p>
        )}
      </section>
    </div>
  );
}
