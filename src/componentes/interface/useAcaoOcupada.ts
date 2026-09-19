"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Feedback imediato em ações síncronas pesadas (simular semana, matchday, etc.).
 * Duplo rAF garante que "…ando" pinte antes do trabalho bloquear a thread.
 */
export function useAcaoOcupada() {
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);

  const executar = useCallback(async (acao: () => void | Promise<void>) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    await new Promise<void>((resolver) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolver());
      });
    });
    try {
      await acao();
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, []);

  return { ocupado, executar };
}
