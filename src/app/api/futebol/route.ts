import { NextRequest, NextResponse } from "next/server";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  clubesProntosParaJogo,
  lerDadosLiga,
} from "@/infraestrutura/persistencia/importacao-futebol";

export async function GET(requisicao: NextRequest) {
  const liga = LIGAS_SUPORTADAS.find(
    (l) => l.id === requisicao.nextUrl.searchParams.get("liga"),
  );
  if (!liga)
    return NextResponse.json({ erro: "Liga inválida." }, { status: 400 });

  const dados = await lerDadosLiga(liga.id);
  const clubes = dados ? clubesProntosParaJogo(dados) : [];

  if (!dados || clubes.length < 2) {
    const retomavel =
      dados?.status === "em_andamento" || dados?.status === "interrompido";
    const erro = retomavel
      ? `Importação da ${liga.nome} em andamento ou interrompida (${dados?.progresso.importados ?? 0}/${dados?.progresso.total ?? "?"} clubes).`
      : `A liga ${liga.nome} ainda não foi importada.`;
    return NextResponse.json(
      {
        erro,
        clubes: [],
        erros: dados?.erros ?? [],
        temporada: dados?.temporada ?? null,
        inicio: dados?.inicio ?? null,
        origem: null,
        aviso: null,
        precisaImportar: true,
        progresso: dados?.progresso ?? null,
      },
      { status: 404 },
    );
  }

  const aviso =
    dados.erros.length > 0
      ? `${dados.erros.length} clube(s) não puderam ser importados. ${clubes.length} clube(s) disponível(is).`
      : dados.status === "parcial"
        ? `Importação parcial: ${clubes.length}/${dados.progresso.total} clubes.`
        : null;

  return NextResponse.json({
    clubes,
    erros: dados.erros,
    temporada: dados.temporada,
    inicio: dados.inicio,
    origem: "api" as const,
    aviso,
    progresso: dados.progresso,
  });
}
