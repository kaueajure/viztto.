"use client";

import { useEffect, useRef, useState } from "react";
import { mediaScores, type PropsMinigame } from "./tipos";

export function MinigameFinalizacaoColocada({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const [idx, setIdx] = useState(0);
  const [alvo, setAlvo] = useState(0);
  const [ativo, setAtivo] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [inicio, setInicio] = useState(0);
  const tentativas = 5;
  const resolvido = useRef(false);

  useEffect(() => {
    if (idx >= tentativas) return;
    resolvido.current = false;
    setAtivo(false);
    const delay = (400 + aleatorio() * 700) / multiplicadorTempo;
    let inner = 0;
    const outer = window.setTimeout(() => {
      setAlvo(Math.floor(aleatorio() * 6));
      setAtivo(true);
      setInicio(performance.now());
      inner = window.setTimeout(() => {
        if (resolvido.current) return;
        resolvido.current = true;
        setAtivo(false);
        setScores((prev) => {
          const novos = [...prev, 15];
          const prox = idx + 1;
          queueMicrotask(() => {
            setIdx(prox);
            if (prox >= tentativas) {
              onConcluido({
                exercicioId: "finalizacao-colocada",
                score: mediaScores(novos),
                tentativas,
              });
            }
          });
          return novos;
        });
      }, 900 / multiplicadorTempo);
    }, delay);
    return () => {
      clearTimeout(outer);
      if (inner) clearTimeout(inner);
    };
  }, [idx, aleatorio, multiplicadorTempo, onConcluido, tentativas]);

  const clicar = (zona: number) => {
    if (!ativo || idx >= tentativas || resolvido.current) return;
    resolvido.current = true;
    const ms = performance.now() - inicio;
    let s = 0;
    if (zona === alvo) {
      s = ms < 350 ? 100 : ms < 550 ? 88 : ms < 800 ? 75 : 60;
    } else {
      s = Math.max(10, 35 - Math.abs(zona - alvo) * 8);
    }
    const novos = [...scores, s];
    setScores(novos);
    setAtivo(false);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "finalizacao-colocada",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-finalizacao-colocada">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-gol-zonas" role="group" aria-label="Zonas do gol">
        {Array.from({ length: 6 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`treino-zona-gol ${ativo && i === alvo ? "alvo" : ""}`}
            onClick={() => clicar(i)}
            aria-label={`Zona ${i + 1}`}
            data-testid={`zona-gol-${i}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
