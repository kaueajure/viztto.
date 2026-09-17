Quero implementar uma nova camada de dados no Viztto usando a Sportmonks como fonte de ESTATÍSTICAS E DESEMPENHO dos jogadores, mantendo a API atual do Transfermarkt como fonte principal de identidade, clubes, elencos, contratos, valores de mercado e demais dados já utilizados.

IMPORTANTE:

A Sportmonks NÃO deve substituir a integração atual com Transfermarkt.

A arquitetura desejada é:

TRANSFERMARKT
→ identidade dos jogadores
→ clubes
→ elencos
→ posição
→ idade/data de nascimento
→ valores de mercado
→ contratos
→ fotos e demais dados já existentes

+

SPORTMONKS
→ estatísticas reais dos jogadores
→ minutos
→ partidas
→ gols
→ assistências
→ chutes
→ passes
→ dribles
→ duelos
→ desarmes
→ interceptações
→ estatísticas defensivas
→ estatísticas ofensivas
→ ratings de desempenho
→ xG/xA ou outras métricas quando disponíveis
→ demais dados úteis disponíveis por liga

↓

VIZTTO RATING ENGINE

↓

overall
potencial estimado
atributos individuais

↓

SNAPSHOTS LOCAIS DO VIZTTO

Durante o jogo:

ZERO chamadas ao Transfermarkt.
ZERO chamadas à Sportmonks.

O jogo deve continuar funcionando exclusivamente com os snapshots locais gerados previamente.

==================================================
OBJETIVO PRINCIPAL
==================================================

Quero manter a experiência operacional atual.

Hoje temos um comando semelhante a:

npm run atualizar-dados-futebol

Quero continuar executando UM ÚNICO COMANDO manualmente no meu PC para atualizar toda a base.

Por exemplo:

npm run atualizar-dados-futebol

Internamente esse comando deverá:

1. atualizar/importar os dados do Transfermarkt;
2. buscar os dados necessários da Sportmonks;
3. fazer paginação automaticamente;
4. respeitar rate limits;
5. fazer matching entre jogadores das duas fontes;
6. calcular ratings e atributos do Viztto;
7. validar os dados;
8. gerar os snapshots finais;
9. gerar relatório da atualização;
10. nunca deixar snapshots parcialmente corrompidos caso alguma etapa falhe.

Para mim deve continuar sendo apenas:

npm run atualizar-dados-futebol

Não quero precisar executar manualmente dezenas de comandos.

==================================================
1. PRIMEIRO: ANALISAR A ARQUITETURA ATUAL
==================================================

Antes de alterar qualquer código, analise completamente como funciona hoje:

- integração open source com Transfermarkt;
- scripts de atualização;
- API Python existente;
- atualizar-base;
- snapshots;
- estrutura de jogadores;
- estrutura de clubes;
- LIGAS_SUPORTADAS;
- TEMPORADA_TRANSFERMARKT;
- criação de JogadorMundo;
- geração atual de overall;
- geração atual de potencial;
- atributos existentes no domínio;
- cálculo de força dos clubes;
- persistência de carreira;
- evolução dos jogadores durante uma carreira;
- testes relacionados à base de futebol.

Não crie uma segunda arquitetura paralela.

A Sportmonks deve entrar como enriquecimento da arquitetura existente.

==================================================
2. LIGAS ATUAIS
==================================================

O Viztto atualmente possui:

- Brasileirão Série A
- Brasileirão Série B
- Brasileirão Série C
- Premier League
- Championship
- La Liga
- LaLiga 2
- Serie A italiana
- Serie B italiana
- Bundesliga
- 2. Bundesliga
- Ligue 1
- Ligue 2

Mapeie cada liga do Viztto para a competição/temporada correspondente na Sportmonks.

NÃO espalhe IDs da Sportmonks pelo código.

Criar configuração centralizada, por exemplo conceitualmente:

liga Viztto
→ id Transfermarkt
→ id Sportmonks
→ season Sportmonks
→ nível de cobertura disponível

Não assuma que todas as competições possuem o mesmo nível de dados.

==================================================
3. COBERTURA DIFERENTE ENTRE LIGAS
==================================================

A implementação precisa funcionar mesmo quando a Sportmonks não possuir estatísticas avançadas suficientes.

