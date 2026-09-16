import { describe, it, expect } from 'vitest';
import { exemploCarreira } from './auxiliar-carreira-persistida';
import { serializarCarreira, hidratarCarreira, validarCarreiraPersistida } from '@/infraestrutura/persistencia/carreira-persistida';

describe('Fase 08 — migração', () => {
  it('migra v3 sem inventar DNA nem alterar atributos e rejeita versões futuras', () => {
    const { carreira, catalogo } = exemploCarreira();
    const antigo = JSON.parse(JSON.stringify(serializarCarreira(carreira)));
    antigo.versao = 3;
    delete antigo.acompanhamento;
    delete antigo.jogador.perfilFormacao;
    delete antigo.jogador.preparacao;
    const recarregada = hidratarCarreira(antigo, catalogo);
    expect(recarregada.jogador.atributos).toEqual(carreira.jogador.atributos);
    expect(recarregada.jogador.perfilFormacao).toEqual({ origem: 'legado' });
    expect(serializarCarreira(recarregada).versao).toBe(4);
    expect(() => validarCarreiraPersistida({ ...antigo, versao: 99 })).toThrow();
  });
  it('round-trip preserva defaults e não aceita estrutura parcial na v4', () => {
    const { carreira, catalogo } = exemploCarreira();
    const p = serializarCarreira(carreira);
    expect(hidratarCarreira(p, catalogo).acompanhamento).toEqual(carreira.acompanhamento);
    expect(() => validarCarreiraPersistida({ ...p, acompanhamento: {} })).toThrow();
  });
});

import { CAPITULOS } from '@/dominio/desenvolvimento';
import { HISTORIAS, sortearHistoria, resumirHistoria } from '@/dominio/historia-formacao';
import { criarCarreira } from '@/aplicacao/casos-de-uso/criar-carreira';
import { calcularOverall, avaliarPotencial, POSICOES } from '@/dominio/regras/jogador';
import type { Posicao } from '@/dominio/entidades/modelos';

function historia(seed: string, posicao: Posicao) {
  const opcoes = sortearHistoria(seed,posicao);
  return { origem:opcoes.origem[0].id, destaque:opcoes.destaque[0].id, dificuldade:opcoes.dificuldade[0].id, chegada:opcoes.chegada[0].id };
}
describe('Fase 08 — Sua História', () => {
  it.each(Object.keys(POSICOES) as Posicao[])('três opções únicas e plausíveis, sem rerrolar ao voltar: %s', posicao => {
    const opcoes = sortearHistoria('mesma-seed',posicao);
    sortearHistoria('outra-seed',posicao);
    expect(sortearHistoria('mesma-seed',posicao)).toEqual(opcoes);
    for (const c of CAPITULOS) {
      expect(new Set(opcoes[c].map(o => o.id)).size).toBe(3);
      expect(opcoes[c].every(o => !o.posicoes || o.posicoes.includes(posicao))).toBe(true);
    }
  });
  it('catálogo possui benefícios, custos e variedade sem nomes de atletas reais', () => {
    expect(HISTORIAS.origem.length).toBeGreaterThanOrEqual(8);
    for (const opcoes of Object.values(HISTORIAS)) for (const o of opcoes) {
      expect(Object.values(o.atributos).some(v => v > 0)).toBe(true);
      expect(Object.values(o.atributos).some(v => v < 0)).toBe(true);
      expect(o.titulo).not.toMatch(/Messi|Ronaldo|Neymar|Mbappé/i);
    }
  });
  it('aplica escolhas uma vez, recalcula overall e preserva personalidade e resumo no round-trip', () => {
    const { entrada,catalogo } = exemploCarreira();
    const escolhas = historia(entrada.seed,entrada.identidade.posicao);
    const c = criarCarreira({...entrada,historia:escolhas});
    expect(c.jogador.overall).toBe(calcularOverall(c.jogador.atributos,c.jogador.posicao));
    const rec = hidratarCarreira(serializarCarreira(c),catalogo);
    expect(rec.jogador).toEqual(c.jogador);
    expect(resumirHistoria(escolhas).opcoes.map(o => o.id)).toEqual(CAPITULOS.map(c => escolhas[c]));
    expect(c.jogador.personalidade).not.toEqual(criarCarreira(entrada).jogador.personalidade);
    expect(() => criarCarreira({...entrada,historia:{...escolhas,origem:'inexistente'}})).toThrow();
  });
  it('limita atributos de jovens em várias combinações e oculta o teto real no parecer', () => {
    const { entrada } = exemploCarreira();
    for (let n=0;n<50;n++) {
      const seed = `dna-${n}`;
      const c = criarCarreira({...entrada,seed,identidade:{...entrada.identidade,idade:15},historia:historia(seed,entrada.identidade.posicao)});
      expect(Math.max(...Object.values(c.jogador.atributos))).toBeLessThanOrEqual(78);
      expect(Math.min(...Object.values(c.jogador.atributos))).toBeGreaterThanOrEqual(1);
      expect(c.jogador.overall).toBeLessThan(70);
      expect(c.jogador.categoria).toBe('base');
      const parecer = avaliarPotencial(c.jogador);
      c.jogador.potencialInterno = 99;
      expect(avaliarPotencial(c.jogador)).toBe(parecer);
    }
  });
});

