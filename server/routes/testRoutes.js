const express = require('express');
const rateLimit = require('express-rate-limit');
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

// AI generation is the most expensive endpoint: cap it per user (not per proxy IP).
const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.GENERATION_RATE_LIMIT || 40),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.id || 'anonymous'}`,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'You have generated many papers recently. Please wait a few minutes and try again.',
  },
});

router.post('/generate', authenticate, generationLimiter, generateTest);
router.get('/', authenticate, getTests);
router.get('/:id', authenticate, getTestById);
router.put('/:id', authenticate, updateTestPaper);
router.post('/:id/regenerate-question', authenticate, regenerateQuestion);
router.delete('/:id', authenticate, deleteTest);
router.get('/:id/export', authenticate, exportTest);

module.exports = router;
