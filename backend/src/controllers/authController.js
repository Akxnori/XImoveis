const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const [rows] = await pool.query('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '8h' });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao efetuar login' });
  }
}

// Semear admin (opcional)
async function seedAdmin(req, res) {
  const email = 'admin@ximoveis.local';
  const password = '123456';
  const name = 'Administrador';
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.json({ ok: true, message: 'Admin já existe' });
    const hash = await bcrypt.hash(password, 10);
    let agencyId = null;
    const [agRows] = await pool.query('SELECT id FROM agencies LIMIT 1');
    if (agRows.length) agencyId = agRows[0].id; else {
      const [resAg] = await pool.query('INSERT INTO agencies (name, email, phone) VALUES (?, ?, ?)', ['Agência X', 'contato@agenciax.local', '(00) 0000-0000']);
      agencyId = resAg.insertId;
    }
    const [ins] = await pool.query('INSERT INTO users (agency_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)', [agencyId, name, email, '(00) 0000-0000', hash, 'ADMIN']);
    return res.json({ ok: true, id: ins.insertId, email });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao criar admin' });
  }
}

// Cadastro BROKER/AGENCY com telefone obrigatório
async function register(req, res) {
  const { name, email, password, role, agencyName, cpf, creci, cnpj, creciJuridico, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  const userRole = role && ['BROKER', 'AGENCY'].includes(role) ? role : 'BROKER';
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email já cadastrado' });

    let agencyId = null;
    if (userRole === 'AGENCY') {
      if (!cnpj || !creciJuridico || !phone) return res.status(400).json({ error: 'CNPJ, Creci Jurídico e telefone são obrigatórios para Imobiliária' });
      const [insAg] = await pool.query('INSERT INTO agencies (name, email, phone, cnpj, creci_juridico) VALUES (?, ?, ?, ?, ?)', [agencyName || name, email, phone, cnpj, creciJuridico]);
      agencyId = insAg.insertId;
    } else {
      if (!cpf || !creci || !phone) return res.status(400).json({ error: 'CPF, Creci e telefone são obrigatórios para Corretor' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [ins] = await pool.query('INSERT INTO users (agency_id, name, email, phone, password_hash, role, cpf, creci) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [agencyId, name, email, phone || null, hash, userRole, userRole === 'BROKER' ? cpf : null, userRole === 'BROKER' ? creci : null]);
    const token = jwt.sign({ sub: ins.insertId, role: userRole }, process.env.JWT_SECRET || 'dev', { expiresIn: '8h' });
    res.status(201).json({ token, user: { id: ins.insertId, name, email, role: userRole } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
}

module.exports = { login, register, seedAdmin };

