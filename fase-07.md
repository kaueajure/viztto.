Quero implementar uma nova fase de estabilização completa do projeto Viztto.

Projeto:
https://github.com/kaueajure/viztto.

ATENÇÃO:
- O nome do repositório termina com ".".
- Trabalhe sobre a branch main LOCAL atual.
- Analise o código atual antes de alterar qualquer arquivo.
- O último estado remoto analisado anteriormente estava na Fase 06.
- NÃO faça git push.
- NÃO faça deploy.
- NÃO altere Nginx, PM2 ou infraestrutura da VM.
- NÃO recrie o projeto.
- NÃO substitua PostgreSQL por armazenamento no navegador.
- NÃO volte a usar localStorage, sessionStorage ou IndexedDB para saves.
- NÃO adicione novas grandes mecânicas nesta tarefa.
- O objetivo é ESTABILIZAR, CORRIGIR e tornar o jogo INTUITIVO.

==================================================
FASE 07 — ESTABILIDADE, UX E COERÊNCIA DAS REGRAS
==================================================

Temos três problemas principais:

1. O autosave frequentemente apresenta erro.
2. O jogo possui funções importantes escondidas e pouco intuitivas.
3. Algumas regras implementadas não correspondem de verdade ao que a interface comunica ou ao comportamento esperado.

Quero resolver os três problemas de maneira arquitetural, não apenas esconder mensagens de erro.

==================================================
ANTES DE ALTERAR QUALQUER COISA
==================================================

Primeiro faça uma auditoria do estado atual.

Analise no mínimo:

src/estado/jogo-store.ts
src/componentes/jogo/EstadoPersistencia.tsx
src/componentes/jogo/Hidratacao.tsx
src/componentes/jogo/CentralCarreira.tsx
src/componentes/jogo/InicioCarreira.tsx

src/infraestrutura/persistencia/cliente-carreira.ts
src/infraestrutura/persistencia/api-carreira.ts
src/infraestrutura/persistencia/carreira-persistida.ts
src/infraestrutura/persistencia/catalogo-carreira.ts
src/infraestrutura/persistencia/base-futebol.ts
src/infraestrutura/persistencia/validar-save.ts
src/infraestrutura/persistencia/esquema-mercado.ts

src/infraestrutura/banco/repositorio-carreira.ts
src/infraestrutura/banco/schema.ts

src/componentes/jogo/MercadoAgente.tsx
src/componentes/jogo/PropostasInicio.tsx
src/componentes/jogo/MercadoClube.tsx

src/dominio/mercado.ts
src/dominio/entidades/modelos.ts

src/simulacao/transferencias/mercado.ts
src/simulacao/transferencias/mercado-progressivo.ts
src/simulacao/transferencias/necessidade.ts

src/aplicacao/casos-de-uso/avancar-tempo.ts

testes/autosave.test.ts
testes/api-carreira.test.ts
testes/carreira-persistida.test.ts
testes/fase-06.test.ts
e todos os demais testes relevantes.

Antes de implementar, confirme ou refute cada problema descrito abaixo com base no código real.

Se algum diagnóstico estiver parcialmente incorreto devido a mudanças posteriores no repositório, explique e corrija a causa verdadeira.

==================================================
PARTE 1 — AUTOSAVE PRECISA SER CONFIÁVEL
==================================================

Hoje o jogador frequentemente vê:

"Não foi possível salvar sua carreira no servidor.
Há alterações não salvas. Tente novamente.
Há alterações não salvas. Mantenha esta página aberta."

Isso NÃO é aceitável como comportamento normal.

Quero que salvar seja algo praticamente invisível para o jogador.

PostgreSQL continua sendo a fonte de verdade.

Zustand continua sendo apenas estado runtime/em memória.

==================================================
1.1 — CORRIGIR A MENSAGEM DUPLICADA
==================================================

Atualmente aparentemente:

jogo-store.ts já gera algo como:

"Não foi possível salvar sua carreira no servidor.
Há alterações não salvas. Tente novamente."

e EstadoPersistencia acrescenta novamente:

"Há alterações não salvas. Mantenha esta página aberta."

Corrigir.

A mensagem final deve ser curta, clara e não redundante.

Exemplo de estado temporário:

"Não conseguimos salvar agora. Tentaremos novamente automaticamente."

Somente após várias falhas reais:

"Há alterações ainda não salvas."