import { processarTreinamento, avaliarTreino, configurarDesenvolvimento } from '@/simulacao/treinamento/treinamento';
import { calcularEvolucao } from '@/simulacao/evolucao/evolucao';
import { GeradorAleatorio } from '@/utilitarios/aleatorio';
import { planosDaPosicao } from '@/dominio/planos-desenvolvimento';
describe('Fase 08 — treinamento', () => {
  it('reserva acumula progresso sem minutos e partidas acrescentam desenvolvimento', () => {
    const { carreira:c,catalogo } = exemploCarreira();
    c.jogador.potencialInterno = 94;
    const inicial = structuredClone(c.jogador);
    processarTreinamento(c.jogador,'drible',c.clubes[0],c.dataAtual,new GeradorAleatorio(42));
    expect(c.jogador.desenvolvimento.drible).toBeGreaterThan(inicial.desenvolvimento.drible);
    const antes = c.jogador.desenvolvimento.drible;
    calcularEvolucao(c.jogador,['drible'],5,c.clubes[0]);
    expect(c.jogador.desenvolvimento.drible).toBeGreaterThan(antes);
    expect(hidratarCarreira(serializarCarreira(c),catalogo).jogador.desenvolvimento).toEqual(c.jogador.desenvolvimento);
  });
  it('intensidade custa fadiga, descanso recupera e lesão impede treino normal', () => {
    const { carreira:c } = exemploCarreira();
    c.jogador.preparacao.intensidade = 'intenso';
    const antes = c.jogador.fadiga;
    processarTreinamento(c.jogador,'fisico',c.clubes[0],c.dataAtual,new GeradorAleatorio(42));
    expect(c.jogador.fadiga).toBeGreaterThan(antes);
    processarTreinamento(c.jogador,'recuperacao',c.clubes[0],c.dataAtual,new GeradorAleatorio(42));
    expect(c.jogador.fadiga).toBeLessThan(antes);
    c.jogador.lesao = { tipo:'Contusão',gravidade:'leve',diasRecuperacao:14,dataInicio:c.dataAtual,dataPrevistaRetorno:'2026-06-15' };
    const dev = {...c.jogador.desenvolvimento};
    processarTreinamento(c.jogador,'fisico',c.clubes[0],c.dataAtual,new GeradorAleatorio(42));
    expect(c.jogador.desenvolvimento).toEqual(dev);
    expect(c.jogador.preparacao.historico.at(-1)?.avaliacao).toBe('Recuperação');
  });
  it('profissionalismo influencia avaliação e treino bom aumenta confiança', () => {
    const { carreira:c } = exemploCarreira();
    c.jogador.personalidade.profissionalismo = 10;
    const baixa = avaliarTreino(c.jogador,new GeradorAleatorio(1));
    c.jogador.personalidade.profissionalismo = 99;
    c.jogador.personalidade.disciplina = 99;
    expect(avaliarTreino(c.jogador,new GeradorAleatorio(1))).toBeGreaterThan(baixa);
    const confianca = c.jogador.confianca;
    processarTreinamento(c.jogador,'drible',c.clubes[0],c.dataAtual,new GeradorAleatorio(1));
    expect(c.jogador.confianca).toBeGreaterThan(confianca);
  });
  it('potencial limita evolução e atributo alto tem retorno menor', () => {
    const { carreira:c } = exemploCarreira();
    c.jogador.atributos.drible = 90;
    c.jogador.atributos.passeLongo = 40;
    c.jogador.potencialInterno = 99;
    calcularEvolucao(c.jogador,['drible','passeLongo'],5,c.clubes[0]);
    expect(c.jogador.desenvolvimento.drible).toBeLessThan(c.jogador.desenvolvimento.passeLongo);
    c.jogador.potencialInterno = c.jogador.overall;
    const atributos = {...c.jogador.atributos};
    calcularEvolucao(c.jogador,['drible'],500,c.clubes[0]);
    expect(c.jogador.atributos).toEqual(atributos);
  });
  it('todas as posições têm planos e prioridades são limitadas e persistidas', () => {
    for (const p of Object.keys(POSICOES) as Posicao[]) expect(planosDaPosicao(p).length).toBeGreaterThanOrEqual(2);
    const { carreira,catalogo } = exemploCarreira();
    const c = configurarDesenvolvimento(carreira,'invertido',['drible','finalizacao'],'normal');
    expect(hidratarCarreira(serializarCarreira(c),catalogo).jogador.preparacao).toEqual(c.jogador.preparacao);
    expect(() => configurarDesenvolvimento(c,'invertido',['drible','finalizacao','compostura'],'normal')).toThrow();
    expect(() => configurarDesenvolvimento(c,'goleiro',[],'normal')).toThrow();
  });
});

