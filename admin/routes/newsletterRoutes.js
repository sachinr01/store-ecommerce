const express = require("express");
const router  = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const newsletterController    = require("../controllers/newsletterController");

router.get('/newsletter-subscribers', isAuthenticated, newsletterController.index);
router.delete('/newsletter-subscribers/:id', isAuthenticated, newsletterController.deleteSubscriber);

module.exports = router;