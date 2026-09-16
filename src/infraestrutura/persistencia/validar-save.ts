import { z } from "zod";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { esquemaIdentidade } from "@/dominio/regras/jogador";
import { esquemaClube } from "@/infraestrutura/api-futebol/esquemas";
const numero = z.number().finite(),
  data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  texto = z.string();
const atributos = z.object(
  Object.fromEntries(
    Object.keys(NOMES_ATRIBUTOS).map((chave) => [chave, numero]),
  ),
);
const categoria = z.enum(["base", "profissional"]);
const contrato = z.object({
  clubeId: texto,
  salario: numero,
  dataInicio: data,
  dataTermino: data,
  papelEsperado: texto,
  tipo: categoria,
  bonusGol: numero,
});
const estatisticas = z.object({
  jogos: numero,
  titularidades: numero,
  minutos: numero,
  gols: numero,
  assistencias: numero,
  amarelos: numero,
  vermelhos: numero,
  somaNotas: numero,
});
const classificacao = z.array(
  z.object({
    clubeId: texto,
    jogos: numero,
    pontos: numero,
    vitorias: numero,
    empates: numero,
    derrotas: numero,
    golsPro: numero,
    golsContra: numero,
    saldo: numero,
    posicao: numero,
  }),
);
const evento = z.object({
  id: texto,
  data,
  tipo: texto,
  titulo: texto,
  texto,
  remetente: texto,
  lida: z.boolean(),
});
const participacao = z.object({
  escalacao: texto,
  entrada: numero,
  saida: numero,
  minutos: numero,
  gols: numero,
  assistencias: numero,
  chutes: numero,
  passes: numero,
  passesChave: numero,
  desarmes: numero,
  amarelos: numero,
  vermelhos: numero,
  faltas: numero,
  defesas: numero,
  nota: numero.nullable(),
  confianca: numero,
  moral: numero,
  desenvolvimento: numero,
});
const partidas = z.array(
  z.object({
    id: texto,
    rodada: numero,
    data,
    mandanteId: texto,
    visitanteId: texto,
    categoria,
    golsMandante: numero.nullable(),
    golsVisitante: numero.nullable(),
    eventos: z.array(
      z.object({
        minuto: numero,
        tipo: texto,
        clubeId: texto,
        texto,
        jogador: z.boolean(),
      }),
    ),
    participacao: participacao.nullable(),
  }),
);
const esquemaCarreira = z.object({
  versao: z.literal(1),
  id: texto,
  seed: texto,
  estadoAleatorio: numero,
  dataAtual: data,
  dataInicio: data,
  identidadeInicial: esquemaIdentidade,
  clubeInicialId: texto,
  clubeAtualId: texto,
  origem: z.enum(["api", "demonstracao"]),
  clubes: z.array(esquemaClube).min(2),
  liga: z.object({
    id: texto,
    idExterno: numero,
    nome: texto,
    pais: texto,
    bandeira: texto,
    reputacao: numero,
    forcaMedia: numero,
    quantidadeClubes: numero,
    regras: z.object({
      pontosVitoria: numero,
      pontosEmpate: numero,
      amarelosSuspensao: numero,
    }),
  }),
  jogador: esquemaIdentidade.extend({
    idade: numero.min(15),
    atributos,
    desenvolvimento: atributos,
    overall: numero,
    potencialInterno: numero,
    personalidade: z.object({
      profissionalismo: numero,
      ambicao: numero,
      lealdade: numero,
      disciplina: numero,
      temperamento: numero,
      adaptabilidade: numero,
      lideranca: numero,
    }),
    categoria,
    status: texto,
    moral: numero,
    forma: numero,
    condicionamento: numero,
    fadiga: numero,
    ritmo: numero,
    confianca: numero,
    reputacao: numero,
    valorMercado: numero,
    contrato,
    lesao: z
      .object({
        tipo: texto,
        gravidade: texto,
        diasRecuperacao: numero,
        dataInicio: data,
        dataPrevistaRetorno: data,
      })
      .nullable(),
    suspensao: numero,
    amarelosAcumulados: numero,
    notasRecentes: z.array(numero),
  }),
  temporada: z.object({
    ano: numero,
    rodadaAtual: numero,
    totalRodadas: numero,
    partidas,
    partidasBase: partidas,
    classificacao,
    classificacaoBase: classificacao,
    encerrada: z.boolean(),
  }),
  focoTreino: z.enum([
    "equilibrado",
    "finalizacao",
    "criacao",
    "drible",
    "velocidade",
    "fisico",
    "defesa",
    "recuperacao",
  ]),
  propostas: z.array(
    z.object({
      id: texto,
      clubeId: texto,
      tipo: z.enum(["transferencia", "renovacao"]),
      salario: numero,
      duracaoAnos: numero,
      data,
      validade: data,
      status: z.enum(["pendente", "aceita", "rejeitada", "expirada"]),
    }),
  ),
  noticias: z.array(evento),
  eventos: z.array(evento),
  objetivos: z.array(
    z.object({
      id: texto,
      titulo: texto,
      meta: numero,
      progresso: numero,
      concluido: z.boolean(),
    }),
  ),
  registros: z.array(
    z.object({
      ano: numero,
      clubeId: texto,
      competicao: texto,
      categoria,
      estatisticas,
    }),
  ),
  temporadasAnteriores: z.array(
    z.object({
      ano: numero,
      campeaoId: texto,
      campeaoBaseId: texto,
      classificacao,
      classificacaoBase: classificacao,
    }),
  ),
  ultimaPartidaId: texto.nullable(),
});
export function validarSave(valor: unknown): EstadoCarreira {
  const resultado = esquemaCarreira.safeParse(valor);
  if (!resultado.success)
    throw new Error("O save está incompleto ou incompatível.");
  const c = resultado.data,
    ids = new Set(c.clubes.map((clube) => clube.id));
  if (
    !ids.has(c.clubeAtualId) ||
    !ids.has(c.clubeInicialId) ||
    c.temporada.partidas.some(
      (p) => !ids.has(p.mandanteId) || !ids.has(p.visitanteId),
    )
  )
    throw new Error("Os clubes do save são inválidos.");
  // A validação garante a estrutura completa antes da fronteira de domínio.
  return resultado.data as EstadoCarreira;
}