Não transformar qualquer falha momentânea de rede em um grande alerta vermelho imediatamente.

==================================================
1.2 — AUTOSAVE NÃO PODE PARAR APÓS UMA FALHA
==================================================

Verifique a lógica atual.

Existe uma suspeita concreta:

após erroPersistencia ser definido,
novas operações deixam alteracoesPendentes = true,
mas aplicar() deixa de chamar drenar() porque erroPersistencia existe.

Se isso estiver correto, é um bug crítico.

Uma falha temporária NÃO pode desativar permanentemente o autosave.

Implementar uma fila de autosave robusta.

Comportamento desejado:

estado muda
→ marcar dirty
→ iniciar save se nenhum estiver ativo
→ se novas mudanças acontecerem durante o PUT:
   manter apenas o estado MAIS NOVO
→ PUT termina
→ salvar novamente se ainda dirty

Nunca fazer dois PUT concorrentes para a mesma carreira.

==================================================
1.3 — RETRY AUTOMÁTICO
==================================================

Adicionar retry automático para erros RETENTÁVEIS:

- timeout;
- conexão interrompida;
- HTTP 500;
- HTTP 502;
- HTTP 503;
- HTTP 504.

Usar backoff razoável, por exemplo:

1s
2s
4s
8s
15s
30s

com limite máximo.

Pode adicionar pequeno jitter.

Não fazer loop agressivo.

Enquanto o retry estiver acontecendo:

estado visual discreto:

"SALVAMENTO PENDENTE"

ou:

"TENTANDO SALVAR NOVAMENTE..."

Se recuperar:

"PROGRESSO SALVO"

sem exigir clique manual.

O botão "Tentar novamente" pode continuar existindo,
mas deve ser fallback, não o fluxo normal.

==================================================
1.4 — ERROS NÃO RETENTÁVEIS
==================================================

Não fazer retry infinito para:

400
401
403
404
409
413
422

Esses casos precisam de tratamento específico.

409:
conflito de revision.

Não sobrescrever silenciosamente.

413:
save grande demais.

Mostrar erro específico.

422:
incompatibilidade.

Preservar banco.

400:
erro de validação é BUG ou payload inválido,
não tratar como simples "internet caiu".

==================================================
1.5 — MELHORAR DIAGNÓSTICO SEM EXPOR SEGREDOS
==================================================

Hoje muitos problemas diferentes acabam na mesma mensagem genérica.

Crie códigos internos claros.

Exemplo conceitual:

NETWORK_ERROR
TIMEOUT
SAVE_INVALID
SAVE_TOO_LARGE
REVISION_CONFLICT
DATABASE_UNAVAILABLE
CATALOG_INCOMPATIBLE

A UI recebe mensagem amigável.

O servidor pode registrar:

- código;
- rota;
- duração;
- tamanho aproximado do payload;
- request/correlation id;
- operação.

NUNCA logar:

- DATABASE_URL;
- token do cookie;
- hash do token;
- state JSON completo;
- dados pessoais completos;
- credenciais.

Se houver erro interno inesperado, logar stack no servidor de maneira sanitizada.

Isso é importante porque hoje é difícil saber por que o autosave falhou.

==================================================
1.6 — BUG DE TERMOS DO HISTÓRICO DE NEGOCIAÇÃO
==================================================

Audite registrarNegociacao().

Existe um possível bug concreto:

HistoricoNegociacao.termos aceita TermosContrato,
mas alguns fluxos aparentemente passam o objeto PropostaTransferencia INTEIRO.

A validação do save é strict.

Isso pode fazer:

serializarCarreira()
→ validarCarreiraPersistida()
→ rejeitar campos extras
→ autosave falhar ANTES do fetch.

Corrigir corretamente.

Nunca simplesmente relaxar todo o schema para aceitar qualquer objeto.

Se histórico deve armazenar apenas os termos relevantes:

normalizar explicitamente:

{
  salario,
  duracaoAnos,
  papelPrometido,
  clausulaRescisao
}

Se bônus, luvas etc. também devem fazer parte do histórico,
expanda TermosContrato conscientemente e atualize todos os tipos/schemas/testes.

Não salve PropostaTransferencia inteira acidentalmente onde deveria existir TermosContrato.

==================================================
1.7 — EMPRÉSTIMO X CONTRATO X PERSISTÊNCIA
==================================================

Existe outra possível incompatibilidade importante.

No empréstimo:

