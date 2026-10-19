const express = require('express');
const router = express.Router();
const { getQuestions, createQuestion, updateQuestion, deleteQuestion } = require('../controllers/questionController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getQuestions);
router.post('/', authenticate, createQuestion);
router.put('/:id', authenticate, updateQuestion);
router.delete('/:id', authenticate, deleteQuestion);

module.exports = router;
