const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const controller = require('../controllers/adminController');

// Admin-only routes
router.use(requireAuth, requireRole('ADMIN'));

// Existing endpoints
router.get('/properties/pending', controller.listPending);
router.get('/properties', controller.listAll);
router.get('/properties/:id', controller.getPropertyAdmin);
router.get('/properties/:id/photos', controller.listPropertyPhotos);
router.post('/properties/:id/cover', controller.setCoverPhoto);
router.post('/properties/:id/approve', controller.approveProperty);
router.post('/properties/:id/reject', controller.rejectProperty);
router.put('/properties/:id', controller.updateProperty);
router.get('/users', controller.listUsers);

// Portuguese aliases requested
router.get('/imoveis-pendentes', controller.listPending);
router.get('/imovel/:id', controller.getPropertyAdmin);
router.put('/aprovar/:id', controller.approveProperty);
router.put('/rejeitar/:id', controller.rejectProperty);
router.post('/anotacao/:id', controller.addAnnotation);
router.post('/capa/:id', controller.setCoverPhoto);
router.get('/certidao/:id', controller.streamCertificate);

module.exports = router;