clubeAtualId
= clube onde o jogador está atuando.

Mas:

jogador.contrato.clubeId
= clube proprietário do contrato.

Isso é correto.

Porém a validação/hidratação atual aparentemente exige:

jogador.contrato.clubeId === clubeAtualId

Isso torna um empréstimo válido incompatível com o save.

Corrigir semanticamente.

Regra correta:

SEM empréstimo:

contrato.clubeId === clubeAtualId

COM empréstimo:

mercado.emprestimo.clubeOrigemId === jogador.contrato.clubeId

e:

clubeAtualId === clube onde está emprestado.

Validar também:

- clube de origem existe;
- clube atual existe;
- clube atual != origem durante empréstimo;
- retornoEm é válido.

Não mudar contrato permanentemente para o clube de empréstimo apenas para satisfazer o validador.

==================================================
1.8 — TESTAR TODAS AS AÇÕES DA FASE 06 CONTRA O SAVE
==================================================

Este ponto é obrigatório.

Para CADA operação importante:

EstadoCarreira
→ executar ação
→ serializarCarreira()
→ validarCarreiraPersistida()
→ hidratarCarreira()
→ comparar estado relevante.

Testar:

- bloquear propostas;
- desbloquear;
- solicitar transferência;
- retirar pedido;
- tornar público;
- pedir empréstimo;
- cancelar pedido;
- iniciar empréstimo;
- save durante empréstimo;
- retorno de empréstimo;
- contatar clube;
- buscar oportunidades;
- receber interesse;
- proposta;
- contraproposta;
- rejeitar proposta;
- aceitar proposta;
- acordo futuro;
- save com acordo futuro;
- efetivar acordo futuro;
- renovação;
- aposentadoria.

Nenhuma operação da Fase 06 pode criar um estado que o próprio sistema de persistência rejeite.

==================================================
PARTE 2 — SAVE NÃO PODE SER CARO DEMAIS
==================================================

Hoje aparentemente cada PUT faz:

cliente
→ serializa
→ POST/PUT
→ servidor valida
→ carrega catálogo
→ lê snapshots
→ parseia snapshots
→ hidrata a carreira inteira
→ PostgreSQL

Isso é pesado demais para AUTOSAVE.

Quero otimizar.

==================================================
2.1 — NÃO LER TODOS OS SNAPSHOTS A CADA PUT
==================================================

Os snapshots são arquivos versionados no deploy.

Durante a vida de um processo Next.js eles não mudam.

Portanto é aceitável criar cache server-side em memória para o catálogo estático.

Exemplo:

primeira leitura:
→ carregar e validar snapshots.

seguintes:
→ reutilizar catálogo.

O próximo deploy reinicia aplicação e naturalmente recria cache.

Não usar cache externo desnecessário.

==================================================
2.2 — PUT NÃO PRECISA RECONSTRUIR TODO O RUNTIME SEM NECESSIDADE
==================================================

Analise se é realmente necessário chamar hidratarCarreira() completa em TODO PUT.

Precisamos continuar validando:

- schema;
- IDs;
- integridade;
- relações;
- compatibilidade com catálogo.

Mas não precisamos reconstruir milhares de objetos runtime apenas para atualizar JSONB se uma validação persistida mais barata for suficiente.

Considere separar:

validarCarreiraPersistida()

validarReferenciasCarreiraPersistida(...)

hidratarCarreira()

Conceitualmente:

PUT:
schema persistido
→ validação semântica barata
→ CAS revision
→ PostgreSQL

GET:
PostgreSQL
→ persistido
→ catálogo
→ hidratar runtime
→ cliente

POST:
pode fazer validação/hidratação necessária para confirmar criação.

Não reduza segurança ou integridade apenas por performance.

==================================================
2.3 — MEDIR
==================================================

Adicionar medição local/teste/benchmark simples.

Quero no relatório:

- tamanho médio da fixture de save;
- tempo serializarCarreira;
- tempo validarCarreiraPersistida;
- tempo da validação semântica;
- quantidade de leitura de snapshots por sequência de PUTs.

Criar teste comprovando que múltiplos PUTs NÃO relêem todo catálogo do disco repetidamente.

==================================================
PARTE 3 — CORRIGIR AS REGRAS DO MERCADO
==================================================

Não quero apenas código que passa nos testes.

Quero regras coerentes com o que o jogador entende.

