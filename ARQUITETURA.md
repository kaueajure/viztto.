# Arquitetura do viztto — fase 1

## Direção das dependências

A interface depende do estado e dos casos de uso. Os casos de uso coordenam o domínio e a simulação. O domínio não importa React, Next.js, Zustand ou localStorage. O motor não faz requisições externas nem lê o relógio do sistema.

```text
Componentes → Zustand → Casos de uso → Simulação → Domínio
                  ↓
        Adaptador de persistência

Criação → Endpoint Next.js → ProvedorDadosFutebol → API-Football
```

O save guarda uma fotografia completa do mundo importado, do atleta e do estado do gerador aleatório. As URLs originais dos escudos são preservadas no save, mas a interface acessa uma rota local com cache das imagens no servidor. Uma futura implementação de repositório no servidor pode substituir `RepositorioLocal` e a estratégia do store sem alterar o motor.

## Determinismo e processamento

`GeradorAleatorio` usa um estado inteiro serializável e um algoritmo pseudoaleatório central. A seed inicial é criada na fronteira da interface com `crypto.randomUUID()`. Uma carreira restaurada continua exatamente a sequência, em vez de reiniciar o gerador. Não há `Math.random()` nas regras.

`avancarSemana` recebe um estado e devolve uma cópia atualizada. O fluxo é síncrono, sem timers de mundo ou efeitos em React:

1. Avança sete dias e processa recuperação.
2. Executa o foco de treino uma vez, recupera condição e calcula risco de lesão.
3. Aplica desenvolvimento e declínio por idade.
4. Simula uma rodada profissional e uma rodada da base.
5. Registra desempenho, cartões, confiança, moral e estatísticas do atleta.
6. Atualiza forma dos clubes e recalcula as duas classificações.
7. Avalia promoção, status, objetivos, mercado e contrato.
8. Preserva a posição do gerador e encerra a temporada quando necessário.
9. O store persiste o estado resultante.

A passagem para o ano seguinte é uma ação separada, permitindo consultar o encerramento e o campeão. As férias avançam a data até o mesmo marco anual de início. O envelhecimento usa o início da carreira como aniversário convencional, pois a criação pede idade e não data de nascimento.

## Calendário e classificação

O algoritmo circular gera turno e returno para qualquer número de clubes a partir de dois. Com quantidade ímpar, existe uma folga por rodada. Cada par se enfrenta em casa e fora uma vez. As duas categorias têm calendários e tabelas separados.

A classificação é derivada dos resultados, evitando incrementos duplicados. Desempates: pontos, vitórias, saldo, gols pró e ID apenas para estabilidade em igualdade absoluta. A regra é simplificada e não pretende reproduzir cada federação.

## Partidas e atleta

Gols usam distribuição de Poisson com média modulada por ataque, defesa, meio, mando, forma, moral, fadiga e momento da temporada. A vantagem do time forte é probabilística e validada em amostra de partidas.

A escalação considera nível do atleta em relação ao setor, confiança, forma, fadiga, moral, notas recentes e variação do treinador. Lesão e suspensão prevalecem. Há titulares, reservas que entram ou permanecem no banco e não relacionados. As substituições de goleiros são menos frequentes.

O placar vem primeiro. A cronologia gera exatamente seus gols. Gols e assistências do usuário só podem ocorrer no intervalo em que estava em campo e não se sobrepõem no mesmo gol. O atleta não é tratado como o autor de todos os gols do clube. A primeira versão representa sua qualidade sobretudo na escalação, participação e nota; não recalcula individualmente a força de todo o elenco.

A nota depende da posição: defesa, desarmes e gols sofridos importam para defensores; defesas e baliza inviolada importam para goleiros. Eventos extraordinários têm mais peso sem tornar 9 e 10 a regra.

## Evolução, personalidade e base

Overall é média ponderada dos atributos relevantes da posição. Desenvolvimento fracionário acumula por atributo; a cada 100 pontos o atributo sobe. O ritmo depende de idade, margem até o potencial, dedicação, moral, saúde, estrutura e minutos/desempenho. O potencial numérico não aparece na interface.

Atributos físicos declinam antes de visão e passe. Recuperação não fornece desenvolvimento. A personalidade já influencia treino, disciplina, cartões, adaptação após transferência, disposição ao mercado e reação a propostas. Liderança permanece armazenada como base para eventos futuros.

