Analise o sistema atual de transferências do **viztto** e corrija a lógica para que propostas deixem de chegar de forma aleatória ou sem contexto.

Hoje existe um problema importante: clubes podem demonstrar interesse muito cedo, inclusive no primeiro mês da primeira temporada, sem motivo esportivo real.

Quero transformar o mercado em um sistema baseado em **necessidade real, interesse progressivo e negociação**.

Não reconstrua partes que já funcionam. Refatore apenas o necessário.

## 1. Clubes não devem enviar propostas aleatórias

Uma proposta de transferência só deve surgir quando houver uma justificativa coerente.

Antes de um clube demonstrar interesse, analise:

* posição do jogador;
* idade;
* overall;
* potencial percebido;
* reputação;
* minutos jogados;
* forma recente;
* desempenho;
* gols/assistências de acordo com a posição;
* importância no clube atual;
* duração do contrato;
* valor de mercado;
* liga atual;
* reputação do clube interessado;
* orçamento;
* qualidade do elenco interessado;
* necessidade naquela posição.

O clube interessado também precisa analisar seu próprio elenco.

Exemplo:

```text
Liverpool

Ponta direita:
Jogador A — 84 OVR — 31 anos
Jogador B — 72 OVR — 19 anos

Necessidade:
Média
```

Nesse caso, o clube pode procurar:

* um titular;
* um substituto futuro;
* uma promessa.

Outro exemplo:

```text
Clube X

Centroavante titular lesionado por 5 meses
Reserva = 67 OVR
```

A necessidade por atacante deve aumentar significativamente.

## 2. Criar diferentes motivos de contratação

Um clube pode querer o jogador como:

* promessa;
* opção para o futuro;
* reserva;
* rotação;
* titular;
* jogador importante;
* estrela.

Isso precisa fazer sentido com o elenco atual.

Exemplo:

Jogador de 17 anos, OVR 65, potencial alto:

```text
Real Madrid
→ pode ter interesse como promessa
→ NÃO deve necessariamente oferecer papel de titular
```

Jogador de 25 anos, OVR 87:

```text
clube grande com carência na posição
→ pode querer como titular
```

O papel oferecido deve fazer parte da proposta.

## 3. Impedir propostas precoces sem motivo

Não bloqueie artificialmente o primeiro mês, mas torne propostas precoces raras.

No início da carreira, o jogador normalmente ainda possui poucos dados esportivos.

Para existir interesse logo nas primeiras semanas, deve haver alguma justificativa forte, como:

* reputação inicial alta;
* grande potencial;
* jogador já conhecido;
* necessidade urgente do clube;
* contrato próximo do fim;
* desempenho excepcional;
* clube já observava o jogador anteriormente.

Caso contrário, o sistema deve esperar o jogador construir histórico.

Crie uma lógica de `interesse acumulado`.

Exemplo:

```text
observação
↓
interesse inicial
↓
acompanhamento
↓
interesse sério
↓
sondagem
↓
proposta
```

Não transforme interesse diretamente em proposta.

## 4. Sistema de observação

Clubes interessados devem poder acompanhar o jogador durante semanas ou meses.

Guardar algo como:

```ts
interface InteresseClube {
  clubeId: string
  jogadorId: string

  nivelInteresse: number
  motivo: MotivoInteresse

  semanasObservando: number

  status:
    | "observando"
    | "interessado"
    | "sondagem"
    | "negociando"
    | "encerrado"
}
```

Boas atuações podem aumentar o interesse.

Atuações ruins podem reduzir.

Uma lesão longa pode esfriar negociações.

## 5. Eu também quero poder buscar uma transferência

Adicionar um sistema envolvendo o **agente do jogador**.

Na tela relacionada ao agente/mercado, quero uma opção como:

`CONVERSAR COM AGENTE`

E depois:

`Tenho interesse em outro clube`

O jogador pode selecionar um clube que gostaria de defender.

Exemplo:

```text
Quero jogar no Barcelona.
```

