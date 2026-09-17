import type { Atributos, Jogador } from "@/dominio/entidades/modelos";

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;
const MESES = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;

export function dataCarreiraTopo(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = MESES[d.getUTCMonth()]!;
  const ano = d.getUTCFullYear();
  const semana = DIAS[d.getUTCDay()]!;
  return `${dia} ${mes} ${ano} | ${semana}`;
}

export function mesAnoCurto(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function diaDoMes(data: string): string {
  return String(new Date(`${data}T12:00:00Z`).getUTCDate()).padStart(2, "0");
}

export function mesContrato(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const mes = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(d)
    .replace(".", "");
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

export function peDominanteRotulo(
  pe: Jogador["peDominante"],
): string {
  if (pe === "direito") return "Destro";
  if (pe === "esquerdo") return "Canhoto";
  return "Ambidestro";
}

export function alturaMetros(cm: number): string {
  return `${(cm / 100).toFixed(2).replace(".", ",")} m`;
}

/** Resumo estilo carta (derivado dos atributos já existentes — só apresentação). */
export function atributosResumo(a: Atributos): {
  sigla: string;
  valor: number;
}[] {
  const media = (...valores: number[]) =>
    Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  return [
    { sigla: "RIT", valor: media(a.aceleracao, a.velocidade) },
    { sigla: "FIN", valor: Math.round(a.finalizacao) },
    { sigla: "PAS", valor: media(a.passeCurto, a.passeLongo) },
    { sigla: "DRI", valor: Math.round(a.drible) },
    { sigla: "DEF", valor: media(a.desarme, a.marcacao, a.antecipacao) },
    { sigla: "FÍS", valor: media(a.forca, a.resistencia) },
  ];
}

export function tempoRelativoNoticia(
  dataNoticia: string,
  dataAtual: string,
): string {
  const a = new Date(`${dataNoticia}T12:00:00Z`).getTime();
  const b = new Date(`${dataAtual}T12:00:00Z`).getTime();
  const dias = Math.round((b - a) / 86_400_000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return `${dias} dias`;
  return `${Math.floor(dias / 7)} sem.`;
}

export function formaRecente(notas: number[]): ("V" | "E" | "D")[] {
  return notas.slice(-5).map((n) => {
    if (n >= 7) return "V";
    if (n >= 5.5) return "E";
    return "D";
  });
}
