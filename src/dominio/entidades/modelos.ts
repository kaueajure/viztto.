import type { PerfilFormacao, PreparacaoJogador, AcompanhamentoCarreira } from "../desenvolvimento";
import type { MercadoCarreira, TermosContrato } from "../mercado";
export type Posicao =
  "GOL" | "LD" | "ZAG" | "LE" | "VOL" | "MC" | "MEI" | "PD" | "PE" | "CA";
export type FocoTreino =
  | "equilibrado"
  | "finalizacao"
  | "criacao"
  | "drible"
  | "velocidade"
  | "fisico"
  | "defesa"
  | "recuperacao";
export type StatusElenco =
  | "categoria de base"
  | "promessa"
  | "reserva"
  | "rotacao"
  | "titular"
  | "jogador importante"
  | "estrela do time";
export type Escalacao =
  "titular" | "banco" | "nao relacionado" | "lesionado" | "suspenso";
export type Categoria = "base" | "profissional";
import type { Formacao, GrupoPosicao } from "@/dominio/formacao";

export interface Liga {
  divisao: number;
  id: string;
  idTransfermarkt: string;
  termoBusca: string;
  nome: string;
  pais: string;
  bandeira: string;
  reputacao: number;
  forcaMedia: number;
  quantidadeClubes: number;
  regras: {
    pontosVitoria: number;
    pontosEmpate: number;
    amarelosSuspensao: number;
  };
}
export interface JogadorExterno {
  id: string;
  idExterno: number;
  idTransfermarkt: string;
  nome: string;
  idade: number | null;
  numero: number | null;
  posicao: string;
  grupoPosicao: GrupoPosicao;
  nacionalidade: string[];
  altura: number | null;
  peDominante: string | null;
  valorMercado: number | null;
  dataNascimento: string | null;
  contratoAte: string | null;
  joinedOn: string | null;
  signedFrom: string | null;
  foto: string;
}
export interface EstatisticasJogador {
  jogos: number;
  titularidades: number;
  minutos: number;
  gols: number;
  assistencias: number;
  amarelos: number;
  vermelhos: number;
  somaNotas: number;
}
/** Jogador NPC persistente no universo do viztto (snapshot pós-importação). */
export interface JogadorMundo {
  id: string;
  idExterno: number;
  idTransfermarkt: string;
  nome: string;
  dataNascimento: string | null;
  idade: number;
  nacionalidade: string[];
  posicaoPrincipal: Posicao;
  posicoesSecundarias: Posicao[];
  /** Texto original da API (compatibilidade de formação). */
  posicao: string;
  grupoPosicao: GrupoPosicao;
  peDominante: string | null;
  altura: number | null;
  numero: number | null;
  clubeId: string | null;
  overall: number;
  potencial: number;
  /** Atributos detalhados do Rating Engine (opcional; saves antigos sem isso). */
  atributos?: Atributos;
  ratingMetadata?: {
    source: string;
    confidence: string;
    minutes?: number;
    appearances?: number;
    season?: string;
  };
  forma: number;
  moral: number;
  condicionamento: number;
  fadiga: number;
  valorMercado: number;
  salario: number;
  contratoAte: string | null;
  joinedOn: string | null;
  signedFrom: string | null;
  foto: string;
  lesionado: boolean;
  lesao: Lesao | null;
  suspensao: number;
  statusElenco: StatusElenco;
  estatisticasCarreira: EstatisticasJogador;
}
export type EstiloTatico = "posse" | "direto" | "equilibrado" | "contra-ataque";
export interface Treinador {
  id: string;
  nome: string;
  formacaoPreferida: Formacao;
  estilo: EstiloTatico;
  preferenciaJovens: number;
  disciplina: number;
  rotacao: number;
  paciencia: number;
}
export interface SlotEscalacao {
  slot: import("@/dominio/formacao").SlotFormacao;
  jogadorId: string;
  adequacao: number;
}
export interface RelacionamentosJogador {
  treinador: number;
  diretoria: number;
  agente: number;
}
export interface OpcaoDecisao {
  id: string;
  rotulo: string;
}
export interface DecisaoPendente {
  id: string;
  data: string;
  tipo: string;
  remetente: EventoCarreira["remetente"];
  titulo: string;
  texto: string;
  opcoes: OpcaoDecisao[];
  resolvida: boolean;
  opcaoEscolhida?: string;
}
export type EtapaTransferencia =
  | "interesse"
  | "sondagem"
  | "proposta_clube"
  | "negociacao"
  | "acordo"
  | "acordo_futuro"
  | "proposta_jogador"
  | "aceite"
  | "rejeicao"
  | "concluida"
  | "cancelada";
