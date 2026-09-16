"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import type { Clube } from "@/dominio/entidades/modelos";
export function Escudo({
  clube,
  tamanho = 48,
}: {
  clube: Clube;
  tamanho?: number;
}) {
  const origem =
    clube.idExterno > 0 && clube.escudo
      ? `/api/futebol/escudos/${clube.idExterno}`
      : "";
  const [origemFalha, definirOrigemFalha] = useState<string | null>(null);
  return origem && origemFalha !== origem ? (
    <img
      src={origem}
      loading="lazy"
      decoding="async"
      alt={`Escudo do ${clube.nome}`}
      width={tamanho}
      height={tamanho}
      className="escudo"
      onError={() => definirOrigemFalha(origem)}
    />
  ) : (
    <span
      className="escudo-ficticio"
      style={{ width: tamanho, height: tamanho }}
      aria-label={`Escudo ${clube.nome}`}
    >
      <Shield size={tamanho} strokeWidth={1} />
      <b>{clube.codigo}</b>
    </span>
  );
}
