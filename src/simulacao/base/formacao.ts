import type { EstadoCarreira } from '@/dominio/entidades/modelos';
import { estaSemClube } from '@/simulacao/carreira/agente-livre';
import { registrarEvento } from '../eventos/eventos';
import { limitar, somarDias } from '@/utilitarios/formatacao';

export function avaliarBase(c: EstadoCarreira, sessoesCentro = 0): void {
  const j = c.jogador, b = c.acompanhamento.base;
  if (estaSemClube(c) || j.categoria !== 'base') return;
  const clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  if (!clube) return;
  const treinos = j.preparacao.historico.filter(t => t.avaliacao !== 'Recuperação');
  const media = treinos.length ? treinos.reduce((s, t) => s + t.nota, 0) / treinos.length : 0;
  // Conta treino com o profissional só quando houve sessão real no Centro.
  if (b.conviteAte && b.conviteAte >= c.dataAtual && !j.lesao && sessoesCentro > 0) {
    b.treinosProfissional++;
    j.ritmo = limitar(j.ritmo + 1);
    j.confianca = limitar(j.confianca + .5);
  }
  if (b.ultimaAvaliacao && somarDias(b.ultimaAvaliacao, 28) > c.dataAtual) return;
  b.ultimaAvaliacao = c.dataAtual;
  const tecnica = j.overall >= clube.forcaGeral - 13 ? 'Muito boa' : 'Em desenvolvimento';
  const fisico = (j.atributos.forca + j.atributos.resistencia) / 2 >= 55 ? 'Boa base física' : 'Em desenvolvimento';
  const postura = (j.personalidade.disciplina + j.personalidade.profissionalismo) / 2 >= 65 ? 'Boa' : 'Precisa de regularidade';
  const treino = media >= 75 ? 'Excelente' : media >= 62 ? 'Muito bom' : media >= 50 ? 'Bom' : 'Em desenvolvimento';
  let situacao = 'Continue o plano e busque regularidade antes da próxima avaliação.';
  if (!j.lesao && j.overall >= clube.forcaGeral - 18 && media >= 62 && j.confianca >= 55 && (!b.conviteAte || b.conviteAte < c.dataAtual)) {
    b.conviteAte = somarDias(c.dataAtual, 28);
    situacao = 'Você foi convidado a treinar com o profissional por quatro semanas. Isso não é uma promoção definitiva.';
    registrarEvento(c, 'base-convite', 'Treino com o profissional', situacao, 'Treinador', false);
  }
  b.texto = `Técnica: ${tecnica}. Físico: ${fisico}. Treinos: ${treino}. Postura: ${postura}. ${situacao}`;
  registrarEvento(c, 'base-avaliacao', 'Avaliação mensal da base', b.texto, 'Treinador', false);
}

export function relacionadoProfissional(c: EstadoCarreira): boolean {
  if (estaSemClube(c)) return false;
  const j = c.jogador, b = c.acompanhamento.base, clube = c.clubes.find(cl => cl.id === c.clubeAtualId);
  if (!clube) return false;
  return j.categoria === 'base' && j.idade >= 16 && !j.lesao && j.suspensao === 0 && !!b.conviteAte && b.conviteAte >= c.dataAtual && b.treinosProfissional >= 2 && j.confianca >= 70 && j.overall >= clube.forcaGeral - 8 && clube.elenco.some(n => n.posicaoPrincipal === j.posicao && (n.lesionado || n.suspensao > 0));
}

/** Categoria da partida que o jogador disputa nesta semana (convocação não muda o vínculo). */
export function categoriaPartidaDaSemana(c: EstadoCarreira): 'base' | 'profissional' {
  return relacionadoProfissional(c) ? 'profissional' : c.jogador.categoria;
}
