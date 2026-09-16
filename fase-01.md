# PROJETO: VIZTTO

Quero que você desenvolva do zero um jogo web chamado **viztto**, utilizando **Next.js, TypeScript e Tailwind CSS**.

O viztto será um **simulador realista de carreira de jogador de futebol**, sem partidas controláveis em tempo real.

O jogador cria seu atleta e vive toda a carreira dele através de simulação: categorias de base, treinamentos, escalações, partidas simuladas, desempenho, evolução, contratos, transferências, lesões, reputação, competições, estatísticas, temporadas e aposentadoria.

A inspiração conceitual e visual pode vir de:

* EA Sports FC / antigo FIFA Career Mode
* eFootball / PES
* Football Manager
* interfaces de transmissões esportivas
* softwares profissionais de análise de futebol

Essas referências servem apenas como direção de design e experiência. **Não copie interfaces, artes, logos de interface ou assets proprietários desses jogos.**

O produto deve parecer um **jogo de futebol profissional**, e NÃO:

* um SaaS;
* um dashboard empresarial;
* uma landing page de startup;
* uma interface genérica criada por IA;
* um projeto cheio de cards arredondados, gradientes roxos e glassmorphism.

---

# 1. OBJETIVO DESTA PRIMEIRA IMPLEMENTAÇÃO

Nesta primeira etapa, quero uma **vertical slice completa e funcional** do viztto.

Não quero apenas mockups.

O usuário deve conseguir:

1. abrir o jogo;
2. iniciar uma nova carreira;
3. criar um jogador;
4. selecionar idade inicial;
5. escolher posição e características;
6. escolher uma das ligas disponíveis;
7. escolher um clube real carregado da API;
8. começar na base se tiver 15 ou 16 anos;
9. começar no elenco profissional se tiver 17 anos ou mais;
10. avançar semanas;
11. treinar;
12. disputar partidas completamente simuladas;
13. ser titular, reserva ou ficar fora da convocação;
14. receber uma nota de desempenho;
15. marcar gols;
16. dar assistências;
17. receber cartões;
18. sofrer lesões;
19. ganhar ou perder confiança do treinador;
20. evoluir atributos;
21. acompanhar a tabela da liga;
22. acompanhar resultados dos outros clubes;
23. acompanhar estatísticas da temporada;
24. receber notícias e acontecimentos;
25. receber propostas de outros clubes;
26. aceitar ou rejeitar propostas;
27. renovar contrato;
28. terminar uma temporada;
29. começar a temporada seguinte;
30. continuar a carreira por várias temporadas.

O sistema precisa ser realmente jogável.

---

# 2. REGRA FUNDAMENTAL: NÃO USAR BANCO DE DADOS

NESTA ETAPA NÃO EXISTE BANCO DE DADOS.

Não instalar nem configurar:

* PostgreSQL;
* MySQL;
* SQLite;
* MongoDB;
* Prisma;
* Drizzle;
* Supabase;
* Firebase;
* PlanetScale;
* Neon;
* qualquer banco externo.

A arquitetura, entretanto, deve ser criada de maneira que posteriormente seja fácil substituir a persistência local por banco de dados.

Para esta primeira versão, utilizar:

**Zustand + persist middleware + localStorage**

para salvar a carreira no navegador.

O usuário deve conseguir fechar a página, abrir novamente e continuar a carreira.

Também deve existir:

* Nova carreira;
* Continuar carreira;
* Excluir carreira;
* Reiniciar carreira.

Nunca acople regras do jogo diretamente ao localStorage.

Crie uma abstração de persistência.

---

# 3. IDIOMA E ARQUITETURA DO CÓDIGO

Toda a arquitetura criada por nós deve estar em **português do Brasil**.

Utilizar português para:

* nomes de componentes;
* entidades;
* interfaces de domínio;
* funções;
* variáveis;
* casos de uso;
* serviços;
* enums;
* tipos;
* stores;
* arquivos;
* pastas de domínio;
* comentários;
* documentação;
* mensagens internas.

Exemplos:

`Jogador`

`Clube`

`Liga`

`Partida`

`Temporada`

`Contrato`

`PropostaTransferencia`

`Lesao`

`EventoCarreira`

`simularPartida()`

`calcularNotaJogador()`

`calcularEvolucao()`

`gerarCalendarioLiga()`

`processarTreinamento()`

`useJogoStore`

`motor-simulacao.ts`

`servico-carreira.ts`

`gerador-calendario.ts`

`CartaoJogador.tsx`

`PainelProximaPartida.tsx`

Não usar nomes como:

`PlayerService`

`MatchEngine`

`CareerManager`

`TeamCard`

quando o código for nosso.

## Exceção

Não traduza arquivos ou convenções obrigatórias do Next.js.

Portanto, mantenha normalmente:

`src/app`

`page.tsx`

`layout.tsx`

`route.ts`

`loading.tsx`

`error.tsx`

`package.json`

`.env.local`

e nomes exigidos por bibliotecas externas.

Identificadores de código devem ser escritos em português sem acentos quando necessário:

`calcularDesempenho`

e não:

