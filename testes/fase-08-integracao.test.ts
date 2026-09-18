import { describe,it,expect,vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { exemploCarreira } from './auxiliar-carreira-persistida';
import { criarCarreira } from '@/aplicacao/casos-de-uso/criar-carreira';
import { sortearHistoria } from '@/dominio/historia-formacao';
import { serializarCarreira,hidratarCarreira,validarReferenciasCarreiraPersistida } from '@/infraestrutura/persistencia/carreira-persistida';
import { configurarDesenvolvimento, processarTreinamento } from '@/simulacao/treinamento/treinamento';
import { aplicarSessaoTreino } from '@/simulacao/treinamento/aplicar-sessao';
import { conversarTreinador } from '@/simulacao/elenco/treinador';
import { solicitarContrato } from '@/simulacao/transferencias/contratos';
import { escolherObjetivo } from '@/simulacao/carreira/acompanhamento';
import { avancarSemana } from '@/aplicacao/casos-de-uso/avancar-tempo';
import { iniciarProximaTemporada } from '@/aplicacao/casos-de-uso/temporada';
import { GeradorAleatorio } from '@/utilitarios/aleatorio';
import { somarDias } from '@/utilitarios/formatacao';
import { criarApiCarreira,COOKIE_CARREIRA } from '@/infraestrutura/persistencia/api-carreira';
import { SuaHistoria } from '@/componentes/jogador/SuaHistoria';
import { ConversaTreinador } from '@/componentes/clube/ConversaTreinador';
import { ConversaContrato } from '@/componentes/clube/ConversaContrato';
import { MercadoClube } from '@/componentes/jogo/MercadoClube';
import { NOMES_ATRIBUTOS } from '@/dominio/entidades/modelos';
vi.mock('server-only',()=>({}));
function carreiraCompleta() {
  const {entrada,catalogo}=exemploCarreira();
  const sorteio=sortearHistoria(entrada.seed,entrada.identidade.posicao);
  const historia={origem:sorteio.origem[0].id,destaque:sorteio.destaque[0].id,dificuldade:sorteio.dificuldade[0].id,chegada:sorteio.chegada[0].id};
  let c=criarCarreira({...entrada,historia});
  c=configurarDesenvolvimento(c,'invertido',['drible','finalizacao'],'normal');
  c=escolherObjetivo(c,'minutos');
  c=conversarTreinador(c,'posicao','PE');
  c.dataAtual=somarDias(c.dataAtual,14);c.jogador.confianca=80;c.jogador.overall=80;
  c=conversarTreinador(c,'oportunidade');
  c=solicitarContrato(c,{tipo:'aumento',salario:1800,duracaoAnos:3,papel:'reserva'});
  c=avancarSemana(c);
  return {c,catalogo,historia};
}
describe('Fase 08 — integração e balanceamento',()=>{
  it('ações → API → repositório mock → GET → hidratação preservam todos os novos sistemas',async()=>{
    const {c,catalogo}=carreiraCompleta();
    let salvo:unknown=null;
    const repo={ler:vi.fn(),criar:vi.fn(),atualizar:vi.fn(),excluir:vi.fn()};
    repo.ler.mockImplementation(async()=>salvo);
    repo.criar.mockImplementation(async (_hash,state)=>{salvo={state:structuredClone(state),revision:0};return salvo;});
    repo.atualizar.mockImplementation(async (_hash,revision,state)=>{salvo={state:structuredClone(state),revision:revision+1};return salvo;});
    const api=criarApiCarreira(repo,async()=>catalogo);
    const req=(method:string,body?:unknown,cookie?:string)=>new NextRequest('http://localhost/api/carreira',{method,headers:{origin:'http://localhost','content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const resposta=await api(req('POST',{state:serializarCarreira(c),revision:null}));
    expect(resposta.status).toBe(201);
    const cookie=resposta.headers.get('set-cookie')!.split(';')[0];expect(cookie).toContain(COOKIE_CARREIRA);
    const put=await api(req('PUT',{state:serializarCarreira(c),revision:0},cookie));expect(put.status).toBe(200);
    const get=await api(req('GET',undefined,cookie));expect(get.status).toBe(200);
    const dados=await get.json();
    expect(dados.carreira.acompanhamento).toEqual(JSON.parse(JSON.stringify(c.acompanhamento)));
    expect(dados.carreira.jogador.perfilFormacao).toEqual(c.jogador.perfilFormacao);
    expect(dados.carreira.jogador.preparacao).toEqual(c.jogador.preparacao);
    expect(dados.carreira.jogador.desenvolvimento).toEqual(c.jogador.desenvolvimento);
    expect(dados.carreira.noticias).toEqual(JSON.parse(JSON.stringify(c.noticias)));
  });
  it('várias semanas e virada de temporada mantêm saves válidos e determinísticos',()=>{
    const {c:inicial,catalogo}=carreiraCompleta();let c=inicial;
    for(let i=0;i<18;i++){
      const proximo=c.temporada.encerrada?iniciarProximaTemporada(c):avancarSemana(c);
      const repetido=c.temporada.encerrada?iniciarProximaTemporada(c):avancarSemana(c);
      expect(proximo).toEqual(repetido);
      const p=serializarCarreira(proximo);validarReferenciasCarreiraPersistida(p,catalogo);
      c=hidratarCarreira(p,catalogo);
      expect(c.acompanhamento).toEqual(proximo.acompanhamento);
    }
  });
  it('52 treinos no Centro não produzem salto de 17 pontos de overall',()=>{
    const {entrada}=exemploCarreira();
    for(const profissionalismo of [40,95]){
      let c=criarCarreira({...entrada,identidade:{...entrada.identidade,idade:15}});
      c.jogador.potencialInterno=94; // Cenário favorável: teto distante, sem lesões acumuladas.
      c.jogador.personalidade.profissionalismo=profissionalismo;
      const inicio=c.jogador.overall,rng=new GeradorAleatorio(84);
      const clube=c.clubes[0];
      for(let i=0;i<52;i++){
        c.jogador.lesao=null;c.jogador.fadiga=10;c.jogador.condicionamento=95;
        const data=somarDias(c.dataAtual,i*7);
        c.dataAtual=data;
        // 2 sessões/semana no Centro (substitui plano legado).
        for(const sid of ['a','b'] as const){
          try {
            c=aplicarSessaoTreino(c,{
              exercicioId:'penaltis',
              score:70+profissionalismo/10,
              modo:'jogar',
              sessaoId:`${i}-${sid}`,
            },clube).carreira;
          } catch { /* limite semanal */ }
        }
        processarTreinamento(c.jogador,'equilibrado',clube,data,rng);
      }
      expect(c.jogador.overall-inicio).toBeGreaterThan(0);
      expect(c.jogador.overall-inicio).toBeLessThanOrEqual(7);
      expect(c.jogador.overall).toBeLessThanOrEqual(c.jogador.potencialInterno);
    }
  });
  it('renderiza capítulos e resumo sem potencial; ações principais têm texto e destino',()=>{
    const {c,historia}=carreiraCompleta();
    const props={seed:c.seed,identidade:c.identidadeInicial,escolhas:historia,escolher:()=>{}};
    const tela=renderToStaticMarkup(createElement(SuaHistoria,{...props,capitulo:0}));
    const volta=renderToStaticMarkup(createElement(SuaHistoria,{...props,capitulo:0}));
    expect(tela).toBe(volta);expect((tela.match(/aria-pressed/g)??[]).length).toBe(3);
    const resumo=renderToStaticMarkup(createElement(SuaHistoria,{...props,capitulo:4}));expect(resumo).toContain('PRECISA DESENVOLVER');expect(resumo).not.toContain('potencialInterno');
    const central=renderToStaticMarkup(createElement(MercadoClube,{carreira:c,secao:'clube'}));
    expect(central).toContain('CONVERSAR COM O TREINADOR');expect(central).toContain('Gerenciar contrato');
    expect(renderToStaticMarkup(createElement(ConversaTreinador,{carreira:c}))).toMatch(/melhorar|oportunidade|papel/i);
    expect(renderToStaticMarkup(createElement(ConversaContrato,{carreira:c}))).toContain(c.acompanhamento.pedidosContrato.at(-1)!.resposta.replace(/&/g,'&amp;'));
    expect(Object.keys(NOMES_ATRIBUTOS).length).toBe(27);
  });
});
