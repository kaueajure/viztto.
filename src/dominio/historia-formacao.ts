import { CAPITULOS, type CapituloHistoria, type EscolhasHistoria, type PerfilFormacao } from './desenvolvimento';
import { NOMES_ATRIBUTOS, type Atributo, type Jogador, type Personalidade, type Posicao } from './entidades/modelos';
import { calcularOverall } from './regras/jogador';
import { gerarSeedNumerica, GeradorAleatorio } from '@/utilitarios/aleatorio';
import { limitar } from '@/utilitarios/formatacao';

export interface OpcaoHistoria {
  id: string; titulo: string; descricao: string; posicoes?: Posicao[];
  atributos: Partial<Record<Atributo, number>>;
  personalidade: Partial<Personalidade>;
  reputacao: number; condicionamento: number;
  afinidade?: 'tecnica' | 'fisico-tardio' | 'lideranca';
}
const linha: Posicao[] = ['LD','LE','ZAG','VOL','MC','MEI','PD','PE','CA'];
const ataque: Posicao[] = ['MEI','PD','PE','CA'];
const defesa: Posicao[] = ['LD','LE','ZAG','VOL'];
function opcao(id: string, titulo: string, descricao: string, atributos: OpcaoHistoria['atributos'], personalidade: OpcaoHistoria['personalidade'] = {}, posicoes?: Posicao[], afinidade?: OpcaoHistoria['afinidade'], reputacao = 0, condicionamento = 0): OpcaoHistoria {
  return { id, titulo, descricao, atributos, personalidade, posicoes, afinidade, reputacao, condicionamento };
}
export const HISTORIAS: Record<CapituloHistoria, OpcaoHistoria[]> = {
  origem: [
    opcao('futsal','Craque do futsal','Espaços curtos ensinaram você a pensar e agir rápido. O contato físico ainda exige trabalho.',{ dominio:3, drible:2, passeCurto:2, forca:-3, cabeceio:-2 },{ adaptabilidade:2 },linha,'tecnica'),
    opcao('rua','Futebol de rua','Você aprendeu a improvisar. Organizar o jogo coletivo veio depois.',{ drible:3, agilidade:2, decisao:-3 },{ disciplina:-3, ambicao:2 },linha),
    opcao('camisa-9','Camisa 9 desde criança','A área era seu território. A construção das jogadas ficou para os colegas.',{ finalizacao:3, posicionamento:2, cabeceio:2, passeLongo:-3, passeCurto:-2 },{},ataque),
    opcao('escolinha','Meia da escolinha','Você aprendeu a encontrar o passe antes de ganhar força.',{ visao:3, passeCurto:2, passeLongo:2, forca:-3, finalizacao:-2 },{ disciplina:2 },['MC','MEI','VOL']),
    opcao('pontas','Corridas pelo corredor','Arrancadas abriram portas, mas o último passe ainda precisa amadurecer.',{ aceleracao:3, velocidade:3, cruzamento:-3, decisao:-2 },{},['LD','LE','PD','PE']),
    opcao('defensiva','Escola da defesa','Proteger o time virou hábito. Criar com a bola exige mais paciência.',{ desarme:3, marcacao:3, passeLongo:-3, drible:-2 },{ lealdade:3 },defesa),
    opcao('areia','Futebol na areia','O chão irregular fortaleceu seu equilíbrio; a precisão no gramado ainda está em construção.',{ agilidade:3, forca:2, passeCurto:-3 },{ adaptabilidade:3 }),
    opcao('interior','Campos do interior','Disputas duras formaram sua resistência. A leitura do jogo rápido ainda é novidade.',{ resistencia:3, forca:2, decisao:-3 },{ lealdade:3, adaptabilidade:-2 }),
    opcao('capitao','Capitão da turma','Você aprendeu a organizar os colegas antes de refinar a própria técnica.',{ concentracao:3, decisao:2, dominio:-3 },{ lideranca:5, temperamento:-2 },undefined,'lideranca'),
    opcao('traves','Entre as traves','Defesas difíceis chamavam atenção; sair jogando não era prioridade.',{ reflexos:3, defesaGoleiro:3, reposicao:-4 },{ disciplina:2 },['GOL']),
    opcao('goleiro-futsal','Goleiro de quadra','Reação curta e reposição rápida marcaram sua formação. Bolas altas pedem adaptação.',{ reflexos:3, reposicao:3, saida:-4 },{ adaptabilidade:3 },['GOL'],'tecnica'),
    opcao('goleiro-area','Dono da pequena área','Você cresceu atacando cruzamentos. Defesas rasteiras ainda pedem cuidado.',{ saida:3, posicionamentoGoleiro:3, agilidade:-3, reflexos:-1 },{ lideranca:3 },['GOL']),
  ],
  destaque: [
    opcao('frieza','Frieza diante do gol','Você finaliza com calma, mas demora a acelerar a jogada.',{ finalizacao:4, compostura:2, aceleracao:-3 },{},ataque),
    opcao('leitura','Leitura de jogo','Antecipar a jogada compensa uma arrancada menos forte.',{ antecipacao:3, decisao:3, aceleracao:-3 },{ disciplina:2 }),
    opcao('um-contra-um','Um contra um','Você desequilibra no drible; soltar a bola na hora certa é o desafio.',{ drible:4, agilidade:2, passeCurto:-3 },{ ambicao:3 },linha),
    opcao('explosao','Explosão','Os primeiros metros impressionam. Sustentar esse ritmo custa energia.',{ aceleracao:4, velocidade:2, resistencia:-3 },{},linha),
    opcao('entre-linhas','Passe entre linhas','Você encontra caminhos difíceis, às vezes assumindo riscos demais.',{ visao:4, passeLongo:2, concentracao:-3 },{},['VOL','MC','MEI','PD','PE']),
    opcao('dominio','Domínio em espaços curtos','A bola fica perto do pé. O jogo aéreo ainda passa longe.',{ dominio:4, passeCurto:2, cabeceio:-3 },{},linha,'tecnica'),
    opcao('forca','Presença física','Você protege o espaço, mas precisa soltar os movimentos.',{ forca:4, resistencia:2, agilidade:-3 },{}),
    opcao('aereo','Jogo aéreo','Você ataca a bola pelo alto. A condução rasteira pede refinamento.',{ cabeceio:4, impulsao:2, drible:-3 },{},linha),
    opcao('duas-pernas','Recursos com os dois pés','Você distribui a bola em várias direções; falta potência na conclusão.',{ passeCurto:3, passeLongo:3, finalizacao:-3 },{},linha),
    opcao('lideranca','Liderança precoce','Você organiza a equipe, mas ainda se cobra demais nos momentos decisivos.',{ concentracao:3, posicionamento:2, compostura:-3 },{ lideranca:5, temperamento:2 }),
    opcao('reflexos','Reflexos rápidos','A reação impressiona. Escolher a hora de sair é o próximo passo.',{ reflexos:4, defesaGoleiro:2, saida:-3 },{},['GOL']),
    opcao('posicionamento-gol','Leitura entre as traves','Você fecha os ângulos; a reposição longa ainda precisa de trabalho.',{ posicionamentoGoleiro:4, concentracao:2, reposicao:-3 },{},['GOL']),
  ],
  dificuldade: [
    opcao('fisico-tardio','Físico tardio','Sua técnica chegou antes do corpo. O trabalho físico poderá render melhor entre 18 e 20 anos.',{ dominio:2, forca:-4, resistencia:-3 },{ profissionalismo:3 },undefined,'fisico-tardio'),
    opcao('individualista','Individualista','Você confia nos próprios recursos e ainda aprende a servir o coletivo.',{ drible:2, decisao:-3, posicionamento:-2 },{ disciplina:-4, ambicao:3 },linha),
    opcao('irregular','Irregularidade','Você alterna lampejos e distrações. Consistência pode ser construída.',{ agilidade:2, concentracao:-4 },{ disciplina:-2 }),
    opcao('lesoes-formacao','Lesões na formação','Voltar aos treinos ensinou paciência. Você chega precisando recuperar o preparo.',{ compostura:2, resistencia:-3 },{ profissionalismo:4 },undefined,undefined,0,-8),
    opcao('timido','Tímido fora de campo','O treino é seu lugar de confiança. Fora dele, se apresentar ainda custa.',{ concentracao:2, decisao:-2 },{ profissionalismo:3, adaptabilidade:-3 },undefined,undefined,-4),
    opcao('ansiedade','Ansiedade em grandes jogos','Você se prepara com dedicação, mas o barulho da arquibancada ainda pesa.',{ resistencia:2, compostura:-4 },{ profissionalismo:3, temperamento:2 }),
    opcao('mudancas','Muitas mudanças de equipe','Recomeçar ensinou adaptação, mas faltou continuidade nos fundamentos.',{ antecipacao:2, dominio:-3 },{ adaptabilidade:5, lealdade:-3 }),
    opcao('estatura','Crescimento desajeitado','Você ganhou alcance antes de aprender a coordenar o corpo.',{ impulsao:2, agilidade:-4 },{ disciplina:3 }),
  ],
  chegada: [
    opcao('joia','Joia precoce','Você chega com recursos e atenção. A expectativa cobra calma para responder.',{ decisao:2, dominio:2, compostura:-3 },{ ambicao:3, temperamento:2 },undefined,undefined,5),
    opcao('longo-prazo','Projeto de longo prazo','Os fundamentos ainda são modestos. Paciência e dedicação sustentam seu caminho.',{ dominio:-2, forca:-2, concentracao:2 },{ profissionalismo:5, disciplina:2 },undefined,'tecnica',-2),
    opcao('azarao','Azarão','Pouca gente conhece você. Sua resistência é o recurso para insistir.',{ resistencia:4, dominio:-2, decisao:-2 },{ ambicao:4 },undefined,undefined,-4),
    opcao('pronto-fisico','Pronto fisicamente','O corpo já acompanha a disputa. O toque fino vai exigir repetição.',{ forca:3, resistencia:3, dominio:-3, decisao:-2 },{ disciplina:2 }),
    opcao('tecnico-cru','Técnico, mas cru','A bola obedece. O corpo e as escolhas ainda precisam acompanhar.',{ dominio:3, passeCurto:3, forca:-3, decisao:-3 },{ ambicao:2 },undefined,'tecnica'),
    opcao('operario','Operário da equipe','Você chega disposto a cumprir a função. Improvisar ainda não é confortável.',{ resistencia:2, concentracao:2, agilidade:-3 },{ disciplina:4, lealdade:3 }),
    opcao('recem-chegado','Recém-chegado à cidade','Você traz leitura e curiosidade, mas precisa se adaptar ao novo ambiente.',{ antecipacao:3, compostura:-3 },{ adaptabilidade:4, lideranca:-3 },undefined,undefined,-1),
    opcao('competidor','Competidor de torneios','A disputa ensinou coragem. Controlar a intensidade ainda é um aprendizado.',{ compostura:3, agressividade:2, concentracao:-3 },{ ambicao:3, disciplina:-3 }),
  ],
};
export const PERGUNTAS_HISTORIA: Record<CapituloHistoria,string> = {
  origem: 'Onde seu futebol começou?', destaque: 'O que fez os olheiros notarem você?',
  dificuldade: 'Nem tudo foi fácil. O que marcou sua formação?', chegada: 'Como você chega à base?',
};
export function sortearHistoria(seed: string, posicao: Posicao): Record<CapituloHistoria, OpcaoHistoria[]> {
  return Object.fromEntries(CAPITULOS.map(capitulo => {
    const rng = new GeradorAleatorio(gerarSeedNumerica(`${seed}:historia-v1:${posicao}:${capitulo}`));
    const opcoes = HISTORIAS[capitulo].filter(o => !o.posicoes || o.posicoes.includes(posicao));
    for (let i = opcoes.length - 1; i > 0; i--) { const n = rng.inteiro(0,i); [opcoes[i],opcoes[n]] = [opcoes[n],opcoes[i]]; }
    return [capitulo, opcoes.slice(0,3)];
  })) as Record<CapituloHistoria, OpcaoHistoria[]>;
}
export function resolverHistoria(escolhas: EscolhasHistoria): OpcaoHistoria[] {
  return CAPITULOS.map(capitulo => {
    const opcao = HISTORIAS[capitulo].find(o => o.id === escolhas[capitulo]);
    if (!opcao) throw new Error('Escolha uma opção válida em cada capítulo da sua história.');
    return opcao;
  });
}
export function validarEscolhasHistoria(seed: string, posicao: Posicao, escolhas: EscolhasHistoria): void {
  const sorteio = sortearHistoria(seed, posicao);
  if (CAPITULOS.some(c => !sorteio[c].some(o => o.id === escolhas[c])))
    throw new Error('Revise sua história: as escolhas devem corresponder à posição e às opções oferecidas.');
}
export function resumirHistoria(escolhas: EscolhasHistoria) {
  const opcoes = resolverHistoria(escolhas);
  const modificadores: Partial<Record<Atributo,number>> = {};
  for (const o of opcoes) for (const [a,v] of Object.entries(o.atributos)) modificadores[a as Atributo] = (modificadores[a as Atributo] ?? 0) + v;
  const ordenados = (Object.entries(modificadores) as [Atributo,number][]).sort((a,b) => b[1]-a[1]);
  return { opcoes, qualidades: ordenados.filter(([,v]) => v > 0).slice(0,4).map(([a]) => NOMES_ATRIBUTOS[a]),
    desenvolver: [...ordenados].reverse().filter(([,v]) => v < 0).slice(0,3).map(([a]) => NOMES_ATRIBUTOS[a]),
    perfil: opcoes[1].titulo };
}
/** Aplicada somente pelo caso de uso de criação, nunca durante hidratação. */
export function aplicarHistoria(j: Jogador, seed: string, escolhas: EscolhasHistoria): void {
  validarEscolhasHistoria(seed,j.posicao,escolhas);
  for (const o of resolverHistoria(escolhas)) {
    for (const [a,v] of Object.entries(o.atributos)) j.atributos[a as Atributo] += v;
    for (const [p,v] of Object.entries(o.personalidade)) j.personalidade[p as keyof Personalidade] = limitar(j.personalidade[p as keyof Personalidade] + v,1,99);
    j.reputacao = limitar(j.reputacao + o.reputacao);
    j.condicionamento = limitar(j.condicionamento + o.condicionamento);
  }
  for (const a of Object.keys(j.atributos) as Atributo[]) j.atributos[a] = limitar(j.atributos[a],1,j.idade < 17 ? 78 : 88);
  j.overall = calcularOverall(j.atributos,j.posicao);
  j.potencialInterno = Math.max(j.overall,j.potencialInterno);
  j.perfilFormacao = { origem:'historia', versao:1, seed, escolhas: { ...escolhas } };
}
export function afinidadeHistoria(perfil: PerfilFormacao, atributo: Atributo, idade: number): number {
  if (perfil.origem === 'legado') return 1;
  const afinidades = resolverHistoria(perfil.escolhas).map(o => o.afinidade);
  const tecnica = ['dominio','passeCurto','passeLongo','visao','drible','reposicao'].includes(atributo);
  const fisico = ['forca','resistencia','impulsao'].includes(atributo);
  return 1 + (tecnica && afinidades.includes('tecnica') ? .04 : 0) + (fisico && idade >= 18 && idade <= 20 && afinidades.includes('fisico-tardio') ? .06 : 0);
}
