import { describe, it, expect } from 'vitest';
import { exemploCarreira } from './auxiliar-carreira-persistida';
import { avancarSemana } from '@/aplicacao/casos-de-uso/avancar-tempo';
import {
  estaSemClube,
  tornarAgenteLivre,
  semanasSemClube,
  alertaFimContrato,
} from '@/simulacao/carreira/agente-livre';
import { responderProposta } from '@/simulacao/transferencias/mercado';
import { conversarAgente, avancarInteresses } from '@/simulacao/transferencias/mercado-progressivo';
import { conversarTreinador } from '@/simulacao/elenco/treinador';
import { avaliarHierarquia } from '@/simulacao/elenco/hierarquia';
import { processarTreinamento } from '@/simulacao/treinamento/treinamento';
import { serializarCarreira, hidratarCarreira } from '@/infraestrutura/persistencia/carreira-persistida';
import { GeradorAleatorio } from '@/utilitarios/aleatorio';
import { somarDias } from '@/utilitarios/formatacao';
import { categoriaPartidaDaSemana } from '@/simulacao/base/formacao';

function forcarFimContrato(c: ReturnType<typeof exemploCarreira>['carreira']) {
  c.jogador.categoria = 'profissional';
  c.jogador.status = 'rotacao';
  c.jogador.contrato.dataTermino = somarDias(c.dataAtual, -1);
  const clube = c.clubes.find((x) => x.id === c.clubeAtualId)!;
  c.acompanhamento.promessa = {
    tipo: 'minutos',
    clubeId: c.clubeAtualId!,
    treinadorId: clube.treinador.id,
    inicio: c.dataAtual,
    prazo: somarDias(c.dataAtual, 60),
    condicao: 'Disputar minutos',
    status: 'ativa',
    partidas: 1,
    limitePartidas: 5,
  };
  c.acompanhamento.objetivoPessoal = {
    tipo: 'minutos',
    inicio: c.dataAtual,
    referencia: 500,
    progresso: 10,
    concluido: false,
    cicloId: 'ciclo-minutos-1',
  };
  return c;
}

