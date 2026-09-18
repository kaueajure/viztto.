"use client";

import { useEffect, useRef, useState } from "react";
import { mediaScores, type PropsMinigame } from "./tipos";

export function MinigameInterceptacao({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 6;
  const [idx, setIdx] = useState(0);
  const [alvo, setAlvo] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (idx >= tentativas) return;
    setAtivo(false);
    let cancelado = false;
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        if (cancelado) return;
        setAlvo(Math.floor(aleatorio() * 3));
        setAtivo(true);
        timers.push(
          window.setTimeout(() => {
            if (!cancelado) setAtivo(false);
          }, 900 / multiplicadorTempo),
        );
      }, (350 + aleatorio() * 500) / multiplicadorTempo),
    );
    return () => {
      cancelado = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [idx, aleatorio, multiplicadorTempo]);

  const escolher = (i: number) => {
    if (idx >= tentativas) return;
    const s = ativo && i === alvo ? 92 : i === alvo ? 55 : 28;
    const novos = [...scores, s + Math.round(aleatorio() * 8)];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "interceptacao",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-interceptacao">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-dirs">
        {(["Esquerda", "Centro", "Direita"] as const).map((r, i) => (
          <button
            key={r}
            type="button"
            className={`botao ${ativo && i === alvo ? "primario" : ""}`}
            onClick={() => escolher(i)}
            aria-label={r}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigameGoleiroReflexos({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 8;
  const [idx, setIdx] = useState(0);
  const [alvo, setAlvo] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [ativo, setAtivo] = useState(false);
  const [inicio, setInicio] = useState(0);
  const resolvido = useRef(false);

  const finalizarTentativa = (s: number, acumulado: number[]) => {
    const novos = [...acumulado, s];
    setScores(novos);
    setAtivo(false);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "goleiro-reflexos",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  useEffect(() => {
    if (idx >= tentativas) return;
    resolvido.current = false;
    setAtivo(false);
    let inner = 0;
    const outer = window.setTimeout(() => {
      setAlvo(Math.floor(aleatorio() * 6));
      setAtivo(true);
      setInicio(performance.now());
      inner = window.setTimeout(() => {
        if (resolvido.current) return;
        resolvido.current = true;
        setScores((prev) => {
          const novos = [...prev, 18];
          const prox = idx + 1;
          queueMicrotask(() => {
            setAtivo(false);
            setIdx(prox);
            if (prox >= tentativas) {
              onConcluido({
                exercicioId: "goleiro-reflexos",
                score: mediaScores(novos),
                tentativas,
              });
            }
          });
          return novos;
        });
      }, 900 / multiplicadorTempo);
    }, (250 + aleatorio() * 600) / multiplicadorTempo);
    return () => {
      clearTimeout(outer);
      if (inner) clearTimeout(inner);
    };
  }, [idx, aleatorio, multiplicadorTempo, onConcluido, tentativas]);

  const clicar = (i: number) => {
    if (!ativo || idx >= tentativas || resolvido.current) return;
    resolvido.current = true;
    const ms = performance.now() - inicio;
    const s =
      i === alvo
        ? ms < 300
          ? 100
          : ms < 500
            ? 85
            : 65
        : 20;
    finalizarTentativa(s, scores);
  };

  return (
    <div className="treino-minigame" data-testid="minigame-goleiro-reflexos">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-gol-zonas">
        {Array.from({ length: 6 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`treino-zona-gol ${ativo && i === alvo ? "alvo" : ""}`}
            onClick={() => clicar(i)}
            aria-label={`Região ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigameGoleiroPenalti({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [dica, setDica] = useState(1);
  const [scores, setScores] = useState<number[]>([]);

  useEffect(() => {
    if (idx >= tentativas) return;
    const t = window.setTimeout(() => {
      setDica(Math.floor(aleatorio() * 3));
    }, 200 / multiplicadorTempo);
    return () => clearTimeout(t);
  }, [idx, aleatorio, multiplicadorTempo]);

  const escolher = (i: number) => {
    if (idx >= tentativas) return;
    const s = i === dica ? 88 + Math.round(aleatorio() * 12) : 30 + Math.round(aleatorio() * 25);
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "goleiro-penaltis",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-goleiro-penaltis">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <p className="texto-suave" aria-live="polite">
        Indício: {["←", "↑", "→"][dica]}
      </p>
      <div className="treino-dirs">
        {(["Esquerda", "Centro", "Direita"] as const).map((r, i) => (
          <button key={r} type="button" className="botao secundario" onClick={() => escolher(i)} aria-label={r}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigameGoleiroPosicionamento({
  onConcluido,
  aleatorio = Math.random,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [atacante, setAtacante] = useState(50);
  const [gk, setGk] = useState(50);
  const [scores, setScores] = useState<number[]>([]);

  useEffect(() => {
    if (idx >= tentativas) return;
    setAtacante(15 + Math.round(aleatorio() * 70));
    setGk(50);
  }, [idx, aleatorio]);

  const confirmar = () => {
    if (idx >= tentativas) return;
    const d = Math.abs(gk - atacante);
    const s = d < 8 ? 95 : d < 16 ? 80 : d < 28 ? 60 : 35;
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "goleiro-posicionamento",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-goleiro-posicionamento">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-barra-forca">
        <div className="treino-marcador atacante" style={{ left: `${atacante}%` }} title="Atacante" />
        <div className="treino-cursor" style={{ left: `${gk}%` }} />
      </div>
      <div className="treino-dirs">
        <button type="button" className="botao secundario" onClick={() => setGk((v) => Math.max(0, v - 8))} aria-label="Esquerda">
          ←
        </button>
        <button type="button" className="botao principal" onClick={confirmar} data-testid="treino-acao">
          POSICIONAR
        </button>
        <button type="button" className="botao secundario" onClick={() => setGk((v) => Math.min(100, v + 8))} aria-label="Direita">
          →
        </button>
      </div>
    </div>
  );
}
