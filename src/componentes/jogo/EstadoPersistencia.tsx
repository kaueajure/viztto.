"use client";
import { useJogoStore } from "@/estado/jogo-store";

export function EstadoPersistencia() {
  const {
    erroPersistencia,
    alteracoesPendentes,
    salvando,
    operando,
    conflito,
    statusPersistencia,
    falhasPersistencia,
    carregar,
    tentarSalvar,
  } = useJogoStore();

  const mostrarBanner =
    conflito ||
    statusPersistencia === "erro" ||
    (falhasPersistencia >= 3 && !!erroPersistencia);

  if (!mostrarBanner || !erroPersistencia) return null;

  return (
    <div className={`aviso ${conflito ? "erro" : "erro"}`} role="alert">
      <p>{erroPersistencia}</p>
      {!conflito && (
        <button
          className="botao-texto"
          disabled={salvando || operando}
          onClick={() => void tentarSalvar()}
        >
          Tentar novamente
        </button>
      )}
      <button
        className="botao-texto"
        disabled={salvando || operando}
        onClick={() => {
          if (
            !alteracoesPendentes ||
            window.confirm(
              "Descartar as alterações não salvas e carregar a última versão do servidor?",
            )
          )
            void carregar(true);
        }}
      >
        Carregar save do servidor
      </button>
    </div>
  );
}