export interface TransferenciaMundial {
  id: string;
  jogadorId: string;
  nomeJogador: string;
  deClubeId: string;
  paraClubeId: string;
  valor: number;
  salario: number;
  duracaoAnos: number;
  papelPrometido: StatusElenco;
  etapa: EtapaTransferencia;
  data: string;
  aoUsuario: boolean;
}
export type JanelaTransferencias = "fechada" | "verao" | "inverno";
export interface Clube {
  id: string;
  idExterno: number;
  idTransfermarkt: string;
  ligaId: string;
  nome: string;
  nomeCurto: string;
  nomeOficial: string | null;
  codigo: string;
  pais: string;
  fundacao: number | null;
  escudo: string;
  estadio: string;
  capacidadeEstadio: number | null;
  tamanhoElenco: number | null;
  idadeMedia: number | null;
  valorElenco: number | null;
  registroTransferencias: number | null;
  formacaoPreferida: Formacao;
  goleiroTitularId: string | null;
  titularesIds: string[];
  bancoIds: string[];
  treinador: Treinador;
  reputacao: number;
  forcaGeral: number;
  forcaAtaque: number;
  forcaMeio: number;
  forcaDefesa: number;
  qualidadeBase: number;
  poderFinanceiro: number;
  orcamento: number;
  forma: number;
  moral: number;
  fadiga: number;
  elenco: JogadorMundo[];
  /** Snapshot útil para expansões futuras (PostgreSQL / detalhes). */
  dadosBrutos: Record<string, unknown> | null;
}
export const NOMES_ATRIBUTOS = {
  finalizacao: "Finalização",
  passeCurto: "Passe curto",
  passeLongo: "Passe longo",
  cruzamento: "Cruzamento",
  drible: "Drible",
  dominio: "Domínio",
  cabeceio: "Cabeceio",
  desarme: "Desarme",
  marcacao: "Marcação",
  aceleracao: "Aceleração",
  velocidade: "Velocidade",
  forca: "Força",
  resistencia: "Resistência",
  impulsao: "Impulsão",
  agilidade: "Agilidade",
  visao: "Visão",
  posicionamento: "Posicionamento",
  compostura: "Compostura",
  decisao: "Decisão",
  antecipacao: "Antecipação",
  concentracao: "Concentração",
  agressividade: "Agressividade",
  reflexos: "Reflexos",
  posicionamentoGoleiro: "Posicionamento (GOL)",
  defesaGoleiro: "Defesa (GOL)",
  saida: "Saída",
  reposicao: "Reposição",
} as const;
export type Atributo = keyof typeof NOMES_ATRIBUTOS;
export type Atributos = Record<Atributo, number>;
export interface Personalidade {
  profissionalismo: number;
  ambicao: number;
  lealdade: number;
  disciplina: number;
  temperamento: number;
  adaptabilidade: number;
  lideranca: number;
}
export interface Lesao {
  tipo: string;
  gravidade: "leve" | "moderada" | "grave";
  diasRecuperacao: number;
  dataInicio: string;
  dataPrevistaRetorno: string;
}
export interface Contrato {
  clubeId: string;
  salario: number;
  dataInicio: string;
  dataTermino: string;
  papelEsperado: StatusElenco;
  tipo: "base" | "profissional";
  bonusGol: number;
  clausulaRescisao?: number;
  luvas?: number;
}
/** Contrato encerrado preservado no histórico da carreira. */
export interface HistoricoContrato {
  clubeId: string;
  salario: number;
  dataInicio: string;
  dataTermino: string;
  papelEsperado: StatusElenco;
  tipo: "base" | "profissional";
  motivoSaida: "fim_contrato" | "transferencia" | "emprestimo" | "aposentadoria";
}
export interface IdentidadeJogador {
  nome: string;
  sobrenome: string;
  nacionalidade: string;
  idade: number;
  posicao: Posicao;
  posicaoSecundaria: Posicao | "";
  peDominante: "direito" | "esquerdo" | "ambos";
  altura: number;
  peso: number;
  arquetipo:
    | "artilheiro"
    | "criador"
    | "velocista"
    | "marcador"
    | "equilibrado"
    | "paredao";
}
export interface Jogador extends IdentidadeJogador {
  perfilFormacao: PerfilFormacao;
  preparacao: PreparacaoJogador;
  atributos: Atributos;
  desenvolvimento: Atributos;
  overall: number;
  potencialInterno: number;
  personalidade: Personalidade;
  categoria: Categoria;
  status: StatusElenco;
  moral: number;
  forma: number;
  condicionamento: number;
  fadiga: number;
  ritmo: number;
  confianca: number;
  reputacao: number;
  valorMercado: number;
  contrato: Contrato;
  lesao: Lesao | null;
  suspensao: number;
  amarelosAcumulados: number;
  notasRecentes: number[];
}
export interface Participacao {
  escalacao: Escalacao;
  entrada: number;
  saida: number;
  minutos: number;
  gols: number;
  assistencias: number;
  chutes: number;
  passes: number;
  passesChave: number;
  desarmes: number;
  amarelos: number;
  vermelhos: number;
  faltas: number;
  defesas: number;
  nota: number | null;
  confianca: number;
  moral: number;
  desenvolvimento: number;
}
export interface EventoPartida {
  minuto: number;
  tipo: "gol" | "cartao" | "defesa" | "substituicao" | "fim";
  clubeId: string;
  texto: string;
  jogador: boolean;
}
export interface Partida {
  id: string;
  rodada: number;
  data: string;
  mandanteId: string;
  visitanteId: string;
  categoria: Categoria;
  golsMandante: number | null;
  golsVisitante: number | null;
  eventos: EventoPartida[];
  participacao: Participacao | null;
}
export interface LinhaClassificacao {
  clubeId: string;
  jogos: number;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
  posicao: number;
}
export interface Estatisticas {
  jogos: number;
  titularidades: number;
  minutos: number;
  gols: number;
  assistencias: number;
  amarelos: number;
  vermelhos: number;
  somaNotas: number;
}
export interface RegistroTemporada {
  ano: number;
  clubeId: string;
  competicao: string;
  categoria: Categoria;
  estatisticas: Estatisticas;
}
export interface Temporada {
  ano: number;
  rodadaAtual: number;
  totalRodadas: number;
  partidas: Partida[];
  partidasBase: Partida[];
  classificacao: LinhaClassificacao[];
  classificacaoBase: LinhaClassificacao[];
  encerrada: boolean;
}
export interface PropostaTransferencia {
  valorTransferencia?: number;
  clubeOrigemId?: string;
  rodadasNegociacao?: number;
  ofertaInicial?: TermosContrato;
  contrapropostaPendente?: TermosContrato;
  responderEm?: string;
  clausulaRescisao?: number;
  bonusGol?: number;
  luvas?: number;
  preContrato?: boolean;
  /** Acordo fechado fora da janela; transferência só na data prevista. */
  acordoFuturo?: boolean;
  efetivarEm?: string;
  percentualSalario?: number;
  id: string;
  clubeId: string;
  tipo: "transferencia" | "renovacao" | "emprestimo";
  salario: number;
  duracaoAnos: number;
  papelPrometido: StatusElenco;
  etapa: EtapaTransferencia;
  data: string;
  validade: string;
  status: "pendente" | "aceita" | "rejeitada" | "expirada";
}
export interface EventoCarreira {
  id: string;
  data: string;
  tipo: string;
  titulo: string;
  texto: string;
  remetente:
    "Treinador" | "Diretoria" | "Agente" | "Departamento médico" | "Imprensa";
  lida: boolean;
}
export interface Objetivo {
  id: string;
  titulo: string;
  meta: number;
  progresso: number;
  concluido: boolean;
}
export interface TemporadaArquivada {
  ano: number;
  campeaoId: string;
  campeaoBaseId: string;
  ligaId?: string;
  classificacao: LinhaClassificacao[];
  classificacaoBase: LinhaClassificacao[];
}
export interface EstadoCarreira {
  acompanhamento: AcompanhamentoCarreira;
  versao: 2;
  id: string;
  seed: string;
  estadoAleatorio: number;
  dataAtual: string;
  dataInicio: string;
  identidadeInicial: IdentidadeJogador;
  clubeInicialId: string;
  jogador: Jogador;
  /** null = agente livre / sem clube. */
  clubeAtualId: string | null;
  /** Data em que ficou sem clube; null quando vinculado. */
  agenteLivreDesde: string | null;
  /** Último clube antes de ficar livre (UI / histórico). */
  ultimoClubeId: string | null;
  /** Contratos encerrados (fim de vínculo, transferência etc.). */
  historicoContratos: HistoricoContrato[];
  /** Liga principal do jogador (atalho). */
  liga: Liga;
  /** Todas as ligas ativas no mundo desta carreira. */
  ligas: Liga[];
  clubes: Clube[];
  origem: "api" | "demonstracao";
  temporada: Temporada;
  /** Temporadas de ligas externas (simulação intermediária). */
  temporadasExternas: Record<string, Temporada>;
  focoTreino: FocoTreino;
  mercado: MercadoCarreira;
  propostas: PropostaTransferencia[];
  transferenciasRecentes: TransferenciaMundial[];
  janelaTransferencias: JanelaTransferencias;
  relacionamentos: RelacionamentosJogador;
  decisoes: DecisaoPendente[];
  noticias: EventoCarreira[];
  eventos: EventoCarreira[];
  objetivos: Objetivo[];
  registros: RegistroTemporada[];
  temporadasAnteriores: TemporadaArquivada[];
  ultimaPartidaId: string | null;
  aposentado?: boolean;
  dataAposentadoria?: string;
  idadeAposentadoria?: number;
  clubeFinalId?: string;
}
