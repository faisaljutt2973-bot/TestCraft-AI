const express = require('express');
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

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

// Admin-only user management routes
router.get('/users', authenticate, authorizeRoles('admin'), getAllUsers);
router.post('/users', authenticate, authorizeRoles('admin'), createUserByAdmin);
router.put('/users/:id/role', authenticate, authorizeRoles('admin'), updateUserRole);
router.delete('/users/:id', authenticate, authorizeRoles('admin'), deleteUser);

module.exports = router;