import { conversarTreinador, atualizarCompromissos } from '@/simulacao/elenco/treinador';
import { avaliarHierarquia, posicoesPlausiveis } from '@/simulacao/elenco/hierarquia';
import { somarDias } from '@/utilitarios/formatacao';
import { determinarEscalacao } from '@/simulacao/partida/escalacao';
describe('Fase 08 — treinador', () => {
  it('explica concorrência, não garante vaga e limita conversas', () => {
    const { carreira:c,catalogo } = exemploCarreira();
    c.jogador.overall=20;
    c.clubes[0].elenco.forEach(j => { j.overall=90; j.forma=90; });
    const concorrente=c.clubes[0].elenco.find(j => j.posicaoPrincipal === 'PD')!;
    concorrente.overall=95; concorrente.forma=90;
    const resposta=conversarTreinador(c,'motivo');
    expect(resposta.acompanhamento.conversas.at(-1)?.resposta).toContain(concorrente.nome);
    expect(() => conversarTreinador(resposta,'motivo')).toThrow(/Nova conversa/);
    expect(hidratarCarreira(serializarCarreira(resposta),catalogo).acompanhamento).toEqual(resposta.acompanhamento);
    const pedido=conversarTreinador(c,'oportunidade');
    expect(determinarEscalacao(pedido.jogador,pedido.clubes[0],new GeradorAleatorio(1))).not.toBe('titular');
  });
  it('lesão de concorrente melhora a ordem e posição impossível é recusada', () => {
    const { carreira:c }=exemploCarreira();
    const antes=avaliarHierarquia(c).ordem;
    c.clubes[0].elenco.forEach(j => { if(j.posicaoPrincipal === 'PD') j.lesionado=true; });
    expect(avaliarHierarquia(c).ordem).toBeLessThanOrEqual(antes);
    c.jogador.posicao='GOL';
    expect(posicoesPlausiveis(c.jogador)).toEqual([]);
    expect(() => conversarTreinador(c,'posicao','CA')).toThrow(/plausível/);
  });
  it('promessas persistem, cumprimento melhora relação e descumprimento permite cobrança', () => {
    const { carreira:c,catalogo }=exemploCarreira();
    c.jogador.overall=90; c.jogador.confianca=80;
    const pedido=conversarTreinador(c,'oportunidade');
    expect(pedido.acompanhamento.promessa?.tipo).toBe('minutos');
    expect(hidratarCarreira(serializarCarreira(pedido),catalogo).acompanhamento.promessa).toEqual(pedido.acompanhamento.promessa);
    const partida=pedido.temporada.partidas[0];
    pedido.ultimaPartidaId=partida.id;
    partida.participacao={escalacao:'banco',entrada:70,saida:90,minutos:20,gols:0,assistencias:0,chutes:0,passes:5,passesChave:0,desarmes:0,amarelos:0,vermelhos:0,faltas:0,defesas:0,nota:6.5,confianca:0,moral:0,desenvolvimento:0};
    const rel=pedido.relacionamentos.treinador;
    atualizarCompromissos(pedido);
    expect(pedido.acompanhamento.promessa?.status).toBe('cumprida');
    expect(pedido.relacionamentos.treinador).toBeGreaterThan(rel);
    const perdido=conversarTreinador(c,'oportunidade');
    perdido.dataAtual=somarDias(c.dataAtual,42);
    atualizarCompromissos(perdido);
    expect(perdido.acompanhamento.promessa?.status).toBe('descumprida');
    expect(conversarTreinador(perdido,'cobrar').acompanhamento.promessa?.status).toBe('encerrada');
  });
  it('posição secundária exige semanas de adaptação e é preservada', () => {
    const { carreira:c,catalogo }=exemploCarreira();
    c.jogador.confianca=70;
    const pedido=conversarTreinador(c,'posicao','PE');
    expect(pedido.jogador.posicaoSecundaria).toBe('');
    for(let i=0;i<10;i++) { pedido.dataAtual=somarDias(pedido.dataAtual,7); atualizarCompromissos(pedido); }
    expect(pedido.jogador.posicaoSecundaria).toBe('PE');
    expect(pedido.jogador.posicao).toBe('PD');
    expect(hidratarCarreira(serializarCarreira(pedido),catalogo).acompanhamento.adaptacao?.status).toBe('concluida');
  });
});

