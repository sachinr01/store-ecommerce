const express = require('express');
const router = express.Router();
const ctrl = require('./controller');
const auth = require('./authController');
const cart = require('./cartController');
const orders = require('./orderController');
const media = require('./mediaController');
const coupon = require('./couponController');
const wishlist = require('./wishlistController');
const { sessionMiddleware } = require('./session');
const { guestCookieMiddleware } = require('./guestCookie');
const { requireAdmin, requireAgentOrAdmin, requireLogin } = require('./authMiddleware');
const contact = require('./contactController');
const shiprocket = require('./shiprocketCheckoutController');

// ── In-memory rate limiter (no extra package needed) ──────────────────────────
// Tracks request counts per IP in a plain Map.
// The Map is wiped every `windowMs` to reset all counters.
// This is suitable for single-process Node servers (standard setup).
// For multi-process / clustered deployments, replace with express-rate-limit
// + a Redis store (npm i express-rate-limit rate-limit-redis).
function makeRateLimiter({ windowMs, max, message }) {
  const hits = new Map();          // ip → count
  setInterval(() => hits.clear(), windowMs).unref(); // unref so it won't block process exit

  return function rateLimiter(req, res, next) {
    // Use X-Forwarded-For if behind a reverse proxy (nginx), else req.ip
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const count = (hits.get(ip) || 0) + 1;
    hits.set(ip, count);

    if (count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

// Coupon apply: max 10 attempts per IP per 10 minutes
// Reason: stops brute-force guessing of coupon codes (e.g. NEST01, NEST02…)
const couponApplyLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max: 10,
  message: 'Too many coupon attempts. Please wait a few minutes and try again.',
});

// Login: max 10 attempts per IP per 15 minutes
// Reason: stops credential stuffing / password brute-force
const loginLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});

// Forgot password: max 5 attempts per IP per 15 minutes
// Reason: stops email enumeration and spam
const forgotPasswordLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes and try again.',
});

router.use(guestCookieMiddleware());
router.use(sessionMiddleware());

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ success: true, message: 'API is running' }));

// ── Contact Forms ─────────────────────────────────────────────────────────────
router.post('/contact', contact.submitContact);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/products/featured',      ctrl.getFeaturedProducts);
router.get('/products/on-sale',       ctrl.getOnSaleProducts);
router.get('/products/best-sellers',  ctrl.getBestSellerProducts);
router.get('/products',               ctrl.getProducts);
router.get('/products/slug/:slug',    ctrl.getProductBySlug);
router.get('/products/:id',           ctrl.getProduct);

// ── Media ─────────────────────────────────────────────────────────────────────
// NOTE: static routes before dynamic :id
router.get('/media/resolve',              media.resolveMediaIds);
router.get('/media/products',             media.getProductsWithImages);
router.get('/media/product/:productId',   media.getProductMedia);
router.get('/media/:id',                  media.getMediaById);

// ── Content (Blogs + Pages) ────────────────────────────────────────────────
router.get('/blogs',                ctrl.getBlogs);
router.get('/blogs/slug/:slug',     ctrl.getBlogBySlug);
router.get('/blog-categories',      ctrl.getBlogCategories);
router.get('/pages',            ctrl.getPages);
router.get('/pages/slug/:slug', ctrl.getPageBySlug);

// ── Attributes ────────────────────────────────────────────────────────────────
router.get('/attributes/colors',     ctrl.getColors);
router.get('/attributes/all',        ctrl.getAllAttributeGroups);
router.get('/attributes/:taxonomy',  ctrl.getAttributesByTaxonomy);

// ── Site Settings (public) ────────────────────────────────────────────────────
router.get('/site-settings', ctrl.getPublicSiteSettings);

// ── Product Categories ────────────────────────────────────────────────────────
// NOTE: static sub-routes before dynamic :slug to avoid conflicts
router.get('/product-categories',                  ctrl.getProductCategories);
router.get('/product-categories/search',           ctrl.searchProductCategories);
router.get('/product-categories/:slug/children',   ctrl.getCategoryChildren);
router.get('/product-categories/:slug/products',   ctrl.getCategoryProducts);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register', auth.register);
router.post('/auth/login',    loginLimiter, auth.login);
router.post('/auth/google',   auth.googleLogin);
router.post('/auth/logout',   auth.logout);
router.post('/auth/forgot-password', forgotPasswordLimiter, auth.requestPasswordReset);
router.post('/auth/reset-password',  auth.resetPassword);
router.get('/auth/me',        auth.me);
router.put('/auth/profile',   requireLogin, auth.updateProfile);

// ── Coupons ───────────────────────────────────────────────────────────────────
router.get('/coupon/active',   coupon.active);
router.post('/coupon/apply',   couponApplyLimiter, coupon.apply);
router.post('/coupon/remove',  coupon.remove);

// ── Cart ──────────────────────────────────────────────────────────────────────
router.get('/cart',                   cart.getCart);
router.post('/cart/add',              cart.addToCart);
router.put('/cart/update/:itemId',    cart.updateCartItem);
router.delete('/cart/remove/:itemId', cart.removeCartItem);
router.delete('/cart/clear',          cart.clearCart);

