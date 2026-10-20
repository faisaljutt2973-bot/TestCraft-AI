require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const seedDefaultData = require('./config/seedData');
const { authenticate } = require('./middleware/auth');
const { isConfigured: isEmailConfigured } = require('./services/emailService');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const syllabusRoutes = require('./routes/syllabusRoutes');
const questionRoutes = require('./routes/questionRoutes');
const testRoutes = require('./routes/testRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const plannerRoutes = require('./routes/plannerRoutes');
const supportRoutes = require('./routes/supportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Render/Netlify sit in front of the app. Without this, express-rate-limit keys
// every user behind the proxy to the same IP and can throttle unrelated users.
app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : Number(process.env.TRUST_PROXY_HOPS || 1));

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Restrict cross-origin access to explicitly allowed frontends
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check must stay cheap and exempt from API throttling (uptime pingers).
app.get('/api/health', (req, res) => {
  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  const dbConnected = require('mongoose').connection.readyState === 1;
  res.json({
    status: mongoConfigured && !dbConnected ? 'degraded' : 'healthy',
    platform: 'TestCraft AI',
    version: '1.0.1',
    database: mongoConfigured ? (dbConnected ? 'connected' : 'disconnected') : 'local-file',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Rate limiting: broad API cap plus stricter auth limits
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);

// Static uploads directory (authenticated users only)
app.use('/uploads', authenticate, express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/plans', plannerRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/settings', settingsRoutes);

// Serve the built React client for single-origin / production deployments
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDist, 'index.html'));

if (hasClientBuild) {
  // Hashed Vite assets are immutable; index.html must always be revalidated.
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (/(index\.html|robots\.txt|sitemap\.xml)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // SPA fallback: serve index.html for any non-API, non-upload GET request
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 404 Handler for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint or resource not found.' });
});

// Global Error Handler (registered last so it catches all preceding middleware)
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Surface production misconfiguration early instead of failing silently.
const warnProductionConfig = () => {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change_in_production')) {
    console.warn('[Config] WARNING: JWT_SECRET is missing or still the default placeholder. Set a strong secret before going live.');
  }
  if (!isEmailConfigured()) {
    console.warn('[Config] WARNING: SMTP is not configured. Password reset emails will NOT be delivered in production.');
  }
  if (!process.env.CORS_ORIGINS && !process.env.CLIENT_URL) {
    console.warn('[Config] WARNING: Neither CORS_ORIGINS nor CLIENT_URL is set. Browser requests will be rejected by CORS.');
  }
  if (!hasClientBuild) {
    console.warn('[Config] WARNING: client/dist not found. Run "npm run build" in /client so the server can serve the app.');
  }
};

// Initialize Database & Seed Sample Data before accepting requests
(async () => {
  await connectDB();
  await seedDefaultData();

  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`   TestCraft AI Server running on http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/api/health`);
    if (hasClientBuild) {
      console.log(`   Serving client build from ${clientDist}`);
    } else {
      console.log(`   Client build not found - run the Vite dev server separately.`);
    }
    console.log(`=======================================================`);
    warnProductionConfig();
  });

  // Keep connections warm behind Render's proxy and allow slow AI generations.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 180000;
})().catch((err) => {
  console.error('[Startup Error]', err);
  process.exit(1);
});

module.exports = app;