Isso NÃO significa que o Barcelona automaticamente fará uma proposta.

O agente deve tentar abrir contato.

Fluxo:

```text
Jogador
↓
conversa com agente
↓
escolhe clube desejado
↓
agente entra em contato
↓
clube analisa jogador
↓
aceita conversar OU rejeita
```

## 6. Clube precisa analisar o pedido

Quando o agente entrar em contato, o clube deve analisar de verdade:

* jogador é bom o suficiente?
* possui potencial interessante?
* precisa daquela posição?
* já possui jogadores melhores?
* cabe no orçamento?
* reputação é compatível?
* jogador teria espaço?
* clube considera o jogador uma promessa?
* valor pedido é aceitável?
* salário esperado cabe na folha?

Possíveis respostas:

```text
Sem interesse
```

```text
Estamos acompanhando, mas não queremos negociar agora
```

```text
Aceitamos conversar
```

```text
Interessados apenas em empréstimo
```

```text
Interessados como promessa
```

Não garantir sucesso só porque o usuário escolheu o clube.

## 7. Negociação contratual

Quando um clube desejar contratar o jogador, não concluir a transferência imediatamente.

Criar uma negociação de contrato.

O clube deve fazer uma oferta contendo:

* duração do contrato;
* salário;
* papel no elenco;
* bônus quando aplicável;
* cláusula de rescisão quando fizer sentido;
* luvas opcionalmente;
* bônus por jogos/gols futuramente.

Exemplo:

```text
BENFICA

Contrato:
4 anos

Salário:
€32.000 / semana

Papel:
Rotação

Cláusula:
€50 milhões
```

## 8. Contraproposta do jogador

O jogador pode:

* aceitar;
* rejeitar;
* fazer contraproposta.

Na contraproposta deve poder alterar pelo menos:

* salário;
* duração do contrato;
* papel esperado;
* cláusula de rescisão quando aplicável.

Exemplo:

Clube:

```text
€35 mil/semana
4 anos
Rotação
```

Jogador responde:

```text
€45 mil/semana
3 anos
Titular
```

O clube deve analisar.

Não aceitar automaticamente.

## 9. Clube também faz contraproposta

Se a exigência for próxima do aceitável, o clube pode responder:

```text
Não aceitamos €45 mil.

Podemos oferecer:

€40 mil
4 anos
Rotação
```

A negociação pode possuir várias rodadas.

Mas limite para não criar loop infinito.

Por exemplo:

```text
máximo 3 ou 4 rodadas
```

## 10. Clube pode abandonar negociação

Se o jogador exigir algo absurdo:

```text
jogador OVR 68
exige salário de estrela mundial
```

o clube pode:

```text
encerrar negociação
```

Isso deve gerar consequência.

O interesse pode cair.

O agente pode avisar:

> O clube decidiu encerrar as conversas após considerar suas exigências incompatíveis.

## 11. Papel no elenco precisa ser real

Se o clube promete:

`Titular`

isso deve influenciar posteriormente a expectativa.

Se o jogador chega e quase não joga, pode perder moral e reclamar.

Da mesma forma:

`Promessa`

não significa titularidade imediata.

Utilizar:

* promessa;
* reserva;
* rotação;
* titular;
* jogador importante;
* estrela.

## 12. Propostas recebidas

A mesma lógica deve ser usada quando o interesse parte do clube.

Fluxo:

```text
clube identifica necessidade
↓
observa jogador
↓
aumenta interesse
↓
faz sondagem
↓
decide avançar
↓
negociação com clube atual
↓
negociação contratual com jogador
```

Depois o jogador pode:

* aceitar;
* rejeitar;
* negociar.

## 13. Clube atual também participa

Se o jogador ainda possui contrato, o clube interessado precisa negociar sua contratação com o clube atual.

Considere:

* valor de mercado;
* duração contratual;
* importância do jogador;
* necessidade financeira;
* desejo do jogador de sair;
* tamanho da proposta.

O clube atual pode:

