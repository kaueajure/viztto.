# Fundação PostgreSQL

## Escopo e arquitetura analisada

Analisados `package.json`, o store Zustand, todos os módulos de `infraestrutura/persistencia/`, as entidades do domínio, ambas as rotas de futebol, `.env.example`, documentação de arquitetura e testes de persistência. Não há `.github/workflows/deploy.yml` nem outro workflow de deploy versionado neste checkout.

O Zustand mantém `persist()`, a chave `viztto-carreira`, a versão 2, a hidratação e o adaptador de localStorage. `validarSave` preserva a validação/migração existente. Snapshots de futebol continuam em JSON no disco, servidos pelas rotas de leitura. Nenhuma tela, criação de carreira, regra do simulador ou rota foi alterada por esta fundação.

Esta etapa não resolve o limite de armazenamento do navegador: não há transferência automática ou manual dos saves para PostgreSQL ainda.

## Dependências

- Produção: `drizzle-orm` 0.45.2 e `postgres` 3.4.9.
- Desenvolvimento: `drizzle-kit` 0.31.10.
- `server-only` já existia. Não foi adicionado Prisma, autenticação ou modelo de usuários.

O lockfile fixa as versões instaladas. Há quatro avisos moderados na cadeia de desenvolvimento `drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild`; `npm audit --omit=dev` não encontrou vulnerabilidades. Não foi aplicado downgrade/`audit fix --force`.

## Configuração e conexão

`DATABASE_URL` vem do ambiente ou do `.env` da raiz. Variáveis exportadas têm precedência. Os comandos fora do Next carregam esse arquivo explicitamente; `.env.local` não é carregado por esses comandos. Não usar prefixo `NEXT_PUBLIC_`. Arquivos `.env*` reais continuam ignorados, com exceção de `.env.example`.

Exemplo fictício:

```dotenv
DATABASE_URL=postgresql://viztto:senha@127.0.0.1:5432/viztto
```

Ausência, protocolo inválido ou URL sem host/banco geram mensagem clara. Nenhuma mensagem da CLI inclui a URL, senha, erro bruto do driver ou dados de SQL. TLS pode ser configurado na própria URL conforme o provedor; não desativamos validação de certificados.

`obterBanco()` é lazy: importar o módulo não exige a variável nem abre conexão. A conexão/ORM é guardada em `globalThis` por processo para sobreviver ao hot reload. O pool da aplicação tem limite de cinco conexões; os comandos CLI usam um cliente próprio limitado a uma conexão, encerrado em `finally`. Timeout de conexão: 10 segundos; consulta: 30 segundos; conexões ociosas: 20 segundos.

`conexao.ts` e `cliente.mjs` usam `server-only`. O schema é declarativo e não abre conexão, permitindo sua leitura pelo Kit. Tipos `CareerSave` e `NovoCareerSave` são inferidos do schema; `state` é tipado como `EstadoCarreira` por importação apenas de tipo. Essa tipagem não substitui a validação de payloads em uma futura integração.

Os comandos de migração/check são JavaScript ESM com checagem TypeScript via JSDoc: funcionam no Node 22.12+ sem `tsx`, TypeScript ou Drizzle Kit instalados em produção. A condição `react-server` habilita o uso legítimo de módulos `server-only` nesses processos Node.

## Schema final

| Coluna | Tipo PostgreSQL | Obrigatória | Default |
| --- | --- | --- | --- |
| id | uuid, primary key | Sim | gen_random_uuid() |
| save_version | integer | Sim | — |
| name | text | Sim | — |
| current_club_id | text | Não | — |
| current_league_id | text | Não | — |
| game_date | date | Sim | — |
| state | jsonb | Sim | — |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

`dataAtual` é sempre uma string `YYYY-MM-DD` no domínio; `date({ mode: "string" })` mantém esse formato sem conversão de fuso. O UUID da tabela pode ser informado ou gerado pelo banco e é independente de `EstadoCarreira.id`, que atualmente é a seed e pode não ser UUID. O estado inteiro permanece no JSONB, incluindo seu identificador original.

`save_version` futuramente deverá refletir `state.versao`; `name` é o nome do save. A futura camada de aplicação deverá validar o estado e manter os metadados consistentes na mesma escrita. O default de `updated_at` vale na inserção: operações futuras de atualização devem defini-lo explicitamente. Não há trigger oculto ou hook de atualização apenas no ORM.

Somente o índice da chave primária foi criado: ainda não existem consultas de listagem/filtro que justifiquem índices adicionais ou GIN no JSONB. Não há normalização de clubes/ligas nem FKs para tabelas inexistentes. Uma migration futura poderá criar `users` e adicionar `user_id`, com estratégia explícita para saves anteriores.

