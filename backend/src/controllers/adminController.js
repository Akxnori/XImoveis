const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const crypto = require('crypto');

async function listPending(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, price, city, state, purpose, type, created_at
       FROM properties WHERE status = 'PENDING' ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar pendências' });
  }
}

async function listAll(req, res) {
  try {
    const { status, city, state, q, purpose, type } = req.query;
    const where = ['1=1'];
    const params = [];
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (city) { where.push('p.city LIKE ?'); params.push(`%${city}%`); }
    if (state) { where.push('p.state = ?'); params.push(state); }
    if (purpose) { where.push('p.purpose = ?'); params.push(purpose); }
    if (type) { where.push('p.type = ?'); params.push(type); }
    if (q) { where.push('(p.title LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const sql = `
      SELECT p.id, p.title, p.status, p.price, p.city, p.state, p.purpose, p.type, p.created_at
      FROM properties p
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT 300
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
}

async function getPropertyAdmin(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT p.*, ST_X(p.location) AS lng, ST_Y(p.location) AS lat
       FROM properties p WHERE p.id = ?`, [id]
    );
    const prop = rows[0];
    if (!prop) return res.status(404).json({ error: 'Imóvel não encontrado' });
    const [certs] = await pool.query(
      `SELECT * FROM property_certificates WHERE property_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
      [id]
    );
    res.json({ property: prop, certificate: certs[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao obter imóvel (admin)' });
  }
}

async function approveProperty(req, res) {
  const { id } = req.params;
  const notes = req.body?.notes || 'Aprovado';
  const adminId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE properties SET status = 'ACTIVE', certificate_verified = TRUE WHERE id = ?`,
      [id]
    );
    await conn.query(
      `UPDATE property_certificates SET verification_status = 'APPROVED', verified_by = ?, verified_at = NOW(), notes = ?
       WHERE property_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
      [adminId, notes, id]
    );
    await conn.query(
      `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
       VALUES (?, NOW(), 'STATUS_CHANGE', NULL, 'admin', 'Aprovado')`,
      [id]
    );
    await conn.commit();
    res.json({ ok: true, id, status: 'ACTIVE' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro ao aprovar' });
  } finally {
    conn.release();
  }
}

async function rejectProperty(req, res) {
  const { id } = req.params;
  const reason = req.body?.reason || 'Rejeitado';
  const adminId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE properties SET status = 'REJECTED', certificate_verified = FALSE WHERE id = ?`,
      [id]
    );
    await conn.query(
      `UPDATE property_certificates SET verification_status = 'REJECTED', verified_by = ?, verified_at = NOW(), notes = ?
       WHERE property_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
      [adminId, reason, id]
    );
    await conn.query(
      `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
       VALUES (?, NOW(), 'STATUS_CHANGE', NULL, 'admin', ?)`,
      [id, reason]
    );
    await conn.commit();
    res.json({ ok: true, id, status: 'REJECTED' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Erro ao rejeitar' });
  } finally {
    conn.release();
  }
}

async function updateProperty(req, res) {
  const { id } = req.params;
const fields = [
      'title','description','price','bedrooms','bathrooms','suites','parking_spaces','area_m2','lot_size_m2','year_built','floor',
      'maintenance_fee','iptu','address','address_number','postal_code','neighborhood','city','state','purpose','type','status','lat','lng'
    ];
  const data = req.body || {};
  const sets = [];
  const params = [];
  for (const key of fields) {
    if (data[key] !== undefined && key !== 'lat' && key !== 'lng') {
      sets.push(`p.${key} = ?`);
      params.push(data[key]);
    }
  }
  try {
    if (data.lat !== undefined && data.lng !== undefined) {
      sets.push('p.location = ST_GeomFromText(?, 4326)');
      params.push(`POINT(${Number(data.lng)} ${Number(data.lat)})`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    const sql = `UPDATE properties p SET ${sets.join(', ')} WHERE p.id = ?`;
    params.push(id);
    await pool.query(sql, params);
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
}

async function addAnnotation(req, res) {
  const { id } = req.params;
  const { note } = req.body || {};
  if (!note || !String(note).trim()) return res.status(400).json({ error: 'Nota vazia' });
  try {
    await pool.query(
      `INSERT INTO property_history (property_id, event_date, event_type, price, source, notes)
       VALUES (?, NOW(), 'NOTE', NULL, 'admin', ?)`,
      [id, String(note).trim()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao adicionar anotação' });
  }
}

async function streamCertificate(req, res) {
  const { id } = req.params; // property id
  try {
    const [rows] = await pool.query(
      `SELECT path, mimetype, encrypted, enc_algo, enc_iv, enc_auth_tag
       FROM property_certificates WHERE property_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
      [id]
    );
    const cert = rows[0];
    if (!cert) return res.status(404).json({ error: 'Certidão não encontrada' });
    const absPath = path.join(__dirname, '..', '..', cert.path);
    res.setHeader('Content-Type', cert.mimetype || 'application/pdf');
    if (cert.encrypted) {
      const keyHex = process.env.CERT_ENC_KEY || '';
      if (!keyHex || keyHex.length !== 64) return res.status(500).json({ error: 'CERT_ENC_KEY não configurada' });
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.isBuffer(cert.enc_iv) ? cert.enc_iv : Buffer.from(cert.enc_iv);
      const authTag = Buffer.isBuffer(cert.enc_auth_tag) ? cert.enc_auth_tag : Buffer.from(cert.enc_auth_tag);
      const algo = cert.enc_algo || 'aes-256-gcm';
      const decipher = crypto.createDecipheriv(algo, key, iv);
      decipher.setAuthTag(authTag);
      fs.createReadStream(absPath).pipe(decipher).pipe(res);
    } else {
      fs.createReadStream(absPath).pipe(res);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao enviar certidão' });
  }
}

async function listPropertyPhotos(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT image_path FROM property_images WHERE property_id = ? ORDER BY is_cover DESC, id ASC`,
      [id]
    );
    const urls = rows.map(r => {
      let rel = String(r.image_path || '').replace(/\\/g, '/');
      if (rel.startsWith('/')) rel = rel.slice(1);
      if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
      return `/files/${rel}`;
    });
    res.json(urls);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar fotos do imóvel' });
  }
}

async function setCoverPhoto(req, res) {
  const { id } = req.params;
  try {
    const body = req.body || {};
    let rel = String(body.image_path || body.filename || body.image || '').trim();
    if (!rel) return res.status(400).json({ error: 'Parâmetro image_path/filename ausente' });
    // Normaliza: remove /files/ e prefixa uploads/ se necessário
    rel = rel.replace(/^\s*https?:\/\/[^/]+/i,'');
    rel = rel.replace(/^\/files\//,'');
    rel = rel.replace(/\\/g,'/');
    if (rel.startsWith('/')) rel = rel.slice(1);
    if (!rel.startsWith('uploads/')) rel = `uploads/${rel}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE property_images SET is_cover = (image_path = ? ) WHERE property_id = ?`, [rel, id]);
      await conn.commit();
      res.json({ ok: true, cover: `/files/${rel.replace(/^uploads\//,'')}` });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'Falha ao definir capa' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao definir capa' });
  }
}

async function listUsers(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
             u.agency_id, a.name AS agency_name,
             COUNT(DISTINCT p.id) AS property_count
        FROM users u
        LEFT JOIN agencies a ON a.id = u.agency_id
        LEFT JOIN properties p ON p.user_id = u.id
       GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at, u.agency_id, a.name
       ORDER BY u.created_at DESC
       LIMIT 500
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

module.exports = { listPending, listAll, getPropertyAdmin, approveProperty, rejectProperty, updateProperty, addAnnotation, streamCertificate, listPropertyPhotos, setCoverPhoto, listUsers };
