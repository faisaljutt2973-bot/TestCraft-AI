const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  getAllUsers,
  updateUserRole,
  deleteUser,
  createUserByAdmin,
} = require('../controllers/authController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const authLimiter = (limit, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase().trim()}`,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait a few minutes before trying again.',
    },
  });

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REGISTER_RATE_LIMIT || 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many accounts created from this network. Please try again later.',
  },
});

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter(Number(process.env.LOGIN_RATE_LIMIT || 50)), login);
router.post('/forgot-password', authLimiter(Number(process.env.FORGOT_RATE_LIMIT || 10)), forgotPassword);
router.post('/reset-password', authLimiter(Number(process.env.RESET_RATE_LIMIT || 20)), resetPassword);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

// Admin-only user management routes
router.get('/users', authenticate, authorizeRoles('admin'), getAllUsers);
router.post('/users', authenticate, authorizeRoles('admin'), createUserByAdmin);
router.put('/users/:id/role', authenticate, authorizeRoles('admin'), updateUserRole);
router.delete('/users/:id', authenticate, authorizeRoles('admin'), deleteUser);

module.exports = router;
