Analise completamente o estado ATUAL do projeto Viztto antes de alterar qualquer arquivo.

Projeto:
https://github.com/kaueajure/viztto.

IMPORTANTE:
- O nome do repositório termina com ".".
- Trabalhe sobre a branch main local atual.
- NÃO faça git push.
- NÃO faça deploy.
- NÃO recrie do zero o sistema de transferências.
- Preserve os sistemas existentes e evolua a arquitetura atual.
- Antes de alterar, analise cuidadosamente:
  - src/simulacao/transferencias/mercado.ts
  - src/simulacao/transferencias/mercado-progressivo.ts
  - src/simulacao/transferencias/necessidade.ts
  - src/dominio/mercado.ts
  - src/dominio/entidades/modelos.ts
  - src/componentes/jogo/MercadoAgente.tsx
  - src/componentes/jogo/PropostasInicio.tsx
  - src/estado/jogo-store.ts
  - testes relacionados a mercado/transferências
  - persistência atual da carreira

==================================================
OBJETIVO
==================================================

Quero tornar o mercado de transferências do Viztto mais realista e transformar o agente do jogador em uma parte central da carreira.

Existem dois grandes objetivos:

1. CORRIGIR O FUNCIONAMENTO DAS JANELAS DE TRANSFERÊNCIA.
2. EXPANDIR O AGENTE PESSOAL DO JOGADOR.

Não quero um mercado arcade no qual aceitar uma proposta muda o jogador de clube imediatamente em qualquer mês.

Também não quero que pedir ao agente para procurar um clube garanta uma transferência.

Clubes precisam tomar decisões próprias com base em lógica esportiva e financeira.

==================================================
1. JANELAS DE TRANSFERÊNCIA
==================================================

Nova regra oficial do jogo:

JANELAS ABERTAS:

- Janeiro
- Fevereiro
- Julho

Fora desses meses:

JANELA FECHADA.

Corrigir resolverJanela() e qualquer regra relacionada.

Hoje existem regras diferentes no projeto.
Substitua-as de forma consistente pela regra acima.

Não deve existir janela em:

- junho;
- agosto;
- qualquer outro mês.

==================================================
DIFERENÇA ENTRE PROPOSTA E TRANSFERÊNCIA
==================================================

Esta distinção é ESSENCIAL.

Um clube pode:

- observar;
- demonstrar interesse;
- sondar;
- conversar com o agente;
- fazer proposta;
- negociar salário;
- negociar duração;
- negociar papel no elenco;
- chegar a um acordo;

EM QUALQUER ÉPOCA DO ANO.

Porém:

O jogador SÓ pode efetivamente mudar de clube durante uma janela aberta.

Ou seja:

JANEIRO / FEVEREIRO / JULHO
→ transferência pode ser efetivada imediatamente.

OUTROS MESES
→ negociação pode existir;
→ proposta pode existir;
→ contrato pode ser negociado;
→ acordo pode ser fechado;
→ mas a transferência fica AGENDADA para a próxima janela.

Exemplo:

15 de abril:
Manchester United faz proposta.

Jogador aceita.

Negociação termina em acordo.

O jogador NÃO troca imediatamente de clube.

O sistema registra algo equivalente a:

status = "acordo_futuro"
dataTransferencia = próxima abertura da janela

O jogador permanece normalmente no clube atual até essa data.

Quando chegar a próxima janela:

→ validar que o acordo ainda é válido;
→ efetivar a transferência;
→ atualizar clube;
→ contrato;
→ elenco;
→ orçamento;
→ histórico;
→ notícias;
→ eventos;
→ demais estados existentes.

Não permitir que aceitar uma proposta em abril teleporte o jogador para outro clube.

==================================================
FREQUÊNCIA DAS PROPOSTAS
==================================================

Propostas espontâneas podem surgir em qualquer mês.

Mas devem ser MUITO mais frequentes próximo ou durante as janelas.

Distribuição conceitual:

