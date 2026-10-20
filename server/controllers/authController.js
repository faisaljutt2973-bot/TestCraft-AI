const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Storage = require('../config/storage');
const { sendMail, getClientUrl } = require('../services/emailService');
const { invalidateUser } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'testcraft_jwt_super_secret_key_change_in_production';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;
  return safeUser;
};

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const register = async (req, res) => {
  try {
    const { name, email, password, school, subjectSpecialties } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, and password.' });
    }

    const normalizedName = String(name).trim().replace(/\s+/g, ' ').slice(0, 100);
    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedSchool = typeof school === 'string' ? school.trim().replace(/\s+/g, ' ').slice(0, 120) : '';

    if (!normalizedName) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (!normalizedSchool) {
      return res.status(400).json({ success: false, message: 'Please enter your school or institution name.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existingUser = await Storage.findOne('users', { email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await Storage.create('users', {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'teacher',
      school: normalizedSchool,
      subjectSpecialties: Array.isArray(subjectSpecialties) ? subjectSpecialties : ['General Science'],
      phone: '',
      bio: '',
      avatar: '',
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await Storage.findOne('users', { email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await Storage.findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, school, subjectSpecialties, email, phone, bio, avatar, currentPassword, newPassword } =
      req.body;

    const user = await Storage.findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {};

    if (name !== undefined) {
      const normalizedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      }
      updates.name = normalizedName.slice(0, 100);
    }

    if (school !== undefined) {
      const normalizedSchool = typeof school === 'string' ? school.trim().replace(/\s+/g, ' ') : '';
      if (!normalizedSchool) {
        return res.status(400).json({ success: false, message: 'School or institution name cannot be empty.' });
      }
      if (normalizedSchool.length > 120) {
        return res.status(400).json({ success: false, message: 'School name must be 120 characters or fewer.' });
      }
      updates.school = normalizedSchool;
    }

    if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim().slice(0, 30) : '';
    if (bio !== undefined) updates.bio = typeof bio === 'string' ? bio.trim().slice(0, 500) : '';

    if (subjectSpecialties !== undefined) {
      updates.subjectSpecialties = Array.isArray(subjectSpecialties)
        ? subjectSpecialties.map((s) => String(s).trim()).filter(Boolean)
        : String(subjectSpecialties)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    if (avatar !== undefined) {
      if (avatar && avatar.length > 4 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Profile photo is too large. Please use an image under 3 MB.' });
      }
      updates.avatar = avatar || '';
    }

    if (email !== undefined) {
      const normalized = String(email).toLowerCase().trim();
      if (!EMAIL_PATTERN.test(normalized)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      if (normalized !== user.email) {
        const existing = await Storage.findOne('users', { email: normalized });
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ success: false, message: 'Another account already uses this email address.' });
        }
        updates.email = normalized;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Enter your current password to set a new password.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
      }
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, message: 'No changes to save.', user: sanitizeUser(user) });
    }

    const updated = await Storage.update('users', req.user.id, updates);
    invalidateUser(req.user.id);
    res.json({ success: true, message: 'Profile updated successfully.', user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Please enter the email address for your account.' });
    }

    const user = await Storage.findOne('users', { email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await Storage.update('users', user.id, {
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpires: Date.now() + 60 * 60 * 1000,
    });

    const resetUrl = `${getClientUrl()}/?resetToken=${encodeURIComponent(token)}`;
    const safeName = escapeHtml(user.name);
    const result = await sendMail({
      to: user.email,
      subject: 'Reset your TestCraft AI password',
      text: `Hello ${user.name},\n\nA password reset was requested for your TestCraft AI account.\n\nReset your password here: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
      html: `<p>Hello ${safeName},</p><p>A password reset was requested for your TestCraft AI account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
    });

    const payload = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    if (result.sent) {
      payload.delivery = 'email';
      payload.message = 'Password reset link sent to your email address.';
    } else if (process.env.NODE_ENV !== 'production') {
      payload.delivery = 'manual';
      payload.resetToken = token;
      payload.resetUrl = resetUrl;
      payload.message = 'Email delivery is not configured. Use the reset link below (development mode).';
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await Storage.findOne('users', { resetPasswordToken: hashResetToken(String(token)) });
    if (!user || !user.resetPasswordExpires || Number(user.resetPasswordExpires) < Date.now()) {
      return res.status(400).json({ success: false, message: 'This password reset link is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await Storage.update('users', user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });
    invalidateUser(user.id);

    res.json({ success: true, message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await Storage.find('users');
    const tests = await Storage.find('testPapers');
    const books = await Storage.find('books');

    const usersWithStats = users.map((u) => ({
      ...sanitizeUser(u),
      testsCreatedCount: tests.filter((t) => t.createdBy === u.id).length,
      booksUploadedCount: books.filter((b) => b.createdBy === u.id).length,
    }));

    res.json({ success: true, count: usersWithStats.length, users: usersWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role, school } = req.body;
    const targetId = req.params.id;

    const user = await Storage.findById('users', targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {};
    if (role && (role === 'admin' || role === 'teacher')) {
      updates.role = role;
    }
    if (school) {
      updates.school = school.trim();
    }

    if (user.role === 'admin' && updates.role === 'teacher') {
      const admins = await Storage.find('users', { role: 'admin' });
      if (admins.length <= 1) {
        return res.status(400).json({
          success: false,
          message: 'At least one administrator account must remain. Promote another user first.',
        });
      }
    }

    const updated = await Storage.update('users', targetId, updates);
    invalidateUser(targetId);
    res.json({ success: true, message: `User updated to role ${updated.role}.`, user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own administrative account.' });
    }

    const user = await Storage.findById('users', targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await Storage.delete('users', targetId);
    invalidateUser(targetId);
    res.json({ success: true, message: `Account for ${user.name} has been removed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, role = 'teacher', school, subjectSpecialties } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const normalizedName = String(name).trim().replace(/\s+/g, ' ').slice(0, 100);
    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedSchool = typeof school === 'string' ? school.trim().replace(/\s+/g, ' ').slice(0, 120) : '';

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existingUser = await Storage.findOne('users', { email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await Storage.create('users', {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'teacher',
      school: normalizedSchool || 'General Secondary School',
      subjectSpecialties: Array.isArray(subjectSpecialties) ? subjectSpecialties : ['General Science'],
      phone: '',
      bio: '',
      avatar: '',
    });

    res.status(201).json({ success: true, message: 'User account created successfully.', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};
