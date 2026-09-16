import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { exemploCarreira } from "./auxiliar-carreira-persistida";
import {
  hidratarCarreira,
  serializarCarreira,
  validarCarreiraPersistida,
} from "@/infraestrutura/persistencia/carreira-persistida";
import { avancarSemana } from "@/aplicacao/casos-de-uso/avancar-tempo";

export function conferirSemCatalogo(valor: unknown) {
  if (!valor || typeof valor !== "object") return;
  for (const [chave, item] of Object.entries(valor)) {
    expect([
      "escudo",
      "foto",
      "dadosBrutos",
      "idTransfermarkt",
      "idExterno",
      "estadio",
      "nomeOficial",
      "nomeCurto",
      "fundacao",
      "dataNascimento",
    ]).not.toContain(chave);
    if (typeof item === "string")
      expect(item).not.toMatch(/https:\/\/imagens.test/);
    conferirSemCatalogo(item);
  }
}

describe("formato persistido da carreira", () => {
  it("o fluxo de carreira não utiliza armazenamento do browser ou middleware persist", async () => {
    for (const arquivo of [
      "src/estado/jogo-store.ts",
      "src/componentes/jogo/Hidratacao.tsx",
      "src/infraestrutura/persistencia/cliente-carreira.ts",
    ]) {
      expect(await readFile(arquivo, "utf8")).not.toMatch(
        /localStorage|sessionStorage|indexedDB|createJSONStorage|zustand\/middleware|\.persist/,
      );
    }
  });
  it("remove semanticamente o catálogo, preservando IDs e deltas", () => {
    const { carreira } = exemploCarreira();
    const p = serializarCarreira(carreira);
    conferirSemCatalogo(p);
    expect(p).not.toHaveProperty("clubes");
    expect(p).not.toHaveProperty("liga");
    expect(p.clubesDinamicos[0]).not.toHaveProperty("nome");
    expect(p.clubesDinamicos[0].elenco[0]).not.toHaveProperty("nome");
    expect(p.clubesDinamicos[0].elenco[0].id).toBe(
      carreira.clubes[0].elenco[0].id,
    );
    expect(p.estadoAleatorio).toBe(carreira.estadoAleatorio);
  });
  it("round-trip preserva o próximo passo determinístico, independente da ordem do catálogo", () => {
    const { carreira, catalogo } = exemploCarreira();
    const c = avancarSemana(carreira);
    catalogo.clubes.reverse().forEach((cl) => cl.elenco.reverse());
    const restaurado = hidratarCarreira(serializarCarreira(c), catalogo);
    expect(serializarCarreira(restaurado)).toEqual(serializarCarreira(c));
    expect(serializarCarreira(avancarSemana(restaurado))).toEqual(
      serializarCarreira(avancarSemana(c)),
    );
  });
  it("preserva transferência, aposentadoria, evolução, contratos, lesão e escalação", () => {
    const { carreira: c, catalogo } = exemploCarreira();
    const [origem, destino] = c.clubes;
    const jogador = origem.elenco.shift()!;
    jogador.clubeId = destino.id;
    jogador.overall = 90;
    jogador.potencial = 95;
    jogador.forma = 82;
    jogador.salario = 45678;
    jogador.contratoAte = "2030-12-31";
    jogador.valorMercado = 12345678;
    jogador.estatisticasCarreira.gols = 42;
    jogador.lesionado = true;
    jogador.suspensao = 2;
    jogador.lesao = {
      tipo: "Contusão",
      gravidade: "leve",
      diasRecuperacao: 7,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: "2026-06-08",
    };
    destino.elenco.push(jogador);
    const aposentado = origem.elenco.pop()!;
    destino.titularesIds[0] = jogador.id;
    destino.orcamento -= 12345678;
    c.transferenciasRecentes.push({
      id: "transferido",
      jogadorId: jogador.id,
      nomeJogador: jogador.nome,
      deClubeId: origem.id,
      paraClubeId: destino.id,
      valor: 12345678,
      salario: 45678,
      duracaoAnos: 3,
      papelPrometido: "titular",
      etapa: "concluida",
      data: c.dataAtual,
      aoUsuario: false,
    });
    const r = hidratarCarreira(serializarCarreira(c), catalogo);
    expect(r.clubes[1].elenco.at(-1)).toEqual(jogador);
    expect(
      r.clubes.flatMap((cl) => cl.elenco).find((j) => j.id === aposentado.id),
    ).toBeUndefined();
    expect(serializarCarreira(r)).toEqual(serializarCarreira(c));
  });
  it("usa novas identidades estáticas sem sobrescrever o delta", () => {
    const { carreira, catalogo } = exemploCarreira();
    const p = serializarCarreira(carreira);
    catalogo.clubes[0].nome = "Nome atualizado";
    catalogo.clubes[0].escudo = "https://novo.test/escudo.png";
    catalogo.clubes[0].elenco[0].overall = 1;
    const r = hidratarCarreira(p, catalogo);
    expect(r.clubes[0].nome).toBe("Nome atualizado");
    expect(r.clubes[0].escudo).toContain("novo.test");
    expect(serializarCarreira(r)).toEqual(p);
  });
  it("suporta identidade gerada própria sem usar fallback para NPC ausente", () => {
    const { carreira, catalogo } = exemploCarreira();
    const gerado = {
      ...structuredClone(carreira.clubes[0].elenco[0]),
      id: "gerado-teste",
      nome: "Novo Atleta",
      idExterno: 0,
      idTransfermarkt: "",
      foto: "",
    };
    carreira.clubes[0].elenco.push(gerado);
    const p = serializarCarreira(carreira);
    expect(p.jogadoresGerados).toHaveLength(1);
    expect(hidratarCarreira(p, catalogo).clubes[0].elenco.at(-1)).toEqual(
      gerado,
    );
    p.jogadoresGerados = [];
    expect(() => hidratarCarreira(p, catalogo)).toThrow(/incompatível/);
  });
  it.each(["clube", "jogador", "liga"])(
    "entidade ausente (%s) gera incompatibilidade explícita",
    (tipo) => {
      const { carreira, catalogo } = exemploCarreira();
      if (tipo === "clube") catalogo.clubes.shift();
      if (tipo === "jogador") catalogo.clubes[0].elenco = [];
      if (tipo === "liga") catalogo.ligas.shift();
      expect(() =>
        hidratarCarreira(serializarCarreira(carreira), catalogo),
      ).toThrow(/incompatível/);
    },
  );
  it("rejeita payload estruturalmente inválido, datas falsas, catálogo e pollution", () => {
    const { carreira } = exemploCarreira();
    const p = serializarCarreira(carreira);
    expect(() =>
      validarCarreiraPersistida({ ...p, dataAtual: "2026-02-31" }),
    ).toThrow();
    expect(() => validarCarreiraPersistida({ ...p, versao: 2 })).toThrow();
    expect(() =>
      validarCarreiraPersistida({ ...p, clubes: carreira.clubes }),
    ).toThrow();
    expect(() =>
      validarCarreiraPersistida(JSON.parse('{"__proto__":{"poluido":true}}')),
    ).toThrow();
    p.clubesDinamicos[0].elenco[0].overall = NaN;
    expect(() => validarCarreiraPersistida(p)).toThrow();
  });
});