Janeiro:
frequência muito alta

Fevereiro:
frequência alta

Julho:
frequência muito alta

Dezembro:
frequência moderada por preparação para janeiro

Junho:
frequência moderada por preparação para julho

Demais meses:
frequência baixa

Não use necessariamente exatamente esses números, mas implemente pesos claros e testáveis.

Fora da janela não significa:

chance = 0.

Significa:

clubes podem planejar antecipadamente.

==================================================
NÃO GERAR PROPOSTA SEM MOTIVO
==================================================

Não quero simplesmente:

Math.random() < chance
→ clube oferece contrato.

Primeiro deve existir uma razão esportiva/financeira plausível.

O projeto já possui lógica de avaliação de alvo e necessidade de elenco.

REUTILIZE E MELHORE ESSA ARQUITETURA.

Um clube deve considerar, entre outros fatores existentes:

- posição do jogador;
- necessidade naquela posição;
- jogadores atuais da posição;
- lesões longas;
- idade média da posição;
- qualidade dos concorrentes;
- overall do jogador;
- potencial percebido;
- idade;
- forma;
- minutos jogados;
- titularidades;
- gols;
- assistências;
- média de notas;
- reputação;
- nível da liga atual;
- força do clube interessado;
- papel possível no elenco;
- orçamento;
- folha salarial;
- salário pedido;
- valor de mercado;
- preço pedido pelo clube atual;
- duração restante do contrato;
- situação contratual;
- histórico recente;
- situação de empréstimo;
- pedido de saída;
- interesse declarado pelo jogador.

Não exponha potencialInterno exato aos clubes como conhecimento mágico.

Clubes devem trabalhar com potencial percebido/observado.

==================================================
EXEMPLO DE DECISÃO REALISTA
==================================================

Jogador:

18 anos
overall 68
potencial percebido alto
reserva
boa temporada
valor €4 milhões

Real Madrid:

elenco muito forte
4 jogadores melhores na posição
sem necessidade

Resultado provável:

"Gostamos do jogador, mas não existe espaço no elenco neste momento."

NÃO:

"Real Madrid oferece contrato porque o jogador pediu ao agente."

Outro exemplo:

PSV:

posição carente
bom histórico desenvolvendo jovens
2 opções abaixo do jogador
orçamento compatível

Resultado:

interesse plausível.

==================================================
2. AGENTE PESSOAL
==================================================

O jogador deve possuir um AGENTE PESSOAL.

Não criar um sistema paralelo ao mercado existente.

Evoluir:

MercadoAgente
mercado-progressivo
relacionamentos.agente
preferências existentes

para formar um sistema coerente.

O agente deve ser acessível pela área atual de mercado/agente.

Quero que a sensação seja:

"Eu converso com o MEU agente."

Não apenas uma tela genérica de transferências.

==================================================
AÇÕES DO AGENTE
==================================================

O jogador deve poder pedir ao agente:

1. PROCURAR UM CLUBE ESPECÍFICO
2. BUSCAR OPORTUNIDADES
3. BLOQUEAR NOVAS PROPOSTAS
4. SOLICITAR TRANSFERÊNCIA
5. SOLICITAR EMPRÉSTIMO
6. SE APOSENTAR

Preserve outras opções atuais que ainda façam sentido.

==================================================
1. PROCURAR UM CLUBE ESPECÍFICO
==================================================

O jogador seleciona:

"Quero jogar no clube X."

O agente entra em contato com esse clube.

IMPORTANTE:

isso NÃO significa que o clube fará proposta.

Fluxo:

Jogador
→ Agente
→ Clube desejado
→ Clube avalia jogador
→ resposta.

Possíveis respostas:

- sem interesse;
- elenco já possui opções suficientes;
- jogador ainda não tem nível;
- jogador é caro demais;
- salário incompatível;
- querem acompanhar;
- interessados como promessa;
- interessados em empréstimo;
- interessados, mas apenas na próxima janela;
- dispostos a negociar;
- proposta formal.

