const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../config/db');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadsPath = path.join(__dirname, '..', '..', UPLOAD_DIR);
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// Multer: aceita PDF e imagens, mantém extensão original (limite alto ~2GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    try {
      const p = path.parse(file.originalname || 'arquivo');
      const base = String(p.name || 'arquivo').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 50);
      const ext = (p.ext && p.ext.substring(0, 10)) || '';
      cb(null, `${Date.now()}_${base}${ext}`);
    } catch {
      cb(null, `${Date.now()}_upload.bin`);
    }
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function listProperties(req, res) {
  try {
    const { purpose, type, minPrice, maxPrice, city, state, minBedrooms, minBathrooms, sort } = req.query;
    const where = ["p.status = 'ACTIVE'"];
    const params = [];
    if (purpose) { where.push('p.purpose = ?'); params.push(purpose); }
    if (type) { where.push('p.type = ?'); params.push(type); }
    if (minPrice) { where.push('p.price >= ?'); params.push(Number(minPrice)); }
    if (maxPrice) { where.push('p.price <= ?'); params.push(Number(maxPrice)); }
    if (city) { where.push('p.city LIKE ?'); params.push(`%${city}%`); }
    if (state) { where.push('p.state = ?'); params.push(state); }
    if (minBedrooms) { where.push('p.bedrooms >= ?'); params.push(Number(minBedrooms)); }
    if (minBathrooms) { where.push('p.bathrooms >= ?'); params.push(Number(minBathrooms)); }
    let order = 'p.created_at DESC';
    if (sort === 'priceAsc') order = 'CASE WHEN p.price IS NULL THEN 1 ELSE 0 END, p.price ASC';
    if (sort === 'priceDesc') order = 'CASE WHEN p.price IS NULL THEN 1 ELSE 0 END, p.price DESC';
    if (sort === 'newest') order = 'p.created_at DESC';

    const sql = `
      SELECT p.id, p.title, p.price, p.city, p.state,
             p.type, p.purpose, p.bedrooms, p.bathrooms,
             ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
             p.certificate_verified,
             (SELECT image_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.is_cover DESC, pi.id ASC LIMIT 1) AS cover_path
      FROM properties p
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT 500`;
    const [rows] = await pool.query(sql, params);
    const out = rows.map(r=>{
      let rel = String(r.cover_path||'').replace(/\\/g,'/');
      if (rel.startsWith('/')) rel = rel.slice(1);
      if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
      return { ...r, cover_path: rel ? `/files/${rel}` : null };
    });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
}

async function listForMap(req, res) {
  try {
    const { bbox } = req.query;
    const where = ["p.status = 'ACTIVE'"];
    const params = [];
    if (bbox) {
      const nums = String(bbox).split(',').map(Number);
      if (nums.length === 4 && nums.every(n => !Number.isNaN(n))) {
        const [minLng, minLat, maxLng, maxLat] = nums;
        const polyWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
        where.push('ST_Within(p.location, ST_PolygonFromText(?, 4326))');
        params.push(polyWkt);
      }
    }
    const sql = `
      SELECT p.id, p.title, p.price,
             ST_Y(p.location) AS lat, ST_X(p.location) AS lng
      FROM properties p
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT 1000`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar mapa' });
  }
}

async function getProperty(req, res) {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT p.*, ST_Y(p.location) AS lat, ST_X(p.location) AS lng,
              u.name AS user_name, u.role AS user_role, u.phone AS user_phone,
              a.name AS agency_name, a.phone AS agency_phone
        FROM properties p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN agencies a ON a.id = p.agency_id
       WHERE p.id = ?
        LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Imóvel não encontrado' });
    // Histórico (opcional)
    const [hist] = await pool.query(
      `SELECT event_date, event_type, price, source, notes FROM property_history WHERE property_id = ? ORDER BY event_date DESC LIMIT 100`,
      [id]
    );
    const [photosRows] = await pool.query(
      `SELECT image_path FROM property_images WHERE property_id = ? ORDER BY is_cover DESC, id ASC`,
      [id]
    );
    const photos = photosRows.map(r => {
      let rel = String(r.image_path || '').replace(/\\/g, '/');
      if (rel.startsWith('/')) rel = rel.slice(1);
      if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
      return `/files/${rel}`;
    });
    const prop = rows[0];
    prop.cover_path = photos[0] || null;
    res.json({ property: prop, history: hist, photos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao obter imóvel' });
  }
}

async function createProperty(req, res) {
  // Aceita certidao (1) e fotos (até 50) — names: certidao, photos, photos[]
  const handler = upload.fields([
    { name: 'certidao', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'photos', maxCount: 50 },
    { name: 'photos[]', maxCount: 50 },
  ]);
  handler(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Falha no upload' });
    try {
      const {
        title, description, price, bedrooms, bathrooms,
        suites, parking_spaces, area_m2, lot_size_m2, year_built, floor,
        maintenance_fee, iptu, address, neighborhood,
        city, state, purpose, type, lat, lng
      } = req.body;
      if (!title || !price || !city || !state || !purpose || !type || !lat || !lng) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
      }

      const certArr = (req.files && (req.files.certidao || req.files['certidao'])) || [];
      const certFile = certArr[0];
      if (!certFile) return res.status(400).json({ error: 'Certidão (PDF) é obrigatória' });
      if (!String(certFile.mimetype||'').toLowerCase().includes('pdf') && !String(certFile.originalname||'').toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'A certidão deve ser um arquivo PDF' });
      }

      const pointWkt = `POINT(${Number(lng)} ${Number(lat)})`;
      // Descobre agency_id do usuário (se houver)
      let agencyId = null;
      try {
        const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ?', [req.user.id]);
        if (uRows.length) agencyId = uRows[0].agency_id || null;
      } catch {}

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [insProp] = await conn.query(
          `INSERT INTO properties
            (agency_id, user_id, title, description, price, bedrooms, bathrooms,
             suites, parking_spaces, area_m2, lot_size_m2, year_built, floor,
             maintenance_fee, iptu, address, neighborhood,
             city, state, purpose, type, status, certificate_required, certificate_verified, location)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', TRUE, FALSE, ST_GeomFromText(?, 4326))`,
          [agencyId, req.user.id, title, description || null, Number(price), Number(bedrooms||0), Number(bathrooms||0),
           Number(suites||0), Number(parking_spaces||0), area_m2?Number(area_m2):null, lot_size_m2?Number(lot_size_m2):null, year_built?Number(year_built):null, floor?Number(floor):null,
           maintenance_fee?Number(maintenance_fee):null, iptu?Number(iptu):null, address||null, neighborhood||null,
           city, state, purpose, type, pointWkt]
        );
        const propertyId = insProp.insertId;

        // Histórico básico
        await conn.query(
          `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
           VALUES (?, NOW(), 'STATUS_CHANGE', ?, 'system', 'Criado como PENDING')`,
          [propertyId, Number(price)]
        );

        // Metadados do PDF
        const filePath = `${UPLOAD_DIR}/${certFile.filename}`;
        const hash = await sha256File(path.join(uploadsPath, certFile.filename));
        await conn.query(
          `INSERT INTO property_certificates
             (property_id, filename, path, mimetype, size, sha256_hash, verification_status, notes, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NULL, NOW())`,
          [propertyId, certFile.originalname, filePath, certFile.mimetype, certFile.size, hash]
        );

        // Fotos (capa + demais)
        const coverArr = (req.files && (req.files.cover || req.files['cover'])) || [];
        const photos = (req.files && (req.files.photos || req.files['photos[]'])) || [];
        if (coverArr.length || photos.length) {
          const values = [];
          if (coverArr[0]) {
            values.push([propertyId, `${UPLOAD_DIR}/${coverArr[0].filename}`, true]);
            if (photos.length) photos.forEach(f => values.push([propertyId, `${UPLOAD_DIR}/${f.filename}`, false]));
          } else if (photos.length) {
            // Sem capa explícita: primeira foto vira capa
            photos.forEach((f, idx) => values.push([propertyId, `${UPLOAD_DIR}/${f.filename}`, idx===0]));
          }
          if (values.length) {
            await conn.query(`INSERT INTO property_images (property_id, image_path, is_cover) VALUES ?`, [values]);
          }
        }

        await conn.commit();
        res.status(201).json({ id: propertyId, status: 'PENDING' });
      } catch (e) {
        await conn.rollback();
        console.error(e);
        res.status(500).json({ error: 'Erro ao cadastrar imóvel' });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao processar cadastro' });
    }
  });
}

