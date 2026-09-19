import type {
  Clube,
  EstadoCarreira,
  Liga,
  Temporada,
} from "@/dominio/entidades/modelos";
import {
  REGRAS_MOVIMENTO_PARES,
  type RegrasMovimentoPar,
} from "@/dominio/constantes/regras-movimento";
import {
  resolverPlayoffAcesso,
  resolverPlayoffInterdivisional,
} from "@/simulacao/mundo/playoff-divisao";
import { lerVencedorPlayoffAcesso } from "@/simulacao/mundo/playoffs-calendario";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { registrarEvento } from "@/simulacao/eventos/eventos";

function temporadaDaLiga(
  carreira: EstadoCarreira,
  ligaId: string,
): Temporada | null {
  if (carreira.liga.id === ligaId) return carreira.temporada;
  return carreira.temporadasExternas[ligaId] ?? null;
}

function clubesOrdenados(
  carreira: EstadoCarreira,
  temporada: Temporada,
): Clube[] {
  const porId = new Map(carreira.clubes.map((c) => [c.id, c]));
  return temporada.classificacao
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .map((l) => porId.get(l.clubeId))
    .filter((c): c is Clube => !!c);
}

function moverClube(
  carreira: EstadoCarreira,
  clubeId: string,
  novaLigaId: string,
): Clube | undefined {
  const clube = carreira.clubes.find((c) => c.id === clubeId);
  if (!clube) return undefined;
  if (clube.ligaId === novaLigaId) return clube;
  clube.ligaId = novaLigaId;
  return clube;
}

function eventoMovimento(
  carreira: EstadoCarreira,
  clube: Clube,
  tipo: "acesso" | "rebaixamento" | "playoff-acesso" | "playoff-permanece",
  ligaDestino: Liga,
  aoUsuario: boolean,
): void {
  if (!aoUsuario && tipo !== "playoff-acesso") return;
  const textos: Record<typeof tipo, { titulo: string; texto: string }> = {
    acesso: {
      titulo: `${clube.nome} conquista acesso à ${ligaDestino.nome}`,
      texto: `O ${clube.nome} sobe de divisão e disputará a ${ligaDestino.nome} na próxima temporada.`,
    },
    rebaixamento: {
      titulo: `${clube.nome} é rebaixado para a ${ligaDestino.nome}`,
      texto: `Após a classificação final, o ${clube.nome} cai para a ${ligaDestino.nome}.`,
    },
    "playoff-acesso": {
      titulo: `${clube.nome} vence o playoff de acesso`,
      texto: `Nos playoffs, o ${clube.nome} garante vaga na ${ligaDestino.nome}.`,
    },
    "playoff-permanece": {
      titulo: `${clube.nome} permanece na ${ligaDestino.nome} após playoff`,
      texto: `O ${clube.nome} se salvou no confronto de barragens e segue na ${ligaDestino.nome}.`,
    },
  };
  const t = textos[tipo];
  registrarEvento(
    carreira,
    "divisao",
    t.titulo,
    t.texto,
    "Imprensa",
    aoUsuario,
  );
}

/**
 * Aplica promoção/rebaixamento de um par de divisões (ambas já encerradas).
 * Mutação in-place em `carreira.clubes[].ligaId`.
 */
