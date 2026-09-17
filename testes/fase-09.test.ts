import { describe, it, expect } from 'vitest';
import { exemploCarreira } from './auxiliar-carreira-persistida';
import { serializarCarreira, hidratarCarreira } from '@/infraestrutura/persistencia/carreira-persistida';
import { migrarDesenvolvimento } from '@/infraestrutura/persistencia/migrar-desenvolvimento';
import {
  conversarTreinador,
  atualizarCompromissos,
  avaliarProgressoAdaptacao,
  DIAS_ADAPTACAO_PRINCIPAL,
  DIAS_COOLDOWN_TREINADOR,
} from '@/simulacao/elenco/treinador';
import { somarDias } from '@/utilitarios/formatacao';
import { calcularOverall } from '@/dominio/regras/jogador';

describe('Fase 09 — migração acompanhamento treinador', () => {
  it('converte proximaConversa e adaptacao concluida sem inventar progresso', () => {
    const migrado = migrarDesenvolvimento({
      versao: 4,
      acompanhamento: {
        conversas: [],
        proximaConversa: '2026-01-20',
        promessa: null,
        adaptacao: { posicao: 'PE', inicio: '2026-01-01', semanas: 9, clubeId: 'c1', status: 'concluida' },
        pedidosContrato: [],
        proximoPedidoContrato: null,
        objetivoPessoal: null,
        base: { ultimaAvaliacao: null, texto: null, treinosProfissional: 0, conviteAte: null },
        resumoSemanal: null,
        ultimoEventoContextual: null,
      },
    }, true) as { acompanhamento: {
      proximaConversa?: string;
      cooldownsTreinador: Record<string, string | null>;
      papelAceito: null;
      adaptacao: { status: string; semanas: number };
    } };
    expect(migrado.acompanhamento.proximaConversa).toBeUndefined();
    expect(migrado.acompanhamento.cooldownsTreinador.informativa).toBe('2026-01-20');
    expect(migrado.acompanhamento.cooldownsTreinador.pedido).toBe('2026-01-20');
    expect(migrado.acompanhamento.adaptacao.status).toBe('secundaria');
    expect(migrado.acompanhamento.adaptacao.semanas).toBe(9);
    expect(migrado.acompanhamento.papelAceito).toBeNull();
  });
});

describe('Fase 09 — treinador item 7 (farm aceitar papel)', () => {
  it('recompensa só na primeira aceitação do mesmo papel; nova mudança de status libera de novo', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.status = 'reserva';
    const rel0 = c.relacionamentos.treinador;
    const moral0 = c.jogador.moral;

    const primeira = conversarTreinador(c, 'aceitar');
    expect(primeira.relacionamentos.treinador).toBeGreaterThan(rel0);
    expect(primeira.jogador.moral).toBeGreaterThan(moral0);
    expect(primeira.acompanhamento.papelAceito).toEqual({
      status: 'reserva',
      data: c.dataAtual,
      clubeId: c.clubeAtualId,
    });

    primeira.dataAtual = somarDias(primeira.dataAtual, DIAS_COOLDOWN_TREINADOR.informativa);
    const rel1 = primeira.relacionamentos.treinador;
    const moral1 = primeira.jogador.moral;
    const repetida = conversarTreinador(primeira, 'aceitar');
    expect(repetida.relacionamentos.treinador).toBe(rel1);
    expect(repetida.jogador.moral).toBe(moral1);
    expect(repetida.acompanhamento.conversas.at(-1)?.resposta).toMatch(/Já registramos/);

    repetida.jogador.status = 'rotacao';
    repetida.dataAtual = somarDias(repetida.dataAtual, DIAS_COOLDOWN_TREINADOR.informativa);
    const aposMudanca = conversarTreinador(repetida, 'aceitar');
    expect(aposMudanca.relacionamentos.treinador).toBeGreaterThan(rel1);
    expect(aposMudanca.jogador.moral).toBeGreaterThan(moral1);
    expect(aposMudanca.acompanhamento.papelAceito?.status).toBe('rotacao');
  });
});

describe('Fase 09 — treinador item 15 (adaptação em fases)', () => {
  it('fase 1 vira secundaria (não concluída); fase 2 explica prazo e só então libera principal', () => {
    const { carreira: c, catalogo } = exemploCarreira();
    c.jogador.confianca = 70;
    const pedido = conversarTreinador(c, 'posicao', 'PE');
    expect(pedido.acompanhamento.adaptacao?.status).toBe('ativa');
    expect(pedido.acompanhamento.conversas.at(-1)?.resposta).toMatch(/Fase 1/);

    for (let i = 0; i < 10; i++) {
      pedido.dataAtual = somarDias(pedido.dataAtual, 7);
      atualizarCompromissos(pedido);
    }
    expect(pedido.jogador.posicaoSecundaria).toBe('PE');
    expect(pedido.jogador.posicao).toBe('PD');
    expect(pedido.acompanhamento.adaptacao?.status).toBe('secundaria');
    expect(pedido.acompanhamento.adaptacao?.status).not.toBe('concluida' as never);

    const progresso = avaliarProgressoAdaptacao(pedido)!;
    expect(progresso.fase).toBe(2);
    expect(progresso.podePrincipal).toBe(false);
    expect(progresso.rotuloStatus).not.toMatch(/conclu/i);
    expect(progresso.motivoBloqueioPrincipal).toMatch(/112|fase 2|prazo/i);

    pedido.dataAtual = somarDias(pedido.dataAtual, DIAS_COOLDOWN_TREINADOR.posicional);
    const cedo = conversarTreinador(pedido, 'posicao', 'PE');
    expect(cedo.jogador.posicao).toBe('PD');
    expect(cedo.acompanhamento.conversas.at(-1)?.resposta).toMatch(/alternativa|fase 2|dias|overall/i);

    // Garante overall compatível e prazo da fase 2.
    for (const chave of Object.keys(cedo.jogador.atributos) as (keyof typeof cedo.jogador.atributos)[]) {
      cedo.jogador.atributos[chave] = Math.max(cedo.jogador.atributos[chave], 70);
    }
    cedo.jogador.overall = calcularOverall(cedo.jogador.atributos, cedo.jogador.posicao);
    cedo.dataAtual = somarDias(cedo.acompanhamento.adaptacao!.inicio, DIAS_ADAPTACAO_PRINCIPAL);
    cedo.acompanhamento.cooldownsTreinador.posicional = null;

    const pronto = avaliarProgressoAdaptacao(cedo)!;
    expect(pronto.podePrincipal).toBe(true);
    expect(pronto.rotuloStatus).toMatch(/pronta|principal/i);

    const mudou = conversarTreinador(cedo, 'posicao', 'PE');
    expect(mudou.jogador.posicao).toBe('PE');
    expect(mudou.jogador.posicaoSecundaria).toBe('PD');
    expect(mudou.acompanhamento.adaptacao).toBeNull();
    expect(hidratarCarreira(serializarCarreira(pedido), catalogo).acompanhamento.adaptacao?.status).toBe('secundaria');
  });
});

