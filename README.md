XImóveis — Plataforma de Anúncios Imobiliários

Resumo
- Aplicação web completa (frontend estático + API Node.js + MySQL) para cadastro, aprovação e busca de imóveis com integração de mapa, upload de fotos e gestão por perfis (Corretor/Imobiliária/Admin).
- Este README foi escrito em formato acadêmico, com seções de fundamentação técnica, arquitetura, implantação, segurança, teste e apêndices para evidências (screenshots).

Sumário
- Objetivos do Projeto
- Arquitetura e Stack Tecnológico
- Funcionalidades
- Requisitos e Ambiente
- Configuração e Implantação
- Estrutura de Diretórios
- Modelo de Dados (Visão Geral)
- API (Principais Endpoints)
- Fluxos por Papel (BROKER/AGENCY/ADMIN)
- Uploads e Armazenamento de Arquivos
- Segurança e Boas Práticas
- Testes e Qualidade
- Solução de Problemas (Troubleshooting)
- Roadmap e Trabalhos Futuros
- Licença e Agradecimentos
- Apêndice A — Espaços para Imagens de Tela

Objetivos do Projeto
- Disponibilizar um sistema de anúncios imobiliários com:
  - Cadastro de imóveis (certidão em PDF e até 50 fotos) por Corretores/Imobiliárias.
  - Curadoria/Aprovação por Administradores.
  - Busca pública com filtros (preço, tipo, finalidade, cidade/UF) e visualização no mapa.
  - Página de detalhes com galeria, informações e localização.

Arquitetura e Stack Tecnológico
- Frontend: HTML/CSS/JS estático em `frontend/public` (pode ser servido pelo próprio backend ou CDN/servidor estático).
- Backend: Node.js (Express) em `backend/src`.
- Banco de dados: MySQL 8+.
- Mapa: Leaflet + OpenStreetMap.
- Autenticação: JWT (armazenado em `sessionStorage`).

Funcionalidades
- Cadastro/Autenticação de usuários (Corretor/Imobiliária/Admin) com senha hasheada (bcrypt).
- Cadastro de imóveis com validações, localização geográfica e uploads (PDF + imagens).
- Aprovação/rejeição por Admin com anotações e histórico de eventos.
- Listagem “Meus Imóveis”, edição (retorna a PENDING) e exclusão pelo anunciante.
- Busca pública e visualização no mapa; página de detalhes com galeria e similares.

Requisitos e Ambiente
- Node.js 18+ (recomendado LTS mais recente).
- MySQL 8+.
- Ferramentas de linha de comando: `npm`, `mysql`.

Configuração e Implantação
- Banco de Dados
  - Importe o schema inicial ou o arquivo consolidado:
    - `mysql -u root -p < backend/database/ximoveis.sql`
