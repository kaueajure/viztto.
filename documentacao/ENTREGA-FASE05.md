# Entrega da fase 5 — saves PostgreSQL

## 1. Causa original

A carreira runtime passou a conter várias ligas, calendários e milhares de jogadores, excedendo a capacidade de persistência do navegador. O save também duplicava o catálogo estático inteiro. A mensagem genérica de armazenamento local não era adequada para esse volume.

## 2. Arquitetura anterior

`Zustand persist` serializava `EstadoCarreira` integralmente na chave `viztto-carreira` do localStorage. A fundação PostgreSQL existia, mas ainda não participava do jogo.

## 3. Arquitetura nova

PostgreSQL é a fonte de verdade. Zustand guarda apenas runtime em memória. Criação aguarda POST confirmado; ações usam fila de PUT; carregamento usa GET + snapshots; exclusão aguarda DELETE. Não existe fallback no navegador.

## 4. Arquivos criados

- `src/app/api/carreira/route.ts`
- `src/infraestrutura/banco/repositorio-carreira.ts`
- `src/infraestrutura/persistencia/carreira-persistida.ts`
- `src/infraestrutura/persistencia/catalogo-carreira.ts`
- `src/infraestrutura/persistencia/api-carreira.ts`
- `src/infraestrutura/persistencia/cliente-carreira.ts`
- `src/componentes/jogo/EstadoPersistencia.tsx`
- `drizzle/0001_save_anonimo_revision.sql`
- `drizzle/meta/0001_snapshot.json`
- `testes/auxiliar-carreira-persistida.ts`
- `testes/carreira-persistida.test.ts`
- `testes/api-carreira.test.ts`
- `testes/autosave.test.ts`
- `documentacao/ENTREGA-FASE05.md`

## 5. Arquivos alterados

- `src/estado/jogo-store.ts`
- `src/infraestrutura/banco/schema.ts`
- `src/infraestrutura/persistencia/validar-save.ts`
- `src/componentes/jogo/Hidratacao.tsx`
- `src/componentes/jogo/CentralCarreira.tsx`
- `src/componentes/jogador/CriacaoCarreira.tsx`
- `src/app/page.tsx`
- `drizzle/meta/_journal.json`
- `testes/banco.test.ts`
- `testes/infraestrutura.test.ts`
- `README.md`
- `ARQUITETURA.md`
- `documentacao/POSTGRESQL.md`

O arquivo de requisitos `fase-05.md` já existia, não foi alterado. Dependências, `.env`, snapshots, simulador, API Python, importador, CSS, workflow, Nginx e PM2 não foram modificados.

## 6. Arquivo removido

`src/infraestrutura/persistencia/armazenamento.ts`, exclusivo da persistência local anterior. O teste de quota foi substituído pelos testes da nova persistência; a validação de carreira foi preservada.

## 7. Migration

`0001_save_anonimo_revision.sql` adiciona `access_token_hash` nullable/unique e `revision` integer obrigatório com default 0. A migration 0000 não foi alterada. Registros antigos permanecem, com token nulo, sem associação automática a um navegador. Não houve DROP/reset/recriação de banco existente.

## 8. EstadoCarreiraPersistido

Versão 3, mantendo o runtime do simulador na versão 2. O formato contém `ligaId`, `ligasIds`, `clubesDinamicos` e deltas dos elencos, mais todo o estado dinâmico da carreira. `jogadoresGerados` permite identidade própria com prefixo reservado, sem implementar um gerador de NPCs. O formato detalhado está em [POSTGRESQL.md](POSTGRESQL.md).

## 9. Fora do PostgreSQL

Catálogo de ligas e identidades de clubes/NPCs provenientes dos snapshots: escudos, fotos, IDs externos, dados brutos, nomes cadastrais, estádio, país, capacidade, fundação, nascimento, posições estáticas e outros campos cadastrais. Textos históricos de eventos/notícias continuam preservados, mesmo quando mencionam nomes.

## 10. Dentro do PostgreSQL

Jogador do usuário completo, seed/estado aleatório/datas, referências de clubes/ligas, composição e ordem dos elencos, atributos dinâmicos de NPCs, contratos, salários, lesões, estatísticas, orçamento, forças dos clubes, escalações, calendários/resultados/classificações, temporadas externas/anteriores, decisões, mercado, negociações, preferências, transferências, notícias, eventos e objetivos. Metadados e JSONB são atualizados atomicamente.

## 11. Cookie

Token criptograficamente aleatório de 32 bytes, emitido pelo servidor. Banco guarda somente SHA-256. Cookie HttpOnly, SameSite=Lax, Path=/, Secure em produção, validade de 365 dias renovada ao carregar. Nenhum estado ou segredo do banco é exposto no cookie ou ao JavaScript. Não existe acesso por UUID arbitrário.

## 12. Autosave