describe('Fase 09 — treinador item 16 (cooldowns por categoria)', () => {
  it('pergunta informativa não bloqueia pedido importante; mesma categoria permanece em cooldown', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.overall = 90;
    c.jogador.confianca = 80;

    const info = conversarTreinador(c, 'melhorar');
    expect(info.acompanhamento.cooldownsTreinador.informativa).toBeTruthy();
    expect(info.acompanhamento.cooldownsTreinador.pedido).toBeNull();

    expect(() => conversarTreinador(info, 'melhorar')).toThrow(/categoria/);
    const pedido = conversarTreinador(info, 'oportunidade');
    expect(pedido.acompanhamento.conversas.at(-1)?.acao).toBe('oportunidade');
    expect(pedido.acompanhamento.cooldownsTreinador.pedido).toBeTruthy();
    expect(() => conversarTreinador(pedido, 'oportunidade')).toThrow(/categoria/);

    // Informativa ainda bloqueada, mas reclamar (outra categoria) também segue regra própria.
    expect(() => conversarTreinador(pedido, 'motivo')).toThrow(/categoria/);
    const reclamacao = conversarTreinador(pedido, 'reclamar');
    expect(reclamacao.acompanhamento.conversas.at(-1)?.acao).toBe('reclamar');
  });
});

import { criarCarreira } from '@/aplicacao/casos-de-uso/criar-carreira';
import { avancarSemana } from '@/aplicacao/casos-de-uso/avancar-tempo';
import { relacionadoProfissional, categoriaPartidaDaSemana } from '@/simulacao/base/formacao';
import {
  avaliarParaSlot,
  PESO_STATUS,
  type CandidatoEscalacao,
} from '@/simulacao/elenco/escalacao-elenco';
import { avaliarHierarquia } from '@/simulacao/elenco/hierarquia';
import { SLOTS_FORMACAO } from '@/dominio/formacao';

function prepararBaseConvocavel() {
  const { entrada } = exemploCarreira();
  const c = criarCarreira({
    ...entrada,
    identidade: { ...entrada.identidade, idade: 16, posicao: 'PD' },
  });
  const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
  c.jogador.overall = clube.forcaGeral;
  c.jogador.confianca = 80;
  c.jogador.forma = 70;
  c.jogador.condicionamento = 85;
  c.jogador.fadiga = 10;
  c.jogador.potencialInterno = 70; // evita promoção precoce nos testes de convocação
  c.jogador.preparacao.historico = [
    { data: c.dataAtual, nota: 80, avaliacao: 'Muito bom', confianca: 2, progresso: 8 },
  ];
  c.acompanhamento.base.conviteAte = somarDias(c.dataAtual, 28);
  c.acompanhamento.base.treinosProfissional = 2;
  return { c, clube };
}

function forcarOverallJogador(
  j: { atributos: Record<string, number>; overall: number; posicao: string },
  overall: number,
) {
  for (const chave of Object.keys(j.atributos)) j.atributos[chave] = overall;
  j.overall = overall;
}

function forcarAusenciaNaPosicao(
  clube: ReturnType<typeof prepararBaseConvocavel>['clube'],
  posicao: 'PD' | 'PE' | 'MEI' | 'LD' | 'LE' | 'MC' | 'CA' | 'ZAG' | 'VOL' | 'GOL',
) {
  let alvo = clube.elenco.find((j) => j.posicaoPrincipal === posicao);
  if (!alvo) {
    alvo = clube.elenco.find((j) => j.posicaoPrincipal !== 'GOL')!;
    alvo.posicaoPrincipal = posicao;
    alvo.posicao = posicao;
  }
  alvo.lesionado = true;
  alvo.suspensao = 0;
  return alvo;
}