## Migration e comandos

Gerada pelo Drizzle Kit: `drizzle/0000_career_saves.sql`, acompanhada de `drizzle/meta/0000_snapshot.json` e `drizzle/meta/_journal.json`. O SQL cria somente a tabela acima. O migrador mantém também seu controle interno em `drizzle.__drizzle_migrations`.

```bash
# Em desenvolvimento, após alterar schema.ts:
npm run db:generate -- --name=descricao_da_alteracao

# No servidor, com DATABASE_URL configurada:
npm run db:check
npm run db:migrate

# Inspeção local, com dependências de desenvolvimento:
npm run db:studio
```

A configuração exige `DATABASE_URL` também ao gerar migrations, mas `generate` não conecta ao banco: um endereço fictício serve para geração offline. Não há `push`, reset ou seed no fluxo. Revise e versione SQL, snapshot e journal juntos; não edite migrations já aplicadas.

O comando `db:migrate` usa o [migrador oficial do Drizzle ORM](https://orm.drizzle.team/docs/drizzle-kit-generate), uma das formas suportadas de aplicar SQL gerado pelo Kit. Assim, não depende de `drizzle-kit` em produção. O [driver Postgres.js](https://github.com/porsager/postgres) é compartilhado com a infraestrutura da aplicação.

## Deploy

O PostgreSQL deve ser provisionado separadamente e sobreviver aos deploys. Nenhum comando cria/recria o banco ou remove dados. Nenhum script externo/root-owned da VM foi alterado.

No futuro fluxo de release: disponibilizar a nova versão e suas dependências, fornecer `DATABASE_URL`, executar `npm run db:migrate` **uma única vez antes de reiniciar a aplicação**, e só prosseguir se o comando retornar zero. Serializar deploys para evitar migradores concorrentes. Não gerar migrations em produção.

Mesmo com `npm ci --omit=dev`, incluir no artefato `scripts/db.mjs`, `src/infraestrutura/banco/cliente.mjs`, `src/infraestrutura/banco/configuracao.mjs`, a pasta `drizzle/` completa e `package.json`/lockfile. Um artefato Next standalone isolado não inclui necessariamente esses arquivos: executar a migration na etapa de release com esses arquivos disponíveis.

Não foi conectado o banco ao `build`, `start`, Zustand ou endpoints. Build e jogo permanecem independentes da disponibilidade do PostgreSQL.

## Testes e verificação

- `npm install`: concluído.
- `npm run typecheck`: aprovado.
- `npm test`: 97 aprovados, 1 integração omitida quando não há banco de teste.
- Com `VIZTTO_TEST_DATABASE_URL` apontando para PostgreSQL 16 temporário: 98 testes aprovados em 9 arquivos.
- `npm run build`: aprovado sem `DATABASE_URL`.
- `db:check`: `SELECT 1` aprovado no banco temporário.
- `db:migrate`: executado duas vezes; uma única migration registrada, sem recriar tabela.
- Artefato temporário com `npm ci --omit=dev`: `db:check` e `db:migrate` aprovados, sem Drizzle Kit ou tsx instalados.
- Drizzle Kit: regeneração sem diferenças, `check` aprovado e Studio iniciado em loopback e encerrado após o teste.
- A `DATABASE_URL` local também respondeu ao `db:check` (somente leitura). Migrations foram aplicadas exclusivamente nos bancos temporários, não nesse banco configurado.
- Round-trip de carreira completa: JSONB preservado, data sem deslocamento, UUID gerado e explícito, metadados nulos e timestamps com defaults. O teste usa rollback e deixa zero saves.
- Testes sem rede: configuração inválida/ausente, import lazy, reutilização em hot reload, encerramento e barreira `server-only`.

Para repetir a integração, use exclusivamente um banco de teste previamente migrado e configure `VIZTTO_TEST_DATABASE_URL` no ambiente antes de `npm test`. O teste não usa `DATABASE_URL` como fallback.

## Arquivos desta entrega

Criados: `drizzle.config.ts`; os três arquivos de migration/metadados em `drizzle/`; `src/infraestrutura/banco/{configuracao.mjs,cliente.mjs,conexao.ts,schema.ts}`; `scripts/db.mjs`; `testes/banco.test.ts`; este documento.

Alterados: `package.json`, `package-lock.json`, `.env.example`, `README.md`, `ARQUITETURA.md`. As alterações anteriores da fase 4 foram preservadas. Nenhum commit ou push foi feito.
