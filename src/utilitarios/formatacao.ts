export const limitar = (valor: number, minimo = 0, maximo = 100) =>
  Math.min(maximo, Math.max(minimo, valor));
export function somarDias(data: string, dias: number): string {
  const instante = new Date(`${data}T12:00:00Z`);
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString().slice(0, 10);
}
export const formatarData = (data: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data}T12:00:00Z`));
export const dinheiro = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valor);
export const numero = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor);
