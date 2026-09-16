// @ts-check

/** Não inclui a URL nem a causa original em erros que podem ir para logs. */
export function obterDatabaseUrl() {
  const valor = process.env.DATABASE_URL?.trim();
  if (!valor) {
    throw new Error(
      "DATABASE_URL não definida. Configure-a no ambiente ou no .env da raiz para executar comandos do banco.",
    );
  }
  try {
    const url = new URL(valor);
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
  } catch {
    throw new Error(
      "DATABASE_URL inválida. Use uma URL PostgreSQL com host e nome do banco.",
    );
  }
  return valor;
}
