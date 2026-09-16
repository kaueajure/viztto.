import { NextRequest, NextResponse } from "next/server";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { importarLiga } from "@/infraestrutura/transfermarkt/importar-liga";
import { ErroTransfermarkt } from "@/infraestrutura/transfermarkt/cliente";
import { lerDadosLiga } from "@/infraestrutura/persistencia/importacao-futebol";
import { esquemaStatusImportacao } from "@/infraestrutura/transfermarkt/esquemas";

const importacoesAtivas = new Set<string>();

function resolverLiga(requisicao: NextRequest) {
  return LIGAS_SUPORTADAS.find(
    (l) => l.id === requisicao.nextUrl.searchParams.get("liga"),
  );
}

export async function GET(requisicao: NextRequest) {
  const liga = resolverLiga(requisicao);
  if (!liga)
    return NextResponse.json({ erro: "Liga inválida." }, { status: 400 });

  const dados = await lerDadosLiga(liga.id);
  const emAndamento = importacoesAtivas.has(liga.id);

  return NextResponse.json(
    esquemaStatusImportacao.parse({
      ligaId: liga.id,
      status: emAndamento ? "em_andamento" : (dados?.status ?? "nao_importada"),
      progresso: dados?.progresso ?? null,
      motivoInterrupcao: dados?.motivoInterrupcao ?? null,
      importadoEm: dados?.importadoEm ?? null,
      atualizadoEm: dados?.atualizadoEm ?? null,
    }),
  );
}

export async function POST(requisicao: NextRequest) {
  const liga = resolverLiga(requisicao);
  if (!liga)
    return NextResponse.json({ erro: "Liga inválida." }, { status: 400 });

  if (!process.env.TRANSFERMARKT_API_URL?.trim()) {
    return NextResponse.json(
      {
        erro:
          "Configure TRANSFERMARKT_API_URL no servidor para importar clubes reais.",
      },
      { status: 503 },
    );
  }

  if (importacoesAtivas.has(liga.id)) {
    const dados = await lerDadosLiga(liga.id);
    return NextResponse.json(
      {
        erro: "Importação já em andamento para esta liga.",
        progresso: dados?.progresso ?? null,
      },
      { status: 409 },
    );
  }

  const forcar = requisicao.nextUrl.searchParams.get("forcar") === "1";
  importacoesAtivas.add(liga.id);
  try {
    const resultado = await importarLiga(liga, { forcar });
    const aviso =
      resultado.erros.length > 0
        ? `${resultado.erros.length} clube(s) falharam. ${resultado.clubes.length} clube(s) importado(s).`
        : resultado.status === "interrompido"
          ? resultado.motivoInterrupcao
          : null;

    return NextResponse.json({
      clubes: resultado.clubes,
      erros: resultado.erros,
      temporada: resultado.temporada,
      inicio: resultado.inicio,
      status: resultado.status,
      progresso: resultado.progresso,
      motivoInterrupcao: resultado.motivoInterrupcao ?? null,
      aviso,
    });
  } catch (erro) {
    const motivo =
      erro instanceof ErroTransfermarkt
        ? erro.message
        : erro instanceof Error
          ? erro.message
          : `Não foi possível importar a liga ${liga.nome}.`;
    const dados = await lerDadosLiga(liga.id);
    return NextResponse.json(
      {
        erro: motivo,
        clubes: dados?.clubes.filter((c) => c.elenco.length > 0) ?? [],
        erros: dados?.erros ?? [],
        progresso: dados?.progresso ?? null,
        status: dados?.status ?? "parcial",
      },
      { status: 502 },
    );
  } finally {
    importacoesAtivas.delete(liga.id);
  }
}
