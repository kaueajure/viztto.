"use client";
import { useEffect } from "react";
import { useJogoStore } from "@/estado/jogo-store";
export function Hidratacao() {
  useEffect(() => {
    void useJogoStore.getState().carregar();
    const antesDeSair = (evento: BeforeUnloadEvent) => {
      const estado = useJogoStore.getState();
      if (estado.alteracoesPendentes || estado.salvando || estado.operando) {
        evento.preventDefault();
        evento.returnValue = "";
      }
    };
    const reconectar = () => {
      void useJogoStore.getState().tentarSalvar();
    };
    window.addEventListener("beforeunload", antesDeSair);
    window.addEventListener("online", reconectar);
    return () => {
      window.removeEventListener("beforeunload", antesDeSair);
      window.removeEventListener("online", reconectar);
    };
  }, []);
  return null;
}