A resposta deve ser baseada na avaliação real do clube.

Não escolher frases aleatoriamente sem relação com o resultado.

==================================================
CONTATO REPETIDO
==================================================

Não permitir spam:

clicar 20 vezes:
"Falar com Real Madrid"

até o RNG aceitar.

Depois de uma rejeição:

→ criar período de cooldown.

Algo como:

6–12 semanas

dependendo do motivo.

Se as circunstâncias mudarem drasticamente:

- jogador evolui;
- clube sofre lesões;
- jogador se destaca;
- contrato entra nos últimos meses;

o interesse pode ser reconsiderado.

Use a arquitetura atual de reabrirEm se ela continuar adequada.

==================================================
2. BUSCAR OPORTUNIDADES
==================================================

O jogador pode dizer:

"Procure clubes para mim."

O agente procura opções compatíveis.

Não mostrar simplesmente os 3 clubes com maior reputação.

Considerar:

- nível atual;
- potencial percebido;
- posição;
- necessidade;
- minutos que receberia;
- orçamento;
- salário;
- reputação;
- país/liga desejados;
- preferências existentes;
- tamanho do salto esportivo;
- chance real de contratação.

O agente pode retornar, por exemplo:

"Consegui abrir conversa com 2 clubes."

ou:

"Não encontrei clubes realmente interessados neste momento."

==================================================
3. BLOQUEAR NOVAS PROPOSTAS
==================================================

Adicionar uma opção:

"Não quero receber propostas."

Isso significa:

- clubes podem continuar observando;
- o mercado mundial continua funcionando;
- mas o agente recusa/filtra novas abordagens espontâneas ao jogador;
- novas propostas formais espontâneas não devem chegar ao usuário.

Guardar no estado da carreira algo como:

mercado.bloquearPropostas

ou nomenclatura melhor.

Deve funcionar como toggle:

ACEITAR PROPOSTAS
BLOQUEAR PROPOSTAS

IMPORTANTE:

Isso NÃO impede que o próprio jogador peça ao agente para procurar um clube.

Se ele disser:

"Não quero receber propostas"

e depois:

"Entre em contato com Barcelona"

o contato ativo continua permitido.

Também não apagar negociações já existentes.

A regra bloqueia NOVAS abordagens espontâneas.

==================================================
4. SOLICITAR TRANSFERÊNCIA
==================================================

O jogador pode falar com o agente:

"Quero sair do clube."

Isso deve criar um pedido de transferência PRIVADO inicialmente.

A diretoria deve reagir.

Possíveis respostas:

- aceita negociar;
- aceita se chegar proposta adequada;
- recusa;
- tenta convencer jogador a ficar;
- exige determinado valor;
- aceita apenas no fim da temporada;
- coloca jogador oficialmente disponível.

A decisão deve considerar:

- importância no elenco;
- idade;
- tempo de contrato;
- valor de mercado;
- papel atual;
- situação financeira do clube;
- relacionamento com diretoria;
- relacionamento com treinador;
- forma;
- quantidade de jogadores na posição;
- possibilidade de reposição.

Não garantir que solicitar transferência significa sair.

==================================================
PEDIDO PÚBLICO
==================================================

O sistema atual aparentemente já possui conceito de pedido privado/público.

Preserve essa ideia se fizer sentido.

Fluxo desejado:

1. conversar em privado com agente;
2. solicitar transferência;
3. posteriormente poder tornar o pedido público.

Pedido público:

- aumenta visibilidade no mercado;
- pode aumentar interessados;
- pode reduzir poder de negociação do clube vendedor;
- pode prejudicar relacionamento com diretoria;
- pode prejudicar relacionamento com treinador;
- pode afetar moral;
- não garante transferência.

Não aplicar penalidades absurdas instantaneamente.

==================================================
5. SOLICITAR EMPRÉSTIMO
==================================================

