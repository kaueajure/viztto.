import { criarApiCarreira } from "@/infraestrutura/persistencia/api-carreira";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const atender = criarApiCarreira();
export const GET = atender;
export const POST = atender;
export const PUT = atender;
export const DELETE = atender;