15/16 anos começam na base por regra de domínio. Uma promoção antecipada exige talento, nível e confiança. A partir de 17 anos são avaliados desempenho e preparo; aos 20 o vínculo muda para profissional sem garantia de espaço no time. Competições e registros anteriores da base são preservados.

## Mercado e história

Propostas usam faixa de qualidade, forma, reputação, produção ofensiva, recursos e necessidade probabilística dos clubes. O universo de destinos é a liga importada. Propostas têm validade, decisão única e histórico. Aceitar uma transferência cria contrato, muda clube e reinicia a avaliação do técnico conforme adaptabilidade; as estatísticas anteriores não mudam de clube.

Registros estatísticos são agrupados por temporada, clube e categoria/competição. Classificações finais das duas categorias ficam arquivadas. Notícias recentes são limitadas a 100; eventos importantes e registros de temporadas são permanentes.

Vínculos provisórios após expiração são uma regra explícita desta vertical slice. Futuramente podem ser substituídos por mercado de agentes livres sem alterar o formato das propostas.

## API e segurança da chave

`ProvedorDadosFutebol` define a fronteira. O adaptador API-Football é marcado `server-only`. Somente o endpoint servidor acessa a variável de ambiente e envia o header `x-apisports-key`. IDs das seis ligas vivem em uma única configuração. Zod valida respostas antes do mapeamento e o payload de importação no cliente.

O endpoint não recebe URLs externas arbitrárias nem IDs de ligas fora da lista. O cache em memória por credencial de 24 horas reduz chamadas e uma fila deduplica solicitações simultâneas. A política de tentativas e quotas fica em `cliente-api.ts`. O cache é operacional e isolado das regras da carreira. A chave não integra respostas, logs ou save. Erros são classificados em autenticação, limite, rede, parâmetros e resposta inválida; mensagens públicas não ecoam a credencial nem o corpo bruto do provedor.

As edições iniciais são fixadas por configuração: Brasileirão 2026 e Europa 2025/2026. A API é consultada pelo ano de início exato. Recusa do plano produz aviso e demonstração na mesma edição, sem importar anos anteriores. `formatarTemporada` mantém a identificação europeia em dois anos também nas temporadas futuras e no histórico.

O fallback usa clubes inventados com nomes próprios, identificadores negativos e origem explícita. Nenhuma identidade real é cadastrada manualmente. A força dos clubes é um modelo do simulador, derivado deterministicamente da liga e do identificador; não usa resultados reais para projetar a carreira.

## Persistência

Zustand `persist`, JSON e localStorage são a única persistência. O adaptador captura falhas de acesso e quota; a interface avisa quando o progresso não pode ser gravado. O save tem versão e passa por validação estrutural antes da hidratação. Saves inválidos não são tratados como carreiras válidas.

A hidratação ocorre após o cliente montar, evitando divergências com SSR. Regras não leem o storage. A persistência é acionada por ações explícitas. Reiniciar usa a identidade inicial, seed, liga e clube inicial; excluir grava ausência de carreira. São ações com confirmação na interface.

## Design

Paleta: grafite `#0e141a`, painel azul `#17212a`, azul estrutural `#203445`, divisórias `#2a3741`, texto `#eff1ed`, verde funcional `#b9e384`. Barlow para leitura e Barlow Condensed para títulos, placares e números. Fontes locais evitam dependência de serviço externo no build.

A tela central prioriza confronto, preparação e participação do atleta. Tabelas, linhas, escudos e cronologia substituem a aparência de dashboard financeiro. O campo inclinado na abertura e a camisa abstrata são elementos originais em CSS, sem assets de jogos comerciais. No celular a navegação vira drawer e os painéis passam para uma coluna.

## Expansão

As entidades de competição, partidas, registros, contratos, propostas e eventos são independentes dos componentes. Novas competições podem ter calendários próprios e reutilizar simulação e classificação. Uma futura entidade de mundo com múltiplas ligas poderá substituir a liga única do save com migração de versão.

Não há implementações fictícias de copas, seleções, aposentadoria ou vida pessoal. As limitações estão descritas no README. Os pontos de expansão são interfaces e dados explícitos, não sistemas vazios ou TODOs em regras essenciais.