Nova ação importante:

"Quero ser emprestado."

O agente leva o pedido ao clube atual.

O clube decide.

O pedido deve fazer sentido principalmente para:

- jogador jovem;
- jogador com poucos minutos;
- promessa;
- reserva;
- jogador abaixo do nível do time principal.

Mas o usuário pode solicitar independentemente disso.

A diretoria pode aceitar ou negar.

Exemplos de motivos para negar:

- jogador é titular;
- elenco está curto na posição;
- clube precisa dele;
- janela ainda está distante e querem reavaliar;
- jogador acabou de chegar;
- não existe reposição.

Se o pedido for aceito:

estado semelhante a:

disponivelParaEmprestimo = true

A partir daí clubes podem analisar um empréstimo.

==================================================
CLUBES INTERESSADOS EM EMPRÉSTIMO
==================================================

Um empréstimo também precisa ser analisado pelo clube interessado.

Considerar:

- necessidade;
- nível do jogador;
- espaço no elenco;
- idade;
- potencial;
- salário;
- duração;
- reputação do clube;
- quantidade provável de minutos.

Não mandar um jovem overall 60 para Manchester City simplesmente porque é empréstimo.

==================================================
NEGOCIAÇÃO DE EMPRÉSTIMO
==================================================

Quando apropriado, considerar:

- duração até fim da temporada;
- duração de uma temporada;
- percentual de salário pago;
- papel esperado;
- possibilidade futura de opção de compra APENAS se a arquitetura atual comportar sem criar complexidade excessiva.

Não é obrigatório implementar opção de compra nesta fase se ela exigir reescrever o mercado.

O foco é:

pedido → aprovação → clubes interessados → proposta → aceite → transferência na janela.

==================================================
JANELA E EMPRÉSTIMO
==================================================

A mesma regra deve valer:

Proposta de empréstimo:
pode chegar fora da janela.

Acordo:
pode ser feito fora da janela.

Mudança efetiva para o clube:
somente janeiro, fevereiro ou julho.

==================================================
RETORNO DE EMPRÉSTIMO
==================================================

Se implementar empréstimo completo, precisa existir retorno.

Ao terminar:

- jogador volta ao clube de origem;
- contrato original permanece coerente;
- clube atual muda;
- histórico registra empréstimo;
- eventos/notícias refletem retorno.

Não deixar jogador permanentemente preso no clube de empréstimo.

==================================================
6. APOSENTADORIA
==================================================

Adicionar ao agente:

"Quero me aposentar."

Essa ação precisa de confirmação forte na interface.

Exemplo:

TEM CERTEZA?

A aposentadoria encerra sua carreira profissional.
Você poderá continuar vendo o histórico desta carreira,
mas não poderá voltar a jogar depois da confirmação.

Não disparar aposentadoria com um único clique acidental.

==================================================
EFEITO DA APOSENTADORIA
==================================================

Ao confirmar:

- marcar carreira como encerrada/aposentada;
- registrar data;
- registrar idade;
- registrar clube final;
- gerar evento final;
- impedir avanço de semanas como jogador ativo;
- impedir novas transferências;
- impedir treino;
- impedir novas negociações;
- preservar histórico;
- preservar temporadas;
- preservar estatísticas;
- preservar títulos;
- preservar clubes;
- NÃO deletar o save.

A carreira continua disponível como histórico.

Não apagar o banco.

==================================================
IDADE PARA APOSENTADORIA
==================================================

Não quero impedir artificialmente o jogador de se aposentar.

O jogador pode escolher aposentar quando quiser.

Porém o agente pode alertar quando for muito jovem:

"Você ainda tem muitos anos de carreira pela frente. Tem certeza?"

Mas se o usuário confirmar:

permitir.

==================================================
PROPOSTAS FORA DA JANELA
==================================================

Essa é uma parte crítica.

Precisamos diferenciar claramente estados da negociação.

Exemplo possível:

