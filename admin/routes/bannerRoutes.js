const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bannerController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/appearance/banners', isAuthenticated, ctrl.index);
router.get('/appearance/banners/add', isAuthenticated, ctrl.addForm);
router.post('/appearance/banners/add', isAuthenticated, ctrl.store);
router.get('/appearance/banners/edit/:id', isAuthenticated, ctrl.editForm);
router.post('/appearance/banners/edit/:id', isAuthenticated, ctrl.update);
router.get('/appearance/banners/delete/:id', isAuthenticated, ctrl.destroy);
router.post('/appearance/banners/toggle/:id', isAuthenticated, ctrl.toggleStatus);
router.post('/appearance/banners/reorder', isAuthenticated, ctrl.reorder);

module.exports = router;