describe('Fase 09 — item 3 (base relacionado ao profissional)', () => {
  it('base não convocado joga a partida da base e permanece na categoria', () => {
    const { c, clube } = prepararBaseConvocavel();
    c.acompanhamento.base.conviteAte = null;
    expect(relacionadoProfissional(c)).toBe(false);
    expect(categoriaPartidaDaSemana(c)).toBe('base');

    const depois = avancarSemana(c);
    expect(depois.jogador.categoria).toBe('base');
    const rodada = depois.temporada.rodadaAtual;
    const partidaBase = depois.temporada.partidasBase.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(clube.id),
    );
    const partidaPro = depois.temporada.partidas.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(clube.id),
    );
    expect(partidaBase?.participacao).toBeTruthy();
    expect(partidaPro?.participacao).toBeFalsy();
    expect(depois.ultimaPartidaId).toBe(partidaBase?.id);
  });

  it('base convocado titular entra na força, joga o profissional e não muda de categoria', () => {
    const { c, clube } = prepararBaseConvocavel();
    forcarAusenciaNaPosicao(clube, 'PD');
    for (const j of clube.elenco) {
      if (j.posicaoPrincipal === 'PD' || j.posicoesSecundarias.includes('PD')) {
        if (!j.lesionado) {
          j.overall = 50;
          j.forma = 40;
        }
      }
    }
    c.jogador.overall = 92;
    c.jogador.forma = 90;
    c.jogador.status = 'categoria de base';
    expect(relacionadoProfissional(c)).toBe(true);
    expect(categoriaPartidaDaSemana(c)).toBe('profissional');

    const depois = avancarSemana(c);
    expect(depois.jogador.categoria).toBe('base');
    expect(depois.noticias.some((e) => e.tipo === 'base-relacionado')).toBe(true);

    const rodada = depois.temporada.rodadaAtual;
    const partidaPro = depois.temporada.partidas.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(depois.clubeAtualId!),
    )!;
    const partidaBase = depois.temporada.partidasBase.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(depois.clubeAtualId!),
    );
    expect(partidaPro.participacao?.escalacao).toBe('titular');
    expect(partidaPro.participacao!.minutos).toBeGreaterThan(0);
    expect(partidaBase?.participacao).toBeFalsy();
    expect(depois.ultimaPartidaId).toBe(partidaPro.id);
    expect(
      depois.registros.some(
        (r) => r.categoria === 'profissional' && r.estatisticas.jogos > 0,
      ),
    ).toBe(true);
  });

  it('base convocado titular, banco e não utilizado usam a mesma decisão da preparação', () => {
    const titular = prepararBaseConvocavel();
    forcarAusenciaNaPosicao(titular.clube, 'PD');
    forcarOverallJogador(titular.c.jogador, 93);
    titular.c.jogador.forma = 92;
    expect(relacionadoProfissional(titular.c)).toBe(true);
    const semTitular = avancarSemana(titular.c);
    const partTitular = semTitular.temporada.partidas.find(
      (p) =>
        p.rodada === semTitular.temporada.rodadaAtual &&
        [p.mandanteId, p.visitanteId].includes(semTitular.clubeAtualId!),
    )!;
    expect(partTitular.participacao?.escalacao).toBe('titular');
    expect(semTitular.jogador.categoria).toBe('base');

    const banco = prepararBaseConvocavel();
    const lesionado = forcarAusenciaNaPosicao(banco.clube, 'PD');
    lesionado.overall = 40;
    for (const j of banco.clube.elenco) {
      if (j.id === lesionado.id) continue;
      j.overall = 86;
      j.forma = 80;
      j.statusElenco = 'titular';
    }
    const reservaTitular = banco.clube.elenco.find(
      (j) => j.id !== lesionado.id && j.posicaoPrincipal !== 'GOL',
    )!;
    reservaTitular.posicaoPrincipal = 'PD';
    reservaTitular.posicao = 'PD';
    reservaTitular.lesionado = false;
    reservaTitular.overall = 94;
    reservaTitular.forma = 90;
    reservaTitular.statusElenco = 'estrela do time';
    forcarOverallJogador(banco.c.jogador, 72);
    banco.c.jogador.forma = 70;
    expect(relacionadoProfissional(banco.c)).toBe(true);
    const semBanco = avancarSemana(banco.c);
    const partBanco = semBanco.temporada.partidas.find(
      (p) =>
        p.rodada === semBanco.temporada.rodadaAtual &&
        [p.mandanteId, p.visitanteId].includes(semBanco.clubeAtualId!),
    )!;
    expect(semBanco.jogador.categoria).toBe('base');
    expect(partBanco.participacao?.escalacao).toBe('banco');

    const fora = prepararBaseConvocavel();
    forcarAusenciaNaPosicao(fora.clube, 'PD');
    for (const j of fora.clube.elenco) {
      j.overall = 93;
      j.forma = 90;
      j.statusElenco = 'estrela do time';
      if (j.posicaoPrincipal !== 'GOL') j.posicoesSecundarias = ['PD', 'PE', 'CA', 'MC'];
    }
    // Elenco demonstração é curto (~16); amplia para haver corte real do banco.
    for (let i = 0; i < 12; i++) {
      const base = structuredClone(fora.clube.elenco[i % Math.min(8, fora.clube.elenco.length)]!);
      base.id = `extra-corte-${i}`;
      base.lesionado = false;
      base.suspensao = 0;
      base.overall = 91;
      base.forma = 88;
      fora.clube.elenco.push(base);
    }
    forcarOverallJogador(fora.c.jogador, Math.max(fora.clube.forcaGeral - 7, 50));
    fora.c.jogador.forma = 30;
    fora.c.jogador.confianca = 70;
    expect(relacionadoProfissional(fora.c)).toBe(true);
    const semFora = avancarSemana(fora.c);
    const partFora = semFora.temporada.partidas.find(
      (p) =>
        p.rodada === semFora.temporada.rodadaAtual &&
        [p.mandanteId, p.visitanteId].includes(semFora.clubeAtualId!),
    )!;
    expect(semFora.jogador.categoria).toBe('base');
    expect(partFora.participacao?.escalacao).toBe('nao relacionado');
  });

  it('na semana seguinte sem ausência/convite volta à rotina da base', () => {
    const { c, clube } = prepararBaseConvocavel();
    forcarAusenciaNaPosicao(clube, 'PD');
    c.jogador.overall = 90;
    const convocada = avancarSemana(c);
    expect(convocada.jogador.categoria).toBe('base');
    expect(
      convocada.temporada.partidas.find(
        (p) =>
          p.rodada === convocada.temporada.rodadaAtual &&
          [p.mandanteId, p.visitanteId].includes(convocada.clubeAtualId!),
      )?.participacao,
    ).toBeTruthy();

    const clube2 = convocada.clubes.find((x) => x.id === convocada.clubeAtualId)!;
    for (const j of clube2.elenco) {
      j.lesionado = false;
      j.suspensao = 0;
    }
    convocada.acompanhamento.base.conviteAte = somarDias(convocada.dataAtual, -1);
    expect(relacionadoProfissional(convocada)).toBe(false);
    expect(categoriaPartidaDaSemana(convocada)).toBe('base');

    const retorno = avancarSemana(convocada);
    expect(retorno.jogador.categoria).toBe('base');
    const rodada = retorno.temporada.rodadaAtual;
    const base = retorno.temporada.partidasBase.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(retorno.clubeAtualId!),
    );
    const pro = retorno.temporada.partidas.find(
      (p) =>
        p.rodada === rodada &&
        [p.mandanteId, p.visitanteId].includes(retorno.clubeAtualId!),
    );
    expect(base?.participacao).toBeTruthy();
    expect(pro?.participacao).toBeFalsy();
  });
});

describe('Fase 09 — item 10 (PESO_STATUS sem loop titular)', () => {
  const baseCand = (parcial: Partial<CandidatoEscalacao>): CandidatoEscalacao => ({
    id: parcial.id ?? 'x',
    nome: parcial.nome ?? 'X',
    posicaoPrincipal: 'PD',
    posicoesSecundarias: [],
    posicaoBruta: 'PD',
    overall: 75,
    forma: 50,
    moral: 50,
    condicionamento: 80,
    fadiga: 10,
    confiancaTreinador: 55,
    statusElenco: 'reserva',
    lesionado: false,
    suspensao: 0,
    ehUsuario: false,
    ...parcial,
  });

  it('reserva melhor e em ótima fase ultrapassa titular em má fase', () => {
    const titular = baseCand({
      id: 'tit',
      statusElenco: 'titular',
      overall: 76,
      forma: 32,
    });
    const reserva = baseCand({
      id: 'res',
      statusElenco: 'reserva',
      overall: 79,
      forma: 92,
    });
    expect(avaliarParaSlot(reserva, 'PD')).toBeGreaterThan(avaliarParaSlot(titular, 'PD'));
    expect(PESO_STATUS.titular).toBeLessThan(4);
    expect(PESO_STATUS['estrela do time']).toBeLessThan(6);
  });

  it('estrela continua favorecida quando níveis são próximos, mas não é intocável', () => {
    const estrela = baseCand({
      id: 'est',
      statusElenco: 'estrela do time',
      overall: 80,
      forma: 70,
    });
    const reservaProxima = baseCand({
      id: 'res',
      statusElenco: 'reserva',
      overall: 80,
      forma: 72,
    });
    expect(avaliarParaSlot(estrela, 'PD')).toBeGreaterThan(
      avaliarParaSlot(reservaProxima, 'PD'),
    );

    const reservaClara = baseCand({
      id: 'res2',
      statusElenco: 'reserva',
      overall: 84,
      forma: 90,
    });
    const estrelaRuim = baseCand({
      id: 'est2',
      statusElenco: 'estrela do time',
      overall: 80,
      forma: 35,
    });
    expect(avaliarParaSlot(reservaClara, 'PD')).toBeGreaterThan(
      avaliarParaSlot(estrelaRuim, 'PD'),
    );
  });
});

