Quero implementar uma nova grande fase no Viztto focada em transformar a carreira de jogador em uma experiência muito mais ativa, profunda e pessoal.

Projeto:
https://github.com/kaueajure/viztto.

IMPORTANTE:
- O nome do repositório termina com ".".
- Trabalhe sobre a branch main LOCAL atual.
- Analise COMPLETAMENTE o estado atual antes de alterar arquivos.
- Não suponha que a arquitetura ainda esteja exatamente igual às fases anteriores.
- Preserve quaisquer correções de persistência, performance, UX e mercado que já estejam presentes na main.
- NÃO faça git push.
- NÃO faça deploy.
- NÃO faça commit.
- NÃO recrie o projeto.
- NÃO volte a usar localStorage.
- PostgreSQL continua sendo a fonte de verdade da carreira.
- Zustand continua sendo apenas estado runtime.
- Não alterar Nginx, PM2 ou infraestrutura.
- Não transformar o jogo em Football Manager completo.
- O Viztto continua sendo um simulador de CARREIRA DE JOGADOR.
- Não existem partidas controláveis.
- Não criar minigames arcade.

==================================================
NOVA FASE — IDENTIDADE, DESENVOLVIMENTO E AGÊNCIA
==================================================

Existem dois grandes objetivos:

1. Criar o sistema "SUA HISTÓRIA", internamente podendo ser chamado de DNA DO JOGADOR.

2. Reconstruir o loop da carreira para que o usuário tenha maneiras reais de influenciar:
   - desenvolvimento;
   - espaço no elenco;
   - relacionamento com treinador;
   - contrato;
   - transferência;
   - empréstimo;
   - reputação;
   - decisões da carreira.

Hoje não quero que a carreira seja:

AVANÇAR SEMANA
→ RNG decide se jogo
→ talvez eu evolua
→ avançar novamente.

Quero:

ENTENDER MINHA SITUAÇÃO
→ TOMAR DECISÕES
→ TREINAR / CONVERSAR / NEGOCIAR
→ AVANÇAR
→ MUNDO REAGE
→ RECEBER FEEDBACK
→ ADAPTAR MEU PLANO

Mesmo ficar no banco precisa gerar gameplay.

==================================================
PARTE 1 — AUDITORIA OBRIGATÓRIA
==================================================

Antes de implementar:

1. Analise EstadoCarreira e todos os tipos associados.
2. Analise criação da carreira.
3. Analise geração dos atributos iniciais.
4. Analise potencialInterno.
5. Analise personalidade.
6. Analise treinamento e evolução.
7. Analise confiança do treinador.
8. Analise lógica de escalação.
9. Analise status/papel no elenco.
10. Analise base/profissional.
11. Analise contratos.
12. Analise agente e mercado.
13. Analise decisões e eventos.
14. Analise notícias.
15. Analise avanço semanal.
16. Analise persistência PostgreSQL.
17. Analise schemas Zod.
18. Analise serialização/hidratação.
19. Analise componentes da página inicial.
20. Analise testes existentes.

Procure especialmente por:

- mecanismos que já possam ser reutilizados;
- regras duplicadas;
- variáveis que existem mas quase não afetam gameplay;
- funções que alteram confiança;
- lógica responsável por escolher titular/reserva;
- evolução dependente demais de minutos em campo;
- ações silenciosas sem feedback para usuário.

NÃO crie sistemas paralelos quando já existir uma boa fundação.

==================================================
PARTE 2 — "SUA HISTÓRIA" / DNA DO JOGADOR
==================================================

Quero uma experiência original antes da carreira começar.

NÃO quero copiar o sistema de selecionar habilidades de jogadores famosos.

NÃO usar:

- nomes de jogadores reais;
- cartas de jogadores reais;
- "pegue o drible de X";
- "pegue a finalização de Y";
- interface semelhante a Ultimate Team;
- imagens de jogadores famosos.

A ideia central será:

O JOGADOR CONSTRÓI O PASSADO DO ATLETA.

Nome apresentado ao usuário:

"SUA HISTÓRIA"

Nome interno sugerido:

DNAJogador
PerfilFormacao
HistoriaFormacao

ou nomenclatura melhor em português-BR.

==================================================
FLUXO DA NOVA CARREIRA
==================================================

A criação deve seguir aproximadamente:

IDENTIDADE
   ↓
POSIÇÃO
   ↓
SUA HISTÓRIA
   ↓
CAPÍTULO 1 — ORIGEM
   ↓
CAPÍTULO 2 — O QUE CHAMOU ATENÇÃO
   ↓
CAPÍTULO 3 — DIFICULDADE NA FORMAÇÃO
   ↓
CAPÍTULO 4 — COMO CHEGA À BASE
   ↓
RESUMO DO PERFIL
   ↓
ESCOLHA DO CLUBE / LIGA
   ↓
CONFIRMAR CARREIRA

Adapte à ordem atual da criação caso haja uma razão arquitetural forte.

Mas "Sua História" precisa acontecer ANTES da carreira ser definitivamente criada.

==================================================
GERAÇÃO DAS OPÇÕES
==================================================

Cada capítulo deve:

- possuir um conjunto grande de opções;
- sortear 3 opções para aquela nova carreira;
- usar RNG determinístico/seed;
- manter as mesmas opções se o usuário apenas voltar uma tela;
- não mudar aleatoriamente a cada render;
- ser sensível à posição quando apropriado.

Não usar Math.random() solto.

Utilizar GeradorAleatorio ou arquitetura equivalente existente.

As escolhas devem ser persistidas no save.

==================================================
CAPÍTULO 1 — ORIGEM
==================================================

Pergunta:

"ONDE SEU FUTEBOL COMEÇOU?"

Criar pelo menos 8–12 possibilidades.

Exemplos conceituais:

CRAQUE DO FUTSAL

Descrição:
"Espaços curtos ensinaram você a pensar e agir rápido."

Favorece:
- controle de bola;
- drible;
- agilidade;
- passe curto.

Ponto de atenção:
- força;
- jogo aéreo.

---

