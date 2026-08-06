const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const controller = require('../controllers/collectionController');

router.get('/',                    isAuthenticated, controller.index);
router.get('/add',                 isAuthenticated, controller.addForm);
router.post('/add',                isAuthenticated, controller.store);
router.get('/edit/:id',            isAuthenticated, controller.editForm);
router.post('/edit/:id',           isAuthenticated, controller.update);
router.get('/delete/:id',          isAuthenticated, controller.destroy);
router.post('/toggle/:id',         isAuthenticated, controller.toggleStatus);

module.exports = router;
