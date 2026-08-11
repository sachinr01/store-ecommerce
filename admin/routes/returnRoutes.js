const express = require("express");
const router  = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  showReturns,
  showReturn,
  updateReturnStatus,
} = require("../controllers/returnController");

// ── Return Management ─────────────────────────────────────────────────────────
router.get("/returns",                isAuthenticated, showReturns);
router.get("/returns/:id",            isAuthenticated, showReturn);
router.post("/returns/:id/status",    isAuthenticated, updateReturnStatus);

module.exports = router;
