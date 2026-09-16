# Transfermarkt API (local — viztto)

Cópia local do projeto open source [felipeall/transfermarkt-api](https://github.com/felipeall/transfermarkt-api) para o viztto consumir sem depender da instância pública.

## Primeira vez

```bash
cd API
python3 -m venv .venv
.venv/bin/pip install -r requirements-viztto.txt
```

(O script `npm run api` / `npm run dev` cria o venv automaticamente se faltar.)

## Subir

Na raiz do viztto, o fluxo normal é só:

```bash
npm run dev
```

Isso sobe a API em http://localhost:8000 e o Next. Para só a API:

```bash
npm run api
```

Swagger: http://localhost:8000/docs

## Viztto

No `.env` da raiz:

```env
TRANSFERMARKT_API_URL=http://localhost:8000
```

Não há chave de API. Ao escolher a liga na criação de carreira, a importação começa sozinha.
