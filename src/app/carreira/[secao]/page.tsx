import { notFound } from "next/navigation";
import { CentralCarreira } from "@/componentes/jogo/CentralCarreira";
const SECOES = [
  "jogador",
  "calendario",
  "clube",
  "competicao",
  "treinamento",
  "mercado",
  "noticias",
  "historico",
  "desempenho",
  "contrato",
  "objetivos",
];
export function generateStaticParams() {
  return SECOES.map((secao) => ({ secao }));
}
export default async function SecaoCarreira({
  params,
}: {
  params: Promise<{ secao: string }>;
}) {
  const { secao } = await params;
  if (!SECOES.includes(secao)) notFound();
  return <CentralCarreira secao={secao} />;
}
