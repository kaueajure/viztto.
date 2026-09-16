import type { Atributo, Posicao } from './entidades/modelos';
export interface PlanoDesenvolvimento { id: string; nome: string; posicoes: Posicao[]; atributos: Atributo[] }
export const PLANOS: PlanoDesenvolvimento[] = [
  { id:'finalizador',nome:'Finalizador',posicoes:['CA'],atributos:['finalizacao','compostura','posicionamento'] },
  { id:'movel',nome:'Atacante móvel',posicoes:['CA'],atributos:['aceleracao','drible','posicionamento'] },
  { id:'referencia',nome:'Homem de referência',posicoes:['CA'],atributos:['forca','cabeceio','dominio'] },
  { id:'segundo-atacante',nome:'Segundo atacante',posicoes:['CA','MEI'],atributos:['passeCurto','visao','finalizacao'] },
  { id:'armador',nome:'Armador',posicoes:['MC','MEI','VOL'],atributos:['visao','passeCurto','passeLongo'] },
  { id:'ofensivo',nome:'Meia ofensivo',posicoes:['MC','MEI'],atributos:['finalizacao','drible','decisao'] },
  { id:'box',nome:'Box-to-box',posicoes:['MC','VOL'],atributos:['resistencia','desarme','passeCurto'] },
  { id:'criador-avancado',nome:'Criador avançado',posicoes:['MEI'],atributos:['dominio','visao','decisao'] },
  { id:'invertido',nome:'Ponta invertido',posicoes:['PD','PE'],atributos:['finalizacao','drible','compostura'] },
  { id:'velocista',nome:'Velocista',posicoes:['PD','PE'],atributos:['aceleracao','velocidade','resistencia'] },
  { id:'criador-aberto',nome:'Criador aberto',posicoes:['PD','PE'],atributos:['cruzamento','visao','passeCurto'] },
  { id:'lateral-apoio',nome:'Lateral de apoio',posicoes:['LD','LE'],atributos:['cruzamento','resistencia','passeCurto'] },
  { id:'lateral-defensivo',nome:'Lateral defensivo',posicoes:['LD','LE'],atributos:['desarme','marcacao','antecipacao'] },
  { id:'ala',nome:'Ala',posicoes:['LD','LE'],atributos:['velocidade','drible','cruzamento'] },
  { id:'zagueiro',nome:'Defensor de área',posicoes:['ZAG'],atributos:['marcacao','cabeceio','forca'] },
  { id:'construtor',nome:'Defensor construtor',posicoes:['ZAG'],atributos:['passeCurto','passeLongo','decisao'] },
  { id:'cobertura',nome:'Defensor de cobertura',posicoes:['ZAG'],atributos:['antecipacao','velocidade','desarme'] },
  { id:'protetor',nome:'Protetor da defesa',posicoes:['VOL'],atributos:['marcacao','antecipacao','desarme'] },
  { id:'goleiro',nome:'Defensor de chutes',posicoes:['GOL'],atributos:['reflexos','defesaGoleiro','agilidade'] },
  { id:'goleiro-area',nome:'Dono da área',posicoes:['GOL'],atributos:['saida','posicionamentoGoleiro','concentracao'] },
  { id:'goleiro-linha',nome:'Goleiro construtor',posicoes:['GOL'],atributos:['reposicao','passeCurto','decisao'] },
];
export function planosDaPosicao(posicao: Posicao) { return PLANOS.filter(p => p.posicoes.includes(posicao)); }
export function prioridadesDaPosicao(posicao: Posicao): Atributo[] {
  return [...new Set(planosDaPosicao(posicao).flatMap(p => p.atributos))];
}
