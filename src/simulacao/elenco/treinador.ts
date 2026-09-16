import { calcularOverall } from "@/dominio/regras/jogador";
import { resolverHistoria } from "@/dominio/historia-formacao";
import type { EstadoCarreira, Posicao } from '@/dominio/entidades/modelos';
import type { AcaoTreinador } from '@/dominio/desenvolvimento';
import { avaliarHierarquia, posicoesPlausiveis } from './hierarquia';
import { registrarEvento } from '../eventos/eventos';
import { limitar, somarDias } from '@/utilitarios/formatacao';
export const ACOES_TREINADOR: Record<AcaoTreinador,string> = {
  motivo:'Por que não estou jogando?',oportunidade:'Pedir mais oportunidades',melhorar:'O que preciso melhorar?',papel:'Conversar sobre meu papel',posicao:'Pedir teste em outra posição',aceitar:'Aceitar meu papel atual',reclamar:'Reclamar da falta de minutos',cobrar:'Cobrar promessa não cumprida',
};
export function conversarTreinador(estado: EstadoCarreira, acao: AcaoTreinador, posicao?: Posicao): EstadoCarreira {
  if (estado.aposentado) throw new Error('A carreira já foi encerrada.');
  if (!Object.hasOwn(ACOES_TREINADOR,acao)) throw new Error('Conversa inválida.');
  const c = structuredClone(estado), a = c.acompanhamento, j = c.jogador;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId)!;
  if (a.proximaConversa && a.proximaConversa > c.dataAtual) throw new Error(`Nova conversa possível em aproximadamente ${Math.ceil((Date.parse(a.proximaConversa)-Date.parse(c.dataAtual))/604800000)} semana(s).`);
  const h = avaliarHierarquia(c);
  let resposta = `${h.motivo} Próximo passo: ${h.proximoPasso}`;
  if (acao === 'oportunidade') {
    if (a.promessa?.status === 'ativa') resposta = `Nosso compromisso continua: ${a.promessa.condicao}`;
    else if (j.lesao || j.condicionamento < 65) resposta = 'Primeiro complete a recuperação. Não vou prometer minutos enquanto seu preparo estiver comprometido.';
    else if (j.confianca >= 50 && c.relacionamentos.treinador >= 40 && h.ordem <= 3) {
      const tipo = j.confianca >= 62 && h.ordem <= 2 ? 'minutos' : 'avaliacao';
      const condicao = tipo === 'minutos' ? 'Dar uma oportunidade nas próximas três partidas, se você estiver disponível e em condições físicas.' : 'Reavaliar seu espaço após três partidas, considerando treinos, concorrência e preparo.';
      a.promessa = {tipo,clubeId:clube.id,treinadorId:clube.treinador.id,inicio:c.dataAtual,prazo:somarDias(c.dataAtual,35),condicao,status:'ativa',partidas:0,limitePartidas:3};
      resposta = condicao;
    } else resposta = `Ainda não é hora de prometer uma chance. ${h.motivo} ${h.proximoPasso}`;
  } else if (acao === 'melhorar') {
    resposta = `${h.proximoPasso} ${j.preparacao.historico.at(-1)?.nota && j.preparacao.historico.at(-1)!.nota < 55 ? 'O último treino ficou abaixo do esperado.' : 'Escolha um plano compatível com a função que quer disputar.'}`;
  } else if (acao === 'papel') resposta = `Seu papel atual é ${j.status}; o contrato prevê ${j.contrato.papelEsperado}. ${h.motivo}`;
  else if (acao === 'aceitar') { c.relacionamentos.treinador = limitar(c.relacionamentos.treinador+2+j.personalidade.lealdade/100); j.moral = limitar(j.moral+1); resposta = `Valorizo sua postura. Aceitar o papel não fecha a porta: ${h.proximoPasso}`; }
  else if (acao === 'reclamar') {
    const recente = j.notasRecentes.at(-1) ?? 6.5;
    c.relacionamentos.treinador = limitar(c.relacionamentos.treinador-((100-j.personalidade.temperamento) > clube.treinador.paciencia ? 4 : 2));
    j.moral = limitar(j.moral+1);
    resposta = recente >= 7 && !h.titular ? 'Entendo sua cobrança depois das boas atuações. Vou observar sua disputa pela vaga, mas não posso garantir titularidade.' : `A cobrança desgasta nossa relação. ${h.motivo} ${h.proximoPasso}`;
  } else if (acao === 'cobrar') {
    if (a.promessa?.status !== 'descumprida') resposta = 'Não há uma promessa descumprida para discutir agora.';
    else { j.moral = limitar(j.moral+2); c.relacionamentos.treinador = limitar(c.relacionamentos.treinador+1); resposta = 'Você tem razão em cobrar. Não cumpri o combinado; precisamos reconstruir a confiança e avaliar seu espaço.'; a.promessa.status = 'encerrada'; }
  } else if (acao === 'posicao') {
    if (!posicao || !posicoesPlausiveis(j).includes(posicao)) throw new Error('Escolha uma posição plausível para o seu perfil.');
    if (a.adaptacao?.status === 'concluida' && a.adaptacao.posicao === posicao && somarDias(a.adaptacao.inicio,112) <= c.dataAtual && calcularOverall(j.atributos,posicao) >= j.overall-2) {
      j.posicaoSecundaria=j.posicao; j.posicao=posicao; j.overall=calcularOverall(j.atributos,posicao);
      j.preparacao.planoId=null; j.preparacao.prioridades=[]; a.adaptacao=null;
      resposta=`Seu trabalho sustentou a mudança. ${posicao} passa a ser sua posição principal; escolha um plano para essa função.`;
    }
    else if (a.adaptacao?.status === 'ativa') resposta = 'Conclua o período de adaptação atual antes de começar outro.';
    else if (j.confianca < 45 || j.lesao) resposta = `Vamos esperar. ${h.proximoPasso}`;
    else { a.adaptacao = {posicao,inicio:c.dataAtual,semanas:0,clubeId:clube.id,status:'ativa'}; resposta = `Vamos trabalhar como ${posicao} durante pelo menos oito semanas de treino. Sua posição principal permanece ${j.posicao}; a avaliação definirá a alternativa.`; }
  }
  a.conversas = [...a.conversas,{data:c.dataAtual,acao,resposta,clubeId:clube.id}].slice(-30);
  a.proximaConversa = somarDias(c.dataAtual,['reclamar','oportunidade','cobrar'].includes(acao) ? 14 : 7);
  registrarEvento(c,'treinador',ACOES_TREINADOR[acao],resposta,'Treinador',false);
  return c;
}
export function atualizarCompromissos(c: EstadoCarreira): void {
  const a = c.acompanhamento, j = c.jogador;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId)!;
  const partida = [...c.temporada.partidas,...c.temporada.partidasBase].find(p => p.id === c.ultimaPartidaId);
  const p = a.promessa;
  if (p?.status === 'ativa') {
    if (p.clubeId !== clube.id || p.treinadorId !== clube.treinador.id) { p.status='encerrada'; registrarEvento(c,'promessa','Compromisso encerrado','A mudança de clube ou comissão encerrou o compromisso anterior.','Treinador',false); }
    else {
      if (partida) p.partidas++;
      if (p.tipo === 'minutos' && (partida?.participacao?.minutos ?? 0) > 0 || p.tipo === 'avaliacao' && (p.partidas >= p.limitePartidas || c.dataAtual >= p.prazo)) {
        p.status='cumprida'; c.relacionamentos.treinador=limitar(c.relacionamentos.treinador+3);
        registrarEvento(c,'promessa','Compromisso cumprido',p.tipo === 'minutos' ? 'Você recebeu a oportunidade combinada. A relação com a comissão melhorou.' : `A comissão reavaliou sua situação: ${avaliarHierarquia(c).motivo}`,'Treinador',false);
      } else if (p.partidas >= p.limitePartidas || c.dataAtual >= p.prazo) {
        p.status = j.lesao || j.suspensao > 0 || j.condicionamento < 65 ? 'encerrada' : 'descumprida';
        if (p.status === 'descumprida') { c.relacionamentos.treinador=limitar(c.relacionamentos.treinador-3); j.moral=limitar(j.moral-2); }
        registrarEvento(c,'promessa',p.status === 'descumprida' ? 'A oportunidade prometida não veio' : 'Compromisso encerrado por indisponibilidade',p.status === 'descumprida' ? 'Você pode cobrar o treinador na próxima conversa.' : 'A condição de disponibilidade não foi atendida. Converse após a recuperação.','Treinador',false);
      }
    }
  }
  if (j.perfilFormacao.origem === 'historia' && resolverHistoria(j.perfilFormacao.escolhas).some(o => o.afinidade === 'lideranca') && (j.preparacao.historico.at(-1)?.nota ?? 0) >= 65)
    j.personalidade.lideranca = limitar(j.personalidade.lideranca + .08);
  const adaptacao = a.adaptacao;
  if (adaptacao?.status === 'ativa') {
    if (adaptacao.clubeId !== clube.id) { a.adaptacao=null; registrarEvento(c,'posicao','Adaptação interrompida','Converse com a nova comissão para retomar o teste posicional.','Treinador',false); }
    else if (!j.lesao && j.preparacao.historico.at(-1)?.avaliacao !== 'Recuperação') {
      adaptacao.semanas++;
      if (adaptacao.semanas >= (j.personalidade.adaptabilidade >= 60 ? 8 : 10) && j.confianca >= 50 && posicoesPlausiveis(j).includes(adaptacao.posicao)) {
        j.posicaoSecundaria=adaptacao.posicao; adaptacao.status='concluida';
        registrarEvento(c,'posicao',`Nova posição secundária: ${adaptacao.posicao}`,'O período de trabalho convenceu a comissão. Você ganhou uma alternativa para disputar espaço.','Treinador');
      }
    }
  }
}
