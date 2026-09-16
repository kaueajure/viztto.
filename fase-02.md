Analise o repositório atual do **viztto** antes de alterar qualquer coisa.

Repositório:

https://github.com/kaueajure/viztto.

O objetivo desta etapa é implementar as **5 principais evoluções estruturais do jogo**, sem reconstruir sistemas que já funcionam.

O viztto já possui uma base importante de:

* criação de carreira;
* jogador do usuário;
* atributos;
* potencial;
* moral;
* confiança;
* treinamento;
* partidas simuladas;
* calendário;
* classificação;
* contratos;
* transferências;
* lesões;
* notícias;
* temporadas;
* histórico;
* persistência;
* integração com Transfermarkt API.

Preserve essa fundação.

Não reescreva motor de partidas, evolução, calendário, classificação ou persistência sem uma razão técnica concreta.

Quero evoluir o jogo para que ele deixe de simular apenas a carreira do usuário e passe a simular **um mundo de futebol vivo**.

Implemente as seguintes 5 etapas, nesta ordem.

---

# 1. TRANSFORMAR OS ELENCOS IMPORTADOS EM JOGADORES REAIS DO MUNDO

Atualmente os dados importados de clubes/elencos precisam passar a fazer parte real da simulação.

Cada jogador importado deve virar uma entidade persistente dentro do mundo do viztto.

Crie uma entidade adequada, como:

```ts
JogadorMundo
```

Ela não precisa possuir inicialmente a mesma complexidade do jogador controlado pelo usuário.

Ela deve conter pelo menos:

```ts
interface JogadorMundo {
  id: string
  idExterno?: string

  nome: string
  dataNascimento?: string
  idade: number

  nacionalidade?: string

  posicaoPrincipal: Posicao
  posicoesSecundarias: Posicao[]

  peDominante?: PeDominante

  clubeId: string | null

  overall: number
  potencial: number

  forma: number
  moral: number
  condicionamento: number

  valorMercado: number

  salario?: number

  contrato?: {
    inicio?: string
    fim?: string
  }

  lesionado: boolean
  lesaoAtual?: Lesao

  statusElenco: StatusElenco

  estatisticasCarreira: EstatisticasJogador
}
```

Adapte isso à arquitetura atual.

Não duplique tipos existentes desnecessariamente.

---

## Dados importados

Use os dados reais provenientes da Transfermarkt API como base para:

* nome;
* idade;
* posição;
* nacionalidade;
* altura quando disponível;
* pé dominante;
* valor de mercado;
* contrato;
* clube;
* número da camisa;
* demais informações relevantes.

Não invente dados que a API já fornece.

---

## Overall

Como a API não fornece overall de videogame, o viztto deve gerar um overall inicial coerente.

Não faça:

```ts
overall = valorMercado / constante
```

Crie uma função que considere:

* valor de mercado;
* idade;
* reputação do clube;
* reputação da liga;
* posição;
* status aparente do jogador;
* contexto do elenco.

Por exemplo:

um titular valioso da Premier League deve naturalmente ter overall maior do que um reserva jovem de uma divisão menor.

Mas mantenha variabilidade.

---

## Potencial

O potencial também deve ser interno.

Considere:

* idade;
* overall;
* valor;
* liga;
* perfil de jovem promessa.

Um jogador de 18 anos pode ter:

```text
overall 67
potencial 86
```

Um jogador de 34:

```text
overall 82
potencial 82
```

Não mostrar obrigatoriamente o valor exato ao usuário.

---

## Persistência

Esses jogadores precisam fazer parte do save.

Uma carreira iniciada deve possuir seu próprio snapshot.

Depois que a carreira começa:

**não atualizar automaticamente jogadores com mudanças reais vindas da API.**

O universo passa a pertencer ao viztto.

---

# 2. FORMAÇÃO, ESCALAÇÃO E CONCORRÊNCIA REAL

Depois de transformar jogadores importados em entidades reais, refaça o sistema de escalação para utilizar os jogadores reais do elenco.

Não quero mais uma concorrência abstrata baseada apenas em:

```text
força do setor
```

O usuário precisa disputar posição contra jogadores específicos.

Exemplo:

```text
PONTA DIREITA

Jogador A — OVR 82
Jogador do usuário — OVR 70
Jogador C — OVR 66
```

---

## Formação

Cada clube deve possuir:

```ts
formacaoPreferida
```

Exemplos:

* 4-3-3
* 4-2-3-1
* 4-4-2
* 4-1-4-1
* 3-4-3
* 3-5-2
* 4-2-2-2
* 4-3-1-2

