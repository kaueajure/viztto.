import { NextRequest, NextResponse } from "next/server";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import {
  TEMPORADAS_INICIAIS,
  formatarTemporada,
} from "@/dominio/constantes/temporadas-iniciais";
import { obterProvedor } from "@/infraestrutura/api-futebol/provedor-compartilhado";
import { ErroApiFutebol } from "@/infraestrutura/api-futebol/cliente-api";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { TemporadaForaDoPlano } from "@/infraestrutura/api-futebol/provedor-dados-futebol";
export async function GET(requisicao: NextRequest) {
  const liga = LIGAS_SUPORTADAS.find(
    (l) => l.id === requisicao.nextUrl.searchParams.get("liga"),
  );
  if (!liga)
    return NextResponse.json({ erro: "Liga inválida." }, { status: 400 });
  const edicao = TEMPORADAS_INICIAIS[liga.id],
    rotulo = formatarTemporada(liga.id, edicao.ano);
  const chave = process.env.API_FOOTBALL_CHAVE;
  let inicio = edicao.inicio;
  try {
    if (!chave) throw new Error("Chave não configurada.");
    const provedor = obterProvedor(chave);
    const temporada = await provedor.buscarTemporada(
      liga.idExterno,
      edicao.ano,
    );
    inicio = temporada.inicio;
    const clubes = await provedor.buscarClubes(liga.idExterno, edicao.ano);
    return NextResponse.json({
      clubes,
      temporada: edicao.ano,
      inicio,
      origem: "api",
      aviso: null,
    });
  } catch (erro) {
    const motivo =
      erro instanceof TemporadaForaDoPlano
        ? `Seu plano da API não libera a temporada ${rotulo}. É necessário um plano com acesso a essa edição para usar os clubes reais.`
        : erro instanceof ErroApiFutebol
          ? erro.message
          : chave
            ? `Não foi possível importar a temporada ${rotulo}.`
            : "A chave da API-Football não está configurada.";
    return NextResponse.json({
      clubes: gerarClubesDemonstracao(liga),
      temporada: edicao.ano,
      inicio,
      origem: "demonstracao",
      aviso: `${motivo} Demonstração ${rotulo}: clubes fictícios. Nenhuma temporada anterior foi importada.`,
    });
  }
}
