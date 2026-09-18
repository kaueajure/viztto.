1. Problemas de lógica e funcionamento

Os mais importantes são estes:

Gravidade	Problema	Situação atual
🔴 ALTA	Tentativas de treino consomem sessões erradamente	Cada vez que você termina um minigame, ganha XP e consome 1 das 3 sessões. Não existe realmente “tentar de novo para melhorar a nota do mesmo treino”.
🔴 ALTA	Sistema antigo de treinamento continua funcionando escondido	planoId, focoTreino e intensidade ainda afetam evolução/fadiga mesmo sem interface para o jogador controlá-los.
🔴 ALTA	Base contabiliza “treino com profissional” sem você treinar	Durante convite ao profissional, treinosProfissional++ depende do antigo focoTreino, não das sessões realmente feitas no Centro.
🔴 ALTA	Botão morto na tela Desempenho	“Ver cronologia e detalhes” chama () => undefined. Literalmente não faz nada.
🔴 ALTA	Interceptação possui race de timer	Um timeout da tentativa anterior pode desligar o estado ativo da tentativa seguinte.
🟠 MÉDIA/ALTA	Efeitos físicos do treino aparentemente são aplicados duas vezes	A sessão já aumenta fadiga/condicionamento e o fechamento semanal aplica outra carga baseada nas sessões.
🟠 MÉDIA/ALTA	Minigames prometem dificuldade que não existe	Passe rápido, drible, reflexos do goleiro e finalização têm diferenças entre texto e lógica real.
🟠 MÉDIA	Hook de teste do pênalti fica exposto no browser	window.__vizttoTreinoBarra é criado sem proteção de ambiente.