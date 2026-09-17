# Base local de futebol — fase 4 (+ enriquecimento Sportmonks / fase 11)

A atualização oficial é `npm run atualizar-dados-futebol`. Não existe endpoint público de escrita. Os JSONs existentes são versionáveis e a disponibilidade é calculada diretamente a partir deles, sem manifesto obrigatório.

## Transfermarkt + Sportmonks

Arquitetura de importação (apenas no PC do desenvolvedor):

1. **Transfermarkt** (API local `felipeall`) — identidade, clubes, elencos, posição, idade, valor de mercado, contratos, fotos.
2. **Sportmonks** (Football API v3) — estatísticas de desempenho por temporada, quando houver token e cobertura.
3. **Viztto Rating Engine** — stats → atributos → `calcularOverall()` / potencial estimado (nunca `rating_partida × 10`).
4. Snapshots em `src/dados/futebol/*.json` — o jogo em runtime **não** chama Transfermarkt nem Sportmonks.

### Token Sportmonks

Defina no ambiente (ou `.env` local, ignorado pelo Git):

```bash
export SPORTMONKS_API_TOKEN=seu_token_aqui
```

- Sem token: a atualização **continua** com ratings estimados a partir do Transfermarkt (fallback).
- Com token inválido (401/403): a publicação é **abortada** para não misturar snapshots parcialmente enriquecidos.
- O token nunca deve ir para o navegador, logs, snapshots ou relatórios (`relatorios/` e `.cache/sportmonks/` estão no `.gitignore`).

### Matching e fallback

- Matching TM ↔ SM por nome normalizado, data de nascimento, clube, posição, altura e nacionalidade.
- Só `exact`/`high` aplicam estatísticas; matches duvidosos ficam unresolved.
- Mapa estável opcional: `.cache/sportmonks/tm-sm-mapping.json`.
- Cobertura por liga em `src/dominio/constantes/sportmonks-ligas.ts` (níveis A–D). Atualize `seasonIdPreferido` / `nomeTemporadaBusca` quando a temporada Sportmonks mudar (Brasil ≠ Europa).

### Relatórios

Após o comando: resumo no terminal + `relatorios/sportmonks-matching.json` (matched / unmatched / ambiguous / requests por liga).

### Metadata de rating (técnica)

Em cada jogador enriquecido: `ratingMetadata.source` (`sportmonks` | `hybrid` | `transfermarkt-estimated` | `generated`), `confidence` (`high` | `medium` | `low`), minutos, season e id Sportmonks quando houver. Saves existentes guardam overall/potencial no delta da carreira — atualizar snapshots depois **não** altera carreiras já criadas.

## Catálogo verificado

Verificação executada em 16/09/2026, com consultas reais ao serviço local de `felipeall/transfermarkt-api` e ao Transfermarkt. Nenhum código foi substituído por outra competição.

| Liga | ID do jogo | Transfermarkt | Divisão | Clubes encontrados | Edição interna |
| --- | --- | --- | --- | --- | --- |
| Brasileirão Série A | brasileirao | BRA1 | 1 | 20 | 2025 |
| Brasileirão Série B | brasileirao-b | BRA2 | 2 | 20 | 2025 |
| Brasileirão Série C | brasileirao-c | BRA3 | 3 | 20 | 2025 |
| Premier League | premier-league | GB1 | 1 | 20 | 2026 |
| Championship | championship | GB2 | 2 | 24 | 2026 |
| La Liga | la-liga | ES1 | 1 | 20 | 2026 |
| LaLiga 2 | la-liga-2 | ES2 | 2 | 22 | 2026 |
| Serie A | serie-a | IT1 | 1 | 20 | 2026 |
| Serie B | serie-b | IT2 | 2 | 20 | 2026 |
| Bundesliga | bundesliga | L1 | 1 | 18 | 2026 |
| 2. Bundesliga | bundesliga-2 | L2 | 2 | 18 | 2026 |
| Ligue 1 | ligue-1 | FR1 | 1 | 18 | 2026 |
| Ligue 2 | ligue-2 | FR2 | 2 | 18 | 2026 |