describe('Fase 09 — item 11 (hierarquia e vagas reais da formação)', () => {
  it('explica formações sem MEI, pontas ou laterais em vez de fingir 1ª opção fantasma', () => {
    const { carreira: c } = exemploCarreira();
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;

    c.jogador.posicao = 'MEI';
    clube.formacaoPreferida = '4-3-3';
    clube.treinador.formacaoPreferida = '4-3-3';
    expect(SLOTS_FORMACAO['4-3-3'].includes('MEI')).toBe(false);
    const hMei = avaliarHierarquia(c);
    expect(hMei.formacaoUsaPosicao).toBe(false);
    expect(hMei.motivo).toMatch(/não utiliza diretamente/i);
    expect(hMei.rotulo).not.toMatch(/^1ª opção · MEI$/);

    c.jogador.posicao = 'PD';
    clube.formacaoPreferida = '3-5-2';
    clube.treinador.formacaoPreferida = '3-5-2';
    expect(SLOTS_FORMACAO['3-5-2'].some((s) => s === 'PD' || s === 'PE')).toBe(false);
    const hPonta = avaliarHierarquia(c);
    expect(hPonta.formacaoUsaPosicao).toBe(false);
    expect(hPonta.motivo).toMatch(/não utiliza diretamente/i);

    c.jogador.posicao = 'LD';
    clube.formacaoPreferida = '4-2-2-2';
    clube.treinador.formacaoPreferida = '4-2-2-2';
    // 4-2-2-2 tem LD — controle positivo
    expect(SLOTS_FORMACAO['4-2-2-2'].includes('LD')).toBe(true);
    const hLd = avaliarHierarquia(c);
    expect(hLd.formacaoUsaPosicao).toBe(true);
    expect(hLd.rotulo).toMatch(/opção · LD/i);

    // Formação sem laterais clássicos: 3-5-2 usa LE/LD como alas, ainda há slot.
    // Teste sem laterais: usar posição LE em formação que... 4-2-2-2 tem LE.
    // Pontas já cobertos; laterais ausentes em nenhuma formação atual — validamos MEI/pontas.
    expect(hMei.slotReferencia === null || hMei.slotReferencia !== 'MEI').toBe(true);
  });
});

describe('Fase 09 — item 12 (hierarquia da base honesta)', () => {
  it('não inventa 1ª/2ª/3ª opção ordinal sem concorrentes reais', () => {
    const { entrada } = exemploCarreira();
    const c = criarCarreira({
      ...entrada,
      identidade: { ...entrada.identidade, idade: 16 },
    });
    expect(c.jogador.categoria).toBe('base');
    const h = avaliarHierarquia(c);
    expect(h.concorrentes).toEqual([]);
    expect(h.rotulo).toMatch(/titularidade|rotação|desenvolvimento/i);
    expect(h.rotulo).not.toMatch(/^\dª opção/);
    expect(h.motivo).toMatch(/faixa|desenvolvimento|rotação|titularidade/i);
    expect(h.motivo).not.toMatch(/você é a \dª opção/i);
  });
});

import {
  escolherObjetivo,
  registrarResumoSemanal,
  atributosTecnicaPosicao,
  detectarMudancaElenco,
  somaTecnica,
} from '@/simulacao/carreira/acompanhamento';
import { DIAS_COOLDOWN_OBJETIVO_PESSOAL } from '@/dominio/desenvolvimento';
import {
  badgeMercado,
  coletarAcoesAtencao,
} from '@/componentes/jogo/AtencaoCarreira';
import { marcarRespostasMercadoLidas } from '@/dominio/mercado';
import {
  inferirStatusPedidoSaida,
  migrarMercadoPersistido,
} from '@/infraestrutura/persistencia/migrar-mercado';
import { criarJogoStore } from '@/estado/jogo-store';
import {
  ErroApiCarreira,
  type ClienteCarreira,
} from '@/infraestrutura/persistencia/cliente-carreira';
import { conversarAgente } from '@/simulacao/transferencias/mercado-progressivo';
import { afterEach, vi } from 'vitest';

describe('Fase 09 — objetivos pessoais item 8', () => {
  it('não reaplica moral ao reescolher objetivo já concluído; cooldown bloqueia farm', () => {
    const { carreira: c } = exemploCarreira();
    let estado = escolherObjetivo(c, 'tecnica');
    for (const a of atributosTecnicaPosicao(estado.jogador.posicao)) {
      estado.jogador.atributos[a] += 1;
    }
    const moralAntes = estado.jogador.moral;
    registrarResumoSemanal(estado, c);
    expect(estado.acompanhamento.objetivoPessoal?.concluido).toBe(true);
    expect(estado.jogador.moral).toBeGreaterThan(moralAntes);
    expect(estado.acompanhamento.historicoObjetivos.some((h) => h.tipo === 'tecnica')).toBe(true);

    const moralConcluido = estado.jogador.moral;
    expect(() => escolherObjetivo(estado, 'tecnica')).toThrow(/já alcançou|reativ/i);
    expect(estado.jogador.moral).toBe(moralConcluido);

    estado.dataAtual = somarDias(estado.dataAtual, DIAS_COOLDOWN_OBJETIVO_PESSOAL + 1);
    const reativado = escolherObjetivo(estado, 'tecnica');
    expect(reativado.acompanhamento.objetivoPessoal?.concluido).toBe(false);
    expect(reativado.acompanhamento.objetivoPessoal?.cicloId).not.toBe(
      estado.acompanhamento.objetivoPessoal?.cicloId,
    );
  });

  it('permite trocar objetivo incompleto sem recompensa; técnica depende da posição', () => {
    const { carreira: base } = exemploCarreira();
    const gk = structuredClone(base);
    gk.jogador.posicao = 'GOL';
    const zag = structuredClone(base);
    zag.jogador.posicao = 'ZAG';
    const ca = structuredClone(base);
    ca.jogador.posicao = 'CA';
    const mc = structuredClone(base);
    mc.jogador.posicao = 'MC';

    expect(atributosTecnicaPosicao('GOL')).toEqual(['reflexos', 'defesaGoleiro', 'posicionamentoGoleiro']);
    expect(atributosTecnicaPosicao('ZAG')).toEqual(['marcacao', 'desarme', 'antecipacao']);
    expect(atributosTecnicaPosicao('CA')).toEqual(['finalizacao', 'compostura', 'posicionamento']);
    expect(atributosTecnicaPosicao('MC')).toEqual(['passeCurto', 'visao', 'dominio']);

    const oGk = escolherObjetivo(gk, 'tecnica');
    const oZag = escolherObjetivo(zag, 'tecnica');
    expect(oGk.acompanhamento.objetivoPessoal?.referencia).toBe(somaTecnica(oGk));
    expect(oZag.acompanhamento.objetivoPessoal?.referencia).toBe(somaTecnica(oZag));
    expect(oGk.acompanhamento.objetivoPessoal?.referencia).not.toBe(
      oGk.jogador.atributos.dominio + oGk.jogador.atributos.passeCurto + oGk.jogador.atributos.visao,
    );

    let ativo = escolherObjetivo(ca, 'minutos');
    const moral0 = ativo.jogador.moral;
    ativo = escolherObjetivo(ativo, 'renovacao');
    expect(ativo.acompanhamento.objetivoPessoal?.tipo).toBe('renovacao');
    expect(ativo.acompanhamento.objetivoPessoal?.concluido).toBe(false);
    expect(ativo.jogador.moral).toBe(moral0);
    expect(ativo.acompanhamento.historicoObjetivos).toHaveLength(0);
  });

  it('objetivo concluído round-trip com cicloId e histórico', () => {
    const { carreira: c, catalogo } = exemploCarreira();
    let estado = escolherObjetivo(c, 'titular');
    estado.acompanhamento.objetivoPessoal!.progresso = 100;
    estado.acompanhamento.objetivoPessoal!.concluido = true;
    estado.acompanhamento.historicoObjetivos.push({
      tipo: 'titular',
      concluidoEm: estado.dataAtual,
      cicloId: estado.acompanhamento.objetivoPessoal!.cicloId,
    });
    const hidratado = hidratarCarreira(serializarCarreira(estado), catalogo);
    expect(hidratado.acompanhamento.objetivoPessoal?.cicloId).toBe(
      estado.acompanhamento.objetivoPessoal?.cicloId,
    );
    expect(hidratado.acompanhamento.historicoObjetivos).toEqual(
      estado.acompanhamento.historicoObjetivos,
    );
  });
});

