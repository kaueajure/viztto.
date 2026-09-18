# Fontes externas de game ratings

Status operacional dos adapters do `ratings_bot`. **Nada neste documento afirma
permissão legal absoluta** — apenas o que foi verificado em texto público na
data indicada.

Os ratings de jogos são evidência (priors) para o Rating Engine. Eles **não**
substituem Transfermarkt (identidade/mercado) nem viram OVR Viztto por
definição.

## Arquitetura

```text
Transfermarkt → identidade canônica
Sportmonks (removido) / performance real futura → evidência de campo
EA FC / SoFIFA / eFootball → game ratings (famílias ea_fc | konami)
        ↓
ratings_bot (providers + matching + consensus por família)
        ↓
Rating Resolver (priors; double-count evitado por family)
        ↓
Rating Engine Viztto (fallback / calibração)
```

Providers vivem em `ratings_bot/providers/`. Coleta exploratória:

```bash
npm run ratings:fontes -- --dry-run --limit 20
npm run ratings:fontes -- --source ea-official --limit 5
npm run ratings:fontes -- --probe
```

Dry-run **nunca** altera `src/dados/futebol`. O pipeline oficial
(`atualizar-ratings`) continua recusando providers listados em
`DISABLED_PROVIDERS`.

## Providers

| ID | Família | Status | Acesso | Verificado em | Notas |
| --- | --- | --- | --- | --- | --- |
| `ea-official` | `ea_fc` | DISABLED_BY_POLICY | HTML público `__NEXT_DATA__` em ea.com/games/ea-sports-fc/ratings | 2026-09-17 | Parser + fixtures OK; User Agreement restringe robôs/extração automatizada — **compatibilidade com os termos: não estabelecida para coleta automática**. |
| `sofifa` | `ea_fc` | DISABLED_BY_POLICY | API REST documentada (api.sofifa.net) | 2026-09-17 (docs 2026-09-07) | Requisitos: projeto **NON-COMMERCIAL**, DB próprio do jogo, atribuição, IP allowlist, ≤60 req/min. Viztto pode ser comercial → adapter desabilitado. **Scraping HTML não é alternativa**. |
| `pesmaster` | `konami` | REVIEW_REQUIRED | HTML público; robots.txt `Allow: /` | 2026-09-17 | Parser distingue base vs featured. Licença comercial de reuso automatizado **não confirmada** no privacy policy — requer revisão. |
| `mock` / `mock-b` | `synthetic:*` | AVAILABLE (sintético) | fixtures | — | Somente testes; nunca release oficial. |

## Famílias e double-counting

`ea-official` e `sofifa` compartilham `family=ea_fc`. O consenso e o
`resolverRating` contam **uma evidência por família**. Divergência intra-família
é registrada; preferência estável: `ea-official` > `sofifa` quando ambos
existem.

Escalas EA ≠ eFootball: `overallRaw` é sempre preservado;
`overallNormalized` só existe após calibração explícita.

## Base vs special

| ratingType | Entra no consenso automático? |
| --- | --- |
| `base` / `standard` | sim |
| `special` / `featured` / `event` | não (diagnóstico) |
| `unknown` | não |

## Cache / rate limit

- Cache: `.cache/ratings/<provider>/` (gitignored) e, para fontes,
  relatórios em `relatorios/ratings-fontes.json`.
- HTTP: `RateLimitedHTTP` (concurrency baixa, delay, retry, 429, timeout,
  User-Agent `VizttoRatingsBot/1.0`).
- SoFIFA (se um dia habilitado): teto interno ≤30 req/min (< 60 documentados).

## Outras fontes pesquisadas (não implementadas)

| Fonte | OVR | Pot. | Atributos | Acesso | Estabilidade | Risco termos | Valor adicional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FUTBIN / FUTWIZ | sim | parcial | sim | HTML | média | alto (UT-only, ToS) | baixo — cartas FUT, não base career |
| Datasets Kaggle FIFA/FC | sim | sim | sim | dump | baixa (congelados) | alto (derivados SoFIFA/EA) | só protótipo offline |
| Football Manager (FMTU) | CA/PA | sim | sim | HTML | média | alto (SEGA/SI non-commercial) | metodologia diferente |
| API-Football | não (notas) | não | não | API paga | alta | médio | performance, não OVR de jogo |
| Wikidata | não | não | não | API CC0 | média | baixo | só identidade |

Nenhuma dessas cinco foi implementada nesta fase: ou não agrega OVR de jogo
legítimo, ou conflita com termos, ou duplica a família `ea_fc`.

## Matching

Nome + DOB + clube + nacionalidade + posição + altura. Níveis: `exact` /
`high` (aplicáveis) · `medium` (relatório) · `ambiguous` / `unmatched` (não
aplicam). Abreviações tipo `Vini Jr` / `Vinícius Júnior` só sobem com DOB.

## Integração com o Rating Engine

Game ratings entram como **priors** via `resolverRating` (família-aware). O
engine Transfermarkt continua como fallback. Nenhum provider desta fase está
autorizado a alimentar release oficial.
