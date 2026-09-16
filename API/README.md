# Transfermarkt API (local — viztto)

Cópia local do projeto open source [felipeall/transfermarkt-api](https://github.com/felipeall/transfermarkt-api) para o viztto consumir sem depender da instância pública.

## Primeira vez

```bash
cd API
python3 -m venv .venv
.venv/bin/pip install -r requirements-viztto.txt
```

(O script `npm run atualizar-dados-futebol` / `npm run api` cria o venv automaticamente se faltar.)

## Subir

Na raiz do viztto, o fluxo normal é só:

```bash
npm run atualizar-dados-futebol
```

Isso reutiliza ou inicia a API em http://localhost:8000 e atualiza os snapshots sem subir Next.js. Para diagnóstico da API:

```bash
npm run api
```

Swagger: http://localhost:8000/docs

## Viztto

No `.env` da raiz:

```env
TRANSFERMARKT_API_URL=http://localhost:8000
```

Não há chave de API. Produção e criação de carreira leem somente snapshots locais. O parser aceita páginas de ligas e páginas de participantes (Série C), preservando o identificador interno da edição.