==================================================
3.1 — FREQUÊNCIA DE INTERESSES / PROPOSTAS
==================================================

Existe uma possível falha matemática atual.

pesoFrequenciaPropostas possui algo próximo de:

Janeiro/Julho = 1
Fevereiro = 0.75
Junho/Dezembro = 0.45
outros = 0.18

Mas avancarInteresses aparentemente usa:

limiar = 25 / peso

Meses normais:

25 / 0.18 ~= 139

Se score é limitado a 100:

interesse espontâneo é IMPOSSÍVEL.

Isso contradiz a regra:

"Propostas podem ocorrer o ano inteiro,
mas são raras fora das janelas."

Corrigir.

==================================================
MODELO DESEJADO
==================================================

Primeiro:

CLUBE É COMPATÍVEL?

Depois:

QUAL A INTENSIDADE DO INTERESSE?

Depois:

QUAL A CHANCE DE ELE TOMAR A INICIATIVA ESTA SEMANA?

Não transformar frequência do calendário em score impossível.

Exemplo conceitual:

score esportivo/financeiro
→ determina elegibilidade/qualidade do interesse.

peso do mês
→ multiplica probabilidade de iniciativa.

Assim:

abril:
chance baixa, mas > 0.

janeiro:
chance alta.

julho:
chance alta.

dezembro/junho:
moderada.

Usar o GeradorAleatorio determinístico já existente quando apropriado.

Não usar Math.random() descontrolado.

==================================================
3.2 — NÃO CRIAR 20 INTERESSES DE UMA VEZ
==================================================

Não queremos que na janela todos os clubes compatíveis apareçam simultaneamente.

Aplicar limites plausíveis.

Exemplo:

- poucos novos clubes por semana;
- priorizar maiores scores;
- algum componente probabilístico determinístico;
- interesses já existentes continuam progredindo.

Evitar:

for todos os clubes
→ se score passou
→ todos começam a observar.

==================================================
3.3 — PREFERÊNCIAS DO JOGADOR NÃO CONTROLAM A MENTE DOS CLUBES
==================================================

Hoje aparentemente atendePreferencias() participa também da geração espontânea de interesse.

Isso está errado conceitualmente.

Se eu digo:

"Quero jogar apenas na Europa"

isso significa:

MEU AGENTE
não deve procurar clubes brasileiros.

Não significa:

clubes brasileiros magicamente deixam de se interessar por mim.

Separar:

DECISÃO DO CLUBE

de

PREFERÊNCIAS DO JOGADOR/AGENTE.

Preferências devem afetar principalmente:

- busca ativa do agente;
- priorização de oportunidades apresentadas;
- talvez filtragem de sugestões;

mas NÃO a avaliação esportiva que um clube faz sozinho.

==================================================
3.4 — BLOQUEAR PROPOSTAS
==================================================

Regra desejada:

"Bloquear novas propostas"

significa:

- clubes ainda podem observar;
- clubes ainda podem ter interesse interno;
- mercado mundial continua;
- agente filtra novas ABORDAGENS/PROPOSTAS formais espontâneas.

NÃO significa:

todos os clubes deixam de observar o jogador.

Contato ATIVO deve continuar permitido.

Exemplo:

bloquear propostas = true

Barcelona observa jogador:
SIM.

Barcelona manda oferta espontânea:
NÃO.

Jogador manda agente ligar para Barcelona:
SIM.

Barcelona responde ao contato ativo:
SIM.

==================================================
3.5 — PEDIDO PÚBLICO DE TRANSFERÊNCIA PRECISA TER CONSEQUÊNCIA POSITIVA E NEGATIVA
==================================================

Hoje aparentemente tornar o pedido público:

- diminui relação com diretoria;
- diminui relação com treinador;
- reduz moral;

mas praticamente não aumenta a exposição do jogador.

Isso torna a opção irracional.

Corrigir.

Pedido público pode:

- aumentar visibilidade;
- aumentar chance de clubes compatíveis iniciarem observação;
- sinalizar disponibilidade;
- eventualmente reduzir poder de negociação do vendedor;
- atrair clubes de nível compatível.

Mas:

- prejudica relação com treinador/diretoria;
- pode diminuir moral/ambiente;
- NÃO garante proposta;
- NÃO faz clubes incompatíveis quererem contratar.

Implementar efeito explícito e testável.

==================================================
3.6 — PEDIDO DE TRANSFERÊNCIA RECUSADO
==================================================

