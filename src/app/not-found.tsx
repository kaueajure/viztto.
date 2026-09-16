import Link from "next/link";
export default function NaoEncontrado() {
  return (
    <main className="carregamento">
      <h1>FORA DE CAMPO.</h1>
      <p>Esta página não existe.</p>
      <Link href="/carreira" className="botao principal">
        Voltar à carreira
      </Link>
    </main>
  );
}
