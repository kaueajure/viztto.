Analise completamente o estado ATUAL do projeto Viztto antes de modificar qualquer arquivo.

Projeto:
https://github.com/kaueajure/viztto.

IMPORTANTE:
- O nome do repositório termina com ".".
- Trabalhe sobre a branch main local atual.
- NÃO faça git push.
- NÃO faça deploy.
- NÃO faça reset destrutivo do banco.
- NÃO recrie do zero a arquitetura já existente.
- Preserve todos os sistemas atuais do jogo que não façam parte desta alteração.
- Antes de alterar algo, entenda o fluxo completo de criação, carregamento, alteração e exclusão de uma carreira.

==================================================
OBJETIVO PRINCIPAL
==================================================

Remover completamente o localStorage como mecanismo de persistência da carreira do Viztto.

A partir desta implementação:

1. PostgreSQL deve ser a fonte de verdade do save da carreira.
2. Zustand deve continuar existindo apenas como estado em memória da aplicação.
3. A carreira NÃO deve mais ser persistida com Zustand persist().
4. Não usar localStorage.
5. Não usar sessionStorage.
6. Não usar IndexedDB como fallback.
7. Não criar fallback silencioso para armazenamento no navegador.
8. Se o banco estiver indisponível, apresentar erro real de persistência.
9. A carreira deve continuar funcionando após:
   - fechar navegador;
   - abrir novamente;
   - atualizar a página;
   - reiniciar o Next.js;
   - reiniciar a VM;
   - fazer um novo deploy.

O PostgreSQL já está instalado e configurado.

Já existe:

DATABASE_URL

Já existem:

- drizzle-orm
- postgres
- drizzle-kit
- scripts/db.mjs
- npm run db:generate
- npm run db:migrate
- npm run db:check
- src/infraestrutura/banco/
- drizzle/
- tabela career_saves

A migration atual de career_saves já está aplicada em desenvolvimento e produção.

NÃO destrua esta fundação.

==================================================
REGRA CRÍTICA: O QUE VAI PARA O BANCO
==================================================

O banco deve armazenar TODA a parte dinâmica necessária para continuar uma carreira exatamente de onde ela parou.

Porém NÃO deve duplicar o catálogo estático de futebol que já é gerado pelo desenvolvedor e enviado junto com o deploy.

Os arquivos versionados em:

