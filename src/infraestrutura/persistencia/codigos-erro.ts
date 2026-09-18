/** Códigos internos de persistência (API + cliente). Nunca incluir segredos. */
export const CODIGOS_ERRO_SAVE = {
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  SAVE_INVALID: "SAVE_INVALID",
  SAVE_TOO_LARGE: "SAVE_TOO_LARGE",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  CATALOG_INCOMPATIBLE: "CATALOG_INCOMPATIBLE",
  ORIGEM: "ORIGEM",
  JSON: "JSON",
  TAMANHO: "TAMANHO",
  INVALIDO: "INVALIDO",
  AUSENTE: "AUSENTE",
  CONFLITO: "CONFLITO",
  INCOMPATIVEL: "INCOMPATIVEL",
  INDISPONIVEL: "INDISPONIVEL",
} as const;

export type CodigoErroSave =
  (typeof CODIGOS_ERRO_SAVE)[keyof typeof CODIGOS_ERRO_SAVE];

const HTTP_NAO_RETENTAVEIS = new Set([400, 401, 403, 404, 409, 413, 415, 422]);
const HTTP_RETENTAVEIS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function erroHttpRetentavel(status: number): boolean {
  if (HTTP_NAO_RETENTAVEIS.has(status)) return false;
  if (status === 0) return true;
  return HTTP_RETENTAVEIS.has(status) || status >= 500;
}

export function mensagemAmigavelPersistencia(
  codigo: string | undefined,
  fallback: string,
): string {
  switch (codigo) {
    case CODIGOS_ERRO_SAVE.TIMEOUT:
    case CODIGOS_ERRO_SAVE.NETWORK_ERROR:
      return "Não conseguimos salvar agora. Tentaremos novamente automaticamente.";
    case CODIGOS_ERRO_SAVE.SAVE_TOO_LARGE:
    case CODIGOS_ERRO_SAVE.TAMANHO:
      return "O save ficou grande demais para o servidor. Suas alterações continuam nesta página.";
    case CODIGOS_ERRO_SAVE.REVISION_CONFLICT:
    case CODIGOS_ERRO_SAVE.CONFLITO:
      return "A carreira foi alterada em outra aba. Carregue o save do servidor antes de continuar.";
    case CODIGOS_ERRO_SAVE.CATALOG_INCOMPATIBLE:
    case CODIGOS_ERRO_SAVE.INCOMPATIVEL:
      return "Esta carreira não pode ser carregada nesta versão do jogo. O progresso no servidor foi preservado — você pode criar uma nova carreira ou excluir a antiga.";
    case CODIGOS_ERRO_SAVE.SAVE_INVALID:
    case CODIGOS_ERRO_SAVE.INVALIDO:
      return "Não foi possível validar o progresso para salvar. Suas alterações continuam nesta página.";
    case CODIGOS_ERRO_SAVE.DATABASE_UNAVAILABLE:
    case CODIGOS_ERRO_SAVE.INDISPONIVEL:
      return "Não conseguimos salvar agora. Tentaremos novamente automaticamente.";
    case CODIGOS_ERRO_SAVE.AUSENTE:
      return "Carreira não encontrada no servidor.";
    default:
      return fallback || "Algo deu errado. Tente novamente.";
  }
}

/** True quando o código indica save legado/incompatível (não é falha de gravação). */
export function ehErroCompatibilidadeSave(codigo: string | undefined): boolean {
  return (
    codigo === CODIGOS_ERRO_SAVE.CATALOG_INCOMPATIBLE ||
    codigo === CODIGOS_ERRO_SAVE.INCOMPATIVEL
  );
}