Existe possível contradição atual:

diretoria responde:

"Pedido recusado."

Mas o código ainda marca:

pediuSaida = true

e outras funções passam a tratar o jogador como disponível.

Isso precisa desaparecer.

Um simples boolean provavelmente não representa mais a regra adequadamente.

Considere refatorar para um estado explícito.

Exemplo conceitual:

pedidoSaida: {
    status:
      "nenhum"
      | "solicitado"
      | "aceito"
      | "recusado",
    publico: boolean,
    resposta?: string,
    reavaliarEm?: string
}

Não precisa usar exatamente essa estrutura.

Mas o domínio precisa distinguir:

PEDIR PARA SAIR

de

DIRETORIA ACEITAR COLOCAR À VENDA.

Se a diretoria recusar:

- não aplicar desconto automático no preço;
- não tratar jogador como disponível;
- agente ainda pode trabalhar dentro do que for permitido;
- pode existir cooldown/reavaliação.

==================================================
3.7 — PREÇO PEDIDO
==================================================

Audite precoPedido().

Não reduzir preço só porque o usuário clicou "Solicitar transferência".

Redução deve depender de:

- pedido aceito;
- jogador listado;
- contrato curto;
- necessidade financeira;
- pedido público;
- vontade do clube em vender;

entre outros fatores já existentes.

Resposta negativa da diretoria não pode resultar em preço reduzido como se ela quisesse vender.

==================================================
3.8 — EMPRÉSTIMO
==================================================

Aplicar o mesmo princípio.

Distinguir claramente:

- pedido feito;
- pedido aceito;
- disponível para empréstimo;
- proposta recebida;
- empréstimo ativo;
- retorno.

Não mostrar "pedido em análise/recusado" como um estado ambíguo se a decisão já aconteceu.

A UI deve saber exatamente qual é o estado.

==================================================
PARTE 4 — UX / JOGO MAIS INTUITIVO
==================================================

O jogo possui muitos sistemas, mas exige que o jogador saiba onde procurar.

Quero corrigir isso SEM transformar o Viztto em um dashboard SaaS genérico.

O estilo deve continuar inspirado em:

- EA FC;
- eFootball;
- Football Manager;
- jogos de carreira esportiva.

Não criar aparência de painel administrativo.

==================================================
4.1 — INÍCIO DEVE SER A CENTRAL DA CARREIRA
==================================================

Hoje InicioCarreira já mostra:

- próximo jogo;
- jogador;
- classificação;
- notícias;
- objetivos.

Evoluir essa tela para responder imediatamente:

"O que está acontecendo na minha carreira?"

Adicionar uma área contextual como:

ATENÇÃO / PRÓXIMAS AÇÕES

Ela deve aparecer APENAS quando houver algo relevante.

Exemplos:

"Você tem uma proposta do Borussia Dortmund"
[Ver proposta]

"Seu agente recebeu interesse do PSV"
[Ver mercado]

"Janela de transferências abre em 12 dias"

"Contrato termina em 5 meses"
[Ver contrato]

"Diretoria respondeu ao seu pedido de empréstimo"
[Ver agente]

"Você tem uma decisão pendente"
[Responder]

"Transferência para Liverpool acertada"
"Apresentação: 01/07/2028"

"Você está lesionado por mais 18 dias"

Não inundar a tela.

Priorizar por urgência.

==================================================
4.2 — BADGES NA NAVEGAÇÃO
==================================================

Adicionar indicadores discretos.

Exemplos:

Mercado (1)
Notícias (3)

ou pequenos pontos.

Mercado deve sinalizar se houver:

- proposta pendente;
- nova resposta do agente;
- mudança significativa de interesse;
- decisão da diretoria.

Não exigir que o jogador entre em cada página para descobrir novidades.

==================================================
4.3 — MERCADO MAIS SIMPLES
==================================================

Reorganizar MercadoAgente.

Hoje existem:

INTERESSES
PROPOSTAS
MEU AGENTE
HISTÓRICO

Isso pode continuar se fizer sentido,
mas a primeira visão precisa resumir a situação.

Idealmente criar:

MERCADO
├─ Visão geral
├─ Propostas
├─ Meu agente
└─ Histórico

Na visão geral:

- status da janela;
- próxima janela;
- acordo futuro;
- interesses principais;
- propostas pendentes;
- status do pedido de saída;
- status do empréstimo;
- CTA para falar com agente.