Utilize o sistema de formação existente, se já houver.

Não reimplemente o que já funciona.

---

## Seleção dos titulares

Crie um sistema para escolher:

```text
11 titulares
+
banco
+
não relacionados
```

Considere:

* overall;
* posição;
* compatibilidade posicional;
* forma;
* moral;
* condicionamento;
* fadiga;
* lesão;
* suspensão;
* confiança do treinador;
* status no elenco.

---

## Compatibilidade posicional

Não permitir escalações absurdas.

Exemplo:

um goleiro não deve jogar de centroavante.

Um ponta pode eventualmente jogar como meia ofensivo se houver compatibilidade.

Crie pesos.

Exemplo conceitual:

```text
posição natural
100%

posição secundária
90%

posição semelhante
75%

posição improvisada
50%

incompatível
0–20%
```

---

## Jogador controlado pelo usuário

O jogador humano deve ser tratado pela mesma lógica.

Não garantir titularidade.

Ele pode ser:

* titular;
* reserva;
* não relacionado.

Se existir um jogador melhor na posição, isso deve importar.

---

## Tela de equipe

Atualize a tela da equipe para mostrar claramente:

### ELENCO

Lista real de jogadores.

### FORMAÇÃO

Campo visual com os onze titulares.

### BANCO

Reservas selecionados.

### CONCORRÊNCIA

Na posição do usuário, mostrar pelo menos os principais concorrentes.

Exemplo:

```text
Ponta direita

1. Raphinha — 84
2. Kauê — 76
3. Jogador X — 72
```

Não transformar isso em ranking artificial fixo.

A ordem deve vir da avaliação do treinador.

---

# 3. FAZER A ESCALAÇÃO ALTERAR A FORÇA REAL DO TIME

Atualmente a força de um clube não pode continuar sendo apenas um valor fixo.

A força da equipe em uma partida deve depender dos jogadores efetivamente escalados.

Crie algo como:

```text
força da escalação
```

calculada a partir dos onze titulares.

---

## Componentes

Calcule separadamente:

```text
forçaAtaque
forçaMeio
forçaDefesa
forçaGoleiro
```

Considere:

* overall;
* posição;
* adequação à posição;
* forma;
* moral;
* condicionamento;
* fadiga.

---

## Exemplo

Se um clube tem:

```text
atacante titular = OVR 90
```

e ele se lesiona, entrando:

```text
reserva = OVR 72
```

a força ofensiva precisa diminuir.

Isso deve impactar o motor de partidas.

---

## Usuário

Se o personagem controlado pelo jogador se tornar uma estrela mundial:

```text
OVR 92
```

sua presença deve tornar o time melhor.

Se ele estiver:

* lesionado;
* suspenso;
* cansado;
* no banco;

isso também deve alterar o time.

---

## Identidade do clube

Não elimine completamente atributos institucionais.

A força final pode considerar:

```text
qualidade da escalação
+
qualidade do treinador
+
entrosamento
+
mando
+
forma coletiva
+
estrutura do clube
```

Mas os jogadores escalados devem passar a ser a maior influência.

---

# 4. CRIAR UM MUNDO COM MÚLTIPLAS LIGAS SIMULTÂNEAS

O viztto não deve simular apenas a liga do jogador.

Quero um mundo em que várias competições existam simultaneamente.

Começar com:

```text
Brasil
- Série A
- Série B

Inglaterra
- Premier League

Espanha
- La Liga

Itália
- Serie A

Alemanha
- Bundesliga

França
- Ligue 1
```

Se alguns dados ainda não estiverem disponíveis, implemente a arquitetura e carregue as ligas disponíveis atualmente.

---

## Estado mundial

Crie uma estrutura global coerente.

Exemplo:

```ts
interface MundoFutebol {
  temporada: number

  ligas: Liga[]
  clubes: Clube[]
  jogadores: JogadorMundo[]

  competicoes: Competicao[]
}
```

Adapte à estrutura existente.

---

## Níveis de simulação

Não é necessário simular cada liga com o mesmo nível de detalhe.

Use níveis.

### Liga do jogador

Simulação detalhada:

* partidas;
* escalações;
* estatísticas;
* eventos;
* jogadores;
* tabela.

### Grandes ligas externas

Simulação intermediária:

* resultados;
* escalação simplificada;
* tabela;
* evolução;
* transferências;
* estatísticas principais.

### Competições secundárias futuramente

Simulação estatística simplificada.

---

## Calendário global

Não precisa processar cada segundo.

O mundo avança conforme o calendário do jogo.

