Analise completamente o estado atual do projeto Viztto e corrija os problemas abaixo introduzidos ou revelados após as Fases 7 e 8.

IMPORTANTE:

- Não faça uma reescrita geral do projeto.
- Preserve a arquitetura atual sempre que possível.
- Antes de alterar uma regra, localize todos os pontos que dependem dela.
- Não altere a infraestrutura de produção, Nginx, PM2, GitHub Actions, secrets, .env de produção ou /usr/local/bin/viztto-deploy.
- Não exponha potencial interno do jogador na interface.
- Não simplifique sistemas apenas para fazer testes passarem.
- Não remova funcionalidades das Fases 7 e 8.
- Preserve compatibilidade com saves existentes sempre que tecnicamente possível.
- Qualquer mudança de schema de save precisa de migração segura.
- Toda nova regra importante deve possuir teste automatizado.
- Não use números arbitrários sem verificar o balanceamento atual.
- Evite patches superficiais. Corrija a causa do problema.
- O comportamento final deve continuar determinístico quando a simulação usa seed.
- Antes de modificar arquivos, entenda o fluxo completo correspondente.

Quero que você trate esta tarefa como uma fase de estabilização e correção da Fase 8.

==================================================
1. SISTEMA DE CONTRATOS
==================================================

Hoje existem ações diferentes:

- renovação;
- aumento salarial;
- extensão do vínculo;
- revisão do papel;
- revisão da cláusula.

Porém o backend acaba tratando praticamente todas como uma renovação completa.

Corrija isso.

Cada tipo de solicitação deve alterar somente os elementos relacionados àquela solicitação.

Exemplos:

Aumento salarial:
- não deve mudar automaticamente duração;
- não deve mudar automaticamente papel;
- não deve mudar cláusula sem necessidade.

Extensão:
- deve negociar principalmente duração;
- salário pode permanecer igual ou ser ajustado apenas se a lógica contratual justificar;
- não deve alterar papel arbitrariamente.

Revisão de papel:
- deve negociar papel;
- não deve renovar contrato automaticamente.

Revisão de cláusula:
- deve negociar somente cláusula ou os elementos estritamente necessários.

Renovação:
- pode negociar um pacote completo.

Corrija também:

- jogador profissional NÃO pode solicitar papel "categoria de base";
- backend também deve rejeitar esse valor mesmo que venha de request adulterado;
- duração do novo contrato deve ser calculada corretamente a partir da DATA DA ASSINATURA;
- não usar Math.max com os anos restantes de forma que um simples aumento salarial transforme um contrato em outro contrato maior;
- pedidos diferentes devem possuir regras próprias de aceitação, contraproposta e resposta;
- preserve proposta/contraproposta e assinatura existentes.

Crie testes cobrindo cada TipoPedidoContrato separadamente.

==================================================
2. FOCO DE TREINO ESCONDIDO
==================================================

Existe hoje um conflito entre:

- plano de desenvolvimento;
- focoTreino rápido;
- carga física aplicada.

Quando um plano é ativado, focos como velocidade/físico podem desaparecer da interface, mas focoTreino pode continuar salvo e influenciar carga/fadiga silenciosamente.

Corrija o modelo para que não exista configuração invisível.

Defina uma regra clara.

Sugestão aceitável:

- quando existir plano de desenvolvimento, a carga do plano/intensidade deve ser a fonte principal;
- foco rápido pode servir somente para recuperação ou alguma ação explicitamente apresentada ao jogador;
- nunca permitir que um foco oculto continue alterando fadiga.

Ao ativar/trocar plano, normalize focoTreino quando necessário.

UI e motor devem representar exatamente o mesmo estado.

Adicione testes.

==================================================
3. JOGADOR DA BASE RELACIONADO AO PROFISSIONAL
==================================================

Hoje um jogador ainda registrado como categoria "base" pode ser convocado para o profissional naquela semana.

Porém existem inconsistências:

- ele pode não entrar na escalação utilizada para calcular a força do time profissional;
- depois simularPartida recebe uma cópia dele como profissional;
- portanto pode jogar sem ter participado da escalação/força que determinou o jogo;
- Central da Semana pode continuar mostrando a próxima partida da base.

