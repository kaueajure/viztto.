import { describe, expect, it } from "vitest";
import type { JogadorMundo, Posicao } from "@/dominio/entidades/modelos";
import { estatisticasVazias } from "@/dominio/jogador-mundo";
import {
  COMPAT_HIERARQUIA,
  avaliarHierarquia,
  rankingHierarquiaSlot,
} from "@/simulacao/elenco/hierarquia";
import {
  jogadorMundoComoCandidato,
  jogadorUsuarioComoCandidato,
  pesoCompatibilidade,
} from "@/simulacao/elenco/escalacao-elenco";
import { exemploCarreira } from "./auxiliar-carreira-persistida";

function stubMundo(
  parcial: Partial<JogadorMundo> & {
    id: string;
    nome: string;
    posicaoPrincipal: Posicao;
    overall: number;
  },
): JogadorMundo {
  const pos = parcial.posicaoPrincipal;
  return {
    idExterno: -1,
    idTransfermarkt: parcial.id,
    dataNascimento: null,
    idade: 24,
    nacionalidade: ["Brasil"],
    posicoesSecundarias: [],
    posicao: pos,
    grupoPosicao: ["GOL"].includes(pos)
      ? "GOL"
      : ["LD", "ZAG", "LE"].includes(pos)
        ? "DEF"
        : ["VOL", "MC", "MEI"].includes(pos)
          ? "MEI"
          : "ATA",
    peDominante: "direito",
    altura: 180,
    numero: 9,
    clubeId: "clube",
    potencial: parcial.overall + 4,
    forma: 70,
    moral: 70,
    condicionamento: 90,
    fadiga: 10,
    valorMercado: 1_000_000,
    salario: 10_000,
    contratoAte: null,
    joinedOn: null,
    signedFrom: null,
    foto: "",
    lesionado: false,
    lesao: null,
    suspensao: 0,
    statusElenco: "titular",
    estatisticasCarreira: estatisticasVazias(),
    ...parcial,
  };
}