FUTEBOL DE RUA

Favorece:
- improvisação;
- drible;
- equilíbrio;
- criatividade.

Ponto de atenção:
- disciplina tática.

---

CAMISA 9 DESDE CRIANÇA

Favorece:
- finalização;
- posicionamento ofensivo;
- cabeceio.

Ponto de atenção:
- construção.

---

MEIA DA ESCOLINHA

Favorece:
- visão;
- passe curto;
- passe longo;
- controle.

Ponto de atenção:
- físico/finalização.

---

VELOCIDADE NAS PONTAS

Favorece:
- aceleração;
- velocidade;
- drible em progressão.

---

FORMAÇÃO DEFENSIVA

Para posições adequadas.

Favorece:
- desarme;
- posicionamento;
- força;
- leitura defensiva.

Não limitar a esses exemplos.

Criar opções próprias coerentes com todas as posições do jogo.

==================================================
CAPÍTULO 2 — PRIMEIRO GRANDE DESTAQUE
==================================================

Pergunta:

"O QUE FEZ OS OLHEIROS NOTAREM VOCÊ?"

Exemplos:

FRIEZA DIANTE DO GOL

LEITURA DE JOGO

UM CONTRA UM

EXPLOSÃO

PASSE ENTRE LINHAS

DOMÍNIO EM ESPAÇOS CURTOS

FORÇA FÍSICA

JOGO AÉREO

ANTECIPAÇÃO

QUALIDADE COM AS DUAS PERNAS

LIDERANÇA

REFLEXOS / POSICIONAMENTO
para goleiros.

Cada escolha precisa gerar uma IDENTIDADE diferente.

==================================================
CAPÍTULO 3 — DIFICULDADE
==================================================

Pergunta:

"NEM TUDO FOI FÁCIL. O QUE MARCOU SUA FORMAÇÃO?"

Essa etapa é MUITO importante.

Não quero 4 escolhas que sejam apenas bônus.

Toda carreira precisa ter imperfeições.

Exemplos:

FÍSICO TARDIO

Descrição:
"Sua técnica sempre esteve à frente do seu desenvolvimento físico."

Pode:
- favorecer desenvolvimento técnico;
- começar com força/resistência menores;
- permitir crescimento físico posterior maior.

---

INDIVIDUALISTA

- mais confiança no 1x1;
- tendência técnica/ofensiva;
- menor disciplina tática inicial;
- relacionamento com treinador pode exigir amadurecimento.

---

IRREGULARIDADE

- picos bons;
- consistência inicial menor;
- forma pode oscilar mais.

---

LESÕES NA FORMAÇÃO

Não criar condenação permanente.

Pode:
- ligeira penalidade inicial de condicionamento;
- pequena característica de recuperação/resiliência;
- histórico narrativo.

Não criar risco absurdo de lesão por toda carreira.

---

TÍMIDO FORA DE CAMPO

- menos reputação inicial;
- adaptação midiática mais lenta;
- talvez maior foco/profissionalismo.

---

ANSIEDADE NOS GRANDES JOGOS

Pode afetar consistência inicial,
mas ser superável com experiência.

IMPORTANTE:

Fraquezas não devem ser maldições permanentes.

A carreira deve permitir que o jogador SUPERE parte delas.

==================================================
CAPÍTULO 4 — COMO VOCÊ CHEGA AOS 15/16 ANOS
==================================================

Pergunta:

"COMO VOCÊ CHEGA À BASE?"

Exemplos:

JOIA PRECOCE

- overall inicial um pouco maior;
- reputação maior;
- expectativa maior;
- mais pressão;
- desenvolvimento não necessariamente maior.

PROJETO DE LONGO PRAZO

- overall inicial menor;
- desenvolvimento inicial mais interessante;
- paciência do clube;
- potencial percebido melhor.

AZARÃO

- reputação baixa;
- pouca expectativa;
- atributos gerais modestos;
- uma característica muito forte.

ATLETA PRONTO FISICAMENTE

- vantagem física;
- menos refinamento técnico.

TÉCNICO MAS CRU

- boa técnica;
- tomada de decisão/físico inferiores.

Criar um conjunto maior e balanceado.

==================================================
NÃO CRIAR "META" ÓBVIO
==================================================

As opções não podem simplesmente ser:

+5 finalização
+5 drible
+5 velocidade

sem consequência.

Cada perfil precisa possuir:

BENEFÍCIO
+
CUSTO
+
IDENTIDADE

Não deve existir uma combinação obviamente superior em todas as situações.

==================================================
APLICAÇÃO NOS ATRIBUTOS
==================================================

Criar uma camada central de aplicação dos modificadores.

Algo como:

gerarBaseJogador(...)
+
aplicarHistoriaFormacao(...)
=
atributos iniciais finais

Não espalhar:

if historia === ...

por dezenas de arquivos.

Criar definições declarativas.

Exemplo conceitual:

{
 id: "futsal",
 titulo: "Craque do futsal",
 descricao: "...",
 modificadoresAtributos: {...},
 modificadoresPersonalidade: {...},
 tags: [...]
}

Não precisa usar exatamente esse formato.

==================================================
LIMITES
==================================================

As escolhas NÃO devem criar:

- jogador de 15 anos com overall absurdo;
- atributos acima do limite;
- atributos negativos;
- potencial 99 garantido;
- velocidade 95 inicial;
- builds quebradas.

Após modificadores:

recalcular overall pelas funções reais do projeto.

Não definir overall manualmente de forma inconsistente.

==================================================
PERSONALIDADE
==================================================

"Sua História" também deve influenciar levemente:

- profissionalismo;
- ambição;
- lealdade;
- disciplina;
- temperamento;
- adaptabilidade;
- liderança;

quando fizer sentido.

Mas não revelar números internos ao usuário.

Mostrar conceitos qualitativos.

==================================================
POTENCIAL
==================================================

NÃO mostrar potencialInterno.

Nunca mostrar:

"Potencial 92".

Pode mostrar:

Potencial percebido:
- limitado;
- interessante;
- promissor;
- grande promessa;
- excepcional;

