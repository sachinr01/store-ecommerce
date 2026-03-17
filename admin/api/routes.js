const express = require('express');
const router  = express.Router();
const ctrl    = require('./controller');
const auth    = require('./authController');

// Debug
router.get('/health', (_req, res) => res.json({ success: true, message: 'API is running' }));

// Product listing endpoints
router.get('/products/featured',  ctrl.getFeaturedProducts);
router.get('/products/on-sale',   ctrl.getOnSaleProducts);
router.get('/products',           ctrl.getProducts);
router.get('/products/:id',       ctrl.getProduct);

// Auth endpoints
router.post('/auth/register', auth.register);
router.post('/auth/login',    auth.login);

module.exports = router;
