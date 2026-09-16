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

## API-Football

Integração direta com API-Sports v3:

- Edições iniciais fixas: Brasileirão 2026 e ligas europeias 2025/2026.
- `GET /leagues?id=ID&season=ANO`: consulta as datas da edição escolhida (2026 no Brasil, 2025 na Europa).
- `GET /teams?league=ID&season=ANO`: importa os clubes da liga selecionada.
- O navegador acessa apenas `GET /api/futebol?liga=ID_INTERNO`.
- Respostas validadas com Zod, timeout de 12 segundos por tentativa e cache em memória de 24 horas para respostas úteis.
- Consultas iguais são deduplicadas; a fila respeita os limites retornados nos headers. Falhas transitórias têm tentativas limitadas, com espera progressiva e respeito a `Retry-After`.
- Restrições de temporada ficam memorizadas por uma hora, evitando repetir consultas recusadas pelo plano.
- Erros, ausência de chave e limites do plano levam ao modo demonstração identificado.
- Se o plano não cobrir a edição inicial, mostramos a limitação e usamos somente clubes fictícios de demonstração nessa mesma edição. Nunca importamos clubes de anos anteriores.
- Nenhum resultado real alimenta a simulação. Depois da criação, o jogo não precisa consultar a API.

Referências: [documentação API-Football](https://www.api-football.com/documentation-v3), [consulta de clubes por liga](https://www.api-football.com/news/post/how-to-get-all-teams-and-their-ids), [instalação do Next.js](https://nextjs.org/docs/app/getting-started/installation).

Escudos são servidos por `/api/futebol/escudos/ID`, com cache local em `.cache/viztto/escudos` por 30 dias (até 256 imagens, 1 MiB por imagem). O servidor valida PNG, deduplica downloads e reaproveita a imagem antiga se a atualização falhar. Na primeira consulta sem acesso ao CDN, aparece um escudo neutro com o código do clube. O cache não contém saves e pode ser apagado; em hospedagens com disco efêmero ele é perdido ao reiniciar. As forças, finanças e qualidade da base são geradas pelo viztto a partir de liga e identidade, **não são um ranking oficial ou uma avaliação fiel dos clubes reais**.

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
  dominio/                    Entidades, configuração de ligas e regras
  aplicacao/casos-de-uso/      Criação, avanço e transição de temporadas
  simulacao/                  Partidas, evolução, treinos, mercado e eventos
  infraestrutura/transfermarkt/ Cliente, importação e normalização Transfermarkt
  infraestrutura/persistencia/ Adaptador local e validação do save
  estado/                     Zustand e ponte para casos de uso
  dados/                      Clubes fictícios de demonstração
  utilitarios/                Seed, datas e formatação
```

Leia [ARQUITETURA.md](ARQUITETURA.md) para decisões e limites desta versão.

## Limites deliberados da fase 1

O mundo ativo contém a liga escolhida. As outras cinco são opções de início; não são importadas nem simuladas em segundo plano. Transferências são imediatas entre clubes desse mundo, sem janelas ou negociação nesta etapa. Não há elenco nominal completo de terceiros: concorrência e necessidade são abstraídas por força do setor. A base usa uma competição Sub-20 simplificada com os mesmos clubes.

As regras disciplinares e de classificação são simplificadas e configuráveis; não reproduzem todos os regulamentos nacionais. Não há copas, seleções, acesso/rebaixamento, empréstimos, vida pessoal ou aposentadoria automática. Contrato vencido sem acordo gera vínculo provisório de 90 dias com redução salarial, evitando encerrar a jogabilidade antes de existir um sistema de agentes livres. A carreira continua depois dos 40 anos, com declínio, até uma futura implementação de aposentadoria.

A importação com credencial real deve ser verificada com uma chave e plano válidos. Testes automatizados usam respostas controladas e não consomem a cota da API.

Detalhes da integração e fontes oficiais: [documentacao/API-FUTEBOL.md](documentacao/API-FUTEBOL.md).

### Edição inicial da carreira

Novas carreiras começam na data de início da edição: Brasileirão 2026 ou Europa 2025/2026. Após isso, calendários, resultados e anos seguintes são simulados. A temporada europeia é armazenada pelo ano inicial e exibida com os dois anos. Saves anteriores não são reescritos: crie uma nova carreira para usar esta configuração. Reiniciar um save antigo preserva sua edição original.
