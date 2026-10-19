const express = require('express');
const router = express.Router();
const {
  generateTest,
  getTests,
  getTestById,
  updateTestPaper,
  regenerateQuestion,
  deleteTest,
  exportTest,
} = require('../controllers/testController');
const { authenticate } = require('../middleware/auth');

router.post('/generate', authenticate, generateTest);
router.get('/', authenticate, getTests);
router.get('/:id', authenticate, getTestById);
router.put('/:id', authenticate, updateTestPaper);
router.post('/:id/regenerate-question', authenticate, regenerateQuestion);
router.delete('/:id', authenticate, deleteTest);
router.get('/:id/export', authenticate, exportTest);

module.exports = router;
