# XImóveis — Guia de Desenvolvimento (DEV)

Documento focado para quem vai dar manutenção no projeto: como rodar local, estrutura do código, endpoints, fluxos, padrões de código, troubleshooting e exemplos de chamadas.

## Sumário
- Visão Geral
- Requisitos
- Banco de Dados
- Backend (API)
- Frontend (estático)
- Estrutura de Diretórios
- Endpoints (DEV)
- Fluxos de Autorização
- Padrões de Código e Boas Práticas
- Scripts e Exemplos (cURL)
- Troubleshooting (DEV)
- Roadmap Técnico

---

## Visão Geral
- Monorepo simples com ackend (Express + MySQL) e rontend/public (HTML/CSS/JS).
- Autenticação JWT; token fica em sessionStorage no navegador.
- Uploads (PDF certidão + imagens) vão para ackend/uploads/ e são servidos via /files/....

## Requisitos
- Node.js 18+ (LTS recomendado)
- MySQL 8+
- Ferramentas: 
pm, mysql, curl (opcional)

## Banco de Dados
1. Criar/atualizar schema:
   `ash
   mysql -u root -p < backend/database/ximoveis.sql
   `
2. (Opcional) Admin rápido:
   - POST /auth/seed-admin
   - Cria admin e uma agência padrão quando não existe.

## Backend (API)
### Configuração
`ash
cd backend
cp .env.example .env   # configure DB_HOST/USER/PASS/NAME, JWT_SECRET, etc.
npm install
npm start              # API em http://localhost:3000
`
Variáveis importantes no .env:
- DB_HOST, DB_USER, DB_PASS, DB_NAME
- JWT_SECRET
- (Opcional) CERT_ENC_KEY (64 hex) — suporte à criptografia de certidões

### Estrutura (backend/src)
- index.js — bootstrap do Express, middlewares e express.static('/files', uploads)
- config/db.js — pool MySQL
- middlewares/auth.js — equireAuth, equireRole('ADMIN')
- outes/
  - uth.js, properties.js, dmin.js
- controllers/
  - uthController.js — login, register, seedAdmin
  - propertyController.js — listar/criar/editar/excluir, detalhes, mapa, meus
  - dminController.js — aprovação, notas, listar pendentes, etc.

## Frontend (estático)
- Conteúdo em rontend/public. Use qualquer servidor estático (Live Server, etc.) ou sirva pelo próprio backend.
- Páginas principais: index.html, usca.html, mapa.html, imovel.html, cadastrar.html, meus-imoveis.html, login.html, dmin-dashboard.html.

## Estrutura de Diretórios
`
backend/
  src/
    controllers/
    routes/
    middlewares/
    config/
  uploads/
  database/ximoveis.sql
frontend/
  public/
    css/ js/ vendor/ assets/
`

## Endpoints (DEV)
### Auth
- POST /auth/login → { token, user }
- POST /auth/register → cria usuário (BROKER/AGENCY) com phone obrigatório; cria gencies para AGENCY
- POST /auth/seed-admin → cria admin (uso dev)

### Imóveis — Público
- GET /imoveis → lista (somente ACTIVE), filtros via query: purpose,type,city,state,minPrice,maxPrice,minBedrooms,minBathrooms,sort
- GET /imoveis/map?bbox=minLng,minLat,maxLng,maxLat → pontos para mapa
- GET /imoveis/:id → detalhe + { photos, history }

### Imóveis — Anunciante (JWT)
- GET /imoveis/meus → imóveis do usuário e/ou da sua agência
- POST /imoveis/cadastrar → multipart (campos: certidao PDF, photos[] imagens)
- PUT /imoveis/:id → edita campos; imóvel volta a PENDING
- DELETE /imoveis/:id → remove (dono/mesma agência)

### Admin (JWT role ADMIN)
- GET /admin/properties/pending → pendentes
- GET /admin/properties/:id → detalhes administrativos
- POST /admin/anotacao/:id → adiciona nota
- POST /admin/properties/:id/cover → define capa da galeria
- GET /admin/certidao/:id → stream da certidão para admin

Observação de ordem de rotas: no arquivo outes/properties.js, a rota dinâmica GET '/:id' deve ser a última para não capturar prefixos como /:id/certidao.

## Fluxos de Autorização
- BROKER/AGENCY: pode cadastrar, listar “meus”, editar (retorna PENDING), excluir.
- ADMIN: pode aprovar/rejeitar, ver certidões, anotar e definir capa.

## Padrões de Código e Boas Práticas
- Node: sync/await, 	ry/catch, retornar mensagens claras ({ error: string }).
- SQL: parâmetros com placeholders (?), normalizar caminhos de arquivo (/files/...).
- Front: evitar href para endpoints protegidos (use etch com Bearer e blobs quando necessário).

## Scripts e Exemplos
### Login
`ash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ximoveis.local","password":"123456"}'
`
### Cadastrar Imóvel (multipart)
`ash
curl -s -X POST http://localhost:3000/imoveis/cadastrar \
  -H "Authorization: Bearer " \
  -F certidao=@/caminho/certidao.pdf \
  -F photos[]=@/caminho/foto1.jpg \
  -F title='Casa ampla' -F price=750000 -F city='Brasilia' -F state='DF' \
  -F purpose=SALE -F type=HOUSE -F lat=-15.78 -F lng=-47.93
`
### Editar Imóvel
`ash
curl -s -X PUT http://localhost:3000/imoveis/123 \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer " \
  -d '{"title":"Casa ampla reformada","price":799000}'
`

## Troubleshooting (DEV)
- “Invalid or unexpected token” no Node: arquivo com encoding corrompido; regrave em UTF‑8 sem BOM.
- “Token ausente” ao abrir certidão: links não enviam Authorization; para admin use /admin/certidao/:id, para dono use endpoint protegido ou um fetch autenticado com blob.
- “Cannot GET /imoveis/:id/certidao”: verifique a ordem das rotas (coloque /:id/certidao antes de /:id).
- Header parecendo “deslogado” no front: algum erro JS anterior impediu pplyNav(); ver Console.

## Roadmap Técnico
- URLs assinadas/expiração para downloads de PDF.
- Paginação nas listas, filtros adicionais e índices no DB.
- Melhorias de DX: scripts npm, ESLint/Prettier, testes e2e.
