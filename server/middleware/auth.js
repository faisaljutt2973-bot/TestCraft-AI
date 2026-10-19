const jwt = require('jsonwebtoken');
const Storage = require('../config/storage');

const JWT_SECRET = process.env.JWT_SECRET || 'testcraft_jwt_super_secret_key_change_in_production';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await Storage.findById('users', decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User associated with this token no longer exists.' });
    }

    // Exclude password hash
    const { password, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
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
};
