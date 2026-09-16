# Validação da fase 1

Verificação realizada em 15/09/2026, com Node.js 24 e npm 11.

## Automação

- TypeScript strict: sem erros.
- Vitest: 31 testes de domínio, calendário, tabela, partidas, seed, escalação, evolução, transição de temporadas, transferências, suspensão, lesão, persistência e API.
- Build Next.js: geração de produção concluída.
- Dependências: auditoria sem vulnerabilidades após atualização do Vitest.

## Navegador

Fluxo executado em Chromium local de teste:

1. Criar Kauê Silva aos 15 anos.
2. Escolher Brasileirão e Palmeiras com dados importados da API.
3. Iniciar na base e avançar as 38 rodadas.
4. Consultar o pós-jogo e encerrar a temporada.
5. Iniciar o ano seguinte e recarregar a página: ano e progresso preservados.
6. Abrir navegação móvel em viewport de 390 × 844.
7. Reiniciar a carreira: volta ao ano e atleta iniciais.
8. Excluir a carreira: botão Continuar fica desativado.

Também foram visitadas as nove seções da carreira, selecionado um novo foco de treino e validado o modo demonstração. Não ocorreram erros JavaScript nos fluxos. A largura do documento no celular correspondeu aos 390 pixels do viewport, sem transbordamento horizontal.

## API real e limitações do ambiente

A credencial configurada respondeu à consulta de ligas. O plano informou acesso às temporadas de 2022 a 2024, rejeitando 2026. O jogo importou com sucesso 20 clubes reais do Brasileirão de 2024 e informou a temporada histórica na criação.

O domínio de imagens `media.api-sports.io` apresentou falha de DNS neste ambiente. Por isso, as capturas de teste mostram o escudo neutro com as siglas. O endereço original retornado pela API permanece no clube e o componente tenta carregá-lo normalmente em ambientes com acesso ao CDN.

A instalação inicial do npm também encontrou um problema de certificado do registro neste ambiente. A exceção de TLS foi usada somente no comando de instalação, sem gravar `strict-ssl=false` em arquivos de configuração do projeto.

## Limites funcionais

A liga selecionada é o mundo ativo. O mercado inicial acontece entre seus clubes. Regras de classificação, contratos expirados e base são simplificadas conforme documentado em [ARQUITETURA.md](../ARQUITETURA.md) e [README.md](../README.md).

## Complemento — integração de identidade e escudos

Após a revisão da API: 46 testes aprovados, TypeScript sem erros e build de produção concluído. Cobertura adicional de deduplicação, cache imutável, leitura de quotas, esgotamento diário, HTTP 429/Retry-After, espera progressiva, falhas transitórias, respostas parciais, cache de restrição de plano e cache de imagens em disco.

Importação real repetida: 20 clubes do Brasileirão 2024. A rota local de escudo respondeu 503 com `Retry-After: 60` diante da indisponibilidade do CDN; isso preserva a informação de falha sem servir uma imagem fictícia como oficial. Os testes de sucesso e reaproveitamento do cache usam respostas PNG controladas.
