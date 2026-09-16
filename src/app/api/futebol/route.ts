import { NextRequest, NextResponse } from "next/server";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { obterDadosLigaDisponivel } from "@/infraestrutura/persistencia/base-futebol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(requisicao: NextRequest) {
  const liga = LIGAS_SUPORTADAS.find(
    (l) => l.id === requisicao.nextUrl.searchParams.get("liga"),
  );
  if (!liga)
    return NextResponse.json({ erro: "Liga inválida." }, { status: 400 });
  const dados = await obterDadosLigaDisponivel(liga);
  if (!dados)
    return NextResponse.json(
      { erro: "Liga não disponível na base local." },
      { status: 404 },
    );
  return NextResponse.json({
    clubes: dados.clubes,
    temporada: dados.temporada,
    inicio: dados.inicio,
    origem: "api",
    aviso:
      dados.status === "parcial"
        ? `${dados.clubes.length} clubes disponíveis nesta edição.`
        : null,
  });
}
