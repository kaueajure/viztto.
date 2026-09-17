# Pipeline de ratings

O Transfermarkt é a única fonte de identidade. O robô Python apenas acrescenta
ratings aos jogadores que já vieram do Transfermarkt: nunca cria, remove ou
renomeia jogador, clube ou liga.

```text
Transfermarkt (13 ligas)
  → universo canônico (players-to-enrich.json)
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

Provider real pendente de fonte autorizada. Nenhum provider de rede está
habilitado: não há bypass de CAPTCHA, Cloudflare, rate limit, autenticação,
paywall ou robots.

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
npm run atualizar-ratings          # somente o robô sobre os snapshots atuais
npm run ratings:dry-run            # consulta, matching e relatório sem publicar
npm run ratings:report             # imprime o último relatório
npm run calibrar-ratings -- --results <arquivo>
npm run test:ratings               # testes do robô
```

Opções do robô: `--provider`, `--league`, `--fixture`, `--refresh`,
`--dry-run`, `--ttl`, `--concurrency`, `--input`, `--output`, `--report`.

O interpretador é resolvido por `scripts/ratings-python.sh`, que provisiona
`.venv-ratings` na primeira execução. `RATINGS_PYTHON` sobrescreve essa escolha.

`--dry-run` consulta, cacheia, faz matching e gera relatório sem publicar
release nem tocar em `src/dados/futebol`.

## Relatórios e política de regressão

`relatorios/ratings-import.json` traz contadores por provider (requests, cache
hits, erros, mappings stale, candidatos), totais por nível de matching,
colisões, cobertura e recorte por liga. O mesmo conteúdo é impresso no terminal.
`relatorios/saude-ratings.json` traz o status do lote e as métricas de saúde por
liga.

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
