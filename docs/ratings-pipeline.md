# Pipeline de ratings

O Transfermarkt é a única fonte de identidade. O robô Python apenas acrescenta
ratings aos jogadores que já vieram do Transfermarkt: nunca cria, remove ou
renomeia jogador, clube ou liga.

```text
Transfermarkt (12 ligas)
  → universo canônico (players-to-enrich.json)
  → preflight (providers, autorização, calibração)
  → ratings bot (providers autorizados)
  → matching seguro + 1:1 por provider
  → normalização por provider (config/ratings-calibration.json)
  → RatingResolver (multi-source)
  → Rating Engine (fallback universal)
  → staging → gates → release atômica → active.json
```

## Contrato Node ↔ Python

Um único processo Python por lote, sempre por arquivo JSON. Node escreve
`players-to-enrich.json` (`version`, `batchId`, `players`) e lê
`ratings-results-<batchId>.json`. `validarResultadoBot` rejeita lote de outro
`batchId`, jogador estranho, duplicado, provider não declarado, diagnóstico
incompatível e colisão de external ID. JSON inválido nunca chega ao snapshot.

O bot não conhece snapshots: `--output`, `--report` e `--cache-dir` são
recusados se apontarem para `src/dados/futebol`. Somente o atualizador publica.

`providers[<nome>]` traz os contadores do **lote inteiro** (requests, cache
hits, erros, mappings stale, candidatos) mais `status`
(`healthy`/`degraded`/`failed`). `diagnostics[<provider>][<jogadorId>]` traz o
diagnóstico **por jogador** (`confidence`, `collision`, `matchedBy`,
`candidateCount`, `error`), e é a partir dele que o Node agrega as métricas de
cada liga. Um erro na Premier League nunca aparece como erro do Brasileirão.

## Preflight

`preflightRatings` roda antes de qualquer request ao Transfermarkt e aborta um
lote caro por erro estático de configuração. Ele valida nome e duplicidade dos
providers, executa `python -m ratings_bot --preflight` (Python disponível,
módulo importável, provider existente e autorizado, calibração presente e
curvas válidas, diretório de cache seguro) e confere no Node que cada atributo
externo aponta para um atributo existente no jogo.

```text
PRE-FLIGHT RATINGS
Concurrency: 1  TTL: 86400s
Provider: mock  Authorization: OK  Calibration: mock-v1  Synthetic: yes
```

## Providers

`ratings_bot/providers/base.py` define a interface (`find_player`,
`fetch_player`, `health_check`). Cada provider declara `authorized` e
`synthetic`; o bot recusa provider não autorizado.

| Provider | Estado | Motivo |
| --- | --- | --- |
| `mock` / `mock-b` | habilitados, sintéticos | Apenas fixtures e testes; provider sintético nunca alimenta publicação oficial. |
| `sofifa` | desabilitado | Permissão de uso automatizado e redistribuição não estabelecida. |
| `efootball` | desabilitado | Exige consentimento prévio por escrito para extração automatizada. |
| `ea` | desabilitado | Termos restringem robôs e extração automatizada. |
| `licensed-dataset` | desabilitado | Aguarda licença verificada, procedência e escala de rating documentadas. |

## Providers reais

**Status atual: nenhum provider de produção habilitado.** `mock` e `mock-b`
existem apenas para testes, fixtures e desenvolvimento, e provider sintético
nunca alimenta release oficial. Nenhum provider de rede está habilitado: não há
bypass de CAPTCHA, Cloudflare, rate limit, autenticação, paywall ou robots.

Investigação de 17/09/2026. Nada abaixo afirma permissão sem texto de termos
verificado; "não verificado" significa que os termos não foram lidos.