ou estrelas aproximadas.

Esse valor percebido pode conter incerteza.

Não tornar potencial percebido uma cópia exata do potencialInterno.

==================================================
EFEITOS DE LONGO PRAZO
==================================================

Algumas origens podem possuir efeitos pequenos e duradouros.

Exemplos:

Futsal:
leve afinidade com desenvolvimento técnico.

Físico tardio:
crescimento físico pode ficar mais favorável após certa idade.

Líder desde cedo:
melhor evolução de liderança/relação com elenco.

Não exagerar.

Não transformar isso em RPG com buffs gigantes.

==================================================
RESUMO FINAL DO DNA
==================================================

Antes de escolher clube/iniciar carreira:

mostrar uma tela forte.

Exemplo:

KAUÊ AJURE
15 anos
MEI

PERFIL
Armador técnico

SUA HISTÓRIA

Origem:
Futsal

Primeiro destaque:
Visão de jogo

Dificuldade:
Físico tardio

Chegada à base:
Projeto de longo prazo

PRINCIPAIS QUALIDADES

Controle
Visão
Drible
Passe curto

PRECISA DESENVOLVER

Força
Finalização
Resistência

Não revelar matemática interna demais.

==================================================
COMPATIBILIDADE
==================================================

Carreiras antigas não possuem "Sua História".

NÃO gerar uma história aleatória retroativamente.

Saves legados devem receber algo como:

perfilFormacao:
{
  origem: "legado"
}

ou equivalente.

Não alterar seus atributos.

==================================================
PARTE 3 — NOVO LOOP DA CARREIRA
==================================================

Depois da criação, quero que toda semana o jogador tenha coisas para FAZER e COMPREENDER.

O núcleo deve ser:

SITUAÇÃO
→ DECISÃO
→ PREPARAÇÃO
→ SEMANA
→ CONSEQUÊNCIA
→ FEEDBACK

==================================================
PARTE 4 — RELACIONAMENTO COM O TREINADOR
==================================================

Criar uma área real de:

"CONVERSAR COM O TREINADOR"

Pode ficar dentro de:

Clube
ou
Jogador

desde que seja fácil de descobrir.

Ações possíveis:

- Perguntar por que não estou jogando.
- Pedir mais oportunidades.
- Perguntar o que preciso melhorar.
- Conversar sobre meu papel.
- Pedir para ser testado em outra posição.
- Aceitar meu papel atual.
- Reclamar da falta de minutos.
- Conversar sobre promessa não cumprida.

Não permitir spam.

Adicionar cooldown contextual.

==================================================
RESPOSTAS DO TREINADOR
==================================================

O treinador precisa responder de acordo com:

- status no elenco;
- overall;
- concorrência;
- confiança;
- forma;
- moral;
- condicionamento;
- treinamento;
- desempenho recente;
- tática;
- posição;
- personalidade do treinador, se já existir;
- relacionamento;
- promessa existente.

Não usar resposta completamente aleatória.

==================================================
EXEMPLO
==================================================

Jogador:

MEI
overall 69
confiança 42

Titular:

MEI
overall 75
boa forma
confiança alta.

Ao perguntar:

"Por que não estou jogando?"

Resposta:

"Hoje o Lucas está à sua frente. Ele vem rendendo melhor e oferece mais segurança na criação. Continue bem nos treinos e aproveite as oportunidades entrando durante os jogos."

Pode adicionar:

"PRÓXIMO PASSO:
Melhore seu desempenho nos treinos e aumente sua confiança."

Não precisa revelar fórmulas.

==================================================
PEDIR OPORTUNIDADE
==================================================

O jogador pode pedir uma chance.

Treinador pode:

- aceitar;
- recusar;
- prometer minutos;
- prometer avaliar;
- pedir desempenho de treino;
- dizer que ainda não é hora.

Não garantir titularidade porque o usuário clicou.

==================================================
PROMESSAS DO TREINADOR
==================================================

Criar sistema leve de compromissos.

Exemplo:

"Vou dar uma oportunidade nas próximas 3 partidas."

Persistir:

- tipo;
- início;
- prazo;
- condição;
- status.

Se treinador cumprir:
relacionamento melhora.

Se não cumprir:
jogador pode cobrar.

Isso deve gerar notícia/mensagem contextual.

Não criar dezenas de tipos inicialmente.

Começar com poucos tipos realmente úteis.

==================================================
OUTRA POSIÇÃO
==================================================

Permitir:

"Quero ser testado em outra posição."

Somente posições plausíveis.

Exemplo:

PD → PE / MEI / CA dependendo atributos.

ZAG → VOL em alguns casos.

Não permitir:

GOL → CA

sem lógica.

Treinador pode aceitar ou negar.

Se aceitar:

criar período de adaptação.

Não mudar posição principal imediatamente.

Após semanas/meses:

posição pode virar secundária,
e eventualmente principal se desenvolvimento justificar.

==================================================
PARTE 5 — HIERARQUIA DO ELENCO
==================================================

Hoje o usuário precisa entender claramente:

"QUAL É MEU LUGAR NO TIME?"

Na página Clube/Jogador mostrar:

SUA POSIÇÃO NO ELENCO

Exemplo:

MEI

1. Lucas Silva — 76
2. Rafael — 72
3. Kauê — 69
4. Bruno — 66

Mas cuidado:

Não precisa necessariamente expor overall exato de todos se o projeto decidir ocultar.

Pode mostrar estimativa/faixa.

O importante é mostrar:

- posição hierárquica;
- titular atual;
- principais concorrentes;
- motivo;
- distância qualitativa.

==================================================
EXPLICAÇÃO
==================================================

Exemplo:

"Você é atualmente a 3ª opção."

Motivos:

- Lucas possui melhor nível atual.
- Rafael está em melhor forma.
- Sua confiança com o treinador ainda é baixa.

PRÓXIMO PASSO:

"Boas avaliações de treino podem colocá-lo na rotação."

==================================================
MUDANÇA NA HIERARQUIA
==================================================