Exemplo importante:

Brasileirão Série A:
→ dados individuais ricos.

Brasileirão Série C:
→ cobertura individual pode ser limitada.

Portanto o Rating Engine deve possuir níveis de dados.

Algo conceitualmente como:

NÍVEL A
estatísticas avançadas completas

NÍVEL B
estatísticas individuais básicas

NÍVEL C
dados muito limitados

NÍVEL D
sem correspondência Sportmonks

Nunca impedir a atualização inteira porque uma liga ou jogador possui menos dados.

==================================================
4. MATCHING TRANSFERMARKT ↔ SPORTMONKS
==================================================

Este é um ponto crítico.

Transfermarkt continua sendo a identidade canônica do jogador no Viztto.

Sportmonks serve como enriquecimento.

Precisamos relacionar:

Jogador Transfermarkt
↔
Jogador Sportmonks

Não fazer matching apenas pelo nome.

Usar uma combinação segura dos dados disponíveis, como:

- nome normalizado;
- data de nascimento;
- clube;
- posição;
- nacionalidade;
- altura, se disponível;
- outros identificadores confiáveis.

Criar sistema de confiança do matching.

Exemplo conceitual:

exact
high
medium
low
unmatched

Nunca aplicar automaticamente estatísticas de outro jogador em matching duvidoso.

Matching abaixo de um limite seguro deve permanecer unresolved.

Gerar relatório contendo:

- jogadores encontrados;
- matches exatos;
- matches por heurística;
- jogadores não encontrados;
- conflitos;
- jogadores duplicados.

Se for útil, persistir um mapa estável:

Transfermarkt ID
→ Sportmonks ID

para reutilizar em atualizações futuras.

Não dependa novamente de fuzzy matching toda vez para jogadores já confirmados.

==================================================
5. SPORTMONKS CLIENT
==================================================

Criar uma camada específica para comunicação com Sportmonks.

Não espalhar fetch diretamente pelo projeto.

Algo conceitualmente semelhante a:

SportmonksClient

responsável por:

- autenticação;
- paginação;
- retries;
- timeout;
- rate limiting;
- concorrência limitada;
- erros HTTP;
- cache temporário;
- transformação básica.

A implementação deve verificar a documentação atual da Sportmonks antes de assumir endpoints ou campos.

Não hardcodar comportamento baseado apenas em exemplos.

==================================================
6. TOKEN
==================================================

A chave/token da Sportmonks:

- nunca deve ser enviado para o navegador;
- nunca deve entrar nos snapshots;
- nunca deve ser commitado;
- nunca deve aparecer em logs;
- nunca deve ser salvo no código.

Usar variável de ambiente apropriada, por exemplo:

SPORTMONKS_API_TOKEN

ou nome equivalente definido de forma consistente.

O script deve falhar com mensagem clara se a atualização Sportmonks for explicitamente solicitada sem credencial.

==================================================
7. NÃO USAR SPORTMONKS EM PRODUÇÃO
==================================================

CRÍTICO:

Nenhuma página do Viztto deve chamar Sportmonks.

Nenhuma API pública do Viztto deve chamar Sportmonks.

Criar carreira não deve chamar Sportmonks.

Avançar semana não deve chamar Sportmonks.

Transferências não devem chamar Sportmonks.

Tudo deve ser importado previamente.

Fluxo:

PC DO DESENVOLVEDOR

npm run atualizar-dados-futebol

↓

Transfermarkt + Sportmonks

↓

snapshots Viztto

↓

commit dos snapshots

↓

deploy

↓

produção lê arquivos locais

==================================================
8. PAGINAÇÃO E REQUISIÇÕES
==================================================

"Um comando" NÃO significa tentar fazer apenas uma requisição HTTP.

O script pode e deve fazer quantas requisições forem necessárias.

Ele deve:

- seguir paginação automaticamente;
- usar includes adequados quando isso reduzir chamadas;
- evitar uma requisição individual por jogador quando houver endpoint agregado melhor;
- limitar concorrência;
- respeitar limites da API;
- fazer retry de erros transitórios;
- não refazer chamadas desnecessariamente.

Se 250 requisições forem necessárias para atualizar corretamente tudo, tudo bem.

Para o usuário continua sendo um comando.

