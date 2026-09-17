import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  SPORTMONKS_BASE_URL,
  SPORTMONKS_ENV_TOKEN,
} from "@/dominio/constantes/sportmonks-ligas";

export class ErroSportmonks extends Error {
  constructor(
    message: string,
    readonly codigo:
      | "auth"
      | "rate_limit"
      | "timeout"
      | "http"
      | "resposta_invalida"
      | "config",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ErroSportmonks";
  }
}

export function obterTokenSportmonks(): string {
  const token = process.env[SPORTMONKS_ENV_TOKEN]?.trim();
  if (!token)
    throw new ErroSportmonks(
      `Defina ${SPORTMONKS_ENV_TOKEN} para enriquecer a base com estatísticas Sportmonks.`,
      "config",
    );
  return token;
}

interface PaginaSportmonks<T> {
  data: T[];
  pagination?: {
    count?: number;
    per_page?: number;
    current_page?: number;
    next_page?: number | null;
    has_more?: boolean;
  };
  rate_limit?: { remaining?: number; resets_in_seconds?: number };
  message?: string;
}

export interface OpcoesClienteSportmonks {
  token?: string;
  baseUrl?: string;
  /** Máximo de requisições concorrentes. */
  concorrencia?: number;
  /** Espaçamento mínimo entre requests (ms). */
  intervaloMs?: number;
  timeoutMs?: number;
  cacheDir?: string;
  usarCache?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Cliente HTTP centralizado Sportmonks Football API v3.
 * Nunca usado em runtime do jogo — apenas no importador.
 */
export class ClienteSportmonks {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly concorrencia: number;
  private readonly intervaloMs: number;
  private readonly timeoutMs: number;
  private readonly cacheDir: string;
  private readonly usarCache: boolean;
  private readonly fetchImpl: typeof fetch;
  private fila: Promise<void> = Promise.resolve();
  private ativos = 0;
  private ultimoRequest = 0;
  requests = 0;

  constructor(opcoes: OpcoesClienteSportmonks = {}) {
    this.token = opcoes.token ?? obterTokenSportmonks();
    this.baseUrl = (opcoes.baseUrl ?? SPORTMONKS_BASE_URL).replace(/\/$/, "");
    this.concorrencia = opcoes.concorrencia ?? 2;
    this.intervaloMs = opcoes.intervaloMs ?? 350;
    this.timeoutMs = opcoes.timeoutMs ?? 30_000;
    this.cacheDir = opcoes.cacheDir ?? join(process.cwd(), ".cache", "sportmonks");
    this.usarCache = opcoes.usarCache ?? true;
    this.fetchImpl = opcoes.fetchImpl ?? fetch;
  }

  async getJson<T>(
    caminho: string,
    params: Record<string, string | number | undefined> = {},
    opcoes: { cacheKey?: string; cacheTtlMs?: number } = {},
  ): Promise<T> {
    const cacheKey = opcoes.cacheKey;
    if (this.usarCache && cacheKey) {
      const cached = await this.lerCache<T>(cacheKey, opcoes.cacheTtlMs ?? 86_400_000);
      if (cached !== undefined) return cached;
    }
    const url = new URL(`${this.baseUrl}${caminho.startsWith("/") ? "" : "/"}${caminho}`);
    url.searchParams.set("api_token", this.token);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const data = await this.comFila(() => this.fetchComRetry<T>(url));
    if (this.usarCache && cacheKey) await this.gravarCache(cacheKey, data);
    return data;
  }