Uma gravação ativa por store; novas mudanças marcam uma geração pendente e só o estado mais recente é enviado após a confirmação. Erros preservam memória, oferecem retry e exibem aviso de alterações não salvas. `beforeunload` avisa antes de sair quando houver operações/alterações pendentes. Reinício, substituição e exclusão aguardam a escrita ativa.

## 13. Revision

UPDATE condicionado ao hash e à revisão esperada, com incremento na mesma instrução. Duas gravações da mesma revisão resultam em uma confirmação e um conflito. Retry idêntico de um PUT já confirmado pode recuperar o ACK; nunca força sobrescrita de um estado diferente. Conflitos entre abas exigem carregar o save do servidor, com confirmação para descartar pendências.

## 14. Hidratação

Valida JSONB, carrega snapshots locais, resolve ligas/clubes/NPCs por ID, recompõe objetos aplicando deltas e valida referências e runtime. Preserva ordem do mundo e elencos para continuidade determinística. Não executa scraping nem regrava snapshots.

## 15. Transferências de NPCs

A identidade vem do catálogo global, mas o clube e a posição no elenco vêm do save. NPC transferido continua no destino; NPC aposentado não volta ao elenco. Salário, contrato, overall, forma, valor, lesão e estatísticas são preservados.

## 16. Incompatibilidade

Entidades ausentes ou referências incompatíveis geram erro explícito. A API não escolhe substitutos nem apaga/corrige silenciosamente o registro. Saves antigos sem token permanecem inacessíveis ao fluxo anônimo até conversão/vinculação administrativa explicitamente definida.

## 17. Testes adicionados

Serialização sem catálogo, comparação semântica do JSONB, round-trip e próximo passo determinístico, transferência, aposentadoria, evolução, contratos, identidade gerada, mudança cadastral, entidades ausentes, datas/chaves inválidas, limites de corpo, same-origin, UUID arbitrário, ausência/token errado, cookie, CRUD real, substituição segura, revisão antiga/concorrente, erro de banco e proteção do save anterior, fila de autosave, retry, exclusão durante PUT e reload descartando o Zustand.

Teste de navegador adicional executado em Chromium contra build de produção e PostgreSQL temporário, com as 12 ligas locais. Acesso a localStorage/sessionStorage/IndexedDB foi bloqueado pelo teste: criação, avanço, reload, nova aba, retry de falha de rede e exclusão funcionaram sem erros JavaScript. O cookie não apareceu em `document.cookie`.

## 18. Typecheck, testes e build

- `npm run typecheck`: aprovado.
- `npm test`: 114 aprovados; 7 integrações omitidas quando não há banco de teste.
- Suíte completa com PostgreSQL temporário: 121 testes em 12 arquivos.
- `npm run build`: aprovado, incluindo `/api/carreira` como rota dinâmica Node.
- `npm run db:generate`: sem diferenças adicionais após gerar 0001.

## 19. Banco de desenvolvimento

O destino foi conferido sem revelar credenciais: host `127.0.0.1`, porta `5433`, banco `viztto_dev`. `npm run db:check` e `npm run db:migrate` concluíram com sucesso. Nenhuma migration foi executada manualmente em produção. O workflow existente foi apenas lido.

## 20. Tamanho medido

Carreira inicial realista com os snapshots atuais: 12 ligas, 238 clubes e 6.722 NPCs. JSON do runtime: **9.311.102 bytes**. JSON persistido: **4.785.138 bytes**, aproximadamente **4,8 MB / 4,56 MiB**, redução de cerca de 49%. Essa é a representação JSON enviada, não o tamanho físico do JSONB/TOAST no PostgreSQL. O tamanho cresce com o histórico; não foi feita truncagem para obter essa redução.

## 21. Ausência de armazenamento no navegador

A busca em `src/` não encontrou uso de localStorage, sessionStorage, IndexedDB, createJSONStorage ou middleware persist. Menções restantes ficam nos requisitos/histórico, na documentação que explica sua remoção e nos testes de proibição. Não há implementação híbrida nem importação automática do save antigo do navegador.

## 22. Limites restantes

- Sem contas, perder o cookie perde o acesso automático. O dado continua no banco; não há recuperação por identidade.
- O último save confirmado sobrevive ao fechamento/reinício/deploy, desde que o banco e seu armazenamento sejam mantidos. Alterações ainda em memória podem ser perdidas ao encerrar à força.
- Conflitos não têm merge automático entre abas. O estado do servidor não é sobrescrito silenciosamente.
- Limite de payload: 16 MiB. Um proxy externo pode limitar antes disso; não alteramos Nginx. Histórico muito longo pode exceder o limite, gerando erro explícito.
- Remoção de IDs ou alterações de liga na base podem tornar um save incompatível. Mudanças cadastrais que afetam regras podem mudar a simulação futura; não se mantém cópia histórica do catálogo por save.
- Registros anteriores sem token e saves antigos do navegador não são migrados automaticamente.
- As validações preservam estrutura e referências; esta etapa não transforma a simulação executada no cliente em um sistema antitrapaça.

Trabalho realizado sobre `main`. Nenhum commit, push ou deploy foi executado.