Corrija todo esse fluxo.

Quando o jogador da base estiver relacionado para o profissional naquela rodada:

- deve participar da avaliação de escalação profissional;
- deve poder ocupar titular/banco/não relacionado normalmente;
- sua presença deve afetar a força real do time caso seja escalado;
- a partida apresentada na Central da Semana deve ser a partida profissional correspondente;
- não altere permanentemente categoria para profissional apenas por uma convocação;
- estatísticas devem ser registradas corretamente;
- escalação, UI e simulação devem usar a mesma decisão.

Crie testes para:
- base não convocado;
- base convocado e titular;
- base convocado e banco;
- base convocado mas não utilizado;
- retorno à rotina da base na semana seguinte.

==================================================
4. BLOQUEIO DE PROPOSTAS ESPONTÂNEAS
==================================================

Hoje clubes presentes em clubesDesejados podem acabar sendo classificados como interesse de origem "agente", mesmo sem contato ativo.

Isso permite contornar "bloquear propostas espontâneas".

Separe claramente:

- clube desejado/preferência;
- clube contatado ativamente pelo agente;
- clube que começou observação espontânea.

Adicionar um clube aos desejados NÃO significa que o agente entrou em contato.

Somente uma ação explícita do jogador/agente deve definir origem como "agente".

Quando bloquearPropostas estiver ativo:

- clubes ainda podem observar;
- interesses podem evoluir internamente;
- propostas espontâneas devem ser filtradas;
- contatos ativos solicitados pelo jogador continuam permitidos.

Crie testes específicos para essa diferença.

==================================================
5. REABERTURA MASSIVA DE INTERESSES
==================================================

Interesses encerrados cujo reabrirEm venceu não devem reabrir todos automaticamente na mesma semana ignorando:

- frequência de mercado;
- limite de novos interesses;
- chance semanal.

Faça reaberturas participarem do mesmo orçamento/limite de novos interesses da semana, ou implemente um limite próprio coerente.

Não permitir explosões artificiais de 5, 10 ou mais interesses na mesma semana apenas porque cooldowns terminaram juntos.

Preserve clubes realmente interessados e jogadores muito conhecidos como exceções apenas se houver justificativa explícita.

Adicione teste com vários interesses vencendo no mesmo dia.

==================================================
6. FARM DE RELACIONAMENTO COM O AGENTE
==================================================

A ação "conversar sobre minha situação" não pode dar +1 relacionamento com o agente em todo clique.

Transforme a consulta de situação em ação majoritariamente informativa.

Relacionamento só deve mudar se houver motivo real:

- decisão;
- negociação;
- resultado relevante;
- intervalo temporal;
- ou outro evento de carreira.

Não permitir spam para chegar a 100.

Crie teste de repetição da ação.

==================================================
7. FARM DE RELACIONAMENTO/MORAL COM O TREINADOR
==================================================

"Aceitar meu papel atual" não pode ser usado repetidamente para gerar relacionamento e moral.

Implemente estado/contexto adequado.

Exemplos possíveis:

- registrar qual papel foi aceito;
- registrar data;
- somente permitir efeito quando houver mudança relevante de papel/situação;
- novo benefício apenas após nova mudança real.

Não permitir recompensa infinita pelo mesmo contexto.

Crie testes.

==================================================
8. OBJETIVOS PESSOAIS
==================================================

Hoje é possível potencialmente escolher novamente um objetivo já satisfeito e receber recompensa novamente.

Corrija.

Um objetivo não deve ser explorável para farmar moral.

Defina regras para:

- objetivo já concluído;
- troca de objetivo;
- reativação;
- cooldown se necessário;
- histórico ou identificador do ciclo, se necessário.

Além disso, "Evoluir tecnicamente" não deve medir sempre:

domínio + passe curto + visão

para qualquer posição.

A meta deve ser contextual por posição/plano.

Exemplos:

- goleiro: reflexos, defesa, posicionamento/reposição;
- zagueiro: marcação, desarme, antecipação;
- atacante: finalização, compostura etc.;
- meio-campista: passe, visão, domínio.

Não precisa usar exatamente esses exemplos, mas a regra deve partir dos atributos relevantes da posição.