  async getTodasPaginas<T>(
    caminho: string,
    params: Record<string, string | number | undefined> = {},
    opcoes: { cacheKeyPrefix?: string; perPage?: number } = {},
  ): Promise<T[]> {
    const itens: T[] = [];
    let page = 1;
    const perPage = opcoes.perPage ?? 50;
    for (;;) {
      const cacheKey = opcoes.cacheKeyPrefix
        ? `${opcoes.cacheKeyPrefix}-p${page}`
        : undefined;
      const resp = await this.getJson<PaginaSportmonks<T>>(
        caminho,
        { ...params, page, per_page: perPage },
        { cacheKey },
      );
      if (!Array.isArray(resp.data))
        throw new ErroSportmonks("Resposta Sportmonks sem data[]", "resposta_invalida");
      itens.push(...resp.data);
      const hasMore =
        resp.pagination?.has_more === true ||
        (resp.pagination?.next_page != null &&
          resp.pagination.next_page > page);
      if (!hasMore || resp.data.length === 0) break;
      page = resp.pagination?.next_page ?? page + 1;
      if (page > 200) break;
    }
    return itens;
  }

  private async comFila<T>(fn: () => Promise<T>): Promise<T> {
    while (this.ativos >= this.concorrencia) {
      await this.fila;
    }
    this.ativos++;
    const espera = Math.max(0, this.intervaloMs - (Date.now() - this.ultimoRequest));
    const trabalho = (async () => {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      this.ultimoRequest = Date.now();
      return fn();
    })();
    this.fila = trabalho.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await trabalho;
    } finally {
      this.ativos--;
    }
  }

  private async fetchComRetry<T>(url: URL, tentativa = 0): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      this.requests++;
      const res = await this.fetchImpl(url.toString(), { signal: controller.signal });
      if (res.status === 401 || res.status === 403)
        throw new ErroSportmonks(
          "Autenticação Sportmonks rejeitada. Verifique SPORTMONKS_API_TOKEN.",
          "auth",
          res.status,
        );
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 2 ** tentativa);
        if (tentativa >= 5)
          throw new ErroSportmonks("Rate limit Sportmonks esgotado.", "rate_limit", 429);
        await new Promise((r) => setTimeout(r, Math.max(1000, retryAfter * 1000)));
        return this.fetchComRetry(url, tentativa + 1);
      }
      if (!res.ok) {
        if (tentativa < 3 && res.status >= 500) {
          await new Promise((r) => setTimeout(r, 2 ** tentativa * 500));
          return this.fetchComRetry(url, tentativa + 1);
        }
        throw new ErroSportmonks(
          `Sportmonks HTTP ${res.status}`,
          "http",
          res.status,
        );
      }
      return (await res.json()) as T;
    } catch (erro) {
      if (erro instanceof ErroSportmonks) throw erro;
      if ((erro as Error)?.name === "AbortError")
        throw new ErroSportmonks("Timeout Sportmonks.", "timeout");
      if (tentativa < 3) {
        await new Promise((r) => setTimeout(r, 2 ** tentativa * 400));
        return this.fetchComRetry(url, tentativa + 1);
      }
      throw new ErroSportmonks(
        erro instanceof Error ? erro.message : "Falha de rede Sportmonks",
        "http",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async lerCache<T>(chave: string, ttlMs: number): Promise<T | undefined> {
    try {
      const caminho = join(this.cacheDir, `${sanitize(chave)}.json`);
      const bruto = JSON.parse(await readFile(caminho, "utf8")) as {
        em: number;
        data: T;
      };
      if (Date.now() - bruto.em > ttlMs) return undefined;
      return bruto.data;
    } catch {
      return undefined;
    }
  }

  private async gravarCache(chave: string, data: unknown): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(
        join(this.cacheDir, `${sanitize(chave)}.json`),
        JSON.stringify({ em: Date.now(), data }),
      );
    } catch {
      /* cache best-effort */
    }
  }
}

function sanitize(chave: string) {
  return chave.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}

/** Remove token de qualquer string de log/relatório. */
export function redigirSegredos(texto: string, token?: string): string {
  let s = texto;
  if (token) s = s.split(token).join("[REDACTED]");
  s = s.replace(/api_token=[^&\s"]+/gi, "api_token=[REDACTED]");
  return s;
}