Quando o jogador subir:

mostrar evento.

"VOCÊ SUBIU NA HIERARQUIA"

"Agora é a segunda opção para MEI."

Se virar titular:

isso precisa parecer importante.

"VOCÊ CONQUISTOU A VAGA."

Não deixar acontecer silenciosamente.

==================================================
PARTE 6 — TREINAMENTO E DESENVOLVIMENTO
==================================================

Este é um dos pontos mais importantes.

O jogador NÃO pode depender exclusivamente de entrar em campo para evoluir.

Partidas continuam importantes.

Mas treinamento precisa ser uma segunda fonte relevante.

==================================================
PLANO DE DESENVOLVIMENTO
==================================================

Criar:

PLANO DE DESENVOLVIMENTO

Exemplos para atacante:

Finalizador
Atacante móvel
Homem de referência
Segundo atacante

Meia:

Armador
Meia ofensivo
Box-to-box
Criador avançado

Ponta:

Ponta invertido
Velocista
Criador aberto

Defensores etc.

Cada posição deve ter opções adequadas.

==================================================
ATRIBUTOS PRIORITÁRIOS
==================================================

Além do plano, permitir escolher no máximo:

1 ou 2 prioridades individuais.

Exemplo:

Plano:
Armador

Prioridades:
Visão
Passe longo

Não deixar selecionar 10 atributos.

==================================================
TREINO SEMANAL
==================================================

A cada semana gerar avaliação de treino.

Exemplo:

RUIM
REGULAR
BOM
MUITO BOM
EXCELENTE

Resultado deve considerar:

- profissionalismo;
- disciplina;
- moral;
- condicionamento;
- fadiga;
- foco;
- idade;
- histórico recente;
- lesão;
- personalidade;
- plano de desenvolvimento.

Não RNG puro.

==================================================
EFEITOS DO TREINO
==================================================

Treino pode afetar:

- progresso de atributos;
- confiança do treinador;
- forma;
- fadiga;
- moral em pequena escala.

Não subir atributo inteiro toda semana.

Criar progresso acumulado.

Exemplo conceitual:

Finalização:
68
progresso:
72%

Boa semana:
→ 78%

Quando atingir limiar:
→ Finalização 69.

Não é obrigatório expor exatamente porcentagem se isso piorar a experiência.

Mas internamente evolução precisa ser gradual.

==================================================
INTENSIDADE
==================================================

Pode criar:

LEVE
NORMAL
INTENSO

Se fizer sentido.

LEVE:
menos desenvolvimento
mais recuperação

NORMAL:
equilibrado

INTENSO:
mais desenvolvimento
mais fadiga
leve aumento de risco físico.

NÃO obrigar o jogador a alterar intensidade toda semana.

Pode permanecer configurada.

==================================================
DESCANSO
==================================================

"Descansar" não pode ser simplesmente a escolha obviamente ruim.

Descanso deve:

- recuperar condicionamento;
- diminuir fadiga;
- ajudar em prevenção/recuperação.

Treino forte com atleta cansado deve ter consequências.

==================================================
JOGAR CONTINUA IMPORTANTE
==================================================

Minutos em campo devem acelerar:

- experiência;
- desenvolvimento;
- reputação;
- confiança;
- capacidade de adaptação.

Mas:

ZERO MINUTOS
≠
ZERO DESENVOLVIMENTO.

==================================================
PARTE 7 — FEEDBACK DO TREINADOR
==================================================

Após partidas em que participou:

gerar feedback curto.

Exemplos:

"Muito boa entrada. Você aumentou sua chance de começar a próxima."

"Cumpriu bem a função tática."

"Criou oportunidades, mas perdeu muitas posses."

"Teve dificuldades defensivas."

Não simplesmente converter nota em frase.

Considerar participação real.

==================================================
QUANDO NÃO JOGAR
==================================================

Ainda mais importante.

Se ficou no banco:

mostrar motivo quando relevante.

Exemplos:

"O treinador manteve Lucas porque ele está em ótima fase."

"Você ainda está recuperando condicionamento."

"Seu desempenho nos treinos desta semana não foi suficiente."

"O treinador optou por experiência para esta partida."

"Você está próximo de ganhar minutos."

Nunca deixar o usuário passar 20 semanas sem entender por que não joga.

==================================================
PARTE 8 — CONTRATOS E DIRETORIA
==================================================

Contratos precisam virar uma conversa real.

O jogador/agente pode solicitar:

- renovação;
- aumento salarial;
- extensão;
- revisão do papel no elenco;
- ajuste de cláusula, se aplicável.

Não precisa disponibilizar tudo simultaneamente caso não faça sentido.

==================================================
DIRETORIA PRECISA RESPONDER
==================================================

NUNCA:

usuário pede algo
→ nada aparece.

Toda solicitação precisa resultar em:

ACEITO

NEGADO

CONTRAPROPOSTA

ADIADO

E uma explicação.

==================================================
EXEMPLOS
==================================================

NEGADO:

"Seu salário pedido é incompatível com jogadores de rotação no clube."

NEGADO:

"Seu contrato ainda possui mais de três anos. A diretoria não vê necessidade de renegociar agora."

ADIADO:

"A diretoria quer reavaliar sua situação no fim da temporada."

CONTRAPROPOSTA:

"Não aceitamos €80 mil por semana, mas oferecemos €58 mil e mais dois anos de contrato."

ACEITO:

"A diretoria concordou com a extensão."

==================================================
LÓGICA DA DIRETORIA
==================================================

Considerar:

- salário atual;
- faixa salarial;
- papel no elenco;
- performance;
- idade;
- reputação;
- valor de mercado;
- contrato restante;
- importância;
- orçamento;
- relacionamento com diretoria;
- risco de perder gratuitamente;
- interesse de outros clubes.

Não usar RNG puro.

==================================================
COOLDOWN
==================================================

Não permitir:

pedir aumento
→ negar
→ pedir novamente
→ negar
→ repetir 50 vezes.

Criar cooldown.

Mostrar:

"Nova conversa possível em aproximadamente X semanas."

