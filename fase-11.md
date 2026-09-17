Quero alterar estruturalmente o pipeline de dados do projeto Viztto.

OBJETIVO PRINCIPAL:

REMOVER COMPLETAMENTE A SPORTMONKS do projeto.

Manter:

Transfermarkt
→ como fonte canônica de identidade, elenco, clube, posição, idade, valor de mercado etc.

E criar:

um ROBÔ/IMPORTADOR EM PYTHON
→ que procure ratings externos SOMENTE para os jogadores que já foram encontrados pelo Transfermarkt.

A arquitetura final deve ser:

TRANSFERMARKT
↓
define o universo de jogadores
↓
lista canônica dos jogadores Viztto
↓
ROBÔ DE RATINGS
↓
procura esses jogadores em uma ou mais fontes externas permitidas
↓
matching seguro
↓
normalização das diferentes escalas
↓
OVR / atributos / dados complementares externos
↓
Rating Engine Viztto
↓
fallback para quem não foi encontrado
↓
snapshot final
↓
carreira

\==================================================
REGRAS IMPORTANTES
\==================================================

Antes de alterar qualquer coisa:

1\. Leia e audite completamente o estado atual do projeto.
2\. Identifique tudo que depende da Sportmonks.
3\. Identifique quais partes do Rating Engine são independentes dela.
4\. Preserve tudo que puder ser reaproveitado.
5\. Não reconstruir arquitetura desnecessariamente.
6\. Não alterar os snapshots oficiais durante esta implementação.
7\. Não fazer commit.
8\. Não fazer push.
9\. Não fazer deploy.
10\. Não executar scraping real em massa durante a implementação.

IMPORTANTE SOBRE FONTES EXTERNAS:

NÃO implemente scraping de uma fonte que proíba explicitamente automação/scraping.

O robô deve ter arquitetura de providers/adapters.

Somente providers cuja utilização automatizada seja tecnicamente e contratualmente permitida devem ser habilitados.

Se alguma fonte candidata não tiver autorização clara:

\- não implementar scraping automático dela;
\- deixar o adapter preparado/desativado;
\- documentar o motivo.

Não tente contornar:

\- CAPTCHA;
\- Cloudflare;
\- rate limit;
\- autenticação;
\- paywall;
\- bloqueios anti-bot;
\- robots/termos explícitos contra automação.

\==================================================
PARTE 1 — REMOVER SPORTMONKS COMPLETAMENTE
\==================================================

Remover a Sportmonks como dependência de funcionamento do Viztto.

Auditar e remover/refatorar:

\- SPORTMONKS\_API\_TOKEN
\- SPORTMONKS\_API\_URL
\- SPORTMONKS\_LIGAS
\- ClienteSportmonks
\- enriquecerLigaComSportmonks
\- health específico Sportmonks
\- season resolution Sportmonks
\- mappings Transfermarkt → Sportmonks
\- caches Sportmonks
\- relatórios sportmonks-matching
\- testes específicos Sportmonks
\- documentação Sportmonks
\- tipos e enums exclusivos da Sportmonks
\- flags como exigirSportmonks
\- permitirBootstrapDegradado quando só existirem por causa da Sportmonks
\- referências em scripts
\- comentários obsoletos
\- imports mortos
\- envs mortos

NÃO remover automaticamente componentes reaproveitáveis.

Por exemplo:

\- Rating Engine Viztto
\- RatingMetadata genérico
\- matching genérico
\- normalização de atributos
\- health genérico de fontes externas
\- release atômica
\- active.json
\- gate de snapshots completos
\- isolamento snapshot/save
\- atributos persistidos
\- benchmark de save

Esses componentes devem ser reaproveitados e generalizados.

