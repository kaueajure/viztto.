import { validarEscolhasHistoria } from "@/dominio/historia-formacao";
import { migrarDesenvolvimento } from "./migrar-desenvolvimento";
import { z } from "zod";
import type {
  Clube,
  EstadoCarreira,
  JogadorMundo,
  Liga,
} from "@/dominio/entidades/modelos";
import { FORMACOES } from "@/dominio/formacao";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { esquemaRatingMetadata, normalizarRatingMetadata } from "@/dominio/rating-metadata";
import { prepararClubesParaMundo } from "@/dominio/mundo-futebol";
import { esquemaCarreira, validarSave } from "./validar-save";
import { migrarMercadoPersistido } from "./migrar-mercado";

const id = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !["__proto__", "prototype", "constructor"].includes(v));
const numero = z.number().finite();
const nivel = numero.min(0).max(100);
const papel = z.enum([
  "categoria de base",
  "promessa",
  "reserva",
  "rotacao",
  "titular",
  "jogador importante",
  "estrela do time",
]);
const lesao = esquemaCarreira.shape.jogador.shape.lesao;
const estatisticas = z
  .object({
    jogos: numero,
    titularidades: numero,
    minutos: numero,
    gols: numero,
    assistencias: numero,
    amarelos: numero,
    vermelhos: numero,
    somaNotas: numero,
  })
  .strict();
const posicao = z.enum([
  "GOL",
  "LD",
  "ZAG",
  "LE",
  "VOL",
  "MC",
  "MEI",
  "PD",
  "PE",
  "CA",
]);
/** Atributos do Rating Engine — causais na simulação; opcionais p/ saves legados. */
const esquemaAtributosNpc = z
  .object(
    Object.fromEntries(
      Object.keys(NOMES_ATRIBUTOS).map((chave) => [chave, nivel]),
    ) as Record<keyof typeof NOMES_ATRIBUTOS, typeof nivel>,
  )
  .strict();
// Identidade de NPC gerado pertence ao save, não ao catálogo. Prefixo reservado evita
// transformar um jogador Transfermarkt ausente em gerado como fallback silencioso.
const esquemaIdentidadeGerada = z
  .object({
    id: id.refine((v) => v.startsWith("gerado-")),
    nome: z.string().min(1).max(200),
    idExterno: z.literal(0),
    idTransfermarkt: z.literal(""),
    foto: z.literal(""),
    dataNascimento: z.iso.date().nullable(),
    nacionalidade: z.array(z.string().max(100)).max(10),
    posicaoPrincipal: posicao,
    posicoesSecundarias: z.array(posicao).max(10),
    posicao: z.string().max(100),
    grupoPosicao: z.enum(["GOL", "DEF", "MEI", "ATA"]),
    peDominante: z.string().max(100).nullable(),
    altura: numero.nullable(),
    numero: numero.nullable(),
    joinedOn: z.iso.date().nullable(),
    signedFrom: z.string().max(200).nullable(),
  })
  .strict();

export const esquemaNpcDinamico = z
  .object({
    id,
    clubeId: id.nullable(),
    idade: numero.int().min(0).max(150),
    overall: nivel,
    potencial: nivel,
    /** Congela atributos da carreira; ausência = fallback do catálogo na 1ª hidratação. */
    atributos: esquemaAtributosNpc.optional(),
    ratingMetadata: esquemaRatingMetadata.optional(),
    forma: nivel,
    moral: nivel,
    condicionamento: nivel,
    fadiga: nivel,
    valorMercado: numero.nonnegative(),
    salario: numero.nonnegative(),
    contratoAte: z.iso.date().nullable(),
    lesionado: z.boolean(),
    lesao,
    suspensao: numero.int().nonnegative(),
    statusElenco: papel,
    estatisticasCarreira: estatisticas,
  })
  .strict();

export const esquemaClubeDinamico = z
  .object({
    id,
    /** Divisão atual; ausente em saves legados → usa ligaId do catálogo. */
    ligaId: id.optional(),
    formacaoPreferida: z.enum(FORMACOES),
    goleiroTitularId: id.nullable(),
    titularesIds: z.array(id).max(11),
    bancoIds: z.array(id).max(100),
    reputacao: nivel,
    forcaGeral: numero,
    forcaAtaque: numero,
    forcaMeio: numero,
    forcaDefesa: numero,
    orcamento: numero,
    forma: nivel,
    moral: nivel,
    fadiga: nivel,
    elenco: z.array(esquemaNpcDinamico).max(500),
  })
  .strict();

