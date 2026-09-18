"use client";

import { useEffect, useRef, useState } from "react";
import {
  mediaScores,
  scorePorDistancia,
  type PropsMinigame,
} from "./tipos";

/** Barra oscilante com zonas vermelho/amarelo/verde — pênaltis, desarme, etc. */
export function MinigameBarraTiming({
  onConcluido,
  exercicioId,
  tentativas = 5,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
  rotuloAcao = "CHUTAR",
}: PropsMinigame & {
  exercicioId: string;
  tentativas?: number;
  rotuloAcao?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const dir = useRef(1);
  const posRef = useRef(0.15);
  const cursorRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const onConcluidoRef = useRef(onConcluido);
  const reduzido =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pararRef = useRef<() => void>(() => {});

  useEffect(() => {
    onConcluidoRef.current = onConcluido;
  }, [onConcluido]);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  const parar = () => {
    if (idxRef.current >= tentativas) return;
    const s = scorePorDistancia(posRef.current, 0.5, 0.08, 0.22);
    const novos = [...scoresRef.current, s];
    scoresRef.current = novos;
    setScores(novos);
    const prox = idxRef.current + 1;
    idxRef.current = prox;
    setIdx(prox);
    posRef.current = 0.1 + aleatorio() * 0.2;
    dir.current = 1;
    if (cursorRef.current) {
      cursorRef.current.style.left = `${posRef.current * 100}%`;
      cursorRef.current.dataset.pos = posRef.current.toFixed(4);
    }
    if (prox >= tentativas) {
      onConcluidoRef.current({
        exercicioId,
        score: mediaScores(novos),
        tentativas,
      });
    }
  };
  pararRef.current = parar;

  useEffect(() => {
    const api = {
      getPos: () => posRef.current,
      setPos: (p: number) => {
        posRef.current = Math.max(0, Math.min(1, p));
        dir.current = 0; // congela enquanto o teste posiciona
        const el = cursorRef.current;
        if (el) {
          el.style.left = `${posRef.current * 100}%`;
          el.dataset.pos = posRef.current.toFixed(4);
        }
      },
      /** Dispara a cobrança com a lógica real (scorePorDistancia). */
      chutar: () => pararRef.current(),
    };
    const podeExpor =
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_E2E === "1" ||
      (typeof navigator !== "undefined" && !!navigator.webdriver);
    if (podeExpor) {
      (
        window as unknown as { __vizttoTreinoBarra?: typeof api }
      ).__vizttoTreinoBarra = api;
    }
    return () => {
      if (podeExpor) {
        delete (window as unknown as { __vizttoTreinoBarra?: typeof api })
          .__vizttoTreinoBarra;
      }
    };
  }, []);

  useEffect(() => {
    if (idx >= tentativas) return;
    let raf = 0;
    let last = performance.now();
    const velocidade =
      (reduzido ? 0.25 : 0.45 + aleatorio() * 0.25) * multiplicadorTempo;
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (dir.current !== 0) {
        let p = posRef.current + dir.current * velocidade * dt;
        if (p >= 0.98) {
          p = 0.98;
          dir.current = -1;
        } else if (p <= 0.02) {
          p = 0.02;
          dir.current = 1;
        }
        posRef.current = p;
        const el = cursorRef.current;
        if (el) {
          el.style.left = `${p * 100}%`;
          el.dataset.pos = p.toFixed(4);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, tentativas, aleatorio, multiplicadorTempo, reduzido]);

  return (
    <div className="treino-minigame" data-testid={`minigame-${exercicioId}`}>
      <p className="treino-tentativa" data-testid="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-barra-zonas" role="img" aria-label="Zona de precisão">
        <div className="zona vermelho" />
        <div className="zona amarelo" />
        <div className="zona verde" />
        <div className="zona amarelo" />
        <div className="zona vermelho" />
        <div
          ref={cursorRef}
          className="treino-cursor"
          style={{ left: "15%" }}
          data-testid="treino-cursor"
          data-pos="0.1500"
        />
      </div>
      <button
        type="button"
        className="botao primario treino-acao"
        onClick={parar}
        disabled={idx >= tentativas}
        data-testid="treino-acao"
        aria-label={rotuloAcao}
      >
        {rotuloAcao}
      </button>
      {scores.length > 0 && (
        <p className="texto-suave" data-testid="treino-score-parcial">
          Última: {scores.at(-1)} · Média: {mediaScores(scores)}
        </p>
      )}
    </div>
  );
}
