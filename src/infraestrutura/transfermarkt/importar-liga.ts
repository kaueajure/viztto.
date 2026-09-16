import "server-only";
import type { Clube, Liga } from "@/dominio/entidades/modelos";
import { TEMPORADA_TRANSFERMARKT } from "@/dominio/constantes/ligas";
import { TEMPORADAS_INICIAIS } from "@/dominio/constantes/temporadas-iniciais";
import {
  clubeComElencoCompleto,
  lerDadosLiga,
  salvarDadosLiga,
  type DadosLigaImportados,
  type ProgressoImportacao,
  type StatusImportacaoLiga,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  ClienteTransfermarkt,
  ErroTransfermarkt,
  obterUrlTransfermarkt,
} from "./cliente";
import {
  esquemaClubPlayers,
  esquemaClubProfile,
  esquemaCompetitionClubs,
  esquemaCompetitionSearch,
} from "./esquemas";
import { normalizarClube, normalizarJogadores } from "./normalizacao";

export const INTERVALO_CLUBE_MS = 1500;

export interface ErroImportacaoClube {
  clubeId: string;
  nome: string;
  motivo: string;
}

export interface ResultadoImportacaoLiga {
  clubes: Clube[];
  erros: ErroImportacaoClube[];
  temporada: number;
  inicio: string;
  status: StatusImportacaoLiga;
  progresso: ProgressoImportacao;
  motivoInterrupcao?: string | null;
}

export interface OpcoesImportacao {
  esperar?: (ms: number) => Promise<void>;
  forcar?: boolean;
  aoProgresso?: (progresso: ProgressoImportacao) => void | Promise<void>;
  baseUrl?: string;
  temporadaApi?: string;
}

function montarProgresso(
  total: number,
  clubes: Map<string, Clube>,
  erros: Map<string, ErroImportacaoClube>,
  clubeAtual: string | null,
): ProgressoImportacao {
  return {
    total,
    importados: clubes.size,
    falhas: erros.size,
    clubeAtual,
  };
}

function statusFinal(
  total: number,
  importados: number,
  falhas: number,
  interrompido: boolean,
): StatusImportacaoLiga {
  if (interrompido) return "interrompido";
  if (importados >= total && falhas === 0) return "completo";
  if (importados >= 2) return falhas > 0 ? "parcial" : "completo";
  return "parcial";
}

async function resolverCompeticao(
  cliente: ClienteTransfermarkt,
  liga: Liga,
): Promise<string> {
  // Preferência: IDs Transfermarkt conhecidos (BRA1, GB1, ES1, IT1, L1, FR1).
  if (liga.idTransfermarkt) return liga.idTransfermarkt;
  const bruto = await cliente.consultar(
    `/competitions/search/${encodeURIComponent(liga.termoBusca)}`,
  );
  const busca = esquemaCompetitionSearch.parse(bruto);
  const porPais = busca.results.find((r) =>
    r.country.toLowerCase().includes(
      liga.pais === "Brasil"
        ? "brazil"
        : liga.pais === "Inglaterra"
          ? "england"
          : liga.pais === "Espanha"
            ? "spain"
            : liga.pais === "Itália"
              ? "italy"
              : liga.pais === "Alemanha"
                ? "germany"
                : liga.pais === "França"
                  ? "france"
                  : liga.pais.toLowerCase(),
    ),
  );
  if (porPais) return porPais.id;
  if (busca.results[0]) return busca.results[0].id;
  throw new ErroTransfermarkt(
    "nao_encontrado",
    `Competição não encontrada para a liga ${liga.nome}.`,
  );
}

