# Entrega da fase 4

## Resultado

A criação de carreira consome apenas snapshots locais. Foram removidos o POST público de importação, o polling, a importação ao selecionar liga e a exclusão arbitrária da Série B. A lista e a contagem vêm de uma política central de disponibilidade no servidor.

`npm run atualizar-dados-futebol` carrega o `.env`, gerencia a API local, importa sequencialmente as 13 ligas, valida em staging e publica por rename atômico. Falhas ficam no resumo, retornam código não zero e não interrompem as ligas seguintes. Não há dependência de Next.js nessa atualização.

## Arquivos criados

- `scripts/atualizar-dados-futebol.sh`
- `scripts/atualizar-dados-futebol.ts`
- `src/app/api/futebol/ligas/route.ts`
- `src/dominio/regras/liga.ts`
- `src/infraestrutura/persistencia/base-futebol.ts`
- `src/infraestrutura/transfermarkt/atualizar-base.ts`
- `testes/fase-04.test.ts`
- `testes/cli-futebol.test.ts`
- `API/tests/offline/test_competitions_parser.py`
- `documentacao/BASE-FUTEBOL.md`
- `documentacao/ENTREGA-FASE04.md`

## Arquivos modificados

- `.gitignore`
- `package.json`
- `package-lock.json`
- `scripts/dev.sh`
- `src/app/api/futebol/route.ts`
- `src/componentes/jogador/CriacaoCarreira.tsx`
- `src/dominio/constantes/ligas.ts`
- `src/dominio/constantes/temporadas-iniciais.ts`
- `src/dominio/entidades/modelos.ts`
- `src/infraestrutura/persistencia/importacao-futebol.ts`
- `src/infraestrutura/persistencia/validar-save.ts`
- `src/infraestrutura/transfermarkt/esquemas.ts`
- `src/infraestrutura/transfermarkt/importar-liga.ts`
- `src/simulacao/transferencias/mercado-progressivo.ts`
- `testes/auxiliar-mock-importacao.ts`
- `testes/infraestrutura.test.ts`
- `API/app/services/competitions/clubs.py`
- `API/README.md`
- `README.md`
- `ARQUITETURA.md`

A alteração no mercado apenas permite que a preferência Europa reconheça as divisões secundárias já presentes no mundo; o sistema de negociação foi preservado.

## Arquivo removido

- `src/app/api/futebol/importar/route.ts`

## Snapshots existentes agora versionáveis

- `src/dados/futebol/brasileirao.json` — 20 clubes.
- `src/dados/futebol/ligue-1.json` — 18 clubes.

Esses dois arquivos já estavam no disco e eram ignorados. Não foram regenerados nem substituídos por dados de teste. O arquivo de requisitos `fase-04.md` também já existia e não foi alterado. Nenhum commit, push ou deploy foi executado.

## Decisões e limites

- Mantidos o importador, os normalizadores e o schema dos snapshots. O diretório de escrita pode ser passado explicitamente para isolar staging.
- `obterLigasDisponiveis` e `obterDadosLigaDisponivel` compartilham a política de schema, edição, calendário e elencos. No mínimo dois clubes válidos são necessários.
- Não criado manifesto: os JSONs continuam sendo a fonte de verdade.
- `divisao` é restaurada pelo catálogo em saves antigos. Não foram implementados acesso, rebaixamento ou copas.
- Os 13 IDs foram verificados com consultas reais; os detalhes, as diferenças de edição e um exemplo ilustrativo de output estão em [BASE-FUTEBOL.md](BASE-FUTEBOL.md).
- A Série C exigiu suporte à página de participantes no parser Python. Um processo da API que já estava rodando com o código antigo precisa carregar a versão nova; o atualizador não encerra processos que não iniciou.
- Não foi executada uma atualização real completa de todos os elencos. A CLI foi validada com importador simulado para as 13 ligas, infraestrutura TypeScript real e testes de ciclo de vida do shell. Os demais snapshots serão criados pelo comando oficial.
- Nenhum workflow de deploy versionado foi encontrado no checkout, e nenhum foi alterado.

## Validação

- `npm run typecheck`: aprovado.
- `npm test`: 89 testes aprovados em 8 arquivos.
- `npm run build`: aprovado.
- `PYTHONPATH=API API/.venv/bin/python -m unittest discover -s API/tests/offline`: 2 testes aprovados, sem rede.
- Shell: sintaxe validada, reutilização de API, inicialização própria, propagação de falhas, SIGINT e SIGTERM com encerramento de descendentes.
- Navegador desktop: criação real com os snapshots presentes, contagem de clubes e mundo com duas ligas; apenas GET, sem erros JavaScript.
- Navegador com respostas locais simuladas: início na Série B e Série C no mundo; ausência de base mostra estado vazio e impede avançar.
- Navegador mobile: estado vazio utilizável sem importação automática.
