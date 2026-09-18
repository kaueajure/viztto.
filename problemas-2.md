1. Existe um botão realmente sem funcionar

Na tela:

Desempenho
→ Última partida
→ Ver cronologia e detalhes

o componente recebe:

abrirDetalhes={() => undefined}

Então clicar não faz absolutamente nada.

Foi o único botão explicitamente morto que encontrei na busca pelos handlers atuais.

Na Home, a mesma funcionalidade está corretamente conectada ao resumo da partida.

Na página Desempenho ela precisa abrir ResumoPartida também, ou o botão deve ser removido.

Eu abriria o resumo.

2. O alerta principal está mandando o jogador usar uma funcionalidade que não existe mais

Este é outro problema importante.

AtencaoCarreira.tsx ainda cria:

AÇÃO NECESSÁRIA

Defina seu plano de desenvolvimento

Ou treine direto no Centro de Treinamento.

[Ir ao centro]

O próprio comentário no código diz:

Plano legado

Mas para uma carreira nova planoId tende a ser null.

Resultado: o jogo pode continuamente dizer que existe uma ação necessária:

Defina seu plano de desenvolvimento.

Só que o novo Centro não possui mais esse sistema.

Isso deve sair completamente.

O treinamento é opcional e jogável. Não deveria permanecer uma pendência obrigatória toda semana.

3. Existem componentes inteiros do sistema antigo mortos no projeto

Confirmei que:

PlanoDesenvolvimento.tsx
CentralSemana.tsx

não são usados pela aplicação atual.

PlanoDesenvolvimento nem sequer é importado por uma tela ativa.

Além disso, o store continua expondo:

configurarDesenvolvimento
escolherTreino

mas nenhuma interface ativa os usa.

Eu faria uma limpeza consciente:

UI antiga → remover

ações de store sem consumidor → remover/refatorar

campos persistidos antigos → manter somente para migração, sem efeito gameplay

Isso evitaria justamente os bugs de mecânica fantasma que encontrei.

4. A conversa com o treinador tem ações demais e várias não fazem sentido no contexto

Hoje são sempre exibidas aproximadamente oito ações:

Por que não estou jogando?
Pedir mais oportunidades
O que preciso melhorar?
Conversar sobre meu papel
Pedir teste em outra posição
Aceitar meu papel atual
Reclamar da falta de minutos
Cobrar promessa não cumprida

Algumas são desabilitadas corretamente, mas várias aparecem mesmo em estados absurdos.

Exemplo:

Status:
ESTRELA DO TIME
titular absoluto

botão:
“Por que não estou jogando?”

Ou:

Titular há 15 partidas

“Reclamar da falta de minutos”

Ou:

Papel já aceito

“Aceitar meu papel atual”

O backend impede algumas explorações, mas a interface deveria ser contextual.

Eu não mostraria todas as possíveis frases como um painel de debug.

Exemplo para reserva:

CONVERSAR COM O TREINADOR

Por que não estou jogando?
Pedir uma oportunidade
O que preciso melhorar?
Testar outra posição

Para titular:

Conversar sobre meu papel
O que posso melhorar?
Testar outra posição

Se promessa descumprida:

⚠ Cobrar promessa não cumprida

Assim a conversa parece uma conversa, não uma API de oito métodos.

5. O jogo expõe “cooldown” como se fosse ferramenta administrativa

Na conversa com o técnico aparece algo como:

Cooldowns por tipo:
informativa até 14/09
pedido até 21/09
posicional até 18/09

Isso é linguagem de desenvolvimento.

Não deveria aparecer para o jogador.

Melhor:

Você conversou recentemente sobre oportunidades.
O treinador prefere retomar esse assunto na próxima semana.

Ou desabilitar a ação individual e mostrar:

Disponível em 2 semanas

embaixo dela.

Sem “categoria informativa”, “categoria posicional”, etc.

6. O sistema de contrato está espalhado em três lugares

Hoje é possível chegar à mesma interação de contrato em:

CLUBE
→ ConversaContrato

TRANSFERÊNCIAS
→ Meu agente
→ ConversaContrato

CONTRATO
→ ConversaContrato

Ou seja, a mesma funcionalidade em três locais.

Isso é uma das maiores fontes de sensação de sistema confuso.

Eu escolheria:

CONTRATO

como local canônico para:

Renovação
Aumento salarial
Duração
Papel
Cláusula

Em Clube:

Contrato atual
Salário
Papel
Validade

[Gerenciar contrato →]

Em Mercado/Agente:

Situação contratual atual
[Ver contrato →]

Sem formulário completo repetido.

7. A tela Clube fica especialmente ruim quando você está sem clube

Hoje, agente livre acessando Clube recebe algo parecido com:

SEM TREINADOR
Você está agente livre...

CONTRATO · STATUS
Sem contrato...

SEU VÍNCULO
Sem contrato · agente livre...

São três áreas praticamente explicando a mesma coisa.