function ligaIdEfetivoClube(
  delta: { id: string; ligaId?: string },
  clubesBase: Map<string, { ligaId: string }>,
): string | undefined {
  return delta.ligaId ?? clubesBase.get(delta.id)?.ligaId;
}

const transferencias = esquemaCarreira.shape.transferenciasRecentes
  .unwrap()
  .element.omit({ nomeJogador: true });
const historicoContratoPersistido = z
  .object({
    clubeId: id,
    salario: numero,
    dataInicio: z.iso.date(),
    dataTermino: z.iso.date(),
    papelEsperado: papel,
    tipo: z.enum(["base", "profissional"]),
    motivoSaida: z.enum([
      "fim_contrato",
      "transferencia",
      "emprestimo",
      "aposentadoria",
    ]),
  })
  .strict();
export const esquemaCarreiraPersistida = esquemaCarreira
  .omit({
    clubes: true,
    liga: true,
    ligas: true,
    versao: true,
    transferenciasRecentes: true,
  })
  .extend({
    versao: z.literal(4),
    id,
    seed: id,
    clubeAtualId: id.nullable(),
    clubeInicialId: id,
    agenteLivreDesde: z.iso.date().nullable().default(null),
    ultimoClubeId: id.nullable().default(null),
    historicoContratos: z.array(historicoContratoPersistido).max(50).default([]),
    ligaId: id,
    ligasIds: z.array(id).min(1).max(100),
    clubesDinamicos: z.array(esquemaClubeDinamico).min(2).max(2000),
    transferenciasRecentes: z.array(transferencias).max(10000),
    jogadoresGerados: z.array(esquemaIdentidadeGerada).max(20000),
    jogador: esquemaCarreira.shape.jogador.extend({
      status: papel,
      contrato: esquemaCarreira.shape.jogador.shape.contrato.extend({
        clubeId: id,
        papelEsperado: papel,
        salario: numero.nonnegative(),
        bonusGol: numero.nonnegative(),
      }),
    }),
  })
  .strict();
export type EstadoCarreiraPersistido = z.infer<
  typeof esquemaCarreiraPersistida
>;
export interface CatalogoCarreira {
  ligas: Liga[];
  clubes: Clube[];
}

export class ErroCompatibilidadeSave extends Error {
  constructor() {
    super(
      "Esta carreira é incompatível com a base de futebol disponível. O save foi preservado no servidor.",
    );
  }
}

/** Rejeita chaves perigosas e profundidade excessiva antes de qualquer spread/parse. */
export function validarEstruturaJson(valor: unknown, profundidade = 0): void {
  if (profundidade > 40) throw new Error("Estrutura de save inválida.");
  if (!valor || typeof valor !== "object") return;
  for (const [chave, item] of Object.entries(valor)) {
    if (["__proto__", "constructor", "prototype"].includes(chave))
      throw new Error("Estrutura de save inválida.");
    validarEstruturaJson(item, profundidade + 1);
  }
}

export function validarCarreiraPersistida(
  valor: unknown,
): EstadoCarreiraPersistido {
  validarEstruturaJson(valor);
  const migrado = migrarDesenvolvimento(migrarMercadoPersistido(valor), true);
  const resultado = esquemaCarreiraPersistida.parse(migrado);
  function conferirEntrada(entrada: unknown, saida: unknown): void {
    if (!entrada || typeof entrada !== "object") return;
    for (const [chave, item] of Object.entries(entrada)) {
      if (item === undefined) continue;
      if (!saida || typeof saida !== "object" || !Object.hasOwn(saida, chave))
        throw new Error("Campo inesperado no save.");
      if (typeof item === "string" && item.length > 10000)
        throw new Error("Texto excessivo no save.");
      if (
        typeof item === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item) &&
        !z.iso.date().safeParse(item).success
      )
        throw new Error("Data inválida no save.");
      conferirEntrada(item, (saida as Record<string, unknown>)[chave]);
    }
  }
  conferirEntrada(migrado, resultado);
  const perfil = resultado.jogador.perfilFormacao;
  if (perfil.origem === "historia") validarEscolhasHistoria(perfil.seed, resultado.identidadeInicial.posicao, perfil.escolhas);
  return resultado;
}

