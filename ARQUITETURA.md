# Arquitetura do viztto — fase 4

## Direção das dependências

A interface depende do estado e dos casos de uso. Os casos de uso coordenam o domínio e a simulação. O domínio não importa React, Next.js, Zustand ou localStorage. O motor não faz requisições externas nem lê o relógio do sistema.

```text
Componentes → Zustand → Casos de uso → Simulação → Domínio
                  ↓
        Adaptador de persistência

CLI → Transfermarkt API local → staging → validação → snapshots versionados
Criação → GET /api/futebol/ligas e /api/futebol → snapshots → save da carreira
```

O save (versão 2) guarda o mundo vivo: ligas, clubes, `JogadorMundo`, temporada principal, temporadas externas, decisões, relacionamentos e transferências recentes.

## Determinismo e processamento

`GeradorAleatorio` central. `avancarSemana`:

1. Recupera lesões do usuário e treina.
2. Reescala clubes da liga do jogador (elenco real + usuário) e sincroniza força.
3. Simula rodada detalhada da liga do usuário.
4. Avança ligas externas (nível intermediário).
5. Evolui NPCs (detalhado no clube do usuário; simplificado nas demais).
6. Mercado (janelas, necessidade, NPC↔NPC, propostas ao usuário).
7. Gera decisões condicionais (treinador/agente/médico).
8. Persiste estado aleatório.

## Elenco e força

`JogadorMundo` nasce na hidratação pós-importação (`prepararClubesParaMundo`). Overall/potencial internos. Escalação por slots da formação, compatibilidade posicional e avaliação do treinador. `calcularForcaEscalacao` alimenta o motor de partidas; atributos institucionais do clube são secundários.

## Mundo multi-liga

`EstadoCarreira.ligas` + `temporadasExternas`. Ligas já importadas entram no início da carreira. O catálogo contempla 13 divisões de seis países. `divisao` preserva a hierarquia; não há promoção/rebaixamento. A disponibilidade é centralizada em `base-futebol.ts`.

## Mercado e decisões

Necessidade por posição, reputação e orçamento. Janelas verão/inverno. Transferências entre NPCs durante a janela. Decisões com opções reais alteram relacionamentos, moral e confiança.

## Persistência

O jogo continua usando Zustand persist + localStorage, com validação Zod e migração v1→v2. A fundação PostgreSQL em `infraestrutura/banco/` está isolada e ainda não é chamada pelo estado, pelos casos de uso ou pelas rotas.

`career_saves` guarda o `EstadoCarreira` completo em JSONB, com metadados tipados. O UUID do registro é independente do `id` do domínio (atualmente a seed). `game_date` é `date` mapeada como string `YYYY-MM-DD`. Não há autenticação, usuário fictício, API de saves ou sincronização automática.

Drizzle Kit gera SQL e metadados versionados em `drizzle/`. `npm run db:migrate` aplica somente migrations pendentes pelo migrador do Drizzle ORM, inclusive com dependências apenas de produção. Conexão lazy protegida por `server-only`, reutilizada por processo/hot reload. Build e jogo continuam funcionando sem PostgreSQL. Detalhes e deploy: [documentacao/POSTGRESQL.md](documentacao/POSTGRESQL.md).

## Publicação da base

`atualizar-base.ts` coordena ligas sequencialmente, reaproveitando `importarLiga` com diretório de staging explícito. `salvarDadosLiga` valida e publica por rename atômico. A CLI não altera o diretório global usado pelas rotas. Falhas preservam o snapshot oficial anterior e ficam explícitas no resumo; publicação parcial exclui clubes falhos e placeholders.

`obterLigasDisponiveis` e `obterDadosLigaDisponivel` usam a mesma política de schema, calendário, edição e elenco. As rotas públicas não importam o cliente Transfermarkt. O browser não tem caminho para iniciar scraping.
