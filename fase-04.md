Quero refatorar completamente o fluxo de importação de dados de futebol do projeto VIZTTO.

ANTES DE ALTERAR QUALQUER ARQUIVO:
1. Analise todo o repositório atual.
2. Entenda a arquitetura atual de:
   - src/app/api/futebol
   - src/app/api/futebol/importar
   - src/infraestrutura/transfermarkt
   - src/infraestrutura/persistencia/importacao-futebol.ts
   - src/dominio/constantes/ligas.ts
   - src/dominio/constantes/temporadas-iniciais.ts
   - src/dominio/entidades/modelos.ts
   - src/componentes/jogador/CriacaoCarreira.tsx
   - scripts/
   - API/
   - package.json
   - .gitignore
   - testes/
3. Preserve a arquitetura atual sempre que possível.
4. Não reescreva sistemas que não precisam ser alterados.
5. Não quebre carreira, transferências, simulação, contratos, calendário ou persistência existentes.

==================================================
OBJETIVO PRINCIPAL
==================================================

Hoje o VIZTTO importa dados do Transfermarkt automaticamente quando um usuário entra na criação de carreira e seleciona uma liga que ainda não possui dados.

Quero REMOVER completamente esse comportamento.

A partir desta alteração:

- entrar na criação de carreira NUNCA deve iniciar scraping/importação;
- selecionar uma liga NUNCA deve iniciar scraping/importação;
- nenhum usuário do site deve provocar chamadas à transfermarkt-api;
- produção deve apenas CONSUMIR snapshots JSON já existentes;
- os dados serão atualizados previamente pelo desenvolvedor;
- um único comando deve atualizar TODAS as ligas configuradas;
- os JSONs gerados devem fazer parte do repositório e ser enviados ao GitHub;
- o deploy para produção recebe esses JSONs normalmente pelo Git.

O comando desejado é:

npm run atualizar-dados-futebol

Esse deve ser o único fluxo oficial de atualização da base de futebol.

==================================================
ARQUITETURA DESEJADA
==================================================

Fluxo de atualização:

Desenvolvedor
    ↓
npm run atualizar-dados-futebol
    ↓
garante que a transfermarkt-api local esteja disponível
    ↓
atualiza TODAS as ligas sequencialmente
    ↓
consulta clubes
    ↓
consulta perfil dos clubes
    ↓
consulta jogadores
    ↓
normaliza os dados
    ↓
gera/atualiza JSONs em:
src/dados/futebol/
    ↓
git add / commit / push
    ↓
GitHub Actions
    ↓
produção recebe os snapshots

Fluxo em produção:

Usuário
    ↓
Criação de carreira
    ↓
Next.js lê somente dados locais
    ↓
mostra ligas disponíveis
    ↓
mostra clubes disponíveis
    ↓
zero scraping
    ↓
zero POST de importação

==================================================
1. CRIAR COMANDO ÚNICO
==================================================

Adicionar ao package.json:

npm run atualizar-dados-futebol

Não quero precisar executar:

npm run api
npm run dev
npm run alguma-liga
etc.

Um único comando deve cuidar de tudo.

Sugestão de implementação:

scripts/atualizar-dados-futebol.sh
scripts/atualizar-dados-futebol.ts

O shell deve seguir o mesmo princípio de scripts/dev.sh:

- detectar se http://127.0.0.1:8000 já está funcionando;
- se já estiver funcionando, reutilizar a API;
- se não estiver, iniciar API/iniciar.sh;
- aguardar a API ficar pronta;
- executar o atualizador;
- ao terminar, matar a FastAPI APENAS se o próprio comando tiver iniciado;
- se a API já estava rodando antes, não desligá-la;
- tratar SIGINT/SIGTERM corretamente;
- não deixar processo órfão.

Não iniciar Next.js para fazer a atualização.

O atualizador TypeScript deve utilizar diretamente a infraestrutura existente:
- importarLiga
- LIGAS_SUPORTADAS
- persistência existente
- normalizadores existentes

Não duplicar a lógica de importação.

Pode adicionar `tsx` como devDependency se for a solução mais limpa para executar a CLI TypeScript.