`calcularDesempenhoDoPlayer`

---

# 4. TECNOLOGIAS

Utilizar:

* Next.js com App Router;
* TypeScript em modo strict;
* React;
* Tailwind CSS;
* Zustand;
* Zod para validação de dados externos;
* Lucide React para ícones;
* date-fns se necessário;
* Vitest para testes das regras principais.

Evitar adicionar bibliotecas sem necessidade.

Não utilizar uma biblioteca visual pronta que deixe o projeto com aparência genérica.

Principalmente, não quero simplesmente instalar shadcn/ui e utilizar todos os componentes no estilo padrão.

Os componentes principais devem possuir identidade visual própria do viztto.

---

# 5. ESTRUTURA DE PASTAS

Quero separação clara entre domínio, aplicação, infraestrutura, simulação e interface.

Utilize uma estrutura próxima de:

```text
src/
├── app/
│   ├── page.tsx
│   ├── nova-carreira/
│   │   └── page.tsx
│   ├── carreira/
│   │   ├── page.tsx
│   │   ├── jogador/
│   │   ├── calendario/
│   │   ├── competicao/
│   │   ├── clube/
│   │   ├── treinamento/
│   │   ├── mercado/
│   │   ├── noticias/
│   │   └── historico/
│   └── api/
│       └── futebol/
│
├── componentes/
│   ├── jogo/
│   ├── jogador/
│   ├── clube/
│   ├── partida/
│   ├── navegacao/
│   └── interface/
│
├── dominio/
│   ├── entidades/
│   ├── tipos/
│   ├── enums/
│   ├── regras/
│   └── constantes/
│
├── aplicacao/
│   ├── casos-de-uso/
│   └── servicos/
│
├── simulacao/
│   ├── partida/
│   ├── carreira/
│   ├── temporada/
│   ├── evolucao/
│   ├── transferencias/
│   ├── treinamento/
│   └── eventos/
│
├── infraestrutura/
│   ├── api-futebol/
│   └── persistencia/
│
├── estado/
│
├── dados/
│
└── utilitarios/
```

Essa estrutura pode ser refinada se houver uma alternativa arquitetural melhor, mas preserve:

**domínio separado de interface e infraestrutura.**

Não coloque motor de simulação dentro de componentes React.

---

# 6. API DE FUTEBOL

Utilizar inicialmente:

**API-Football / API-Sports**

Base:

`https://v3.football.api-sports.io`

A chave será configurada através de:

```env
API_FOOTBALL_CHAVE=
```

Criar também:

`.env.example`

Nunca expor essa chave para o navegador.

Todos os requests devem sair do servidor Next.js.

Criar uma camada:

```text
infraestrutura/api-futebol/
```

com uma interface equivalente conceitualmente a:

```ts
interface ProvedorDadosFutebol {
    buscarLigas(): Promise<LigaExterna[]>
    buscarClubes(idLiga: number, temporada: number): Promise<ClubeExterno[]>
}
```

A aplicação não deve depender diretamente da API-Football.

Assim, futuramente será possível trocar o provedor.

---

# 7. LIGAS INICIAIS

Nesta primeira versão disponibilizar:

* Brasileirão Série A;
* Premier League;
* La Liga;
* Serie A italiana;
* Bundesliga;
* Ligue 1.

Centralizar configuração dessas competições.

Não espalhar IDs da API pelo projeto.

Criar algo semelhante a:

```ts
const LIGAS_SUPORTADAS = [...]
```

Cada liga deve possuir:

* ID interno;
* ID externo;
* nome;
* país;
* bandeira;
* nível de reputação;
* força média;
* quantidade de clubes;
* regras básicas.

Sempre que possível, descobrir a temporada atual consultando a própria API ao invés de assumir simplesmente o ano atual.

---

# 8. DADOS DOS CLUBES

Utilizar a API para obter:

* ID;
* nome;
* código;
* país;
* ano de fundação;
* escudo;
* estádio quando disponível.

Não colocar manualmente uma lista fixa de Manchester City, Liverpool, Flamengo etc.

Os clubes devem vir da API.

Entretanto, informações específicas do SIMULADOR devem pertencer ao viztto.

Exemplo:

```ts
interface Clube {
    id: string
    idExterno: number
    nome: string
    codigo: string
    escudo: string

    reputacao: number
    forcaGeral: number
    forcaAtaque: number
    forcaMeio: number
    forcaDefesa: number
    qualidadeBase: number
    poderFinanceiro: number
}
```

A API fornece a identidade real.

O nosso motor fornece os atributos necessários para o jogo.

---

# 9. NÃO DEPENDER DA API PARA SIMULAR A CARREIRA

Esse ponto é extremamente importante.

A API NÃO deve decidir o futuro da carreira.

Ela é utilizada para importar o mundo inicial.

Depois que a carreira começar:

**o universo pertence ao motor do viztto.**

Portanto:

API:

```text
clubes
ligas
nomes
escudos
informações básicas
```

Viztto:

```text
calendário
partidas
resultados
classificação
evolução
transferências
contratos
lesões
temporadas futuras
história da carreira
```

