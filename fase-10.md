==================================================
23. FIM DE CONTRATO / AGENTE LIVRE
==================================================

Hoje, quando o contrato termina sem renovação ou acordo definitivo, o jogo cria automaticamente um "vínculo provisório" de 90 dias com o mesmo clube e reduz o salário em 10%.

Essa regra NÃO deve continuar.

Ela pode gerar ciclos artificiais:

contrato termina
→ +90 dias
→ salário -10%
→ termina novamente
→ +90 dias
→ salário -10%
→ ...

Isso não representa bem a carreira de um jogador e pode prender o usuário indefinidamente ao clube atual.

Quero implementar um sistema real de FIM DE CONTRATO e AGENTE LIVRE.

==================================================
REGRA PRINCIPAL
==================================================

Quando o contrato do jogador terminar, devem existir três caminhos possíveis:

1. RENOVAÇÃO
Se o jogador assinou uma renovação com o clube atual:
- continua normalmente;
- novo contrato entra em vigor;
- clube atual permanece o mesmo.

2. PRÉ-CONTRATO / ACORDO FUTURO
Se o jogador assinou um acordo válido com outro clube:
- o acordo deve ser efetivado na data correta;
- o jogador vai para o clube de destino conforme as regras atuais;
- não deve existir período provisório no clube antigo.

3. SEM ACORDO
Se o contrato terminou e não existe renovação nem acordo futuro válido:
- o jogador deixa o clube atual;
- passa para estado de AGENTE LIVRE / SEM CLUBE;
- não pertence mais ao clube anterior;
- não recebe extensão automática de 90 dias;
- salário do contrato antigo deixa de ser aplicado;
- o contrato antigo deve ser tratado como encerrado/histórico.

==================================================
ESTADO "SEM CLUBE"
==================================================

O domínio precisa suportar explicitamente jogador sem clube.

Não quero hacks como:

clubeAtualId = clube antigo
ou
clubeAtualId = ""

Crie uma modelagem segura.

Possíveis abordagens:

clubeAtualId: string | null

ou estrutura equivalente.

Mas analise antes todos os lugares que assumem que clubeAtualId sempre existe.

Devem ser auditados no mínimo:

- EstadoCarreira;
- serialização;
- hidratação;
- validação de save;
- UI;
- mercado;
- treinador;
- hierarquia;
- calendário;
- partidas;
- treinamento;
- agente;
- contratos;
- eventos;
- transferência;
- empréstimo;
- avanço semanal;
- troca de liga;
- virada de temporada.

Não fazer alteração parcial que gere null pointer.

==================================================
COMPORTAMENTO DO JOGADOR LIVRE
==================================================

Enquanto estiver sem clube:

- não joga partidas de clube;
- não aparece em escalação;
- não possui treinador do clube;
- não possui diretoria do clube;
- não possui hierarquia de elenco;
- não recebe salário de clube;
- não participa de objetivos ligados a minutos por clube;
- ainda pode manter carreira ativa;
- ainda pode treinar individualmente;
- ainda pode conversar com o agente;
- pode receber propostas;
- pode pedir ao agente para procurar clubes;
- pode contatar clubes;
- pode assinar contrato com novo clube.

==================================================
TREINAMENTO SEM CLUBE
==================================================

O jogador livre deve continuar podendo evoluir, mas com lógica diferente.

Treino individual:

- menor eficiência que treino em clube;
- ajuda a manter atributos/progresso;
- ajuda a manter condicionamento;
- não deve gerar confiança de treinador;
- não deve gerar relacionamento com diretoria;
- não deve simular estrutura de clube inexistente.

Considere perda gradual de ritmo de jogo se ficar muito tempo sem clube.

Exemplo:

primeiras semanas:
impacto pequeno.

meses sem clube:
- ritmo cai;
- forma pode cair;
- reputação pode sofrer levemente;
- não destruir atributos de forma agressiva.

Não criar punição exagerada.

==================================================
MERCADO PARA AGENTE LIVRE
==================================================

Ser agente livre deve mudar a lógica de contratação.

Para clubes interessados:

- valor de transferência = 0;
- clube avalia principalmente salário, luvas, papel e encaixe esportivo;
- ausência de taxa de transferência deve aumentar atratividade;
- idade, overall, reputação, forma, tempo sem clube e salário pedido devem pesar;
- clubes ainda podem rejeitar por excesso de jogadores na posição, salário alto ou nível incompatível.

Não garantir contrato apenas por estar livre.

==================================================
PROPOSTAS PARA AGENTE LIVRE
==================================================

Propostas devem funcionar mesmo fora da janela quando a regra de contratação de jogador livre permitir.

Analise as regras atuais do projeto e centralize essa exceção.

Não duplicar lógica de janela em vários arquivos.

A contratação de um jogador livre não deve exigir valor de transferência.

A data de entrada deve respeitar a regra do jogo definida para agentes livres.

Se o projeto optar por permitir registro imediato do livre:
- tornar isso explícito e testado.

Se houver restrições:
- aplicar de forma centralizada.

==================================================
AGENTE MAIS ATIVO QUANDO SEM CLUBE
==================================================

Quando o jogador ficar livre:

o agente deve gerar comunicação clara:

"Seu contrato terminou. Você agora está sem clube."

E deve sugerir caminhos:

- Buscar oportunidades.
- Contatar clube específico.
- Ajustar expectativa salarial.
- Rever preferência de liga/país.

A frequência de busca pode ser maior do que quando o jogador já está empregado.

Mas não criar propostas irreais automaticamente.

==================================================
UI
==================================================

Quando sem clube, a interface precisa mudar de contexto.

Página inicial:

mostrar claramente:

SEM CLUBE
AGENTE LIVRE

Exemplo:

"Seu contrato com o Palmeiras terminou."

"Seu agente está buscando uma nova equipe."

Próxima partida:
não mostrar partida do clube antigo.

Hierarquia:
não mostrar.

Treinador:
não mostrar conversa com treinador antigo.

Contrato:
mostrar:

STATUS
Sem contrato

ÚLTIMO CLUBE
Palmeiras

TEMPO SEM CLUBE
3 semanas

MERCADO
2 clubes observando

==================================================
CONTRATO ANTIGO
==================================================

O contrato encerrado não deve simplesmente desaparecer sem registro.

Preservar histórico relevante:

- clube;
- início;
- fim;
- salário;
- papel;
- motivo da saída: fim de contrato.

Se já existir estrutura de histórico de carreira/clubes, reutilizar.

Não criar duplicação desnecessária.

==================================================
EVENTOS
==================================================

Quando o contrato acabar:

registrar evento importante:

"FIM DE CONTRATO"

Exemplo:

"Seu vínculo com o Palmeiras chegou ao fim."

"Você agora é agente livre e pode negociar com outros clubes."

Se houver pré-contrato:

registrar:

"FIM DE CONTRATO"

e depois:

"NOVO CLUBE"

sem passar por estado sem clube permanente.

==================================================
AVISOS ANTES DO FIM
==================================================

O jogo já possui avisos de contrato próximo do fim.

Melhorar a progressão:

12 meses:
alerta leve.

6 meses:
alerta importante.

3 meses:
alerta forte.

1 mês:
alerta urgente.

Se não houver renovação ou acordo:
mostrar claramente:

"Seu contrato termina em 28 dias e você ainda não possui acordo para a próxima temporada."

==================================================
RENOVAÇÃO AUTOMÁTICA NÃO EXISTE
==================================================

Não renovar contrato automaticamente sem decisão explícita do jogador.

A diretoria pode oferecer.

O jogador precisa aceitar.

Se ninguém aceitar nada:
o contrato termina.

==================================================
OBJETIVOS E PROMESSAS
==================================================

Ao ficar sem clube:

- promessas do treinador antigo devem ser encerradas;
- objetivo "virar titular" deve ser suspenso/cancelado ou contextualizado;
- objetivo de minutos não pode continuar avançando;
- relacionamentos com treinador/diretoria do clube antigo não devem continuar produzindo efeitos ativos.

Preserve histórico.

==================================================
RELACIONAMENTOS
==================================================

Ao sair por fim de contrato:

- relação histórica com clube/treinador pode permanecer registrada;
- mas não deve ser tratada como relação ativa.

Não usar relação com treinador antigo para decisões de um futuro clube.

==================================================
EMPRÉSTIMO
==================================================

Jogador não pode ficar "agente livre" enquanto empréstimo ainda está ativo de forma incoerente.

Audite casos:

- contrato de origem termina durante empréstimo;
- retorno ocorre depois do término;
- pré-contrato durante empréstimo;
- fim de empréstimo e fim de contrato próximos.

Defina regra clara.

Preferência:

se o contrato com clube proprietário termina:
- empréstimo não deve continuar como se ainda existisse vínculo empregatício inexistente;
- encerrar/reavaliar situação conforme a data real.

Não deixar estado impossível.

==================================================
PRECONTRATO
==================================================

Se houver pré-contrato já assinado:

quando o vínculo atual acabar:
- não criar estado provisório;
- não gerar agente livre se a mudança for imediata;
- efetivar o acordo corretamente.

Garantir que apenas um acordo definitivo exista.

==================================================
PERSISTÊNCIA
==================================================

Atualizar:

- schema;
- Zod;
- serialização;
- hidratação;
- validação semântica;
- migração de save;
- testes de round-trip.

Saves antigos não podem quebrar.

Se clubeAtualId passar a aceitar null:
- migrar corretamente;
- garantir que saves antigos continuem válidos.

==================================================
TESTES OBRIGATÓRIOS
==================================================

Adicionar testes para:

1. contrato termina com renovação aceita;
2. contrato termina com pré-contrato ativo;
3. contrato termina sem acordo;
4. jogador passa a agente livre;
5. clubeAtualId/estado equivalente fica correto;
6. antigo clube deixa de ser tratado como atual;
7. salário antigo deixa de ser aplicado;
8. não existe extensão automática de 90 dias;
9. não existe redução salarial automática;
10. jogador livre não disputa partidas;
11. jogador livre não aparece em escalação;
12. jogador livre não recebe confiança de treinador;
13. jogador livre ainda pode treinar;
14. ritmo pode cair com tempo sem clube;
15. jogador livre pode receber proposta;
16. contratação custa zero de transferência;
17. clube ainda pode rejeitar;
18. contrato novo remove status de agente livre;
19. novo clube vira clube atual;
20. troca de liga funciona;
21. save/reload preserva agente livre;
22. save/reload após novo contrato funciona;
23. promessa antiga é encerrada;
24. objetivos são contextualizados;
25. fim de contrato durante empréstimo não gera estado impossível;
26. pré-contrato evita agente livre permanente;
27. múltiplas semanas sem clube não criam contrato provisório;
28. agente pode buscar clubes;
29. UI não mostra próxima partida do clube antigo;
30. UI mostra "Sem clube / Agente livre".

==================================================
CRITÉRIO DE ACEITE
==================================================

Cenário esperado:

Jogador está no Palmeiras.
Contrato termina em 30/06/2029.

Não aceitou renovação.
Não possui pré-contrato.

Ao avançar:

30/06/2029
→ contrato termina.

O jogo mostra:

"Seu vínculo com o Palmeiras chegou ao fim."

Estado:

AGENTE LIVRE
SEM CLUBE

O jogador:
- não joga mais pelo Palmeiras;
- não recebe salário;
- não conversa mais com treinador do Palmeiras;
- pode treinar individualmente;
- pode procurar novo clube;
- pode receber ofertas.

Duas semanas depois:

Benfica oferece contrato.

Jogador aceita.

Estado:

Benfica vira clube atual.
Novo contrato começa.
Carreira continua normalmente.

Em nenhum momento:

- contrato antigo é estendido 90 dias;
- salário cai automaticamente 10%;
- jogador continua jogando pelo antigo clube sem contrato.

==================================================
REGRA FINAL
==================================================

O fim do contrato deve ser um evento real de carreira.

Não um remendo automático.

O jogador deve sentir:

"Meu contrato acabou e agora estou no mercado."

e ter consequências e opções claras.

Implemente sem quebrar saves, mercado, transferências, empréstimos ou avanço de temporada.