/** Contrato/empréstimo: origem do contrato ≠ clube atual quando há empréstimo. */
export function validarVinculosContratoPersistido(
  p: EstadoCarreiraPersistido,
): void {
  if (p.temporadasExternas[p.ligaId])
    throw new Error("Vínculos do save inválidos.");
  const emprestimo = p.mercado.emprestimo;
  if (p.clubeAtualId === null) {
    // Agente livre: sem empréstimo ativo; contrato pode referenciar o último clube.
    if (emprestimo) throw new Error("Vínculos do save inválidos.");
    if (
      p.ultimoClubeId &&
      p.jogador.contrato.clubeId !== p.ultimoClubeId
    )
      throw new Error("Vínculos do save inválidos.");
    return;
  }
  if (emprestimo) {
    if (emprestimo.clubeOrigemId !== p.jogador.contrato.clubeId)
      throw new Error("Vínculos do save inválidos.");
    if (emprestimo.clubeOrigemId === p.clubeAtualId)
      throw new Error("Vínculos do save inválidos.");
    if (!z.iso.date().safeParse(emprestimo.retornoEm).success)
      throw new Error("Data inválida no save.");
  } else if (p.jogador.contrato.clubeId !== p.clubeAtualId) {
    throw new Error("Vínculos do save inválidos.");
  }
}

/**
 * Validação semântica barata para PUT: IDs, catálogo e relações sem reconstruir o runtime.
 */
