# XImóveis — Scaffold (Backend + Frontend + DB)

Projeto acadêmico: portal imobiliário com mapa (Leaflet), cadastro com PDF da certidão e aprovação por ADMIN.

## Pré‑requisitos
- Node.js 18+
- MySQL 8+

## Banco de Dados
1) Crie o schema e tabelas:
   - Rode `database_schema.sql` no MySQL.
   - Cria o banco `ximoveis`, tabelas e índices (inclui índice espacial em `properties.location`).

2) (Opcional) Semear admin rápido:
   - `POST /auth/seed-admin`
   - Email: `admin@ximoveis.local` | Senha: `123456`

## Backend — Configuração e execução
1) Copie `backend/.env.example` para `backend/.env` e ajuste credenciais/`JWT_SECRET`.
2) Instale dependências:
```
cd backend
npm i
```
3) Suba a API:
```
node src/index.js
```
API em `http://localhost:3000`.

## Frontend — Páginas
- `index.html`: Home com hero, carrossel de “Imóveis em destaque” (com setas) e mapa com pins.
- `busca.html`: Busca completa (UF/Município/Bairro, Tipo, Finalidade, Palavras‑chave, filtros avançados). Ordenação: mais recentes, preço asc/desc.
- `mapa.html`: Mapa Leaflet com botão “Carregar imóveis na área” (bbox).
- `imovel.html`: Detalhe do imóvel + aba “Mapa & Histórico”.
- `login.html`: Entrar/Cadastrar com layout simples e labels.
- `cadastrar.html`: Formulário de cadastro (multipart + PDF da certidão) — envia para revisão (PENDING).
- `meus-imoveis.html`: Lista de imóveis do corretor/imobiliária logado.
- `admin.html`: Aprovação/rejeição, listagem com filtros e edição de imóveis (ADMIN).

Logo: coloque sua imagem em `frontend/public/assets/logo.png` (o header usa esse caminho). Paleta em azul‑marinho e laranja para combinar com a marca. Clicar na logo sempre leva para `index.html`.

## Rotas da API (principal)
- `GET /` → healthcheck.
- `POST /auth/login` → `{ token, user }`.
- `POST /auth/register` → cria usuário (BROKER/AGENCY).
  - Para `BROKER`: requer `cpf` e `creci`.
  - Para `AGENCY`: requer `cnpj` e `creciJuridico` (criado registro em `agencies`).
- `POST /auth/seed-admin` (dev) → cria admin.
- `GET /properties` → lista pública (`ACTIVE`). Filtros: `purpose,type,city,state,neighborhood,minPrice,maxPrice,minBedrooms,minBathrooms,suitesMin,parkingMin,minArea,maxArea,q` e `sort` (`newest|priceAsc|priceDesc`).
- `GET /properties/map?bbox=minLng,minLat,maxLng,maxLat` → pontos para o mapa (`ACTIVE`).
- `GET /properties/:id` → detalhe + histórico (`ACTIVE`).
- Protegido (BROKER/AGENCY):
  - `POST /properties` (multipart, campo `certidao` PDF) → cria PENDING + certificado PENDING.
  - `GET /properties/mine/list` → “Meus imóveis”.
- Admin (JWT role `ADMIN`):
  - `GET /admin/properties/pending`
  - `GET /admin/properties` (filtros: status, city, state, q, purpose, type)
  - `GET /admin/properties/:id`
  - `POST /admin/properties/:id/approve`
  - `POST /admin/properties/:id/reject`
  - `PUT /admin/properties/:id` (editar dados)

## Observações LGPD
- Não expor publicamente PDFs das certidões; apenas metadados e hash são armazenados.
- No detalhe público, exibir apenas “Certidão verificada” (bool) quando true.

## Próximos passos sugeridos
- Paginação em `/properties` e na busca.
- Galeria de imagens do imóvel (upload e capa).
- URLs assinadas para download de PDFs (somente admin).
- Melhorar validações e mensagens.

## Passo a passo
```
# 1) Criar banco/tabelas
mysql -u root -p < database_schema.sql

# 2) Backend
cd backend
cp .env.example .env   # edite .env com credenciais e JWT_SECRET
npm i
node src/index.js      # API http://localhost:3000

# 3) (Opcional) Criar admin
curl -X POST http://localhost:3000/auth/seed-admin

# 4) Frontend
# Abra as páginas de frontend/public/ com Live Server ou outro servidor estático.
```