async function listMyProperties(req, res) {
  try {
    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();
    // Busca agency_id do usuário (se existir) e sempre inclui ambos filtros
    let agencyId = null;
    try {
      const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ?', [userId]);
      agencyId = uRows[0]?.agency_id || null;
    } catch {}
    const whereParts = ['p.user_id = ?'];
    const params = [userId];
    if (agencyId != null) { whereParts.push('p.agency_id = ?'); params.push(agencyId); }
    const where = `(${whereParts.join(' OR ')})`;
    const sql = `
      SELECT p.id, p.title, p.status, p.price, p.city, p.state, p.created_at,
        (SELECT verification_status FROM property_certificates pc WHERE pc.property_id = p.id ORDER BY uploaded_at DESC LIMIT 1) AS cert_status,
        (SELECT notes FROM property_certificates pc2 WHERE pc2.property_id = p.id ORDER BY uploaded_at DESC LIMIT 1) AS cert_notes
      FROM properties p
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT 200`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar meus imóveis' });
  }
}

async function deleteProperty(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const userId = req.user.id;
    // Descobre agency_id do usuário (se existir)
    let agencyId = null;
    try {
      const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length) agencyId = uRows[0].agency_id || null;
    } catch {}

    // Carrega o imóvel e verifica permissão
    const [rows] = await pool.query('SELECT id, user_id, agency_id FROM properties WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Imóvel não encontrado' });
    const prop = rows[0];
    const allowed = role === 'ADMIN' || (Number(prop.user_id) === Number(userId)) || (agencyId != null && Number(prop.agency_id) === Number(agencyId));
    if (!allowed) return res.status(403).json({ error: 'Sem permissão para excluir este imóvel' });

    // Tenta remover arquivos físicos (fotos e PDFs) de forma best-effort
    try {
      const [photos] = await pool.query('SELECT image_path FROM property_images WHERE property_id = ?', [id]);
      const [certs] = await pool.query('SELECT path FROM property_certificates WHERE property_id = ?', [id]);
      const paths = [];
      photos.forEach(r => { if (r.image_path) paths.push(r.image_path); });
      certs.forEach(r => { if (r.path) paths.push(r.path); });
      paths.forEach(rel => {
        try {
          const p = String(rel).replace(/^[./]+/, '');
          const abs = path.join(__dirname, '..', '..', p);
          if (fs.existsSync(abs)) fs.unlink(abs, ()=>{});
        } catch {}
      });
    } catch {}

    await pool.query('DELETE FROM properties WHERE id = ? LIMIT 1', [id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao excluir imóvel' });
  }
}