interesse
observando
sondagem
proposta
negociacao
acordo
acordo_futuro
concluida
rejeitada
cancelada

Não precisa usar exatamente esses nomes se a arquitetura existente já tiver algo melhor.

Mas é obrigatório conseguir representar:

ACORDO FECHADO
≠
TRANSFERÊNCIA EFETIVADA

==================================================
EXEMPLO COMPLETO
==================================================

Data:
18 de abril.

Jogador:
Palmeiras.

Liverpool oferece contrato.

Jogador negocia.

Liverpool aceita contraproposta.

Palmeiras aceita valor.

Resultado:

ACORDO FECHADO.

Mas:

jogador continua no Palmeiras.

UI:

"Transferência acertada para o Liverpool.
Apresentação prevista para 1º de julho."

O jogador continua:

- treinando;
- jogando;
- evoluindo;
- podendo se lesionar;
- disputando partidas pelo Palmeiras;

até a data da transferência.

Quando julho chegar:

efetivar automaticamente.

==================================================
CANCELAMENTO DE ACORDO
==================================================

Não complique desnecessariamente nesta fase.

Depois de contrato e transferência estarem definitivamente acordados pelas partes:

trate como compromisso fechado.

Não deixe o jogador aceitar vários clubes simultaneamente.

Ao fechar acordo futuro:

- cancelar/encerrar negociações incompatíveis;
- impedir segundo acordo definitivo;
- manter observações históricas apenas como histórico.

==================================================
CLUBE ATUAL TAMBÉM PRECISA ACEITAR
==================================================

Para transferência comum com contrato vigente:

não basta:

novo clube quer
+
jogador quer.

O clube atual precisa aceitar o valor.

Fluxo:

CLUBE COMPRADOR
→ interesse
→ proposta ao clube atual
→ clube atual avalia
→ aceita / rejeita / contrapropõe
→ negociação contratual com jogador
→ acordo

A ordem exata pode seguir a arquitetura existente, desde que as três partes façam sentido:

- clube comprador;
- clube vendedor;
- jogador/agente.

==================================================
AVALIAÇÃO DO CLUBE VENDEDOR
==================================================

Considerar:

- valor de mercado;
- preço pedido;
- contrato restante;
- importância do jogador;
- idade;
- pedido de transferência;
- orçamento;
- necessidade de vender;
- profundidade na posição;
- possibilidade de reposição;
- cláusula de rescisão, se existir.

Um clube não deve vender sua estrela por 30% do valor sem motivo.

==================================================
CONTRATOS
==================================================

Preserve e melhore o sistema atual de:

- salário;
- duração;
- papel esperado;
- contraproposta.

O jogador continua podendo negociar.

Clube pode:

- aceitar;
- recusar;
- contrapropor.

Não permitir negociação infinita sem consequência.

Após várias exigências muito acima do aceitável:

o clube pode encerrar a negociação.

==================================================
AGENTE COMO INTERMEDIÁRIO
==================================================

As mensagens do mercado devem parecer provenientes do agente.

Exemplos:

"Conversei com o Borussia Dortmund. Eles gostam do seu perfil, mas já possuem três opções fortes na posição."

"O Milan estaria disposto a acompanhar você até janeiro."

"O Brighton vê você como uma promessa e estaria aberto a negociar."

"Seu clube recusou seu pedido de empréstimo porque considera você parte importante da rotação."

Evite mensagens genéricas como:

"Operação concluída."

==================================================
INTERFACE DO AGENTE
==================================================

Evolua MercadoAgente.tsx.

Não redesenhar o site inteiro.

Preserve a linguagem visual existente.

Criar uma área clara de ações do agente.

Algo conceitualmente semelhante a:

MEU AGENTE

[ Procurar clube específico ]
[ Buscar oportunidades ]
[ Solicitar transferência ]
[ Solicitar empréstimo ]

Propostas:
[ Recebendo propostas ✓ ]

Carreira:
[ Solicitar aposentadoria ]

