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
const newsletter = require('./newsletterController');
const shiprocket = require('./shiprocketCheckoutController');
const { receiveOrderWebhook } = require('./shiprocketorderwebhook');
const catalogSync = require('./shiprocketcatalogsync');

// ── In-memory rate limiter ─────────────────────────────────────────────────────
function makeRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();

  return function rateLimiter(req, res, next) {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const count = (hits.get(ip) || 0) + 1;
    hits.set(ip, count);
    if (count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

const couponApplyLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many coupon attempts. Please wait a few minutes and try again.',
});

const loginLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});

const forgotPasswordLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes and try again.',
});

// Token endpoint: max 30 requests per IP per 10 minutes
const tokenLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many checkout attempts. Please wait a few minutes and try again.',
});

router.use(guestCookieMiddleware());
router.use(sessionMiddleware());

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ success: true, message: 'API is running' }));

// ── Contact Forms ─────────────────────────────────────────────────────────────
router.post('/contact', contact.submitContact);
router.post('/newsletter/subscribe', newsletter.subscribeNewsletter);
router.get('/newsletter/verify/:token', newsletter.verifyNewsletter);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/products/featured',      ctrl.getFeaturedProducts);
router.get('/products/on-sale',       ctrl.getOnSaleProducts);
router.get('/products/best-sellers',  ctrl.getBestSellerProducts);
router.get('/products',               ctrl.getProducts);
router.get('/products/slug/:slug',    ctrl.getProductBySlug);
router.get('/products/:id',           ctrl.getProduct);

// ── Media ─────────────────────────────────────────────────────────────────────
router.get('/media/resolve',              media.resolveMediaIds);
router.get('/media/products',             media.getProductsWithImages);
router.get('/media/product/:productId',   media.getProductMedia);
router.get('/media/:id',                  media.getMediaById);

// ── Content (Blogs + Pages) ───────────────────────────────────────────────────
router.get('/blogs',                ctrl.getBlogs);
router.get('/blogs/slug/:slug',     ctrl.getBlogBySlug);
router.get('/blog-categories',      ctrl.getBlogCategories);
router.get('/pages',                ctrl.getPages);
router.get('/pages/slug/:slug',     ctrl.getPageBySlug);

// ── Attributes ────────────────────────────────────────────────────────────────
router.get('/attributes/colors',     ctrl.getColors);
router.get('/attributes/all',        ctrl.getAllAttributeGroups);
router.get('/attributes/:taxonomy',  ctrl.getAttributesByTaxonomy);

// ── Site Settings (public) ────────────────────────────────────────────────────
router.get('/site-settings', ctrl.getPublicSiteSettings);

// ── Product Categories ────────────────────────────────────────────────────────
router.get('/product-categories',                  ctrl.getProductCategories);
router.get('/product-categories/search',           ctrl.searchProductCategories);
router.get('/product-categories/:slug/children',   ctrl.getCategoryChildren);
router.get('/product-categories/:slug/products',   ctrl.getCategoryProducts);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register',        auth.register);
router.post('/auth/login',           loginLimiter, auth.login);
router.post('/auth/google',          auth.googleLogin);
router.post('/auth/logout',          auth.logout);
router.post('/auth/forgot-password', forgotPasswordLimiter, auth.requestPasswordReset);
router.post('/auth/reset-password',  auth.resetPassword);
router.get ('/auth/me',              auth.me);
router.put ('/auth/profile',         requireLogin, auth.updateProfile);

// ── Coupons ───────────────────────────────────────────────────────────────────
router.get ('/coupon/active',  coupon.active);
router.post('/coupon/apply',   couponApplyLimiter, coupon.apply);
router.post('/coupon/remove',  coupon.remove);

// ── Cart ──────────────────────────────────────────────────────────────────────
router.get   ('/cart',                    cart.getCart);
router.post  ('/cart/add',                cart.addToCart);
router.put   ('/cart/update/:itemId',     cart.updateCartItem);
router.delete('/cart/remove/:itemId',     cart.removeCartItem);
router.delete('/cart/clear',              cart.clearCart);

// ── Wishlist ──────────────────────────────────────────────────────────────────
router.get   ('/wishlist',                   requireLogin, wishlist.getWishlist);
router.post  ('/wishlist/add',               requireLogin, wishlist.addToWishlist);
router.delete('/wishlist/remove/:productId', requireLogin, wishlist.removeFromWishlist);
router.post  ('/wishlist/sync',              requireLogin, wishlist.syncWishlist);

