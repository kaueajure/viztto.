# Persistência de carreiras — fase 5

## Fonte de verdade e fluxo

PostgreSQL guarda o progresso. Zustand é apenas memória/UI; a carreira não usa `localStorage`, `sessionStorage`, IndexedDB nem `persist()` do Zustand. A mensagem antiga de limite de armazenamento foi removida. O adaptador `armazenamento.ts` foi removido.

```text
Ação → EstadoCarreira runtime v2 → serializarCarreira → EstadoCarreiraPersistido v3
    → fila de autosave → PUT /api/carreira → career_saves (JSONB + metadados)

GET /api/carreira → JSONB + catálogo do deploy → hidratarCarreira
    → validar referências/estado → EstadoCarreira runtime → Zustand
```

O motor e suas regras continuam independentes do banco. As versões do runtime e do formato persistido são deliberadamente distintas. O schema JSONB usa `EstadoCarreiraPersistido`; isso não muda a versão do simulador.

## Classificação dos campos

A classificação foi baseada em `EstadoCarreira`, geração de mundo, evolução, escalação, avanço de tempo, transição de temporada, decisões e mercado. Não se determina se um campo é estático apenas pelo objeto que o contém.

| Grupo | No PostgreSQL | Reconstruído / derivado |
| --- | --- | --- |
| Carreira | ID original, seed, estado aleatório, datas, identidade inicial, jogador do usuário completo, IDs de clube inicial/atual, IDs e ordem das ligas | Objetos `liga` e `ligas` vêm do catálogo |
| Clubes | ID, formação, goleiro/titulares/banco, reputação, forças geral/ataque/meio/defesa, orçamento, forma/moral/fadiga, ordem do elenco e seus deltas | Nomes, códigos, IDs externos, escudo, país, estádio, capacidade, fundação, dados brutos, idade média, valor inicial do elenco, registro externo de transferências, qualidade da base, poder financeiro |
| NPCs dos snapshots | ID, clube atual, idade da simulação, overall/potencial, forma/moral/condicionamento/fadiga, valor, salário, contrato, lesão, suspensão, papel e estatísticas acumuladas | Nome, foto, IDs externos, nacionalidade, nascimento original, posições, pé, altura, camisa e histórico cadastral original |
| Treinador | Não muda no motor atual | Reconstruído pelo catálogo/preparação de mundo; personalidade e identidade não são duplicadas |
| Temporadas | Calendários, partidas, placares, eventos, classificações, andamento, temporadas externas/arquivadas | Nenhuma rodada é simulada novamente ao carregar |
| Mercado e história | Propostas, contrapropostas, observação, preferências, transferências, contratos, decisões, objetivos, notícias, eventos e registros | `nomeJogador` de transferência é resolvido pelo ID; textos históricos narrativos permanecem |
| Outros | Janela, relações, foco de treino, última partida | `tamanhoElenco` é derivado do elenco atual |

As quatro forças dos clubes são persistidas mesmo sendo recalculáveis: o momento do recálculo faz parte da continuidade do motor. A ordem de clubes/ligas/NPCs é persistida porque interfere no consumo do gerador aleatório e em desempates. A busca no catálogo usa ID, nunca a posição do array do snapshot.

Não há geração de novos NPCs durante as semanas do motor atual; os NPCs de demonstração são fixtures reproduzíveis e não participam da criação pública. O formato já tem `jogadoresGerados`: identidades próprias de NPCs com prefixo reservado `gerado-`, combinadas com os mesmos deltas de elenco. Isso não implementa geração de jogadores. Fotos/IDs externos de gerados são vazios; um ID Transfermarkt ausente nunca é promovido silenciosamente a gerado.

## Formato persistido

```typescript
{
  versao: 3,
  id, seed, estadoAleatorio, dataAtual, dataInicio,
  identidadeInicial, jogador, clubeInicialId, clubeAtualId,
  ligaId, ligasIds,
  clubesDinamicos: [{
    id, formacaoPreferida, goleiroTitularId, titularesIds, bancoIds,
    reputacao, forcaGeral, forcaAtaque, forcaMeio, forcaDefesa,
    orcamento, forma, moral, fadiga,
    elenco: [{ id, clubeId, idade, overall, potencial, forma, moral,
      condicionamento, fadiga, valorMercado, salario, contratoAte,
      lesionado, lesao, suspensao, statusElenco, estatisticasCarreira }]
  }],
  jogadoresGerados: [],
  temporada, temporadasExternas, mercado, propostas, transferenciasRecentes,
  janelaTransferencias, relacionamentos, decisoes, noticias, eventos,
  objetivos, registros, temporadasAnteriores, ultimaPartidaId, focoTreino, origem
}
```