describe('Fase 10 — fim de contrato / agente livre', () => {
  it('sem acordo vira agente livre: sem provisório, sem -10% salário, clubeAtualId null', () => {
    const { carreira: base } = exemploCarreira();
    const salarioAntes = base.jogador.contrato.salario;
    const clubeAntes = base.clubeAtualId!;
    forcarFimContrato(base);
    const c = avancarSemana(base);
    expect(estaSemClube(c)).toBe(true);
    expect(c.clubeAtualId).toBeNull();
    expect(c.agenteLivreDesde).toBe(c.dataAtual);
    expect(c.ultimoClubeId).toBe(clubeAntes);
    expect(c.jogador.contrato.salario).toBe(0);
    expect(c.historicoContratos.some((h) => h.clubeId === clubeAntes && h.motivoSaida === 'fim_contrato')).toBe(true);
    expect(c.eventos.some((e) => e.tipo === 'fim-contrato')).toBe(true);
    expect(c.eventos.some((e) => e.tipo === 'vinculo-provisorio')).toBe(false);
    // Não recria contrato provisório de 90 dias
    expect(c.jogador.contrato.dataTermino <= c.dataAtual).toBe(true);
    expect(salarioAntes).toBeGreaterThan(0);
  });

  it('múltiplas semanas sem clube não criam contrato provisório nem restauram clube antigo', () => {
    const { carreira: base } = exemploCarreira();
    forcarFimContrato(base);
    let c = avancarSemana(base);
    const salario = c.jogador.contrato.salario;
    for (let i = 0; i < 4; i++) c = avancarSemana(c);
    expect(estaSemClube(c)).toBe(true);
    expect(c.clubeAtualId).toBeNull();
    expect(c.jogador.contrato.salario).toBe(salario);
    expect(semanasSemClube(c)).toBeGreaterThanOrEqual(4);
  });

  it('jogador livre não disputa partidas nem aparece em escalação do antigo clube', () => {
    const { carreira: base } = exemploCarreira();
    const antigo = base.clubeAtualId!;
    forcarFimContrato(base);
    let c = avancarSemana(base);
    const rodada = c.temporada.rodadaAtual;
    const partidaClube = c.temporada.partidas.find(
      (p) => p.rodada === rodada && [p.mandanteId, p.visitanteId].includes(antigo),
    );
    expect(partidaClube?.participacao).toBeFalsy();
    expect(avaliarHierarquia(c).rotulo.toLowerCase()).toMatch(/sem clube|agente livre|livre/);
    expect(() => conversarTreinador(c, 'melhorar')).toThrow(/sem clube|clube/i);
  });

  it('jogador livre treina individualmente sem ganhar confiança de treinador; ritmo pode cair', () => {
    const { carreira: base } = exemploCarreira();
    forcarFimContrato(base);
    let c = avancarSemana(base);
    const conf0 = c.jogador.confianca;
    const ritmo0 = c.jogador.ritmo;
    c.jogador.fadiga = 20;
    processarTreinamento(c.jogador, 'equilibrado', null, c.dataAtual, new GeradorAleatorio(7));
    expect(c.jogador.confianca).toBe(conf0);
    for (let i = 0; i < 10; i++) c = avancarSemana(c);
    expect(c.jogador.ritmo).toBeLessThanOrEqual(ritmo0);
  });

  it('promessa e objetivo de titular/minutos são encerrados ao ficar livre', () => {
    const { carreira: base } = exemploCarreira();
    forcarFimContrato(base);
    const c = avancarSemana(base);
    expect(c.acompanhamento.promessa?.status).not.toBe('ativa');
    expect(
      c.acompanhamento.objetivoPessoal === null ||
        c.acompanhamento.objetivoPessoal.tipo !== 'minutos',
    ).toBe(true);
  });

  it('renovação aceita evita agente livre', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, 10);
    c.propostas.push({
      id: 'ren-teste',
      clubeId: c.clubeAtualId!,
      tipo: 'renovacao',
      salario: c.jogador.contrato.salario,
      duracaoAnos: 3,
      papelPrometido: 'rotacao',
      etapa: 'proposta_jogador',
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 28),
      status: 'pendente',
    });
    const assinada = responderProposta(c, 'ren-teste', true);
    expect(assinada.jogador.contrato.dataTermino > assinada.dataAtual).toBe(true);
    assinada.jogador.contrato.dataTermino = somarDias(assinada.dataAtual, -1);
    // Contrato já renovado no passado da assinatura — simula renovação vigente
    assinada.jogador.contrato.dataTermino = somarDias(assinada.dataAtual, 1000);
    const apos = avancarSemana(assinada);
    expect(estaSemClube(apos)).toBe(false);
    expect(apos.clubeAtualId).toBe(c.clubeAtualId);
  });

  it('pré-contrato efetivado na data evita agente livre permanente', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.categoria = 'profissional';
    const destino = c.clubes.find((x) => x.id !== c.clubeAtualId)!;
    destino.orcamento = 80_000_000;
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, -1);
    c.propostas.push({
      id: 'pre-teste',
      clubeId: destino.id,
      tipo: 'transferencia',
      salario: 3000,
      duracaoAnos: 3,
      papelPrometido: 'rotacao',
      valorTransferencia: 0,
      etapa: 'acordo',
      preContrato: true,
      efetivarEm: c.dataAtual,
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 28),
      status: 'aceita',
    });
    const apos = avancarSemana(c);
    expect(estaSemClube(apos)).toBe(false);
    expect(apos.clubeAtualId).toBe(destino.id);
    expect(apos.jogador.contrato.clubeId).toBe(destino.id);
    expect(apos.jogador.contrato.salario).toBe(3000);
  });

  it('agente livre recebe proposta com taxa 0 e pode assinar; clube ainda pode rejeitar folha', () => {
    const { carreira: base } = exemploCarreira();
    forcarFimContrato(base);
    let c = avancarSemana(base);
    expect(estaSemClube(c)).toBe(true);
    const destino = c.clubes.find((x) => x.id !== c.ultimoClubeId)!;
    destino.orcamento = 50_000_000;
    c.propostas.push({
      id: 'livre-ok',
      clubeId: destino.id,
      tipo: 'transferencia',
      salario: 2500,
      duracaoAnos: 2,
      papelPrometido: 'reserva',
      valorTransferencia: 5_000_000,
      etapa: 'proposta_jogador',
      data: c.dataAtual,
      validade: somarDias(c.dataAtual, 28),
      status: 'pendente',
    });
    const assinada = responderProposta(c, 'livre-ok', true);
    expect(estaSemClube(assinada)).toBe(false);
    expect(assinada.clubeAtualId).toBe(destino.id);
    expect(assinada.agenteLivreDesde).toBeNull();
    expect(assinada.propostas.find((p) => p.id === 'livre-ok')?.valorTransferencia).toBe(0);
    expect(assinada.liga.id).toBe(destino.ligaId);

    const pobre = structuredClone(c);
    const clubePobre = pobre.clubes.find((x) => x.id !== pobre.ultimoClubeId)!;
    clubePobre.orcamento = 100;
    pobre.propostas = [{
      id: 'livre-caro',
      clubeId: clubePobre.id,
      tipo: 'transferencia',
      salario: 500_000,
      duracaoAnos: 2,
      papelPrometido: 'titular',
      etapa: 'proposta_jogador',
      data: pobre.dataAtual,
      validade: somarDias(pobre.dataAtual, 28),
      status: 'pendente',
    }];
    expect(() => responderProposta(pobre, 'livre-caro', true)).toThrow(/orçamento|folha/i);
  });

  it('save/reload preserva agente livre e após novo contrato', () => {
    const { carreira: base, catalogo } = exemploCarreira();
    forcarFimContrato(base);
    const livre = avancarSemana(base);
    const rec = hidratarCarreira(serializarCarreira(livre), catalogo);
    expect(rec.clubeAtualId).toBeNull();
    expect(rec.agenteLivreDesde).toBe(livre.agenteLivreDesde);
    expect(rec.ultimoClubeId).toBe(livre.ultimoClubeId);
    expect(rec.historicoContratos.length).toBeGreaterThan(0);

    const destino = livre.clubes.find((x) => x.id !== livre.ultimoClubeId)!;
    destino.orcamento = 40_000_000;
    livre.propostas.push({
      id: 'livre-reload',
      clubeId: destino.id,
      tipo: 'transferencia',
      salario: 2000,
      duracaoAnos: 2,
      papelPrometido: 'reserva',
      etapa: 'proposta_jogador',
      data: livre.dataAtual,
      validade: somarDias(livre.dataAtual, 28),
      status: 'pendente',
    });
    const assinada = responderProposta(livre, 'livre-reload', true);
    const rec2 = hidratarCarreira(serializarCarreira(assinada), catalogo);
    expect(rec2.clubeAtualId).toBe(destino.id);
    expect(rec2.agenteLivreDesde).toBeNull();
  });

  it('empréstimo com contrato de origem vencido não gera estado impossível', () => {
    const { carreira: c } = exemploCarreira();
    const origem = c.clubeAtualId!;
    const destino = c.clubes.find((x) => x.id !== origem)!;
    c.mercado.emprestimo = {
      clubeOrigemId: origem,
      retornoEm: somarDias(c.dataAtual, -1),
      percentualSalario: 0.5,
    };
    c.clubeAtualId = destino.id;
    c.jogador.contrato.clubeId = origem;
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, -7);
    const apos = avancarSemana(c);
    expect(apos.mercado.emprestimo).toBeUndefined();
    expect(estaSemClube(apos) || apos.clubeAtualId !== origem || apos.jogador.contrato.dataTermino >= apos.dataAtual).toBe(true);
  });

  it('agente pode buscar clubes e alertas de fim de contrato escalam', () => {
    const { carreira: c } = exemploCarreira();
    c.jogador.contrato.dataTermino = somarDias(c.dataAtual, 28);
    const alerta = alertaFimContrato(c);
    expect(alerta?.nivel).toBe('urgente');
    expect(alerta?.texto).toMatch(/não possui acordo|termina/i);

    forcarFimContrato(c);
    const livre = avancarSemana(c);
    const buscou = conversarAgente(livre, 'buscar');
    expect(buscou.mercado.historico.at(-1)?.texto.length).toBeGreaterThan(10);
  });

  it('tornarAgenteLivre direto: UI/estado coerente', () => {
    const { carreira: c } = exemploCarreira();
    const id = c.clubeAtualId!;
    tornarAgenteLivre(c);
    expect(c.clubeAtualId).toBeNull();
    expect(c.ultimoClubeId).toBe(id);
    expect(categoriaPartidaDaSemana(c)).not.toBeUndefined();
  });
});