Adicione testes para múltiplas posições e objetivos repetidos.

==================================================
9. BADGES E NOTIFICAÇÕES DO MERCADO
==================================================

Hoje algumas respostas permanecem contabilizadas como novidade indefinidamente.

Exemplos:

- resposta da diretoria ao pedido de saída;
- resposta de empréstimo;
- outros alertas persistentes.

Implemente diferença entre:

- estado existente;
- novidade não lida.

Depois que o usuário visualizar a resposta correspondente:

- badge deve desaparecer;
- informação histórica pode continuar visível.

Não faça leitura destruir o histórico.

A solução deve funcionar após save/reload.

Adicione testes.

==================================================
10. FEEDBACK CIRCULAR NA ESCALAÇÃO
==================================================

Atualmente statusElenco concede bônus grande à escalação e depois a escalação redefine statusElenco.

Isso cria um loop:

titular -> recebe bônus -> continua titular -> mantém bônus.

Rebalanceie.

Contrato/papel/status pode influenciar expectativas do treinador, mas não deve dominar permanentemente:

- overall;
- desempenho;
- treino;
- forma;
- condição física;
- adequação posicional;
- confiança;
- concorrência.

Reduza ou reformule PESO_STATUS.

Não remova completamente a influência de papel/status sem analisar o sistema.

Crie testes mostrando que:

- reserva melhor e em ótima fase consegue ultrapassar titular em má fase;
- jogador não perde vaga aleatoriamente sem motivo;
- estrela continua favorecida quando níveis são próximos, mas não é intocável.

==================================================
11. HIERARQUIA DEVE REPRESENTAR AS VAGAS REAIS
==================================================

Hoje "1ª opção da posição" pode não significar 1ª opção para nenhum slot real da formação utilizada.

A hierarquia deve considerar:

- formação preferida;
- slots existentes;
- posição principal;
- posição secundária;
- compatibilidade posicional;
- concorrentes pelas vagas que realmente existem.

A UI não pode dizer "1ª opção" se o jogador na prática não é a primeira opção para uma vaga existente.

Mostre uma explicação coerente caso a formação não utilize diretamente aquela posição.

Reaproveite a lógica de escalação, evitando dois algoritmos divergentes.

Adicione testes para formações sem MEI, pontas, laterais etc.

==================================================
12. HIERARQUIA DA BASE
==================================================

Na base não use "1ª/2ª/3ª opção" como se houvesse concorrentes reais caso o sistema não esteja realmente comparando com jogadores.

Escolha uma solução consistente.

Preferência:
usar jogadores reais do elenco/base quando disponíveis e gerar concorrência de verdade.

Se isso exigir mudança grande demais, pelo menos altere semanticamente a UI para:

- faixa de titularidade;
- faixa de rotação;
- desenvolvimento;

sem fingir uma posição ordinal inexistente.

Não deixe UI mentir sobre o modelo.

==================================================
13. ATRIBUTOS DO USUÁRIO DEVEM INFLUENCIAR A PARTIDA
==================================================

Este é um problema estrutural importante.

Atualmente o placar é praticamente definido antes da participação individual do jogador e depois alguns gols já existentes são atribuídos ao usuário.

Isso precisa evoluir.

Não quero transformar Viztto em jogo controlável.

Quero continuar sendo um simulador.

Porém o jogador do usuário precisa afetar causalmente o desempenho do time quando está em campo.

Analise a arquitetura e implemente uma abordagem segura.

Exemplos possíveis:

- força efetiva da escalação já considerar o jogador;
- qualidade ofensiva/defensiva mudar conforme os atletas escalados;
- participação em minutos afetar expectativa de gols;
- atributos da posição influírem em criação/conversão/defesa;
- substituições poderem alterar força durante a partida.

Não use solução extremamente pesada.

O objetivo é:

um atacante excelente realmente aumentar a capacidade ofensiva do time;
um grande goleiro realmente reduzir gols sofridos;
um grande defensor melhorar defesa;
um meia criativo melhorar criação.

Eventos individuais ainda podem ser derivados do placar, mas o jogador precisa influenciar a probabilidade daquele placar.

Mantenha determinismo por seed.

Crie testes estatísticos/determinísticos adequados comparando jogadores claramente melhores e piores.