Quando o usuário avança uma semana:

```text
processar liga do usuário
↓
processar outras ligas
↓
evoluir jogadores
↓
processar mercado
↓
processar lesões
↓
atualizar tabelas
```

---

## Performance

Não use timers reais.

Não faça polling.

Tudo deve ser determinístico e processado em lote.

Mantenha RNG central.

Não espalhe `Math.random()`.

---

## Séries A e B

Prepare especialmente Brasil para:

```text
Série A
Série B
```

Isso será utilizado futuramente para promoção/rebaixamento.

Mesmo que promoção/rebaixamento completo fique para próxima etapa, a arquitetura já deve suportar duas divisões.

---

# 5. RECONSTRUIR O MERCADO PARA FUNCIONAR ENTRE CLUBES E LIGAS

Depois de existirem jogadores reais e múltiplas ligas, refatore o mercado de transferências.

Não quero propostas quase aleatórias.

Um clube deve contratar alguém porque **precisa daquele jogador**.

---

## Necessidade do elenco

Cada clube deve analisar sua equipe.

Por posição:

```text
quantidade
qualidade
idade
contratos
lesões
```

Exemplo:

```text
Barcelona

PD:
OVR 84
OVR 68

necessidade: média

ATA:
OVR 71
OVR 69

necessidade: alta
```

Então o mercado deve buscar jogadores compatíveis.

---

## Interesse

Calcular interesse usando:

* posição necessária;
* overall;
* potencial;
* idade;
* forma;
* desempenho;
* reputação;
* valor de mercado;
* salário;
* contrato atual;
* qualidade da liga;
* qualidade do clube atual.

---

## Reputação

Crie relação coerente entre:

```text
reputacaoJogador
reputacaoClube
reputacaoLiga
```

Um jogador desconhecido de overall baixo não deve receber proposta do Real Madrid normalmente.

Pode existir exceção para um jovem extremamente promissor, mas precisa ser rara.

---

## Etapas da transferência

Não transferir imediatamente ao gerar interesse.

Criar estados.

Exemplo:

```text
INTERESSE
↓
SONDAGEM
↓
PROPOSTA AO CLUBE
↓
NEGOCIAÇÃO
↓
ACORDO
↓
PROPOSTA AO JOGADOR
↓
ACEITE/REJEIÇÃO
↓
TRANSFERÊNCIA
```

---

## Contrato

A oferta deve conter:

* salário;
* duração;
* status prometido;
* bônus futuramente;
* cláusulas futuramente.

Exemplo:

```text
Arsenal

Contrato: 5 anos
Salário: €75.000/semana
Papel: Rotação
```

O jogador precisa decidir.

---

## Status prometido

Opções:

* promessa;
* reserva;
* rotação;
* titular;
* jogador importante;
* estrela.

Isso deve afetar decisão e moral futura.

---

## Janelas de transferência

Adicionar:

```text
janela de verão
janela de inverno
```

Mercado normal deve acontecer principalmente durante janelas.

Sondagens podem ocorrer fora delas.

---

## Transferências entre NPCs

Muito importante:

clubes controlados pelo jogo também devem comprar e vender jogadores entre si.

Exemplo:

```text
Liverpool vende atacante
↓
fica com necessidade na posição
↓
busca substituto
↓
compra jogador da Bundesliga
```

O mundo precisa continuar funcionando independentemente do usuário.

---

## Orçamento

Cada clube deve possuir capacidade financeira aproximada.

Não precisa replicar contabilidade real.

Mas:

```text
clube pequeno
```

não pode comprar:

```text
jogador de €150 milhões
```

sem contexto.

---

# 6. SISTEMA DE DECISÕES E RELACIONAMENTOS

Esta é a quinta grande evolução de experiência.

Depois de melhorar o mundo, quero quebrar o loop:

```text
avançar semana
→ ver resultado
→ avançar semana
```

Crie um sistema extensível de decisões.

---

## Personagens

Começar com:

```text
Treinador
Agente
Diretoria
Departamento médico
Imprensa
```

Posteriormente pode existir:

* companheiros;
* torcida;
* seleção.

---

# TREINADOR

Transforme treinador em entidade.

Exemplo:

```ts
interface Treinador {
  id: string
  nome: string

  formacaoPreferida: Formacao
  estilo: EstiloTatico

  preferenciaJovens: number
  disciplina: number
  rotacao: number
  paciencia: number
}
```

Pode ser inicialmente fictício.

O treinador deve influenciar:

* formação;
* escalação;
* confiança;
* minutos;
* posição utilizada.

