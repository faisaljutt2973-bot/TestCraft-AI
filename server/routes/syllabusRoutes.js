const express = require('express');
const router = express.Router();
const { getBoards, createBoard } = require('../controllers/syllabusController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.get('/boards', authenticate, getBoards);
router.post('/boards', authenticate, authorizeRoles('admin'), createBoard);

module.exports = router;
