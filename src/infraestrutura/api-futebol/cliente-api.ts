import "server-only";
import { esquemaRespostaApi } from "./esquemas";
import { TemporadaForaDoPlano } from "./provedor-dados-futebol";
export class ErroApiFutebol extends Error {
  constructor(
    public readonly codigo:
      "autenticacao" | "limite" | "rede" | "resposta" | "parametros",
    mensagem: string,
    public readonly tentarEmSegundos?: number,
  ) {
    super(mensagem);
  }
}
export interface CotaApi {
  diaria: number | null;
  restanteDia: number | null;
  porMinuto: number | null;
  restanteMinuto: number | null;
}
interface EntradaCache {
  dados: unknown[];
  validade: number;
}
export class ClienteApiFutebol {
  private restricoes = new Map<
    string,
    { erro: TemporadaForaDoPlano; validade: number }
  >();
  private cache = new Map<string, EntradaCache>();
  private pendentes = new Map<string, Promise<unknown[]>>();
  private fila: Promise<unknown> = Promise.resolve();
  private proximaConsulta = 0;
  private bloqueadoAte = 0;
  private cota: CotaApi = {
    diaria: null,
    restanteDia: null,
    porMinuto: null,
    restanteMinuto: null,
  };
  constructor(
    private readonly chave: string,
    private readonly esperar: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly agora: () => number = Date.now,
  ) {}
  obterCota(): CotaApi {
    return { ...this.cota };
  }
  consultar(caminho: string): Promise<unknown[]> {
    if (!/^(leagues|teams)\?/.test(caminho))
      return Promise.reject(
        new ErroApiFutebol("parametros", "Consulta não permitida."),
      );
    const restricao = this.restricoes.get(caminho);
    if (restricao && restricao.validade > this.agora())
      return Promise.reject(restricao.erro);
    const armazenado = this.cache.get(caminho);
    if (armazenado && armazenado.validade > this.agora())
      return Promise.resolve(structuredClone(armazenado.dados));
    const pendente = this.pendentes.get(caminho);
    if (pendente) return pendente.then((dados) => structuredClone(dados));
    if (this.pendentes.size >= 12)
      return Promise.reject(
        new ErroApiFutebol(
          "limite",
          "Muitas importações em andamento. Aguarde.",
          60,
        ),
      );
    const operacao = this.fila
      .catch(() => undefined)
      .then(() => this.executar(caminho));
    this.fila = operacao;
    this.pendentes.set(caminho, operacao);
    return operacao
      .then((dados) => {
        if (this.cache.size >= 100)
          this.cache.delete(this.cache.keys().next().value!);
        if (dados.length)
          this.cache.set(caminho, { dados, validade: this.agora() + 86400000 });
        return structuredClone(dados);
      })
      .catch((erro) => {
        if (erro instanceof TemporadaForaDoPlano) {
          if (this.restricoes.size >= 100) this.restricoes.clear();
          this.restricoes.set(caminho, {
            erro,
            validade: this.agora() + 3600000,
          });
        }
        throw erro;
      })
      .finally(() => this.pendentes.delete(caminho));
  }
  private atualizarCota(headers: Headers): void {
    const ler = (nome: string) => {
      const valor = headers.get(nome);
      return valor !== null && /^\d+$/.test(valor) ? Number(valor) : null;
    };
    this.cota = {
      diaria: ler("x-ratelimit-requests-limit"),
      restanteDia: ler("x-ratelimit-requests-remaining"),
      porMinuto: ler("x-ratelimit-limit"),
      restanteMinuto: ler("x-ratelimit-remaining"),
    };
    this.proximaConsulta =
      this.agora() +
      Math.ceil(60000 / Math.max(1, this.cota.porMinuto ?? 10)) +
      100;
    if (this.cota.restanteMinuto === 0)
      this.bloqueadoAte = Math.max(this.bloqueadoAte, this.agora() + 60000);
    if (this.cota.restanteDia === 0) {
      const data = new Date(this.agora());
      data.setUTCHours(24, 0, 0, 0);
      this.bloqueadoAte = data.getTime();
    }
  }
  private async executar(caminho: string): Promise<unknown[]> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const bloqueio = this.bloqueadoAte - this.agora();
      if (bloqueio > 0)
        throw new ErroApiFutebol(
          "limite",
          "Limite da API atingido. Aguarde antes de atualizar os clubes.",
          Math.ceil(bloqueio / 1000),
        );
      const espera = this.proximaConsulta - this.agora();
      if (espera > 0) await this.esperar(espera);
      let resposta: Response;
      try {
        resposta = await fetch(`https://v3.football.api-sports.io/${caminho}`, {
          headers: { "x-apisports-key": this.chave },
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch {
        if (tentativa < 1) {
          await this.esperar(1000);
          continue;
        }
        throw new ErroApiFutebol(
          "rede",
          "Sem conexão com a API de futebol. Tente novamente mais tarde.",
        );
      }
      this.atualizarCota(resposta.headers);
      if (resposta.status === 401 || resposta.status === 403)
        throw new ErroApiFutebol(
          "autenticacao",
          "A API recusou a credencial ou o acesso. Verifique a configuração no servidor.",
        );
      if (resposta.status === 429) {
        const valor = resposta.headers.get("retry-after");
        const segundos = valor
          ? /^\d+(\.\d+)?$/.test(valor)
            ? Number(valor)
            : Math.max(0, (Date.parse(valor) - this.agora()) / 1000)
          : 2 ** tentativa;
        const espera = Math.max(
          2 ** tentativa,
          Number.isFinite(segundos) ? segundos : 60,
        );
        if (tentativa < 2 && espera <= 8 && this.bloqueadoAte <= this.agora()) {
          await this.esperar(espera * 1000);
          continue;
        }
        this.bloqueadoAte = Math.max(
          this.bloqueadoAte,
          this.agora() + Math.max(60, espera) * 1000,
        );
        throw new ErroApiFutebol(
          "limite",
          "Muitas consultas à API. Aguarde para tentar novamente.",
          Math.ceil((this.bloqueadoAte - this.agora()) / 1000),
        );
      }
      if (resposta.status === 499 || resposta.status >= 500) {
        if (tentativa < 1) {
          await this.esperar(1000);
          continue;
        }
        throw new ErroApiFutebol(
          "rede",
          "A API está temporariamente indisponível.",
        );
      }
      if (!resposta.ok)
        throw new ErroApiFutebol(
          "parametros",
          "A API recusou os parâmetros da consulta.",
        );
      let bruto: unknown;
      try {
        bruto = await resposta.json();
      } catch {
        throw new ErroApiFutebol(
          "resposta",
          "A API retornou uma resposta inválida.",
        );
      }
      const validacao = esquemaRespostaApi.safeParse(bruto);
      if (!validacao.success)
        throw new ErroApiFutebol(
          "resposta",
          "A resposta da API está incompleta.",
        );
      const dados = validacao.data;
      if (!Array.isArray(dados.errors)) {
        if (typeof dados.errors.plan === "string") {
          const intervalo = dados.errors.plan.match(/from (\d{4}) to (\d{4})/i);
          if (intervalo) throw new TemporadaForaDoPlano(Number(intervalo[2]));
        }
        if (dados.errors.requests || dados.errors.rateLimit) {
          this.bloqueadoAte = Math.max(this.bloqueadoAte, this.agora() + 60000);
          throw new ErroApiFutebol(
            "limite",
            "A API recusou a consulta por limite de requisições.",
            60,
          );
        }
        if (dados.errors.token || dados.errors.access)
          throw new ErroApiFutebol(
            "autenticacao",
            "A API recusou a credencial ou o acesso.",
          );
      }
      if (Object.keys(dados.errors).length)
        throw new ErroApiFutebol(
          "parametros",
          "A API recusou a consulta. Verifique o plano e os parâmetros.",
        );
      // Ligas e clubes não oferecem paginação por page. Nunca importar uma lista parcial silenciosamente.
      if (dados.paging && dados.paging.total > 1)
        throw new ErroApiFutebol(
          "resposta",
          "A API retornou uma lista parcial de clubes ou ligas.",
        );
      return dados.response;
    }
    throw new ErroApiFutebol("rede", "Não foi possível consultar a API.");
  }
}
