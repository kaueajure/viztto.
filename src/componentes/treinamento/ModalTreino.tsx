"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { ExercicioTreino } from "@/dominio/treinamento/exercicios";
import { notaDeScore } from "@/dominio/treinamento/notas";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import { renderMinigame } from "./minigames/registry";
import type { ResultadoMinigame } from "./minigames/tipos";
import type { ResultadoSessaoTreino } from "@/simulacao/treinamento/aplicar-sessao";
import { criarAleatorio } from "./minigames/tipos";

type Fase = "jogando" | "revisao" | "resultado" | "confirmar-simular";

export function ModalTreino({
  exercicio,
  modo,
  aberto,
  onFechar,
  onAplicar,
  multiplicadorTempo = 1,
  seed,
}: {
  exercicio: ExercicioTreino;
  modo: "jogar" | "simular";
  aberto: boolean;
  onFechar: () => void;
  onAplicar: (entrada: {
    exercicioId: string;
    score: number;
    modo: "jogar" | "simular";
    sessaoId: string;
  }) => ResultadoSessaoTreino | null;
  multiplicadorTempo?: number;
  seed?: number;
}) {
  const tituloId = useId();
  const [fase, setFase] = useState<Fase>(
    modo === "simular" ? "confirmar-simular" : "jogando",
  );
  const [resultado, setResultado] = useState<ResultadoSessaoTreino | null>(null);
  const [scoreLive, setScoreLive] = useState<number | null>(null);
  const [melhorScore, setMelhorScore] = useState(0);
  const [ultimoScore, setUltimoScore] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const aplicado = useRef(false);
  const sessaoId = useRef(
    `${exercicio.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const rng = useRef(criarAleatorio(seed));

  const fecharSeguro = useCallback(() => {
    if (fase === "resultado" && aplicado.current) onFechar();
    else if (fase !== "resultado") onFechar();
  }, [fase, onFechar]);

  useFocoModal(aberto, fecharSeguro, `treino-${exercicio.id}`);

  if (!aberto) return null;

  const concluirMinigame = (r: ResultadoMinigame) => {
    if (aplicado.current) return;
    setScoreLive(r.score);
    setUltimoScore(r.score);
    setMelhorScore((prev) => Math.max(prev, r.score));
    setFase("revisao");
  };

  const tentarDeNovo = () => {
    if (aplicado.current) return;
    setScoreLive(null);
    setReplayKey((k) => k + 1);
    setFase("jogando");
  };

  const confirmarSessao = (score: number) => {
    if (aplicado.current) return;
    aplicado.current = true;
    try {
      const res = onAplicar({
        exercicioId: exercicio.id,
        score,
        modo: "jogar",
        sessaoId: sessaoId.current,
      });
      setResultado(res);
      setFase("resultado");
    } catch (erro) {
      setResultado(null);
      setFase("resultado");
      console.error(erro);
    }
  };

  const confirmarSimular = () => {
    if (aplicado.current) return;
    aplicado.current = true;
    try {
      const res = onAplicar({
        exercicioId: exercicio.id,
        score: 0,
        modo: "simular",
        sessaoId: sessaoId.current,
      });
      setResultado(res);
      setFase("resultado");
    } catch (erro) {
      setResultado(null);
      setFase("resultado");
      console.error(erro);
    }
  };

  const scoreConfirmacao = Math.max(melhorScore, ultimoScore);
  const notaPreview = notaDeScore(scoreConfirmacao);

  return (
    <div className="treino-modal-fundo">
      <div
        className="treino-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        data-testid="modal-treino"
      >
        <header className="treino-modal-topo">
          <div>
            <p className="sobretitulo">CENTRO DE TREINAMENTO</p>
            <h2 id={tituloId}>{exercicio.nome}</h2>
          </div>
          {fase !== "resultado" && (
            <button type="button" className="botao-texto" onClick={fecharSeguro} aria-label="Fechar">
              Fechar
            </button>
          )}
        </header>

        {fase === "confirmar-simular" && (
          <div className="treino-resultado">
            <p>
              Simular <strong>{exercicio.nome}</strong> usando sua melhor nota?
            </p>
            <div className="treino-card-acoes">
              <button
                type="button"
                className="botao principal"
                onClick={confirmarSimular}
                data-testid="confirmar-simular"
              >
                SIMULAR
              </button>
              <button type="button" className="botao secundario" onClick={onFechar}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {fase === "jogando" && (
          <>
            <p className="texto-suave">{exercicio.instrucao}</p>
            {scoreLive != null && (
              <p data-testid="treino-score-atual">Score atual: {scoreLive}</p>
            )}
            {melhorScore > 0 && (
              <p className="texto-suave" data-testid="treino-melhor-score">
                Melhor nesta sessão: {melhorScore} (nota {notaDeScore(melhorScore)})
              </p>
            )}
            <div key={replayKey}>
              {renderMinigame(exercicio.id, {
                onConcluido: concluirMinigame,
                aleatorio: rng.current,
                multiplicadorTempo,
              })}
            </div>
          </>
        )}

        {fase === "revisao" && (
          <div className="treino-resultado" data-testid="treino-revisao">
            <p className="sobretitulo">TENTATIVA</p>
            <h3>{exercicio.nome}</h3>
            <p>
              Última pontuação: <strong data-testid="revisao-score">{ultimoScore}</strong>
            </p>
            <p className="treino-nota-grande" data-testid="revisao-nota">
              NOTA {notaDeScore(ultimoScore)}
            </p>
            {melhorScore > ultimoScore && (
              <p className="texto-suave" data-testid="revisao-melhor">
                Melhor tentativa: {melhorScore} (nota {notaDeScore(melhorScore)})
              </p>
            )}
            <p className="texto-suave">
              Você pode tentar de novo para melhorar a nota. A sessão só é
              consumida ao confirmar.
            </p>
            <div className="treino-card-acoes">
              <button
                type="button"
                className="botao secundario"
                onClick={tentarDeNovo}
                data-testid="tentar-de-novo"
              >
                TENTAR DE NOVO
              </button>
              <button
                type="button"
                className="botao principal"
                onClick={() => confirmarSessao(scoreConfirmacao)}
                data-testid="confirmar-treino"
              >
                CONFIRMAR (NOTA {notaPreview})
              </button>
            </div>
          </div>
        )}

        {fase === "resultado" && resultado && (
          <div className="treino-resultado" data-testid="treino-resultado">
            <p className="sobretitulo">TREINO CONCLUÍDO</p>
            <h3>{exercicio.nome}</h3>
            <p>
              Pontuação: <strong data-testid="resultado-score">{resultado.score}</strong>
            </p>
            <p className="treino-nota-grande" data-testid="resultado-nota">
              NOTA {resultado.nota}
            </p>
            {resultado.novoRecorde && (
              <p className="treino-recorde-novo" data-testid="novo-recorde">
                NOVO RECORDE
                {resultado.recordeAnterior
                  ? ` ${resultado.recordeAnterior} → ${resultado.nota}`
                  : ""}
              </p>
            )}
            <h4>Desenvolvimento</h4>
            <ul className="treino-ganhos">
              {resultado.ganhos.map((g) => (
                <li key={g.atributo} data-testid={`ganho-${g.atributo}`}>
                  <span>{NOMES_ATRIBUTOS[g.atributo]}</span>
                  <span>+{g.xp} XP</span>
                  {g.depois > g.antes && (
                    <strong className="treino-levelup">
                      {g.antes} → {g.depois}
                    </strong>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="botao principal"
              onClick={onFechar}
              data-testid="concluir-treino"
            >
              CONCLUIR
            </button>
          </div>
        )}
        {fase === "resultado" && !resultado && (
          <div className="treino-resultado" data-testid="treino-resultado-erro">
            <p className="aviso">Não foi possível aplicar este treino.</p>
            <button type="button" className="botao secundario" onClick={onFechar}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