==================================================
14. ENTRADA DE RESERVAS
==================================================

Não usar uma chance fixa de aproximadamente 65% para qualquer jogador de linha no banco.

Calcule chance de entrada considerando pelo menos alguns fatores relevantes:

- posição;
- papel/status;
- confiança;
- fadiga dos titulares;
- contexto da partida ou necessidade tática, se disponível;
- treinador/rotação;
- jogador ser promessa que precisa de minutos;
- goleiros devem continuar com comportamento muito diferente.

Não precisa criar um simulador tático complexo.

Precisa apenas deixar de ser uma probabilidade uniforme artificial.

Adicione testes.

==================================================
15. ADAPTAÇÃO DE POSIÇÃO
==================================================

Hoje a adaptação pode ser marcada como concluída após ~8-10 semanas, mas mudança principal exige até 112 dias, criando uma espera escondida.

Torne a regra transparente e coerente.

Pode existir:

fase 1: nova posição secundária;
fase 2: possibilidade de assumir como principal.

Mas a interface deve explicar:

- progresso;
- estágio;
- requisitos;
- prazo mínimo aproximado;
- motivo de ainda não poder mudar.

Não mostrar "concluída" se ainda existe uma etapa pendente sem explicação.

==================================================
16. COOLDOWN DAS CONVERSAS COM O TREINADOR
==================================================

Perguntas informativas não devem necessariamente bloquear solicitações importantes durante uma semana inteira.

Separe, se necessário:

- conversas informativas;
- pedidos;
- reclamações;
- cobrança de promessa;
- mudança posicional.

Crie cooldowns por categoria ou uma regra equivalente.

Evite spam, mas também não puna o jogador por simplesmente perguntar "o que preciso melhorar?".

==================================================
17. DURAÇÃO DE CONTRATO
==================================================

Corrija completamente a matemática de duração relacionada aos pedidos contratuais.

"Duração de 3 anos" deve significar o novo vínculo acordado conforme a regra contratual, não:

max(anos pedidos, anos restantes atuais arredondados)

de forma automática.

Pedidos de aumento/papel/cláusula não devem estender contrato acidentalmente.

Testes devem cobrir contratos com:

- menos de 1 ano restante;
- 2 anos;
- 4,2 anos;
- aproximadamente 5 anos.

==================================================
18. CENTRAL DA SEMANA
==================================================

Não mostre sempre um card estático de ELENCO ocupando espaço das novidades.

Priorize mudanças.

Criar card de hierarquia/elenco quando ocorrer algo relevante:

- subiu/desceu na ordem;
- mudou titular/banco;
- chance mudou;
- concorrente lesionou;
- novo concorrente;
- treinador alterou papel;
- outra mudança significativa.

Informação estática pode continuar disponível na tela Clube.

Central da Semana deve servir como resumo do que MUDOU.

==================================================
19. PERFORMANCE DA CRIAÇÃO DE CARREIRA
==================================================

Hoje a criação faz fetch sequencial das outras ligas.

Analise e otimize.

Pode usar:

- Promise.all com limite de concorrência;
- endpoint agregado;
- cache;
- carregamento no servidor;
- estratégia equivalente.

Não faça dezenas de requests descontroladas.

Idealmente carregue as ligas em paralelo com concorrência limitada.

Preserve tratamento individual de liga indisponível.

Adicione medição/teste quando possível.

==================================================
20. PERFORMANCE AO AVANÇAR SEMANA
==================================================

Este é um ponto importante.

Hoje avancarSemana executa muita coisa:

- clone grande do estado;
- simulação da liga principal;
- partidas de base;
- todas as ligas externas;
- evolução de NPCs;
- aposentadorias;
- escalações;
- força dos clubes;
- classificações;
- mercado;
- treinador;
- desenvolvimento;
- eventos;
- persistência.

Analise com profiling/medição antes de otimizar.

Identifique gargalos reais.

Objetivo:
reduzir perceptivelmente o tempo para avançar uma semana sem sacrificar coerência da simulação.

Possíveis otimizações:

