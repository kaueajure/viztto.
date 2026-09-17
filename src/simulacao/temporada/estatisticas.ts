import type {
  EstadoCarreira,
  Estatisticas,
  Partida,
} from "@/dominio/entidades/modelos";
export const estatisticasVazias = (): Estatisticas => ({
  jogos: 0,
  titularidades: 0,
  minutos: 0,
  gols: 0,
  assistencias: 0,
  amarelos: 0,
  vermelhos: 0,
  somaNotas: 0,
});
export function somarEstatisticas(lista: Estatisticas[]): Estatisticas {
  const total = estatisticasVazias();
  for (const item of lista)
    for (const chave of Object.keys(total) as (keyof Estatisticas)[])
      total[chave] += item[chave];
  return total;
}
export function registrarEstatisticas(
  carreira: EstadoCarreira,
  partida: Partida,
): void {
  const p = partida.participacao;
  if (!p || !p.minutos || !carreira.clubeAtualId) return;
  let registro = carreira.registros.find(
    (r) =>
      r.ano === carreira.temporada.ano &&
      r.clubeId === carreira.clubeAtualId &&
      r.categoria === partida.categoria,
  );
  if (!registro) {
    registro = {
      ano: carreira.temporada.ano,
      clubeId: carreira.clubeAtualId,
      competicao: carreira.liga.nome,
      categoria: partida.categoria,
      estatisticas: estatisticasVazias(),
    };
    carreira.registros.push(registro);
  }
  const e = registro.estatisticas;
  e.jogos++;
  e.titularidades += p.escalacao === "titular" ? 1 : 0;
  e.minutos += p.minutos;
  e.gols += p.gols;
  e.assistencias += p.assistencias;
  e.amarelos += p.amarelos;
  e.vermelhos += p.vermelhos;
  e.somaNotas += p.nota ?? 0;
}
