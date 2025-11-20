const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const controller = require('../controllers/propertyController');

// Public
router.get('/', controller.listProperties);
router.get('/map', controller.listForMap);

// Protected (broker/agency)
// Nota: defina rotas mais específicas antes de parâmetros dinâmicos
router.get('/mine/list', requireAuth, controller.listMyProperties);
router.get('/meus', requireAuth, controller.listMyProperties);
router.post('/', requireAuth, controller.createProperty);
router.post('/cadastrar', requireAuth, controller.createProperty);
router.delete('/:id', requireAuth, controller.deleteProperty);
router.put('/:id', requireAuth, controller.updateProperty);
router.get('/:id/certidao', requireAuth, controller.streamCertificateOwner);

// Deve ficar por último para não capturar prefixos como "/mine"
router.get('/:id', controller.getProperty);

module.exports = router;
