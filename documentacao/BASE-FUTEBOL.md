# Base local de futebol

Transfermarkt define identidade, clubes e universo canônico. O robô Python adiciona apenas ratings por matching seguro. Veja [pipeline de ratings](../docs/ratings-pipeline.md) e [publicação atômica](../docs/snapshots-futebol.md).

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

- A CLI usa `flock`; cada execução prepara todas as ligas em diretório temporário.
- Exige clubes completos, calendário válido e universo completo das ligas suportadas.
- Snapshot parcial ou queda severa de cobertura externa bloqueia a publicação.
- O ponto único de publicação é o rename de `active.json` após validar a release completa.
- Engine puro exige `--allow-engine-only`; não permite substituir uma base enriquecida após falha total.
- `--dry-run` gera diagnóstico sem publicar. A CLI completa ainda consulta Transfermarkt; para testes offline use fixtures no robô isolado.

## Verificação

`npm test` testa snapshots temporários, falhas/parciais, domínio, endpoints e ciclo de vida do shell com processos simulados. Nenhum teste da CLI acessa Transfermarkt real.

O parser Python também possui testes offline:

```bash
PYTHONPATH=API API/.venv/bin/python -m unittest discover -s API/tests/offline
```

Não foi encontrado workflow GitHub Actions versionado neste checkout; nenhum deploy foi alterado. Os snapshots seguem como arquivos comuns do repositório para o mecanismo de deploy existente.
