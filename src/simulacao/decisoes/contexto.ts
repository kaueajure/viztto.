import type { EstadoCarreira } from '@/dominio/entidades/modelos';
import { GeradorAleatorio } from '@/utilitarios/aleatorio';
import { limitar, somarDias } from '@/utilitarios/formatacao';
import { registrarEvento } from '../eventos/eventos';
export function gerarContextoSemana(c:EstadoCarreira,rng:GeradorAleatorio):void {
  if(c.decisoes.some(d=>!d.resolvida))return;
  const ultima=c.acompanhamento.ultimoEventoContextual;
  if(ultima && somarDias(ultima,28)>c.dataAtual)return;
  const j=c.jogador,partida=[...c.temporada.partidas,...c.temporada.partidasBase].find(p=>p.id===c.ultimaPartidaId)?.participacao;
  const boaAtuacao=!!partida && partida.minutos>0 && (partida.gols>0||partida.assistencias>0||partida.defesas>=5||partida.desarmes>=6);
  const sequenciaRuim=j.notasRecentes.length>=3 && j.notasRecentes.slice(-3).every(n=>n<6.4);
  const conflito=(j.preparacao.historico.at(-1)?.nota??55)<45 && j.personalidade.temperamento<40 && j.personalidade.disciplina<50;
  const conselho=partida?.minutos===0 && !j.lesao && j.confianca<50;
  if(!(boaAtuacao||sequenciaRuim||conflito||conselho)||!rng.chance(.3))return;
  const tipo=boaAtuacao?'entrevista':sequenciaRuim?'pressao':conflito?'conflito-treino':'conselho-veterano';
  c.acompanhamento.ultimoEventoContextual=c.dataAtual;
  c.decisoes.push({id:`contexto-${tipo}-${c.dataAtual}`,data:c.dataAtual,tipo,remetente:tipo==='entrevista'||tipo==='pressao'?'Imprensa':'Treinador',titulo:tipo==='entrevista'?'Você merece começar jogando?':tipo==='pressao'?'A sequência ruim virou assunto':tipo==='conflito-treino'?'Discussão no treino':'Um conselho de quem já passou pelo banco',texto:tipo==='entrevista'?`Sua participação chamou atenção: ${partida!.gols} gol(s), ${partida!.assistencias} assistência(s), ${partida!.desarmes} desarmes e ${partida!.defesas} defesas. Como você fala sobre seu espaço?`:tipo==='pressao'?'A imprensa questiona suas últimas atuações. Seu posicionamento pode aliviar a pressão ou aumentar as expectativas.':tipo==='conflito-treino'?'Uma cobrança no treino virou discussão. A comissão espera uma resposta sua.':'Um veterano sugere investir em regularidade e conversar com a comissão. Como você quer conduzir esse momento?',opcoes:[{id:'diplomatica',rotulo:'Valorizar o trabalho coletivo e a paciência'},{id:'confiante',rotulo:'Assumir que está pronto para responder'},{id:'provocativa',rotulo:'Cobrar mais espaço publicamente'}],resolvida:false});
}
export function responderContexto(c:EstadoCarreira,opcao:string):void {
  const j=c.jogador;
  if(opcao==='diplomatica'){
    c.relacionamentos.treinador=limitar(c.relacionamentos.treinador+3);
    c.relacionamentos.diretoria=limitar(c.relacionamentos.diretoria+1);
    j.moral=limitar(j.moral-(j.personalidade.ambicao>70?1:0));
    j.personalidade.disciplina=limitar(j.personalidade.disciplina+.5);
    registrarEvento(c,'imprensa','Uma resposta de equipe','Sua postura aproximou a comissão. A exposição individual ficou em segundo plano.','Imprensa',false);
  }else if(opcao==='confiante'){
    j.moral=limitar(j.moral+2);j.reputacao=limitar(j.reputacao+.4);
    c.relacionamentos.treinador=limitar(c.relacionamentos.treinador-1);
    registrarEvento(c,'imprensa','Você assumiu a responsabilidade','A confiança ganhou atenção, mas a comissão espera que o discurso apareça no trabalho.','Imprensa',false);
  }else{
    j.reputacao=limitar(j.reputacao+1);j.moral=limitar(j.moral+1);
    c.relacionamentos.treinador=limitar(c.relacionamentos.treinador-(j.personalidade.temperamento<40?4:3));
    c.relacionamentos.diretoria=limitar(c.relacionamentos.diretoria-2);
    registrarEvento(c,'imprensa','A cobrança ganhou repercussão','Você ganhou visibilidade, mas a exposição do conflito desgastou a relação com treinador e diretoria.','Imprensa',false);
  }
}
export function avisarConcorrencia(c:EstadoCarreira,antes:EstadoCarreira):void {
  if(!c.clubeAtualId || c.clubeAtualId!==antes.clubeAtualId)return;
  const clube=c.clubes.find(cl=>cl.id===c.clubeAtualId);
  const antesClube=antes.clubes.find(cl=>cl.id===antes.clubeAtualId);
  if(!clube || !antesClube)return;
  const anteriores=new Set(antesClube.elenco.map(j=>j.id));
  const novo=clube.elenco.find(j=>!anteriores.has(j.id)&&(j.posicaoPrincipal===c.jogador.posicao||j.posicoesSecundarias.includes(c.jogador.posicao))&&j.overall>=c.jogador.overall);
  if(novo)registrarEvento(c,'concorrente','Novo concorrente',`O clube contratou ${novo.nome}, ${novo.posicaoPrincipal}, para a equipe principal. Seu espaço pode mudar; acompanhe a hierarquia.`,'Treinador',false);
  const indisponivel=clube.elenco.find(j=>(j.lesionado||j.suspensao>0)&&j.posicaoPrincipal===c.jogador.posicao&&antesClube.elenco.some(a=>a.id===j.id&&!a.lesionado&&a.suspensao===0));
  if(indisponivel && c.jogador.categoria==='profissional')registrarEvento(c,'oportunidade','Uma ausência pode abrir espaço',`${indisponivel.nome} está indisponível. A comissão reavaliará as opções para ${c.jogador.posicao}.`,'Treinador',false);
}