// ── Wishlist ──────────────────────────────────────────────────────────────────
router.get   ('/wishlist',                    requireLogin, wishlist.getWishlist);
router.post  ('/wishlist/add',                requireLogin, wishlist.addToWishlist);
router.delete('/wishlist/remove/:productId',  requireLogin, wishlist.removeFromWishlist);
router.post  ('/wishlist/sync',               requireLogin, wishlist.syncWishlist);

// ── Orders ────────────────────────────────────────────────────────────────────
// NOTE: /orders/my MUST come before /orders/:orderId to avoid route conflict
router.post('/orders/place',      orders.placeOrder);
router.post('/shipping-rate',     orders.getShippingRate);
router.get('/tracking/:awb',      orders.getTrackingStatus);
router.get('/orders/my',          requireLogin, orders.getMyOrders);
router.get('/orders/:orderId',    requireLogin, orders.getMyOrderById);

// ── Address Book ──────────────────────────────────────────────────────────────
// These routes only work with saved addresses (order_id IS NULL rows).
// Order addresses are always fetched via /orders/:orderId — never here.
//
// GET  /address/default           → fetch default saved address (pre-fill checkout form)
// PUT  /address/default/:addressId → set a saved address as default (from profile page)
// GET  /address/saved             → all saved addresses for address book page
router.get('/address/default',              requireLogin, orders.getDefaultAddress);
router.put('/address/default/:addressId',   requireLogin, orders.setDefaultAddress);
router.get('/address/saved',               requireLogin, orders.getSavedAddresses);
router.get('/address/recent',              requireLogin, orders.getRecentOrderAddresses);
router.get('/address/profile',             requireLogin, orders.getProfileAddresses);
router.put('/address/profile/:kind',       requireLogin, orders.updateProfileAddress);

// ── Shiprocket Catalog Sync APIs ──────────────────────────────────────────────
// Called by Shiprocket's backend to sync your product catalog.
// Currently OPEN (no auth) — Shiprocket fetches these by URL directly.
//
// To enable HMAC verification later (X-Api-Key + X-Api-HMAC-SHA256 headers):
//   1. Set SHIPROCKET_CATALOG_API_KEY and SHIPROCKET_CATALOG_API_SECRET in .env
//   2. Uncomment `shiprocketAuth` below and add it as middleware to each route,
//      e.g. router.get('/shiprocket/products', shiprocketAuth, shiprocket.fetchProducts);
//
// const crypto = require('crypto');
// function shiprocketAuth(req, res, next) {
//   const apiKey = req.headers['x-api-key'];
//   const hmac   = req.headers['x-api-hmac-sha256'];
//   if (!apiKey || apiKey !== process.env.SHIPROCKET_CATALOG_API_KEY) {
//     return res.status(401).json({ success: false, message: 'Invalid API key' });
//   }
//   const expected = crypto
//     .createHmac('sha256', process.env.SHIPROCKET_CATALOG_API_SECRET)
//     .update(JSON.stringify(req.body || ''))
//     .digest('base64');
//   if (hmac !== expected) {
//     return res.status(401).json({ success: false, message: 'Invalid HMAC signature' });
//   }
//   next();
// }
//
// Share these URLs with Shiprocket during onboarding:
//   GET /api/shiprocket/products                         → Fetch Products
//   GET /api/shiprocket/products/by-collection           → Fetch Products By Collection
//   GET /api/shiprocket/collections                      → Fetch Collections

router.get('/shiprocket/products', shiprocket.fetchProducts);

router.get(
  '/shiprocket/products/by-collection',
  shiprocket.fetchProductsByCollection
);

router.get(
  '/shiprocket/collections',
  shiprocket.fetchCollections
);

router.get(
  "/shiprocket/token",
  shiprocket.getCheckoutToken
);

// ── Shiprocket Catalog Sync Webhooks (real-time push) ─────────────────────────
// Call these whenever a product or collection is created/updated on the site,
// to push the change to Shiprocket immediately instead of waiting for their
// next full catalog fetch.
//
// In production, wire these into your product/category save handlers:
//   const { sendProductUpdateWebhook } = require('./shiprocketWebhooks');
//   await sendProductUpdateWebhook(productId);
//
// These admin routes let you trigger them manually (for testing, or for an
// "Sync to Shiprocket" button in the admin panel).
router.post(
  '/admin/shiprocket/webhook/product/:productId',
  requireAdmin,
  shiprocket.triggerProductWebhook
);

router.post(
  '/admin/shiprocket/webhook/collection/:categoryId',
  requireAdmin,
  shiprocket.triggerCollectionWebhook
);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/orders',                     requireAdmin,        orders.getAllOrders);
router.put('/admin/orders/:orderId/status',     requireAdmin,        orders.updateOrderStatus);
router.get('/agent/orders',                     requireAgentOrAdmin, orders.getAllOrders);

module.exports = router;