import { solicitarContrato } from '@/simulacao/transferencias/contratos';
describe('Fase 08 — contratos', () => {
  const pedido={tipo:'aumento' as const,salario:2000,duracaoAnos:3,papel:'rotacao' as const};
  it('pedido plausível recebe resposta e proposta persistida; cooldown impede repetição', () => {
    const { carreira:c,catalogo }=exemploCarreira();
    c.jogador.status='rotacao';
    const resposta=solicitarContrato(c,pedido);
    expect(resposta.acompanhamento.pedidosContrato.at(-1)?.status).toBe('aceito');
    expect(resposta.propostas.at(-1)?.tipo).toBe('renovacao');
    expect(hidratarCarreira(serializarCarreira(resposta),catalogo).acompanhamento).toEqual(resposta.acompanhamento);
    expect(()=>solicitarContrato(resposta,pedido)).toThrow(/Nova conversa/);
  });
  it('absurdo, orçamento e contrato longo recebem motivos distintos', () => {
    const { carreira:c }=exemploCarreira();
    const absurdo=solicitarContrato(c,{...pedido,salario:1e8});
    expect(absurdo.acompanhamento.pedidosContrato.at(-1)?.resposta).toMatch(/incompatível/);
    c.clubes[0].orcamento=0;
    expect(solicitarContrato(c,pedido).acompanhamento.pedidosContrato.at(-1)?.resposta).toMatch(/orçamento/);
    c.clubes[0].orcamento=1e8;
    c.jogador.contrato.dataTermino=somarDias(c.dataAtual,1460);
    expect(solicitarContrato(c,pedido).acompanhamento.pedidosContrato.at(-1)?.resposta).toMatch(/três anos/);
  });
  it('papel atual limita os termos e pode produzir contraproposta', () => {
    const { carreira:c }=exemploCarreira();
    const resposta=solicitarContrato(c,{...pedido,papel:'titular'});
    expect(resposta.acompanhamento.pedidosContrato.at(-1)?.status).toBe('contraproposta');
    expect(resposta.propostas.at(-1)?.papelPrometido).toBe('reserva');
    expect(resposta.noticias.some(n=>n.tipo==='diretoria')).toBe(true);
  });
});

