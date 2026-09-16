"use client";
export default function Erro({ reset }: { reset: () => void }) {
  return (
    <main className="carregamento">
      <span className="marca">viztto.</span>
      <h1>UMA PAUSA NO JOGO.</h1>
      <p>Não foi possível abrir esta tela. Tente novamente.</p>
      <button className="botao principal" onClick={reset}>
        Tentar novamente
      </button>
      <a href="/">Voltar ao menu</a>
    </main>
  );
}