==================================================
9. CACHE DE IMPORTAÇÃO
==================================================

Considere criar cache temporário/local para evitar baixar novamente dados inalterados durante desenvolvimento.

Exemplo:

.cache/sportmonks/

Esse cache NÃO precisa fazer parte do snapshot final e não deve virar dependência da produção.

Permitir invalidação completa quando necessário.

Nunca permitir cache antigo mascarar mudança de temporada silenciosamente.

==================================================
10. RATING ENGINE DO VIZTTO
==================================================

Não copie diretamente rating de partida para overall.

Exemplo INCORRETO:

rating 7.8
→ overall 78

Não fazer isso.

Criar um Rating Engine próprio do Viztto.

Ele deve considerar:

- posição;
- idade;
- minutos;
- quantidade de partidas;
- rating médio;
- desempenho;
- estatísticas específicas da função;
- força da liga;
- força do clube;
- valor de mercado;
- papel/status;
- qualidade e quantidade dos dados disponíveis.

A fórmula precisa ser:

- determinística;
- testável;
- centralizada;
- documentada;
- balanceada.

Não espalhar números mágicos por vários arquivos.

==================================================
11. ATRIBUTOS POR POSIÇÃO
==================================================

Usar as estatísticas relevantes para cada atributo.

Não aplicar a mesma fórmula a todas as posições.

Exemplos conceituais:

ATACANTE

finalização:
- gols
- xG
- conversão
- chutes
- chutes no alvo
- gols por 90
- volume ofensivo

posicionamento:
- presença ofensiva
- xG
- gols
- ações na área

compostura:
- conversão
- desempenho em situações de finalização
- consistência

PONTA

drible:
- tentativas
- dribles certos
- sucesso em dribles

velocidade:
se não existir dado objetivo de velocidade, NÃO fingir precisão.
Usar estimativa conservadora baseada em perfil/posição/fonte secundária disponível.

MEIO-CAMPISTA

visão:
- passes-chave
- chances criadas
- assistências
- xA
- passes progressivos, se disponíveis

passe curto:
- volume
- precisão
- contexto

passe longo:
- passes longos
- precisão

VOLANTE/ZAGUEIRO

desarme:
- tackles
- tackles ganhos

marcação:
- ações defensivas
- duelos
- pressão/recuperações quando disponível

antecipação:
- interceptações
- recuperações

jogo aéreo:
- duelos aéreos
- percentual vencido

GOLEIRO

reflexos/defesa:
- defesas
- gols sofridos
- save percentage
- post-shot xG, se disponível
- métricas equivalentes disponíveis

saída:
- ações fora do gol / bolas aéreas quando disponíveis

reposição:
- passes/distribuição.

Esses são exemplos.

Primeiro verifique quais estatísticas realmente existem na Sportmonks.

Não invente dados indisponíveis.

==================================================
12. ATRIBUTOS NÃO OBSERVÁVEIS DIRETAMENTE
==================================================

Alguns atributos não possuem estatística real direta.

Exemplos:

- velocidade;
- aceleração;
- força;
- compostura;
- concentração;
- liderança.

Nesses casos:

não gerar falsa precisão.

Criar estimativas usando:

- posição;
- idade;
- perfil estatístico;
- altura/peso quando relevante;
- valor de mercado;
- nível da liga;
- heurísticas conservadoras.

Marcar internamente que são estimados.

==================================================
13. OVERALL
==================================================

O overall deve continuar usando a lógica própria do Viztto baseada nos atributos e pesos da posição.

Fluxo preferencial:

estatísticas
↓
atributos Viztto
↓
calcularOverall()

Não fazer:

Sportmonks rating
↓
overall direto.

Assim o overall continua coerente com o sistema interno do jogo.

==================================================
14. POTENCIAL
==================================================

Sportmonks não fornece "potential" estilo videogame.

Portanto potencial deve continuar sendo estimado pelo Viztto.

Considerar:

- idade;
- overall atual;
- minutos em alto nível;
- valor de mercado;
- evolução recente quando dados históricos existirem;
- nível da competição;
- papel no clube;
- reputação;
- margem de desenvolvimento.

Não permitir:

potencial < overall.

Não expor potencial interno exato ao jogador.