==================================================
PARTE 9 — AGENTE MAIS IMPORTANTE
==================================================

O agente já trabalha com mercado.

Expandir de forma coerente.

Além de:

- buscar clubes;
- transferências;
- empréstimos;

o agente pode ajudar em:

- renovação;
- salário;
- papel contratual;
- conversar sobre insatisfação;
- informar situação de mercado.

Não duplicar ações entre agente e diretoria de maneira confusa.

Fluxo:

JOGADOR
→ AGENTE
→ DIRETORIA/CLUBE

==================================================
PARTE 10 — OBJETIVOS PESSOAIS
==================================================

Adicionar objetivos para dar direção à temporada.

Dois tipos:

OBJETIVOS DO CLUBE/TREINADOR

e

OBJETIVO PESSOAL.

==================================================
OBJETIVO DO TREINADOR
==================================================

Exemplos:

- conquistar espaço na rotação;
- atingir determinada participação;
- melhorar aspecto físico;
- manter boas avaliações;
- contribuir com gols;
- melhorar disciplina.

Adaptar por posição.

==================================================
OBJETIVO PESSOAL
==================================================

Usuário escolhe UM foco maior para período/temporada.

Exemplos:

"Virar titular"

"Ganhar mais minutos"

"Evoluir tecnicamente"

"Conseguir empréstimo"

"Buscar transferência"

"Renovar contrato"

Não dar bônus mágico por escolher objetivo.

O objetivo deve:

- orientar interface;
- destacar progresso;
- gerar contexto;
- eventualmente influenciar moral/satisfação.

==================================================
PARTE 11 — CENTRAL DA SEMANA
==================================================

Essa deve ser uma das maiores melhorias de UX.

Quando a semana avança:

não quero simplesmente números mudando.

Criar um resumo contextual.

Exemplo:

SEMANA 14

TREINAMENTO
Muito bom
Confiança do treinador +3

ELENCO
Você subiu para a 2ª opção de MEI.

TÉCNICO
"O jogo de sábado pode ser sua oportunidade."

CONTRATO
A diretoria respondeu ao seu agente.
[Ver resposta]

MERCADO
PSV começou a observar você.

PRÓXIMO JOGO
Palmeiras x Santos
Chance de participação: ALTA

==================================================
IMPLEMENTAÇÃO
==================================================

Não precisa abrir um modal gigante TODA semana.

A Central da Semana pode ser:

- seção na página inicial;
- resumo após avanço;
- cards compactos;
- painel expansível.

Escolha solução UX coerente.

A informação importante precisa estar visível.

==================================================
PRIORIDADE
==================================================

Classificar acontecimentos.

URGENTE:
- proposta;
- decisão;
- contrato;
- promessa vencendo;
- lesão;
- mudança de clube.

IMPORTANTE:
- mudança na hierarquia;
- resposta do treinador;
- evolução de atributo;
- interesse de clube.

INFORMATIVO:
- treino;
- pequenas mudanças.

Não mostrar 20 cards.

==================================================
PARTE 12 — PENDÊNCIAS / AÇÕES RECOMENDADAS
==================================================

Na página inicial mostrar:

"O QUE PRECISA DA SUA ATENÇÃO"

quando necessário.

Exemplos:

"Você possui uma proposta."
[Ver]

"A diretoria respondeu sua solicitação."
[Ver]

"Seu treinador quer conversar."
[Responder]

"Defina seu plano de desenvolvimento."
[Escolher]

Não mostrar seção vazia.

==================================================
PARTE 13 — CARREIRA NA BASE
==================================================

Jogadores de 15 ou 16 anos continuam começando na base.

Quero melhorar essa etapa.

Não tratá-la apenas como:

"profissional, mas Sub-20".

==================================================
BASE DEVE POSSUIR
==================================================

- hierarquia na categoria;
- treinador/coordenador;
- avaliações periódicas;
- possibilidade de treinar com profissionais;
- possibilidade de ser relacionado para profissional;
- progresso rumo à promoção;
- feedback claro.

==================================================
AVALIAÇÃO MENSAL
==================================================

Exemplo:

AVALIAÇÃO DA BASE

Técnica:
Muito boa

Físico:
Em desenvolvimento

Treinos:
Excelente

Postura:
Boa

Situação:

"A comissão considera promover você para treinar com o profissional."

==================================================
TREINAR COM PROFISSIONAL
==================================================

Pode surgir como evento.

Isso não significa promoção imediata.

Pode gerar:

- experiência;
- dificuldade maior;
- visibilidade;
- confiança.

==================================================
PROMOÇÃO
==================================================

Quando promovido:

evento importante.

"VOCÊ FOI PROMOVIDO AO PROFISSIONAL."

Não silencioso.

==================================================
PARTE 14 — IMPRENSA E DECISÕES
==================================================

Adicionar uma quantidade MODERADA de eventos contextuais.

Não transformar em visual novel.

Exemplos:

Após grande jogo:

"Você acha que merece ser titular?"

Respostas:

DIPLOMÁTICA

"Continuo trabalhando e respeito as escolhas do treinador."

CONFIANTE

"Estou pronto quando precisarem de mim."

PROVOCATIVA

"Acredito que já mostrei que posso começar jogando."

==================================================
EFEITOS
==================================================

Podem afetar:

- treinador;
- diretoria;
- torcida/reputação;
- moral;
- personalidade.

Não usar respostas "boa, média, ruim" óbvias.

Cada uma possui tradeoff.

==================================================
EVENTOS POSSÍVEIS
==================================================

Poucos e contextuais:

- elogio do treinador;
- crítica pública;
- conselho de veterano;
- discussão no treino;
- entrevista;
- pressão após sequência ruim;
- destaque após grande jogo;
- oportunidade inesperada;
- chegada de concorrente para posição.

Não gerar evento dramático toda semana.

==================================================
PARTE 15 — CONCORRÊNCIA INTERNA
==================================================

A carreira precisa reagir ao elenco.

Se concorrente:

- joga mal;
- lesiona;
- suspende;
- perde forma;

