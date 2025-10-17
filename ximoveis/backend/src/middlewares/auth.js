const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Acesso negado' });
    next();
  };
}

module.exports = { requireAuth, requireRole };