Campos administrativos `save_version`, `name`, `current_club_id`, `current_league_id`, `game_date`, `updated_at` e JSONB são escritos na mesma instrução SQL. O UUID da linha é independente do ID/seed do simulador.

## Catálogo e compatibilidade

`src/dados/futebol/*.json` continua sendo conteúdo versionado do aplicativo, atualizado somente pela CLI de futebol. A persistência não escreve nesses arquivos nem consulta Transfermarkt. Cada operação lê o catálogo local e combina as identidades com os deltas.

NPC transferido é buscado por ID em todo o catálogo e colocado no clube/posição de elenco que o save determina. Um NPC aposentado não é reinserido só porque ainda existe no snapshot. Se um clube/jogador/liga referenciado desaparecer, o servidor retorna incompatibilidade e preserva a linha no banco. Um clube que mude de liga e invalide o calendário também exige resolução explícita.

Atualizações cadastrais dos snapshots refletem no runtime carregado. Mudanças estáticas que influenciam regras (posição, reputação de liga, capacidade financeira institucional etc.) podem influenciar a simulação futura; determinismo é garantido com a mesma base e motor. Não se guarda cópia do catálogo para congelar versões antigas. Antes de publicar uma base que remove IDs, é necessário planejar sua compatibilidade com saves existentes.

## Cookie e segurança

O servidor gera 32 bytes criptograficamente aleatórios. Só SHA-256 do token vai em `access_token_hash`; o token fica em cookie `viztto_carreira`, HttpOnly, SameSite=Lax, Path=/, Secure em produção, duração de 365 dias renovada ao carregar. O cookie não contém UUID do banco nem estado da carreira. JavaScript não lê o token.

Rotas:

- `GET /api/carreira`: 404 sem carreira; 200 com runtime/revision; 422 para incompatibilidade.
- `POST`: INSERT ou substituição explicitamente confirmada, condicionada à revisão atual. A substituição faz UPDATE atômico na mesma linha.
- `PUT`: gravação validada, sempre vinculada ao token, nunca a UUID arbitrário.
- `DELETE`: exclusão vinculada a token/revisão; invalida cookie e só então o frontend limpa memória.

Não há parâmetros de identificação por URL. Payloads usam Zod, limites de arrays/textos, datas válidas, enums críticos, IDs e integridade de referências. Chaves perigosas e campos inesperados são rejeitados. O limite de corpo é 16 MiB, contado durante a leitura mesmo sem Content-Length. Respostas são `private, no-store`; não há logs de token, credenciais ou estado. Falhas do banco não retornam stack trace.

Operações mutáveis exigem Origin do mesmo host/protocolo e, quando presente, Sec-Fetch-Site same-origin. A configuração existente do proxy deve encaminhar Host/protocolo corretamente. Nginx/PM2/workflow não foram alterados.

Sem login, o cookie é uma credencial de posse. Limpar cookies ou usar outro dispositivo perde o acesso automático; o registro permanece no PostgreSQL. Não há recuperação de conta nem listagem pública de saves. Futuramente, uma migration pode criar users e adicionar `user_id`; vincular o save exigirá provar posse do token e da conta, sem alterar o motor.

## Autosave e concorrência

Todas as ações do store que mudam a carreira passam por `aplicar`, incluindo notícias lidas. Uma requisição PUT fica ativa; alterações seguintes marcam a geração em memória e, ao confirmar, somente a versão mais recente é enviada. Não há polling ou fila em disco.

O servidor executa UPDATE com condição `access_token_hash + revision` e incrementa revision na mesma operação. Uma atualização antiga recebe 409 e não sobrescreve a nova. Repetição idêntica do último PUT com ACK perdido pode retornar a revisão já confirmada sem gravar novamente. Diferentes abas são protegidas pela revisão, não por uma fila global.

