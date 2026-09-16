import type { Clube, Liga } from "@/dominio/entidades/modelos";
export interface LigaExterna {
  liga: Liga;
  temporada: number;
  inicio: string;
}
export interface ProvedorDadosFutebol {
  buscarLigas(): Promise<LigaExterna[]>;
  buscarTemporada(idLiga: number, ano: number): Promise<LigaExterna>;
  buscarClubes(idLiga: number, temporada: number): Promise<Clube[]>;
}
export class TemporadaForaDoPlano extends Error {
  constructor(public readonly ultimaTemporadaPermitida: number) {
    super("A temporada atual não está incluída no plano da API.");
  }
}