import { avaliarBase, relacionadoProfissional } from '@/simulacao/base/formacao';
import { avaliarPromocao } from '@/aplicacao/casos-de-uso/avancar-tempo';
describe('Fase 08 — base',()=>{
  it('15/16 começam na base; boas avaliações abrem treino profissional sem promover',()=>{
    const {entrada,catalogo}=exemploCarreira();
    for(const idade of [15,16]){
      const c=criarCarreira({...entrada,identidade:{...entrada.identidade,idade}});
      expect(c.jogador.categoria).toBe('base');
      c.jogador.overall=c.clubes[0].forcaGeral-10;c.jogador.confianca=70;
      c.jogador.preparacao.historico=[{data:c.dataAtual,nota:80,avaliacao:'Muito bom',confianca:2,progresso:8}];
      avaliarBase(c);
      expect(c.acompanhamento.base.conviteAte).not.toBeNull();
      expect(c.jogador.categoria).toBe('base');
      expect(hidratarCarreira(serializarCarreira(c),catalogo).acompanhamento.base).toEqual(c.acompanhamento.base);
    }
  });
  it('promoção exige critérios, gera evento e persiste; convite permite convocação contextual',()=>{
    const {entrada,catalogo}=exemploCarreira();
    const c=criarCarreira({...entrada,identidade:{...entrada.identidade,idade:16}});
    avaliarPromocao(c,c.clubes[0]);expect(c.jogador.categoria).toBe('base');
    c.jogador.overall=c.clubes[0].forcaGeral;c.jogador.confianca=80;c.jogador.potencialInterno=94;
    c.jogador.preparacao.historico=[{data:c.dataAtual,nota:80,avaliacao:'Muito bom',confianca:2,progresso:8}];
    avaliarBase(c);c.acompanhamento.base.treinosProfissional=2;
    c.clubes[0].elenco.find(j=>j.posicaoPrincipal==='PD')!.lesionado=true;
    expect(relacionadoProfissional(c)).toBe(true);
    avaliarPromocao(c,c.clubes[0]);
    expect(c.jogador.categoria).toBe('profissional');
    expect(c.eventos.some(e=>e.tipo==='promocao')).toBe(true);
    expect(hidratarCarreira(serializarCarreira(c),catalogo).jogador.categoria).toBe('profissional');
  });
});