Não consultar resultados reais da temporada para decidir partidas simuladas.

Se o jogador estiver em 2034, a carreira deve continuar normalmente mesmo sem dados reais da API para 2034.

---

# 10. FALLBACK DA API

O projeto não pode quebrar completamente caso:

* não exista chave;
* a API esteja indisponível;
* o limite gratuito seja atingido;
* uma requisição falhe.

Criar tratamento de erro apropriado.

Em desenvolvimento, pode existir um pequeno conjunto local de dados de demonstração.

Entretanto:

**API real deve ser o caminho principal.**

Exibir mensagem clara quando os dados forem fallback.

Nunca inventar silenciosamente que dados simulados vieram da API.

---

# 11. CRIAÇÃO DO JOGADOR

Criar uma experiência de criação de carreira com várias etapas.

Perguntar:

* nome;
* sobrenome;
* nacionalidade;
* idade inicial;
* posição principal;
* posição secundária;
* pé dominante;
* altura;
* peso;
* estilo/arquetipo de jogador;
* liga inicial;
* clube inicial.

Idade mínima:

**15 anos.**

Regra:

```text
15 anos → categoria de base
16 anos → categoria de base
17+ → elenco profissional
```

Isso deve ser uma REGRA DE DOMÍNIO e não apenas uma condição visual.

---

# 12. POSIÇÕES

Suportar pelo menos:

* Goleiro;
* Lateral direito;
* Zagueiro;
* Lateral esquerdo;
* Volante;
* Meio-campista central;
* Meia ofensivo;
* Ponta direita;
* Ponta esquerda;
* Centroavante.

Cada posição deve possuir pesos diferentes para calcular overall e desempenho.

Por exemplo:

Centroavante valoriza mais:

* finalização;
* posicionamento;
* velocidade;
* cabeceio;
* compostura.

Zagueiro valoriza mais:

* marcação;
* desarme;
* força;
* posicionamento defensivo;
* jogo aéreo.

Nunca calcular overall como uma simples média de todos os atributos.

---

# 13. ATRIBUTOS

Criar sistema de atributos de 1 a 99.

Organize-os em grupos.

## Técnicos

* finalização;
* passe curto;
* passe longo;
* cruzamento;
* drible;
* domínio;
* cabeceio;
* desarme;
* marcação.

## Físicos

* aceleração;
* velocidade;
* força;
* resistência;
* impulsão;
* agilidade.

## Mentais

* visão;
* posicionamento;
* compostura;
* decisão;
* antecipação;
* concentração;
* agressividade.

## Goleiro

* reflexos;
* posicionamento;
* defesa;
* saída;
* reposição.

Não mostrar necessariamente todos os valores internos ao jogador o tempo todo.

---

# 14. POTENCIAL

Todo jogador criado deve possuir um potencial interno.

Por exemplo:

```ts
overallAtual: 61
potencialInterno: 86
```

Porém, NÃO mostrar:

`Potencial: 86`

diretamente.

Exibir avaliações vagas:

* potencial limitado;
* pode se tornar um bom jogador;
* grande promessa;
* uma das principais promessas da geração.

O potencial não deve significar destino garantido.

Um jogador com potencial 90 pode nunca chegar a 90.

A evolução depende de:

* idade;
* partidas;
* minutos;
* desempenho;
* treinamento;
* lesões;
* moral;
* profissionalismo;
* nível do clube;
* qualidade da base;
* regularidade.

---

# 15. PERSONALIDADE

Gerar características internas como:

* profissionalismo;
* ambição;
* lealdade;
* disciplina;
* temperamento;
* adaptabilidade;
* liderança.

Esses valores podem ser parcialmente escondidos.

Eles devem afetar acontecimentos da carreira.

---

# 16. ESTADO ATUAL DO JOGADOR

Manter:

* overall;
* moral;
* forma;
* condicionamento;
* fadiga;
* ritmo de jogo;
* confiança do treinador;
* reputação;
* valor de mercado;
* salário;
* status no elenco;
* contrato;
* lesões.

Escalas como 0–100 podem ser usadas internamente.

---

# 17. STATUS NO ELENCO

Possíveis estados:

* categoria de base;
* promessa;
* reserva;
* rotação;
* titular;
* jogador importante;
* estrela do time.

O status deve mudar organicamente.

Não deixar o jogador permanentemente titular só porque é o usuário.

O técnico deve poder colocar o usuário no banco.

---

# 18. CATEGORIAS DE BASE

Se começar aos 15 ou 16:

o jogador NÃO deve entrar automaticamente no time principal.

Criar uma experiência específica de base.

Mostrar:

* clube;
* categoria;
* partidas da base;
* desempenho;
* treinos;
* evolução;
* avaliação da comissão técnica;
* possibilidade de promoção.

As partidas da base podem ser uma simulação simplificada usando as categorias dos mesmos clubes.

A promoção para o profissional deve considerar:

* idade;
* overall;
* potencial percebido;
* forma;
* desempenho;
* confiança;
* necessidade do elenco.

Pode acontecer promoção antecipada de um grande talento.

Também pode acontecer de o jogador continuar na base por mais tempo.

---

