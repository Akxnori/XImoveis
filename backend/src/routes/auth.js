const express = require('express');
const router = express.Router();
const { login, register, seedAdmin } = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
// Portuguese aliases
router.post('/usuarios/cadastrar', register);
router.post('/usuarios/login', login);

// Opcional: desative depois de usar
router.post('/seed-admin', seedAdmin);

module.exports = router;