Não obrigar navegar por quatro telas para entender o mercado.

==================================================
4.4 — MEU AGENTE
==================================================

O agente precisa parecer uma pessoa/serviço dentro da carreira.

Mostrar claramente:

"Situação atual"

Exemplo:

Seu agente:
Recebendo propostas

Pedido de saída:
Nenhum

Empréstimo:
Não solicitado

Clubes contatados:
2

Próxima janela:
01/07/2028

Depois:

AÇÕES

[ Procurar clube específico ]
[ Buscar oportunidades ]
[ Solicitar transferência ]
[ Solicitar empréstimo ]
[ Bloquear propostas ]

Não esconder as funções principais em <details>.

==================================================
4.5 — DETALHES SOMENTE PARA OPÇÕES SECUNDÁRIAS
==================================================

Hoje algumas funções importantes ficam dentro de <details>.

Revisar.

Não esconder:

- situação do mercado;
- procurar clube;
- pedir transferência;
- pedir empréstimo;
- estado das propostas;
- resposta da diretoria.

Pode esconder/colocar em modal secundário:

- preferências avançadas;
- tornar pedido público;
- aposentadoria;
- configurações menos utilizadas.

Aposentadoria deve ser encontrável, mas continua exigindo confirmação forte.

==================================================
4.6 — EXPLICAR POR QUE AS COISAS ACONTECEM
==================================================

Esse é um princípio central.

Se clube rejeitar:

NÃO mostrar apenas:

"Sem interesse."

Mostrar razão relevante:

"Manchester City não avançou porque já possui três jogadores com nível superior na sua posição."

ou:

"O clube vê potencial, mas acredita que você ainda não teria minutos suficientes."

ou:

"A negociação não cabe na folha salarial atual."

Não revelar números secretos ou potencialInterno.

Mostrar explicações a partir da visão plausível do agente.

==================================================
4.7 — INTERESSE DOS CLUBES
==================================================

Não quero apenas:

INTERESSE 47/100.

Isso é pouco intuitivo e muito "barra de sistema".

Pode manter internamente.

Na UI priorize estágio:

OBSERVANDO
INTERESSE
SONDAGEM
NEGOCIANDO
PROPOSTA

E uma explicação.

Exemplo:

Borussia Dortmund

SONDAGEM

"O clube procura um jovem para a posição e acredita que você poderia fazer parte da rotação."

"Observando há 4 semanas."

Pode manter uma barra discreta se ela realmente ajudar, mas não fazer o jogador interpretar regras internas pelo número sozinho.

==================================================
4.8 — JANELA DE TRANSFERÊNCIA
==================================================

Sempre que relevante mostrar:

JANELA ABERTA

ou:

JANELA FECHADA
Próxima abertura: 01/07/2028

Se houver proposta fora da janela:

"Você pode negociar agora.
A mudança só poderá acontecer em 01/07/2028."

Não obrigar o jogador a conhecer a regra externa.

==================================================
4.9 — CONTRATO
==================================================

Se contrato estiver próximo do fim, isso é informação importante.

Criar avisos contextuais:

< 12 meses
< 6 meses
< 3 meses

Sem spam.

Mostrar possibilidades compatíveis com as regras de pré-contrato já existentes.

==================================================
4.10 — FEEDBACK DAS AÇÕES
==================================================

Toda ação importante precisa responder claramente.

Exemplo:

clicou:
"Buscar oportunidades"

Resultado ruim:
"Seu agente não encontrou clubes com interesse concreto neste momento."

Resultado positivo:
"Seu agente abriu conversa com PSV e Benfica."

Não exigir que o usuário clique em Histórico para descobrir se a ação funcionou.

Mas o Histórico continua registrando os detalhes.

==================================================
PARTE 5 — ESTADO DE PERSISTÊNCIA NA UI
==================================================

O indicador de save deve ser discreto.

Estados sugeridos:

SALVO
SALVANDO...
SALVAMENTO PENDENTE
ERRO AO SALVAR
CONFLITO

Não precisa usar exatamente esses textos.

Comportamento:

normal:
pequeno status no rodapé/topo.

falha transitória:
status discreto + retry automático.

falha persistente:
banner.

conflito:
banner de alta prioridade com escolha segura.

Não exibir alerta enorme por um único timeout de 500ms.

