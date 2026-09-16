# Arquitetura do viztto — fase 2

## Direção das dependências

A interface depende do estado e dos casos de uso. Os casos de uso coordenam o domínio e a simulação. O domínio não importa React, Next.js, Zustand ou localStorage. O motor não faz requisições externas nem lê o relógio do sistema.

```text
Componentes → Zustand → Casos de uso → Simulação → Domínio
                  ↓
        Adaptador de persistência

Criação → GET/POST /api/futebol → Transfermarkt API local (bootstrap)
         → snapshot em src/dados/futebol + save da carreira
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

`EstadoCarreira.ligas` + `temporadasExternas`. Ligas já importadas entram no início da carreira. Série B (`brasileirao-b`) está no catálogo para promoção/rebaixamento futuro.

## Mercado e decisões

Necessidade por posição, reputação e orçamento. Janelas verão/inverno. Transferências entre NPCs durante a janela. Decisões com opções reais alteram relacionamentos, moral e confiança.

## Persistência

Zustand persist + validação Zod com migração v1→v2. Não há banco de dados.