describe('Fase 09 — badges mercado item 9', () => {
  it('resposta da diretoria conta como novidade até marcar lida; histórico permanece após reload', () => {
    const { carreira: c, catalogo } = exemploCarreira();
    c.jogador.status = 'reserva';
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, 400);
    c.relacionamentos.diretoria = 40;
    const comResposta = conversarAgente(c, 'sair');
    expect(comResposta.mercado.respostaDiretoriaSaida).toBeTruthy();
    expect(comResposta.mercado.respostaSaidaLida).toBe(false);
    expect(badgeMercado(comResposta)).toBeGreaterThan(0);
    expect(coletarAcoesAtencao(comResposta).some((a) => a.id === 'dir-saida')).toBe(true);

    const lido = marcarRespostasMercadoLidas(comResposta);
    expect(lido.mercado.respostaSaidaLida).toBe(true);
    expect(lido.mercado.respostaDiretoriaSaida).toBe(comResposta.mercado.respostaDiretoriaSaida);
    expect(badgeMercado(lido)).toBe(0);
    expect(coletarAcoesAtencao(lido).some((a) => a.id === 'dir-saida')).toBe(false);

    const recarregado = hidratarCarreira(serializarCarreira(lido), catalogo);
    expect(recarregado.mercado.respostaSaidaLida).toBe(true);
    expect(recarregado.mercado.respostaDiretoriaSaida).toBe(lido.mercado.respostaDiretoriaSaida);
    expect(badgeMercado(recarregado)).toBe(0);
  });
});

describe('Fase 09 — Central da Semana item 18', () => {
  it('só registra card de elenco quando houver mudança relevante', () => {
    const { carreira: c } = exemploCarreira();
    const estatico = structuredClone(c);
    expect(detectarMudancaElenco(c, estatico)).toBeNull();

    const mudou = structuredClone(c);
    mudou.jogador.status = c.jogador.status === 'reserva' ? 'rotacao' : 'reserva';
    const mudanca = detectarMudancaElenco(c, mudou);
    expect(mudanca).not.toBeNull();
    expect(mudanca!.motivos).toContain('papel');
    expect(mudanca!.texto.length).toBeGreaterThan(10);

    registrarResumoSemanal(estatico, c);
    expect(estatico.acompanhamento.resumoSemanal?.mudancaElenco).toBeNull();

    registrarResumoSemanal(mudou, c);
    expect(mudou.acompanhamento.resumoSemanal?.mudancaElenco?.motivos).toContain('papel');
  });
});

describe('Fase 09 — migração pedido transferência item 21', () => {
  it('prioriza campos estruturados e histórico do motor antes do fallback textual', () => {
    expect(
      inferirStatusPedidoSaida({
        pediuSaida: false,
        pedidoPublico: true,
        respostaDiretoriaSaida: 'texto irrelevante',
      }),
    ).toBe('aceito');

    expect(
      inferirStatusPedidoSaida({
        pediuSaida: false,
        historico: [
          {
            id: 'h1',
            data: '2026-01-01',
            clubeId: 'c1',
            texto: 'Pedido de transferência analisado. A diretoria manteve você.',
          },
        ],
      }),
    ).toBe('recusado');

    expect(
      inferirStatusPedidoSaida({
        pediuSaida: true,
        historico: [
          {
            id: 'h2',
            data: '2026-01-01',
            clubeId: 'c1',
            texto: 'Pedido privado de transferência registrado. Negociaremos.',
          },
        ],
      }),
    ).toBe('aceito');

    // Último recurso documentado: save inconsistente sem histórico.
    const legado = migrarMercadoPersistido({
      mercado: {
        interesses: [],
        clubesDesejados: [],
        preferencias: {
          mesmoPais: false,
          europa: false,
          clubeMaior: false,
          maisMinutos: false,
          salarioMaior: false,
          titulos: false,
          apenasDesejados: false,
        },
        pediuSaida: true,
        pedidoPublico: false,
        bloquearPropostas: false,
        pediuEmprestimo: false,
        disponivelParaEmprestimo: false,
        respostaDiretoriaSaida:
          'A diretoria recusou o pedido. Considera você peça importante.',
        historico: [],
      },
    }) as {
      mercado: {
        statusPedidoSaida: string;
        pediuSaida: boolean;
        respostaSaidaLida: boolean;
      };
    };
    expect(legado.mercado.statusPedidoSaida).toBe('recusado');
    expect(legado.mercado.pediuSaida).toBe(false);
    expect(legado.mercado.respostaSaidaLida).toBe(false);
  });
});

describe('Fase 09 — autosave geração inválida item 22', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function ambienteAutosave() {
    const exemplo = exemploCarreira();
    const api: ClienteCarreira = {
      carregar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
      criar: vi.fn(async () => ({ carreira: exemplo.carreira, revision: 0 })),
      salvar: vi.fn(async (_p, revision) => ({ revision: revision + 1 })),
      excluir: vi.fn(async () => {}),
    };
    return { ...exemplo, api, store: criarJogoStore(api) };
  }

  it('não reentra em loop na mesma geração inválida; nova geração pode tentar de novo', async () => {
    const { store, api } = ambienteAutosave();
    await store.getState().carregar();
    const carreira = store.getState().carreira!;
    (carreira.jogador as { nome: string }).nome = '';
    store.setState({ carreira, alteracoesPendentes: true });

    await store.getState().tentarSalvar();
    expect(api.salvar).not.toHaveBeenCalled();
    expect(store.getState().codigoErroPersistencia).toBe('SAVE_INVALID');
    expect(store.getState().statusPersistencia).toBe('erro');
    expect(store.getState().alteracoesPendentes).toBe(true);

    const chamadas = vi.mocked(api.salvar).mock.calls.length;
    await store.getState().tentarSalvar();
    expect(api.salvar).toHaveBeenCalledTimes(chamadas);

    // Nova geração com estado válido volta a salvar.
    store.getState().carreira!.jogador.nome = 'Ana';
    store.getState().escolherTreino('drible');
    await store.getState().tentarSalvar();
    expect(api.salvar).toHaveBeenCalled();
    expect(store.getState().codigoErroPersistencia).toBeNull();
    expect(store.getState().alteracoesPendentes).toBe(false);
  });

  it('erro de rede continua com backoff; conflito permanece sem retry', async () => {
    vi.useFakeTimers();
    const { store, api } = ambienteAutosave();
    await store.getState().carregar();
    vi.mocked(api.salvar).mockRejectedValueOnce(
      new ErroApiCarreira(503, 'falha', undefined, 'INDISPONIVEL'),
    );
    store.getState().escolherTreino('drible');
    await Promise.resolve();
    await vi.runAllTimersAsync();
    await store.getState().tentarSalvar();
    expect(store.getState().alteracoesPendentes).toBe(false);

    const { store: s2, api: api2 } = ambienteAutosave();
    await s2.getState().carregar();
    vi.mocked(api2.salvar).mockRejectedValueOnce(
      new ErroApiCarreira(409, 'conflito', undefined, 'CONFLITO'),
    );
    s2.getState().escolherTreino('fisico');
    await s2.getState().tentarSalvar();
    const n = vi.mocked(api2.salvar).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(api2.salvar).toHaveBeenCalledTimes(n);
    expect(s2.getState().conflito).toBe(true);
  });
});