==================================================
15. FALLBACK SEM SPORTMONKS
==================================================

Todo jogador deve receber atributos, mesmo se:

- não existir na Sportmonks;
- matching falhar;
- liga não possuir stats avançados;
- jogador possuir poucos minutos;
- for jovem recém-promovido.

Usar fallback com dados existentes do Transfermarkt e do próprio Viztto.

Considerar:

- idade;
- posição;
- valor de mercado;
- clube;
- força do clube;
- força média/reputação da liga;
- status no elenco;
- minutos/gols/assistências existentes no Transfermarkt quando disponíveis.

Nunca deixar jogador sem overall.

==================================================
16. CONFIANÇA DO RATING
==================================================

Adicionar metadata ao rating.

Exemplo conceitual:

ratingMetadata: {
  source: "sportmonks",
  confidence: "high",
  minutes: 2470,
  season: "...",
  sportmonksPlayerId: ...
}

Outros possíveis:

source:
- sportmonks
- hybrid
- transfermarkt-estimated
- generated

confidence:
- high
- medium
- low

Essa metadata é principalmente técnica.

Não precisa necessariamente ser exibida ao jogador.

==================================================
17. JOGADORES COM POUCOS MINUTOS
==================================================

Não calcular atributos extremos com amostra pequena.

Exemplo:

Jogador:
75 minutos
2 gols

não pode automaticamente virar finalização 95.

Aplicar shrinkage/regressão para médias de referência.

Quanto menor a amostra:

mais peso em:

- média da posição;
- força da liga;
- valor de mercado;
- perfil do jogador.

Quanto maior a amostra:

mais peso nas estatísticas individuais.

==================================================
18. NORMALIZAÇÃO ENTRE LIGAS
==================================================

Os números brutos não são diretamente comparáveis entre:

Premier League
e
Brasileirão Série C.

O Rating Engine precisa considerar força da competição.

Não basta:

5 gols = mesmo peso em qualquer liga.

Usar a reputação/força das ligas já existente ou criar normalização centralizada melhor.

Evitar exagerar diferença entre ligas.

==================================================
19. DISTRIBUIÇÃO DOS RATINGS
==================================================

Não criar inflação de overall.

O universo deve manter distribuição plausível.

Exemplo conceitual:

elite mundial:
85–92+

grandes jogadores:
80–84

bons titulares:
74–79

nível médio:
68–73

divisões inferiores:
faixas progressivamente inferiores

Não fixe exatamente esses números sem analisar os dados atuais.

Use-os apenas como referência.

Compare com as distribuições atuais do Viztto.

Gerar relatório estatístico:

- média overall por liga;
- mediana;
- mínimo;
- máximo;
- percentis;
- média por posição.

Detectar automaticamente anomalias.

==================================================
20. OVERALL DOS CLUBES
==================================================

Não tratar um rating inicial do clube como força eterna.

A força do time deve resultar dos jogadores existentes e da escalação.

Após gerar ratings dos jogadores:

elenco
↓
escalação
↓
força ataque
força meio
força defesa
força goleiro
↓
força geral

Assim, transferências e evolução devem mudar naturalmente a força do clube.

Sportmonks serve para formar os atributos iniciais dos jogadores.

Durante a carreira, o Viztto controla tudo.

==================================================
21. SNAPSHOT
==================================================

Os snapshots finais devem continuar sendo autossuficientes.

Cada jogador deve possuir os dados necessários para iniciar uma carreira sem API externa.

Não salvar milhares de estatísticas Sportmonks desnecessárias se elas só foram usadas para gerar atributos.

Preferir snapshot final enxuto:

identidade
+
dados de mercado relevantes
+
atributos Viztto
+
overall
+
potencial
+
metadata mínima do rating

As estatísticas brutas podem ficar somente no cache/importador se não forem necessárias em runtime.

==================================================
22. ATUALIZAÇÕES FUTURAS NÃO ALTERAM SAVE EXISTENTE
==================================================

CRÍTICO:

Atualizar snapshots não deve alterar jogadores dentro de uma carreira já criada.

Exemplo:

01/09
Pedro = overall inicial 78

criei carreira.

01/10
novo snapshot:
Pedro = 80.

Minha carreira antiga NÃO deve magicamente mudar Pedro para 80.