chance do usuário aumenta.

Se clube contrata jogador melhor na posição:

avisar.

Exemplo:

"NOVO CONCORRENTE"

"O clube contratou Pedro, MEI, para a equipe principal."

"Seu espaço no elenco pode diminuir."

==================================================
TITULARIDADE
==================================================

Escalação precisa considerar:

- qualidade;
- forma;
- treino;
- confiança;
- condicionamento;
- fadiga;
- tática;
- posição;
- promessa do técnico;
- desempenho recente.

Não transformar treino em garantia de titularidade.

Mas treino precisa IMPORTAR.

==================================================
PARTE 16 — CHANCE DE PARTICIPAÇÃO
==================================================

Na página inicial, antes da próxima partida, mostrar estimativa qualitativa:

MUITO BAIXA
BAIXA
MÉDIA
ALTA
MUITO ALTA

Não mostrar percentual exato.

Mostrar motivo.

Exemplo:

Chance: ALTA

"O titular da posição está lesionado e você vem treinando bem."

ou:

Chance: BAIXA

"Você é atualmente a terceira opção e os jogadores à frente estão disponíveis."

==================================================
PARTE 17 — EVOLUÇÃO VISÍVEL
==================================================

Quando atributo realmente subir:

mostrar.

"EVOLUÇÃO"

Finalização
68 → 69

ou:

"Seu trabalho de finalização começou a aparecer."

Não mostrar todo micro progresso interno toda semana.

==================================================
OVERALL
==================================================

Quando overall subir:

evento maior.

"SEU NÍVEL GERAL SUBIU"

69 → 70

Não aumentar overall artificialmente.

Usar cálculo real.

==================================================
PARTE 18 — DNA E DESENVOLVIMENTO DEVEM CONVERSAR
==================================================

A história escolhida no começo precisa aparecer depois.

Exemplo:

Origem:
Futsal.

Plano:
Armador.

Treino técnico pode possuir pequena afinidade.

Outra carreira:

Físico tardio.

Aos 18–20:
possibilidade maior de desenvolvimento físico.

Mas esses efeitos devem ser PEQUENOS.

O fator decisivo continua sendo:

- idade;
- potencial;
- treinamento;
- minutos;
- profissionalismo;
- desempenho;
- contexto.

DNA não pode definir destino inevitável.

==================================================
PARTE 19 — PERSONALIDADE COMO SISTEMA REAL
==================================================

Analise se:

profissionalismo
ambição
lealdade
disciplina
temperamento
adaptabilidade
liderança

realmente estão sendo usados.

Onde fizer sentido, conecte-os.

Exemplos:

profissionalismo:
qualidade média de treino.

ambição:
reação a ser reserva / objetivos.

disciplina:
consistência de treino e eventos.

temperamento:
reação a conflitos/imprensa.

adaptabilidade:
mudança de clube/país.

liderança:
possível influência futura.

Não criar efeitos gigantes.

==================================================
PARTE 20 — SATISFAÇÃO DO JOGADOR
==================================================

Considere criar uma variável derivada ou explícita de satisfação.

Pode levar em conta:

- minutos;
- papel;
- treinador;
- contrato;
- moral;
- objetivos;
- promessa;
- clube.

Ela pode ajudar agente/eventos.

Mas não adicione se for simplesmente uma duplicação inútil de moral.

Primeiro analise arquitetura atual.

==================================================
PARTE 21 — NÃO CRIAR EVENTOS SEM CONSEQUÊNCIA
==================================================

Evite:

"Seu treinador falou com você."

e nada muda.

Toda interação deve possuir pelo menos:

- informação relevante;
- consequência;
- possibilidade de escolha;
ou
- progresso de uma situação.

==================================================
PARTE 22 — UX
==================================================

Preserve a identidade visual atual.

Inspirada em:

EA FC
eFootball
Football Manager

Mas sem copiar interface específica.

Não criar:

dashboard empresarial;
tabelas gigantes em todo lugar;
cards genéricos de SaaS.

==================================================
NAVEGAÇÃO
==================================================

Reavalie a organização.

Não criar 15 novos itens na sidebar.

Agrupar sistemas.

Possível estrutura:

INÍCIO
JOGADOR
CLUBE
COMPETIÇÃO
TREINAMENTO
MERCADO
NOTÍCIAS
HISTÓRICO

Dentro:

JOGADOR
→ desenvolvimento
→ atributos
→ carreira

CLUBE
→ elenco
→ hierarquia
→ técnico
→ contrato

MERCADO
→ visão geral
→ propostas
→ agente
→ histórico

Não precisa seguir exatamente isso.

O objetivo é reduzir informação escondida.

==================================================
PARTE 23 — FEEDBACK DE TODA AÇÃO
==================================================

Regra obrigatória:

AÇÃO DO JOGADOR
→ RESPOSTA VISÍVEL.

Exemplos:

Pedir mais minutos
→ treinador responde.

Pedir aumento
→ diretoria responde.

Buscar oportunidades
→ agente responde.

Mudar plano
→ confirmação.

Pedir empréstimo
→ diretoria responde.

Nenhuma ação importante pode parecer que não fez nada.

==================================================
PARTE 24 — SISTEMA DE MENSAGENS
==================================================

Considere criar uma estrutura central de comunicações.

Exemplo:

ComunicacaoCarreira

tipos:

treinador
agente
diretoria
base
imprensa

Cada mensagem pode possuir:

id
data
remetente
titulo
texto
prioridade
lida
acaoRelacionada?

Se notícias/eventos atuais já atendem bem,
EVOLUA o sistema existente em vez de criar duplicação.

==================================================
PARTE 25 — PERSISTÊNCIA
==================================================

Tudo que afetar continuidade precisa ser salvo.

Incluindo:

- escolhas do DNA;
- perfil de formação;
- modificadores persistentes;
- plano de desenvolvimento;
- prioridades;
- progresso de atributos;
- avaliação recente dos treinos;
- hierarquia relevante se não for derivável;
- conversas com treinador;
- cooldowns;
- promessas;
- pedidos contratuais;
- respostas da diretoria;
- objetivos pessoais;
- evolução de posição;
- dados da base;
- resumo semanal se necessário;
- mensagens/pendências importantes.