export function validarReferenciasCarreiraPersistida(
  p: EstadoCarreiraPersistido,
  catalogo: CatalogoCarreira,
): void {
  const ligasPorId = new Map(catalogo.ligas.map((l) => [l.id, l]));
  for (const id of p.ligasIds) {
    if (!ligasPorId.has(id)) throw new ErroCompatibilidadeSave();
  }
  if (new Set(p.ligasIds).size !== p.ligasIds.length)
    throw new Error("IDs duplicados no save.");
  const clubesBase = new Map(
    catalogo.clubes
      .filter((c) => p.ligasIds.includes(c.ligaId))
      .map((c) => [c.id, c]),
  );
  const idsClubes = new Set<string>();
  const jogadoresBase = new Set(
    catalogo.clubes.flatMap((c) => c.elenco.map((j) => j.id)),
  );
  const gerados = new Set(p.jogadoresGerados.map((j) => j.id));
  if (gerados.size !== p.jogadoresGerados.length)
    throw new Error("IDs gerados duplicados.");
  const jogadoresVistos = new Set<string>();
  for (const delta of p.clubesDinamicos) {
    const base = clubesBase.get(delta.id);
    const ligaEfetiva = ligaIdEfetivoClube(delta, clubesBase);
    if (!base || !ligaEfetiva || !p.ligasIds.includes(ligaEfetiva))
      throw new ErroCompatibilidadeSave();
    if (idsClubes.has(delta.id)) throw new Error("IDs duplicados no save.");
    idsClubes.add(delta.id);
    for (const j of delta.elenco) {
      const conhecido =
        j.id.startsWith("gerado-") ? gerados.has(j.id) : jogadoresBase.has(j.id);
      if (!conhecido || j.clubeId !== delta.id || jogadoresVistos.has(j.id))
        throw new Error("Vínculo de jogador inválido.");
      jogadoresVistos.add(j.id);
    }
  }
  if ([...gerados].some(id => !jogadoresVistos.has(id))) throw new Error("Jogador gerado sem vínculo no save.");
  const exigirClube = (id: string) => {
    if (!idsClubes.has(id)) throw new Error("Referência de clube inválida.");
  };
  if (p.clubeAtualId !== null) exigirClube(p.clubeAtualId);
  exigirClube(p.clubeInicialId);
  exigirClube(p.jogador.contrato.clubeId);
  if (p.ultimoClubeId) exigirClube(p.ultimoClubeId);
  for (const h of p.historicoContratos) exigirClube(h.clubeId);
  if (p.mercado.emprestimo) exigirClube(p.mercado.emprestimo.clubeOrigemId);
  validarVinculosContratoPersistido(p);
  const ligaAtual = ligasPorId.get(p.ligaId);
  if (!ligaAtual) throw new Error("Liga atual inválida.");
  const deltasPorId = new Map(p.clubesDinamicos.map((d) => [d.id, d]));
  const ligaDoClube = (clubeId: string) => {
    const d = deltasPorId.get(clubeId);
    return d ? ligaIdEfetivoClube(d, clubesBase) : clubesBase.get(clubeId)?.ligaId;
  };
  if (p.clubeAtualId !== null) {
    if (ligaDoClube(p.clubeAtualId) !== p.ligaId)
      throw new Error("Liga atual inválida.");
  } else {
    const refId = p.ultimoClubeId;
    const refLiga = refId ? ligaDoClube(refId) : undefined;
    if (refLiga && refLiga !== p.ligaId && !p.ligasIds.includes(refLiga))
      throw new Error("Liga atual inválida.");
  }
  for (const ligaId of p.ligasIds) {
    const qtd = p.clubesDinamicos.filter(
      (c) => ligaIdEfetivoClube(c, clubesBase) === ligaId,
    ).length;
    if (qtd < 2 || (ligaId !== p.ligaId && !p.temporadasExternas[ligaId]))
      throw new Error("Universo incompleto.");
  }
  for (const [ligaId, temporada] of [[p.ligaId,p.temporada],...Object.entries(p.temporadasExternas)] as const) {
    if (!p.ligasIds.includes(ligaId)) throw new Error("Temporada inválida.");
    for (const jogo of [...temporada.partidas,...temporada.partidasBase]) {
      exigirClube(jogo.mandanteId); exigirClube(jogo.visitanteId);
      if ([jogo.mandanteId,jogo.visitanteId].some(id => ligaDoClube(id) !== ligaId)) throw new Error("Partida de outra liga.");
    }
    for (const linha of [...temporada.classificacao,...temporada.classificacaoBase]) exigirClube(linha.clubeId);
  }
  for (const temporada of p.temporadasAnteriores) {
    exigirClube(temporada.campeaoId); exigirClube(temporada.campeaoBaseId);
    for (const linha of [...temporada.classificacao,...temporada.classificacaoBase]) exigirClube(linha.clubeId);
  }
  for (const conversa of p.acompanhamento.conversas) exigirClube(conversa.clubeId);
  for (const pedido of p.acompanhamento.pedidosContrato) exigirClube(pedido.clubeId);
  if (p.acompanhamento.promessa) exigirClube(p.acompanhamento.promessa.clubeId);
  if (p.acompanhamento.adaptacao) exigirClube(p.acompanhamento.adaptacao.clubeId);
  if (p.acompanhamento.papelAceito) exigirClube(p.acompanhamento.papelAceito.clubeId);
  for (const proposta of p.propostas) {
    exigirClube(proposta.clubeId);
    if (proposta.clubeOrigemId) exigirClube(proposta.clubeOrigemId);
  }
  for (const interesse of p.mercado.interesses) exigirClube(interesse.clubeId);
  p.mercado.clubesDesejados.forEach(exigirClube);
  for (const registro of p.registros) exigirClube(registro.clubeId);
  for (const t of p.transferenciasRecentes) {
    exigirClube(t.deClubeId);
    exigirClube(t.paraClubeId);
  }
}

