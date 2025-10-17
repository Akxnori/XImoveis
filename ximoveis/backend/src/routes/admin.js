const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const controller = require('../controllers/adminController');

// Admin-only routes
router.use(requireAuth, requireRole('ADMIN'));

router.get('/properties/pending', controller.listPending);
router.get('/properties', controller.listAll);
router.get('/properties/:id', controller.getPropertyAdmin);
router.post('/properties/:id/approve', controller.approveProperty);
router.post('/properties/:id/reject', controller.rejectProperty);
router.put('/properties/:id', controller.updateProperty);

module.exports = router;
