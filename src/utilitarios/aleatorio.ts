export function gerarSeedNumerica(seed: string): number {
  let valor = 2166136261;
  for (const caractere of seed)
    valor = Math.imul(valor ^ caractere.charCodeAt(0), 16777619);
  return valor >>> 0;
}
export class GeradorAleatorio {
  constructor(public estado: number) {}
  proximo(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let valor = this.estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  }
  inteiro(minimo: number, maximo: number): number {
    return Math.floor(this.proximo() * (maximo - minimo + 1)) + minimo;
  }
  chance(probabilidade: number): boolean {
    return this.proximo() < probabilidade;
  }
  escolher<T>(itens: readonly T[]): T {
    if (!itens.length) throw new Error("Não há opções para sortear.");
    return itens[this.inteiro(0, itens.length - 1)];
  }
  poisson(media: number): number {
    const limite = Math.exp(-Math.min(8, Math.max(0.05, media)));
    let produto = 1,
      quantidade = 0;
    do {
      quantidade++;
      produto *= this.proximo();
    } while (produto > limite);
    return quantidade - 1;
  }
}