- evitar trabalho repetido;
- não recalcular força/escalação quando não mudou;
- evitar scans repetidos de arrays grandes;
- criar índices/maps apenas uma vez por ciclo;
- reduzir structuredClone desnecessário se seguro;
- simulação simplificada para ligas externas;
- distribuir trabalhos que não precisam acontecer toda semana;
- manter resultados determinísticos;
- evitar O(ligas * clubes * jogadores * scans repetidos).

Não introduza Web Worker ou arquitetura complexa sem provar necessidade.

Inclua benchmarks antes/depois.

==================================================
21. MIGRAÇÃO DE PEDIDO DE TRANSFERÊNCIA
==================================================

A migração de saves antigos não deve depender principalmente de regex sobre texto humano como:

recusou / recusado / negou / negado.

Analise versões anteriores dos saves disponíveis no repositório e crie migração mais determinística.

Se realmente não existir campo estruturado suficiente nos saves antigos, mantenha fallback textual SOMENTE como último recurso, documentado e testado.

Não quebrar saves existentes.

==================================================
22. AUTOSAVE COM ESTADO INVÁLIDO
==================================================

Se serializarCarreira falhar por estado estruturalmente inválido, não deve tentar inutilmente a mesma serialização em loop a cada ação sem distinguir a geração problemática.

Implemente controle de geração/estado inválido.

Comportamento desejado:

- erro estrutural aparece;
- autosave não entra em loop;
- se o estado mudar para uma geração nova, pode tentar novamente;
- erro transitório de rede continua usando retry/backoff;
- conflito de revision continua seguindo a lógica existente.

Não regredir o autosave da Fase 7.

==================================================
REVISÃO TRANSVERSAL
==================================================

Depois das correções acima, revise também as interações entre:

- jogador da base;
- profissional;
- escalação;
- força do clube;
- mercado;
- empréstimos;
- transferências;
- contratos;
- treinador;
- adaptação de posição;
- desenvolvimento;
- objetivos;
- lesões;
- suspensão;
- virada de temporada;
- ligas externas;
- saves;
- hidratação;
- autosave;
- migrações.

Procure estados impossíveis como:

- contrato pertencendo ao clube errado;
- clube atual incompatível com liga atual;
- promessa do treinador sobrevivendo troca de clube;
- adaptação sobrevivendo troca de comissão indevidamente;
- proposta duplicada;
- múltiplos acordos definitivos;
- jogador profissional com papel de base;
- jogador escalado e não relacionado simultaneamente;
- jogador lesionado participando;
- jogador suspenso participando;
- convocação da base apontando para jogo errado;
- save que passa no TypeScript mas não pode ser hidratado.

==================================================
TESTES OBRIGATÓRIOS
==================================================

Não quero somente corrigir código.

Amplie a suíte de regressão.

Crie testes específicos para cada problema corrigido.

Além dos testes unitários, mantenha/adicione testes de integração simulando várias semanas.

Inclua cenários de:

- jogador de 15/16 anos na base;
- promoção ao profissional;
- reserva conquistando titularidade;
- perda de posição;
- lesão;
- suspensão;
- promessa do treinador;
- adaptação de posição;
- pedido de contrato;
- contraproposta;
- transferência;
- empréstimo;
- retorno de empréstimo;
- mercado fora da janela;
- mercado durante janela;
- bloqueio de propostas;
- objetivo pessoal;
- criação/salvamento/reload;
- virada de temporada;
- mudança de liga.

Simule também pelo menos uma carreira longa o suficiente para detectar inconsistências acumuladas.

Depois execute:

npm run typecheck
npm test
npm run build

Caso exista um benchmark da Fase 7/8, execute-o e compare antes/depois.

==================================================
ENTREGA
==================================================

Ao terminar, apresente:

1. Problemas confirmados.
2. Problemas da lista que, após investigação, não eram bugs e por quê.
3. Arquivos alterados.
4. Correções feitas por sistema.
5. Novos testes adicionados.
6. Resultado de typecheck/test/build.
7. Métricas de performance antes/depois.
8. Compatibilidade com saves antigos.
9. Riscos ou pontos que ainda merecem trabalho futuro.

Não faça commit nem push automaticamente a menos que eu peça.

Prioridade máxima:
corrigir lógica e consistência do jogo sem reconstruir desnecessariamente a arquitetura existente.