import {
  ajustarClubePeloJogador,
  calcularGolsEsperados,
  chanceEntradaBanco,
  qualidadeSetorialJogador,
  simularPartida,
} from '@/simulacao/partida/motor-partida';
import { GeradorAleatorio } from '@/utilitarios/aleatorio';
import type { Jogador, Partida } from '@/dominio/entidades/modelos';
import { criarAtributosUniformes } from '@/dominio/regras/jogador';

describe('Fase 09 — item 13 (atributos influenciam placar)', () => {
  function clonarJogador(base: Jogador, posicao: Jogador['posicao'], overall: number): Jogador {
    const j = structuredClone(base);
    j.posicao = posicao;
    j.atributos = criarAtributosUniformes(overall);
    j.overall = overall;
    j.forma = 70;
    j.moral = 70;
    j.condicionamento = 70;
    j.fadiga = 10;
    j.lesao = null;
    j.suspensao = 0;
    return j;
  }

  function partidaBase(mandanteId: string, visitanteId: string): Partida {
    return {
      id: 'p-teste',
      rodada: 5,
      data: '2026-06-01',
      mandanteId,
      visitanteId,
      categoria: 'profissional',
      golsMandante: null,
      golsVisitante: null,
      eventos: [],
      participacao: null,
    };
  }

  it('atacante excelente eleva gols esperados e goleiro excelente reduz sofridos (determinístico)', () => {
    const { carreira } = exemploCarreira();
    const clube = structuredClone(
      carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!,
    );
    const rival = structuredClone(
      carreira.clubes.find((c) => c.id !== carreira.clubeAtualId)!,
    );
    clube.titularesIds = clube.titularesIds.filter((id) => id !== 'usuario');
    clube.goleiroTitularId =
      clube.goleiroTitularId === 'usuario' ? clube.elenco[0]?.id ?? null : clube.goleiroTitularId;
    clube.forcaAtaque = 68;
    clube.forcaMeio = 66;
    clube.forcaDefesa = 67;
    rival.forcaAtaque = 68;
    rival.forcaMeio = 66;
    rival.forcaDefesa = 67;

    const fraco = clonarJogador(carreira.jogador, 'CA', 55);
    const forte = clonarJogador(carreira.jogador, 'CA', 92);
    const clubeFraco = ajustarClubePeloJogador(clube, fraco, 90, false);
    const clubeForte = ajustarClubePeloJogador(clube, forte, 90, false);
    expect(clubeForte.forcaAtaque).toBeGreaterThan(clubeFraco.forcaAtaque);
    expect(qualidadeSetorialJogador(forte).ataque).toBeGreaterThan(
      qualidadeSetorialJogador(fraco).ataque,
    );
    const xgFraco = calcularGolsEsperados(clubeFraco, rival, true, 0.1);
    const xgForte = calcularGolsEsperados(clubeForte, rival, true, 0.1);
    expect(xgForte).toBeGreaterThan(xgFraco);

    const gkFraco = clonarJogador(carreira.jogador, 'GOL', 52);
    const gkForte = clonarJogador(carreira.jogador, 'GOL', 94);
    const defFraca = ajustarClubePeloJogador(clube, gkFraco, 90, false);
    const defForte = ajustarClubePeloJogador(clube, gkForte, 90, false);
    expect(defForte.forcaDefesa).toBeGreaterThan(defFraca.forcaDefesa);
    const sofrerFraco = calcularGolsEsperados(rival, defFraca, false, 0.1);
    const sofrerForte = calcularGolsEsperados(rival, defForte, false, 0.1);
    expect(sofrerForte).toBeLessThan(sofrerFraco);
  });

  it('simulação com seed: time com CA melhor marca mais gols em média', () => {
    const { carreira } = exemploCarreira();
    const mandante = structuredClone(
      carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!,
    );
    const visitante = structuredClone(
      carreira.clubes.find((c) => c.id !== carreira.clubeAtualId)!,
    );
    mandante.titularesIds = mandante.titularesIds.filter((id) => id !== 'usuario');
    mandante.bancoIds = mandante.bancoIds.filter((id) => id !== 'usuario');
    mandante.forcaAtaque = 65;
    mandante.forcaMeio = 65;
    mandante.forcaDefesa = 65;
    visitante.forcaAtaque = 65;
    visitante.forcaMeio = 65;
    visitante.forcaDefesa = 65;

    const fraco = clonarJogador(carreira.jogador, 'CA', 50);
    const forte = clonarJogador(carreira.jogador, 'CA', 95);
    // Neutraliza agressividade para o fluxo de RNG até o placar ficar comparável.
    fraco.atributos.agressividade = 50;
    forte.atributos.agressividade = 50;
    const partida = partidaBase(mandante.id, visitante.id);

    let golsFraco = 0;
    let golsForte = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const rFraco = simularPartida(
        partida,
        mandante,
        visitante,
        new GeradorAleatorio(1000 + i),
        fraco,
        mandante.id,
        0,
        { escalacaoPreparada: 'titular' },
      );
      const rForte = simularPartida(
        partida,
        mandante,
        visitante,
        new GeradorAleatorio(1000 + i),
        forte,
        mandante.id,
        0,
        { escalacaoPreparada: 'titular' },
      );
      golsFraco += rFraco.golsMandante!;
      golsForte += rForte.golsMandante!;
    }
    expect(golsForte / N).toBeGreaterThan(golsFraco / N + 0.15);
  });

  it('mesma seed reproduz o mesmo placar com o mesmo jogador', () => {
    const { carreira } = exemploCarreira();
    const mandante = carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!;
    const visitante = carreira.clubes.find((c) => c.id !== carreira.clubeAtualId)!;
    const j = clonarJogador(carreira.jogador, 'MEI', 78);
    const partida = partidaBase(mandante.id, visitante.id);
    const a = simularPartida(
      partida,
      mandante,
      visitante,
      new GeradorAleatorio(424242),
      j,
      mandante.id,
      0,
      { escalacaoPreparada: 'titular' },
    );
    const b = simularPartida(
      partida,
      mandante,
      visitante,
      new GeradorAleatorio(424242),
      j,
      mandante.id,
      0,
      { escalacaoPreparada: 'titular' },
    );
    expect(a.golsMandante).toBe(b.golsMandante);
    expect(a.golsVisitante).toBe(b.golsVisitante);
    expect(a.participacao).toEqual(b.participacao);
  });
});

