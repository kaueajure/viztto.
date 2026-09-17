# Arquitetura do viztto — fase 5

## Direção das dependências

A interface depende do estado e dos casos de uso. Os casos de uso coordenam o domínio e a simulação. O domínio não importa React, Next.js, Zustand ou localStorage. O motor não faz requisições externas nem lê o relógio do sistema.

```text
Componentes → Zustand → Casos de uso → Simulação → Domínio
                  ↓
        Serialização → API de carreira → PostgreSQL

CLI → Transfermarkt API local → Ratings Bot Python → matching → normalização → resolver → Rating Engine → staging → validação → snapshots versionados
Criação → GET /api/futebol/ligas e /api/futebol → snapshots → save da carreira
```

Providers de ratings e Transfermarkt só entram no importador (`npm run atualizar-dados-futebol`). Runtime e rotas públicas leem snapshots locais; ver `documentacao/BASE-FUTEBOL.md`.

O runtime (versão 2) contém o mundo vivo: ligas, clubes, `JogadorMundo`, temporadas, decisões, relacionamentos e transferências. O formato persistido v3 guarda suas referências e partes dinâmicas.

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

PostgreSQL é a fonte de verdade. Zustand contém somente o `EstadoCarreira` runtime (v2), sem middleware de persistência. A API `/api/carreira` identifica o save por hash de um token aleatório em cookie HttpOnly, nunca por UUID enviado pelo cliente.

`serializarCarreira` produz `EstadoCarreiraPersistido` v3: IDs de ligas, clubes e NPCs, mais os deltas e todo o restante dinâmico do mundo. `hidratarCarreira` combina esses dados com o catálogo dos snapshots, resolve referências e valida o resultado. Elencos são reconstruídos na ordem do save, preservando transferências e aposentadorias. Entidades ausentes causam incompatibilidade explícita.

Autosave tem uma única escrita ativa por instância e agrupa alterações intermediárias. `revision` condiciona o UPDATE atômico no banco; conflitos entre abas não sobrescrevem progresso. Criação/substituição/exclusão aguardam confirmação do banco. Falhas mantêm alterações em memória com retry e aviso antes de sair. Não há fallback de armazenamento no navegador.

Schema, migrations, classificação dos campos, cookie, testes e limites: [documentacao/POSTGRESQL.md](documentacao/POSTGRESQL.md).

## Publicação da base

`atualizar-base.ts` coordena ligas sequencialmente, reaproveitando `importarLiga` com diretório de staging explícito. `salvarDadosLiga` valida e publica por rename atômico. A CLI não altera o diretório global usado pelas rotas. Falhas preservam o snapshot oficial anterior e ficam explícitas no resumo; publicação parcial exclui clubes falhos e placeholders.

`obterLigasDisponiveis` e `obterDadosLigaDisponivel` usam a mesma política de schema, calendário, edição e elenco. As rotas públicas não importam o cliente Transfermarkt. O browser não tem caminho para iniciar scraping.