export function aplicarMovimentoPar(
  carreira: EstadoCarreira,
  regras: RegrasMovimentoPar,
  aleatorio: GeradorAleatorio,
): void {
  const ligaSup = carreira.ligas.find((l) => l.id === regras.divisaoSuperiorId);
  const ligaInf = carreira.ligas.find((l) => l.id === regras.divisaoInferiorId);
  if (!ligaSup || !ligaInf) return;

  const tempSup = temporadaDaLiga(carreira, regras.divisaoSuperiorId);
  const tempInf = temporadaDaLiga(carreira, regras.divisaoInferiorId);
  if (!tempSup?.encerrada || !tempInf?.encerrada) return;

  const nSup = tempSup.classificacao.length;
  const nInf = tempInf.classificacao.length;
  if (nSup < 2 || nInf < 2) return;

  const classSup = clubesOrdenados(carreira, tempSup);
  const classInf = clubesOrdenados(carreira, tempInf);
  const data = carreira.dataAtual;
  const usuarioId = carreira.clubeAtualId;

  // --- Rebaixamento direto (fundo da superior) ---
  const rebaixadosDiretos: string[] = [];
  for (let i = 0; i < regras.rebaixamentoDireto; i++) {
    const clube = classSup[nSup - 1 - i];
    if (!clube) continue;
    rebaixadosDiretos.push(clube.id);
  }

  // --- Promoção direta (topo da inferior) ---
  const promovidosDiretos: string[] = [];
  for (let i = 0; i < regras.promocaoDireta; i++) {
    const clube = classInf[i];
    if (!clube) continue;
    promovidosDiretos.push(clube.id);
  }

  // --- Playoff de acesso (inferior) ---
  let promovidoPlayoff: string | null = null;
  if (regras.playoffAcesso) {
    promovidoPlayoff = lerVencedorPlayoffAcesso(
      tempInf,
      regras.playoffAcesso,
      aleatorio,
      regras.id,
    );
    if (!promovidoPlayoff) {
      promovidoPlayoff = resolverPlayoffAcesso(
        classInf,
        regras.playoffAcesso,
        aleatorio,
        data,
      );
    }
  }

  // --- Playoff interdivisional (16º × 3º ou × vencedor playoff) ---
  let trocaInter: { sobe: string; desce: string } | null = null;
  let superiorSalvoPlayoff: string | null = null;

  if (regras.playoffInterdivisional) {
    const cfg = regras.playoffInterdivisional;
    // Em ligas reduzidas (demo/teste), a vaga de barragem fica logo acima
    // dos rebaixamentos diretos (ex.: 16º em 18 → 6º em 8).
    const posSupEfetiva = Math.min(
      cfg.posicaoSuperior,
      Math.max(1, nSup - regras.rebaixamentoDireto),
    );
    const clubeSup = classSup[posSupEfetiva - 1];
    let clubeInf: Clube | undefined;
    if (cfg.adversarioInferior === "playoff") {
      if (promovidoPlayoff) {
        clubeInf = classInf.find((c) => c.id === promovidoPlayoff);
        // O vencedor do playoff de acesso disputa barragem — não sobe automaticamente.
        promovidoPlayoff = null;
      }
    } else {
      clubeInf = classInf[cfg.adversarioInferior - 1];
    }
    if (clubeSup && clubeInf) {
      const r = resolverPlayoffInterdivisional(
        clubeSup,
        clubeInf,
        aleatorio,
        data,
        cfg.idaVolta,
      );
      if (r.superiorPermanece) {
        superiorSalvoPlayoff = clubeSup.id;
        // Inferior permanece — sem troca.
      } else {
        trocaInter = { sobe: clubeInf.id, desce: clubeSup.id };
      }
    }
  }

  // Aplicar movimentos (conjunto para evitar duplicatas)
  const sobem = new Set<string>([
    ...promovidosDiretos,
    ...(promovidoPlayoff ? [promovidoPlayoff] : []),
    ...(trocaInter ? [trocaInter.sobe] : []),
  ]);
  const descem = new Set<string>([
    ...rebaixadosDiretos,
    ...(trocaInter ? [trocaInter.desce] : []),
  ]);

  // Quem sobe no playoff inter não pode estar em descem; quem desce não sobe.
  for (const id of sobem) descem.delete(id);
  for (const id of descem) sobem.delete(id);

  for (const id of sobem) {
    const clube = moverClube(carreira, id, regras.divisaoSuperiorId);
    if (!clube) continue;
    const viaPlayoff =
      (promovidoPlayoff !== null && id === promovidoPlayoff) ||
      id === trocaInter?.sobe;
    const aoUsuario = id === usuarioId;
    if (aoUsuario || viaPlayoff) {
      eventoMovimento(
        carreira,
        clube,
        viaPlayoff && !promovidosDiretos.includes(id)
          ? "playoff-acesso"
          : "acesso",
        ligaSup,
        aoUsuario,
      );
    }
  }

  for (const id of descem) {
    const clube = moverClube(carreira, id, regras.divisaoInferiorId);
    if (!clube) continue;
    eventoMovimento(
      carreira,
      clube,
      "rebaixamento",
      ligaInf,
      id === usuarioId,
    );
  }

  if (usuarioId != null && superiorSalvoPlayoff === usuarioId) {
    const clube = carreira.clubes.find((c) => c.id === superiorSalvoPlayoff);
    if (clube) {
      eventoMovimento(carreira, clube, "playoff-permanece", ligaSup, true);
    }
  }

  // Ajuste de reputação leve
  for (const id of sobem) {
    const c = carreira.clubes.find((x) => x.id === id);
    if (c) c.reputacao = Math.min(100, c.reputacao + 2);
  }
  for (const id of descem) {
    const c = carreira.clubes.find((x) => x.id === id);
    if (c) c.reputacao = Math.max(20, c.reputacao - 2);
  }
}

/**
 * Processa todos os pares cuja superior e inferior existem e estão encerradas.
 * Deve rodar UMA vez no início da próxima temporada (após drenar rodadas externas).
 */
export function aplicarPromocaoRebaixamentoMundo(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  const ligasIds = new Set(carreira.ligas.map((l) => l.id));
  for (const regras of REGRAS_MOVIMENTO_PARES) {
    if (
      !ligasIds.has(regras.divisaoSuperiorId) ||
      !ligasIds.has(regras.divisaoInferiorId)
    )
      continue;
    aplicarMovimentoPar(carreira, regras, aleatorio);
  }

  // Se o clube do jogador mudou de divisão, atualiza carreira.liga (temporada será recriada).
  if (carreira.clubeAtualId) {
    const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
    if (clube && clube.ligaId !== carreira.liga.id) {
      const nova = carreira.ligas.find((l) => l.id === clube.ligaId);
      if (nova) carreira.liga = nova;
    }
  }
}

/** Conta clubes por liga (validação / testes). */
export function contagemClubesPorLiga(
  carreira: EstadoCarreira,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of carreira.clubes) {
    out[c.ligaId] = (out[c.ligaId] ?? 0) + 1;
  }
  return out;
}