- Backend
  - Entre em `backend` e instale dependências: `npm install`.
  - Copie `.env.example` para `.env` e ajuste:
    - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME=ximoveis`.
    - `JWT_SECRET` com um segredo forte.
    - (Opcional para certificados criptografados) `CERT_ENC_KEY` com 64 hex chars.
  - Inicie a API: `npm start`.
- Frontend
  - Conteúdo em `frontend/public`. Pode ser servido pelo Express (estático) ou por outro servidor web.

Estrutura de Diretórios (resumo)
- `backend/`
  - `src/`
    - `index.js` (bootstrap da API)
    - `controllers/` (lógica de negócios: auth, propriedades, admin)
    - `routes/` (rotas Express por domínio)
    - `middlewares/` (auth, roles)
    - `config/db.js` (pool MySQL)
  - `uploads/` (arquivos enviados: certidões + fotos)
  - `database/ximoveis.sql` (schema consolidado)
- `frontend/public/`
  - `index.html`, `busca.html`, `mapa.html`, `imovel.html`, `cadastrar.html`, `meus-imoveis.html`, `login.html`, `admin-dashboard.html`
  - `css/styles.css`, `js/*.js`, `vendor/leaflet/*`

Modelo de Dados (visão geral)
- `users(id, agency_id, name, email, phone, password_hash, role, cpf, creci, created_at)`
- `agencies(id, name, email, phone, cnpj, creci_juridico, created_at)`
- `properties(id, agency_id, user_id, title, description, price, city, state, location, …, status, created_at)`
- `property_images(id, property_id, image_path, is_cover, created_at)`
- `property_certificates(id, property_id, filename, path, mimetype, size, sha256_hash, verification_status, …)`
- `property_history(id, property_id, event_date, event_type, price, source, notes)`

API (principais endpoints)
- Autenticação
  - `POST /auth/login` — login com email/senha, retorna `{ token, user }`.
  - `POST /auth/register` — cadastro de usuário (BROKER/AGENCY) com telefone obrigatório; cria agência quando necessário.
- Imóveis — público
  - `GET /imoveis` — lista com filtros (purpose, type, minPrice, maxPrice, city, state, …).
  - `GET /imoveis/map?bbox=minLng,minLat,maxLng,maxLat` — pontos para mapa.
  - `GET /imoveis/:id` — detalhes + fotos + histórico.
- Imóveis — anunciante (JWT)
  - `GET /imoveis/meus` — imóveis do usuário / da sua agência.
  - `POST /imoveis/cadastrar` — multipart (PDF `certidao` + `photos[]`).
  - `PUT /imoveis/:id` — edição; imóvel retorna a `PENDING` para nova aprovação.
  - `DELETE /imoveis/:id` — exclusão (dono/mesma agência).
- Admin (JWT role ADMIN)
  - `GET /admin/properties/pending` — pendentes.
  - `GET /admin/properties/:id` — detalhes administrativos.
  - `POST /admin/anotacao/:id` — adiciona nota.
  - `POST /admin/properties/:id/cover` — define capa.
  - `GET /admin/certidao/:id` — stream de PDF (admin).

Fluxos por Papel
- BROKER/AGENCY
  - Cadastro → Login → Cadastrar imóvel (PDF+fotos) → Aguardar aprovação.
  - “Meus imóveis”: editar (retorna a PENDING) e excluir.
- ADMIN
  - Aprovar/Rejeitar, revisar certidão/fotos, adicionar notas, definir capa.

Uploads e Armazenamento
- Fotos e certidões são salvos em `backend/uploads`. A API normaliza as URLs com prefixo `/files/…`.
- Limite de fotos: até 50 por imóvel.

Segurança e Boas Práticas
- JWT no `Authorization: Bearer`.
- Sanitização de nomes de arquivo; hash SHA-256 de PDFs.
- (Opcional) criptografia de certidões (GCM) com `CERT_ENC_KEY`.

Testes e Qualidade
- Recomenda-se testes de integração (supertest) para login/cadastro, cadastro de imóvel, aprovação, e listagens.
- Testes manuais:
  - Upload de PDF > 5MB, múltiplas fotos, falhas de rede.
  - Variação de filtros na busca e mapa de grandes áreas.

Solução de Problemas
- “Token ausente” ao abrir certidão diretamente: lembre que links não enviam Authorization; use endpoint admin ou fetch autenticado.
- “Cannot GET /imoveis/:id/certidao”: verifique ordem das rotas (a rota dinâmica `/:id` deve ser a última).
- “Invalid or unexpected token” no Node: quase sempre arquivo com encoding corrompido; regravar em UTF‑8 sem BOM.

Roadmap (sugestões)
- Edição avançada de fotos (reordenar/remover) no modo editar do cadastro.
- Cache de tiles/markers no mapa e clusterização.
- Exportação de relatórios (CSV/Excel) para Admin.

Licença e Agradecimentos
- Uso interno/educacional. Ajuste conforme a política da sua instituição ou empresa.

Apêndice A — Espaços para Imagens de Tela
- Crie a pasta `docs/screenshots/` e adicione capturas de tela. Substitua os nomes abaixo pelos arquivos reais.

1) Página Inicial (home)
![Home](docs/screenshots/home.png)

2) Busca com Filtros
![Busca](docs/screenshots/busca.png)

3) Mapa de Imóveis
![Mapa](docs/screenshots/mapa.png)

4) Detalhe do Imóvel
![Detalhe](docs/screenshots/detalhe.png)

5) Cadastro (Corretor/Imobiliária)
![Cadastro de usuário](docs/screenshots/cadastro-usuario.png)

6) Cadastrar Imóvel
![Cadastrar imóvel](docs/screenshots/cadastrar-imovel.png)

7) Meus Imóveis
![Meus imóveis](docs/screenshots/meus-imoveis.png)

8) Painel do Administrador
![Admin](docs/screenshots/admin.png)

9) Fluxos de Aprovação
![Aprovação](docs/screenshots/aprovacao.png)