Eu substituiria tudo por um único empty state:

VOCÊ ESTÁ SEM CLUBE

Seu último vínculo com o Santos terminou.

12 clubes disponíveis no mercado
2 clubes acompanhando sua situação

[VER O MERCADO]

E acabou.

Não há motivo para mostrar “Conversa com treinador” se não existe treinador.

8. A aposentadoria está no lugar errado

Para se aposentar atualmente você precisa ir para:

Transferências
→ Meu agente
→ Solicitar aposentadoria

Não faz sentido em arquitetura de informação.

Aposentadoria é uma ação da carreira, não ação do mercado.

Ela deveria estar em:

Opções da carreira

junto com:

Reiniciar carreira
Excluir carreira

ou numa seção própria de carreira/perfil.

E sim, a confirmação para aposentadoria faz sentido. Essa é uma ação irreversível.

9. “Opções” e a engrenagem fazem exatamente a mesma coisa

No topo existem:

OPÇÕES

e:

⚙

Ambos abrem o mesmo modal.

Não há motivo para os dois.

Eu manteria somente a engrenagem ou somente “Opções”, dependendo do visual que você quer.

É um exemplo claro de ação duplicada.

10. O Perfil mostra atributos de goleiro para jogadores de linha

Um CA abre o perfil e vê grupo:

GOLEIRO

Reflexos
Posicionamento de goleiro
Defesa de goleiro
Saída
Reposição

Isso é ruído.

Da mesma forma, um goleiro não precisa ter destaque igual para todos os atributos ofensivos.

Eu faria:

GOL
→ Goleiro + Físicos + Mentais relevantes

Jogador de linha
→ Técnicos + Físicos + Mentais

sem bloco “Goleiro”

Os valores podem continuar no modelo interno. Não precisam ocupar a UI.

11. Objetivo pessoal hoje parece mais importante do que realmente é

Analisei os usos de objetivoPessoal.

O jogador escolhe coisas como:

Virar titular
Ganhar minutos
Evoluir tecnicamente
Conseguir empréstimo
Buscar transferência
Renovar contrato

Porém o objetivo atua principalmente como rastreador de progresso, e ao ser concluído dá um pequeno efeito de moral.

Ele não muda significativamente:

comportamento do agente
decisões do treinador
prioridades de treinamento
mercado

Portanto o usuário pode pensar:

“Escolhi Buscar Transferência, então meu agente vai trabalhar diferente.”

Mas o objetivo em si não é o motor dessa mudança.

Temos duas opções coerentes:

A) Assumir que é apenas meta pessoal
   → comunicar claramente

B) Fazer a escolha realmente orientar os sistemas

Eu prefiro B.

Se escolho:

Buscar transferência

o agente deveria ser um pouco mais ativo.

Se escolho:

Virar titular

o jogo deveria sugerir exercícios/ações diretamente relacionados à concorrência.

12. Mensagens têm leitura “tudo ou nada”

Você tem:

Marcar todas como lidas

Mas cada mensagem individual não possui ação de leitura.

E simplesmente entrar na tela não marca a mensagem como lida.

Os artigos também não são clicáveis.

Então um usuário pode ler visualmente todas as mensagens, sair, e continuar com badge de não lidas.

Eu faria uma destas opções:

abrir Mensagens
→ mensagens visíveis ficam lidas

ou

clicar na mensagem
→ abre/destaca
→ fica lida

E manter “Marcar todas” como atalho.

13. O histórico pode melhorar a noção de contexto

As temporadas antigas mostram classificação e até tabela da base.

Mas a interface tende a usar estado atual para alguns destaques, e o histórico não é completamente “congelado” como uma narrativa daquele momento.

Não encontrei corrupção grave de dados aqui, mas eu revisaria especialmente:

clube destacado na classificação antiga
categoria de base mostrada mesmo quando irrelevante
clube/competição real daquela temporada

É uma área em que a UI pode contar uma história melhor.

14. Calendário abre na rodada “atual”, não necessariamente na próxima útil

Depois que uma rodada foi simulada:

rodadaAtual = 10

entrar no Calendário tende a mostrar:

Rodada 10

que acabou de acontecer.

Para uso cotidiano eu acho mais intuitivo:

Rodada 11

se ela ainda não foi disputada.

E oferecer:

← rodada anterior
Próxima rodada →

em vez de depender só do <select>.

Não é erro matemático, mas é fricção de uso.

15. A criação permite combinações estranhas de posição secundária

O schema aceita praticamente qualquer posição secundária diferente da principal.

Então conceitualmente pode surgir:

GOL
Posição secundária: CA

ou:

ZAG
Posição secundária: PD

Mesmo que posteriormente o sistema de adaptação use uma lista de posições plausíveis muito mais restrita.

Isso cria inconsistência:

na criação pode
durante a carreira não pode

Eu usaria as mesmas regras de compatibilidade nos dois lugares.

Goleiro, principalmente, deveria ser separado.
