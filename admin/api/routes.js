const express = require('express');
const router = express.Router();
const ctrl = require('./controller');
const auth = require('./authController');
const cart = require('./cartController');
const orders = require('./orderController');
const { sessionMiddleware } = require('./session');
const { guestCookieMiddleware } = require('./guestCookie');
const { requireAdmin, requireAgentOrAdmin, requireLogin } = require('./authMiddleware');

router.use(guestCookieMiddleware());
router.use(sessionMiddleware());

// Debug
router.get('/health', (_req, res) => res.json({ success: true, message: 'API is running' }));

// Product listing endpoints
router.get('/products/featured',      ctrl.getFeaturedProducts);
router.get('/products/on-sale',       ctrl.getOnSaleProducts);
router.get('/products',               ctrl.getProducts);
router.get('/products/slug/:slug',    ctrl.getProductBySlug);
router.get('/products/:id',           ctrl.getProduct);

// Attribute endpoints
router.get('/attributes/colors',  ctrl.getColors);
router.get('/attributes/all',     ctrl.getAllAttributeGroups);
router.get('/attributes/:taxonomy', ctrl.getAttributesByTaxonomy);

// Auth endpoints
router.post('/auth/register', auth.register);
router.post('/auth/login',    auth.login);
router.post('/auth/logout',   auth.logout);
router.get('/auth/me',        auth.me);

// Cart endpoints
router.get('/cart',                cart.getCart);
router.post('/cart/add',           cart.addToCart);
router.put('/cart/update/:itemId', cart.updateCartItem);
router.delete('/cart/remove/:itemId', cart.removeCartItem);
router.delete('/cart/clear',       cart.clearCart);

// Order endpoints
router.post('/orders/place',       orders.placeOrder);
router.get('/orders/my',           requireLogin, orders.getMyOrders);
router.get('/orders/:orderId',     requireLogin, orders.getMyOrderById);

// Admin/Agent endpoints
router.get('/admin/orders',        requireAdmin, orders.getAllOrders);
router.put('/admin/orders/:orderId/status', requireAdmin, orders.updateOrderStatus);
router.get('/agent/orders',        requireAgentOrAdmin, orders.getAllOrders);

module.exports = router;