* aceitar;
* rejeitar;
* pedir mais dinheiro.

Não precisa criar uma interface extremamente complexa para essa negociação, mas o motor deve considerar isso.

## 14. Pedido de transferência

Adicionar possibilidade de o jogador falar com o agente:

`Quero sair do clube`

Isso pode:

* aumentar chances do agente buscar opções;
* diminuir disposição para renovar;
* afetar moral;
* eventualmente afetar relação com treinador/diretoria se virar público.

Não significa transferência automática.

## 15. Preferências do jogador

O usuário pode conversar com o agente e definir preferências como:

* quero permanecer no país;
* quero jogar na Europa;
* quero clube maior;
* quero mais minutos;
* quero salário maior;
* quero disputar títulos;
* quero apenas estes clubes.

O agente usa isso para filtrar oportunidades.

## 16. Janelas

Respeitar janelas de transferência.

Fora da janela:

* clubes podem observar;
* sondar;
* negociar pré-contratos quando permitido;
* demonstrar interesse.

Mas transferências normais acontecem principalmente dentro das janelas.

## 17. Interface

Crie uma experiência de mercado semelhante a jogo de futebol, não dashboard SaaS.

Na tela Mercado/Agente, adicionar algo como:

```text
MERCADO

INTERESSES
PROPOSTAS
MEU AGENTE
HISTÓRICO
```

Dentro de `MEU AGENTE`:

```text
Buscar transferência

Definir clubes desejados

Definir preferência de carreira

Pedir para sair
```

## 18. Histórico de negociação

Guardar eventos importantes.

Exemplo:

```text
12/01/2028
Benfica iniciou conversas.

15/01/2028
Oferta recebida.

16/01/2028
Jogador apresentou contraproposta.

18/01/2028
Benfica aceitou os termos.
```

Isso ajuda muito na sensação de carreira.

## 19. Realismo

Evitar situações como:

* clube gigante contratando jogador fraco sem razão;
* três clubes fazendo propostas na primeira semana;
* clube com 5 ótimos jogadores na posição buscando mais um titular;
* salário incompatível com nível do clube;
* transferências acontecendo fora das janelas sem motivo;
* negociação concluída instantaneamente;
* propostas aleatórias toda semana.

## 20. Testes

Adicionar testes para pelo menos:

* necessidade por posição;
* interesse baseado no elenco;
* promessa jovem;
* desfalque aumentando interesse;
* jogador oferecendo-se através do agente;
* clube rejeitando jogador incompatível;
* clube aceitando abrir negociação;
* contraproposta;
* exigência absurda encerrando negociação;
* papel no elenco;
* proposta respeitando orçamento;
* interesse acumulando ao longo do tempo.

## Resultado esperado

Quero que uma transferência pareça uma história.

Exemplo:

```text
SETEMBRO

Arsenal começou a acompanhar Kauê.

OUTUBRO

Boa sequência de atuações aumentou o interesse.

NOVEMBRO

Agente informa que Arsenal fez contato inicial.

JANEIRO

Arsenal apresenta proposta ao clube.

Clube aceita negociar.

Arsenal oferece:
€55 mil/semana
5 anos
Rotação

Kauê pede:
€68 mil
4 anos
Titular

Arsenal responde:
€62 mil
4 anos
Rotação

Kauê aceita.

TRANSFERÊNCIA CONCLUÍDA.
```

E também deve funcionar ao contrário:

```text
Kauê pede ao agente contato com Barcelona.

Agente entra em contato.

Barcelona analisa elenco.

Barcelona possui três pontas melhores e não identifica necessidade.

Resposta:

"Neste momento o clube não pretende avançar por sua contratação."
```

Isso é exatamente o comportamento desejado.

Antes de alterar o código, analise o mercado existente, reaproveite regras válidas e faça a evolução incrementalmente.

Não transforme transferência em evento aleatório.

Ela deve ser consequência de:

**necessidade do clube + qualidade do jogador + contexto esportivo + financeiro + negociação.**
