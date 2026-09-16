import "server-only";

export class ErroTransfermarkt extends Error {
  constructor(
    public readonly codigo:
      | "configuracao"
      | "rede"
      | "limite"
      | "resposta"
      | "parametros"
      | "nao_encontrado",
    mensagem: string,
    public readonly tentarEmSegundos?: number,
  ) {
    super(mensagem);
  }
}

interface EntradaCache {
  dados: unknown;
  validade: number;
}

export class ClienteTransfermarkt {
  private cache = new Map<string, EntradaCache>();
  private pendentes = new Map<string, Promise<unknown>>();
  private fila: Promise<unknown> = Promise.resolve();
  private proximaConsulta = 0;
  private bloqueadoAte = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly esperar: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly agora: () => number = Date.now,
    private readonly intervaloMs = 1500,
  ) {
    if (!baseUrl.trim())
      throw new ErroTransfermarkt(
        "configuracao",
        "Configure TRANSFERMARKT_API_URL no servidor.",
      );
  }

  consultar(caminho: string): Promise<unknown> {
    if (!caminho.startsWith("/"))
      return Promise.reject(
        new ErroTransfermarkt("parametros", "Caminho inválido."),
      );
    const chave = caminho;
    const armazenado = this.cache.get(chave);
    if (armazenado && armazenado.validade > this.agora())
      return Promise.resolve(structuredClone(armazenado.dados));
    const pendente = this.pendentes.get(chave);
    if (pendente) return pendente.then((dados) => structuredClone(dados));

    const operacao = this.fila
      .catch(() => undefined)
      .then(() => this.executar(caminho));
    this.fila = operacao;
    this.pendentes.set(chave, operacao);
    return operacao
      .then((dados) => {
        if (this.cache.size >= 200)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(chave, {
          dados,
          validade: this.agora() + 6 * 3600000,
        });
        return structuredClone(dados);
      })
      .finally(() => this.pendentes.delete(chave));
  }

  private async executar(caminho: string): Promise<unknown> {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const bloqueio = this.bloqueadoAte - this.agora();
      if (bloqueio > 0) {
        await this.esperar(bloqueio);
      }
      const espera = this.proximaConsulta - this.agora();
      if (espera > 0) await this.esperar(espera);

      let resposta: Response;
      try {
        resposta = await fetch(`${this.baseUrl.replace(/\/$/, "")}${caminho}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
      } catch {
        if (tentativa < 3) {
          await this.esperar(1000 * 2 ** tentativa);
          continue;
        }
        throw new ErroTransfermarkt(
          "rede",
          "Sem conexão com a Transfermarkt API.",
        );
      }

      this.proximaConsulta = this.agora() + this.intervaloMs;

      if (resposta.status === 404)
        throw new ErroTransfermarkt(
          "nao_encontrado",
          "Recurso não encontrado na Transfermarkt API.",
        );
      if (resposta.status === 429) {
        const retry = Number(resposta.headers.get("retry-after") ?? "10");
        const ms = Math.max(3000, (Number.isFinite(retry) ? retry : 10) * 1000);
        if (tentativa < 3) {
          await this.esperar(ms);
          continue;
        }
        this.bloqueadoAte = this.agora() + ms;
        throw new ErroTransfermarkt(
          "limite",
          "Rate limit da Transfermarkt API. Aguarde e retome a importação.",
          Math.ceil(ms / 1000),
        );
      }
      if (resposta.status >= 500) {
        if (tentativa < 3) {
          await this.esperar(1500 * 2 ** tentativa);
          continue;
        }
        throw new ErroTransfermarkt(
          "rede",
          "A Transfermarkt API respondeu com erro interno (5xx). Confirme que a API local está no ar (`npm run api` → http://localhost:8000) e que TRANSFERMARKT_API_URL aponta para ela.",
        );
      }
      if (!resposta.ok)
        throw new ErroTransfermarkt(
          "parametros",
          `A Transfermarkt API recusou a consulta (${resposta.status}).`,
        );

      try {
        return await resposta.json();
      } catch {
        throw new ErroTransfermarkt(
          "resposta",
          "A Transfermarkt API retornou uma resposta inválida.",
        );
      }
    }
    throw new ErroTransfermarkt(
      "rede",
      "Não foi possível consultar a Transfermarkt API.",
    );
  }
}

export function obterUrlTransfermarkt(): string {
  return process.env.TRANSFERMARKT_API_URL?.trim() ?? "";
}
