"use client";
import { useEffect, useRef } from "react";

/**
 * Trava o foco no diálogo ativo.
 * `chave` identifica o modal: ao trocar (central → decisões), o trap
 * reanexa ao diálogo novo sem devolver o foco ao acionador ainda.
 */
export function useFocoModal(
  aberta: boolean,
  fechar: () => void,
  chave = "modal",
): void {
  const fecharAtual = useRef(fechar);
  const acionador = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fecharAtual.current = fechar;
  }, [fechar]);

  // Body lock + restore só quando a cadeia de modais fecha por completo.
  useEffect(() => {
    if (!aberta) {
      const el = acionador.current;
      acionador.current = null;
      document.body.style.overflow = "";
      el?.focus();
      return;
    }
    if (
      !acionador.current &&
      document.activeElement instanceof HTMLElement
    ) {
      acionador.current = document.activeElement;
    }
    const anteriorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anteriorOverflow;
    };
  }, [aberta]);

  // Trap de teclado amarrado ao diálogo mais recente (chave).
  useEffect(() => {
    if (!aberta) return;

    let janela: HTMLElement | null = null;
    let limparTeclado: (() => void) | undefined;

    const anexar = () => {
      const dialogos = document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"], [role="alertdialog"]',
      );
      janela = dialogos[dialogos.length - 1] ?? null;
      if (!janela) return;

      const buscarFocos = () =>
        Array.from(
          janela!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        );

      if (!janela.contains(document.activeElement)) buscarFocos()[0]?.focus();

      const aoTeclar = (evento: KeyboardEvent) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          fecharAtual.current();
          return;
        }
        if (evento.key !== "Tab") return;
        const elementos = buscarFocos();
        const primeiro = elementos[0];
        const ultimo = elementos.at(-1);
        if (!primeiro || !ultimo) return;
        if (evento.shiftKey && document.activeElement === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      };
      document.addEventListener("keydown", aoTeclar);
      limparTeclado = () => document.removeEventListener("keydown", aoTeclar);
    };

    const frame = requestAnimationFrame(anexar);
    return () => {
      cancelAnimationFrame(frame);
      limparTeclado?.();
    };
  }, [aberta, chave]);
}
