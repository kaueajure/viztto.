import "server-only";
import type {
  ProvedorDadosFutebol,
  LigaExterna,
} from "./provedor-dados-futebol";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { esquemaClubeApi, esquemaLigaApi } from "./esquemas";
import type { Clube } from "@/dominio/entidades/modelos";
import { GeradorAleatorio, gerarSeedNumerica } from "@/utilitarios/aleatorio";
import { ClienteApiFutebol } from "./cliente-api";
export class ProvedorApiFootball implements ProvedorDadosFutebol {
  private readonly cliente: ClienteApiFutebol;
  constructor(chave: string, cliente?: ClienteApiFutebol) {
    this.cliente = cliente ?? new ClienteApiFutebol(chave);
  }
  private consultar(caminho: string): Promise<unknown[]> {
    return this.cliente.consultar(caminho);
  }
  async buscarLigas(): Promise<LigaExterna[]> {
    const dados = await this.consultar("leagues?current=true");
    return dados.flatMap((item) => {
      const validacao = esquemaLigaApi.safeParse(item);
      if (!validacao.success) return [];
      const ligaApi = validacao.data,
        liga = LIGAS_SUPORTADAS.find((l) => l.idExterno === ligaApi.league.id),
        temporada = ligaApi.seasons.find((t) => t.current);
      return liga && temporada
        ? [
            {
              liga,
              temporada: temporada.year,
              inicio: temporada.start.slice(0, 10),
            },
          ]
        : [];
    });
  }
  async buscarTemporada(idLiga: number, ano: number): Promise<LigaExterna> {
    const liga = LIGAS_SUPORTADAS.find((item) => item.idExterno === idLiga);
    if (!liga) throw new Error("Liga não suportada.");
    const dados = await this.consultar(`leagues?id=${idLiga}&season=${ano}`);
    const registro = esquemaLigaApi.parse(dados[0]);
    if (registro.league.id !== idLiga)
      throw new Error("A API retornou uma liga diferente da solicitada.");
    const temporada = registro.seasons.find((item) => item.year === ano);
    if (!temporada)
      throw new Error("A temporada disponível não foi encontrada.");
    return { liga, temporada: ano, inicio: temporada.start.slice(0, 10) };
  }
  async buscarClubes(idLiga: number, temporada: number): Promise<Clube[]> {
    const liga = LIGAS_SUPORTADAS.find((l) => l.idExterno === idLiga);
    if (!liga) throw new Error("Liga não suportada.");
    const dados = await this.consultar(
      `teams?league=${idLiga}&season=${temporada}`,
    );
    const clubes = dados.map((item) => {
      const { team, venue } = esquemaClubeApi.parse(item),
        aleatorio = new GeradorAleatorio(gerarSeedNumerica(`clube-${team.id}`));
      const forca = liga.forcaMedia + aleatorio.inteiro(-12, 10);
      return {
        id: `api-${team.id}`,
        idExterno: team.id,
        ligaId: liga.id,
        nome: team.name,
        codigo: team.code ?? team.name.slice(0, 3).toUpperCase(),
        pais: team.country,
        fundacao: team.founded,
        escudo: team.logo ?? "",
        estadio: venue?.name ?? "Estádio não informado",
        reputacao: forca,
        forcaGeral: forca,
        forcaAtaque: forca + aleatorio.inteiro(-4, 4),
        forcaMeio: forca + aleatorio.inteiro(-4, 4),
        forcaDefesa: forca + aleatorio.inteiro(-4, 4),
        qualidadeBase: aleatorio.inteiro(45, 95),
        poderFinanceiro: forca,
        forma: 50,
        moral: 60,
        fadiga: 10,
      };
    });
    if (new Set(clubes.map((clube) => clube.id)).size !== clubes.length)
      throw new Error("A API retornou clubes duplicados.");
    if (clubes.length < 2)
      throw new Error(
        "A API não retornou clubes suficientes para esta temporada.",
      );
    return clubes;
  }
}
