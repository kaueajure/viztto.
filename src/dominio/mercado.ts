import type { StatusElenco } from "./entidades/modelos";

export const PAPEIS_MERCADO: StatusElenco[] = [
  "promessa",
  "reserva",
  "rotacao",
  "titular",
  "jogador importante",
  "estrela do time",
];
export const PREFERENCIAS_CARREIRA = {
  mesmoPais: "Quero permanecer no país",
  europa: "Quero jogar na Europa",
  clubeMaior: "Quero um clube maior",
  maisMinutos: "Quero mais minutos",
  salarioMaior: "Quero salário maior",
  titulos: "Quero disputar títulos",
  apenasDesejados: "Quero apenas os clubes escolhidos",
};
export type PreferenciasCarreira = Record<
  keyof typeof PREFERENCIAS_CARREIRA,
  boolean
>;
export type MotivoInteresse =
  "reforco" | "promessa" | "sucessao" | "lesao" | "oportunidade";
export interface InteresseClube {
  clubeId: string;
  jogadorId: "usuario";
  nivelInteresse: number;
  motivo: MotivoInteresse;
  semanasObservando: number;
  status:
    "observando" | "interessado" | "sondagem" | "negociando" | "encerrado";
  ultimaAtualizacao: string;
  origem: "clube" | "agente";
  resposta: string;
  papel: StatusElenco;
  reabrirEm?: string;
  ofertaClube?: number;
  rodadasClube?: number;
  propostaId?: string;
}
export interface TermosContrato {
  salario: number;
  duracaoAnos: number;
  papelPrometido: StatusElenco;
  clausulaRescisao?: number;
}
export interface HistoricoNegociacao {
  id: string;
  data: string;
  clubeId: string;
  texto: string;
  propostaId?: string;
  termos?: TermosContrato;
}
export interface EmprestimoAtivo {
  clubeOrigemId: string;
  retornoEm: string;
  percentualSalario: number;
}
export type StatusPedidoSaida = "nenhum" | "aceito" | "recusado";
export interface MercadoCarreira {
  interesses: InteresseClube[];
  clubesDesejados: string[];
  preferencias: PreferenciasCarreira;
  /** true somente quando a diretoria aceitou negociar / colocar à venda */
  pediuSaida: boolean;
  statusPedidoSaida: StatusPedidoSaida;
  pedidoPublico: boolean;
  bloquearPropostas: boolean;
  pediuEmprestimo: boolean;
  disponivelParaEmprestimo: boolean;
  respostaDiretoriaSaida?: string;
  respostaDiretoriaEmprestimo?: string;
  emprestimo?: EmprestimoAtivo;
  historico: HistoricoNegociacao[];
  ultimaCobrancaPapel?: string;
}
export function criarMercado(): MercadoCarreira {
  return {
    interesses: [],
    clubesDesejados: [],
    preferencias: {
      mesmoPais: false,
      europa: false,
      clubeMaior: false,
      maisMinutos: false,
      salarioMaior: false,
      titulos: false,
      apenasDesejados: false,
    },
    pediuSaida: false,
    statusPedidoSaida: "nenhum",
    pedidoPublico: false,
    bloquearPropostas: false,
    pediuEmprestimo: false,
    disponivelParaEmprestimo: false,
    historico: [],
  };
}