// ── Orders ────────────────────────────────────────────────────────────────────
router.post('/orders/place',        orders.placeOrder);
router.post('/orders/track',        orders.trackOrderByPhone);   // public – no login needed
router.post('/orders/track-by-id',  orders.trackOrderById);      // public – order ID only
router.post('/shipping-rate',       orders.getShippingRate);
router.get ('/tracking/:awb',       orders.getTrackingStatus);
router.get ('/orders/my',           requireLogin, orders.getMyOrders);
router.get ('/orders/:orderId',     requireLogin, orders.getMyOrderById);

// ── Address Book ──────────────────────────────────────────────────────────────
router.get('/address/default',            requireLogin, orders.getDefaultAddress);
router.put('/address/default/:addressId', requireLogin, orders.setDefaultAddress);
router.get('/address/saved',              requireLogin, orders.getSavedAddresses);
router.get('/address/recent',             requireLogin, orders.getRecentOrderAddresses);
router.get('/address/profile',            requireLogin, orders.getProfileAddresses);
router.put('/address/profile/:kind',      requireLogin, orders.updateProfileAddress);

// ── Shiprocket Catalog Sync APIs ──────────────────────────────────────────────
router.get('/shiprocket/products',               shiprocket.fetchProducts);
router.get('/shiprocket/products/by-collection', shiprocket.fetchProductsByCollection);
router.get('/shiprocket/collections',            shiprocket.fetchCollections);

// ── Shiprocket Checkout Token ─────────────────────────────────────────────────
router.post('/shiprocket/token', tokenLimiter, shiprocket.getCheckoutToken);

// ── Shiprocket Complete Checkout (polled by cart page after iframe opens) ─────
router.post('/shiprocket/complete-checkout', shiprocket.completeCheckoutFromShiprocket);

// ── Shiprocket Register Redirect ID ──────────────────────────────────────────
router.post('/shiprocket/register-redirect', shiprocket.registerRedirectOrderId);

// ── Shiprocket Finalize Context (utility — links checkout_ref to sr_order_id) ─
router.post('/shiprocket/finalize-checkout', shiprocket.finalizeCheckoutContext);

// ── Shiprocket Order Webhook ──────────────────────────────────────────────────
router.post('/shiprocket/order-webhook', receiveOrderWebhook);

// ── Shiprocket Admin Catalog Sync Webhooks ────────────────────────────────────
// Manually push a product or collection update to Shiprocket.
// Can also be wired into your admin save handlers automatically.
router.post(
  '/admin/shiprocket/webhook/product/:productId',
  requireAdmin,
  shiprocket.triggerProductWebhook,
);
router.post(
  '/admin/shiprocket/webhook/collection/:categoryId',
  requireAdmin,
  shiprocket.triggerCollectionWebhook,
);

// ── Shiprocket Catalog Auto-Sync ───────────────────────────────────────────────
// FIX (2026-06-25): Shiprocket caches your product catalog and only refreshes
// it when the Product Update webhook fires. Nothing was calling that webhook
// automatically, so price edits (e.g. ₹899 → ₹799) never reached Shiprocket
// and the checkout kept charging the old price.
//
// 1) startCatalogSync() below runs a background watcher that polls for price/
//    stock changes every 2 minutes and auto-pushes the webhook — works no
//    matter which tool edited the price.
// 2) This route gives your (separate) admin app an INSTANT option: call it
//    right after saving a product and the new price reaches Shiprocket
//    immediately instead of waiting for the next poll tick.
router.post(
  '/admin/shiprocket/sync-now/:productId',
  requireAdmin,
  async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }
    const result = await catalogSync.triggerCatalogSyncNow(productId);
    if (!result.success) {
      return res.status(502).json({ success: false, message: 'Sync failed', error: result.error });
    }
    return res.json({ success: true, shiprocket_response: result.data });
  },
);

// Start the background price/stock watcher as soon as routes are loaded.
catalogSync.startCatalogSync();

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/orders',                  requireAdmin,        orders.getAllOrders);
router.put('/admin/orders/:orderId/status',  requireAdmin,        orders.updateOrderStatus);
router.get('/agent/orders',                  requireAgentOrAdmin, orders.getAllOrders);

module.exports = router;