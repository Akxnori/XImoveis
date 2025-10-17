const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

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
    'maintenance_fee','iptu','address','neighborhood','city','state','purpose','type','lat','lng'
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

module.exports = { listPending, listAll, getPropertyAdmin, approveProperty, rejectProperty, updateProperty };
