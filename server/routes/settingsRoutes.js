const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, getStats } = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getSettings);
router.put('/', authenticate, updateSettings);
router.get('/stats', authenticate, getStats);

module.exports = router;
