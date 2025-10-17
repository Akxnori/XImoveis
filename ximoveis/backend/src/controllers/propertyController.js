const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../config/db');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadsPath = path.join(__dirname, '..', '..', UPLOAD_DIR);

// Multer setup: accept only PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const base = path.parse(file.originalname).name
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 50);
    const fn = `${Date.now()}_${base}.pdf`;
    cb(null, fn);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas PDF é permitido para a certidão'));
    }
    cb(null, true);
  },
});

async function listProperties(req, res) {
  try {
    const { purpose, type, minPrice, maxPrice, city, state, minBedrooms, minBathrooms } = req.query;
    const { neighborhood, address, q, suitesMin, parkingMin, minArea, maxArea, bbox, lat, lng, radiusKm } = req.query;
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
    if (suitesMin) { where.push('p.suites >= ?'); params.push(Number(suitesMin)); }
    if (parkingMin) { where.push('p.parking_spaces >= ?'); params.push(Number(parkingMin)); }
    if (minArea) { where.push('p.area_m2 >= ?'); params.push(Number(minArea)); }
    if (maxArea) { where.push('p.area_m2 <= ?'); params.push(Number(maxArea)); }
    if (neighborhood) { where.push('p.neighborhood LIKE ?'); params.push(`%${neighborhood}%`); }
    if (address) { where.push('p.address LIKE ?'); params.push(`%${address}%`); }
    if (q) {
      where.push('(p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ? OR p.neighborhood LIKE ? OR p.city LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    // Spatial filters: bbox OR (lat,lng,radiusKm -> bbox approx)
    let bboxParam = bbox;
    if (!bboxParam && lat && lng && radiusKm) {
      const latNum = Number(lat), lngNum = Number(lng), r = Number(radiusKm);
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum) && !Number.isNaN(r) && r > 0) {
        const dLat = r / 111; // approx degrees per km
        const dLng = r / (111 * Math.cos(latNum * Math.PI / 180));
        const minLng = lngNum - dLng, maxLng = lngNum + dLng;
        const minLat = latNum - dLat, maxLat = latNum + dLat;
        bboxParam = [minLng, minLat, maxLng, maxLat].join(',');
      }
    }
    if (bboxParam) {
      const nums = bboxParam.split(',').map(Number);
      if (nums.length === 4 && nums.every((n) => !Number.isNaN(n))) {
        const [minLng, minLat, maxLng, maxLat] = nums;
        const polyWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
        where.push('ST_Within(p.location, ST_PolygonFromText(?, 4326))');
        params.push(polyWkt);
      }
    }

    let order = 'p.created_at DESC';
    const sort = req.query.sort;
    if (sort === 'priceAsc') order = 'CASE WHEN p.price IS NULL THEN 1 ELSE 0 END, p.price ASC';
    if (sort === 'priceDesc') order = 'CASE WHEN p.price IS NULL THEN 1 ELSE 0 END, p.price DESC';
    if (sort === 'newest') order = 'p.created_at DESC';
    const sql = `
      SELECT p.id, p.title, p.price, p.city, p.state,
             p.type, p.purpose, p.bedrooms, p.bathrooms,
             ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
             p.certificate_verified
      FROM properties p
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT 100
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
}

async function listForMap(req, res) {
  try {
    const { bbox } = req.query; // minLng,minLat,maxLng,maxLat
    if (!bbox) return res.status(400).json({ error: 'bbox é obrigatório' });
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'bbox inválido' });
    }
    const polyWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
    const sql = `
      SELECT p.id, p.title, p.price, ST_X(p.location) AS lng, ST_Y(p.location) AS lat
      FROM properties p
      WHERE p.status = 'ACTIVE'
        AND ST_Within(p.location, ST_PolygonFromText(?, 4326))
      LIMIT 1000
    `;
    const [rows] = await pool.query(sql, [polyWkt]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao carregar mapa' });
  }
}

async function getProperty(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT p.*, ST_X(p.location) AS lng, ST_Y(p.location) AS lat
       FROM properties p WHERE p.id = ? AND p.status = 'ACTIVE'`,
      [id]
    );
    const prop = rows[0];
    if (!prop) return res.status(404).json({ error: 'Imóvel não encontrado' });
    const [history] = await pool.query(
      `SELECT id, event_date, event_type, price, source, notes
       FROM property_history WHERE property_id = ? ORDER BY event_date DESC`,
      [id]
    );
    res.json({ property: prop, history });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao obter imóvel' });
  }
}

// Helper to compute SHA-256 file hash
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function createProperty(req, res) {
  // multer middleware handles file
  const handler = upload.single('certidao');
  handler(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha no upload' });
    }
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
      if (!req.file) {
        return res.status(400).json({ error: 'Certidão (PDF) é obrigatória' });
      }
      const pointWkt = `POINT(${Number(lng)} ${Number(lat)})`;
      // Determine agency for user (if any)
      let agencyId = null;
      try {
        const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ?', [req.user.id]);
        if (uRows.length) agencyId = uRows[0].agency_id || null;
      } catch(_) {}
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

        // History
        await conn.query(
          `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
           VALUES (?, NOW(), 'STATUS_CHANGE', ?, 'system', 'Criado como PENDING')`,
          [propertyId, Number(price)]
        );

        // Certificate metadata
        const filePath = path.join(UPLOAD_DIR, req.file.filename);
        const hash = await sha256File(path.join(uploadsPath, req.file.filename));
        await conn.query(
          `INSERT INTO property_certificates
             (property_id, filename, path, mimetype, size, sha256_hash, verification_status, notes, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NULL, NOW())`,
          [propertyId, req.file.originalname, filePath, req.file.mimetype, req.file.size, hash]
        );

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
    const role = req.user.role;
    let where = 'p.user_id = ?';
    let params = [userId];
    if (role === 'AGENCY') {
      const [uRows] = await pool.query('SELECT agency_id FROM users WHERE id = ?', [userId]);
      const agencyId = uRows[0]?.agency_id || null;
      if (agencyId) { where = 'p.agency_id = ?'; params = [agencyId]; }
    }
    const sql = `
      SELECT p.id, p.title, p.status, p.price, p.city, p.state, p.created_at,
        (SELECT verification_status FROM property_certificates pc WHERE pc.property_id = p.id ORDER BY uploaded_at DESC LIMIT 1) AS cert_status,
        (SELECT notes FROM property_certificates pc2 WHERE pc2.property_id = p.id ORDER BY uploaded_at DESC LIMIT 1) AS cert_notes
      FROM properties p
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT 200
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar meus imóveis' });
  }
}

module.exports = {
  listProperties,
  listForMap,
  getProperty,
  createProperty,
  listMyProperties,
};
