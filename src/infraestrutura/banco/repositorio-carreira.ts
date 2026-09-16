import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { obterBanco } from "./conexao";
import { careerSaves } from "./schema";
import type { EstadoCarreiraPersistido } from "../persistencia/carreira-persistida";

export class ErroSave extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
const conflito = () =>
  new ErroSave(
    409,
    "CONFLITO",
    "A carreira foi alterada em outra aba ou sessão. Recarregue o save do servidor antes de continuar.",
  );
function metadados(state: EstadoCarreiraPersistido) {
  return {
    state,
    saveVersion: state.versao,
    name: `${state.jogador.nome} ${state.jogador.sobrenome}`,
    currentClubId: state.clubeAtualId,
    currentLeagueId: state.ligaId,
    gameDate: state.dataAtual,
    updatedAt: new Date(),
  };
}
export function criarRepositorioCarreira(banco = obterBanco) {
  return {
    async ler(hash: string) {
      const [save] = await banco()
        .select()
        .from(careerSaves)
        .where(eq(careerSaves.accessTokenHash, hash));
      return save ?? null;
    },
    async criar(hash: string, state: EstadoCarreiraPersistido) {
      const [save] = await banco()
        .insert(careerSaves)
        .values({ ...metadados(state), accessTokenHash: hash })
        .returning();
      return save;
    },
    async atualizar(
      hash: string,
      revision: number,
      state: EstadoCarreiraPersistido,
      substituir = false,
    ) {
      const [save] = await banco()
        .update(careerSaves)
        .set({
          ...metadados(state),
          revision: sql`${careerSaves.revision} + 1`,
        })
        .where(
          and(
            eq(careerSaves.accessTokenHash, hash),
            eq(careerSaves.revision, revision),
            ...(substituir
              ? []
              : [sql`${careerSaves.state}->>'id' = ${state.id}`]),
          ),
        )
        .returning();
      if (save) return save;
      // Retry de PUT cujo ACK se perdeu: só aceitar se o JSONB já for exatamente o enviado.
      if (!substituir) {
        const [igual] = await banco()
          .select()
          .from(careerSaves)
          .where(
            and(
              eq(careerSaves.accessTokenHash, hash),
              eq(careerSaves.revision, revision + 1),
              sql`${careerSaves.state} = ${JSON.stringify(state)}::jsonb`,
            ),
          );
        if (igual) return igual;
      }
      throw conflito();
    },
    async excluir(hash: string, revision: number) {
      const removidos = await banco()
        .delete(careerSaves)
        .where(
          and(
            eq(careerSaves.accessTokenHash, hash),
            eq(careerSaves.revision, revision),
          ),
        )
        .returning({ id: careerSaves.id });
      if (!removidos.length && (await this.ler(hash))) throw conflito();
    },
  };
}