Não salvar informação puramente derivável se for barato reconstruir.

==================================================
VERSÃO DO SAVE
==================================================

Se EstadoCarreiraPersistido mudar:

- incrementar versão corretamente;
- criar migração de save;
- manter saves antigos;
- NÃO apagar carreira antiga.

Carreiras antigas recebem valores neutros.

Não aplicar DNA retroativamente.

==================================================
POSTGRESQL
==================================================

Não precisa necessariamente criar novas tabelas.

O estado da carreira pode continuar em career_saves.state JSONB se adequado.

Não normalize o banco inteiro sem necessidade.

Não criar uma tabela para cada subsistema apenas porque existe PostgreSQL.

==================================================
PARTE 26 — RNG E DETERMINISMO
==================================================

Todos os sistemas simulativos devem continuar respeitando seed/estadoAleatorio quando apropriado.

Evitar Math.random().

Isso inclui:

- opções do DNA;
- treino;
- eventos;
- respostas variáveis;
- imprensa;
- progresso probabilístico.

O mesmo save/estado deve produzir comportamento reproduzível quando esperado.

==================================================
PARTE 27 — BALANCEAMENTO
==================================================

Não deixar desenvolvimento rápido demais.

Um jogador não deve:

15 anos OVR 65
→
16 anos OVR 82

apenas treinando.

Criar limites e diminishing returns.

Quanto maior atributo:

mais difícil evoluir.

Quanto mais próximo do potencial:

mais lento.

Idade importa.

Potencial importa internamente.

Profissionalismo importa.

Minutos importam.

Treino importa.

==================================================
REGRESSÃO
==================================================

Não quebrar:

- partidas;
- calendário;
- mercado;
- transferências;
- empréstimos;
- contratos existentes;
- snapshots;
- PostgreSQL;
- autosave;
- ligas externas;
- carreira da base;
- evolução existente que ainda fizer sentido.

==================================================
PARTE 28 — PERFORMANCE
==================================================

Importante porque o jogo já possui muitas ligas.

Não faça:

- recalcular hierarquia de todos os clubes a cada render;
- processar conversas de todos os técnicos;
- rodar DNA depois da carreira iniciar;
- criar loops de todos os NPCs apenas para UI;
- structuredClone múltiplos desnecessários;
- serializar save várias vezes por uma mesma ação.

Hierarquia do usuário só precisa analisar:

- clube atual;
- posições compatíveis.

Central da semana deve usar eventos já gerados na simulação.

==================================================
PARTE 29 — TESTES DO DNA
==================================================

Criar testes no mínimo para:

1. geração determinística com seed;
2. mesma seed gera mesmas opções;
3. posições recebem opções plausíveis;
4. goleiro não recebe opções absurdas de atacante;
5. cada capítulo possui 3 opções;
6. escolha persiste;
7. voltar UI não rerrola;
8. modificadores respeitam limites;
9. overall é recalculado;
10. potencialInterno não é exposto;
11. escolhas alteram personalidade quando previsto;
12. builds possuem tradeoffs;
13. carreira antiga continua funcionando;
14. save round-trip preserva DNA;
15. DNA não inclui jogadores reais;
16. resumo final corresponde às escolhas.

==================================================
PARTE 30 — TESTES DO TREINAMENTO
==================================================

17. reserva evolui mesmo sem minutos;
18. jogar acelera desenvolvimento;
19. treino intenso aumenta fadiga;
20. descanso recupera;
21. jogador lesionado não treina normalmente;
22. profissionalismo influencia treino;
23. progressão respeita potencial;
24. atributo alto evolui mais lentamente;
25. progresso acumulado persiste;
26. reload não perde progresso.

==================================================
PARTE 31 — TESTES DO TREINADOR
==================================================

27. perguntar motivo retorna explicação coerente;
28. melhor concorrente pode justificar banco;
29. lesão do titular aumenta oportunidade;
30. bom treino aumenta confiança;
31. pedir oportunidade não garante titularidade;
32. promessa é persistida;
33. promessa cumprida melhora relação;
34. promessa descumprida é detectada;
35. cooldown impede spam;
36. mudança de posição só aceita posições plausíveis.

==================================================
PARTE 32 — TESTES DE CONTRATO
==================================================

37. solicitação sempre recebe resposta;
38. pedido absurdo é negado com motivo;
39. pedido plausível pode gerar contraproposta;
40. diretoria sem orçamento reage corretamente;
41. papel no elenco influencia negociação;
42. contrato restante influencia;
43. cooldown funciona;
44. nenhuma recusa acontece silenciosamente;
45. save/reload preserva negociação.

==================================================
PARTE 33 — TESTES DA BASE
==================================================

46. jogador de 15/16 continua na base;
47. treinos afetam avaliação;
48. treino com profissional pode ocorrer;
49. promoção depende de critérios;
50. promoção gera evento;
51. promoção persiste após reload.

==================================================
PARTE 34 — TESTES DE UX/ESTADO
==================================================

52. proposta cria pendência no início;
53. resposta do treinador cria pendência;
54. resposta da diretoria aparece;
55. mudança de hierarquia aparece;
56. evolução relevante aparece;
57. semana sem evento não cria lixo visual;
58. chance de participação possui explicação;
59. jogador sem jogar recebe feedback contextual;
60. ações principais não ficam escondidas.

==================================================
PARTE 35 — TESTES DE PERSISTÊNCIA
==================================================

Criar round-trip completo:

EstadoCarreira
→ ação
→ serializar
→ PostgreSQL/repositório mock
→ hidratar
→ validar.

Testar:

61. DNA;
62. treinamento;
63. conversa treinador;
64. promessa;
65. contrato;
66. objetivo;
67. mudança de posição;
68. base;
69. mensagens;
70. resumo semanal.

Nenhum novo sistema pode gerar save inválido.

