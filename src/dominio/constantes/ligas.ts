import type { Liga } from "../entidades/modelos";

export const TEMPORADA_TRANSFERMARKT = "2026";

export const LIGAS_SUPORTADAS: Liga[] = [
  {
    id: "brasileirao",
    idTransfermarkt: "BRA1",
    termoBusca: "Brasileirão",
    nome: "Brasileirão Série A",
    pais: "Brasil",
    bandeira: "BR",
    reputacao: 78,
    forcaMedia: 73,
    quantidadeClubes: 20,
  },
  {
    id: "brasileirao-b",
    idTransfermarkt: "BRA2",
    termoBusca: "Série B",
    nome: "Brasileirão Série B",
    pais: "Brasil",
    bandeira: "BR",
    reputacao: 62,
    forcaMedia: 64,
    quantidadeClubes: 20,
  },
  {
    id: "premier-league",
    idTransfermarkt: "GB1",
    termoBusca: "Premier League",
    nome: "Premier League",
    pais: "Inglaterra",
    bandeira: "GB",
    reputacao: 98,
    forcaMedia: 81,
    quantidadeClubes: 20,
  },
  {
    id: "la-liga",
    idTransfermarkt: "ES1",
    termoBusca: "LaLiga",
    nome: "La Liga",
    pais: "Espanha",
    bandeira: "ES",
    reputacao: 93,
    forcaMedia: 78,
    quantidadeClubes: 20,
  },
  {
    id: "serie-a",
    idTransfermarkt: "IT1",
    termoBusca: "Serie A",
    nome: "Serie A",
    pais: "Itália",
    bandeira: "IT",
    reputacao: 90,
    forcaMedia: 77,
    quantidadeClubes: 20,
  },
  {
    id: "bundesliga",
    idTransfermarkt: "L1",
    termoBusca: "Bundesliga",
    nome: "Bundesliga",
    pais: "Alemanha",
    bandeira: "DE",
    reputacao: 90,
    forcaMedia: 77,
    quantidadeClubes: 18,
  },
  {
    id: "ligue-1",
    idTransfermarkt: "FR1",
    termoBusca: "Ligue 1",
    nome: "Ligue 1",
    pais: "França",
    bandeira: "FR",
    reputacao: 85,
    forcaMedia: 74,
    quantidadeClubes: 18,
  },
].map((liga) => ({
  ...liga,
  regras: { pontosVitoria: 3, pontosEmpate: 1, amarelosSuspensao: 3 },
})) as Liga[];

/** Ligas exibidas na criação (Série B entra no mundo se importada). */
export const LIGAS_CRIACAO = LIGAS_SUPORTADAS.filter(
  (l) => l.id !== "brasileirao-b",
);