export async function importarLiga(
  liga: Liga,
  opcoes?: OpcoesImportacao,
): Promise<ResultadoImportacaoLiga> {
  const esperar =
    opcoes?.esperar ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const agora = () => new Date().toISOString();
  const existente = await lerDadosLiga(liga.id);
  const temporadaApi = opcoes?.temporadaApi ?? TEMPORADA_TRANSFERMARKT;
  const calendario = TEMPORADAS_INICIAIS[liga.id] ?? {
    ano: Number(temporadaApi),
    inicio: `${temporadaApi}-01-01`,
  };

  const baseUrl = opcoes?.baseUrl ?? obterUrlTransfermarkt();
  if (!baseUrl)
    throw new ErroTransfermarkt(
      "configuracao",
      "Configure TRANSFERMARKT_API_URL no servidor para importar clubes reais.",
    );

  const cliente = new ClienteTransfermarkt(baseUrl, esperar);
  const competitionId = await resolverCompeticao(cliente, liga);
  const clubsBruto = await cliente.consultar(
    `/competitions/${encodeURIComponent(competitionId)}/clubs?season_id=${encodeURIComponent(temporadaApi)}`,
  );
  const clubsResp = esquemaCompetitionClubs.parse(clubsBruto);
  if (clubsResp.clubs.length < 2)
    throw new Error(
      "A Transfermarkt API não retornou clubes suficientes para esta liga.",
    );
  const seasonId = clubsResp.seasonId || temporadaApi;

  const clubes = new Map<string, Clube>();
  const erros = new Map<string, ErroImportacaoClube>();

  if (existente && !opcoes?.forcar) {
    for (const clube of existente.clubes) {
      if (clubeComElencoCompleto(clube)) clubes.set(clube.id, clube);
    }
    for (const erro of existente.erros) {
      if (!clubes.has(erro.clubeId)) erros.set(erro.clubeId, erro);
    }
  }

  const total = clubsResp.clubs.length;
  let motivoInterrupcao: string | null = null;
  let interrompido = false;

  const placeholders = clubsResp.clubs.map((c) => ({
    id: `tm-${c.id}`,
    nome: c.name,
  }));

  const persistir = async (
    clubeAtual: string | null,
    status: StatusImportacaoLiga,
  ) => {
    const progresso = montarProgresso(total, clubes, erros, clubeAtual);
    const dados: DadosLigaImportados = {
      ligaId: liga.id,
      temporada: calendario.ano,
      inicio: calendario.inicio,
      importadoEm: existente?.importadoEm ?? agora(),
      atualizadoEm: agora(),
      status,
      progresso,
      clubes: placeholders.map((base) => {
        const pronto = clubes.get(base.id);
        if (pronto) return pronto;
        const parcial = existente?.clubes.find((c) => c.id === base.id);
        return (
          parcial ?? {
            id: base.id,
            idExterno: Number.parseInt(base.id.replace("tm-", ""), 10) || 0,
            idTransfermarkt: base.id.replace("tm-", ""),
            ligaId: liga.id,
            nome: base.nome,
            nomeCurto: base.nome,
            nomeOficial: null,
            codigo: base.nome.slice(0, 3).toUpperCase(),
            pais: liga.pais,
            fundacao: null,
            escudo: "",
            estadio: "Estádio não informado",
            capacidadeEstadio: null,
            tamanhoElenco: null,
            idadeMedia: null,
            valorElenco: null,
            registroTransferencias: null,
            formacaoPreferida: "4-3-3" as const,
            goleiroTitularId: null,
            titularesIds: [],
            reputacao: liga.forcaMedia,
            forcaGeral: liga.forcaMedia,
            forcaAtaque: liga.forcaMedia,
            forcaMeio: liga.forcaMedia,
            forcaDefesa: liga.forcaMedia,
            qualidadeBase: 60,
            poderFinanceiro: liga.forcaMedia,
            forma: 50,
            moral: 60,
            fadiga: 10,
            elenco: [],
            dadosBrutos: null,
          }
        );
      }),
      erros: [...erros.values()],
      motivoInterrupcao,
    };
    await salvarDadosLiga(dados);
    await opcoes?.aoProgresso?.(progresso);
  };

  await persistir(null, "em_andamento");

  const pendentes = clubsResp.clubs.filter((c) => {
    const id = `tm-${c.id}`;
    if (opcoes?.forcar) return true;
    const salvo = clubes.get(id);
    return !salvo || !clubeComElencoCompleto(salvo);
  });

  for (let i = 0; i < pendentes.length; i++) {
    const ref = pendentes[i]!;
    const clubeId = `tm-${ref.id}`;
    await persistir(ref.name, "em_andamento");
    try {
      const perfilBruto = await cliente.consultar(
        `/clubs/${encodeURIComponent(ref.id)}/profile`,
      );
      const perfil = esquemaClubProfile.parse(perfilBruto);
      const elencoBruto = await cliente.consultar(
        `/clubs/${encodeURIComponent(ref.id)}/players?season_id=${encodeURIComponent(seasonId)}`,
      );
      const elencoApi = esquemaClubPlayers.parse(elencoBruto);
      const elenco = normalizarJogadores(elencoApi);
      if (!elenco.length)
        throw new Error("A API não retornou jogadores para este clube.");
      const clube = normalizarClube(liga, perfil, elenco, {
        profile: perfilBruto as Record<string, unknown>,
        players: elencoBruto as Record<string, unknown>,
      });
      clubes.set(clube.id, clube);
      erros.delete(clube.id);
      await persistir(null, "em_andamento");
      if (i < pendentes.length - 1) await esperar(INTERVALO_CLUBE_MS);
    } catch (erro) {
      if (erro instanceof ErroTransfermarkt && erro.codigo === "limite") {
        motivoInterrupcao = erro.message;
        interrompido = true;
        await persistir(null, "interrompido");
        break;
      }
      erros.set(clubeId, {
        clubeId,
        nome: ref.name,
        motivo:
          erro instanceof Error
            ? erro.message
            : "Falha ao importar este clube.",
      });
      await persistir(null, "em_andamento");
    }
  }

  const progresso = montarProgresso(total, clubes, erros, null);
  const status = statusFinal(
    total,
    progresso.importados,
    progresso.falhas,
    interrompido,
  );
  await persistir(null, status);

  if (progresso.importados < 2 && !interrompido)
    throw new Error(
      progresso.falhas
        ? `Apenas ${progresso.importados} clube(s) importado(s). ${progresso.falhas} falha(s): ${[...erros.values()].map((e) => `${e.nome} (${e.motivo})`).join("; ")}`
        : "Não foi possível importar clubes suficientes para esta liga.",
    );

  return {
    clubes: [...clubes.values()],
    erros: [...erros.values()],
    temporada: calendario.ano,
    inicio: calendario.inicio,
    status,
    progresso,
    motivoInterrupcao,
  };
}