Também mostrar:

- situação atual;
- pedido de transferência ativo ou não;
- pedido de empréstimo ativo ou não;
- acordo futuro, se existir;
- próxima janela;
- histórico recente das conversas.

==================================================
PRÓXIMA JANELA
==================================================

Criar função centralizada para descobrir:

- janela atual;
- se está aberta;
- próxima abertura;
- data efetiva prevista.

Não espalhar:

if (mes === 1...)
if (mes === 7...)

por vários arquivos.

Centralizar a regra.

Algo como:

obterSituacaoJanela(data)

ou equivalente.

Essa função deve poder responder:

{
  aberta: boolean;
  tipo: ...;
  proximaAbertura: ...;
}

Evite duplicação de regras.

==================================================
DATAS
==================================================

A regra do jogo é por mês:

01/01 até 28/29/02
→ aberta

01/07 até 31/07
→ aberta

Demais datas
→ fechada

Quando um acordo é fechado fora da janela:

calcular próxima abertura.

Exemplos:

10/03/2027
→ 01/07/2027

20/06/2027
→ 01/07/2027

05/08/2027
→ 01/01/2028

15/12/2027
→ 01/01/2028

==================================================
MERCADO MUNDIAL
==================================================

Não alterar apenas transferências do usuário de forma incoerente.

Analise como NPCs são transferidos.

A regra de janela deve ser coerente também para o mercado mundial.

Clubes NPC podem:

- negociar antes;
- planejar;
- chegar a acordos;

mas transferência efetiva deve respeitar janela.

Se adaptar NPCs completamente exigir uma mudança enorme, pelo menos centralize a regra para que o mercado mundial não contradiga a carreira do usuário.

Documente qualquer limitação.

==================================================
CATEGORIA DE BASE
==================================================

Analise cuidadosamente jogadores da base.

Não permitir situações absurdas.

Se o jogador ainda está na categoria de base:

- agente pode existir;
- pode aconselhar;
- pode conversar sobre futuro;

mas transferência profissional precisa respeitar as regras da arquitetura atual e do jogo.

Não simplesmente reutilizar todas as opções profissionais sem validar categoria.

Se o sistema atual bloqueia negociações antes da promoção, preserve isso, a menos que exista motivo claro para ajustar.

==================================================
PERSISTÊNCIA
==================================================

Todos os novos campos devem fazer parte do save.

Exemplos:

- propostasBloqueadas;
- pediuTransferencia;
- pediuEmprestimo;
- disponivelParaEmprestimo;
- acordoFuturo;
- dataTransferencia;
- aposentado;
- dataAposentadoria;
- situação de empréstimo;
- clube de origem;
- retorno previsto;
- histórico do agente.

Adapte à arquitetura real atual.

Não invente campos duplicados se mercado já possui estrutura equivalente.

==================================================
COMPATIBILIDADE DE SAVE
==================================================

Saves existentes não podem quebrar.

Novos campos devem possuir defaults seguros.

Atualize:

- schemas Zod;
- validação;
- hidratação;
- representação persistida;
- versão do save, somente se necessário.

Não destruir saves antigos.

==================================================
REGRAS IMPORTANTES
==================================================

NÃO fazer:

1. proposta = transferência imediata;
2. pedido ao agente = proposta garantida;
3. transferência fora da janela;
4. clube aceitar jogador só pela reputação;
5. Real Madrid querer toda promessa;
6. bloquear propostas impedir busca ativa;
7. pedido de empréstimo ser automaticamente aceito;
8. pedido de transferência ser automaticamente aceito;
9. aposentadoria apagar save;
10. RNG puro decidir tudo sem contexto;
11. recriar mercado do zero;
12. deixar duas regras diferentes de janela espalhadas no projeto.

==================================================
TESTES OBRIGATÓRIOS
==================================================

Criar/atualizar testes para pelo menos:

