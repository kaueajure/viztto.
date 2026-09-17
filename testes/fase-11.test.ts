import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { atualizarBaseFutebol } from "@/infraestrutura/transfermarkt/atualizar-base";
import {
  definirDiretorioImportacao,
  obterDiretorioImportacao,
  salvarDadosLiga,
  lerDadosLiga,
} from "@/infraestrutura/persistencia/importacao-futebol";
import {
  criarJogadorMundo,
  hidratarElencoClube,
} from "@/dominio/jogador-mundo";
import { sincronizarForcaClube } from "@/simulacao/elenco/forca-escalacao";
import {
  serializarCarreira,
  hidratarCarreira,
} from "@/infraestrutura/persistencia/carreira-persistida";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import type { Clube, JogadorExterno } from "@/dominio/entidades/modelos";

const diretorioOriginal = obterDiretorioImportacao();
const limpeza: string[] = [];

afterEach(async () => {
  definirDiretorioImportacao(diretorioOriginal);
  for (const d of limpeza.splice(0))
    await rm(d, { recursive: true, force: true });
});

function jogadorBase(
  overrides: Partial<JogadorExterno> & Pick<JogadorExterno, "id" | "nome">,
): JogadorExterno {
  return {
    idExterno: 1,
    idTransfermarkt: overrides.id,
    dataNascimento: "1998-05-10",
    idade: 27,
    nacionalidade: ["Brasil"],
    posicao: "Centre-Forward",
    grupoPosicao: "ATA",
    peDominante: "direito",
    altura: 180,
    numero: 9,
    valorMercado: 8_000_000,
    contratoAte: "2027-06-30",
    joinedOn: null,
    signedFrom: null,
    foto: "",
    ...overrides,
  };
}

describe("Hidratação, save e força do clube", () => {
  it("snapshot overall tem precedência na criação de JogadorMundo", () => {
    const j = criarJogadorMundo(
      {
        ...jogadorBase({ id: "snap1", nome: "Snapshot" }),
        overall: 81,
        potencial: 86,
      } as Parameters<typeof criarJogadorMundo>[0],
      {
        clubeId: "c",
        reputacaoClube: 80,
        reputacaoLiga: 85,
        forcaClube: 75,
        indiceNoElenco: 0,
        tamanhoElenco: 20,
      },
    );
    expect(j.overall).toBe(81);
    expect(j.potencial).toBe(86);
  });

  it("atualização de snapshot não altera save já criado", () => {
    const { carreira, catalogo } = exemploCarreira();
    const overallAntes = carreira.jogador.overall;
    const elencoAntes = carreira.clubes[0]!.elenco.map((j) => j.overall);
    const serial = serializarCarreira(carreira);
    const catalogoNovo = {
      ligas: catalogo.ligas,
      clubes: catalogo.clubes.map((c) => ({
        ...c,
        elenco: c.elenco.map((j) => ({ ...j, overall: 99, potencial: 99 })),
      })),
    };
    const hidratada = hidratarCarreira(serial, catalogoNovo);
    // Deltas do save sobrescrevem overall do catálogo novo
    expect(hidratada.jogador.overall).toBe(overallAntes);
    expect(hidratada.clubes[0]!.elenco.map((j) => j.overall)).toEqual(
      elencoAntes,
    );
  });

  it("força do clube deriva da escalação após hidratar overalls", () => {
    const liga = LIGAS_SUPORTADAS[0]!;
    const elenco = Array.from({ length: 14 }, (_, i) =>
      criarJogadorMundo(
        {
          ...jogadorBase({
            id: `f${i}`,
            nome: `J${i}`,
            posicao:
              i === 0
                ? "Goalkeeper"
                : i < 5
                  ? "Centre-Back"
                  : i < 9
                    ? "Central Midfield"
                    : "Centre-Forward",
            valorMercado: 20_000_000 - i * 500_000,
          }),
          overall: 80 - i,
          potencial: 85 - i,
        } as Parameters<typeof criarJogadorMundo>[0],
        {
          clubeId: "cx",
          reputacaoClube: 80,
          reputacaoLiga: liga.reputacao,
          forcaClube: 70,
          indiceNoElenco: i,
          tamanhoElenco: 14,
        },
      ),
    );
    const clube = {
      id: "cx",
      ligaId: liga.id,
      formacaoPreferida: "4-3-3" as const,
      goleiroTitularId: elenco[0]!.id,
      titularesIds: elenco.slice(1, 11).map((j) => j.id),
      bancoIds: elenco.slice(11).map((j) => j.id),
      elenco,
      reputacao: 80,
      forcaGeral: 50,
      forcaAtaque: 50,
      forcaMeio: 50,
      forcaDefesa: 50,
      poderFinanceiro: 60,
      orcamento: 1,
      forma: 70,
      moral: 70,
      fadiga: 15,
      treinador: {
        id: "t1",
        nome: "Técnico",
        formacaoPreferida: "4-3-3",
        estilo: "equilibrado",
        preferenciaJovens: 50,
        disciplina: 50,
        rotacao: 50,
        paciencia: 50,
      },
    } as unknown as Clube;
    sincronizarForcaClube(clube);
    expect(Number.isFinite(clube.forcaGeral)).toBe(true);
    expect(clube.forcaGeral).not.toBe(50);
    expect(clube.forcaAtaque).toBeGreaterThan(0);
  });

  it("hidratarElenco preserva JogadorMundo já completo", () => {
    const liga = LIGAS_SUPORTADAS[0]!;
    const base = criarJogadorMundo(
      {
        ...jogadorBase({ id: "h1", nome: "H" }),
        overall: 77,
        potencial: 82,
      } as Parameters<typeof criarJogadorMundo>[0],
      {
        clubeId: "c",
        reputacaoClube: 70,
        reputacaoLiga: 80,
        forcaClube: 70,
        indiceNoElenco: 0,
        tamanhoElenco: 1,
      },
    );
    const out = hidratarElencoClube(
      [base],
      { id: "c", reputacao: 70, forcaGeral: 70 },
      liga,
    );
    expect(out[0]!.overall).toBe(77);
  });
});
