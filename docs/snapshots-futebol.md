# Publicação e versionamento da base

A fonte versionada após a primeira publicação é a release (opção A).
A opção B exigiria desmontar a leitura por manifesto ou manter outro protocolo
de exportação: trocar 13 arquivos da raiz perderia o ponto único de commit.
Mantemos o rename atômico de active.json e a leitura exclusiva da release ativa.

Estrutura após atualização:

```text
src/dados/futebol/
  active.json
  releases/
    r-<atual>/
      <cada uma das 13 ligas>.json
    r-<anterior>/                 # opcional para rollback
      <cada uma das 13 ligas>.json
```

O manifesto mantém versao: 1, releaseId, atualizadoEm e ligas.
A release oficial exige exatamente LIGAS_SUPORTADAS, sem IDs duplicados,
faltantes ou inesperados. Validação precede qualquer troca do manifesto.
Os gates de clubes, calendário, quantidade e enriquecimento continuam no atualizador.

Depois do rename, a limpeza mantém a release ativa e até uma anterior,
removendo os snapshots da raiz. Falhas nessa limpeza são avisos; não removem
a release ativa nem transformam uma publicação concluída em falha.
Se restarem JSONs legados por falha de limpeza, o verificador do Git rejeita
essa duplicação até sua remoção. O runtime continua lendo só a release.

Antes da primeira publicação, o layout legado permanece compatível.
O commit 46bea9a contém 12 snapshots, sem Série C e sem active.json.
Esta correção não migra esses dados: a próxima publicação oficial exige 13.

## Fluxo de Git

Depois de uma atualização autorizada, preparar TODO src/dados/futebol no mesmo
conjunto de alterações, incluindo remoções da raiz e releases antigas.
Executar `npm run snapshots:check-git` após preparar o índice e antes de
commitar. O comando lê os bytes do índice Git, não arquivos locais:
rejeita manifesto incompleto, snapshot ausente/inválido e duplicação legado/release.
Não executa git add, commit, push ou deploy. Integrar esse comando ao processo
de revisão; ele não instala hooks nem impede comandos Git manuais.

active.json e releases não são ignorados. Nunca preparar somente active.json.
Um clone precisa apenas dos arquivos versionados para carregar a base.
O teste de clone lógico copia manifesto e release para outro diretório,
lê todas as ligas e confirma a rejeição se a release apontada desaparecer.

## Testes e bootstrap

A publicação isolada exige contrato explícito:
`publicacao: { modo: "isolada", ligasEsperadas: [...] }`.
No atualizador, exige também `diretorio` explícito. Esse contrato só deve ser
usado com fixtures e diretórios temporários; o comando normal não o oferece.
Uma lista parcial em `ligas` não reduz o universo exigido para publicação oficial.

Bootstrap A/B degradado bloqueia por padrão. Opt-in:
`npm run atualizar-dados-futebol -- --allow-degraded-bootstrap`.
A opção passa pelo shell ao TypeScript e à avaliação de saúde.
Saúde crítica e regressão severa continuam bloqueando com a flag.
A/B já enriquecido com saúde degradada também bloqueia.
C conserva tolerância à cobertura parcial; D conserva fallback esperado.
Ausência opcional de token mantém o fallback estimado já existente.

Publicação degradada aceita retorna atualizacao_degradada e exit code 0;
bloqueio retorna falha_critica e exit code 1.
`VIZTTO_IMPORTACAO_DIR` é respeitado pelo comando.

## Seasons Sportmonks

Nome descritivo da liga: nomeLigaSportmonks; identificador: idSportmonks.
Label: TEMPORADAS_INICIAIS[ligaId].temporadaSportmonks.
Identificador da temporada: seasonId resolvido e validado pela API.

A documentação v3 usa YYYY/YYYY (exemplo 2021/2022), busca pelo nome da
temporada e filtro seasonLeagues. Não comprova a disponibilidade de uma edição
no plano contratado; a resposta precisa confirmar id, liga e label.
2026/27 continua equivalente a 2026/2027 na validação.

- [Busca por nome](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/seasons/get-seasons-by-search-by-name)
- [Squads por time e temporada](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-squads/get-team-squad-by-team-and-season-id)

Exemplos sem credenciais:
```text
https://api.sportmonks.com/v3/football/seasons/search/2026%2F2027?filters=seasonLeagues%3A8
https://api.sportmonks.com/v3/football/seasons/search/2026?filters=seasonLeagues%3A648
```

A requisição de validação é /seasons/<id>?include=league.
Os testes usam ClienteSportmonks real com fetch simulado e verificam pathname,
label, filtro e liga. Nenhuma requisição real é necessária.

## Health e benchmark

HEALTH_THRESHOLDS centraliza:
base enriquecida >=15%; queda relativa >=60% com perda >=9 pontos percentuais,
ou perda absoluta >=40 pontos. Queda severa se aplica a A/B.
Crítico: teams/squads <25% ou matching <10%.
Saudável: teams/squads >=60%, matching >=35%, stats >=25%.

`npm run benchmark:save` gera 13 ligas, 258 clubes, 28 NPCs por clube,
atributos e metadata completos, classificações e 12 temporadas externas.
Calendários vazios evitam confundir custo de NPCs com partidas.
Serialização, stringify, parse e hidratação usam o mesmo save grande.
Memória é aproximada, sem forçar GC; tempos variam por execução/máquina.