# 19. MOTOR DE TEMPORADAS

Criar um sistema independente capaz de gerar temporadas.

Cada liga deve ter:

* clubes;
* tabela;
* rodadas;
* jogos;
* pontos;
* vitórias;
* empates;
* derrotas;
* gols pró;
* gols contra;
* saldo;
* posição.

Gerar calendário usando algoritmo adequado de turno e returno.

Não codificar manualmente partidas.

O número de clubes deve ser dinâmico.

---

# 20. MOTOR DE PARTIDAS

Esse é um dos componentes mais importantes.

As partidas NÃO possuem gameplay.

Elas são completamente simuladas.

O resultado NÃO pode ser puro `Math.random()`.

Utilizar fatores como:

```text
força ofensiva
força defensiva
força do meio
mando de campo
forma
fadiga
moral
qualidade relativa
momento da temporada
aleatoriedade controlada
```

Uma boa abordagem é utilizar conceitos semelhantes a distribuição de Poisson para geração de gols.

Não precisa reproduzir modelos estatísticos profissionais perfeitamente, mas deve existir coerência matemática.

Exemplo:

Manchester City x clube muito inferior:

City deve ter probabilidade significativamente maior de vencer.

Mas zebra deve continuar sendo possível.

Não utilizar resultados pré-programados.

---

# 21. ALEATORIEDADE DETERMINÍSTICA

Evite espalhar:

```ts
Math.random()
```

pelo código.

Criar um gerador pseudoaleatório central com seed.

A carreira deve possuir uma seed própria.

Isso facilita:

* debugging;
* testes;
* reprodução de erros;
* consistência.

Criar algo como:

```ts
geradorAleatorio.proximo()
```

Toda simulação importante deve utilizar esse mecanismo.

---

# 22. ESCALAÇÃO DO JOGADOR

Antes de cada partida, calcular:

* titular;
* banco;
* não relacionado;
* lesionado;
* suspenso.

Levar em consideração:

* overall;
* posição;
* concorrência;
* confiança do treinador;
* forma;
* fadiga;
* moral;
* desempenho recente.

Não favorecer artificialmente o jogador humano.

---

# 23. PARTICIPAÇÃO NA PARTIDA

Se titular:

gerar aproximadamente 45–90 minutos dependendo da situação.

Se reserva:

pode:

* não entrar;
* entrar no primeiro tempo em casos excepcionais;
* entrar no segundo tempo.

Registrar:

* minutos;
* gols;
* assistências;
* chutes;
* passes;
* passes-chave;
* desarmes;
* cartões;
* faltas;
* defesas no caso de goleiro;
* nota.

Os números dependem da posição.

Um zagueiro não deve ter estatísticas ofensivas equivalentes às de um atacante.

---

# 24. NOTA DE DESEMPENHO

Escala:

aproximadamente 3.0 até 10.0.

Normal:

6.0–7.0.

Excelente:

8+.

Partida excepcional:

9+.

Evitar distribuir notas 9 e 10 frequentemente.

A nota deve considerar o contexto da posição.

Um zagueiro pode receber 8.5 sem marcar gol.

Um goleiro pode ser melhor da partida.

---

# 25. EVENTOS DAS PARTIDAS

Após simular o resultado geral, gerar uma cronologia compatível.

Exemplo:

```text
14' Gol
28' Cartão amarelo
43' Grande defesa
56' Substituição
71' Gol do jogador
82' Assistência
90+2' Fim
```

A cronologia deve ser consequência do resultado já determinado.

Nunca gerar uma timeline contraditória com o placar.

---

# 26. TELA PÓS-JOGO

Após cada partida mostrar uma experiência parecida com um resumo de transmissão esportiva.

Mostrar:

* placar;
* escudos;
* competição;
* rodada;
* estádio;
* minutos jogados;
* nota;
* gols;
* assistências;
* principais estatísticas;
* eventos;
* impacto na confiança;
* impacto na moral;
* evolução recebida.

Exemplo:

```text
PALMEIRAS 3 × 1 FLUMINENSE

Kauê
82 minutos
1 gol
1 assistência
Nota 8.4

Confiança do treinador +4
Moral +3
Experiência +22
```

---

# 27. TREINAMENTO

A cada semana permitir escolher um foco.

Opções iniciais:

* equilibrado;
* finalização;
* criação;
* drible;
* velocidade;
* físico;
* defesa;
* recuperação.

Treinos devem gerar:

* desenvolvimento;
* fadiga;
* possibilidade pequena de lesão;
* impacto diferente de acordo com idade.

Não permitir treinamento infinito.

---

# 28. EVOLUÇÃO

Não implementar:

```text
jogou partida = +1 overall
```

Isso seria irreal.

Criar pontos internos de desenvolvimento por atributo.

Atributos evoluem individualmente.

Overall é consequência deles.

Jogadores jovens evoluem potencialmente mais rápido.

Depois do auge, evolução desacelera.

Em idades maiores pode ocorrer declínio.

Considerar curvas diferentes por atributo.

Velocidade pode cair antes de visão ou passe, por exemplo.

---

# 29. LESÕES