---

## Troca de treinador

Prepare arquitetura para que treinadores possam ser substituídos futuramente.

Isso pode alterar completamente a situação do jogador.

Exemplo:

```text
Treinador antigo:
4-3-3
usa pontas

Novo treinador:
3-5-2
não usa ponta
```

Isso deve gerar consequência para a carreira.

---

# AGENTE

Adicionar um agente simples.

Ele pode:

* informar interesse;
* sugerir transferência;
* negociar;
* recomendar renovação;
* avisar sobre mercado.

Não precisa de sistema complexo inicialmente.

---

# DECISÕES

Criar eventos com opções reais.

Exemplo:

```text
TREINADOR

Quero testar você como ponta esquerda durante algumas partidas.

[ACEITAR]

[RECUSAR]
```

Consequências:

```text
aceitar
→ versatilidade aumenta
→ chance de minutos sobe

recusar
→ mantém foco na posição
→ confiança pode cair um pouco
```

---

Outro exemplo:

```text
AGENTE

O Benfica demonstrou interesse em você.

[OUVIR PROPOSTA]

[QUERO FICAR]

[SÓ ME AVISE DE CLUBES MAIORES]
```

---

Outro:

```text
MÉDICO

Você está com fadiga elevada antes do clássico.

[JOGAR]

[PEDIR DESCANSO]
```

---

## Consequências

Toda decisão precisa poder alterar:

* moral;
* confiança;
* reputação;
* relacionamento;
* desenvolvimento;
* mercado;
* minutos;
* eventos futuros.

Não criar escolhas falsas.

---

# RELACIONAMENTOS

Adicionar valores como:

```text
relacaoTreinador
relacaoDiretoria
relacaoAgente
```

Escala interna pode ser:

```text
0–100
```

Não mostrar necessariamente o número exato.

Interface pode mostrar:

```text
Excelente
Boa
Neutra
Ruim
Péssima
```

---

# EVENTOS

Criar sistema de eventos baseado em condições.

Não totalmente aleatório.

Exemplo:

```text
if confiançaTreinador > 80
AND jogador jovem
AND forma alta
```

pode gerar:

```text
"Treinador pretende aumentar seu papel no elenco."
```

Outro:

```text
contrato termina em menos de 12 meses
```

gera:

```text
"Clube deseja iniciar negociação."
```

---

# NOTÍCIAS

Aproveite o sistema atual.

Decisões e eventos importantes devem gerar notícias.

Exemplo:

```text
Kauê recusa renovação e futuro no clube vira dúvida.
```

Não precisa de IA externa.

Use templates variados.

---

# 7. EVOLUÇÃO DOS OUTROS JOGADORES

Muito importante:

JogadorMundo não pode ficar congelado.

Ao final de semanas/temporadas:

* jovens evoluem;
* veteranos declinam;
* jogadores lesionam;
* forma muda;
* valor muda;
* contratos expiram.

Não precisa executar o mesmo motor detalhado do usuário para milhares de jogadores.

Crie versão otimizada.

Exemplo:

```text
Jogador usuário
→ simulação completa

Jogadores do mesmo clube
→ simulação detalhada

Outros jogadores
→ simulação simplificada
```

---

# 8. APOSENTADORIA E NOVOS JOGADORES

Prepare arquitetura.

Quando um jogador envelhecer:

```text
34
35
36
...
```

pode decidir aposentar.

Não precisa implementar uma geração mundial completa agora se tornar a etapa grande demais.

Mas não modele JogadorMundo de forma que isso fique impossível.

---

# 9. PERFORMANCE

O mundo poderá ter milhares de jogadores.

Portanto:

não faça loops desnecessariamente caros em cada render React.

Toda simulação deve acontecer fora da interface.

Evite:

```text
useEffect
→ simulação mundial
```

A interface deve apenas mostrar estado.

Processamento deve acontecer nos casos de uso/motor.

---

# 10. PERSISTÊNCIA

O save ficará muito maior.

Revise a estratégia atual.

Não migrar para banco de dados ainda.

Mas:

* manter versão do save;
* suportar migração;
* evitar duplicação;
* não persistir dados derivados desnecessariamente quando puderem ser recalculados;
* continuar funcionando ao recarregar navegador.

---

# 11. UI

Não transforme as novas funcionalidades em dezenas de cards genéricos.

Preserve a identidade de simulador de futebol.

Adicionar principalmente:

## Tela Clube

```text
VISÃO GERAL
ELENCO
FORMAÇÃO
```

## Tela Jogador

Adicionar:

