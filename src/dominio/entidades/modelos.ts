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
export interface Liga {
  id: string;
  idExterno: number;
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
export interface Clube {
  id: string;
  idExterno: number;
  ligaId: string;
  nome: string;
  codigo: string;
  pais: string;
  fundacao: number | null;
  escudo: string;
  estadio: string;
  reputacao: number;
  forcaGeral: number;
  forcaAtaque: number;
  forcaMeio: number;
  forcaDefesa: number;
  qualidadeBase: number;
  poderFinanceiro: number;
  forma: number;
  moral: number;
  fadiga: number;
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
  id: string;
  clubeId: string;
  tipo: "transferencia" | "renovacao";
  salario: number;
  duracaoAnos: number;
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
  classificacao: LinhaClassificacao[];
  classificacaoBase: LinhaClassificacao[];
}
export interface EstadoCarreira {
  versao: 1;
  id: string;
  seed: string;
  estadoAleatorio: number;
  dataAtual: string;
  dataInicio: string;
  identidadeInicial: IdentidadeJogador;
  clubeInicialId: string;
  jogador: Jogador;
  clubeAtualId: string;
  liga: Liga;
  clubes: Clube[];
  origem: "api" | "demonstracao";
  temporada: Temporada;
  focoTreino: FocoTreino;
  propostas: PropostaTransferencia[];
  noticias: EventoCarreira[];
  eventos: EventoCarreira[];
  objetivos: Objetivo[];
  registros: RegistroTemporada[];
  temporadasAnteriores: TemporadaArquivada[];
  ultimaPartidaId: string | null;
}
