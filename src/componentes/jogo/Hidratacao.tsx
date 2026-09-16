"use client";
import { useEffect } from "react";
import { useJogoStore } from "@/estado/jogo-store";
export function Hidratacao() {
  useEffect(() => {
    void useJogoStore.persist.rehydrate();
  }, []);
  return null;
}
