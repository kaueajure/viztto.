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

Primeira geração sem ratings externos exige `--allow-engine-only`.
Queda severa de cobertura bloqueia mesmo com essa opção. O bot não publica;
somente o atualizador chama a release após todos os gates.

`VIZTTO_IMPORTACAO_DIR` é respeitado pelo comando. `--dry-run` não publica.

## Saúde e benchmark

O gate genérico compara cada liga com sua release anterior. Base enriquecida
>=15%: perda relativa >=60% com perda >=9 pontos percentuais, ou perda
absoluta >=40 pontos bloqueia. Falha total do bot sobre qualquer cobertura
externa anterior também bloqueia. Ver [ratings-pipeline.md](ratings-pipeline.md).

`npm run benchmark:save` gera 13 ligas, 258 clubes, 28 NPCs por clube,
atributos e metadata completos, classificações e 12 temporadas externas.
Calendários vazios evitam confundir custo de NPCs com partidas.
Serialização, stringify, parse e hidratação usam o mesmo save grande.
Memória é aproximada, sem forçar GC; tempos variam por execução/máquina.
