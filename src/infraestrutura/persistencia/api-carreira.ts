import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  criarRepositorioCarreira,
  ErroSave,
} from "../banco/repositorio-carreira";
import { carregarCatalogoCarreira } from "./catalogo-carreira";
import {
  ErroCompatibilidadeSave,
  hidratarCarreira,
  validarCarreiraPersistida,
} from "./carreira-persistida";

export const COOKIE_CARREIRA = "viztto_carreira";
export const LIMITE_SAVE_BYTES = 16 * 1024 * 1024;
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const revisao = z.number().int().min(0).max(2_147_483_645);
const escrita = z
  .object({
    state: z.unknown(),
    revision: revisao.nullable(),
    substituir: z.boolean().optional(),
  })
  .strict();
const apagar = z.object({ revision: revisao }).strict();
const opcoesCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
});
function tokenDaRequisicao(req: NextRequest) {
  const valor = req.cookies.get(COOKIE_CARREIRA)?.value;
  return valor && /^[a-f0-9]{64}$/.test(valor) ? valor : null;
}
function json(dados: unknown, status = 200) {
  return NextResponse.json(dados, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
function sameOrigin(req: NextRequest) {
  const origem = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (!origem || (site && site !== "same-origin"))
    throw new ErroSave(403, "ORIGEM", "Operação permitida somente neste site.");
  let url: URL;
  try {
    url = new URL(origem);
  } catch {
    throw new ErroSave(403, "ORIGEM", "Origem inválida.");
  }
  const protocolo =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  if (
    url.origin !== origem ||
    url.host !== (req.headers.get("host") ?? req.nextUrl.host) ||
    url.protocol !== `${protocolo}:` ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new ErroSave(403, "ORIGEM", "Origem inválida.");
}
async function lerCorpo(req: NextRequest) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroSave(415, "JSON", "Envie dados JSON.");
  if (Number(req.headers.get("content-length")) > LIMITE_SAVE_BYTES)
    throw new ErroSave(413, "TAMANHO", "O save excedeu o limite de 16 MiB.");
  const reader = req.body?.getReader();
  if (!reader) throw new ErroSave(400, "INVALIDO", "Save inválido.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_SAVE_BYTES) {
        await reader.cancel();
        throw new ErroSave(
          413,
          "TAMANHO",
          "O save excedeu o limite de 16 MiB.",
        );
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (erro) {
    if (erro instanceof ErroSave) throw erro;
    throw new ErroSave(400, "INVALIDO", "Save inválido.");
  } finally {
    reader.releaseLock();
  }
}

export function criarApiCarreira(
  repo = criarRepositorioCarreira(),
  catalogo = carregarCatalogoCarreira,
) {
  return async function atender(req: NextRequest) {
    try {
      if (req.nextUrl.search)
        throw new ErroSave(
          400,
          "INVALIDO",
          "A carreira é identificada somente pelo cookie.",
        );
      if (req.method !== "GET") sameOrigin(req);
      let token = tokenDaRequisicao(req);
      const hash = token ? hashToken(token) : null;
      const existente = hash ? await repo.ler(hash) : null;
      if (req.method === "GET") {
        if (!existente) return json({ carreira: null }, 404);
        try {
          const state = validarCarreiraPersistida(existente.state);
          const carreira = hidratarCarreira(
            state,
            await catalogo(state.ligasIds),
          );
          const resposta = json({ carreira, revision: existente.revision });
          resposta.cookies.set(COOKIE_CARREIRA, token!, opcoesCookie());
          return resposta;
        } catch {
          return json(
            {
              erro: new ErroCompatibilidadeSave().message,
              codigo: "INCOMPATIVEL",
              revision: existente.revision,
            },
            422,
          );
        }
      }
      if (req.method === "DELETE") {
        const body = apagar.parse(await lerCorpo(req));
        if (hash) await repo.excluir(hash, body.revision);
        const resposta = json({ excluida: true });
        resposta.cookies.set(COOKIE_CARREIRA, "", {
          ...opcoesCookie(),
          maxAge: 0,
        });
        return resposta;
      }
      const body = escrita.parse(await lerCorpo(req));
      let state;
      let carreira;
      try {
        state = validarCarreiraPersistida(body.state);
        carreira = hidratarCarreira(state, await catalogo(state.ligasIds));
      } catch (erro) {
        if (erro instanceof ErroCompatibilidadeSave) throw erro;
        throw new ErroSave(
          400,
          "INVALIDO",
          "O save está incompleto ou inválido. O progresso anterior foi preservado.",
        );
      }
      if (req.method === "PUT") {
        if (!hash || !existente)
          throw new ErroSave(
            404,
            "AUSENTE",
            "Carreira não encontrada no servidor.",
          );
        if (body.revision === null || body.substituir)
          throw new ErroSave(400, "INVALIDO", "Revisão inválida.");
        const salvo = await repo.atualizar(hash, body.revision, state);
        return json({ revision: salvo.revision });
      }
      if (req.method !== "POST")
        return json({ erro: "Método não permitido." }, 405);
      if (existente && (!body.substituir || body.revision === null))
        throw new ErroSave(
          409,
          "CONFLITO",
          "Confirme a substituição da carreira existente.",
        );
      if (!existente && (body.revision !== null || body.substituir))
        throw new ErroSave(
          409,
          "CONFLITO",
          "A carreira anterior mudou. Recarregue antes de criar outra.",
        );
      if (!existente) token = randomBytes(32).toString("hex");
      const salvo = existente
        ? await repo.atualizar(hash!, body.revision!, state, true)
        : await repo.criar(hashToken(token!), state);
      const resposta = json(
        { carreira, revision: salvo.revision },
        existente ? 200 : 201,
      );
      resposta.cookies.set(COOKIE_CARREIRA, token!, opcoesCookie());
      return resposta;
    } catch (erro) {
      if (erro instanceof ErroSave)
        return json({ erro: erro.message, codigo: erro.codigo }, erro.status);
      if (erro instanceof ErroCompatibilidadeSave)
        return json({ erro: erro.message, codigo: "INCOMPATIVEL" }, 422);
      if (erro instanceof z.ZodError)
        return json({ erro: "Payload inválido.", codigo: "INVALIDO" }, 400);
      return json(
        {
          erro: "Não foi possível acessar sua carreira no servidor. Tente novamente.",
          codigo: "INDISPONIVEL",
        },
        503,
      );
    }
  };
}