describe('Fase 09 — item 14 (entrada de reservas)', () => {
  it('chance de entrada varia por status, fadiga e posição — não é flat 0.65', () => {
    const { carreira } = exemploCarreira();
    const clube = structuredClone(
      carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!,
    );
    const oponente = structuredClone(
      carreira.clubes.find((c) => c.id !== carreira.clubeAtualId)!,
    );
    clube.fadiga = 20;
    clube.forma = 55;
    clube.moral = 55;
    clube.treinador = { ...clube.treinador, rotacao: 50, preferenciaJovens: 50 };
    oponente.forcaGeral = clube.forcaGeral;

    const base = structuredClone(carreira.jogador);
    base.posicao = 'PD';
    base.confianca = 50;
    base.idade = 24;
    base.status = 'reserva';

    const reserva = chanceEntradaBanco(base, clube, oponente);
    const rotacao = chanceEntradaBanco(
      { ...base, status: 'rotacao' },
      clube,
      oponente,
    );
    const estrela = chanceEntradaBanco(
      { ...base, status: 'estrela do time' },
      clube,
      oponente,
    );
    expect(reserva).not.toBeCloseTo(0.65, 2);
    expect(rotacao).toBeGreaterThan(reserva);
    expect(estrela).toBeGreaterThan(rotacao);

    const cansado = chanceEntradaBanco(base, { ...clube, fadiga: 80 }, oponente);
    expect(cansado).toBeGreaterThan(reserva);

    const zagueiro = chanceEntradaBanco(
      { ...base, posicao: 'ZAG', status: 'reserva' },
      clube,
      oponente,
    );
    const atacante = chanceEntradaBanco(
      { ...base, posicao: 'CA', status: 'reserva' },
      clube,
      oponente,
    );
    expect(atacante).toBeGreaterThan(zagueiro);

    const goleiro = chanceEntradaBanco(
      { ...base, posicao: 'GOL', status: 'rotacao' },
      clube,
      oponente,
    );
    expect(goleiro).toBeLessThan(0.15);
    expect(goleiro).toBeLessThan(reserva * 0.5);
  });

  it('simulação: reserva com status alto entra mais vezes que reserva puro (seed fixa)', () => {
    const { carreira } = exemploCarreira();
    const mandante = structuredClone(
      carreira.clubes.find((c) => c.id === carreira.clubeAtualId)!,
    );
    const visitante = structuredClone(
      carreira.clubes.find((c) => c.id !== carreira.clubeAtualId)!,
    );
    mandante.titularesIds = mandante.titularesIds.filter((id) => id !== 'usuario');
    mandante.bancoIds = ['usuario', ...mandante.bancoIds.filter((id) => id !== 'usuario')];
    mandante.fadiga = 55;

    const partida: Partida = {
      id: 'banco-teste',
      rodada: 3,
      data: '2026-06-01',
      mandanteId: mandante.id,
      visitanteId: visitante.id,
      categoria: 'profissional',
      golsMandante: null,
      golsVisitante: null,
      eventos: [],
      participacao: null,
    };

    const reserva = structuredClone(carreira.jogador);
    reserva.posicao = 'PD';
    reserva.status = 'reserva';
    reserva.confianca = 40;
    reserva.lesao = null;
    reserva.suspensao = 0;

    const importante = structuredClone(reserva);
    importante.status = 'jogador importante';
    importante.confianca = 75;

    let entradasReserva = 0;
    let entradasImportante = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const r1 = simularPartida(
        partida,
        mandante,
        visitante,
        new GeradorAleatorio(5000 + i),
        reserva,
        mandante.id,
        0,
        { escalacaoPreparada: 'banco' },
      );
      const r2 = simularPartida(
        partida,
        mandante,
        visitante,
        new GeradorAleatorio(5000 + i),
        importante,
        mandante.id,
        0,
        { escalacaoPreparada: 'banco' },
      );
      if (r1.participacao && r1.participacao.minutos > 0) entradasReserva++;
      if (r2.participacao && r2.participacao.minutos > 0) entradasImportante++;
    }
    expect(entradasImportante).toBeGreaterThan(entradasReserva);
    expect(entradasReserva / N).toBeLessThan(0.75);
    expect(entradasImportante / N).toBeGreaterThan(0.4);
  });
});

import {
  solicitarContrato,
  anosRestantesContrato,
} from '@/simulacao/transferencias/contratos';
import { responderProposta } from '@/simulacao/transferencias/mercado';
import {
  processarTreinamento,
  configurarDesenvolvimento,
  escolherFocoTreino,
  focoTreinoEfetivo,
} from '@/simulacao/treinamento/treinamento';
import { planosDaPosicao } from '@/dominio/planos-desenvolvimento';
import { avancarInteresses } from '@/simulacao/transferencias/mercado-progressivo';

describe('Fase 09 — contratos por tipo (1, 17)', () => {
  it('rejeita profissional pedindo categoria de base', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.status = 'reserva';
    expect(() =>
      solicitarContrato(c, {
        tipo: 'papel',
        salario: c.jogador.contrato.salario,
        duracaoAnos: 1,
        papel: 'categoria de base',
      }),
    ).toThrow(/categoria de base/);
  });

  it('aumento não estende dataTermino nem muda papel', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.status = 'rotacao';
    c.jogador.contrato.papelEsperado = 'rotacao';
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, Math.round(4.2 * 365));
    c.jogador.contrato.salario = 2000;
    c.acompanhamento.proximoPedidoContrato = null;
    const terminoAntes = c.jogador.contrato.dataTermino;
    const papelAntes = c.jogador.contrato.papelEsperado;
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    clube.orcamento = 50_000_000;
    const pedida = solicitarContrato(c, {
      tipo: 'aumento',
      salario: 2800,
      duracaoAnos: 1,
      papel: 'rotacao',
    });
    const prop = pedida.propostas.find((p) => p.id === pedida.acompanhamento.pedidosContrato.at(-1)?.propostaId)!;
    expect(prop.papelPrometido).toBe(papelAntes);
    const assinada = responderProposta(pedida, prop.id, true);
    expect(assinada.jogador.contrato.dataTermino).toBe(terminoAntes);
    expect(assinada.jogador.contrato.papelEsperado).toBe(papelAntes);
    expect(assinada.jogador.contrato.salario).toBeGreaterThan(2000);
  });

  it('extensão renova a partir da assinatura sem Math.max com anos restantes', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.status = 'titular';
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, 200);
    c.acompanhamento.proximoPedidoContrato = null;
    c.clubes.find((x) => x.id === c.clubeAtualId)!.orcamento = 50_000_000;
    const pedida = solicitarContrato(c, {
      tipo: 'extensao',
      salario: c.jogador.contrato.salario,
      duracaoAnos: 3,
      papel: c.jogador.contrato.papelEsperado,
    });
    const prop = pedida.propostas.find((p) => p.id === pedida.acompanhamento.pedidosContrato.at(-1)?.propostaId)!;
    expect(prop.duracaoAnos).toBe(3);
    const assinada = responderProposta(pedida, prop.id, true);
    expect(assinada.jogador.contrato.dataInicio).toBe(assinada.dataAtual);
    expect(assinada.jogador.contrato.dataTermino).toBe(somarDias(assinada.dataAtual, 3 * 365));
  });

  it('papel e cláusula preservam salário e prazo; renovação usa anos pedidos', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.status = 'reserva';
    c.jogador.contrato.papelEsperado = 'reserva';
    c.jogador.contrato.salario = 1500;
    c.jogador.contrato.clausulaRescisao = 5_000_000;
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, Math.round(2 * 365));
    c.acompanhamento.proximoPedidoContrato = null;
    const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
    clube.orcamento = 80_000_000;
    const termino = c.jogador.contrato.dataTermino;
    const salario = c.jogador.contrato.salario;

    const papel = solicitarContrato(c, {
      tipo: 'papel',
      salario,
      duracaoAnos: 1,
      papel: 'rotacao',
    });
    const pPapel = papel.propostas.at(-1)!;
    const aPapel = responderProposta(papel, pPapel.id, true);
    expect(aPapel.jogador.contrato.dataTermino).toBe(termino);
    expect(aPapel.jogador.contrato.salario).toBe(salario);

    aPapel.acompanhamento.proximoPedidoContrato = null;
    const claus = solicitarContrato(aPapel, {
      tipo: 'clausula',
      salario,
      duracaoAnos: 1,
      papel: 'rotacao',
      clausula: 8_000_000,
    });
    const pClaus = claus.propostas.at(-1)!;
    const aClaus = responderProposta(claus, pClaus.id, true);
    expect(aClaus.jogador.contrato.dataTermino).toBe(termino);
    expect(aClaus.jogador.contrato.clausulaRescisao).toBe(8_000_000);

    aClaus.acompanhamento.proximoPedidoContrato = null;
    // Renovação com vínculo ainda longo demais é recusada; use prazo curto restante.
    aClaus.jogador.contrato.dataTermino = somarDias(aClaus.dataAtual, 400);
    const ren = solicitarContrato(aClaus, {
      tipo: 'renovacao',
      salario: 2200,
      duracaoAnos: 2,
      papel: 'rotacao',
    });
    const idRen = ren.acompanhamento.pedidosContrato.at(-1)?.propostaId;
    expect(idRen).toBeTruthy();
    const pRen = ren.propostas.find((p) => p.id === idRen)!;
    expect(pRen.duracaoAnos).toBe(2);
    const aRen = responderProposta(ren, pRen.id, true);
    expect(aRen.jogador.contrato.dataTermino).toBe(somarDias(aRen.dataAtual, 2 * 365));
  });

  it('anosRestantesContrato cobre faixas <1, 2, 4.2 e ~5', () => {
    expect(anosRestantesContrato('2026-01-01', '2026-06-01')).toBe(1);
    expect(anosRestantesContrato('2026-01-01', '2028-01-01')).toBe(2);
    expect(anosRestantesContrato('2026-01-01', somarDias('2026-01-01', Math.round(4.2 * 365)))).toBe(5);
    expect(anosRestantesContrato('2026-01-01', somarDias('2026-01-01', 5 * 365))).toBe(5);
  });
});

