<img width="801" height="330" alt="image" src="https://github.com/user-attachments/assets/26d99a0d-7c89-4e66-912b-cd9051d8740d" />

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

1) Página Inicial (home)
<img width="943" height="434" alt="image" src="https://github.com/user-attachments/assets/98b83ad1-45f5-4dfc-bf9d-e4e09627fb5d" />
<img width="943" height="435" alt="image" src="https://github.com/user-attachments/assets/1006a2b5-4930-4194-b1f2-543615bd309a" />
<img width="943" height="430" alt="image" src="https://github.com/user-attachments/assets/947385d2-1049-4b55-a57d-d36adf350703" />

2) Busca com Filtros
<img width="943" height="433" alt="image" src="https://github.com/user-attachments/assets/25bcff73-9049-4a57-8c06-54d5aeede107" />

3) Mapa de Imóveis
<img width="943" height="429" alt="image" src="https://github.com/user-attachments/assets/684d2a10-7f6c-45cf-968b-d1840762edbe" />

4) Detalhe do Imóvel
<img width="943" height="431" alt="image" src="https://github.com/user-attachments/assets/3b189659-9fa0-4ecb-bd09-2cd5cb7fe7e3" />
<img width="943" height="417" alt="image" src="https://github.com/user-attachments/assets/d79f1d34-e1ac-4349-b15a-a5539f007a8c" />
<img width="943" height="430" alt="image" src="https://github.com/user-attachments/assets/603c4616-a824-40a9-be93-8563b0376695" />
<img width="943" height="433" alt="image" src="https://github.com/user-attachments/assets/c8c196e1-d8c5-4188-ad9e-c33b813e49d6" />
<img width="943" height="432" alt="image" src="https://github.com/user-attachments/assets/27c142e8-a105-41ce-9734-631e6ae28692" />

5) Cadastro (Corretor/Imobiliária)
<img width="943" height="436" alt="image" src="https://github.com/user-attachments/assets/2a04ae97-476e-48a3-907b-abe4a585ef03" />

6) Cadastrar Imóvel
<img width="943" height="432" alt="image" src="https://github.com/user-attachments/assets/8bb3f3ef-60fa-49bc-b055-f616631b652e" />
<img width="943" height="433" alt="image" src="https://github.com/user-attachments/assets/540ecfc0-debe-44f6-8627-8efce45cf521" />
<img width="943" height="432" alt="image" src="https://github.com/user-attachments/assets/ae124e0f-351a-41d3-b485-e5fa4c4898b6" />

7) Meus Imóveis
<img width="943" height="432" alt="image" src="https://github.com/user-attachments/assets/261724ee-86cf-49c7-a0ce-f8e6a499d38d" />

8) Painel do Administrador
<img width="943" height="426" alt="image" src="https://github.com/user-attachments/assets/2a996b24-fc31-4ca1-b6f6-795a9d357ea5" />

9) Fluxos de Aprovação
<img width="943" height="427" alt="image" src="https://github.com/user-attachments/assets/43923b98-0ef7-42b0-8841-e1bec4004ced" />
<img width="943" height="433" alt="image" src="https://github.com/user-attachments/assets/385e30a9-a62a-40c4-8b43-4d9e99b4e9f2" />
<img width="943" height="433" alt="image" src="https://github.com/user-attachments/assets/3bc0e883-5dcd-4438-8237-38f415b443e8" />
<img width="943" height="428" alt="image" src="https://github.com/user-attachments/assets/45e046f6-d943-43f7-acb6-5aa3b016f38d" />