==================================================
CRITÉRIOS DE ACEITE — EXPERIÊNCIA
==================================================

Quero conseguir criar uma carreira assim:

1. Crio Kauê, 15 anos, MEI.

2. "Sua História" sorteia:

Origem:
Futsal

Destaque:
Visão de jogo

Dificuldade:
Físico tardio

Chegada:
Projeto de longo prazo

3. Vejo perfil final.

4. Inicio na base.

5. Na primeira semana:
vejo meu lugar na hierarquia.

6. Escolho plano:
Armador.

7. Prioridades:
Passe longo + visão.

8. Treino.

9. Recebo:
"Treino muito bom."

10. Fico no banco.

11. O jogo explica por quê.

12. Falo com treinador.

13. Ele diz:
"Você está atrás de X. Continue treinando."

14. Algumas semanas depois:
subo na hierarquia.

15. Recebo primeira oportunidade.

16. Jogo bem.

17. Treinador reage.

18. Diretoria eventualmente oferece/promove contrato.

19. Se eu pedir aumento e negarem:
sei exatamente por quê.

20. Posso falar com agente.

21. Minha temporada possui objetivos.

22. Mesmo semanas sem partida possuem decisões/progresso.

Isso deve parecer uma CARREIRA.

Não apenas um botão de avançar calendário.

==================================================
NÃO FAZER
==================================================

NÃO:

- copiar The Fenomeno;
- usar habilidades de jogadores famosos;
- usar cartas;
- copiar EA FC visualmente;
- adicionar moedas/gacha;
- criar minigames;
- permitir comprar atributos;
- tornar DNA uma escolha de "+10";
- permitir evolução absurda;
- garantir titularidade por conversa;
- garantir contrato por pedido;
- garantir transferência;
- mostrar potencialInterno;
- esconder recusa da diretoria;
- deixar treinador sem explicar decisões;
- fazer jogador reserva parar de evoluir;
- criar 30 eventos toda semana;
- criar menu novo para cada pequena função;
- quebrar saves antigos;
- voltar para localStorage;
- comprometer autosave;
- adicionar dependências grandes sem necessidade.

==================================================
ORDEM DE IMPLEMENTAÇÃO
==================================================

Mesmo sendo uma única fase, implemente internamente em etapas para reduzir regressões:

ETAPA A
Domínio + tipos + schemas + migração de save.

ETAPA B
DNA / Sua História.

ETAPA C
Plano de desenvolvimento e treino.

ETAPA D
Hierarquia + treinador.

ETAPA E
Contratos + diretoria.

ETAPA F
Base.

ETAPA G
Central da Semana / UX.

ETAPA H
Eventos contextuais + imprensa.

ETAPA I
Integração final + balanceamento + testes.

Não avance para a próxima etapa deixando typecheck/testes quebrados.

==================================================
VALIDAÇÃO OBRIGATÓRIA
==================================================

Ao final de CADA grande etapa:

npm run typecheck

e testes relevantes.

Ao final de tudo:

npm run typecheck
npm test
npm run build

Se houver mudanças de migration PostgreSQL:

npm run db:generate

Revisar migration.

No banco de DESENVOLVIMENTO:

npm run db:check
npm run db:migrate

NÃO rodar migration manualmente em produção.

O deploy já deve cuidar disso conforme arquitetura existente.

==================================================
TESTE MANUAL FINAL
==================================================

Forneça roteiro para eu testar manualmente.

Preciso validar pelo menos:

NOVA CARREIRA

- geração de DNA;
- voltar etapas;
- continuar;
- criar jogador;
- reload.

BASE

- treino;
- avaliação;
- hierarquia;
- conversa;
- promoção.

PROFISSIONAL

- banco;
- explicação;
- pedir oportunidade;
- treino;
- titularidade;
- feedback.

CONTRATO

- pedido plausível;
- pedido absurdo;
- resposta;
- contraproposta.

AGENTE

- oportunidades;
- transferência;
- empréstimo.

PERSISTÊNCIA

- atualizar página em cada um desses estados;
- confirmar que nada desaparece.

==================================================
RELATÓRIO FINAL
==================================================

Quando terminar, apresente:

1. arquitetura encontrada antes da alteração;
2. sistemas existentes reutilizados;
3. arquitetura criada para "Sua História";
4. todos os capítulos e opções adicionadas;
5. lógica dos modificadores;
6. balanceamento usado;
7. tratamento do potencial;
8. compatibilidade com saves antigos;
9. novo sistema de treinamento;
10. fórmula/lógica de desenvolvimento;
11. papel de partidas na evolução;
12. hierarquia do elenco;
13. lógica de chance de participação;
14. sistema de conversas com treinador;
15. sistema de promessas;
16. mudança de posição;
17. contratos e respostas da diretoria;
18. cooldowns;
19. agente;
20. objetivos pessoais;
21. melhorias na base;
22. Central da Semana;
23. eventos/imprensa;
24. mudanças de UX;
25. novos campos persistidos;
26. migração de save;
27. migration PostgreSQL, se houver;
28. arquivos criados;
29. arquivos modificados;
30. arquivos removidos;
31. testes adicionados;
32. resultado do typecheck;
33. resultado completo dos testes;
34. resultado do build;
35. resultado db:check;
36. resultado db:migrate;
37. possíveis problemas encontrados;
38. limitações restantes;
39. sugestões para próxima fase, SEM implementá-las.

==================================================
REGRA FINAL
==================================================

A implementação não deve ser avaliada apenas por quantidade de funcionalidades.

Ela estará boa quando o jogador sentir:

"Eu sei por que estou no banco."

"Eu sei o que preciso fazer para melhorar."

"Minhas decisões influenciam minha carreira."

"Meu jogador tem uma identidade própria."

"Quando peço alguma coisa, alguém responde."

"Mesmo sem jogar uma partida, existe algo relevante acontecendo."

"Minha história não é igual em toda nova carreira."

Esse é o objetivo principal desta fase.

Pare depois de implementar, testar e apresentar o relatório.

NÃO faça commit.
NÃO faça push.
NÃO faça deploy.