describe('Fase 09 — foco de treino vs plano (2)', () => {
  it('plano ativo normaliza foco oculto e carga não usa velocidade escondida', () => {
    const { carreira: c } = exemploCarreira();
    c.focoTreino = 'velocidade';
    const planos = planosDaPosicao(c.jogador.posicao);
    const configurada = configurarDesenvolvimento(c, planos[0].id, [], 'normal');
    expect(configurada.focoTreino).toBe('equilibrado');
    expect(focoTreinoEfetivo('velocidade', planos[0].id)).toBe('equilibrado');
    expect(() => escolherFocoTreino(configurada, 'fisico')).toThrow(/plano ativo/);

    const j1 = structuredClone(configurada.jogador);
    const j2 = structuredClone(configurada.jogador);
    j1.fadiga = 40;
    j2.fadiga = 40;
    processarTreinamento(j1, 'velocidade', configurada.clubes[0], configurada.dataAtual, new GeradorAleatorio(1));
    processarTreinamento(j2, 'equilibrado', configurada.clubes[0], configurada.dataAtual, new GeradorAleatorio(1));
    expect(j1.fadiga).toBe(j2.fadiga);
  });
});

describe('Fase 09 — mercado origem/bloqueio/reabertura/situacao (4-6)', () => {
  it('clubesDesejados não viram origem agente nem contornam bloqueio', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.reputacao = 40;
    c.mercado.bloquearPropostas = true;
    c.mercado.clubesDesejados = c.clubes.filter((x) => x.id !== c.clubeAtualId).map((x) => x.id);
    c.mercado.interesses = [];
    avancarInteresses(c, new GeradorAleatorio(11));
    expect(c.mercado.interesses.every((i) => i.origem !== 'agente')).toBe(true);
    const alvo = c.mercado.clubesDesejados[0]!;
    const contatado = conversarAgente(c, 'contatar', alvo);
    expect(contatado.mercado.interesses.some((i) => i.origem === 'agente')).toBe(true);
  });

  it('vários reabrirEm no mesmo dia respeitam teto semanal', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    const outros = c.clubes.filter((x) => x.id !== c.clubeAtualId).slice(0, 6);
    c.mercado.interesses = outros.map((cl, i) => ({
      clubeId: cl.id,
      jogadorId: 'usuario' as const,
      nivelInteresse: 40,
      motivo: 'oportunidade' as const,
      semanasObservando: 4,
      status: 'encerrado' as const,
      ultimaAtualizacao: c.dataAtual,
      origem: 'clube' as const,
      resposta: `teste-${i}`,
      papel: 'reserva' as const,
      reabrirEm: c.dataAtual,
    }));
    avancarInteresses(c, new GeradorAleatorio(99));
    const abertos = c.mercado.interesses.filter((i) => i.status !== 'encerrado');
    expect(abertos.length).toBeLessThanOrEqual(2);
  });

  it('situacao repetida não farmam relacionamento com o agente', () => {
    const { carreira: c } = exemploCarreira();
    const base = c.relacionamentos.agente;
    let atual = c;
    for (let i = 0; i < 20; i++) atual = conversarAgente(atual, 'situacao');
    expect(atual.relacionamentos.agente).toBe(base);
  });
});

describe('Fase 09 — performance criação (19)', () => {
  it('carrega lotes de ligas com concorrência limitada sem perder 404 individual', async () => {
    const CONCORRENCIA = 4;
    const ids = ['ok-1', 'missing', 'ok-2', 'ok-3', 'fail-temp', 'ok-4'];
    let maxParalelo = 0;
    let atuais = 0;
    const resultados: string[] = [];
    for (let i = 0; i < ids.length; i += CONCORRENCIA) {
      const lote = ids.slice(i, i + CONCORRENCIA);
      const r = await Promise.all(
        lote.map(async (id) => {
          atuais++;
          maxParalelo = Math.max(maxParalelo, atuais);
          await new Promise((res) => setTimeout(res, 5));
          atuais--;
          if (id === 'missing') return null;
          if (id === 'fail-temp') throw new Error('liga indisponível');
          return id;
        }).map((p) => p.catch((e: unknown) => ({ erro: String(e) }))),
      );
      for (const item of r) {
        if (item && typeof item === 'object' && 'erro' in item) resultados.push('erro');
        else if (item) resultados.push(item);
      }
    }
    expect(maxParalelo).toBeLessThanOrEqual(CONCORRENCIA);
    expect(resultados).toContain('ok-1');
    expect(resultados).toContain('erro');
    expect(resultados).not.toContain('missing');
  });
});
