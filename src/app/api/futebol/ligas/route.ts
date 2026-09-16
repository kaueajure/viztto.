import { NextResponse } from "next/server";
import { obterLigasDisponiveis } from "@/infraestrutura/persistencia/base-futebol";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ligas: await obterLigasDisponiveis() });
}