Snapshots servem para iniciar novos universos.

Depois da criação:

a carreira é controlada exclusivamente pelo motor Viztto.

==================================================
23. TEMPORADAS
==================================================

Não assumir que:

Brasil 2026
=
Europa 2026

possuem a mesma estrutura temporal.

Criar configuração apropriada para mapear:

liga
→ temporada Transfermarkt
→ temporada Sportmonks.

Não usar um único seasonId global.

==================================================
24. ATUALIZAÇÃO ATÔMICA
==================================================

O processo deve ser seguro.

Não sobrescrever snapshots válidos conforme cada liga termina.

Fluxo:

baixar
↓
processar em diretório temporário
↓
validar tudo
↓
somente após sucesso:
substituir snapshots oficiais.

Se ocorrer erro no meio:

snapshots anteriores permanecem intactos.

==================================================
25. RELATÓRIO DO COMANDO
==================================================

Ao final de:

npm run atualizar-dados-futebol

mostrar algo como:

==================================
ATUALIZAÇÃO DE DADOS CONCLUÍDA
==================================

Transfermarkt:
13/13 ligas
260 clubes
7.412 jogadores

Sportmonks:
6.103 jogadores encontrados
5.847 matches confiáveis
256 matches pendentes

Ratings:
5.200 alta confiança
1.400 média
812 baixa

Fallback:
1.565 jogadores

Erros:
0 críticos
23 avisos

Snapshots:
13 atualizados

Tempo:
XXm XXs

Os números são apenas exemplo.

==================================================
26. RELATÓRIO DE MATCHING
==================================================

Gerar arquivo técnico, por exemplo:

relatorios/sportmonks-matching.json

ou equivalente.

Contendo:

- matched;
- ambiguous;
- unmatched;
- duplicated;
- coverage por liga.

Não colocar token ou informações sensíveis nesse relatório.

==================================================
27. IDEMPOTÊNCIA
==================================================

Executar duas vezes o importador sobre os mesmos dados deve produzir essencialmente o mesmo snapshot.

Não usar Math.random() na geração de ratings.

Se alguma heurística precisar de variação:

usar seed determinística.

==================================================
28. ERROS DA SPORTMONKS
==================================================

Se Sportmonks falhar:

não destruir os dados existentes.

Diferenciar:

- timeout;
- rate limit;
- autenticação;
- liga não coberta;
- jogador sem stats;
- resposta inválida.

Se possível, permitir fallback para Transfermarkt somente quando a falha for de ausência de cobertura/dados.

Para falha global de autenticação ou API durante uma atualização completa, preferir abortar antes de publicar snapshots parcialmente diferentes.

==================================================
29. PERFORMANCE
==================================================

A importação pode demorar alguns minutos.

Isso é aceitável.

Prioridade:

CORREÇÃO > VELOCIDADE.

Mas:

- não fazer request por jogador se houver endpoint agregado;
- evitar trabalho duplicado;
- limitar concorrência;
- reutilizar cache;
- reutilizar mapping existente.

==================================================
30. NÃO ALTERAR O GAMEPLAY SEM NECESSIDADE
==================================================

Esta implementação deve trocar/melhorar os DADOS INICIAIS.

Não reescrever arbitrariamente:

- mercado;
- transferências;
- evolução;
- treinamento;
- motor de partidas;
- contratos;

exceto quando necessário para receber corretamente os novos atributos.

==================================================
31. COMPATIBILIDADE
==================================================

Preservar saves existentes.

Jogadores de saves antigos devem continuar funcionando.

Se o schema dos snapshots mudar:

criar compatibilidade adequada entre:

snapshot antigo
snapshot novo
save existente.

==================================================
32. TESTES
==================================================

Criar testes para:

1. cliente Sportmonks;
2. paginação;
3. rate limiting;
4. retry;
5. dados inválidos;
6. autenticação ausente;
7. matching exato;
8. matching por data de nascimento;
9. nomes com acentos;
10. nomes iguais;
11. jogadores homônimos;
12. transferência entre clubes;
13. jogador sem Sportmonks;
14. liga sem stats avançados;
15. poucos minutos;
16. grande amostra;
17. atacante;
18. ponta;
19. meia;
20. volante;
21. zagueiro;
22. lateral;
23. goleiro;
24. overall;
25. potencial >= overall;
26. distribuição;
27. normalização por liga;
28. confiança do rating;
29. fallback Transfermarkt;
30. snapshot;
31. atualização atômica;
32. determinismo;
33. save antigo;
34. carreira nova;
35. atualização de snapshot sem modificar save já criado.

