# viztto

Simulador de carreira de jogador de futebol, sem partidas controláveis. Crie um atleta, dispute espaço no elenco, escolha treinos e avance semanas em um universo de simulação independente dos resultados reais.

## Iniciar

Requer Node.js 22.12 ou superior e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra [localhost:3000](http://localhost:3000). O comando sobe também a Transfermarkt API em [localhost:8000](http://localhost:8000).

### Transfermarkt API local (sem chave)

`npm run dev` sobe a Transfermarkt API (`API/`) e o Next juntos. Configure só:

```bash
cp .env.example .env   # TRANSFERMARKT_API_URL=http://localhost:8000
npm run dev
```

Na criação de carreira, ao escolher a liga, o jogo importa clubes e elencos automaticamente (salva em `src/dados/futebol/`). Ligas: Brasileirão, Premier League, La Liga, Serie A, Bundesliga e Ligue 1.

Docs da API: http://localhost:8000/docs — para subir só a API: `npm run api`.

## O que está implementado

- Criação em seis etapas: identidade, jogador, estilo, liga, clube e confirmação.
- Seis ligas configuradas centralmente e importação de identidade, escudo e estádio dos clubes.
- Base aos 15/16 anos, profissional aos 17+, promoção por avaliação e encerramento do ciclo da base aos 20.
- Calendários separados para base e profissional, turno e returno e suporte a quantidade ímpar de clubes.
- Simulação de todos os jogos da liga, tabela e resultados por rodada.
- Escalação, minutos, estatísticas por posição, notas e cronologia compatível com o placar.
- Treino semanal, evolução por atributo, condicionamento, fadiga, lesões, suspensão, moral e confiança.
- Contratos, renovação, propostas entre clubes da liga importada e transferências.
- Notícias, caixa de entrada por remetente, objetivos, eventos e histórico estatístico.
- Encerramento e início de temporadas seguintes sem apagar a história.
- Save automático com Zustand persist e localStorage, continuar, excluir e reiniciar.
- Interface responsiva com nove áreas da carreira e pós-jogo.

## Como jogar

1. Abra **Nova carreira**, preencha o atleta e escolha a liga.
2. Aguarde a importação dos clubes. Se a API falhar, a origem dos dados será informada.
3. Selecione o clube e confirme. Uma carreira existente só é substituída após marcar a confirmação.
4. Em **Treinamento**, escolha o foco. Alterar o foco não executa treinos: eles ocorrem ao avançar a semana.
5. Em **Início**, clique em **Avançar semana**. Confira o resumo e acompanhe os outros resultados em **Competição**.
6. Consulte **Mercado** para aceitar ou rejeitar ofertas e renovações.
7. Ao acabar a liga, clique em **Próxima temporada**.
8. As configurações da carreira permitem reiniciar ou excluir com confirmação.

O progresso pertence ao navegador e à origem do site (domínio/porta). Limpar os dados do navegador apaga a carreira. Não há conta, banco de dados ou sincronização entre dispositivos.

## Transfermarkt (bootstrap)

Fonte de clubes e elencos reais via Transfermarkt API local (`API/`):

- `npm run dev` sobe a API e o Next juntos (`TRANSFERMARKT_API_URL`).
- Ao escolher a liga na criação, a importação grava JSON em `src/dados/futebol/`.
- Edições: Brasileirão 2026 / Europa 2026-27.
- Depois que a carreira começa, o universo é um snapshot do viztto — não sincroniza de novo com a API.
- Overall e potencial dos NPCs são gerados pelo jogo (não vêm da API).

Sem chave. Docs da API local: http://localhost:8000/docs

## Comandos de verificação

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:watch` executa os testes em observação. O motor pode ser testado sem React, navegador ou API.

## Tecnologias e arquitetura

Next.js App Router, React, TypeScript strict, Tailwind CSS 4, Zustand persist, Zod, Lucide React e Vitest. Fontes Barlow e Barlow Condensed servidas localmente, com licença OFL em `public/fontes/LICENCA.txt`.

```text
src/
  app/                        Rotas, layout e endpoint de importação
  componentes/                Interface e interação do jogo
  dominio/                    Entidades, JogadorMundo, formação, ligas
  aplicacao/casos-de-uso/      Criação, avanço e transição de temporadas
  simulacao/                  Partidas, elenco, mundo, mercado, decisões
  infraestrutura/transfermarkt/ Cliente, importação e normalização
  infraestrutura/persistencia/ Adaptador local e validação do save (v2)
  estado/                     Zustand e ponte para casos de uso
  dados/                      Demonstração e JSON importados
  utilitarios/                Seed, datas e formatação
```

Leia [ARQUITETURA.md](ARQUITETURA.md) para decisões e limites.

## Limites deliberados (fase 2)

O mundo pode carregar várias ligas importadas em paralelo (liga do jogador detalhada; demais intermediárias). Há Série B no catálogo para promoção/rebaixamento futuro. Mercado NPC↔NPC e propostas ao usuário usam necessidade/orçamento/reputação; janelas verão/inverno. Treinador e agente existem com decisões condicionais — ainda sem troca completa de técnico nem geração mundial de jovens.

Não há Champions/Libertadores/seleção/vida pessoal nesta etapa.

### Edição inicial da carreira

Novas carreiras começam na data de início da edição: Brasileirão 2026 ou Europa 2026/27. Após isso, calendários, resultados e anos seguintes são simulados.

## Mercado e agente (fase 3)

A tela **Mercado** reúne **Interesses**, **Propostas**, **Meu Agente** e **Histórico**. O agente pode contatar um clube escolhido, buscar opções conforme suas preferências ou receber um pedido privado de saída. Tornar esse pedido público afeta a relação com a diretoria e o treinador.

Propostas ao jogador não dependem de sorteio semanal. O motor considera necessidade por posição, concorrência, lesões longas, minutos, desempenho, reputação, potencial percebido e finanças. A observação evolui semanalmente até sondagem, negociação entre clubes e oferta contratual. Jogadores já conhecidos podem entrar com relatórios anteriores; não existe bloqueio artificial do primeiro mês. Más atuações ou lesões podem esfriar o interesse.

É possível negociar salário, duração, papel e cláusula. O clube responde na semana seguinte, podendo aceitar os termos, contrapropor ou abandonar. Há no máximo três rodadas; aceitar os termos conclui a assinatura. O papel prometido gera expectativas de minutos, sem garantir escalação.

O jogo mantém suas janelas simplificadas (janeiro–fevereiro e junho–agosto). Fora delas, observação e sondagem continuam. Pré-contratos internacionais podem ser negociados nos últimos 180 dias de vínculo, com chegada após seu término. A resposta “apenas empréstimo” é uma indicação de interesse limitado; esta fase não executa empréstimos. O mercado entre NPCs mantém o motor existente.

Observação, preferências, ofertas, contrapropostas e diário são persistidos. Saves v2 anteriores recebem os campos novos ao carregar. Isso não reconstrói calendários que já estivessem inconsistentes antes das correções de temporada.

Os cenários de regressão estão em `testes/fase-03.test.ts`, além dos testes de temporadas e transferências entre ligas.