Criar:

```ts
interface Lesao {
    tipo
    gravidade
    diasRecuperacao
    dataInicio
    dataPrevistaRetorno
}
```

Exemplos:

* desconforto muscular;
* contusão;
* entorse;
* lesão muscular;
* problema no joelho.

Não exagerar na frequência.

Treino pesado + fadiga alta devem aumentar o risco.

---

# 30. CONTRATOS

Todo jogador profissional possui contrato.

Guardar:

* clube;
* salário;
* data de início;
* data de término;
* papel esperado;
* bônus quando necessário.

Mostrar quanto tempo falta.

Clubes devem poder oferecer renovação.

O jogador pode:

* aceitar;
* rejeitar;
* negociar futuramente.

---

# 31. MERCADO DE TRANSFERÊNCIAS

Criar sistema inicial de propostas.

Probabilidade de interesse deve considerar:

* idade;
* overall;
* potencial percebido;
* reputação;
* forma;
* desempenho;
* gols;
* assistências;
* liga atual;
* reputação do clube interessado;
* necessidade da posição;
* valor de mercado.

Não gerar propostas absurdas constantemente.

Um jogador de overall 58 não deve receber proposta do Real Madrid sem uma justificativa extraordinária.

Uma grande temporada deve gerar interesse maior.

---

# 32. VALOR DE MERCADO

Calcular dinamicamente.

Considerar:

* idade;
* overall;
* potencial percebido;
* reputação;
* liga;
* duração contratual;
* desempenho recente;
* posição.

Não utilizar apenas:

`overall × constante`.

---

# 33. CONFIANÇA DO TREINADOR

Escala 0–100.

Eventos positivos:

* bons jogos;
* treinos;
* disciplina;
* objetivos cumpridos.

Negativos:

* atuações ruins;
* comportamento;
* forma ruim;
* lesões prolongadas indiretamente;
* decisões contratuais em determinados contextos.

A confiança influencia escalação.

---

# 34. MORAL

Moral deve ser separada da confiança.

Exemplos:

Jogador:

```text
moral alta
confiança do treinador baixa
```

é possível.

Assim como:

```text
moral baixa
titular absoluto
```

Também é possível.

---

# 35. NOTÍCIAS

Criar sistema de notícias através de templates internos.

NÃO usar OpenAI, Gemini ou outra IA nesta primeira etapa.

Exemplos:

```text
"Jovem atacante ganha espaço no Palmeiras"

"Viztto FC confirma interesse em {jogador}"

"{jogador} marca duas vezes e decide partida"

"{jogador} ficará afastado por três semanas"

"Clube inicia conversas para renovar contrato"
```

Variar textos para evitar repetição.

---

# 36. INBOX

Criar uma área semelhante a uma caixa de entrada de carreira.

Mensagens podem vir de:

* treinador;
* diretoria;
* agente;
* departamento médico;
* imprensa;
* seleção futuramente.

Exemplo:

```text
Treinador

Seu desempenho nos últimos treinamentos tem sido muito bom.
Você começará a próxima partida como titular.
```

---

# 37. OBJETIVOS

Criar objetivos de curto prazo.

Exemplos:

* participar de 5 jogos;
* marcar primeiro gol;
* conseguir primeira assistência;
* atingir determinada confiança;
* tornar-se titular;
* fazer 10 gols na temporada;
* conquistar um título.

Objetivos concedem reputação e acontecimentos, não upgrades absurdos.

---

# 38. ESTATÍSTICAS DA CARREIRA

Guardar permanentemente dentro do save:

por clube;

por temporada;

por competição;

e totais.

Registrar:

* jogos;
* titularidades;
* minutos;
* gols;
* assistências;
* cartões;
* nota média;
* títulos futuramente.

Mostrar histórico por temporada.

Exemplo:

```text
2027 — Palmeiras
32 jogos
13 gols
8 assistências
7.31 nota média
```

---

# 39. HISTÓRICO

Criar uma timeline da carreira.

Exemplo:

```text
2026
Entrou na base do Palmeiras

2027
Promovido ao profissional

2028
Primeiro gol profissional

2029
Transferido para o Benfica

2032
Campeão nacional
```

Eventos importantes devem ser preservados.

---

# 40. MUDANÇA DE TEMPORADA

Ao terminar uma liga:

* definir campeão;
* registrar classificação final;
* salvar estatísticas;
* registrar conquistas;
* atualizar idade quando apropriado;
* ajustar contratos;
* atualizar reputações;
* gerar nova temporada;
* recriar calendário;
* continuar carreira.

O usuário não pode perder os dados históricos.

---

# 41. INTERFACE PRINCIPAL

Depois de criar a carreira, utilizar um layout de jogo.

Sugestão:

barra lateral:

```text
VIZTTO

Início
Jogador
Calendário
Clube
Competição
Treinamento
Mercado
Notícias
Histórico
```

Parte superior:

* temporada;
* data atual;
* clube;
* escudo;
* jogador;
* configurações.

---

# 42. DASHBOARD DA CARREIRA

A tela inicial da carreira deve mostrar informações realmente úteis.

Prioridade visual:

## Próxima partida

```text
Premier League
Rodada 14

Liverpool
vs
Arsenal

sábado
Anfield
```

## Jogador

* foto/avatar abstrato;
* nome;
* idade;
* posição;
* overall;
* forma;
* moral.

## Status

* titular/reserva;
* confiança do treinador;
* condicionamento.

## Temporada

* jogos;
* gols;
* assistências;
* nota média.

## Classificação

mostrar pelo menos região próxima ao clube.

## Notícias

últimos acontecimentos.

## Ação principal

**Avançar semana**

ou:

**Ir para a partida**

---

# 43. DESIGN DO VIZTTO

Essa parte é EXTREMAMENTE importante.

Quero aparência de:

**jogo esportivo premium.**

Não quero aparência de:

**dashboard SaaS criado por IA.**

---

# 44. DIREÇÃO VISUAL

Utilizar predominantemente:

* fundo grafite;
* azul muito escuro;
* preto suave;
* branco;
* cinzas;
* verde de futebol como cor funcional;
* cor de destaque contextual.

Interface densa, elegante e esportiva.

Referências conceituais:

* menus de modo carreira;
* telas de escalação;
* painéis estatísticos esportivos;
* overlays televisivos;
* tabelas de campeonato.

---

# 45. EVITAR

Evitar totalmente o padrão:

```text
card
card
card
card

gradiente roxo
ícone colorido
número grande
texto pequeno
```

Também evitar:

* glassmorphism excessivo;
* blur em tudo;
* sombras gigantes;
* gradientes neon;
* bordas extremamente arredondadas;
* dezenas de badges;
* emojis como ícones;
* aparência de painel financeiro;
* textos genéricos de marketing.

---

# 46. COMPONENTES VISUAIS

Utilizar:

* linhas;
* separadores;
* placares;
* tabelas;
* barras;
* listas;
* escudos;
* números;
* tipografia esportiva;
* hierarquia forte.

Corners podem ser discretos:

aproximadamente 4–10px.

Não transformar cada informação em card separado.

---

# 47. TIPOGRAFIA

Usar fonte legível para textos e uma fonte de personalidade esportiva para:

* números;
* títulos;
* placares;
* overall.

Pode utilizar combinação semelhante a:

* Inter;
* Archivo;
* Barlow;
* Barlow Condensed.

Escolha coerentemente.

---

# 48. LOGOTIPO

Por enquanto não criar um logo gráfico complexo.

Exibir:

`viztto`

em lowercase.

Tipografia forte, moderna e esportiva.

Não criar símbolo aleatório de IA.

---

# 49. RESPONSIVIDADE

Prioridade:

desktop.

Mas deve funcionar corretamente em:

* notebook;
* tablet;
* celular.

No celular, navegação pode virar menu inferior ou drawer.

Não simplesmente reduzir tudo.

Reorganizar conteúdo.

---

# 50. EXPERIÊNCIA DE SIMULAÇÃO

O usuário precisa sentir que existe um mundo acontecendo independentemente dele.

Quando uma rodada ocorre:

não simule somente o jogo do usuário.

Simule todos os jogos daquela liga.

Atualize:

* tabela;
* resultados;
* classificação;
* estatísticas.

O usuário é apenas um jogador dentro do mundo.

Não é o centro absoluto do universo.

---

# 51. EVENTOS EMERGENTES

Criar sistema extensível de eventos.

Exemplos:

* estreia;
* primeiro gol;
* hat-trick;
* sequência ruim;
* retorno de lesão;
* promoção da base;
* perda de titularidade;
* interesse de clube;
* renovação;
* transferência;
* recorde pessoal.

Esses acontecimentos devem alimentar:

* notícias;
* histórico;
* reputação;
* moral.

---

# 52. REPUTAÇÃO

Criar ao menos:

```text
reputacaoJogador
reputacaoClube
reputacaoLiga
```

Pode usar escala interna 0–100 ou 0–1000.

Uma atuação no Brasileirão não necessariamente possui o mesmo impacto global de uma atuação em uma competição europeia de altíssimo nível.

Projetar isso para expansão futura.

---

# 53. ARQUITETURA PREPARADA PARA EXPANSÃO

Embora não seja necessário implementar tudo agora, a arquitetura não pode impedir futuramente:

* Champions League;
* Libertadores;
* Copa do Brasil;
* copas nacionais;
* seleções;
* Copa do Mundo;
* segunda divisão;
* promoção/rebaixamento;
* prêmios individuais;
* treinador com personalidade;
* agentes;
* imprensa;
* redes sociais fictícias;
* patrocínios;
* vida pessoal;
* aposentadoria;
* regeneração de jogadores;
* técnicos;
* clubes mudando de força ao longo das décadas;
* academia de jovens;
* ranking mundial.

Não implementar essas coisas de qualquer maneira agora apenas para dizer que existem.

Prepare arquitetura extensível.

---

# 54. ESTADO GLOBAL DA CARREIRA

Criar objeto central semelhante conceitualmente a:

```ts
interface EstadoCarreira {
    id: string
    seed: string

    dataAtual: string
    temporadaAtual: Temporada

    jogador: Jogador
    clubeAtual: Clube

    ligas: Liga[]
    clubes: Clube[]

    calendario: Partida[]
    classificacoes: ClassificacaoLiga[]

    contratos: Contrato[]
    propostas: PropostaTransferencia[]

    noticias: Noticia[]
    eventos: EventoCarreira[]

    historico: HistoricoCarreira
}
```

Não precisa usar exatamente essa estrutura se houver solução melhor.

---

# 55. PERFORMANCE

Mesmo simulando várias ligas, não fazer processamento absurdo.

Temos aproximadamente pouco mais de 100 clubes inicialmente.

Isso é trivial para um simulador moderno se a arquitetura for eficiente.

Não rodar milhares de timers.

O mundo só precisa avançar quando o jogador clicar para avançar o tempo.

---

# 56. AVANÇAR TEMPO

Criar casos de uso claros:

```ts
avancarDia()
avancarSemana()
simularProximaPartida()
finalizarTemporada()
```

A interface utiliza casos de uso.

Ela não manipula diretamente todas as entidades.

---

# 57. PROCESSAMENTO DE UMA SEMANA

Conceitualmente:

```text
Usuário clica em Avançar Semana
        ↓
processar treinamentos
        ↓
recuperar condicionamento
        ↓
processar lesões
        ↓
processar eventos
        ↓
simular partidas
        ↓
atualizar tabela
        ↓
atualizar estatísticas
        ↓
calcular desempenho do usuário
        ↓
atualizar confiança
        ↓
atualizar moral
        ↓
processar evolução
        ↓
avaliar mercado
        ↓
gerar notícias
        ↓
salvar estado
```

Essa lógica precisa estar centralizada.

---

# 58. TESTES

Criar testes unitários principalmente para:

* cálculo de overall;
* geração de calendário;
* tabela;
* resultado de partidas;
* atualização de classificação;
* evolução;
* determinação de titularidade;
* seed aleatória;
* mudança de temporada.

A simulação precisa ser testável sem React.

---

# 59. DOCUMENTAÇÃO

Criar `README.md` em português.

Explicar:

* projeto;
* tecnologias;
* instalação;
* variáveis de ambiente;
* API-Football;
* arquitetura;
* como iniciar;
* como rodar testes.

Criar também:

`ARQUITETURA.md`

explicando as principais decisões.

---

# 60. QUALIDADE DE CÓDIGO

Obrigatório:

* TypeScript strict;
* não utilizar `any` desnecessariamente;
* funções pequenas;
* regras isoladas;
* evitar duplicação;
* componentes com responsabilidade clara;
* validar dados externos;
* tratar loading;
* tratar erro;
* tratar estados vazios;
* código legível;
* comentários apenas onde agregam contexto;
* nomes claros em português.

Não crie um projeto monolítico com 2 ou 3 arquivos gigantes.

---

# 61. SEGURANÇA

Nunca enviar:

`API_FOOTBALL_CHAVE`

para o cliente.

A API externa só deve ser chamada pelo servidor Next.js.

Não colocar chave em código.

Não colocar chave em arquivos versionados.

---

# 62. PRIMEIRO ACESSO

Tela inicial:

```text
viztto

SUA CARREIRA.
SUA HISTÓRIA.

[NOVA CARREIRA]
[CONTINUAR]
```

Não utilizar textos exageradamente publicitários.

É um jogo.

Se não existir save:

`Continuar` fica desativado.

---

# 63. NOVA CARREIRA

Utilizar uma sequência visual como:

```text
01 IDENTIDADE
02 JOGADOR
03 ESTILO
04 LIGA
05 CLUBE
06 CONFIRMAÇÃO
```

Transições rápidas e elegantes.

Nada infantil.

---

# 64. COMEÇO DA CARREIRA

Ao confirmar:

carregar clube e liga;

criar atributos;

gerar personalidade;

gerar potencial;

criar contrato ou vínculo da base;

gerar calendário;

gerar tabela;

gerar primeira notícia;

gerar primeiro objetivo;

salvar;

redirecionar para:

`/carreira`

---

# 65. CARREIRA DE 15/16 ANOS

Exemplo de primeira tela:

```text
PALMEIRAS

CATEGORIA DE BASE

Kauê
15 anos
PD

Overall 56

STATUS
Promessa da base

Próxima partida
Palmeiras Sub-17 x Santos Sub-17

Avaliação do treinador
"Tem demonstrado potencial, mas ainda precisa evoluir fisicamente."
```

---

# 66. CARREIRA PROFISSIONAL

Exemplo:

```text
PALMEIRAS

Kauê
18 anos
PD
Overall 69

STATUS
Rotação

Confiança do treinador
68

Brasileirão
6º lugar

Próxima partida

Palmeiras
x
Internacional
```

---

# 67. SIMULAÇÃO NÃO DEVE SER ROUBADA

Não garantir sucesso.

O jogador pode:

* fracassar;
* ficar no banco;
* perder espaço;
* sofrer lesões;
* ser emprestado futuramente;
* ter carreira mediana;
* virar craque;
* nunca alcançar o potencial;
* explodir mais tarde.