src/dados/futebol/*.json

continuam sendo a fonte de verdade dos dados estáticos de futebol.

Exemplos de conteúdo que NÃO deve ser duplicado dentro de career_saves.state:

- nome estático dos clubes;
- nome oficial;
- nome curto;
- escudo/logo;
- país;
- estádio;
- capacidade;
- fundação;
- IDs externos;
- IDs do Transfermarkt;
- fotos dos jogadores;
- nacionalidades estáticas;
- data de nascimento original;
- informações estáticas dos snapshots;
- dadosBrutos;
- qualquer outro campo que possa ser reconstruído diretamente dos snapshots versionados no projeto.

Não quero armazenar centenas de clubes, logos, imagens e informações estáticas repetidamente para cada save.

O save deve referenciar essas entidades por IDs estáveis.

Exemplo conceitual:

ERRADO:

{
  clubeAtual: {
    id: "...",
    nome: "...",
    escudo: "https://...",
    estadio: "...",
    ...
  }
}

CORRETO:

{
  clubeAtualId: "..."
}

e, quando necessário:

{
  clubesDinamicos: {
    "club-id": {
       forma: ...,
       moral: ...,
       orcamento: ...,
       ...
    }
  }
}

O catálogo estático é carregado da base de futebol distribuída no deploy e combinado com o estado dinâmico do save.

==================================================
MAS TODO ESTADO DINÂMICO DEVE SER SALVO
==================================================

É extremamente importante não confundir "não salvar os clubes estáticos" com "não salvar o mundo da carreira".

Tudo que muda durante uma carreira e que seja necessário para continuar a simulação deve ser persistido.

Analise EstadoCarreira e todos os tipos relacionados e determine exatamente quais campos são dinâmicos.

Entre eles provavelmente estarão, conforme a arquitetura atual:

- versão do save;
- seed;
- estado do gerador aleatório;
- data atual;
- data inicial;
- jogador criado pelo usuário;
- atributos do jogador;
- overall;
- potencial;
- desenvolvimento;
- personalidade;
- categoria;
- status;
- moral;
- forma;
- condicionamento;
- fadiga;
- ritmo;
- confiança;
- reputação;
- valor de mercado;
- contrato;
- lesão;
- suspensão;
- cartões;
- estatísticas;
- clube atual;
- clube inicial;
- liga inicial;
- ligas presentes no universo;
- temporada atual;
- calendário;
- partidas já disputadas;
- placares;
- classificações;
- temporadas externas;
- progressão de outras ligas;
- mercado;
- propostas;
- negociações;
- contrapropostas;
- transferências;
- transferências mundiais;
- mudança de jogadores entre clubes;
- contratos alterados;
- evolução dos jogadores NPC;
- overall/potencial/forma/moral de NPCs quando alterados;
- lesões e suspensões de NPCs;
- estatísticas acumuladas dos NPCs;
- escalações alteradas;
- titulares e banco quando mudarem;
- orçamento ou situação financeira dinâmica;
- força do clube quando recalculada e necessária para continuidade;
- janela de transferências;
- relacionamentos;
- decisões;
- notícias;
- eventos;
- objetivos;
- registros;
- temporadas anteriores;
- última partida;
- foco de treino;
- qualquer outro estado mutável necessário para uma continuação determinística da carreira.

NÃO perca estado simplesmente porque o objeto original também contém informações estáticas.

Quando um Clube ou JogadorMundo mistura propriedades estáticas e dinâmicas, crie uma representação persistida contendo apenas:

- ID estável;
- propriedades dinâmicas.

Na hidratação, recomponha o objeto runtime usando:

CATÁLOGO ESTÁTICO DO DEPLOY
+
DELTA DINÂMICO DO SAVE
=
OBJETO UTILIZADO PELO SIMULADOR

==================================================
ARQUITETURA DE PERSISTÊNCIA
==================================================

Não continue usando EstadoCarreira diretamente como formato do JSONB caso ele contenha todo o catálogo estático.

Crie uma representação específica para persistência.

Exemplo de nomenclatura em português-BR:

EstadoCarreiraPersistido

ou equivalente adequado à arquitetura existente.

Criar explicitamente duas operações centrais:

serializarCarreira(...)

e

hidratarCarreira(...)

Conceitualmente:

EstadoCarreira runtime
        |
        | serializarCarreira()
        v
EstadoCarreiraPersistido
        |
        v
PostgreSQL JSONB


PostgreSQL JSONB
        |
        v
EstadoCarreiraPersistido
        |
        | hidratarCarreira() + snapshots
        v
EstadoCarreira runtime

Essas funções precisam possuir testes fortes.

==================================================
DADOS ESTÁTICOS X DADOS DINÂMICOS
==================================================

Faça essa separação de maneira cuidadosa.

Exemplo para jogadores NPC.

Dados vindos do snapshot, que não precisam ser repetidos em cada save:

- id;
- idTransfermarkt;
- nome;
- foto;
- nacionalidade;
- dataNascimento;
- informações estáticas de posição;
- outros dados puramente cadastrais.

Mas um jogador pode ter alterações durante a carreira:

- clube atual;
- overall;
- potencial;
- valor de mercado;
- salário;
- contrato;
- forma;
- moral;
- condicionamento;
- fadiga;
- lesão;
- suspensão;
- status no elenco;
- estatísticas;
- outras propriedades simuladas.

Esses DELTAS precisam ser salvos.

O mesmo vale para clubes.

Não salvar novamente:

nome + logo + estádio + país + metadados estáticos.

Mas salvar qualquer estado mutável da simulação necessário para reproduzir o mundo.

Não presuma quais campos são estáticos.
Analise onde cada propriedade é alterada durante a simulação.

==================================================
POSTGRESQL
==================================================

Reutilize career_saves.

Atualmente ela possui aproximadamente:

- id UUID
- save_version
- name
- current_club_id
- current_league_id
- game_date
- state JSONB
- created_at
- updated_at

Não crie uma tabela diferente sem necessidade.

Adapte o tipo TypeScript de state para a nova representação persistida.

Exemplo:

state: jsonb("state")
  .$type<EstadoCarreiraPersistido>()
  .notNull()

Os metadados da linha devem sempre permanecer coerentes com o JSONB.

Por exemplo:

save_version = state.versao
current_club_id = clube atual
current_league_id = liga atual
game_date = data atual
name = nome apropriado do save/jogador
updated_at = data da última gravação

Faça atualização dos metadados e JSONB na mesma operação/transação.

==================================================
IDENTIFICAÇÃO DO SAVE SEM LOGIN
==================================================

O Viztto ainda não possui autenticação de usuários.

Não implemente sistema de contas nesta tarefa.

Porém precisamos saber qual save pertence ao navegador atual sem usar localStorage.

Implemente uma solução anônima segura baseada em cookie HttpOnly.

O cookie NÃO deve conter a carreira.

Ele deve conter somente um token de identificação aleatório.

Preferência arquitetural:

1. Ao criar uma carreira:
   - gerar token criptograficamente seguro no servidor;
   - armazenar somente hash do token no PostgreSQL;
   - devolver o token em cookie HttpOnly.

2. Configuração do cookie:
   - HttpOnly;
   - SameSite=Lax;
   - Secure em produção;
   - Path=/;
   - duração longa razoável.

3. O JavaScript do cliente não deve ter acesso direto ao token.

4. Nas chamadas seguintes:
   - servidor lê cookie;
   - calcula hash;
   - encontra o career_save correspondente.

Não usar ID incremental como segredo.

Não colocar DATABASE_URL ou qualquer segredo no cliente.

Não colocar save completo em cookie.

Prepare a arquitetura para que no futuro:

career_saves

possa receber:

user_id

e passar de save anônimo para save associado à conta.

Mas NÃO implemente autenticação agora.

==================================================
MIGRATION
==================================================

Se for necessário modificar career_saves, crie nova migration Drizzle.

NÃO altere manualmente a migration 0000 já aplicada.

NÃO apague career_saves.

NÃO use drizzle push.

NÃO recrie o banco.

NÃO faça DROP TABLE.

A migration precisa preservar dados existentes.

Possíveis campos novos, caso a arquitetura realmente precise:

- access_token_hash
- revision

ou equivalentes.

Não adicione campos sem justificativa.

Se registros antigos não tiverem token porque são anteriores a esta arquitetura:
- preserve-os;
- não os apague;
- documente como serão tratados.

==================================================
API DO SAVE
==================================================

Crie uma API server-side clara para persistência.

Pode ser algo como:

GET /api/carreira
POST /api/carreira
PUT /api/carreira
DELETE /api/carreira

ou estrutura equivalente coerente com o projeto.

Comportamento esperado:

GET
- lê token HttpOnly;
- localiza carreira;
- retorna 404/estado vazio se não existir;
- carrega o estado persistido;
- reidrata usando a base estática disponível no deploy;
- devolve estado utilizável pelo frontend.

POST
- cria nova carreira;
- substitui a carreira anterior somente quando o fluxo atual permitir;
- cria token anônimo se necessário;
- persiste no PostgreSQL;
- retorna carreira criada somente após confirmação do banco.

PUT
- salva estado atualizado;
- nunca aceita arbitrariamente um save ID de outro usuário;
- resolve carreira a partir do cookie/token;
- valida completamente o payload;
- mantém metadados sincronizados;
- atualiza updated_at.

DELETE
- remove a carreira associada ao token atual;
- remove/invalida cookie;
- não permite apagar save por UUID arbitrário.

As rotas devem ser server-only.

Nunca importar camada de banco em Client Components.

==================================================
VALIDAÇÃO
==================================================

Não confie no JSON recebido do navegador.

Utilize validação de runtime.

O projeto já utiliza Zod.

Crie schemas adequados para o formato persistido.

Valide:

- versão;
- datas;
- IDs;
- jogador;
- temporada;
- mercado;
- contratos;
- arrays;
- objetos;
- deltas;
- demais estruturas críticas.

Não dependa apenas de type assertions TypeScript.

Se o save estiver inválido:
- não gravar;
- retornar erro adequado;
- não corromper o save anterior.

==================================================
CONCORRÊNCIA E ORDEM DOS SAVES
==================================================

Evite condição de corrida.

Exemplo do problema:

ação A gera save versão 10
ação B gera save versão 11

Se a requisição B terminar antes de A, a versão antiga não pode sobrescrever a nova.

Implemente uma estratégia simples e robusta.

Pode utilizar um campo revision crescente.

A atualização precisa impedir gravação fora de ordem.

Exemplo conceitual:

revision 7
→ cliente envia atualização esperada 7
→ servidor grava revision 8

Se chegar depois uma requisição baseada em revision 6:
→ rejeitar conflito
→ não sobrescrever revision 8.

Não invente complexidade distribuída desnecessária.

Precisamos apenas impedir perda de progresso por saves concorrentes.

==================================================
ZUSTAND
==================================================

Remova a dependência da persistência local.

Atualmente jogo-store.ts utiliza aproximadamente:

persist(...)
createJSONStorage(...)
adaptarPersistencia(...)
repositorioNavegador
skipHydration
onRehydrateStorage

Essa arquitetura deve desaparecer para carreira.

Transforme o Zustand em estado de execução.

Conceitualmente:

create<JogoStore>((set, get) => ({
   carreira: null,
   hidratado: false,
   salvando: false,
   ...
}))

Ao carregar a aplicação:

GET /api/carreira
→ preencher Zustand
→ hidratado = true

Não use Zustand persist.

Não grave EstadoCarreira no navegador.

==================================================
ARQUIVO armazenamento.ts
==================================================

Analise:

src/infraestrutura/persistencia/armazenamento.ts

Se ele existir exclusivamente por causa do localStorage da carreira, remova o arquivo e ajuste imports/testes.

Se alguma parte ainda possuir outra finalidade válida, mantenha apenas essa responsabilidade.

Depois desta implementação não deve existir:

window.localStorage.setItem(...)

para carreira.

Nem:

window.localStorage.getItem(...)

para carreira.

Nem:

window.localStorage.removeItem(...)

para carreira.

Não substituir por sessionStorage ou IndexedDB.

==================================================
CRIAÇÃO DE CARREIRA
==================================================

O fluxo atual cria a carreira e imediatamente tenta colocá-la no Zustand/localStorage.

Isso precisa mudar.

Novo comportamento:

Usuário confirma criação
       |
       v
gerar EstadoCarreira
       |
       v
serializar parte persistível
       |
       v
POST /api/carreira
       |
       v
PostgreSQL confirma INSERT
       |
       v
Zustand recebe carreira
       |
       v
navegar para /carreira

NÃO navegar para /carreira antes de o banco confirmar a criação.

Se o PostgreSQL falhar:

- permanecer na tela;
- apresentar mensagem clara;
- não fingir que a carreira foi salva;
- permitir tentar novamente;
- não usar localStorage como fallback.

A mensagem antiga:

"Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado."

deve desaparecer, pois não fará mais sentido.

Uma mensagem adequada seria algo como:

"Não foi possível salvar sua carreira no servidor. Tente novamente."

Não exponha erro bruto do PostgreSQL.

==================================================
SALVAMENTO DURANTE O JOGO
==================================================

Toda ação que altera o estado persistível da carreira precisa chegar ao banco.

Exemplos:

- avançar semana;
- treino;
- partida;
- transferência;
- contraproposta;
- decisão;
- mudança de preferência;
- próxima temporada;
- contrato;
- qualquer mudança da carreira.

Não quero depender de um "Salvar" manual.

Implementar autosave.

Porém não faça dezenas de requisições concorrentes.

Crie uma fila de persistência simples.

Requisitos:

- no máximo uma gravação ativa por save;
- novas alterações enquanto uma gravação ocorre devem marcar estado como sujo;
- após terminar, enviar o estado mais recente;
- não enviar estados intermediários desnecessários;
- garantir ordem;
- combinar com revision no servidor.

O estado local pode ser atualizado de forma otimista para manter a UI rápida.

Se a gravação falhar:

- manter estado atual em memória;
- informar que existem alterações não salvas;
- permitir retry;
- não apagar o save anterior válido do PostgreSQL;
- enquanto houver alterações não persistidas, avisar antes de fechar/recarregar a página.

Não use localStorage para guardar a fila.

==================================================
CARREGAMENTO DA CARREIRA
==================================================

Ao abrir o site:

1. identificar cookie anônimo;
2. consultar PostgreSQL;
3. obter EstadoCarreiraPersistido;
4. carregar catálogo estático atual pelos snapshots do deploy;
5. combinar catálogo + estado dinâmico;
6. validar resultado;
7. colocar EstadoCarreira final no Zustand;
8. hidratado = true.

Enquanto isso, a UI deve mostrar um estado de carregamento apropriado.

Se não existir carreira:
- hidratado = true;
- carreira = null;
- menu oferece Nova Carreira.

Se o save estiver corrompido/incompatível:
- não apagar automaticamente;
- mostrar mensagem clara;
- preservar registro no banco para investigação.

==================================================
SNAPSHOTS E DEPLOY
==================================================

É uma regra de arquitetura:

src/dados/futebol/*.json

é conteúdo versionado do aplicativo.

career_saves

é conteúdo do jogador.

Não misture essas responsabilidades.

Os arquivos de futebol continuam atualizados pelo desenvolvedor através de:

npm run atualizar-dados-futebol

e enviados pelo Git/deploy.

Não faça o jogo escrever nos snapshots.

Não faça PostgreSQL substituir a base de futebol.

Não salve logos ou fotos como base64.

Não baixe imagens para o banco.

Não grave os snapshots inteiros dentro de cada carreira.

==================================================
ATUALIZAÇÃO DOS SNAPSHOTS
==================================================

Os saves precisam usar IDs estáveis.

Ao reidratar:

- localizar clube pelo ID;
- localizar jogadores estáticos pelo ID;
- aplicar os deltas persistidos.

Não dependa da posição de um clube em um array.

Não dependa do índice do jogador.

Se uma entidade referenciada pelo save não existir mais na base estática:
- NÃO silently resetar a carreira;
- NÃO substituir por clube aleatório;
- NÃO apagar o save;
- gerar erro de compatibilidade explícito.

Se fizer sentido, adicione uma pequena versão/identificador da base ao save, mas NÃO copie o catálogo para o banco apenas para resolver isso.

==================================================
TRANSFERÊNCIAS
==================================================

Este ponto é crítico.

Mesmo que os jogadores estáticos venham do snapshot, o SAVE precisa lembrar mudanças ocorridas durante a carreira.

Exemplo:

No snapshot:

Jogador X → Clube A

Durante a carreira:

Jogador X → Clube B

Após fechar e reabrir o jogo ele deve continuar no Clube B.

Portanto a hidratação NÃO pode simplesmente substituir o universo pelo snapshot original.

O snapshot fornece identidade estática.

O save fornece estado atual da simulação.

O mesmo vale para:

- contrato;
- salário;
- overall;
- valor de mercado;
- estatísticas;
- lesões;
- suspensões;
- escalação;
- clube atual;
- etc.

==================================================
NOVOS JOGADORES GERADOS
==================================================

Analise se o simulador já consegue gerar jogadores que não existem nos snapshots.

Se já existir essa possibilidade, esses jogadores precisam ser persistidos integralmente porque não podem ser reconstruídos pela base estática.

Se ainda não existir:
- não invente um sistema enorme agora;
- mas estruture EstadoCarreiraPersistido para suportar entidades geradas futuramente sem quebrar o schema.

==================================================
EXCLUSÃO DE CARREIRA
==================================================

Quando o jogador escolher excluir a carreira:

DELETE /api/carreira
→ remover do PostgreSQL
→ invalidar cookie
→ limpar Zustand

Não deixar dados antigos ativos na memória.

Não usar localStorage.

==================================================
SUBSTITUIÇÃO DE CARREIRA
==================================================

Preserve o comportamento atual que exige confirmação quando já existe uma carreira.

Ao confirmar substituição:

- faça a operação no servidor de forma segura;
- evite momento em que a carreira antiga é apagada e a nova falha antes de ser criada.

Preferencialmente faça a substituição atomicamente/transacionalmente.

==================================================
SEGURANÇA
==================================================

Obrigatório:

- banco somente no servidor;
- DATABASE_URL nunca no browser;
- cookie HttpOnly;
- token aleatório criptograficamente seguro;
- guardar hash do token no banco;
- não logar token;
- não logar DATABASE_URL;
- não logar state completo;
- não retornar stack trace para cliente;
- impedir acesso a save por UUID arbitrário;
- validar payload;
- considerar tamanho máximo razoável para payload de save;
- não permitir prototype pollution ou estruturas inesperadas;
- operações mutáveis somente same-origin.

Não adicionar autenticação nesta tarefa.

==================================================
TESTES OBRIGATÓRIOS
==================================================

Crie testes para esta alteração.

No mínimo:

1. serialização remove dados estáticos;

Criar uma carreira completa, serializar e garantir que o estado persistido não contém:

- escudo;
- foto;
- dadosBrutos;
- catálogo completo dos clubes;
- outras propriedades estáticas identificadas.

2. round-trip:

EstadoCarreira
→ serializar
→ hidratar com snapshots
→ estado equivalente para a simulação.

Os campos dinâmicos devem ser preservados.

3. transferência:

snapshot:
jogador X no clube A

save:
jogador X transferido para clube B

hidratar:
jogador X precisa estar no clube B.

4. evolução:

alterar:
- overall;
- forma;
- contrato;
- valor;
- estatísticas;

serializar/hidratar deve preservar os valores.

5. criação no PostgreSQL.

6. carregamento no PostgreSQL.

7. atualização.

8. exclusão.

9. token errado não acessa save.

10. nenhuma rota permite fornecer UUID arbitrário para acessar outro save.

11. revision antiga não sobrescreve revision nova.

12. erro de DB não destrói save anterior.

13. substituição de carreira é segura.

14. ausência de cookie retorna ausência de carreira normalmente.

15. entidade estática ausente gera erro de compatibilidade e não corrupção silenciosa.

16. localStorage não participa do fluxo.

==================================================
TESTE DE NÃO DUPLICAÇÃO
==================================================

Adicione um teste específico que prove que o PostgreSQL não está recebendo o catálogo estático.

Por exemplo, após persistir uma carreira realista:

- state não deve conter URLs de escudos;
- state não deve conter URLs de fotos;
- state não deve conter dadosBrutos;
- não deve conter cópia integral dos snapshots;
- deve conter IDs suficientes para reconstrução;
- deve conter deltas necessários à simulação.

Não faça simplesmente um teste superficial por tamanho.
Valide semanticamente o formato.

==================================================
TESTE DE RECARREGAMENTO REAL
==================================================

Crie teste de integração equivalente a:

1. criar carreira;
2. banco recebe save;
3. alterar carreira;
4. avançar tempo;
5. realizar alguma alteração dinâmica;
6. salvar;
7. descartar Zustand completamente;
8. carregar novamente a carreira do PostgreSQL;
9. reconstruir a partir dos snapshots;
10. comparar campos importantes.

O estado carregado precisa continuar a carreira corretamente.

==================================================
TESTES EXISTENTES
==================================================

Não quebre testes atuais.

Ao final obrigatoriamente executar:

npm run typecheck

npm test

npm run build

Se criou migration:

npm run db:generate

e validar a migration gerada.

Com DATABASE_URL de DESENVOLVIMENTO configurada:

npm run db:check
npm run db:migrate

NÃO rode migration manual no banco de produção.

O deploy já executa npm run db:migrate automaticamente.

==================================================
ATENÇÃO AO BANCO DE DESENVOLVIMENTO
==================================================

Minha máquina local utiliza:

127.0.0.1:5433

através de túnel SSH para o banco:

viztto_dev

Não altere DATABASE_URL.

Não coloque credenciais em commits.

.env continua ignorado.

==================================================
LOCALSTORAGE — CRITÉRIO DE ACEITE
==================================================

Ao final, pesquise todo o projeto.

O sistema de carreira não pode depender de:

localStorage
sessionStorage
createJSONStorage
persist do Zustand

Se localStorage aparecer apenas em documentação histórica ou alguma funcionalidade completamente diferente da carreira, explique.

Caso contrário, remova.

Não quero uma implementação híbrida.

PostgreSQL será a fonte de verdade.

==================================================
COMPATIBILIDADE COM O ESTADO ATUAL
==================================================

Hoje o usuário está recebendo:

"Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Mantenha esta página aberta."

Esse erro ocorre porque o EstadoCarreira atual ficou grande demais para localStorage depois que várias ligas passaram a fazer parte do universo.

A correção NÃO é:

- reduzir ligas;
- aumentar artificialmente limite;
- compactar o localStorage;
- salvar apenas parte da carreira;
- usar IndexedDB;
- voltar a carregar apenas uma liga.

A correção é substituir a persistência do navegador pela persistência PostgreSQL corretamente normalizada entre:

DADOS ESTÁTICOS DO DEPLOY
e
ESTADO DINÂMICO DA CARREIRA.

==================================================
NÃO ALTERAR SEM NECESSIDADE
==================================================

Não mude:

- regras de partidas;
- cálculo de atributos;
- transferências além do necessário para persistência;
- lógica de contratos;
- calendário;
- progressão;
- layout;
- CSS;
- design da interface;
- snapshots atuais;
- importador Transfermarkt;
- atualização de futebol;
- API Python;
- deployment workflow;
- Nginx;
- PM2.

A tarefa é exclusivamente arquitetura de saves/persistência.

==================================================
DOCUMENTAÇÃO
==================================================

Atualize a documentação para explicar claramente:

1. PostgreSQL é a fonte de verdade do save.
2. Zustand é apenas estado runtime.
3. catálogo de futebol permanece nos snapshots.
4. career_saves contém estado dinâmico.
5. como static + delta formam EstadoCarreira.
6. funcionamento do cookie anônimo.
7. estratégia de revision/autosave.
8. como futuramente adicionar user_id.
9. como adicionar novos campos persistíveis.
10. como decidir se uma propriedade é estática ou dinâmica.
11. fluxo de migration.
12. como testar localmente.

Atualize também qualquer documentação antiga que diga que saves continuam em localStorage.

==================================================
RESULTADO FINAL ESPERADO
==================================================

Depois desta implementação:

- posso criar uma carreira com todas as ligas disponíveis;
- não recebo erro de limite do navegador;
- nenhum save completo vai para localStorage;
- PostgreSQL possui a carreira;
- atualizar a página mantém a carreira;
- fechar e abrir navegador mantém a carreira;
- avançar semanas atualiza o banco;
- transferências permanecem após reload;
- evolução dos jogadores permanece;
- resultados permanecem;
- calendário permanece;
- negociações permanecem;
- notícias/eventos permanecem;
- temporadas permanecem;
- clubes continuam usando seus dados estáticos dos snapshots;
- logos continuam vindo dos snapshots;
- fotos continuam vindo dos snapshots;
- atualizar a base de futebol não cria cópia em cada save;
- cada save armazena somente referências + estado dinâmico;
- Zustand serve apenas para memória/UI;
- o sistema já fica preparado para contas de usuário posteriormente.

==================================================
FORMA DE TRABALHO
==================================================

Antes de editar:

1. analise EstadoCarreira por completo;
2. rastreie todos os lugares que alteram suas propriedades;
3. classifique cada propriedade relevante como:
   - estática/reconstruível;
   - dinâmica/persistível;
   - derivável;
4. analise o atual jogo-store;
5. analise armazenamento.ts;
6. analise validar-save.ts;
7. analise base-futebol.ts;
8. analise as APIs de futebol;
9. analise a infraestrutura PostgreSQL;
10. analise os testes atuais.

Só depois implemente.

Evite patches improvisados.

Quero uma arquitetura definitiva para a persistência da carreira.

==================================================
RELATÓRIO FINAL
==================================================

Ao terminar, apresente:

1. causa original do problema;
2. arquitetura anterior;
3. arquitetura nova;
4. arquivos criados;
5. arquivos alterados;
6. arquivos removidos;
7. migration criada;
8. formato de EstadoCarreiraPersistido;
9. quais dados ficaram fora do PostgreSQL;
10. quais dados entram no PostgreSQL;
11. funcionamento do cookie;
12. funcionamento do autosave;
13. funcionamento da revision;
14. como ocorre hidratação;
15. como é tratada transferência de NPCs;
16. como é tratada incompatibilidade com snapshots;
17. testes adicionados;
18. resultados de typecheck/test/build;
19. resultado de db:check/db:migrate no banco de desenvolvimento;
20. tamanho aproximado de um save persistido;
21. confirmação de que a carreira não usa mais localStorage;
22. riscos ou limitações restantes.

NÃO faça commit.
NÃO faça push.
NÃO faça deploy.

Pare após implementar, testar e apresentar o relatório para revisão.