describe("hierarquia profissional — concorrência real", () => {
  it("compat fraca (0.50/0.35/0.12) não entra no ranking ordinal", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.posicaoSecundaria = "";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 70;
    clube.formacaoPreferida = "4-3-3";
    clube.treinador.formacaoPreferida = "4-3-3";

    clube.elenco = [
      stubMundo({ id: "pd1", nome: "Ponta A", posicaoPrincipal: "PD", overall: 78 }),
      stubMundo({ id: "ca1", nome: "Centroavante", posicaoPrincipal: "CA", overall: 88 }),
      stubMundo({ id: "mc1", nome: "Meia", posicaoPrincipal: "MC", overall: 86 }),
      stubMundo({ id: "vol1", nome: "Volante", posicaoPrincipal: "VOL", overall: 84 }),
      stubMundo({ id: "pe1", nome: "Ponta E", posicaoPrincipal: "PE", overall: 82 }),
    ];

    const usuario = jogadorUsuarioComoCandidato(c.jogador);
    expect(pesoCompatibilidade(usuario, "PD")).toBeGreaterThanOrEqual(COMPAT_HIERARQUIA);
    expect(pesoCompatibilidade(jogadorMundoComoCandidato(clube.elenco[1]!), "PD")).toBeLessThan(
      COMPAT_HIERARQUIA,
    );

    const ranking = rankingHierarquiaSlot(
      [...clube.elenco.map(jogadorMundoComoCandidato), usuario],
      "PD",
      50,
    );
    const ids = ranking.map((r) => r.x.id);
    expect(ids).toContain("usuario");
    expect(ids).toContain("pd1");
    expect(ids).not.toContain("ca1");
    expect(ids).not.toContain("mc1");
    expect(ids).not.toContain("vol1");
    // PE no mesmo grupo ATA tem 0.50 — fora do ranking ordinal
    expect(ids).not.toContain("pe1");

    const h = avaliarHierarquia(c);
    expect(h.ordem).toBe(2);
    expect(h.rotulo).toMatch(/2ª opção em PD/i);
    expect(h.concorrentes.every((x) => x.usuario || x.id === "pd1")).toBe(true);
  });

  it("1 concorrente real → ~2ª opção; 3 concorrentes reais → ~4ª opção", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.posicaoSecundaria = "";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 68;
    c.jogador.forma = 60;
    clube.formacaoPreferida = "4-3-3";
    clube.treinador.formacaoPreferida = "4-3-3";

    clube.elenco = [
      stubMundo({ id: "pd-a", nome: "PD A", posicaoPrincipal: "PD", overall: 76 }),
      stubMundo({ id: "ruido-ca", nome: "CA", posicaoPrincipal: "CA", overall: 90 }),
      stubMundo({ id: "ruido-mc", nome: "MC", posicaoPrincipal: "MC", overall: 90 }),
    ];
    expect(avaliarHierarquia(c).ordem).toBe(2);

    clube.elenco = [
      stubMundo({ id: "pd-a", nome: "PD A", posicaoPrincipal: "PD", overall: 80 }),
      stubMundo({ id: "pd-b", nome: "PD B", posicaoPrincipal: "PD", overall: 77 }),
      stubMundo({
        id: "pd-sec",
        nome: "MEI com PD",
        posicaoPrincipal: "MEI",
        posicoesSecundarias: ["PD"],
        overall: 74,
      }),
      stubMundo({ id: "ruido-ca", nome: "CA", posicaoPrincipal: "CA", overall: 92 }),
      stubMundo({ id: "ruido-vol", nome: "VOL", posicaoPrincipal: "VOL", overall: 91 }),
    ];
    const h = avaliarHierarquia(c);
    expect(h.ordem).toBe(4);
    expect(h.rotulo).toMatch(/4ª opção em PD/i);
    expect(h.concorrentes.filter((x) => !x.usuario)).toHaveLength(3);
  });

  it("clubes diferentes produzem hierarquias diferentes (sem valor fixo)", () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.posicao = "PD";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 72;
    c.jogador.posicaoSecundaria = "";

    const clubeA = c.clubes[0]!;
    const clubeB = c.clubes[1]!;
    clubeA.formacaoPreferida = "4-3-3";
    clubeA.treinador.formacaoPreferida = "4-3-3";
    clubeB.formacaoPreferida = "4-3-3";
    clubeB.treinador.formacaoPreferida = "4-3-3";

    clubeA.elenco = [
      stubMundo({ id: "a1", nome: "Só um PD", posicaoPrincipal: "PD", overall: 75 }),
      stubMundo({ id: "a2", nome: "CA A", posicaoPrincipal: "CA", overall: 88 }),
    ];
    clubeB.elenco = [
      stubMundo({ id: "b1", nome: "PD 1", posicaoPrincipal: "PD", overall: 80 }),
      stubMundo({ id: "b2", nome: "PD 2", posicaoPrincipal: "PD", overall: 78 }),
      stubMundo({ id: "b3", nome: "PD 3", posicaoPrincipal: "PD", overall: 76 }),
      stubMundo({ id: "b4", nome: "CA B", posicaoPrincipal: "CA", overall: 90 }),
    ];

    c.clubeAtualId = clubeA.id;
    const ha = avaliarHierarquia(c);
    c.clubeAtualId = clubeB.id;
    const hb = avaliarHierarquia(c);

    expect(ha.ordem).toBe(2);
    expect(hb.ordem).toBe(4);
    expect(ha.ordem).not.toBe(hb.ordem);
    expect(ha.ordem).not.toBe(9);
    expect(hb.ordem).not.toBe(9);
  });

  it("formação sem a posição natural explica alternativa sem fingir posição nativa", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.posicaoSecundaria = "";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 70;
    clube.formacaoPreferida = "3-5-2";
    clube.treinador.formacaoPreferida = "3-5-2";
    clube.elenco = [
      stubMundo({ id: "ca1", nome: "CA 1", posicaoPrincipal: "CA", overall: 78 }),
      stubMundo({ id: "ca2", nome: "CA 2", posicaoPrincipal: "CA", overall: 74 }),
      stubMundo({ id: "mc1", nome: "MC", posicaoPrincipal: "MC", overall: 80 }),
    ];

    const h = avaliarHierarquia(c);
    expect(h.formacaoUsaPosicao).toBe(false);
    expect(h.formacaoUsaPosicaoPrincipal).toBe(false);
    expect(h.motivo).toMatch(/não usa PD/i);
    expect(h.motivo).toMatch(/alternativa para CA/i);
    expect(h.motivo).not.toMatch(/VOL\/MC/);
    expect(h.rotulo).toMatch(/alternativa/i);
    expect(h.rotulo).not.toMatch(/opção em PD/i);
    expect(h.slotReferencia).toBe("CA");
  });

  it("posição secundária não finge ser posição natural da formação", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.posicaoSecundaria = "CA";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 70;
    clube.formacaoPreferida = "3-5-2";
    clube.treinador.formacaoPreferida = "3-5-2";
    clube.elenco = [
      stubMundo({ id: "ca1", nome: "CA 1", posicaoPrincipal: "CA", overall: 78 }),
      stubMundo({ id: "ca2", nome: "CA 2", posicaoPrincipal: "CA", overall: 74 }),
    ];

    const h = avaliarHierarquia(c);
    expect(h.formacaoUsaPosicaoPrincipal).toBe(false);
    expect(h.formacaoUsaPosicaoSecundaria).toBe(true);
    expect(h.formacaoUsaPosicao).toBe(false);
    expect(h.rotulo).toMatch(/posição secundária/i);
    expect(h.motivo).toMatch(/não utiliza sua posição principal PD/i);
    expect(h.motivo).toMatch(/posição secundária/i);
    expect(h.slotReferencia).toBe("CA");
  });

  it("lesão do titular não apaga a hierarquia; usuário lesionado não vira 1ª opção fantasma", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.posicaoSecundaria = "";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 70;
    c.jogador.lesao = null;
    clube.formacaoPreferida = "4-3-3";
    clube.treinador.formacaoPreferida = "4-3-3";
    clube.elenco = [
      stubMundo({
        id: "pd-titular",
        nome: "Titular PD",
        posicaoPrincipal: "PD",
        overall: 80,
        lesionado: true,
      }),
      ...(["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "PE", "CA"] as Posicao[]).map(
        (pos, i) =>
          stubMundo({
            id: `plantel-${i}`,
            nome: `Plantel ${i}`,
            posicaoPrincipal: pos,
            overall: 72,
          }),
      ),
    ];

    const saudavel = avaliarHierarquia(c);
    expect(saudavel.ordem).toBe(2);
    expect(saudavel.rotulo).toMatch(/2ª opção em PD/i);
    expect(saudavel.concorrentes.some((x) => x.id === "pd-titular" && !x.disponivel)).toBe(
      true,
    );
    expect(saudavel.papelEscalacao).toBe("titular");
    expect(saudavel.motivo).toMatch(/titular no próximo jogo porque/i);

    c.jogador.lesao = {
      tipo: "Entorse",
      gravidade: "leve",
      diasRecuperacao: 14,
      dataInicio: c.dataAtual,
      dataPrevistaRetorno: c.dataAtual,
    };
    const lesionado = avaliarHierarquia(c);
    expect(lesionado.ordem).toBe(2);
    expect(lesionado.rotulo).toMatch(/2ª opção em PD/i);
    expect(lesionado.ordem).not.toBe(1);
    expect(lesionado.motivo).toMatch(/recuperação médica/i);
    expect(lesionado.papelEscalacao).toBe("lesionado");
  });

  it("hierarquia da posição e situação da escalação ficam separadas no texto", () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    c.jogador.posicao = "PD";
    c.jogador.categoria = "profissional";
    c.jogador.overall = 55;
    c.jogador.forma = 50;
    clube.formacaoPreferida = "4-3-3";
    clube.treinador.formacaoPreferida = "4-3-3";
    clube.elenco = [
      stubMundo({ id: "pd1", nome: "Titular PD", posicaoPrincipal: "PD", overall: 85 }),
      stubMundo({ id: "pd2", nome: "Reserva PD", posicaoPrincipal: "PD", overall: 78 }),
      ...(["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "PE", "CA"] as Posicao[]).map(
        (pos, i) =>
          stubMundo({
            id: `base-${i}`,
            nome: `Plantel ${i}`,
            posicaoPrincipal: pos,
            overall: 80,
          }),
      ),
    ];

    const h = avaliarHierarquia(c);
    expect(h.rotulo).toMatch(/\dª opção em PD/i);
    expect(h.motivo).toMatch(/próximo jogo/i);
    expect(h.papelEscalacao).not.toBe("titular");
  });
});