==================================================
PARTE 6 — NÃO CONFUNDIR ERRO DE DOMÍNIO COM ERRO DE PERSISTÊNCIA
==================================================

Exemplo:

Clube rejeitou negociação.

Isso é regra do jogo.

NÃO é erro de persistência.

Exemplo:

contraproposta inválida.

Mostrar erro da ação.

NÃO:

"Não foi possível salvar sua carreira."

Separar claramente:

erro
= operação/domínio/UI

erroPersistencia
= salvar/carregar banco

==================================================
PARTE 7 — TESTES OBRIGATÓRIOS
==================================================

Além dos testes já mencionados, adicionar testes específicos.

AUTOSAVE:

1. três alterações rápidas geram no máximo uma escrita ativa;
2. estado mais recente é salvo depois da primeira escrita;
3. timeout faz retry;
4. 503 faz retry;
5. recuperação limpa erro;
6. novas alterações após falha continuam elegíveis para autosave;
7. retry não cria PUT concorrente;
8. 409 não faz retry destrutivo;
9. 413 não fica tentando infinitamente;
10. mensagem não duplica "alterações não salvas";
11. erro antes do fetch é identificado como validação/serialização;
12. reload com dirty continua avisando.

PERSISTÊNCIA:

13. solicitar transferência round-trip;
14. pedido recusado round-trip;
15. pedido público round-trip;
16. empréstimo ativo round-trip;
17. contrato continua pertencendo ao clube de origem durante empréstimo;
18. retorno round-trip;
19. acordo futuro round-trip;
20. contraproposta round-trip;
21. histórico de negociação não contém shape inválido.

MERCADO:

22. abril permite interesse espontâneo raro;
23. setembro permite interesse espontâneo raro;
24. janeiro possui frequência maior;
25. julho possui frequência maior;
26. frequência fora da janela nunca é matematicamente impossível;
27. preferências do jogador não impedem clube de observá-lo;
28. preferências afetam busca do agente;
29. bloquear propostas NÃO impede observação;
30. bloquear propostas impede abordagem formal espontânea;
31. contato ativo funciona mesmo bloqueado;
32. pedido público aumenta exposição;
33. pedido público não garante proposta;
34. pedido recusado pela diretoria não aplica preço de "jogador à venda";
35. pedido aceito influencia mercado coerentemente.

UX:

Criar testes de componentes quando útil para garantir:

36. proposta pendente gera CTA na página inicial;
37. próxima janela aparece quando necessário;
38. resposta da diretoria fica visível;
39. badge de mercado aparece com pendência;
40. ações principais do agente não estão escondidas em details.

==================================================
PARTE 8 — COMPATIBILIDADE COM SAVES EXISTENTES
==================================================

Muito importante.

Não quebrar carreiras existentes da Fase 05/06.

Se mudar a estrutura de:

mercado
pedidoSaida
pedidoEmprestimo
ou outro estado persistido

implementar migração de save.

Não basta:

.default()

se isso não representar corretamente o estado antigo.

Criar função de migração explícita se necessário.

Preservar:

- partidas;
- jogador;
- clubes;
- transferências;
- propostas;
- estatísticas;
- histórico;
- temporadas;
- contratos.

==================================================
PARTE 9 — PERFORMANCE
==================================================

Essa fase NÃO deve piorar o jogo.

Especial atenção:

- não avaliar todos os clubes múltiplas vezes durante um único render;
- não chamar avaliarAlvo() repetidamente no sort;
- calcular avaliações uma vez por operação e reutilizar;
- não ler snapshots do disco a cada autosave;
- não hidratar milhares de objetos no PUT sem necessidade;
- não adicionar JSON.stringify repetido de saves gigantes;
- não criar requests extras apenas para atualizar indicadores visuais.

Meça antes/depois quando possível.

==================================================
PARTE 10 — PRINCÍPIOS DO VIZTTO
==================================================

Use estes princípios na implementação:

1. SIMULAÇÃO PROFUNDA INTERNAMENTE.

2. INTERFACE SIMPLES EXTERNAMENTE.

O usuário não precisa conhecer todos os scores internos.

3. TODA REGRA IMPORTANTE DEVE SER EXPLICÁVEL.

4. TODA AÇÃO DEVE TER FEEDBACK.

5. INFORMAÇÃO URGENTE DEVE CHEGAR AO JOGADOR.

O jogador não deve precisar caçar a informação.

