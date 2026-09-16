import { describe, expect, it } from "vitest";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import { criarCarreira } from "@/aplicacao/casos-de-uso/criar-carreira";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";
import { iniciarProximaTemporada } from "@/aplicacao/casos-de-uso/temporada";
import { responderProposta } from "@/simulacao/transferencias/mercado";
import { registrarEvento } from "@/simulacao/eventos/eventos";
import { validarSave } from "@/infraestrutura/persistencia/validar-save";
import type { EstadoCarreira, Temporada } from "@/dominio/entidades/modelos";

const liga = LIGAS_SUPORTADAS[0]!;
const externa = LIGAS_SUPORTADAS.find((l) => l.id === "premier-league")!;
function nova() {
  const clubes = gerarClubesDemonstracao(liga).slice(0, 4);
  return criarCarreira({
    identidade: {
      nome: "Ana",
      sobrenome: "Costa",
      nacionalidade: "Brasil",
      idade: 18,
      posicao: "MEI",
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 170,
      peso: 62,
      arquetipo: "criador",
    },
    liga,
    clubes,
    clubeId: clubes[0]!.id,
    origem: "demonstracao",
    seed: "regressao-temporadas",
    dataInicio: "2026-01-05",
    ligasMundo: [externa],
    clubesMundo: gerarClubesDemonstracao(externa).slice(0, 6),
  });
}
function conferirLiga(c: EstadoCarreira, t: Temporada, ligaId: string) {
  const ids = c.clubes.filter((cl) => cl.ligaId === ligaId).map((cl) => cl.id);
  expect(t.classificacao.map((l) => l.clubeId).sort()).toEqual([...ids].sort());
  expect(t.classificacaoBase.map((l) => l.clubeId).sort()).toEqual(
    [...ids].sort(),
  );
  for (const p of [...t.partidas, ...t.partidasBase]) {
    expect(ids).toContain(p.mandanteId);
    expect(ids).toContain(p.visitanteId);
  }
}
function transferir(c: EstadoCarreira, ligaId: string) {
  c.propostas.push({
    id: "troca",
    clubeId: c.clubes.find((cl) => cl.ligaId === ligaId)!.id,
    tipo: "transferencia",
    salario: 2000,
    duracaoAnos: 3,
    papelPrometido: "rotacao",
    etapa: "proposta_jogador",
    data: c.dataAtual,
    validade: "2030-12-31",
    status: "pendente",
  });
  const resultado = responderProposta(c, "troca", true);
  resultado.propostas = [];
  return resultado;
}

describe("regressões do mundo entre temporadas", () => {
  it("mantém ligas separadas e renova inclusive a liga com mais rodadas", () => {
    let c = nova();
    for (let ano = 2026; ano < 2029; ano++) {
      conferirLiga(c, c.temporada, liga.id);
      conferirLiga(c, c.temporadasExternas[externa.id]!, externa.id);
      while (!c.temporada.encerrada) c = avancarSemana(c);
      c = iniciarProximaTemporada(c);
      expect(c.temporada.ano).toBe(ano + 1);
      expect(c.temporadasExternas[externa.id]!.ano).toBe(ano + 1);
      expect(c.temporadasExternas[externa.id]!.rodadaAtual).toBe(0);
      const historicos = c.temporadasAnteriores.filter((t) => t.ano === ano);
      expect(historicos).toHaveLength(2);
      for (const h of historicos) {
        const quantidade = c.clubes.filter(
          (cl) => cl.ligaId === h.ligaId,
        ).length;
        expect(
          h.classificacao.every((l) => l.jogos === (quantidade - 1) * 2),
        ).toBe(true);
        expect(
          h.classificacaoBase.every((l) => l.jogos === (quantidade - 1) * 2),
        ).toBe(true);
      }
      c = validarSave(JSON.parse(JSON.stringify(c)));
    }
  });

  it("troca o calendário na transferência internacional e preserva resultados na volta", () => {
    let c = avancarSemana(nova());
    const anterior = structuredClone(c.temporada);
    const destino = structuredClone(c.temporadasExternas[externa.id]);
    c = transferir(c, externa.id);
    expect(c.temporada).toEqual(destino);
    expect(c.temporadasExternas[liga.id]).toEqual(anterior);
    expect(c.temporadasExternas[externa.id]).toBeUndefined();
    expect(c.ultimaPartidaId).toBeNull();
    c = avancarSemana(c);
    conferirLiga(c, c.temporada, externa.id);
    const retorno = structuredClone(c.temporadasExternas[liga.id]);
    c = transferir(c, liga.id);
    expect(c.temporada).toEqual(retorno);
    c = avancarSemana(c);
    conferirLiga(c, c.temporada, liga.id);
  });

  it("transferir dentro da liga preserva o calendário", () => {
    let c = avancarSemana(nova());
    const temporada = structuredClone(c.temporada);
    c.propostas.push({
      id: "local",
      papelPrometido: "rotacao",
      etapa: "proposta_jogador",
      clubeId: c.clubes[1]!.id,
      tipo: "transferencia",
      salario: 2000,
      duracaoAnos: 3,
      data: c.dataAtual,
      validade: "2030-12-31",
      status: "pendente",
    });
    c = responderProposta(c, "local", true);
    expect(c.temporada).toEqual(temporada);
  });

  it("não repete IDs quando as notícias atingem o limite nem após carregar o save", () => {
    let c = nova();
    for (let i = 0; i < 250; i++) {
      registrarEvento(
        c,
        "transferencia-mundo",
        `Transferência ${i}`,
        "Teste",
        "Imprensa",
        false,
      );
      expect(new Set(c.noticias.map((n) => n.id)).size).toBe(c.noticias.length);
      if (i === 150) c = validarSave(JSON.parse(JSON.stringify(c)));
    }
    expect(c.noticias).toHaveLength(100);
    expect(c.eventos).toHaveLength(1);
  });

  it("recupera IDs duplicados de notícias antigas sem apagar seu conteúdo", () => {
    const c = nova();
    const noticia = c.noticias[0]!;
    c.noticias = [
      noticia,
      { ...noticia, titulo: "Outra notícia" },
      { ...noticia, id: `${noticia.id}-1` },
    ];
    const recuperado = validarSave(JSON.parse(JSON.stringify(c)));
    expect(new Set(recuperado.noticias.map((n) => n.id)).size).toBe(3);
    expect(recuperado.noticias.map((n) => n.titulo)).toEqual(
      c.noticias.map((n) => n.titulo),
    );
  });
});
