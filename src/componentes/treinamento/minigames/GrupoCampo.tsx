"use client";

import { useEffect, useRef, useState } from "react";
import { mediaScores, scorePorDistancia, type PropsMinigame } from "./tipos";

export function MinigameCabecalho({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [direcaoAlvo, setDirecaoAlvo] = useState(1);
  const posRef = useRef(0);
  const janela = 0.45;

  useEffect(() => {
    if (idx >= tentativas) return;
    setDirecaoAlvo(Math.floor(aleatorio() * 3));
    posRef.current = 0;
    setPos(0);
    let raf = 0;
    let last = performance.now();
    const vel = (0.4 + aleatorio() * 0.35) * multiplicadorTempo;
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      posRef.current = Math.min(1, posRef.current + vel * dt);
      setPos(posRef.current);
      if (posRef.current < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, aleatorio, multiplicadorTempo]);

  const escolher = (dir: number) => {
    if (idx >= tentativas) return;
    const timing = scorePorDistancia(posRef.current, janela, 0.1, 0.25);
    const direcaoOk = dir === direcaoAlvo ? 1 : 0.55;
    const s = Math.round(timing * direcaoOk);
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "cabecalho",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-cabecalho">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-pista">
        <div className="treino-marcador" style={{ left: `${pos * 100}%` }} />
        <div className="treino-janela" style={{ left: `${janela * 100}%` }} />
      </div>
      <p className="texto-suave">Direção sugerida pelo cruzamento: {["←", "↑", "→"][direcaoAlvo]}</p>
      <div className="treino-dirs">
        {(["Esquerda", "Centro", "Direita"] as const).map((rotulo, i) => (
          <button
            key={rotulo}
            type="button"
            className="botao"
            onClick={() => escolher(i)}
            aria-label={rotulo}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigamePasseRapido({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 6;
  const [idx, setIdx] = useState(0);
  const [livre, setLivre] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [ativo, setAtivo] = useState(false);
  const resolvido = useRef(false);

  useEffect(() => {
    if (idx >= tentativas) return;
    resolvido.current = false;
    setAtivo(false);
    let inner = 0;
    const outer = window.setTimeout(() => {
      setLivre(Math.floor(aleatorio() * 3));
      setAtivo(true);
      // Janela de passe — se não passar a tempo, erra a tentativa.
      inner = window.setTimeout(() => {
        if (resolvido.current) return;
        resolvido.current = true;
        setAtivo(false);
        setScores((prev) => {
          const novos = [...prev, 20 + Math.round(aleatorio() * 10)];
          const prox = idx + 1;
          queueMicrotask(() => {
            setIdx(prox);
            if (prox >= tentativas) {
              onConcluido({
                exercicioId: "passe-rapido",
                score: mediaScores(novos),
                tentativas,
              });
            }
          });
          return novos;
        });
      }, 1100 / multiplicadorTempo);
    }, (300 + aleatorio() * 500) / multiplicadorTempo);
    return () => {
      clearTimeout(outer);
      if (inner) clearTimeout(inner);
    };
  }, [idx, aleatorio, multiplicadorTempo, onConcluido, tentativas]);

  const clicar = (i: number) => {
    if (!ativo || idx >= tentativas || resolvido.current) return;
    resolvido.current = true;
    const s = i === livre ? 90 + Math.round(aleatorio() * 10) : 25 + Math.round(aleatorio() * 20);
    const novos = [...scores, s];
    setScores(novos);
    setAtivo(false);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "passe-rapido",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-passe-rapido">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-companheiros">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            className={`treino-companheiro ${ativo && i === livre ? "livre" : "marcado"}`}
            onClick={() => clicar(i)}
            aria-label={`Companheiro ${i + 1}`}
            data-testid={`companheiro-${i}`}
          >
            {ativo && i === livre ? "LIVRE" : "MARCADO"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigamePasseProfundidade({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const ideal = 0.55;

  useEffect(() => {
    if (idx >= tentativas) return;
    posRef.current = 0;
    setPos(0);
    let raf = 0;
    let last = performance.now();
    const vel = (0.35 + aleatorio() * 0.4) * multiplicadorTempo;
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      posRef.current = Math.min(1, posRef.current + vel * dt);
      setPos(posRef.current);
      if (posRef.current < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, aleatorio, multiplicadorTempo]);

  const passar = () => {
    if (idx >= tentativas) return;
    const s = scorePorDistancia(posRef.current, ideal, 0.08, 0.2);
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "passe-profundidade",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-passe-profundidade">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-pista">
        <div className="treino-linha-defesa" style={{ left: "70%" }} />
        <div className="treino-marcador" style={{ left: `${pos * 100}%` }} />
        <div className="treino-janela" style={{ left: `${ideal * 100}%` }} />
      </div>
      <button type="button" className="botao primario treino-acao" onClick={passar} data-testid="treino-acao">
        PASSAR
      </button>
    </div>
  );
}

export function MinigameCruzamento({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [forca, setForca] = useState(0);
  const [alvo, setAlvo] = useState(0.5);
  const forcaRef = useRef(0);
  const dir = useRef(1);

  useEffect(() => {
    if (idx >= tentativas) return;
    setAlvo(0.35 + aleatorio() * 0.35);
    forcaRef.current = 0.1;
    setForca(0.1);
    dir.current = 1;
    let raf = 0;
    let last = performance.now();
    const vel = 0.7 * multiplicadorTempo;
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      let f = forcaRef.current + dir.current * vel * dt;
      if (f >= 1) {
        f = 1;
        dir.current = -1;
      } else if (f <= 0) {
        f = 0;
        dir.current = 1;
      }
      forcaRef.current = f;
      setForca(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, aleatorio, multiplicadorTempo]);

  const soltar = () => {
    if (idx >= tentativas) return;
    const s = scorePorDistancia(forcaRef.current, alvo, 0.07, 0.18);
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "cruzamento",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-cruzamento">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <div className="treino-barra-forca">
        <div className="treino-alvo-forca" style={{ left: `${alvo * 100}%` }} />
        <div className="treino-cursor" style={{ left: `${forca * 100}%` }} />
      </div>
      <button type="button" className="botao primario treino-acao" onClick={soltar} data-testid="treino-acao">
        CRUZAR
      </button>
    </div>
  );
}