Carregar corretamente o .env da raiz.

TRANSFERMARKT_API_URL deve continuar podendo ser:

http://127.0.0.1:8000

ou:

http://localhost:8000

==================================================
2. ATUALIZAR TODAS AS LIGAS SEQUENCIALMENTE
==================================================

O comando:

npm run atualizar-dados-futebol

deve percorrer TODAS as ligas de LIGAS_SUPORTADAS.

IMPORTANTE:

NÃO fazer todas simultaneamente.

Executar sequencialmente para evitar:
- rate limit;
- excesso de requests;
- bloqueio;
- carga desnecessária;
- concorrência na persistência.

Exemplo visual:

════════════════════════════════════════
VIZTTO — ATUALIZAÇÃO DA BASE DE FUTEBOL
════════════════════════════════════════

[1/13] Brasileirão Série A
Competição: BRA1
Clubes encontrados: 20

[████████░░░░░░] 8/20
Atualizando: Fluminense

...

✓ Brasileirão Série A
  20 clubes
  20 atualizados
  0 falhas
  612 jogadores

[2/13] Brasileirão Série B
...

No final:

════════════════════════════════════════
RESUMO
════════════════════════════════════════

✓ Brasileirão Série A       20/20
✓ Brasileirão Série B       20/20
✓ Brasileirão Série C       20/20
✓ Premier League            20/20
✓ Championship              24/24
✓ La Liga                   20/20
✓ LaLiga 2                  ...
✓ Serie A                   20/20
✓ Serie B                   ...
✓ Bundesliga                18/18
✓ 2. Bundesliga             18/18
✓ Ligue 1                   18/18
✓ Ligue 2                   ...

Total:
- X ligas
- X clubes
- X jogadores
- X falhas
- duração total

Se uma liga falhar:
- registrar claramente o erro;
- NÃO interromper todas as outras;
- continuar para a próxima liga;
- no final mostrar as falhas;
- retornar exit code diferente de 0 se houver falhas importantes.

Não esconder exceções importantes.

==================================================
3. ADICIONAR DIVISÕES SECUNDÁRIAS
==================================================

Expandir LIGAS_SUPORTADAS.

Escopo inicial desejado:

BRASIL
- Brasileirão Série A
- Brasileirão Série B
- Brasileirão Série C

INGLATERRA
- Premier League
- Championship

ESPANHA
- La Liga
- LaLiga 2 / Segunda División

ITÁLIA
- Serie A
- Serie B

ALEMANHA
- Bundesliga
- 2. Bundesliga

FRANÇA
- Ligue 1
- Ligue 2

Total esperado inicialmente: 13 ligas.

Mapeamentos Transfermarkt esperados/candidatos:

Brasileirão Série A:
BRA1

Brasileirão Série B:
BRA2

Brasileirão Série C:
BRA3

Premier League:
GB1

Championship:
GB2

La Liga:
ES1

LaLiga 2:
ES2

Serie A:
IT1

Serie B:
IT2

Bundesliga:
L1

2. Bundesliga:
L2

Ligue 1:
FR1

Ligue 2:
FR2

IMPORTANTE:
não confie cegamente nesses códigos.

Verifique a compatibilidade com a transfermarkt-api e com o Transfermarkt antes de consolidar cada idTransfermarkt.

Se algum identificador estiver incorreto, descubra o correto.

Não silencie isso usando uma liga errada.

A configuração deve continuar centralizada em:
src/dominio/constantes/ligas.ts

Não espalhar IDs pelo projeto.

==================================================
4. ADICIONAR HIERARQUIA/DIVISÃO À LIGA
==================================================

Atualmente Liga não possui informação explícita de divisão.

Adicionar de forma limpa algo como:

divisao: number

Exemplos:

Brasileirão Série A → 1
Brasileirão Série B → 2
Brasileirão Série C → 3

Premier League → 1
Championship → 2

La Liga → 1
LaLiga 2 → 2

etc.

Se for útil, também pode existir algo como:

paisId
ordemNoPais

mas evite abstrações desnecessárias.

