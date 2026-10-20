const jwt = require('jsonwebtoken');
const Storage = require('../config/storage');

const JWT_SECRET = process.env.JWT_SECRET || 'testcraft_jwt_super_secret_key_change_in_production';

// A short-lived cache removes one database round-trip from every authenticated
// request while keeping role/profile changes visible within seconds.
const USER_CACHE_TTL_MS = parseInt(process.env.AUTH_USER_CACHE_TTL_MS || '30000', 10) || 30000;
const userCache = new Map();

const invalidateUser = (userId) => {
  if (userId === undefined || userId === null) return;
  userCache.delete(String(userId));
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const cacheKey = String(decoded.id);

    const cached = userCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user;
      return next();
    }

    const user = await Storage.findById('users', decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User associated with this token no longer exists.' });
    }

    // Exclude password hash
    const { password, ...safeUser } = user;

    if (userCache.size > 10000) userCache.clear();
    userCache.set(cacheKey, { user: safeUser, expiresAt: Date.now() + USER_CACHE_TTL_MS });

    req.user = safeUser;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please sign in again.'
        : 'Invalid or expired authentication token.';
    return res.status(401).json({ success: false, message });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. You lack permissions for this resource.' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorizeRoles,
  invalidateUser,
};