Os 12 códigos de ligas tradicionais foram consultados por `GET /competitions/<id>/clubs`. A Série C retornava 404 no parser anterior: o serviço atualizado foi executado diretamente contra o Transfermarkt e retornou 20 participantes. A API já em execução precisa carregar essa alteração para atender BRA3; o atualizador não encerra/reinicia uma API que não iniciou.

Fontes oficiais: [Série A](https://www.transfermarkt.com/-/startseite/wettbewerb/BRA1/saison_id/2025), [Série B](https://www.transfermarkt.com/-/startseite/wettbewerb/BRA2/saison_id/2025), [Série C — participantes](https://www.transfermarkt.com/-/teilnehmer/pokalwettbewerb/BRA3/saison_id/2025). Os demais códigos usam a mesma página `/startseite/wettbewerb/<id>/saison_id/2026`, verificada através da API local.

O seletor do Transfermarkt exibe **2026** para o valor interno **2025** nas três ligas brasileiras. O importador agora valida o `seasonId` retornado e registra `temporadaTransfermarkt` separadamente do ano do jogo. As datas de início são âncoras semanais da simulação, não datas oficiais: foram preservadas as existentes, a Série C compartilha a da Série B e as novas divisões europeias compartilham a principal do país.

## Publicação e falhas

- A CLI trava execuções concorrentes com `flock` e importa ligas sequencialmente.
- Cada execução tem staging próprio, isolado do diretório servido pelo Next.
- JSON válido, edição compatível e pelo menos dois clubes válidos permitem publicação.
- Snapshot parcial publica apenas clubes atualizados com sucesso. Clubes com erro não reutilizam dados antigos em atualização forçada.
- Erro geral, edição errada ou menos de dois clubes preservam o arquivo anterior e produzem saída não zero.
- Arquivos temporários e staging não entram no Git. `.env`, `.venv` e caches permanecem ignorados.
- Os snapshots já presentes antes da fase 4 continuam utilizáveis por sua edição/calendário. Uma próxima atualização adiciona o identificador interno explicitamente.
- Validar os códigos/participantes não equivale a atualizar todos os perfis e elencos.

## Exemplo de saída

Exemplo ilustrativo (as quantidades de jogadores dependem da consulta; não é um relatório de atualização real):

```text
Reutilizando Transfermarkt API em http://127.0.0.1:8000 (não será encerrada).
════════════════════════════════════════
VIZTTO — ATUALIZAÇÃO DA BASE DE FUTEBOL
════════════════════════════════════════
[1/13] Brasileirão Série A
Competição: BRA1
[████████░░░░░░░░░░░░] 8/20 · 8 atualizados · 0 falhas · Atualizando: Fluminense
✓ Brasileirão Série A: 20/20 clubes, 612 jogadores.
...
⚠ Ligue 1: 17/18 clubes, 480 jogadores.
  - Clube X: A API não retornou jogadores para este clube.
════════════════════════════════════════
RESUMO
════════════════════════════════════════
✓ Brasileirão Série A: 20/20
...
⚠ Ligue 1: 17/18
✓ Ligue 2: 18/18
13 ligas · ... clubes publicados · ... jogadores · 1 falhas · ...s
Diagnóstico da tentativa: src/dados/futebol/.staging/atualizacao-...
```

## Verificação

`npm test` testa snapshots temporários, falhas/parciais, domínio, endpoints e ciclo de vida do shell com processos simulados. Nenhum teste da CLI acessa Transfermarkt real.

O parser Python também possui testes offline:

```bash
PYTHONPATH=API API/.venv/bin/python -m unittest discover -s API/tests/offline
```

Não foi encontrado workflow GitHub Actions versionado neste checkout; nenhum deploy foi alterado. Os snapshots seguem como arquivos comuns do repositório para o mecanismo de deploy existente.