==================================================
33. VALIDAÇÃO DE QUALIDADE
==================================================

Depois de gerar uma base completa, analise automaticamente alguns casos.

Selecionar:

- melhores jogadores de cada liga;
- piores;
- jovens;
- veteranos;
- goleiros;
- atacantes;
- jogadores muito valorizados;
- jogadores pouco valorizados.

Detectar inconsistências como:

jogador €80M overall 58

ou

reserva Série C overall 91

ou

goleiro com finalização determinando overall.

Falhar ou avisar quando houver outliers absurdos.

==================================================
34. DOCUMENTAÇÃO
==================================================

Documentar:

- como configurar SPORTMONKS_API_TOKEN;
- como executar atualização;
- arquitetura Transfermarkt + Sportmonks;
- onde snapshots são gerados;
- como funciona matching;
- como funciona fallback;
- significado de rating confidence;
- como atualizar mapeamentos de temporada.

Não colocar token real na documentação.

==================================================
35. FLUXO FINAL DESEJADO
==================================================

O resultado final deve ser:

DESENVOLVEDOR

npm run atualizar-dados-futebol

↓

TRANSFERMARKT
identidade / elenco / valores

↓

SPORTMONKS
estatísticas reais

↓

MATCHING

↓

VIZTTO RATING ENGINE

↓

ATRIBUTOS
OVERALL
POTENCIAL

↓

VALIDAÇÃO

↓

SNAPSHOTS LOCAIS

↓

COMMIT / DEPLOY

=============================

JOGADOR ABRE VIZTTO

↓

snapshots locais

↓

cria carreira

↓

ZERO chamadas externas

↓

motor do Viztto controla o universo dali em diante.

==================================================
ORDEM DE IMPLEMENTAÇÃO
==================================================

Implemente em etapas:

A. Auditoria da arquitetura existente.

B. Configuração de ligas/temporadas Sportmonks.

C. SportmonksClient:
- paginação;
- auth;
- retry;
- rate limiting;
- concorrência.

D. Importação de estatísticas.

E. Matching Transfermarkt ↔ Sportmonks.

F. Rating Engine.

G. Fallback.

H. Metadata/confiança.

I. Integração com snapshots existentes.

J. Integração com npm run atualizar-dados-futebol.

K. Atualização atômica.

L. Relatórios.

M. Testes.

N. Validação da base completa.

==================================================
REGRAS DE EXECUÇÃO
==================================================

Antes de implementar:

leia o projeto inteiro relevante para essa integração.

Não crie código paralelo ao sistema atual sem necessidade.

Reutilize:

- tipos existentes;
- estrutura de snapshots;
- scripts;
- validações;
- LIGAS_SUPORTADAS;
- calcularOverall;
- mecanismos de importação já existentes.

Se alguma premissa deste documento não corresponder à API atual da Sportmonks:

NÃO force a implementação.

Consulte a documentação atual e adapte a solução mantendo o objetivo arquitetural.

Não faça commit.
Não faça push.
Não faça deploy.
Não altere infraestrutura de produção.

==================================================
VALIDAÇÃO FINAL
==================================================

Ao terminar execute:

npm run typecheck
npm test
npm run build

E, se as credenciais locais estiverem disponíveis, execute também uma atualização real controlada da base.

Ao final apresente relatório com:

- arquitetura implementada;
- arquivos criados;
- arquivos modificados;
- endpoints Sportmonks utilizados;
- quantidade de requests;
- quantidade de jogadores Transfermarkt;
- matches Sportmonks;
- unmatched;
- cobertura por liga;
- distribuição de overall por liga;
- ratings por nível de confiança;
- fallbacks;
- tempo total da atualização;
- testes executados;
- limitações encontradas;
- pontos que ainda podem ser melhorados.

O objetivo final é melhorar muito a qualidade inicial dos jogadores do Viztto sem criar dependência da Sportmonks durante o jogo.