Essa imprevisibilidade controlada é parte central do jogo.

---

# 68. REALISMO ACIMA DE RECOMPENSA CONSTANTE

Não transforme o jogo em:

```text
clicou
+XP
clicou
+overall
clicou
+dinheiro
```

Nem tudo deve recompensar.

Uma semana comum pode simplesmente acontecer.

Uma temporada ruim deve existir.

Um grande momento deve parecer especial justamente porque não acontece o tempo inteiro.

---

# 69. PRIORIDADE DE IMPLEMENTAÇÃO

Não tente criar cem sistemas incompletos.

Implemente primeiro o ciclo:

```text
CRIAR JOGADOR
↓
ENTRAR NO CLUBE
↓
TREINAR
↓
AVANÇAR TEMPO
↓
SER ESCALADO
↓
SIMULAR PARTIDA
↓
RECEBER DESEMPENHO
↓
ATUALIZAR ESTATÍSTICAS
↓
EVOLUIR
↓
ATUALIZAR TABELA
↓
CONTINUAR TEMPORADA
```

Esse ciclo deve funcionar perfeitamente.

Depois implemente:

```text
contratos
transferências
lesões
notícias
eventos
objetivos
histórico
mudança de temporada
```

---

# 70. NÃO PARAR EM MOCKUP

Muito importante:

não quero receber apenas:

* layout;
* componentes;
* dados falsos;
* telas navegáveis.

Quero que os botões executem ações reais.

Ao clicar:

**Avançar Semana**

o jogo precisa avançar.

Ao simular:

o resultado precisa ser gerado.

A tabela precisa mudar.

As estatísticas precisam mudar.

A forma precisa mudar.

A confiança precisa mudar.

O save precisa ser atualizado.

---

# 71. CRITÉRIOS DE ACEITAÇÃO

Considere esta primeira versão pronta somente quando:

### Inicialização

`npm install` funciona.

`npm run dev` funciona.

Não existem erros TypeScript.

### API

Com uma chave válida da API-Football, os clubes são carregados.

Os escudos aparecem.

A chave não é exposta no frontend.

### Carreira

É possível criar jogador.

Idade mínima é 15.

15/16 começam na base.

17+ começam no profissional.

### Simulação

É possível avançar semanas.

Partidas são simuladas.

Outros jogos da liga também são simulados.

A tabela é atualizada corretamente.

### Jogador

Pode ser titular ou reserva.

Possui minutos.

Possui nota.

Pode marcar.

Pode assistir.

Pode evoluir.

Pode se lesionar.

### Mundo

Clubes possuem níveis diferentes.

Resultados não são totalmente aleatórios.

Times fortes têm vantagem sem vitória garantida.

### Temporada

É possível chegar ao final da temporada.

Campeão é determinado.

Histórico é salvo.

Nova temporada começa.

### Persistência

Atualizar o navegador não apaga a carreira.

É possível continuar.

É possível excluir e começar novamente.

### Interface

A aparência lembra um jogo/simulador esportivo.

Não parece um template SaaS.

---

# 72. MODO DE TRABALHO

Antes de começar, examine o repositório existente.

Se estiver vazio, inicialize corretamente.

Depois:

1. monte a arquitetura;
2. implemente domínio;
3. implemente motor de simulação;
4. implemente integração da API;
5. implemente persistência local;
6. implemente interface;
7. conecte interface ao motor;
8. teste;
9. corrija problemas;
10. documente.

Não construa toda a interface antes do motor funcionar.

Não deixe regras essenciais como TODO.

---

# 73. DECISÕES AUTÔNOMAS

Não me pergunte sobre decisões pequenas de implementação.

Quando existir uma decisão técnica razoável que não altere o conceito do jogo:

tome a melhor decisão e continue.

Só preserve rigorosamente os princípios:

* Next.js;
* TypeScript;
* arquitetura de domínio em pt-BR;
* sem banco de dados;
* API-Football;
* simulação real;
* clubes reais importados;
* carreira de jogador;
* 15/16 anos na base;
* partidas não controláveis;
* visual de simulador esportivo;
* persistência local;
* arquitetura preparada para crescer.

---

# 74. RESULTADO ESPERADO

Quando terminar esta etapa, quero poder abrir o navegador, clicar em:

**NOVA CARREIRA**

criar meu jogador:

```text
Kauê
15 anos
Brasil
Ponta Direita
Destro
```

escolher:

```text
Brasileirão
Palmeiras
```

começar na base;

treinar;

avançar semanas;

ser escalado;

jogar partidas simuladas;

receber notas;

marcar gols;

dar assistências;

evoluir;

ser promovido;

disputar o Brasileirão;

acompanhar a classificação;

receber notícias;

eventualmente receber propostas;

mudar de clube;

terminar temporadas;

e continuar construindo a história da carreira.

Tudo isso sem banco de dados e sem gameplay de partida.

O objetivo desta primeira implementação é criar o **núcleo real do viztto**, e não uma demonstração visual.

Comece agora pela fundação arquitetural e avance até obter essa vertical slice completamente funcional.
