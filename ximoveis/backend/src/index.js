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

const app = express();

// Security and utilities
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/properties', propertiesRoutes);
app.use('/admin', adminRoutes);

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

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