| Fonte | OVR | Potencial | Atributos | Cobertura | Termos verificados | Automação / uso comercial | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [EA Sports FC](https://www.ea.com/legal/user-agreement) | sim | sim | sim | as 12 ligas | sim | licença apenas "non-commercial"; extração de dados vedada | rejeitada |
| [SoFIFA](https://sofifa.com/robots.txt) | sim | sim | sim | as 12 ligas | apenas robots.txt | sem licença; dado derivado da EA | rejeitada |
| FUTBIN / FUTWIZ | sim | não | sim | enviesada (FUT) | não | não verificado | rejeitada |
| Datasets Kaggle "FIFA/EA FC" | sim | sim | sim | as 12 ligas | licença do uploader | derivados de SoFIFA/EA; congelados em 2023; um deles proíbe uso comercial | só protótipo |
| [Football Manager (FMTU / SortItOutSI)](https://fmtransferupdate.com/disclaimer) | sim (CA) | sim (PA) | sim | as 12 ligas | sim | "personal, non-commercial use"; IP da SEGA/SI | rejeitada |
| [API-Football](https://www.api-football.com/) | não (nota 0–10 por partida) | não | não | boa | não | API oficial com chave | não serve |
| [Sportmonks](https://www.sportmonks.com/football-api/) (integração anterior, removida na Fase 11) | não | não | não | boa | não | comercial, desde €29/mês | não serve |
| [football-data.org](https://www.football-data.org/) | não | não | não | parcial | página de termos ausente | — | não serve |
| [StatsBomb Open Data](https://github.com/statsbomb/open-data) | não | não | não | competições selecionadas | sim | proíbe explicitamente exploração comercial | rejeitada |
| FBref / Sports Reference | não | não | não | boa | não | não verificado | não serve |
| Opta / Wyscout | não | não | índices próprios | excelente | contratos privados | licença enterprise | não serve |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) | não | não | não | irregular | sim (CC0) | livre | só identidade |

Conclusão: **provider real pendente**. As fontes que têm OVR, potencial e
atributos derivam da propriedade intelectual da EA ou da SEGA/SI e, onde o texto
foi verificado, restringem uso automatizado ou comercial. As fontes com licença
comercial viável não expõem esses campos — entregam estatísticas de partida.

O caminho recomendado é inverter a dependência: contratar estatísticas
licenciadas com cobertura das 12 ligas e derivar OVR, potencial e atributos
proprietários a partir delas, o que transforma o rating em modelo do produto em
vez de dado importado. Isso exige ler os termos do provider escolhido antes de
qualquer implementação.

### Como adicionar um provider

1. Confirmar por escrito a autorização de uso automatizado da fonte.
2. Criar `ratings_bot/providers/<nome>.py` estendendo `RatingsProvider`,
   usando `RateLimitedHTTP` (concorrência, delay, retry exponencial, timeout,
   429/5xx e User-Agent identificável), com `authorized = True`.
3. Registrar o nome na CLI e remover a entrada de `DISABLED_PROVIDERS`.
4. Declarar a curva do provider em `config/ratings-calibration.json` com
   `version` própria; sem curva o provider não roda.
5. Mapear os atributos externos para os nomes Viztto na mesma configuração.
   Atributo sem mapeamento é rejeitado pelo contrato.

## Matching

Nome parecido nunca autoriza enriquecimento. O nível vem da combinação de nome
normalizado, data de nascimento, clube, posição, nacionalidade e altura:

- `exact` e `high` alimentam o rating final;
- `medium` e `low` são apenas reportados;
- `ambiguous` (candidatos empatados ou colisão de external ID) não é aplicado;
- data de nascimento divergente rebaixa o candidato imediatamente.

Posição não é comparada por texto: `matcher.position_group` reduz rótulos como
`Centre-Forward` e `ST` ao mesmo grupo (GOL/DEF/MEI/ATA). Cada provider pode
declarar `position_aliases` para rótulos próprios, que têm precedência.

Dentro de um provider a relação é 1:1: se dois jogadores Transfermarkt
reivindicam o mesmo `externalPlayerId`, ambos viram `ambiguous`.

## Cache e mappings

`.cache/ratings/<provider>/{search,players}/` guarda respostas com TTL
(`--ttl`, padrão 24h); `--refresh` ignora o cache. A chave inclui o
`cache_namespace` do provider, então fixture nova invalida entradas antigas.

`.cache/ratings/mappings/<provider>.json` persiste
`{ externalId, confidence, lastValidatedAt, status }`. Todo mapping — inclusive
`manual` — é revalidado contra dados frescos do provider; se o external ID
desaparecer, mudar de identidade ou não atingir `exact`/`high`, o mapping vira
`stale` e não é aplicado. Nada de segredos no cache.

## Normalização e potencial

OVR de fontes diferentes não é comparável. Cada provider tem curva monotônica
versionada em `config/ratings-calibration.json`; rating fora da escala
declarada é rejeitado em vez de extrapolado.

O resolver ordena as fontes por nome, combina somente `exact`/`high`, e usa a
média dos ratings normalizados. Divergência acima de 10 pontos entre fontes, ou
distância acima de 18 pontos do Rating Engine, faz a média com o engine e baixa
a confiança para `medium`. Atributos observados são preservados; os ausentes são
estimados pelo engine e listados em `estimatedAttributes`.

O potencial externo entra com peso menor que o cálculo Viztto (idade, OVR,
valor, contexto) e nunca é exibido ao usuário.

## Rating Engine

O engine não consome mais estatísticas de provider. Ele usa apenas dados
Transfermarkt (idade, posição, valor de mercado, reputação de liga e clube,
força da liga, contexto de elenco) e atua como fallback universal, calibrador e
sanity-check dos ratings externos.

## Comandos

```bash
npm run atualizar-dados-futebol    # pipeline completo até a release
npm run atualizar-dados-futebol -- --provider fonte-a --provider fonte-b
npm run atualizar-dados-futebol -- --allow-engine-only
npm run atualizar-ratings          # somente o robô sobre os snapshots atuais
npm run ratings:dry-run            # consulta, matching e relatório sem publicar
npm run ratings:report             # imprime o último relatório
npm run calibrar-ratings -- --results <arquivo>
npm run test:ratings               # testes do robô
```

`--provider <nome>` repetido seleciona os providers externos; sem ele o lote não
tem provider algum. O terminal diz isso explicitamente e a publicação é
bloqueada, porque uma release feita só com o Rating Engine é uma decisão
consciente:

```text
Nenhum provider externo habilitado. A release não será publicada somente com
Rating Engine. Use --allow-engine-only para autorizar explicitamente.
Providers externos habilitados: nenhum
```

Opções do robô: `--provider`, `--league`, `--fixture`, `--refresh`,
`--dry-run`, `--preflight`, `--ttl` (> 0), `--concurrency` (1–8), `--input`,
`--output`, `--report`, `--cache-dir`. Provider desconhecido, repetido, sem
calibração ou com curva inválida falha no preflight.

O interpretador é resolvido por `scripts/ratings-python.sh`, que provisiona
`.venv-ratings` na primeira execução. `RATINGS_PYTHON` sobrescreve essa escolha.

`--dry-run` consulta, cacheia, faz matching e gera relatório sem publicar
release nem tocar em `src/dados/futebol`.

## Relatórios e política de regressão

`relatorios/ratings-import.json` separa dois planos. No **global**: total de
jogadores Transfermarkt, contadores e status por provider (requests, cache hits,
erros, mappings stale, candidatos), níveis de matching, colisões, ratings
externos, multi-source, fallback do engine e cobertura. Em `byLeague`, cada liga
tem seus próprios `total`, `externalRatings`, `multiSource`, `fallbackEngine`,
níveis de matching, `providerCandidates`, `requestFailures`, `collision` e
`coverage`, derivados dos diagnósticos dos jogadores daquela liga. O mesmo
conteúdo é impresso no terminal, incluindo a linha
`Providers externos habilitados: nenhum` quando não há provider.

`relatorios/saude-ratings.json` traz o status do lote e, por liga, as métricas
com `previousCoverage` e `providerStatus`: `not-configured` (nenhum provider),
`healthy`, `degraded` (falhas parciais) ou `failed` (todas as consultas daquela
liga falharam). Provider ausente não é contabilizado como falha técnica.

O gate genérico (`saude-ratings.ts`) bloqueia a publicação quando há queda
severa de cobertura externa, falha do bot sobre base já enriquecida, ou zero
rating externo sem `--allow-engine-only`. Falha do robô nunca sobrescreve um
snapshot bom; o staging fica preservado para diagnóstico. Detalhes dos limiares
em [snapshots-futebol.md](snapshots-futebol.md).

## Runtime

Nenhum request externo ocorre em runtime: nem ao criar carreira, avançar semana,
abrir jogador ou durante a partida. O jogo lê apenas a release ativa, e carreiras
criadas com uma release mantêm OVR, potencial, atributos e metadata daquela
release após novas atualizações.

Saves anteriores à Fase 11 continuam legíveis: `src/dominio/migracoes/`
`rating-metadata-legado.ts` mapeia `sportmonks`/`hybrid` para `external` e
`sportmonksPlayerId` para `externalPlayerId` somente em memória, sem recalcular
rating nem reescrever save. Código de runtime não importa nada de `docs/`.

## Barreira de validação

`.github/workflows/deploy.yml` roda, em ordem e antes de qualquer deploy:
`snapshots:check-git`, `typecheck`, `test`, `test:ratings` e `build`. Qualquer
falha impede o deploy. Os testes Python usam `.venv-ratings`, provisionado na
primeira execução; nada é instalado globalmente.