import { avancarSemana } from '@/aplicacao/casos-de-uso/avancar-tempo';
import { escolherObjetivo, registrarResumoSemanal } from '@/simulacao/carreira/acompanhamento';
import { coletarAcoesAtencao } from '@/componentes/jogo/AtencaoCarreira';
describe('Fase 08 — central e objetivos',()=>{
  it('semana produz resumo persistido e feedback mesmo sem jogar',()=>{
    const {carreira:c,catalogo}=exemploCarreira();
    c.jogador.lesao={tipo:'Contusão',gravidade:'leve',diasRecuperacao:21,dataInicio:c.dataAtual,dataPrevistaRetorno:somarDias(c.dataAtual,21)};
    const depois=avancarSemana(c);
    expect(depois.acompanhamento.resumoSemanal?.feedback).toMatch(/recuperação|sem participação/);
    expect(hidratarCarreira(serializarCarreira(depois),catalogo).acompanhamento.resumoSemanal).toEqual(depois.acompanhamento.resumoSemanal);
    expect(avaliarHierarquia(depois).motivo.length).toBeGreaterThan(10);
  });
  it('evolução real e respostas chegam ao início; objetivo não dá atributo grátis',()=>{
    const {carreira:c,catalogo}=exemploCarreira();
    const objetivo=escolherObjetivo(c,'tecnica');
    expect(objetivo.jogador.atributos).toEqual(c.jogador.atributos);
    objetivo.jogador.atributos.dominio+=3;
    registrarResumoSemanal(objetivo,c);
    expect(objetivo.acompanhamento.objetivoPessoal?.concluido).toBe(true);
    expect(coletarAcoesAtencao(objetivo).some(a=>a.titulo.includes('trabalho'))).toBe(true);
    const conversa=conversarTreinador(c,'motivo');
    expect(coletarAcoesAtencao(conversa).some(a=>a.titulo.includes('jogando'))).toBe(true);
    expect(hidratarCarreira(serializarCarreira(objetivo),catalogo).acompanhamento.objetivoPessoal).toEqual(objetivo.acompanhamento.objetivoPessoal);
  });
  it('sem alteração relevante não gera notícia artificial de evolução',()=>{
    const {carreira:c}=exemploCarreira();
    registrarResumoSemanal(c,structuredClone(c));
    expect(c.noticias.some(n=>n.tipo==='evolucao'||n.tipo==='overall')).toBe(false);
  });
});

import { gerarContextoSemana, responderContexto, avisarConcorrencia } from '@/simulacao/decisoes/contexto';
import { responderDecisao } from '@/simulacao/decisoes/decisoes';
describe('Fase 08 — contexto',()=>{
  it('imprensa respeita contexto, determinismo, intervalo e tradeoffs',()=>{
    const {carreira:c,catalogo}=exemploCarreira();
    c.jogador.notasRecentes=[6,6,6];
    let gerada:typeof c|undefined;
    for(let seed=0;seed<30;seed++){
      const a=structuredClone(c),b=structuredClone(c);
      gerarContextoSemana(a,new GeradorAleatorio(seed));gerarContextoSemana(b,new GeradorAleatorio(seed));
      expect(a.decisoes).toEqual(b.decisoes);
      if(a.decisoes.length){gerada=a;break;}
    }
    expect(gerada).toBeDefined();
    const respondida=responderDecisao(gerada!,gerada!.decisoes[0].id,'provocativa');
    expect(respondida.jogador.reputacao).toBeGreaterThan(c.jogador.reputacao);
    expect(respondida.relacionamentos.treinador).toBeLessThan(c.relacionamentos.treinador);
    gerarContextoSemana(respondida,new GeradorAleatorio(1));
    expect(respondida.decisoes.length).toBe(1);
    expect(hidratarCarreira(serializarCarreira(respondida),catalogo).noticias).toEqual(respondida.noticias);
    expect(()=>responderDecisao(gerada!,gerada!.decisoes[0].id,'invalida')).toThrow();
    const diplomatica=structuredClone(c);responderContexto(diplomatica,'diplomatica');
    expect(diplomatica.relacionamentos.treinador).toBeGreaterThan(c.relacionamentos.treinador);
  });
  it('chegada de concorrente avisa sem repetir a cada semana',()=>{
    const {carreira:c}=exemploCarreira();const antes=structuredClone(c);
    const novo={...c.clubes[0].elenco.find(j=>j.posicaoPrincipal==='PD')!,id:'concorrente-teste',overall:90};
    c.clubes[0].elenco.push(novo);avisarConcorrencia(c,antes);
    expect(c.noticias[0].tipo).toBe('concorrente');
    const n=c.noticias.length;avisarConcorrencia(c,structuredClone(c));expect(c.noticias.length).toBe(n);
  });
});