export function serializarCarreira(
  c: EstadoCarreira,
): EstadoCarreiraPersistido {
  const {
    clubes,
    liga,
    ligas,
    versao: _versao,
    transferenciasRecentes,
    ...estado
  } = c;
  return validarCarreiraPersistida({
    ...estado,
    versao: 4,
    ligaId: liga.id,
    ligasIds: ligas.map((l) => l.id),
    jogadoresGerados: clubes
      .flatMap((c) => c.elenco)
      .filter((j) => j.id.startsWith("gerado-"))
      .map((j) => ({
        id: j.id,
        nome: j.nome,
        idExterno: j.idExterno,
        idTransfermarkt: j.idTransfermarkt,
        foto: j.foto,
        dataNascimento: j.dataNascimento,
        nacionalidade: j.nacionalidade,
        posicaoPrincipal: j.posicaoPrincipal,
        posicoesSecundarias: j.posicoesSecundarias,
        posicao: j.posicao,
        grupoPosicao: j.grupoPosicao,
        peDominante: j.peDominante,
        altura: j.altura,
        numero: j.numero,
        joinedOn: j.joinedOn,
        signedFrom: j.signedFrom,
      })),
    clubesDinamicos: clubes.map((cl) => ({
      id: cl.id,
      ligaId: cl.ligaId,
      formacaoPreferida: cl.formacaoPreferida,
      goleiroTitularId: cl.goleiroTitularId,
      titularesIds: cl.titularesIds,
      bancoIds: cl.bancoIds,
      reputacao: cl.reputacao,
      forcaGeral: cl.forcaGeral,
      forcaAtaque: cl.forcaAtaque,
      forcaMeio: cl.forcaMeio,
      forcaDefesa: cl.forcaDefesa,
      orcamento: cl.orcamento,
      forma: cl.forma,
      moral: cl.moral,
      fadiga: cl.fadiga,
      elenco: cl.elenco.map((j) => ({
        id: j.id,
        clubeId: j.clubeId,
        idade: j.idade,
        overall: j.overall,
        potencial: j.potencial,
        ...(j.atributos ? { atributos: j.atributos } : {}),
        ...(j.ratingMetadata
          ? {
              ratingMetadata:
                normalizarRatingMetadata(j.ratingMetadata) ?? undefined,
            }
          : {}),
        forma: j.forma,
        moral: j.moral,
        condicionamento: j.condicionamento,
        fadiga: j.fadiga,
        valorMercado: j.valorMercado,
        salario: j.salario,
        contratoAte: j.contratoAte,
        lesionado: j.lesionado,
        lesao: j.lesao,
        suspensao: j.suspensao,
        statusElenco: j.statusElenco,
        estatisticasCarreira: j.estatisticasCarreira,
      })),
    })),
    transferenciasRecentes: transferenciasRecentes.map(
      ({ nomeJogador: _nome, ...t }) => t,
    ),
  });
}

