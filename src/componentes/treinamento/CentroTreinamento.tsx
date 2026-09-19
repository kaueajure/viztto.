"use client";

import { useEffect, useMemo, useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import {
  EXERCICIOS,
  ROTULOS_CATEGORIA,
  exerciciosRecomendados,
  exerciciosVisiveisPara,
  type CategoriaExercicio,
  type ExercicioTreino,
} from "@/dominio/treinamento/exercicios";
import { MAX_SESSOES_SEMANA } from "@/dominio/treinamento/progresso";
import { recomendacaoTreinador } from "@/dominio/treinamento/recomendacoes";
import { formatarData } from "@/utilitarios/formatacao";
import { useJogoStore } from "@/estado/jogo-store";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
import {
  garantirCentro,
  sessoesDisponiveis,
} from "@/simulacao/treinamento/aplicar-sessao";
import { CardExercicio } from "./CardExercicio";
import { ModalTreino } from "./ModalTreino";
import { Barra } from "@/componentes/interface/Elementos";

function PainelAutoTreino({
  carreira: c,
  visiveis,
}: {
  carreira: EstadoCarreira;
  visiveis: ExercicioTreino[];
}) {
  const salvarAuto = useJogoStore((s) => s.definirAutoTreino);
  const auto = c.jogador.preparacao.centro?.autoTreino ?? {
    ativo: false,
    exercicioIds: [] as string[],
  };
  const [selecao, setSelecao] = useState<string[]>(auto.exercicioIds);
  const [ativoLocal, setAtivoLocal] = useState(auto.ativo);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setSelecao(auto.exercicioIds);
    setAtivoLocal(auto.ativo);
    setSalvoOk(false);
  }, [auto.ativo, auto.exercicioIds.join("|")]);

  const toggleExercicio = (id: string) => {
    setErro(null);
    setSelecao((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SESSOES_SEMANA) return prev;
      return [...prev, id];
    });
  };

  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  const aplicar = async (ligar: boolean) => {
    if (salvando) return;
    setSalvando(true);
    setSalvoOk(false);
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    try {
      setErro(null);
      salvarAuto(ligar, selecao);
      setAtivoLocal(ligar);
      setSalvoOk(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="painel" data-testid="treino-automatico">
      <h2>TREINO AUTOMÁTICO</h2>
      <p className="texto-suave">
        Escolha até {MAX_SESSOES_SEMANA} exercícios. Com o automático ligado, ao
        avançar a semana as sessões restantes são preenchidas sozinhas (usa seu
        recorde; se ainda não tiver, aplica um treino padrão).
      </p>
      <label className="treino-auto-toggle">
        <input
          type="checkbox"
          checked={ativoLocal}
          data-testid="toggle-treino-automatico"
          onChange={(e) => {
            const ligar = e.target.checked;
            if (ligar && selecao.length === 0) {
              setErro("Escolha ao menos um exercício antes de ativar.");
              return;
            }
            aplicar(ligar);
          }}
        />
        <span>Ativar treino automático</span>
      </label>
      {ativoLocal && (
        <p className="texto-suave" data-testid="treino-auto-ativo">
          Ativo — {selecao.length} exercício(s) configurado(s).
        </p>
      )}
      <div className="treino-auto-escolhas" role="group" aria-label="Exercícios do automático">
        {visiveis.map((ex) => {
          const marcado = selecao.includes(ex.id);
          const cheio = !marcado && selecao.length >= MAX_SESSOES_SEMANA;
          return (
            <button
              key={ex.id}
              type="button"
              className={`treino-auto-chip ${marcado ? "ativo" : ""}`}
              disabled={cheio}
              aria-pressed={marcado}
              data-testid={`auto-treino-${ex.id}`}
              onClick={() => toggleExercicio(ex.id)}
            >
              {marcado ? "✓ " : ""}
              {ex.nome}
            </button>
          );
        })}
      </div>
      <div className="treino-auto-acoes">
        <button
          type="button"
          className="botao secundario"
          data-testid="salvar-treino-automatico"
          disabled={salvando}
          aria-busy={salvando}
          onClick={() => void aplicar(ativoLocal)}
        >
          {salvando ? "Salvando…" : "Salvar seleção"}
        </button>
      </div>
      {salvoOk && !erro && (
        <p className="texto-suave" role="status" data-testid="treino-auto-salvo">
          Seleção salva
          {selecao.length > 0
            ? ` — ${selecao.length} exercício(s) nos slots da semana.`
            : "."}
        </p>
      )}
      {erro && (
        <p className="aviso erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}

export function CentroTreinamento({ carreira: c }: { carreira: EstadoCarreira }) {
  const concluir = useJogoStore((s) => s.concluirSessaoTreino);
  const livre = estaSemClube(c);
  const aposentado = c.aposentado;
  const lesionado = !!c.jogador.lesao;

  // Garante estrutura na leitura (sem mutar store aqui — clone visual).
  const centro = c.jogador.preparacao.centro ?? {
    progressoAtributos: {},
    melhoresExercicios: {},
    semana: { chave: "", sessoes: [] },
    autoTreino: { ativo: false, exercicioIds: [] },
  };
  const usadas = centro.semana.sessoes.length;
  const restantes = Math.max(0, MAX_SESSOES_SEMANA - usadas);
  const podeTreinar = !aposentado && !lesionado && restantes > 0;

  const [filtro, setFiltro] = useState<CategoriaExercicio | "todos">("todos");
  const [modal, setModal] = useState<{
    exercicio: ExercicioTreino;
    modo: "jogar" | "simular";
  } | null>(null);

  const visiveis = useMemo(
    () => exerciciosVisiveisPara(c.jogador.posicao),
    [c.jogador.posicao],
  );
  const recomendados = useMemo(() => {
    const base = exerciciosRecomendados(c.jogador.posicao);
    const obj = c.acompanhamento.objetivoPessoal;
    if (!obj || obj.concluido) return base;
    if (obj.tipo !== "titular" && obj.tipo !== "tecnica") return base;
    const coach = recomendacaoTreinador(
      c.jogador.posicao,
      c.jogador.atributos,
      obj.tipo,
    );
    const ids = new Set(coach.exercicios.map((e) => e.id));
    return [
      ...coach.exercicios,
      ...base.filter((e) => !ids.has(e.id)),
    ];
  }, [
    c.jogador.posicao,
    c.jogador.atributos,
    c.acompanhamento.objetivoPessoal,
  ]);
  const coach = useMemo(
    () =>
      livre
        ? null
        : recomendacaoTreinador(
            c.jogador.posicao,
            c.jogador.atributos,
            c.acompanhamento.objetivoPessoal &&
              !c.acompanhamento.objetivoPessoal.concluido
              ? c.acompanhamento.objetivoPessoal.tipo
              : null,
          ),
    [
      livre,
      c.jogador.posicao,
      c.jogador.atributos,
      c.acompanhamento.objetivoPessoal,
    ],
  );

  const catalogo = visiveis.filter(
    (e) => filtro === "todos" || e.categoria === filtro,
  );

  const fimSemana = (() => {
    try {
      const d = new Date(`${c.dataAtual}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 6);
      return d.toISOString().slice(0, 10);
    } catch {
      return c.dataAtual;
    }
  })();

  return (
    <>
      <p className="sobretitulo">
        {livre ? "TREINO INDIVIDUAL" : "CENTRO DE TREINAMENTO"}
      </p>
      <h1>{livre ? "Treino sem comissão" : "Centro de treinamento"}</h1>
      <p className="texto-suave">
        Semana de {formatarData(c.dataAtual)} – {formatarData(fimSemana)}. Escolha
        exercícios, jogue o minigame e evolua atributos reais.
      </p>

      {aposentado && (
        <p className="aviso" role="status">
          Carreira aposentada — treinamento indisponível.
        </p>
      )}
      {lesionado && (
        <p className="aviso" role="status" data-testid="aviso-lesao-treino">
          Você está se recuperando de lesão e não pode participar do treinamento
          desta semana.
        </p>
      )}

      <section className="painel treino-resumo" data-testid="treino-semana">
        <h2>TREINO DA SEMANA</h2>
        <p className="treino-slots" aria-label={`${usadas} de ${MAX_SESSOES_SEMANA} sessões`}>
          {Array.from({ length: MAX_SESSOES_SEMANA }, (_, i) => (
            <span key={i} className={i < usadas ? "feito" : ""} aria-hidden>
              ●
            </span>
          ))}
          <strong>
            {usadas} / {MAX_SESSOES_SEMANA} sessões realizadas
          </strong>
        </p>
        {restantes === 0 && !lesionado && !aposentado && (
          <p className="texto-suave" data-testid="limite-sessoes">
            Você já concluiu as 3 sessões desta semana.
          </p>
        )}
        <div className="treino-slots-lista">
          {(() => {
            const feitos = new Set(
              centro.semana.sessoes.map((s) => s.exercicioId),
            );
            const filaPlanejada = (
              centro.autoTreino?.exercicioIds ?? []
            ).filter((id) => !feitos.has(id));
            let planoIdx = 0;
            return Array.from({ length: MAX_SESSOES_SEMANA }, (_, i) => {
              const s = centro.semana.sessoes[i];
              const ex = s
                ? EXERCICIOS.find((e) => e.id === s.exercicioId)
                : null;
              const planejadoId = !s ? filaPlanejada[planoIdx++] : undefined;
              const planejado = planejadoId
                ? EXERCICIOS.find((e) => e.id === planejadoId)
                : null;
              return (
                <div
                  key={i}
                  className={`treino-slot ${s ? "concluido" : ""} ${planejado ? "planejado" : ""}`}
                  data-testid={`slot-treino-${i}`}
                >
                  {s && ex ? (
                    <>
                      <strong>{ex.nome}</strong>
                      <span>Nota {s.nota}</span>
                      <small>CONCLUÍDO</small>
                    </>
                  ) : planejado ? (
                    <>
                      <strong>{planejado.nome}</strong>
                      <span className="texto-suave">
                        {centro.autoTreino?.ativo
                          ? "Automático na próxima semana"
                          : "Na sua seleção"}
                      </span>
                      <small>PLANEJADO</small>
                    </>
                  ) : (
                    <span className="texto-suave">
                      Livre — jogue um exercício abaixo
                    </span>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </section>

      {!aposentado && !lesionado && (
        <PainelAutoTreino carreira={c} visiveis={visiveis} />
      )}

      {!livre && coach && (
        <section className="painel">
          <h2>RECOMENDADO PELO TREINADOR</h2>
          <p className="texto-suave">{coach.texto}</p>
          <div className="treino-grade">
            {coach.exercicios.map((ex) => (
              <CardExercicio
                key={`coach-${ex.id}`}
                exercicio={ex}
                recorde={centro.melhoresExercicios[ex.id]}
                podeJogar={podeTreinar}
                onJogar={() => setModal({ exercicio: ex, modo: "jogar" })}
                onSimular={
                  centro.melhoresExercicios[ex.id]
                    ? () => setModal({ exercicio: ex, modo: "simular" })
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="painel">
        <h2>RECOMENDADOS PARA SUA POSIÇÃO</h2>
        <div className="treino-grade">
          {recomendados.map((ex) => (
            <CardExercicio
              key={ex.id}
              exercicio={ex}
              recorde={centro.melhoresExercicios[ex.id]}
              podeJogar={podeTreinar}
              onJogar={() => setModal({ exercicio: ex, modo: "jogar" })}
              onSimular={
                centro.melhoresExercicios[ex.id]
                  ? () => setModal({ exercicio: ex, modo: "simular" })
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="painel">
        <h2>TODOS OS EXERCÍCIOS</h2>
        <div className="filtros" role="tablist" aria-label="Filtrar exercícios">
          <button
            type="button"
            className={filtro === "todos" ? "ativo" : ""}
            onClick={() => setFiltro("todos")}
          >
            Todos
          </button>
          {(Object.keys(ROTULOS_CATEGORIA) as CategoriaExercicio[])
            .filter((cat) =>
              c.jogador.posicao === "GOL"
                ? true
                : cat !== "goleiro" || visiveis.some((e) => e.categoria === "goleiro"),
            )
            .filter((cat) =>
              c.jogador.posicao === "GOL" ? true : cat !== "goleiro",
            )
            .map((cat) => (
              <button
                key={cat}
                type="button"
                className={filtro === cat ? "ativo" : ""}
                onClick={() => setFiltro(cat)}
              >
                {ROTULOS_CATEGORIA[cat]}
              </button>
            ))}
        </div>
        <div className="treino-grade espaco">
          {catalogo.map((ex) => (
            <CardExercicio
              key={`all-${ex.id}`}
              exercicio={ex}
              recorde={centro.melhoresExercicios[ex.id]}
              podeJogar={podeTreinar}
              onJogar={() => setModal({ exercicio: ex, modo: "jogar" })}
              onSimular={
                centro.melhoresExercicios[ex.id]
                  ? () => setModal({ exercicio: ex, modo: "simular" })
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="painel">
        <h2>PREPARAÇÃO FÍSICA</h2>
        <Barra nome="Condicionamento" valor={c.jogador.condicionamento} />
        <Barra nome="Fadiga" valor={c.jogador.fadiga} />
        <Barra nome="Ritmo de jogo" valor={c.jogador.ritmo} />
      </section>

      {modal && (
        <ModalTreino
          key={`${modal.exercicio.id}-${modal.modo}`}
          exercicio={modal.exercicio}
          modo={modal.modo}
          aberto
          onFechar={() => setModal(null)}
          onAplicar={(entrada) => concluir(entrada)}
        />
      )}
    </>
  );
}

/** Mantém sync tipado sem side-effect — usado em testes. */
export function previewSessoes(c: EstadoCarreira) {
  const j = structuredClone(c.jogador);
  garantirCentro(j, c.dataAtual);
  return sessoesDisponiveis(j, c.dataAtual);
}
