import type { Metadata } from "next";
import "./globals.css";
import { Hidratacao } from "@/componentes/jogo/Hidratacao";
export const metadata: Metadata = {
  title: "viztto — Sua carreira. Sua história.",
  description: "Simulador de carreira de jogador de futebol.",
};
export default function LayoutRaiz({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Hidratacao />
        {children}
      </body>
    </html>
  );
}