export function hidratarCarreira(
  valor: unknown,
  catalogo: CatalogoCarreira,
): EstadoCarreira {
  const p = validarCarreiraPersistida(valor);
  const ligasPorId = new Map(catalogo.ligas.map((l) => [l.id, l]));
  const ligas = p.ligasIds.map((id) => {
    const l = ligasPorId.get(id);
    if (!l) throw new ErroCompatibilidadeSave();
    return l;
  });
  const clubesBase = new Map<string, Clube>();
  const jogadoresBase = new Map<string, JogadorMundo>();
  for (const l of catalogo.ligas) {
    for (const cl of prepararClubesParaMundo(
      catalogo.clubes.filter((c) => c.ligaId === l.id),
      l,
    )) {
      clubesBase.set(cl.id, cl);
      for (const j of cl.elenco) jogadoresBase.set(j.id, j);
    }
  }
  const vistos = new Set<string>();
  const gerados = new Map(p.jogadoresGerados.map((j) => [j.id, j]));
  if (gerados.size !== p.jogadoresGerados.length)
    throw new Error("IDs gerados duplicados.");
  const clubes = p.clubesDinamicos.map((delta) => {
    const base = clubesBase.get(delta.id);
    const ligaEfetiva = delta.ligaId ?? base?.ligaId;
    if (!base || !ligaEfetiva || !p.ligasIds.includes(ligaEfetiva))
      throw new ErroCompatibilidadeSave();
    const elenco = delta.elenco.map((j) => {
      const cadastro = j.id.startsWith("gerado-")
        ? gerados.get(j.id)
        : jogadoresBase.get(j.id);
      if (!cadastro) throw new ErroCompatibilidadeSave();
      if (vistos.has(j.id) || j.clubeId !== delta.id)
        throw new Error("Vínculo de jogador inválido.");
      vistos.add(j.id);
      // Delta do save sobrescreve o catálogo. Atributos ausentes no save legado
      // caem no catálogo só nesta hidratação; o próximo serialize congela.
      return { ...cadastro, ...j };
    });
    return {
      ...base,
      ...delta,
      ligaId: ligaEfetiva,
      elenco,
      tamanhoElenco: elenco.length,
    };
  });
  const idsClubes = new Set(clubes.map((c) => c.id));
  if ([...gerados.keys()].some((id) => !vistos.has(id)))
    throw new Error("Jogador gerado sem vínculo no save.");
  if (
    idsClubes.size !== clubes.length ||
    new Set(p.ligasIds).size !== ligas.length
  )
    throw new Error("IDs duplicados no save.");
  const liga = ligas.find((l) => l.id === p.ligaId);
  if (!liga) throw new Error("Liga atual inválida.");
  if (p.clubeAtualId !== null) {
    if (clubes.find((c) => c.id === p.clubeAtualId)?.ligaId !== liga.id)
      throw new Error("Liga atual inválida.");
  } else {
    const refId = p.ultimoClubeId;
    const ref = refId ? clubes.find((c) => c.id === refId) : undefined;
    if (ref && ref.ligaId !== liga.id && !p.ligasIds.includes(ref.ligaId))
      throw new Error("Liga atual inválida.");
  }
  const exigirClube = (id: string) => {
    if (!idsClubes.has(id)) throw new Error("Referência de clube inválida.");
  };
  exigirClube(p.clubeInicialId);
  exigirClube(p.jogador.contrato.clubeId);
  if (p.ultimoClubeId) exigirClube(p.ultimoClubeId);
  for (const h of p.historicoContratos) exigirClube(h.clubeId);
  if (p.mercado.emprestimo) exigirClube(p.mercado.emprestimo.clubeOrigemId);
  validarVinculosContratoPersistido(p);
  for (const l of ligas) {
    if (
      clubes.filter((c) => c.ligaId === l.id).length < 2 ||
      (l.id !== p.ligaId && !p.temporadasExternas[l.id])
    )
      throw new Error("Universo incompleto.");
  }
  for (const [ligaId, temporada] of [
    [p.ligaId, p.temporada],
    ...Object.entries(p.temporadasExternas),
  ] as const) {
    if (!p.ligasIds.includes(ligaId)) throw new Error("Temporada inválida.");
    for (const jogo of [...temporada.partidas, ...temporada.partidasBase]) {
      exigirClube(jogo.mandanteId);
      exigirClube(jogo.visitanteId);
      if (
        [jogo.mandanteId, jogo.visitanteId].some(
          (id) => clubes.find((c) => c.id === id)?.ligaId !== ligaId,
        )
      )
        throw new Error("Partida de outra liga.");
    }
    for (const linha of [
      ...temporada.classificacao,
      ...temporada.classificacaoBase,
    ])
      exigirClube(linha.clubeId);
  }
  for (const proposta of p.propostas) {
    exigirClube(proposta.clubeId);
    if (proposta.clubeOrigemId) exigirClube(proposta.clubeOrigemId);
  }
  for (const interesse of p.mercado.interesses) exigirClube(interesse.clubeId);
  p.mercado.clubesDesejados.forEach(exigirClube);
  for (const registro of p.registros) exigirClube(registro.clubeId);
  for (const temporada of p.temporadasAnteriores) {
    exigirClube(temporada.campeaoId);
    exigirClube(temporada.campeaoBaseId);
    for (const linha of [
      ...temporada.classificacao,
      ...temporada.classificacaoBase,
    ])
      exigirClube(linha.clubeId);
  }
  const transferenciasRecentes = p.transferenciasRecentes.map((t) => {
    exigirClube(t.deClubeId);
    exigirClube(t.paraClubeId);
    const nomeJogador =
      t.jogadorId === "usuario"
        ? `${p.jogador.nome} ${p.jogador.sobrenome}`
        : (jogadoresBase.get(t.jogadorId) ?? gerados.get(t.jogadorId))?.nome;
    if (!nomeJogador) throw new ErroCompatibilidadeSave();
    return { ...t, nomeJogador };
  });
  const {
    clubesDinamicos: _c,
    ligasIds: _l,
    ligaId: _id,
    jogadoresGerados: _g,
    ...resto
  } = p;
  return validarSave({
    ...resto,
    versao: 2,
    clubes,
    liga,
    ligas,
    transferenciasRecentes,
  });
}