\==================================================
PARTE 2 — GENERALIZAR \`RatingMetadata\`
\==================================================

Hoje RatingMetadata nasceu muito ligado à Sportmonks.

Quero torná-lo agnóstico de provider.

Em vez de campos como:

sportmonksPlayerId
coverageLevel Sportmonks
source = sportmonks

usar uma estrutura genérica.

Exemplo conceitual:

type FonteRating =
&#x20; \| "external"
&#x20; \| "multi-source"
&#x20; \| "transfermarkt-estimated"
&#x20; \| "generated";

interface FonteRatingExterna {
&#x20; provider: string;
&#x20; externalPlayerId?: string;
&#x20; ratingOriginal?: number;
&#x20; ratingNormalizado?: number;
&#x20; confidence?: string;
&#x20; matchedBy?: string[];
&#x20; sourceUpdatedAt?: string;
}

interface RatingMetadata {
&#x20; source:
&#x20;   \| "external"
&#x20;   \| "multi-source"
&#x20;   \| "transfermarkt-estimated"
&#x20;   \| "generated";

&#x20; confidence:
&#x20;   \| "high"
&#x20;   \| "medium"
&#x20;   \| "low";

&#x20; sources?: FonteRatingExterna[];

&#x20; estimatedAttributes?: string[];

&#x20; calibrationVersion?: string;
}

Não precisa usar exatamente esse formato.

Audite o que já existe e crie a menor estrutura que seja:

\- genérica;
\- persistível;
\- compatível com save;
\- extensível;
\- determinística.

Criar migração/compatibilidade para saves existentes caso necessário.

\==================================================
PARTE 3 — TRANSFERMARKT CONTINUA SENDO A FONTE CANÔNICA
\==================================================

O Transfermarkt deve continuar sendo responsável por definir:

\- jogadores existentes;
\- clubes;
\- ligas;
\- nome;
\- ID Transfermarkt;
\- data de nascimento;
\- idade;
\- posição;
\- nacionalidade;
\- altura;
\- pé;
\- valor de mercado;
\- contrato;
\- foto quando existir;
\- clube atual;
\- demais dados canônicos atualmente usados.

REGRA FUNDAMENTAL:

O robô de ratings NÃO pode adicionar jogadores que não vieram do Transfermarkt.

Exemplo:

Transfermarkt encontrou 7.000 jogadores.

O universo final continua tendo esses mesmos \~7.000 jogadores.

Se a fonte de ratings contiver 30.000 jogadores:

não importar 30.000.

Pesquisar/enriquecer apenas os jogadores canônicos.

\==================================================
PARTE 4 — CRIAR ROBÔ PYTHON
\==================================================

Criar módulo Python profissional dentro do projeto.

Sugestão de estrutura:

ratings\_bot/
&#x20; \_\_init\_\_.py
&#x20; cli.py
&#x20; config.py
&#x20; models.py
&#x20; matcher.py
&#x20; normalizer.py
&#x20; cache.py
&#x20; report.py

&#x20; providers/
&#x20;   \_\_init\_\_.py
&#x20;   base.py
&#x20;   provider\_x.py
&#x20;   provider\_y.py

Pode adaptar nomes à arquitetura atual.

Quero execução semelhante a:

python -m ratings\_bot ...

ou wrapper npm:

npm run atualizar-ratings

\==================================================
ENTRADA DO ROBÔ
\==================================================

O robô NÃO deve varrer indiscriminadamente sites inteiros.

Ele recebe a lista dos jogadores importados pelo Transfermarkt.

Exemplo de input:

.cache/ratings/players-to-enrich.json

Formato conceitual:

{
&#x20; "players": [
&#x20;   {
&#x20;     "id": "...",
&#x20;     "transfermarktId": "...",
&#x20;     "name": "...",
&#x20;     "dateOfBirth": "...",
&#x20;     "club": "...",
&#x20;     "league": "...",
&#x20;     "country": "...",
&#x20;     "position": "...",
&#x20;     "height": 183,
&#x20;     "marketValue": 12000000
&#x20;   }
&#x20; ]
}

Então o robô tenta localizar somente esses jogadores.

\==================================================
PARTE 5 — PROVIDER INTERFACE
\==================================================

Criar interface abstrata de provider.

Exemplo conceitual:

class RatingsProvider(ABC):

&#x20;   name: str

&#x20;   async def find\_player(self, canonical\_player):
&#x20;       ...

&#x20;   async def fetch\_player(self, external\_id):
&#x20;       ...

&#x20;   async def health\_check(self):
&#x20;       ...

Cada provider deve retornar formato comum.

Exemplo:

{
&#x20; "provider": "fonte-x",
&#x20; "externalPlayerId": "...",

&#x20; "name": "...",
&#x20; "dateOfBirth": "...",
&#x20; "club": "...",
&#x20; "position": "...",

&#x20; "overall": 78,
&#x20; "potential": 82,

&#x20; "attributes": {
&#x20;   ...
&#x20; },

&#x20; "raw": {
&#x20;   ...
&#x20; }
}

\`raw\` pode ser opcional ou salvo somente em cache/debug.

\==================================================
PARTE 6 — NÃO PRENDER O SISTEMA A UMA ÚNICA FONTE
\==================================================

A arquitetura precisa aceitar:

Fonte A
\+
Fonte B
\+
futuras fontes C/D.

Exemplo:

Transfermarkt
↓
Jogador X
↓
Provider A encontrou
Provider B encontrou
↓
normalização
↓
rating final

Jogador Y
↓
Provider A não encontrou
Provider B encontrou
↓
rating final

Jogador Z
↓
nenhuma encontrou
↓
Rating Engine Viztto

\==================================================
PARTE 7 — MATCHING
\==================================================

O matching é uma parte crítica.

Nunca fazer:

nome parecido
→ aceitar automaticamente.

Utilizar combinações de:

\- nome normalizado;
\- nome completo;
\- data de nascimento;
\- clube;
\- posição;
\- nacionalidade;
\- altura;
\- external ID se previamente conhecido.

Criar níveis:

EXACT
HIGH
MEDIUM
LOW
UNMATCHED
AMBIGUOUS

Somente:

EXACT
HIGH

podem alimentar automaticamente o rating final.

MEDIUM:

\- reportar;
\- não aplicar automaticamente.

LOW:

\- não aplicar.

AMBIGUOUS:

\- não aplicar.

\==================================================
MATCHING 1:1
\==================================================

Garantir relação 1:1 dentro de um provider.

Não permitir:

Transfermarkt jogador A
→ externalId 123

Transfermarkt jogador B
→ externalId 123

O mesmo jogador externo não pode ser atribuído automaticamente a dois jogadores Transfermarkt.

Criar estrutura:

used\_external\_ids

por provider/importação.

Se ocorrer colisão:

→ marcar ambiguous
→ não aplicar automaticamente.

\==================================================
PARTE 8 — CACHE DE MAPPINGS
\==================================================

Criar mappings persistidos.

Exemplo:

.cache/ratings/mappings/\<provider>.json

Estrutura conceitual:

{
&#x20; "transfermarkt-id": {
&#x20;   "externalId": "...",
&#x20;   "confidence": "exact",
&#x20;   "lastValidatedAt": "...",
&#x20;   "status": "active"
&#x20; }
}

Status:

active
stale
manual

Mapping automático precisa ser revalidado.

Se externalId não existir mais:

→ stale.

Manual pode seguir política separada.

Não salvar segredos.

\==================================================
PARTE 9 — NORMALIZAÇÃO DE OVERALL
\==================================================

Muito importante:

NÃO assumir:

OVR 80 de uma fonte
\=
OVR 80 de outra fonte.

Criar:

RatingNormalizer

por provider.

Exemplo:

providerA.normalize\_overall(80)
providerB.normalize\_overall(80)

↓

escala Viztto.

Inicialmente pode utilizar uma curva simples/configurável.

Mas deixar arquitetura preparada para calibração estatística.

Exemplo:

config/ratings-calibration.json

{
&#x20; "providerA": {
&#x20;   "version": 1,
&#x20;   "method": "piecewise",
&#x20;   ...
&#x20; }
}

\==================================================
PARTE 10 — CALIBRAÇÃO ENTRE FONTES
\==================================================

Criar ferramenta offline:

npm run calibrar-ratings

ou:

python -m ratings\_bot.calibrate

Ela deve:

1\. pegar jogadores presentes em múltiplas fontes;
2\. comparar distribuições;
3\. calcular:
&#x20;  \- média;
&#x20;  \- mediana;
&#x20;  \- desvio;
&#x20;  \- diferença por faixa;
4\. gerar relatório;
5\. opcionalmente gerar configuração de normalização.

NÃO precisa usar machine learning.

Uma regressão simples ou piecewise já é suficiente inicialmente.

\==================================================
PARTE 11 — RESOLUÇÃO DO RATING FINAL
\==================================================

Criar um \`RatingResolver\`.

Exemplo de prioridade:

CASO A:

2+ fontes externas concordam
→ confiança alta
→ combinar ratings normalizados.

CASO B:

1 fonte externa confiável
→ usa rating normalizado
→ confiança alta/média.

CASO C:

fontes externas divergem muito
→ combinar com Rating Engine ou rejeitar consenso
→ confiança média.

CASO D:

nenhuma fonte
→ Rating Engine Viztto.

CASO E:

matching duvidoso
→ ignorar fonte
→ Rating Engine.

\==================================================
PARTE 12 — NÃO DESCARTAR O RATING ENGINE
\==================================================

O Rating Engine atual deve ser preservado.

Mas deve ser reposicionado.

Hoje ele tenta produzir OVR baseado em:

\- valor;
\- idade;
\- liga;
\- clube;
\- posição;
\- stats Sportmonks.

Remover dependência de stats Sportmonks.

Novo papel:

1\. fallback universal;
2\. calibrador;
3\. sanity-check dos ratings externos.

Entrada possível:

Transfermarkt:
\- idade;
\- posição;
\- valor mercado;
\- reputação liga;
\- reputação clube;
\- força liga;
\- contexto elenco.

Saída:

\- OVR estimado;
\- potencial;
\- atributos estimados.

\==================================================
PARTE 13 — USAR FONTE EXTERNA PARA CALIBRAR O RATING ENGINE
\==================================================

Essa é uma parte importante.

Quando houver milhares de jogadores com:

dados Transfermarkt
\+
OVR externo confiável

usar esses dados para analisar o erro do Rating Engine.

Exemplo:

TM:
idade 24
valor €10M
Premier League
titular

Fonte:
OVR 75

Engine:
OVR 70

↓

erro -5.

Gerar relatório por:

\- liga;
\- divisão;
\- idade;
\- posição;
\- faixa de valor;
\- clube/força.

Objetivo:

melhorar o fallback para jogadores que não têm rating externo.

Não precisa criar ML complexo.

Primeiro criar ferramenta estatística e relatório.

\==================================================
PARTE 14 — ATRIBUTOS
\==================================================

Quando uma fonte tiver atributos detalhados:

normalizá-los para:

Atributos Viztto.

Criar mapping explícito por provider.

Exemplo:

external:
pace
finishing
passing
dribbling

↓

Viztto:
velocidade
aceleracao
finalizacao
passeCurto
etc.

Não inventar conversões obscuras.

Campos sem equivalente:

→ Rating Engine estima.

Guardar em metadata:

estimatedAttributes

para sabermos quais foram estimados.

\==================================================
PARTE 15 — POTENCIAL
\==================================================

Não confiar cegamente no potencial de jogos externos.

Criar separação:

externalPotential

vs

vizttoPotential.

Viztto deve combinar:

\- potencial externo, se houver;
\- idade;
\- OVR;
\- valor de mercado;
\- contexto do clube;
\- minutos/posição quando disponíveis;
\- Rating Engine.

Manter potencial real escondido do usuário.

\==================================================
PARTE 16 — PIPELINE FINAL
\==================================================

O comando final deve funcionar assim:

npm run atualizar-dados-futebol

↓

1\. Transfermarkt importa todas as ligas.
2\. Valida clubes.
3\. Gera canonical players file.
4\. Chama ratings bot.
5\. Ratings bot consulta providers permitidos.
6\. Matching.
7\. Cache.
8\. Normalização.
9\. RatingResolver.
10\. Rating Engine fallback.
11\. Snapshot final.
12\. Validação.
13\. Release.
14\. active.json.

\==================================================
PARTE 17 — EXECUÇÃO SEPARADA DO ROBÔ
\==================================================

Também quero poder executar somente o robô.

Exemplo:

npm run atualizar-ratings

e opções equivalentes:

\--league brasileirao
\--provider x
\--refresh
\--dry-run

Não precisa usar exatamente essa CLI, mas deve haver execução isolada.

\==================================================
DRY-RUN
\==================================================

Criar:

\--dry-run

que:

\- consulta/cacheia;
\- faz matching;
\- gera relatório;
\- NÃO modifica snapshots oficiais;
\- NÃO publica release.

\==================================================
PARTE 18 — RATE LIMIT
\==================================================

Todo provider deve respeitar limites.

Criar:

\- concurrency configurável;
\- delay;
\- retry exponencial;
\- timeout;
\- cache;
\- 429 handling;
\- 5xx retry controlado.

Nunca bombardear o provider.

Default conservador.

\==================================================
PARTE 19 — USER AGENT
\==================================================

Quando aplicável/legalmente permitido:

usar User-Agent identificável.

Não fingir ser navegador humano com intenção de contornar proteção.

\==================================================
PARTE 20 — CACHE
\==================================================

Criar cache:

.cache/ratings/\<provider>/

Exemplo:

search/
players/
mappings/

TTL configurável.

Evitar refazer centenas/milhares de requests sem necessidade.

\==================================================
PARTE 21 — RELATÓRIO
\==================================================

Gerar:

relatorios/ratings-import.json

Formato:

{
&#x20; "generatedAt": "...",

&#x20; "providers": {
&#x20;   "providerA": {
&#x20;     "requests": 0,
&#x20;     "cacheHits": 0,
&#x20;     "errors": 0
&#x20;   }
&#x20; },

&#x20; "players": {
&#x20;   "totalTransfermarkt": 7000,
&#x20;   "matchedExternal": 5000,
&#x20;   "multiSource": 3000,
&#x20;   "fallbackEngine": 2000,
&#x20;   "ambiguous": 30,
&#x20;   "unmatched": 1970
&#x20; },

&#x20; "byLeague": {
&#x20;   ...
&#x20; }
}

Também reportar:

\- exact
\- high
\- medium
\- low
\- ambiguous
\- unmatched
\- collision
\- stale mappings
\- fallback
\- providers usados

\==================================================
PARTE 22 — COVERAGE REPORT
\==================================================

Mostrar no terminal:

══════════════════════════════
VIZTTO — RATINGS
══════════════════════════════

Transfermarkt:
7.124 jogadores

Provider A:
5.020 encontrados

Provider B:
3.811 encontrados

Com pelo menos 1 rating externo:
5.890

Somente Rating Engine:
1.234

Matching:
Exact: ...
High: ...
Medium: ...
Ambiguous: ...

Cobertura externa:
82.7%

\==================================================
PARTE 23 — NÃO FAZER REQUEST EM TEMPO REAL NO JOGO
\==================================================

Nenhum request a provider externo pode ocorrer:

\- ao criar carreira;
\- ao avançar semana;
\- ao abrir jogador;
\- durante partida;
\- em produção runtime.

Tudo deve ser snapshot offline.

\==================================================
PARTE 24 — CARREIRAS ANTIGAS
\==================================================

Preservar isolamento já implementado.

Snapshot A
↓
cria carreira A

atualização futura
↓
snapshot B

carreira A continua com:

\- OVR A;
\- potencial A;
\- atributos A;
\- metadata A.

Nova carreira usa B.

\==================================================
PARTE 25 — RELEASES
\==================================================

Preservar arquitetura atual:

active.json
\+
releases/\<release-id>

Não remover atomicidade.

Não misturar release e legado.

Não permitir publicação parcial oficial.

\==================================================
PARTE 26 — PROVIDER DE EXEMPLO
\==================================================

Quero que pelo menos UM provider real possa ser implementado SOMENTE se:

1\. a fonte permitir automação;
2\. a implementação estiver de acordo com os termos;
3\. não exigir bypass anti-bot.

Se nenhuma fonte candidata tiver permissão clara:

implementar:

MockRatingsProvider

e toda a arquitetura completa.

Documentar:

"Provider real pendente de fonte autorizada."

NÃO escolher ilegalmente uma fonte só para cumprir a tarefa.

\==================================================
PARTE 27 — FONTES CANDIDATAS
\==================================================

Investigar candidatos como:

\- APIs públicas de ratings;
\- dumps/datasets licenciados;
\- fontes abertas;
\- APIs oficiais;
\- provedores que explicitamente permitem automação.

SoFIFA/eFootball/PES podem ser avaliados, mas NÃO assumir que podem ser raspados.

Verificar termos antes.

Não depender de endpoints privados descobertos por engenharia reversa.

\==================================================
PARTE 28 — PYTHON
\==================================================

Seguir padrões profissionais:

\- Python 3.11+;
\- typing;
\- dataclasses ou Pydantic se necessário;
\- async HTTP se houver ganho;
\- httpx preferencialmente;
\- testes;
\- separação provider/domain/infrastructure;
\- sem secrets em logs.

Adicionar requirements/pyproject conforme a arquitetura atual do projeto.

Evitar dependências grandes sem necessidade.

\==================================================
PARTE 29 — INTEGRAÇÃO NODE ↔ PYTHON
\==================================================

Criar contrato simples.

Preferência:

JSON files.

Exemplo:

Node:
canonical-players.json

↓

Python:
ratings-results.json

↓

Node:
merge.

Evitar:

Node chamar uma função Python jogador por jogador.

Um processo Python por lote.

\==================================================
PARTE 30 — FALHA DO ROBÔ
\==================================================

Se o ratings bot falhar completamente:

por padrão:

NÃO destruir snapshot anterior.

Definir política:

primeira geração:
→ pode usar Rating Engine puro SOMENTE se explicitamente permitido.

snapshot anterior já enriquecido:
→ queda severa de cobertura deve bloquear publicação.

Reaproveitar o health/gate genérico que já existe, renomeando o que era Sportmonks.

\==================================================
PARTE 31 — HEALTH GENÉRICO
\==================================================

Transformar:

saude-enriquecimento Sportmonks

em:

saude-ratings

Métricas:

\- playersTotal
\- providerCandidates
\- matched
\- exact
\- high
\- ambiguous
\- externalRatings
\- fallbackEngine
\- requestFailures
\- coverage
\- previousCoverage

Bloquear regressões severas.

\==================================================
PARTE 32 — TESTES
\==================================================

Criar testes para:

1\. Sportmonks não existe mais no pipeline.
2\. Nenhum env Sportmonks necessário.
3\. Transfermarkt continua sendo a fonte do universo.
4\. Provider não pode adicionar jogador estranho.
5\. EXACT aplica rating.
6\. HIGH aplica rating.
7\. MEDIUM não aplica automaticamente.
8\. ambiguous não aplica.
9\. external ID não pode ser usado por dois jogadores.
10\. mapping stale é revalidado.
11\. duas fontes podem enriquecer mesmo jogador.
12\. rating de fontes diferentes é normalizado.
13\. ausência total externa usa Rating Engine.
14\. atributos ausentes são estimados.
15\. metadata registra fonte.
16\. metadata round-trip no save.
17\. snapshot A → carreira A permanece A após snapshot B.
18\. dry-run não publica.
19\. provider failure não sobrescreve snapshot bom.
20\. regressão severa de cobertura bloqueia.
21\. cache reduz requests.
22\. rate limiting funciona.
23\. JSON Python → Node é validado.
24\. JSON inválido é rejeitado.
25\. release continua atômica.
26\. lote parcial não publica oficialmente.

\==================================================
PARTE 33 — REMOVER TESTES SPORTMONKS SEM PERDER COBERTURA
\==================================================

Não simplesmente apagar testes.

Para cada teste Sportmonks existente:

classificar:

A)
específico da Sportmonks
→ remover.

B)
conceito reutilizável:
\- health;
\- matching;
\- cache;
\- retries;
\- release;
\- metadata;
→ migrar para infraestrutura genérica.

\==================================================
PARTE 34 — DOCUMENTAÇÃO
\==================================================

Criar:

docs/ratings-pipeline.md

Explicar:

Transfermarkt
↓
canonical players
↓
ratings bot
↓
providers
↓
matching
↓
normalização
↓
resolver
↓
fallback
↓
snapshot.

Também documentar:

\- como adicionar provider;
\- quais fontes estão habilitadas;
\- quais estão desabilitadas;
\- motivo;
\- cache;
\- dry-run;
\- atualização oficial;
\- política de matching;
\- política de regressão.

\==================================================
PARTE 35 — COMANDOS DESEJADOS
\==================================================

Ao final quero algo conceitualmente parecido com:

npm run atualizar-dados-futebol

npm run atualizar-ratings

npm run ratings:dry-run

npm run ratings:report

Não precisa usar exatamente esses nomes se houver alternativa mais coerente.

\==================================================
PARTE 36 — LIMPEZA SPORTMONKS
\==================================================

Ao terminar, pesquisar no repositório inteiro:

sportmonks
SPORTMONKS

O resultado deve conter SOMENTE:

\- migration docs antigas caso deliberadamente preservadas;
\- ou zero ocorrências.

Não devem restar dependências runtime.

\==================================================
PARTE 37 — NÃO ALTERAR SNAPSHOTS OFICIAIS
\==================================================

Durante esta fase:

NÃO rodar importação oficial.

Não criar release oficial.

Não substituir:

src/dados/futebol/active.json
src/dados/futebol/releases/\*
src/dados/futebol/\*.json

Usar somente:

tmpdir
fixtures
mocks
.cache de teste.

\==================================================
VALIDAÇÃO FINAL
\==================================================

Ao finalizar executar:

npm run typecheck

npm test

npm run build

E os testes Python, por exemplo:

pytest

ou o comando correspondente implementado.

Se criar formatter/linter Python, também executar.

\==================================================
RELATÓRIO FINAL
\==================================================

Entregar:

1\. problemas encontrados;
2\. componentes Sportmonks removidos;
3\. arquivos removidos;
4\. arquivos criados;
5\. arquivos modificados;
6\. arquitetura final do ratings bot;
7\. contrato Node ↔ Python;
8\. providers disponíveis;
9\. providers desabilitados e motivo;
10\. matching final;
11\. prevenção de duplicidade de external IDs;
12\. sistema de cache;
13\. rate limiter;
14\. normalização;
15\. estratégia multi-source;
16\. fallback Rating Engine;
17\. health/gate final;
18\. RatingMetadata final;
19\. compatibilidade com saves antigos;
20\. testes adicionados;
21\. resultado dos testes Python;
22\. resultado npm run typecheck;
23\. resultado npm test;
24\. resultado npm run build;
25\. riscos restantes;
26\. quais fontes reais ainda precisam de autorização;
27\. próximo passo recomendado para teste real.

NÃO faça commit.
NÃO faça push.
NÃO faça deploy.
NÃO altere snapshots oficiais.

Comece auditando o commit atual antes de modificar qualquer coisa.