```text
Concorrência
Relacionamentos
Contrato
```

## Mercado

Adicionar:

```text
Interesse
Propostas
Histórico
```

## Inbox

Adicionar mensagens de:

```text
Treinador
Agente
Diretoria
Médico
```

---

# 12. NÃO IMPLEMENTAR AGORA

Não desvie o foco para:

* Champions League completa;
* Libertadores completa;
* Copa do Mundo;
* seleção;
* vida pessoal;
* patrocinadores;
* redes sociais;
* casas;
* carros;
* relacionamentos amorosos;
* entrevistas complexas.

Esses recursos ficam para depois.

O foco desta etapa é criar um **mundo de futebol vivo**.

---

# 13. MIGRAÇÃO DA INTEGRAÇÃO TRANSFERMARKT

Aproveite esta etapa para revisar código antigo relacionado a APIs anteriores.

O projeto deve utilizar atualmente:

```text
Transfermarkt API
```

como fonte de bootstrap.

Remova código morto relacionado a:

* football-data.org;
* API-Football/API-Sports;

caso ainda exista.

Atualize:

* README;
* ARQUITETURA.md;
* `.env.example`;
* comentários;
* documentação.

Não deixe documentação afirmando que a API-Football ainda é utilizada se não for verdade.

---

# 14. TEMPORADA

Estamos em 2026.

As ligas europeias devem considerar a temporada:

```text
2026/27
```

quando os dados atuais forem importados.

Brasileirão:

```text
2026
```

Não deixe código preso em:

```text
2025/26
```

---

# 15. TESTES

Amplie testes para cobrir pelo menos:

### Jogadores do mundo

* criação;
* overall;
* potencial;
* evolução;
* declínio.

### Escalação

* formação válida;
* jogadores corretos nas posições;
* jogador lesionado não entra;
* melhor jogador tende a ser titular.

### Força

* perder estrela reduz força;
* substituir jogador melhora/piora setor.

### Mundo

* múltiplas ligas avançam;
* tabelas atualizam independentemente.

### Mercado

* clube identifica posição carente;
* proposta respeita reputação;
* orçamento limita contratação;
* NPCs fazem transferências.

### Decisões

* opções geram consequências;
* eventos condicionais são reproduzíveis com seed.

---

# 16. ORDEM DE IMPLEMENTAÇÃO

Não implemente tudo misturado.

Use esta ordem:

## ETAPA 1

JogadorMundo + elencos reais.

Teste.

## ETAPA 2

Formação + escalação + concorrência.

Teste.

## ETAPA 3

Força da equipe derivada dos jogadores.

Teste.

## ETAPA 4

Múltiplas ligas simultâneas.

Teste performance e consistência.

## ETAPA 5

Mercado entre clubes/ligas.

Teste.

## ETAPA 6

Treinador + agente + decisões + relacionamentos.

Teste o loop completo.

---

# 17. CRITÉRIOS DE ACEITAÇÃO

Considere essa evolução concluída quando eu conseguir:

1. iniciar carreira em um clube real;
2. abrir o elenco e ver jogadores reais;
3. visualizar os titulares e banco;
4. ver quem disputa minha posição;
5. perder titularidade para um jogador melhor;
6. ganhar a posição após boas atuações;
7. perceber que lesões alteram a força do time;
8. acompanhar outras ligas acontecendo simultaneamente;
9. ver jogadores de outros clubes evoluindo;
10. ver transferências entre clubes controlados pela IA;
11. receber interesse realista de clubes de outras ligas;
12. negociar contrato;
13. interagir com treinador/agente;
14. tomar decisões que geram consequências;
15. avançar várias temporadas sem o mundo ficar congelado.

---

# 18. PRINCÍPIO CENTRAL

O objetivo desta etapa não é adicionar quantidade de telas.

É transformar:

```text
simulador da carreira do usuário
```

em:

```text
simulador de um mundo de futebol
onde o usuário é apenas um dos jogadores
```

O mundo precisa continuar evoluindo mesmo quando o usuário não está envolvido diretamente.

Antes de alterar o código:

1. faça uma auditoria rápida da implementação atual;
2. identifique quais partes dessas funcionalidades já existem;
3. reaproveite tudo que estiver correto;
4. evite duplicação;
5. faça as alterações incrementalmente;
6. rode testes após cada etapa;
7. corrija regressões antes de avançar.

Não faça uma reescrita geral do projeto.

E, durante a implementação, mantenha toda a arquitetura, nomenclatura de domínio e código próprio do projeto em **português-BR**, conforme o padrão atual do viztto.