6. NÃO TRANSFORMAR O JOGO EM DASHBOARD EMPRESARIAL.

7. NÃO EXPOR POTENCIAL INTERNO OU CONHECIMENTO MÁGICO DOS CLUBES.

8. POSTGRESQL É A FONTE DE VERDADE DO SAVE.

9. FALHA TEMPORÁRIA DE REDE NÃO DEVE PARECER PERDA DE CARREIRA.

10. NÃO ESCONDER PROBLEMAS REAIS ATRÁS DE MENSAGENS GENÉRICAS.

==================================================
NÃO FAZER
==================================================

Não resolver com:

- localStorage;
- sessionStorage;
- IndexedDB;
- remover revision;
- desabilitar validação;
- retirar strict dos schemas indiscriminadamente;
- aumentar timeout para vários minutos;
- simplesmente esconder erro;
- salvar apenas a cada 10 minutos;
- fazer PUT concorrente;
- ignorar conflito;
- remover PostgreSQL;
- reduzir o universo de ligas para o save funcionar;
- deixar mercado aleatório sem regras;
- redesenhar todo o projeto do zero.

==================================================
VALIDAÇÃO FINAL
==================================================

Obrigatoriamente executar:

npm run typecheck
npm test
npm run build

Com banco de DESENVOLVIMENTO disponível:

npm run db:check
npm run db:migrate

Se nenhuma migration nova for necessária, informe explicitamente.

NÃO rodar migration manualmente em produção.

NÃO fazer commit.

NÃO fazer push.

NÃO fazer deploy.

==================================================
TESTE MANUAL ESPERADO
==================================================

Documente um roteiro manual final:

1. abrir carreira existente;
2. avançar semana;
3. trocar treinamento rapidamente;
4. entrar no mercado;
5. pedir busca ao agente;
6. bloquear propostas;
7. avançar semanas;
8. desbloquear;
9. solicitar transferência;
10. verificar resposta;
11. salvar;
12. atualizar navegador;
13. confirmar que tudo permaneceu;
14. simular uma falha temporária da API;
15. confirmar retry automático;
16. confirmar recuperação sem perder mudanças;
17. testar empréstimo;
18. atualizar navegador durante empréstimo;
19. confirmar que contrato/clube continuam corretos.

==================================================
RELATÓRIO FINAL
==================================================

Ao terminar, apresente um relatório detalhado contendo:

1. causas encontradas para os erros de autosave;
2. quais eram bugs confirmados;
3. quais suspeitas não se confirmaram;
4. correções aplicadas;
5. nova máquina de estados do autosave;
6. funcionamento do retry;
7. tratamento dos códigos HTTP;
8. correção do histórico de negociação;
9. correção da persistência de empréstimos;
10. otimizações do endpoint PUT;
11. cache de catálogo implementado ou alternativa adotada;
12. medições antes/depois;
13. correções do algoritmo de frequência do mercado;
14. diferença final entre preferência do jogador e interesse do clube;
15. comportamento final de bloquear propostas;
16. comportamento final de pedido público;
17. comportamento final de pedido de transferência recusado/aceito;
18. mudanças de UX;
19. nova estrutura da página inicial;
20. nova estrutura do Mercado/Agente;
21. indicadores/badges adicionados;
22. migração de save, se necessária;
23. arquivos alterados;
24. arquivos novos;
25. arquivos removidos;
26. testes adicionados;
27. resultado completo de npm run typecheck;
28. resultado completo de npm test;
29. resultado completo de npm run build;
30. resultado de db:check;
31. resultado de db:migrate;
32. limitações que ainda permaneceram.

IMPORTANTE:

Não considere a tarefa concluída apenas porque os testes antigos passaram.

O critério de aceite principal é:

- jogar normalmente não gera erros frequentes de autosave;
- falhas temporárias se recuperam sozinhas;
- empréstimos podem ser salvos/recarregados;
- nenhuma ação do mercado produz estado inválido;
- regras da interface correspondem às regras do motor;
- interesses continuam possíveis durante todo o ano;
- o jogador entende por que eventos acontecem;
- informações importantes deixam de ficar escondidas;
- o início da carreira funciona como uma verdadeira central de decisões;
- PostgreSQL continua sendo a fonte de verdade;
- não existe dependência de localStorage para a carreira.

Pare após implementar, testar e apresentar o relatório.

NÃO faça commit.
NÃO faça push.
NÃO faça deploy.