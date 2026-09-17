import { z } from "zod";
import { criarMercado } from "@/dominio/mercado";
const numero = z.number().finite().nonnegative();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const papel = z.enum([
  "categoria de base",
  "promessa",
  "reserva",
  "rotacao",
  "titular",
  "jogador importante",
  "estrela do time",
]);
export const esquemaTermos = z.object({
  salario: numero.positive(),
  duracaoAnos: numero.int().min(1).max(5),
  papelPrometido: papel,
  clausulaRescisao: numero.positive().optional(),
});
export const camposProposta = {
  valorTransferencia: numero.optional(),
  clubeOrigemId: z.string().optional(),
  rodadasNegociacao: numero.int().max(3).optional(),
  ofertaInicial: esquemaTermos.optional(),
  contrapropostaPendente: esquemaTermos.optional(),
  responderEm: data.optional(),
  clausulaRescisao: numero.optional(),
  bonusGol: numero.optional(),
  luvas: numero.optional(),
  preContrato: z.boolean().optional(),
  acordoFuturo: z.boolean().optional(),
  efetivarEm: data.optional(),
  percentualSalario: numero.max(1).optional(),
};
export const esquemaMercado = z
  .object({
    interesses: z.array(
      z.object({
        clubeId: z.string(),
        jogadorId: z.literal("usuario"),
        nivelInteresse: numero.max(100),
        motivo: z.enum([
          "reforco",
          "promessa",
          "sucessao",
          "lesao",
          "oportunidade",
        ]),
        semanasObservando: numero.int(),
        status: z.enum([
          "observando",
          "interessado",
          "sondagem",
          "negociando",
          "encerrado",
        ]),
        ultimaAtualizacao: data,
        origem: z.enum(["clube", "agente"]),
        resposta: z.string(),
        papel,
        reabrirEm: data.optional(),
        ofertaClube: numero.optional(),
        rodadasClube: numero.int().optional(),
        propostaId: z.string().optional(),
      }),
    ),
    clubesDesejados: z.array(z.string()),
    preferencias: z.object({
      mesmoPais: z.boolean(),
      europa: z.boolean(),
      clubeMaior: z.boolean(),
      maisMinutos: z.boolean(),
      salarioMaior: z.boolean(),
      titulos: z.boolean(),
      apenasDesejados: z.boolean(),
    }),
    pediuSaida: z.boolean(),
    statusPedidoSaida: z
      .enum(["nenhum", "aceito", "recusado"])
      .default("nenhum"),
    pedidoPublico: z.boolean(),
    bloquearPropostas: z.boolean().default(false),
    pediuEmprestimo: z.boolean().default(false),
    disponivelParaEmprestimo: z.boolean().default(false),
    respostaDiretoriaSaida: z.string().optional(),
    respostaDiretoriaEmprestimo: z.string().optional(),
    respostaSaidaLida: z.boolean().default(true),
    respostaEmprestimoLida: z.boolean().default(true),
    emprestimo: z
      .object({
        clubeOrigemId: z.string(),
        retornoEm: data,
        percentualSalario: numero.max(1),
      })
      .optional(),
    ultimaCobrancaPapel: data.optional(),
    historico: z.array(
      z.object({
        id: z.string(),
        data,
        clubeId: z.string(),
        texto: z.string(),
        propostaId: z.string().optional(),
        termos: esquemaTermos.optional(),
      }),
    ),
  })
  .default(criarMercado);
