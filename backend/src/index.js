const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const propertiesRoutes = require('./routes/properties');
const adminRoutes = require('./routes/admin');
const propertyController = require('./controllers/propertyController');

const app = express();

// Security and utilities
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(morgan('dev'));
// Aumenta limites para corpos grandes (JSON/URL-encoded). Multipart é tratado pelo multer nos controladores.
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Ensure uploads dir exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadsPath = path.join(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Basic healthcheck
app.get('/', (req, res) => {
  res.json({ ok: true, name: 'XImóveis API', version: '0.1.0' });
});

// Routes
app.use('/auth', authRoutes);
// Existing English routes
app.use('/properties', propertiesRoutes);
// Portuguese aliases required by spec
app.use('/imoveis', propertiesRoutes);
app.use('/admin', adminRoutes);

// Do NOT expose entire uploads directory publicly since certificates are encrypted.
// If needed, a specific image-serving route can be added later.

// Serve frontend static with explicit UTF-8 charset
const publicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
      else if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }));
}

// Servir uploads de forma controlada (imagens/PDF) — necessário para pré-visualizações
const uploadsPublic = path.join(__dirname, '..', (process.env.UPLOAD_DIR || 'uploads'));
if (fs.existsSync(uploadsPublic)) {
  app.use('/files', express.static(uploadsPublic));
}

// Portuguese singular alias for details
app.get('/imovel/:id', propertyController.getProperty);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
// Aumenta timeouts para uploads grandes
server.requestTimeout = 10 * 60 * 1000; // 10 min
server.headersTimeout = 12 * 60 * 1000;
