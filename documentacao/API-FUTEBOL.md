# Integração API-Football usada pelo viztto

## Escopo

A API importa somente a identidade do mundo inicial. O viztto usa nomes, siglas, país, fundação, escudos, nome do estádio e datas da temporada. Nomes de exibição das seis ligas permanecem localizados em português na configuração do jogo; seus IDs são verificados contra os registros do provedor.

Endpoints externos utilizados:

- `GET /leagues?id=ID&season=ANO`: datas da edição inicial configurada: Brasileirão 2026, ligas europeias 2025/2026 (parâmetro 2025).
- `GET /teams?league=ID&season=ANO`: identidade dos clubes e estádio, sem consulta adicional a `/venues`.
- CDN público `https://media.api-sports.io/football/teams/ID.png`: escudos.

Não são consultados fixtures, resultados, classificações, estatísticas, apostas, jogadores reais ou transferências reais. Esses dados não são necessários ao funcionamento atual do site. O motor determina o futuro da carreira.

## Credencial e contrato externo

A credencial `API_FOOTBALL_CHAVE` é lida no servidor e enviada apenas ao host fixo `v3.football.api-sports.io` no header `x-apisports-key`. O CDN de imagens não recebe a chave. Não há URL de destino fornecida pelo usuário.

Zod valida o envelope e os campos usados. `errors` é examinado mesmo com HTTP 200. Listas vazias não são mantidas no cache positivo. Um retorno paginado inesperado é rejeitado para não importar uma liga parcial: os endpoints usados não têm navegação por `page` como `/players`. Campos opcionais como código, fundação, logo e estádio podem ser nulos. IDs de liga divergentes e clubes duplicados são rejeitados.

`season` é o ano de início da temporada. As edições são explícitas em `temporadas-iniciais.ts`, sem usar o relógio do servidor ou `current` para trocar a Europa para 2026/2027. Se o plano recusar a edição, o jogo informa a limitação e usa clubes fictícios de demonstração, mantendo o ano correto. Não existe importação alternativa de anos anteriores. Datas de demonstração estão centralizadas; em importações reais prevalece `seasons.start` da API.


## Quota e recuperação

`ClienteApiFutebol` centraliza a política:

- Cache de dados úteis por 24 horas, máximo de 100 entradas por credencial/processo.
- Restrições de temporada em cache por uma hora.
- Deduplicação de consultas idênticas em andamento; retornos clonados para evitar mutação compartilhada.
- Fila por credencial, com no máximo 12 consultas distintas pendentes.
- Leitura de `x-ratelimit-requests-limit`, `x-ratelimit-requests-remaining`, `X-RateLimit-Limit` e `X-RateLimit-Remaining`.
- Intervalo entre chamadas calculado pelo limite por minuto, com margem. Sem header, utiliza 10 chamadas/minuto como padrão conservador.
- Quota diária esgotada bloqueia novas consultas até o próximo dia UTC; esgotamento por minuto pausa novas consultas por pelo menos 60 segundos. Respostas já em cache continuam disponíveis.
- HTTP 429: no máximo três tentativas totais, espera exponencial e `Retry-After` em segundos ou data HTTP. Esperas acima de oito segundos são devolvidas como indisponibilidade temporária em vez de prender a requisição. Após falha, há bloqueio de pelo menos 60 segundos.
- Falha de rede, HTTP 499 ou 5xx: no máximo uma nova tentativa.
- Autenticação, parâmetros, restrição do plano e payload inválido não recebem repetição automática.
- Timeout de 12 segundos por chamada externa. Nenhum erro inclui a chave.

O endpoint público mantém o fallback jogável com aviso da causa. A cota obtida pode ser consultada internamente por `obterCota`; não é exposta ao navegador. A coordenação é por processo, não distribuída. Múltiplas réplicas não compartilham fila nem cache; uma implantação distribuída exigirá um serviço compartilhado de cache/limites, sem alterar o motor do jogo.

## Escudos

O componente usa `GET /api/futebol/escudos/ID`. Isso funciona inclusive com saves anteriores: não exige recriar a carreira.

- IDs exclusivamente numéricos; host e formato do caminho fixos.
- Nenhum redirecionamento remoto é seguido.
- Somente PNG, assinatura binária verificada e limite de 1 MiB também durante leitura do corpo.
- Gravação atômica em `.cache/viztto/escudos`, ignorada pelo versionamento.
- Validade de 30 dias, até 256 imagens; remove as mais antigas quando excede.
- Downloads deduplicados e serializados com intervalo mínimo de 350 ms.
- Falhas de DNS, timeout, 429 e 5xx suspendem downloads novos por 60 segundos.
- Imagens antigas continuam disponíveis se o CDN falhar.
- Cache HTTP de um dia e revalidação em segundo plano pelo navegador/CDN intermediário.
- Primeiro acesso sem imagem disponível retorna 503; o componente mostra siglas em escudo neutro.
- O cache de imagens é descartável e não é banco de dados. Em disco somente leitura, a imagem ainda pode ser servida, mas não será persistida.

O cache reduz dependência do CDN, mas não resolve falhas de DNS da rede quando ainda não existe imagem salva.

## Fontes oficiais consultadas

- Referência: https://www.api-football.com/documentation-v3
- Guia dos endpoints e formatos: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
- Limites e headers: https://www.api-football.com/news/post/how-ratelimit-works
- Estratégia de cache e quota: https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage
- Imagens: https://www.api-football.com/news/post/optimizing-sports-websites-bunnycdn-api-sports-image-storage-guide

A referência interativa não forneceu conteúdo legível ao ambiente de consulta. A implementação foi conferida com os guias oficiais acessíveis, respostas reais de ligas/clubes e testes controlados; não se afirma leitura integral da referência interativa.
