"use client";
import { useEffect, useRef } from "react";
export function useFocoModal(aberta: boolean, fechar: () => void): void {
  const fecharAtual = useRef(fechar);
  useEffect(() => {
    fecharAtual.current = fechar;
  }, [fechar]);
  useEffect(() => {
    if (!aberta) return;
    const janela = document.querySelector<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    if (!janela) return;
    const anterior =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const transbordamento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buscarFocos = () =>
      Array.from(
        janela.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      );
    if (!janela.contains(document.activeElement)) buscarFocos()[0]?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        fecharAtual.current();
      }
      if (evento.key !== "Tab") return;
      const elementos = buscarFocos(),
        primeiro = elementos[0],
        ultimo = elementos.at(-1);
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo?.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro?.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = transbordamento;
      anterior?.focus();
    };
  }, [aberta]);
}