1. janeiro = janela aberta;
2. fevereiro = janela aberta;
3. julho = janela aberta;
4. junho = fechada;
5. agosto = fechada;
6. novembro = fechada;

7. proposta pode surgir fora da janela;

8. proposta aceita fora da janela NÃO troca clube imediatamente;

9. acordo de abril agenda transferência para julho;

10. acordo de agosto agenda transferência para janeiro seguinte;

11. ao chegar à janela, acordo futuro é efetivado;

12. clube específico pode rejeitar contato do agente;

13. clube específico pode apenas observar;

14. clube específico pode aceitar conversar;

15. clube sem necessidade na posição tende a rejeitar;

16. clube sem orçamento rejeita;

17. clube com necessidade real possui maior interesse;

18. clube com elenco muito superior não contrata promessa incompatível sem motivo;

19. bloquear propostas impede novas propostas espontâneas;

20. bloquear propostas NÃO impede contato ativo pelo agente;

21. desbloquear propostas volta a permitir abordagens;

22. solicitar transferência cria estado correto;

23. solicitar transferência não garante saída;

24. diretoria pode recusar pedido;

25. pedido público gera consequências próprias;

26. solicitar empréstimo pode ser aceito;

27. solicitar empréstimo pode ser recusado;

28. clube interessado em empréstimo também avalia necessidade;

29. empréstimo respeita janela;

30. retorno de empréstimo funciona;

31. acordo definitivo impede dois contratos futuros simultâneos;

32. aposentadoria exige confirmação no fluxo de UI;

33. aposentadoria preserva histórico;

34. aposentado não consegue avançar carreira ativa;

35. aposentado não recebe propostas;

36. saves antigos continuam carregando;

37. os novos estados persistem após reload;

38. contraproposta continua funcionando;

39. testes atuais de mercado continuam passando.

==================================================
PERFORMANCE
==================================================

O Viztto já possui muitas ligas e jogadores.

Não piorar a performance significativamente.

Evite:

- recalcular avaliação de todos os clubes repetidamente durante render;
- ordenar todas as equipes várias vezes para a mesma ação;
- structuredClone desnecessário em loops internos;
- avaliações O(clubes × jogadores × clubes) sem necessidade.

Se uma avaliação é usada várias vezes na mesma operação:

calcule uma vez e reutilize.

Não sacrifique correção por micro-otimização, mas evite regressões claras.

==================================================
NÃO ALTERAR SEM NECESSIDADE
==================================================

Não alterar:

- motor de partidas;
- evolução de atributos;
- geração de calendário;
- sistema de snapshots;
- importação Transfermarkt;
- PostgreSQL estrutural além do necessário para persistir novos campos;
- autenticação;
- deploy;
- Nginx;
- PM2;
- estilos gerais do site.

Foco:

MERCADO + AGENTE + JANELAS + EMPRÉSTIMO + APOSENTADORIA.

==================================================
VALIDAÇÃO FINAL
==================================================

Ao terminar, execute:

npm run typecheck
npm test
npm run build

Se houver testes específicos de banco/persistência relevantes, execute-os também.

Não faça commit.
Não faça push.
Não faça deploy.

==================================================
RELATÓRIO FINAL
==================================================

Ao concluir, informe:

1. como funcionava antes;
2. o que foi alterado;
3. regra final das janelas;
4. como propostas fora da janela funcionam;
5. como acordos futuros funcionam;
6. como o agente avalia clube específico;
7. como clubes decidem contratar;
8. como bloquear propostas funciona;
9. como pedido de transferência funciona;
10. como pedido de empréstimo funciona;
11. como empréstimos são encerrados;
12. como aposentadoria funciona;
13. campos novos adicionados ao save;
14. arquivos alterados;
15. testes criados;
16. resultado de typecheck;
17. resultado dos testes;
18. resultado do build;
19. possíveis limitações restantes.

Não apenas diga que implementou.

Explique as decisões tomadas e qualquer mudança feita sobre a arquitetura atual.