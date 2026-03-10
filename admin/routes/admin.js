const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { showDashboard } = require('../controllers/dashboardController');

router.get('/dashboard', isAuthenticated, showDashboard);

module.exports = router;