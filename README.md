# viztto

Simulador de carreira de jogador de futebol, sem partidas controláveis. Crie um atleta, dispute espaço no elenco, escolha treinos e avance semanas em um universo de simulação independente dos resultados reais.

## Iniciar

Requer Node.js 22.12 ou superior e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra [localhost:3000](http://localhost:3000). O Next.js lê os snapshots já existentes; não inicia a API nem scraping.

## Atualizando a base de futebol

A Transfermarkt API local (`API/`, felipeall/transfermarkt-api) precisa conseguir acessar o Transfermarkt no ambiente do desenvolvedor. Requer Python 3 com venv, curl e util-linux (`setsid`/`flock`), além do Node.js. Configure `TRANSFERMARKT_API_URL=http://127.0.0.1:8000` ou `http://localhost:8000` no `.env` da raiz.

```bash
npm run atualizar-dados-futebol
```

Esse é o único fluxo oficial de atualização. O comando carrega o `.env`, reutiliza a API local ou inicia `API/iniciar.sh`, sem subir Next.js. Ao terminar ou receber SIGINT/SIGTERM, encerra apenas os processos que iniciou. Atualiza as 13 ligas **sequencialmente**, usando o importador e os normalizadores existentes.

Os resultados são escritos primeiro em `src/dados/futebol/.staging/`. Cada liga só substitui o JSON oficial após validar schema, edição e pelo menos dois clubes válidos. Falhas totais preservam o snapshot anterior, com aviso explícito; resultados parciais publicam somente clubes atualizados e válidos. O comando continua após falhas e retorna código 1 se houver problemas. Staging com falhas permanece disponível para diagnóstico; não entra no Git.

Revise o resumo e os JSONs em `src/dados/futebol/`. Depois, execute manualmente:

```bash
git add src/dados/futebol
git commit -m "data: atualizar base de futebol"
git push origin main
```

**Produção não faz scraping em tempo real.** Instalação, build, inicialização e requests públicos apenas consomem os arquivos recebidos pelo Git. O endpoint de importação foi removido. `GET /api/futebol/ligas` lista snapshots utilizáveis; `GET /api/futebol?liga=<id>` lê os clubes ou retorna 404. Sem dados, a opção não aparece.

O catálogo e os códigos verificados estão em [documentacao/BASE-FUTEBOL.md](documentacao/BASE-FUTEBOL.md). Não há manifesto obrigatório: os próprios JSONs são a fonte única de disponibilidade. `npm run api` continua disponível apenas para diagnóstico da API local.

## O que está implementado

- Criação em seis etapas: identidade, jogador, estilo, liga, clube e confirmação.
- 13 ligas configuradas centralmente, incluindo divisões secundárias; seleção condicionada aos snapshots disponíveis.
- Base aos 15/16 anos, profissional aos 17+, promoção por avaliação e encerramento do ciclo da base aos 20.
- Calendários separados para base e profissional, turno e returno e suporte a quantidade ímpar de clubes.
- Simulação de todos os jogos da liga, tabela e resultados por rodada.
- Escalação, minutos, estatísticas por posição, notas e cronologia compatível com o placar.
- Treino semanal, evolução por atributo, condicionamento, fadiga, lesões, suspensão, moral e confiança.
- Contratos, renovação, propostas entre clubes da liga importada e transferências.
- Notícias, caixa de entrada por remetente, objetivos, eventos e histórico estatístico.
- Encerramento e início de temporadas seguintes sem apagar a história.
- Save automático no PostgreSQL, Zustand em memória, continuar, excluir e reiniciar.
- Interface responsiva com nove áreas da carreira e pós-jogo.

## Como jogar

1. Abra **Nova carreira**, preencha o atleta e escolha a liga.
2. Escolha uma liga disponível na base local e veja os clubes com elencos válidos.
3. Selecione o clube e confirme. Uma carreira existente só é substituída após marcar a confirmação.
4. Em **Treinamento**, escolha o foco. Alterar o foco não executa treinos: eles ocorrem ao avançar a semana.
5. Em **Início**, clique em **Avançar semana**. Confira o resumo e acompanhe os outros resultados em **Competição**.
6. Consulte **Mercado** para aceitar ou rejeitar ofertas e renovações.
7. Ao acabar a liga, clique em **Próxima temporada**.
8. As configurações da carreira permitem reiniciar ou excluir com confirmação.

O progresso é armazenado no PostgreSQL. Um cookie HttpOnly identifica anonimamente a carreira deste navegador; limpar esse cookie perde o acesso automático, mas não apaga o registro no banco. Não há contas ou sincronização entre dispositivos. Aguarde a indicação de progresso salvo antes de fechar a página.

## Persistência PostgreSQL

Configure `DATABASE_URL` no ambiente do servidor ou no `.env` da raiz. O exemplo em `.env.example` é fictício. Com um banco PostgreSQL já provisionado:

```bash
npm run db:check
npm run db:migrate
```

Migrations são geradas em desenvolvimento com `npm run db:generate -- --name=nome_da_alteracao`. `npm run db:studio` abre a ferramenta de inspeção apenas em loopback. O jogo acessa o banco pela API de carreira. Migrations não são executadas em requests ou no build; o deploy aplica migrations antes de reiniciar a aplicação. Consulte [documentacao/POSTGRESQL.md](documentacao/POSTGRESQL.md) para schema, deploy e validação.

## Base inicial e simulação

Os snapshots definem os clubes e elencos no início da carreira: Brasil 2026 e Europa 2026/27. A edição brasileira usa `seasonId=2025` internamente no Transfermarkt; o ano exibido no jogo continua 2026. Depois da criação, o universo evolui no save e não volta a sincronizar com a API. Overall e potencial são gerados pelo jogo.

## Comandos de verificação

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:watch` executa os testes em observação. O motor pode ser testado sem React, navegador ou API.

## Tecnologias e arquitetura

Next.js App Router, React, TypeScript strict, Tailwind CSS 4, Zustand em memória, Drizzle/PostgreSQL, Zod, Lucide React e Vitest. Fontes Barlow e Barlow Condensed servidas localmente, com licença OFL em `public/fontes/LICENCA.txt`.

```text
src/
  app/                        Rotas, layout e endpoints de leitura local
  componentes/                Interface e interação do jogo
  dominio/                    Entidades, JogadorMundo, formação, ligas
  aplicacao/casos-de-uso/      Criação, avanço e transição de temporadas
  simulacao/                  Partidas, elenco, mundo, mercado, decisões
  infraestrutura/transfermarkt/ Cliente, importação e normalização
  infraestrutura/persistencia/ Serialização v3, hidratação, catálogo e cliente HTTP
  infraestrutura/banco/       PostgreSQL server-only e repositório de saves
  estado/                     Zustand e ponte para casos de uso
  dados/                      Demonstração e JSON importados
  utilitarios/                Seed, datas e formatação
```

Leia [ARQUITETURA.md](ARQUITETURA.md) para decisões e limites.

## Limites deliberados (fase 2)

O mundo pode carregar várias ligas importadas em paralelo (liga do jogador detalhada; demais intermediárias). As divisões secundárias disponíveis também participam do mundo, sem promoção/rebaixamento nesta fase. Mercado NPC↔NPC e propostas ao usuário usam necessidade/orçamento/reputação; janelas verão/inverno. Treinador e agente existem com decisões condicionais — ainda sem troca completa de técnico nem geração mundial de jovens.

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