async function updateProperty(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const userId = req.user.id;
    // Descobre agency_id do usuário (se existir)
    let agencyId = null;
    try {
      const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length) agencyId = uRows[0].agency_id || null;
    } catch {}

    const [rows] = await pool.query('SELECT id, user_id, agency_id FROM properties WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Imóvel não encontrado' });
    const prop = rows[0];
    const allowed = (Number(prop.user_id) === Number(userId)) || (agencyId != null && Number(prop.agency_id) === Number(agencyId));
    if (!allowed) return res.status(403).json({ error: 'Sem permissão para editar este imóvel' });

    const fields = ['title','description','price','bedrooms','bathrooms','suites','parking_spaces','area_m2','lot_size_m2','year_built','floor','maintenance_fee','iptu','address','neighborhood','city','state','purpose','type'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (f in req.body) { sets.push(`p.${f} = ?`); params.push(req.body[f]); }
    }
    // Localização
    if (req.body.lat != null && req.body.lng != null) {
      sets.push('p.location = ST_GeomFromText(?, 4326)');
      params.push(`POINT(${Number(req.body.lng)} ${Number(req.body.lat)})`);
    }
    // Ao editar, volta para revisão
    sets.push("p.status = 'PENDING'");
    sets.push('p.certificate_verified = FALSE');
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });

    const sql = `UPDATE properties p SET ${sets.join(', ')}, updated_at = NOW() WHERE p.id = ? LIMIT 1`;
    params.push(id);
    await pool.query(sql, params);
    await pool.query(
      `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
       VALUES (?, NOW(), 'STATUS_CHANGE', NULL, 'user', 'Editado pelo anunciante; enviado para revisão')`,
      [id]
    );
    return res.json({ ok: true, status: 'PENDING' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
}

async function streamCertificateOwner(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    // Verifica permissão: dono ou mesma agência
    let agencyId = null;
    try {
      const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length) agencyId = uRows[0].agency_id || null;
    } catch {}
    const [rows] = await pool.query('SELECT user_id, agency_id FROM properties WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Imóvel não encontrado' });
    const allowed = (Number(rows[0].user_id)===Number(userId)) || (agencyId!=null && Number(rows[0].agency_id)===Number(agencyId));
    if (!allowed) return res.status(403).json({ error: 'Sem permissão' });

    const [certs] = await pool.query('SELECT path, mimetype FROM property_certificates WHERE property_id = ? ORDER BY uploaded_at DESC LIMIT 1', [id]);
    const cert = certs[0];
    if (!cert) return res.status(404).json({ error: 'Certidão não encontrada' });
    const abs = path.join(__dirname, '..', '..', String(cert.path));
    res.setHeader('Content-Type', cert.mimetype || 'application/pdf');
    return fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao enviar certidão' });
  }
}

module.exports = {
  listProperties,
  listForMap,
  getProperty,
  createProperty,
  listMyProperties,
  deleteProperty,
  updateProperty,
  streamCertificateOwner,
};
