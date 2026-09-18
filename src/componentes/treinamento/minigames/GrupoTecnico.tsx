"use client";

import { useEffect, useRef, useState } from "react";
import { mediaScores, type PropsMinigame } from "./tipos";

const DIRS = ["←", "↑", "→", "↓"] as const;
const TECLAS: Record<string, number> = {
  ArrowLeft: 0,
  a: 0,
  A: 0,
  ArrowUp: 1,
  w: 1,
  W: 1,
  ArrowRight: 2,
  d: 2,
  D: 2,
  ArrowDown: 3,
  s: 3,
  S: 3,
};

export function MinigameDrible({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [seq, setSeq] = useState<number[]>([]);
  const [entrada, setEntrada] = useState<number[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [restanteMs, setRestanteMs] = useState(0);
  const resolvido = useRef(false);
  const entradaRef = useRef<number[]>([]);
  const seqRef = useRef<number[]>([]);

  useEffect(() => {
    entradaRef.current = entrada;
  }, [entrada]);

  useEffect(() => {
    if (idx >= tentativas) return;
    resolvido.current = false;
    const len = 2 + Math.min(3, idx);
    const s = Array.from({ length: len }, () => Math.floor(aleatorio() * 4));
    seqRef.current = s;
    setSeq(s);
    setEntrada([]);
    const limite = (3500 + len * 700) / multiplicadorTempo;
    setRestanteMs(limite);
    const inicio = performance.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, limite - (performance.now() - inicio));
      setRestanteMs(left);
    }, 100);
    const timer = window.setTimeout(() => {
      if (resolvido.current) return;
      resolvido.current = true;
      const parciais = entradaRef.current;
      const alvo = seqRef.current;
      const okParcial =
        parciais.length > 0 &&
        parciais.every((v, i) => v === alvo[i]);
      const sScore = okParcial
        ? 35 + Math.round((parciais.length / alvo.length) * 25)
        : 20;
      setScores((prev) => {
        const novos = [...prev, sScore];
        const prox = idx + 1;
        queueMicrotask(() => {
          setIdx(prox);
          if (prox >= tentativas) {
            onConcluido({
              exercicioId: "drible",
              score: mediaScores(novos),
              tentativas,
            });
          }
        });
        return novos;
      });
    }, limite);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [idx, aleatorio, multiplicadorTempo, onConcluido, tentativas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = TECLAS[e.key];
      if (d === undefined) return;
      e.preventDefault();
      registrar(d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const registrar = (d: number) => {
    if (idx >= tentativas || !seq.length || resolvido.current) return;
    const nova = [...entrada, d];
    setEntrada(nova);
    if (nova.length < seq.length) return;
    resolvido.current = true;
    const ok = nova.every((v, i) => v === seq[i]);
    const s = ok ? 85 + Math.round(aleatorio() * 15) : 30 + Math.round(aleatorio() * 25);
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "drible",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-drible">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <p className="texto-suave" data-testid="drible-tempo">
        Tempo: {(restanteMs / 1000).toFixed(1)}s
      </p>
      <p className="treino-seq" aria-live="polite">
        {seq.map((d) => DIRS[d]).join(" ")}
      </p>
      <div className="treino-dirs">
        {DIRS.map((rotulo, i) => (
          <button
            key={rotulo}
            type="button"
            className="botao secundario"
            onClick={() => registrar(i)}
            aria-label={rotulo}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MinigameDominio({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const duracao = 4000 / multiplicadorTempo;
  const [cursor, setCursor] = useState(50);
  const [zona, setZona] = useState(40);
  const [dentroMs, setDentroMs] = useState(0);
  const [feito, setFeito] = useState(false);
  const zonaRef = useRef(40);
  const cursorRef = useRef(50);
  const dentroRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const inicio = last;
    let dir = aleatorio() > 0.5 ? 1 : -1;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      zonaRef.current += dir * (18 + aleatorio() * 10) * (dt / 1000) * multiplicadorTempo;
      if (zonaRef.current > 75) {
        zonaRef.current = 75;
        dir = -1;
      }
      if (zonaRef.current < 10) {
        zonaRef.current = 10;
        dir = 1;
      }
      setZona(zonaRef.current);
      const half = 12;
      const ok =
        cursorRef.current >= zonaRef.current - half &&
        cursorRef.current <= zonaRef.current + half;
      if (ok) dentroRef.current += dt;
      setDentroMs(dentroRef.current);
      if (t - inicio < duracao) raf = requestAnimationFrame(tick);
      else if (!feito) {
        setFeito(true);
        const ratio = Math.min(1, dentroRef.current / (duracao * 0.75));
        onConcluido({
          exercicioId: "dominio",
          score: Math.round(ratio * 100),
          tentativas: 1,
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aleatorio, multiplicadorTempo, duracao, feito, onConcluido]);

  const mover = (delta: number) => {
    cursorRef.current = Math.max(0, Math.min(100, cursorRef.current + delta));
    setCursor(cursorRef.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") mover(-4);
      if (e.key === "ArrowRight" || e.key === "d") mover(4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="treino-minigame" data-testid="minigame-dominio">
      <div className="treino-barra-forca treino-dominio">
        <div
          className="treino-zona-movel"
          style={{ left: `${zona}%`, width: "24%" }}
        />
        <div className="treino-cursor" style={{ left: `${cursor}%` }} />
      </div>
      <div className="treino-dirs">
        <button type="button" className="botao secundario" onClick={() => mover(-6)} aria-label="Esquerda">
          ←
        </button>
        <button type="button" className="botao secundario" onClick={() => mover(6)} aria-label="Direita">
          →
        </button>
      </div>
      <p className="texto-suave">Tempo na zona: {Math.round(dentroMs)} ms</p>
    </div>
  );
}

export function MinigameArrancada({
  onConcluido,
  aleatorio = Math.random,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const tentativas = 5;
  const [idx, setIdx] = useState(0);
  const [fase, setFase] = useState<"aguarde" | "vai" | "cedo">("aguarde");
  const [scores, setScores] = useState<number[]>([]);
  const inicioRef = useRef(0);

  useEffect(() => {
    if (idx >= tentativas) return;
    setFase("aguarde");
    const delay = (600 + aleatorio() * 1400) / multiplicadorTempo;
    const t = window.setTimeout(() => {
      setFase("vai");
      inicioRef.current = performance.now();
    }, delay);
    return () => clearTimeout(t);
  }, [idx, aleatorio, multiplicadorTempo]);

  const reagir = () => {
    if (idx >= tentativas) return;
    let s = 20;
    if (fase === "aguarde") {
      setFase("cedo");
      s = 15;
    } else if (fase === "vai") {
      const ms = performance.now() - inicioRef.current;
      s = ms < 180 ? 100 : ms < 280 ? 88 : ms < 400 ? 72 : ms < 550 ? 55 : 35;
    }
    const novos = [...scores, s];
    setScores(novos);
    const prox = idx + 1;
    setIdx(prox);
    if (prox >= tentativas) {
      onConcluido({
        exercicioId: "arrancada",
        score: mediaScores(novos),
        tentativas,
      });
    }
  };

  return (
    <div className="treino-minigame" data-testid="minigame-arrancada">
      <p className="treino-tentativa">
        Tentativa {Math.min(idx + 1, tentativas)} / {tentativas}
      </p>
      <p className="treino-sinal" data-testid="treino-sinal">
        {fase === "aguarde" || fase === "cedo" ? "AGUARDE..." : "VAI!"}
      </p>
      <button type="button" className="botao principal treino-acao" onClick={reagir} data-testid="treino-acao">
        SPRINT
      </button>
    </div>
  );
}

export function MinigameResistencia({
  onConcluido,
  multiplicadorTempo = 1,
}: PropsMinigame) {
  const duracao = 10000 / multiplicadorTempo;
  const [valor, setValor] = useState(50);
  const [bomMs, setBomMs] = useState(0);
  const valorRef = useRef(50);
  const bomRef = useRef(0);
  const feito = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const inicio = last;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      valorRef.current = Math.max(0, valorRef.current - 12 * (dt / 1000) * multiplicadorTempo);
      setValor(valorRef.current);
      if (valorRef.current >= 40 && valorRef.current <= 70) bomRef.current += dt;
      setBomMs(bomRef.current);
      if (t - inicio < duracao) raf = requestAnimationFrame(tick);
      else if (!feito.current) {
        feito.current = true;
        onConcluido({
          exercicioId: "resistencia",
          score: Math.round(Math.min(1, bomRef.current / (duracao * 0.7)) * 100),
          tentativas: 1,
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [multiplicadorTempo, duracao, onConcluido]);

  const impulsionar = () => {
    valorRef.current = Math.min(100, valorRef.current + 8);
    setValor(valorRef.current);
  };

  return (
    <div className="treino-minigame" data-testid="minigame-resistencia">
      <div className="treino-barra-forca">
        <div className="treino-zona-ideal" style={{ left: "40%", width: "30%" }} />
        <div className="treino-cursor" style={{ left: `${valor}%` }} />
      </div>
      <button type="button" className="botao principal treino-acao" onClick={impulsionar} data-testid="treino-acao">
        MANTER
      </button>
      <p className="texto-suave">{Math.round(bomMs / 1000)}s na zona</p>
    </div>
  );
}