Falhas mantêm o runtime e as alterações pendentes. Há botão de retry, nova tentativa ao voltar online e aviso `beforeunload`. Conflitos bloqueiam novas alterações até carregar o servidor; descartar alterações locais exige confirmação explícita. Não há merge automático entre abas. Carregamento, criação e exclusão aguardam escrita ativa, evitando que um PUT antigo ressuscite uma carreira excluída.

Criar/substituir espera o banco antes de navegar. Excluir espera o banco antes de limpar memória. Falhas preservam a carreira anterior. Uma falha após COMMIT mas antes da resposta pode requerer recarregar o servidor; nunca é resolvida forçando uma revisão nova. POST inicial cuja resposta/cookie se perca pode deixar uma linha órfã, sem expor acesso público.

## Migrations e registros anteriores

`0000_career_saves.sql` permanece intacta. `0001_save_anonimo_revision.sql`, gerada pelo Drizzle Kit, adiciona:

- `access_token_hash text NULL` com unicidade (também fornece o índice de busca do token);
- `revision integer NOT NULL DEFAULT 0`.

Não há DROP, reset, push de schema ou recriação. Linhas antigas recebem revision 0, mantêm state/UUID/metadados e token nulo. Não são apagadas nem associadas automaticamente a qualquer navegador. Precisam de procedimento administrativo explícito de conversão/vinculação, fora desta etapa. Saves antigos no navegador também não são lidos/importados automaticamente: esta implementação não oferece fluxo híbrido.

```bash
npm run db:generate -- --name=descricao
npm run db:check
npm run db:migrate
npm run db:studio
```

Não altere `.env`; DATABASE_URL real permanece ignorada. O ambiente de desenvolvimento autorizado usa `127.0.0.1:5433/viztto_dev` por túnel SSH. A migration foi aplicada somente nesse ambiente e em clusters temporários de teste. Produção recebe migrations pelo fluxo de deploy já existente; nenhum deploy foi executado nesta entrega.

O comando de migration usa Drizzle ORM/Postgres.js e funciona sem dependências de desenvolvimento. O banco deve ter armazenamento durável e sobreviver a reinício/deploy; a aplicação não o recria. Configuração de retenção e backups continua responsabilidade operacional.

## Como evoluir

Para cada propriedade nova, rastreie quem a altera e quem a lê. Se vem exclusivamente do cadastro, resolva pelo catálogo. Se muda na simulação, defina schema do delta, serialização e hidratação. Se é derivável, comprove que recomputar não altera ordem/seed/comportamento. Adicione teste de round-trip e do próximo passo de simulação. Mudanças incompatíveis precisam de versão/conversor explícito; tipos TypeScript não substituem validação runtime.

## Como testar

```bash
npm run typecheck
npm test
npm run build
```

A suíte normal não usa o banco configurado do desenvolvedor. Para integrar PostgreSQL, aplique migrations em um banco exclusivamente de teste e execute `npm test` com `VIZTTO_TEST_DATABASE_URL` apontando para ele. Os testes usam rollback ou excluem apenas linhas dos tokens que criaram. Nunca aponte essa variável para produção.

Há testes de serialização sem catálogo, round-trip determinístico, transferência/aposentadoria/evolução, referências ausentes, validação, acesso por token, cookie, same-origin, tamanho, revisões, substituição, exclusão, erros e reload com descarte completo do Zustand. O relatório da entrega registra a execução real e o tamanho medido.

## Limites operacionais

A API aceita até 16 MiB por requisição. Um proxy externo pode ter limite menor e recusar o corpo antes de chegar ao Next; sua configuração não está neste escopo e não foi alterada. O save medido com todas as ligas locais tem cerca de 4,8 MB antes da evolução. História acumulada aumenta esse tamanho; ultrapassar o limite produz erro explícito, sem descartar campos.

A fila existe somente em memória. Fechar à força, encerrar o processo ou perder energia antes da confirmação pode perder alterações ainda pendentes; o último save confirmado permanece íntegro. Navegadores podem limitar o aviso de saída, sobretudo no mobile. Não há fallback silencioso.
