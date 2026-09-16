import { buscarEscudo } from "@/infraestrutura/api-futebol/cache-escudos";
export const runtime = "nodejs";
export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[1-9]\d{0,5}$/.test(id))
    return Response.json({ erro: "Identificador inválido." }, { status: 400 });
  try {
    const dados = await buscarEscudo(Number(id));
    return new Response(new Uint8Array(dados), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { erro: "Escudo temporariamente indisponível." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      },
    );
  }
}