Não implementar promoção/rebaixamento nesta tarefa.

Apenas deixar o domínio preparado para reconhecer a hierarquia.

==================================================
5. TEMPORADAS INICIAIS
==================================================

Atualizar:

src/dominio/constantes/temporadas-iniciais.ts

para todas as novas ligas.

A regra de exibição deve considerar:

Brasil:
2026

Europa:
2026/27

Atualizar formatarTemporada para reconhecer corretamente:
- brasileirao
- brasileirao-b
- brasileirao-c

como calendário anual brasileiro.

Não deixar Brasileirão Série C sendo exibido como 2026/27.

Para novas ligas europeias, seguir o mesmo calendário da divisão principal correspondente.

Não inventar datas sem necessidade:
verifique como `inicio` é efetivamente usado pelo simulador e preserve coerência com o calendário atual.

==================================================
6. JSONS DEVEM ENTRAR NO GIT
==================================================

Hoje os arquivos:

src/dados/futebol/*.json

estão ignorados.

Isso precisa mudar.

Remover essa regra do .gitignore.

Os snapshots oficiais devem poder ser commitados:

src/dados/futebol/brasileirao.json
src/dados/futebol/brasileirao-b.json
src/dados/futebol/brasileirao-c.json
src/dados/futebol/premier-league.json
src/dados/futebol/championship.json
src/dados/futebol/la-liga.json
src/dados/futebol/la-liga-2.json
src/dados/futebol/serie-a.json
src/dados/futebol/serie-b.json
src/dados/futebol/bundesliga.json
src/dados/futebol/bundesliga-2.json
src/dados/futebol/ligue-1.json
src/dados/futebol/ligue-2.json

Arquivos temporários/staging devem continuar ignorados.

Por exemplo:

.cache/
src/dados/futebol/.staging/

Nunca adicionar:
- .env
- API/.venv
- node_modules
- caches
- arquivos temporários

ao Git.

==================================================
7. ATUALIZAÇÃO SEGURA / STAGING
==================================================

Não quero que uma atualização quebrada destrua silenciosamente os dados existentes.

Criar um processo de staging.

Exemplo:

src/dados/futebol/.staging/

ou:

.cache/futebol-update/<run-id>/

A atualização deve trabalhar primeiro numa área temporária.

Somente publicar o resultado para:

src/dados/futebol/<liga>.json

depois de validar o JSON.

A persistência atual possui funções como:
- definirDiretorioImportacao
- lerDadosLiga
- salvarDadosLiga
- clubesProntosParaJogo

Reutilize isso quando possível.

Evite duplicar schemas.

==================================================
8. DEFINIÇÃO DE "CLUBE DISPONÍVEL"
==================================================

Um clube deve ser considerado disponível para o jogo somente se possuir os requisitos já definidos pelo domínio.

Preserve/reutilize:

clubeComElencoCompleto(...)

e:

clubesProntosParaJogo(...)

Um clube cuja atualização falhou NÃO deve aparecer para o usuário.

Não exibir placeholder sem elenco.

Não exibir clube parcialmente quebrado.

Em uma atualização forçada, cuidado com o comportamento atual de reaproveitar dados anteriores.

Se um clube falhar na atualização atual, não reutilize silenciosamente o snapshot antigo como se ele tivesse sido atualizado com sucesso.

O resultado precisa permitir distinguir:

- clube atualizado com sucesso;
- clube que falhou;
- placeholder;
- dado anterior.

A tela deve receber apenas clubes considerados válidos para o snapshot publicado.

==================================================
9. UMA LIGA PODE TER ALGUNS CLUBES INDISPONÍVEIS
==================================================

Não é necessário esconder uma liga inteira porque 1 clube falhou.

Exemplo:

Premier League:
19 clubes válidos
1 clube falhou

A liga pode continuar aparecendo com os 19 clubes válidos.

Na interface:
- mostrar 19 clubes;
- não mostrar o clube quebrado;
- não iniciar importação;
- não travar a tela.

Porém, se a liga:
- não possui JSON;
- possui JSON inválido;
- pertence a uma temporada incompatível;
- não possui clubes válidos suficientes;

ela não deve aparecer na criação de carreira.

Definir uma validação clara para isso.

Pode considerar liga disponível se houver pelo menos 2 clubes válidos para permitir simulação.

==================================================
10. CRIAR UMA FONTE ÚNICA DE "LIGAS DISPONÍVEIS"
==================================================

Criar uma função server-side centralizada para descobrir quais ligas possuem dados utilizáveis.

Sugestão:

obterLigasDisponiveis()

Ela deve:

para cada LIGAS_SUPORTADAS:
- tentar carregar JSON;
- validar schema;
- validar temporada;
- filtrar clubes válidos;
- calcular quantidade de clubes realmente disponíveis;
- ignorar liga sem dados utilizáveis.

Não repetir essa lógica na UI.

Pode criar um endpoint read-only, por exemplo:

GET /api/futebol/ligas

Resposta aproximada:

{
  "ligas": [
    {
      "id": "brasileirao",
      "nome": "Brasileirão Série A",
      "pais": "Brasil",
      "bandeira": "BR",
      "divisao": 1,
      "temporada": 2026,
      "clubesDisponiveis": 20,
      "status": "completo",
      "atualizadoEm": "..."
    }
  ]
}

Esse endpoint:
- é somente leitura;
- nunca chama Transfermarkt;
- nunca chama localhost:8000;
- nunca inicia importação.

==================================================
11. REMOVER IMPORTAÇÃO AUTOMÁTICA DA TELA
==================================================

Refatorar:

src/componentes/jogador/CriacaoCarreira.tsx

Hoje existem fluxos relacionados a:
- precisaImportar
- importando
- progresso
- tentativa de importação
- POST /api/futebol/importar
- polling
- aguardarImportacao
- importarLigaSelecionada

Remover o comportamento automático.

Ao abrir a etapa de escolha de liga:

1. buscar somente ligas com dados locais disponíveis;
2. renderizar somente essas ligas;
3. nenhuma chamada POST;
4. nenhum scraping;
5. nenhum polling de importação.

Ao selecionar uma liga:
- buscar os clubes locais;
- renderizar apenas clubes válidos;
- se algum clube não existir ou estiver quebrado, simplesmente não mostrar;
- se a liga deixar de estar disponível, remover da seleção.

Remover mensagens como:

"Preparando Ligue 1: 5/18 clubes..."

porque jogadores finais nunca devem esperar uma importação.

A experiência deverá ser imediata.

==================================================
12. INTERFACE DE ESCOLHA DE LIGA
==================================================

A UI hoje possui texto fixo como:

"Seis ligas."

Isso não deve continuar hardcoded.

Exibir dinamicamente a quantidade disponível.

Exemplo:

"13 ligas. Diferentes caminhos para conquistar espaço."

ou:

"11 ligas disponíveis."

Os cards devem utilizar a quantidade REAL de clubes válidos do snapshot.

Exemplo:

Premier League
Inglaterra · 19 clubes

se somente 19 estiverem disponíveis.

Ordenar de forma coerente:

Brasil
  Série A
  Série B
  Série C

Inglaterra
  Premier League
  Championship

Espanha
  La Liga
  LaLiga 2

Itália
  Serie A
  Serie B

Alemanha
  Bundesliga
  2. Bundesliga

França
  Ligue 1
  Ligue 2

Preservar o estilo visual atual.

Não redesenhar a página.

==================================================
13. LIGAS SECUNDÁRIAS DEVEM PODER SER ESCOLHIDAS
==================================================

As divisões secundárias que possuírem dados válidos devem ser opções reais para iniciar a carreira.

Exemplo:

o jogador deve poder começar no:
- Brasileirão Série B;
- Brasileirão Série C;
- Championship;
- LaLiga 2;
- Serie B;
- 2. Bundesliga;
- Ligue 2.

Não manter uma regra arbitrária excluindo Série B ou outras divisões da tela.

A disponibilidade deve ser determinada pelos dados locais.

Se o JSON existe e é válido:
aparece.

Se não existe:
não aparece.

==================================================
14. MUNDO DA CARREIRA
==================================================

Ao confirmar uma carreira, carregar para o mundo somente ligas que possuem snapshots válidos.

Hoje existe lógica percorrendo LIGAS_SUPORTADAS e consultando:

/api/futebol?liga=...

Refatore para utilizar a lista real de ligas disponíveis.

Não tentar carregar uma liga inexistente repetidamente.

O mundo deve poder conter:
- divisões principais;
- divisões secundárias;

desde que estejam disponíveis.

Nesta tarefa NÃO implementar:
- promoção;
- rebaixamento;
- copas;
- acesso entre divisões.

Apenas adicionar as ligas e clubes ao universo existente.

==================================================
15. ROTA /api/futebol
==================================================

Manter a rota de leitura:

GET /api/futebol?liga=<id>

Mas alterar sua semântica para dados estáticos locais.

Ela NUNCA deve iniciar importação.

Se houver dados:

200
{
  clubes: [...],
  temporada: ...,
  inicio: ...,
  origem: "api",
  ...
}

Se não houver dados utilizáveis:

404
{
  erro: "Liga não disponível na base local."
}

Não retornar:

precisaImportar: true

porque a aplicação web não deve mais sugerir que uma importação será iniciada.

==================================================
16. ROTA /api/futebol/importar
==================================================

O fluxo oficial não deve mais depender dela.

Remover qualquer uso no frontend.

Preferencialmente remover a rota web de importação, já que o objetivo é que usuários públicos não consigam iniciar scraping no servidor.

O comando CLI deve chamar a infraestrutura de importação DIRETAMENTE.

Não implementar o comando fazendo requests para:

POST /api/futebol/importar

Não quero precisar subir Next.js para atualizar os dados.

Se decidir manter essa rota por compatibilidade técnica:
- ela deve ser inacessível em produção;
- nenhum componente deve utilizá-la;
- documentar claramente que não é o fluxo oficial.

Mas prefira simplificar e removê-la se não houver dependência necessária.

==================================================
17. NÃO REMOVER A TRANSFERMARKT-API DO PROJETO
==================================================

A pasta API/ continua necessária.

Ela será utilizada localmente para atualização dos dados.

Não migrar para API-Football.
Não trocar a fonte de dados.
Não substituir felipeall/transfermarkt-api nesta tarefa.

O problema de WAF em cloud não importa para este novo fluxo porque a atualização será executada no ambiente do desenvolvedor onde a API funciona.

Não adicionar técnicas de bypass de WAF.

==================================================
18. ATUALIZAÇÃO PARCIAL E FALHAS
==================================================

O comando precisa ser resiliente.

Se:

Brasileirão A → sucesso
Brasileirão B → sucesso
Brasileirão C → erro
Premier League → sucesso

não parar na Série C.

Continuar todas.

Ao final:

✓ Brasileirão Série A
✓ Brasileirão Série B
✗ Brasileirão Série C
✓ Premier League

Se alguns CLUBES falharem:

⚠ Ligue 1
17/18 clubes
1 falha:
- Clube X: motivo

O arquivo final pode conter somente os clubes válidos da atualização.

Não deixar placeholders aparecerem no jogo.

==================================================
19. MANIFESTO DA BASE
==================================================

Avalie criar:

src/dados/futebol/manifesto.json

Gerado automaticamente pelo comando.

Exemplo:

{
  "geradoEm": "...",
  "temporadaTransfermarkt": "2026",
  "ligas": {
    "brasileirao": {
      "status": "completo",
      "clubes": 20,
      "jogadores": 620,
      "atualizadoEm": "..."
    },
    "ligue-1": {
      "status": "parcial",
      "clubes": 17,
      "jogadores": 480,
      "atualizadoEm": "..."
    }
  }
}

Se implementar:
- ele deve ser derivado dos JSONs;
- não virar segunda fonte de verdade;
- se estiver ausente, o sistema ainda deve conseguir validar os próprios JSONs;
- serve para diagnóstico e UI de disponibilidade.

==================================================
20. CUIDAR DO DEPLOY
==================================================

Os JSONs precisam estar commitados para que:

git push origin main

dispare o GitHub Actions existente e leve os dados à VM.

Não alterar o deploy automático sem necessidade.

Não executar scraping durante:
- npm ci;
- npm run build;
- GitHub Actions;
- inicialização do PM2;
- inicialização do Next;
- request de usuário.

Build deve ser determinístico usando os snapshots já existentes.

==================================================
21. TESTES
==================================================

Atualizar/adicionar testes para pelo menos:

1. LIGAS_SUPORTADAS contém todas as 13 ligas.
2. IDs das ligas são únicos.
3. idTransfermarkt não é duplicado.
4. divisao está correta.
5. temporada brasileira é formatada como "2026".
6. temporada europeia como "2026/27".
7. liga sem JSON não aparece em ligas disponíveis.
8. JSON inválido não aparece.
9. liga com clubes válidos aparece.
10. clube com elenco vazio não aparece.
11. liga parcial pode aparecer com apenas clubes válidos.
12. GET /api/futebol não inicia importação.
13. GET /api/futebol/ligas não inicia importação.
14. CriacaoCarreira não faz POST de importação.
15. CriacaoCarreira não faz polling.
16. seleção mostra apenas ligas disponíveis.
17. contagem exibida corresponde aos clubes realmente válidos.
18. carreira pode iniciar numa segunda divisão.
19. mundo da carreira carrega divisões secundárias disponíveis.
20. atualização de uma liga não interrompe todas as seguintes quando falha.

Nos testes da CLI:
não acessar Transfermarkt real.

Mockar a camada de importação.

==================================================
22. DOCUMENTAÇÃO
==================================================

Atualizar README.md.

Adicionar seção:

## Atualizando a base de futebol

Explicar:

1. a transfermarkt-api precisa funcionar no ambiente local;
2. executar:

npm run atualizar-dados-futebol

3. o comando atualiza todas as ligas;
4. os arquivos são gravados em:

src/dados/futebol/

5. revisar o resumo;
6. depois fazer:

git add src/dados/futebol
git commit -m "data: atualizar base de futebol"
git push origin main

Explicar também que produção não faz scraping em tempo real.

==================================================
23. QUALIDADE DA IMPLEMENTAÇÃO
==================================================

Não quero solução improvisada.

Evitar:
- lógica duplicada;
- giant functions;
- `any` desnecessário;
- sleeps aleatórios espalhados;
- IDs duplicados;
- lógica de disponibilidade dentro do componente React;
- chamadas ao Transfermarkt pelo browser;
- importação durante requests públicos;
- sobrescrita destrutiva antes da validação;
- swallowing de erros;
- comandos que dependam de Next dev estar rodando.

Centralizar responsabilidades.

Manter português-BR na nomenclatura de domínio já usada pelo projeto.

==================================================
24. CRITÉRIOS DE ACEITAÇÃO
==================================================

A tarefa só está concluída quando:

npm run typecheck

passa.

npm test

passa.

npm run build

passa.

E:

npm run atualizar-dados-futebol

é o único comando necessário para iniciar a API local se necessário e atualizar todas as ligas.

Ao abrir a criação de carreira:

- nenhuma importação começa;
- nenhum POST de importação acontece;
- nenhum polling acontece;
- apenas ligas existentes localmente aparecem;
- apenas clubes válidos aparecem;
- ligas secundárias aparecem quando seus dados existem;
- ausência de dados não gera erro visual grave;
- ausência de dados simplesmente remove aquela opção.

==================================================
25. ENTREGA
==================================================

Depois de implementar:

1. Mostre todos os arquivos criados.
2. Mostre todos os arquivos modificados.
3. Explique brevemente as decisões arquiteturais.
4. Mostre a lista final de LIGAS_SUPORTADAS e seus idTransfermarkt.
5. Informe quais IDs Transfermarkt foram efetivamente verificados.
6. Mostre um exemplo do output de:

npm run atualizar-dados-futebol

7. Rode:
   npm run typecheck
   npm test
   npm run build

8. Corrija qualquer erro encontrado.
9. Não faça commit/push automaticamente sem minha autorização.