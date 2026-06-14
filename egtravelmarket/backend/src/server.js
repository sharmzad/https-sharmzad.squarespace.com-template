const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// ============================================================
// Trust Proxy - CRITICAL for production behind Replit proxy
// Enables correct client IP detection and secure cookie handling
// ============================================================
app.set('trust proxy', 1);

// ============================================================
// FIRST: Health check endpoints - BEFORE ANY OTHER CODE
// Respond immediately with plain text for deployment health checks
// ============================================================
app.get('/', (req, res) => res.status(200).send('OK'));
app.get('/health', (req, res) => res.status(200).send('healthy'));

// ============================================================
// SIMPLE /api/health ENDPOINT - Required by monitors and Cloudflare
// Returns JSON with server, database, and environment status
// ============================================================
const pool = require('./config/database');
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  let dbError = null;
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }
  const ok = dbStatus === 'connected';
  res.status(ok ? 200 : 503).json({
    ok,
    server: 'running',
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString(),
    ...(dbError && { dbError })
  });
});

// ============================================================
// COMPREHENSIVE SYSTEM HEALTH CHECK - Tests all critical services
// Use this to verify the entire system is working correctly
// ============================================================
app.get('/api/system-health', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    database: { status: 'unknown', latency: 0 },
    server: { status: 'healthy', uptime: process.uptime() },
    memory: { used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB' },
    timestamp: new Date().toISOString()
  };
  
  try {
    const dbStart = Date.now();
    const dbResult = await pool.query('SELECT 1 as test, NOW() as time');
    checks.database = { 
      status: dbResult.rows[0]?.test === 1 ? 'healthy' : 'error',
      latency: Date.now() - dbStart + 'ms'
    };
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
  }
  
  const allHealthy = checks.database.status === 'healthy' && checks.server.status === 'healthy';
  checks.overall = allHealthy ? 'healthy' : 'degraded';
  checks.totalLatency = Date.now() - startTime + 'ms';
  
  res.status(allHealthy ? 200 : 503).json(checks);
});

// ============================================================
// Security Headers (Helmet)
// ============================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ============================================================
// Rate Limiting - Protect against brute force attacks
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests', message: 'Please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Use CF-Connecting-IP (real client IP set by Cloudflare) so all rate
// limiters track individual users, not the shared Cloudflare edge IP.
const getRealIp = (req) => {
  const ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    '0.0.0.0';
  return ipKeyGenerator(ip);
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: getRealIp,
  message: { error: 'Too many login attempts', message: 'Please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getRealIp,
  message: { error: 'Rate limit exceeded', message: 'Please try again in an hour' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/admin-form-login', authLimiter);
app.use('/api/auth/forgot-password', strictLimiter);
app.use('/api/auth/reset-password', strictLimiter);

// ============================================================
// CORS middleware - Exact domain matching for security
// ============================================================
const ALLOWED_ORIGINS = [
  'https://www.egtravelmarket.com',
  'https://egtravelmarket.com',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000'
];

// Add Replit dev domains dynamically (exact match pattern)
const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Replit dev/preview domains (exact pattern match)
  if (/^https:\/\/[a-z0-9-]+\.replit\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.repl\.co$/.test(origin)) return true;
  return false;
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Stripe Webhook handlers - MUST be before body parser (needs raw body)
const { webhookHandler } = require('./routes/payments');
// Primary webhook route for Stripe Dashboard configuration
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhookHandler);
// Alternative webhook route (for backwards compatibility)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// Serve uploaded files as static
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// Cloud Storage file serving - serve files stored in Object Storage
// Handles /objects/* paths for cloud-persisted uploads
// ============================================================
const { streamCloudFile, isCloudPath } = require('./utils/cloudStorage');
app.use('/objects', async (req, res) => {
  const objectPath = '/objects' + req.url;
  try {
    const streamed = await streamCloudFile(objectPath, res);
    if (!streamed) {
      res.status(404).send('File not found');
    }
  } catch (error) {
    console.error('Cloud file serving error:', error.message);
    res.status(500).send('Error serving file');
  }
});

// ============================================================
// File upload routes - MUST BE BEFORE body parser for multipart/form-data
// ============================================================
app.use('/api', require('./routes/file-upload'));

// Apply body parser AFTER file upload routes to avoid interfering with multipart/form-data
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// XSS Sanitization middleware
const { createSanitizeMiddleware } = require('./utils/sanitize');
app.use(createSanitizeMiddleware());

// ============================================================
// Performance Logging Middleware - Track response times
// Target: < 500ms for all public endpoints
// ============================================================
app.use((req, res, next) => {
  const startTime = Date.now();
  const isPublicRoute = req.method === 'GET' && (
    req.path.includes('/list') || 
    req.path.includes('/profile') ||
    req.path.match(/^\/api\/(experts|agencies|dive-centers)\/[a-z0-9-]+$/)
  );
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (isPublicRoute) {
      const status = duration > 500 ? '⚠️ SLOW' : '✓';
      console.log(`${status} ${req.method} ${req.path} - ${duration}ms (target <500ms)`);
    }
  });
  
  next();
});

// ============================================================
// API Routes
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/flash-offers', require('./routes/flashOffers'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/experts', require('./routes/experts'));
app.use('/api/agencies', require('./routes/agencies'));
app.use('/api/dive-centers', require('./routes/dive-centers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/whatsapp', require('./routes/whatsappTracking'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/adminEnhanced'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/expert-trips', require('./routes/expert-trips'));
app.use('/api/admin/expert-trips', require('./routes/expert-trips-admin'));
app.use('/api/expert-trips/payments', require('./routes/expert-trips-payments'));
app.use('/api/expert-payouts', require('./routes/expert-bank-payouts'));
app.use('/api/travel-requests', require('./routes/travelRequests'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/guide-requests', require('./routes/guide-requests'));
app.use('/api/agency-requests', require('./routes/agency-requests'));
app.use('/api/dive-center-requests', require('./routes/dive-center-requests'));
app.use('/api/agency-traveler-request', require('./routes/agency-request-payments'));
app.use('/api/trip-finder', require('./routes/tripFinderLeads'));

// ============================================================
// PRODUCTION ERROR LOGGING MIDDLEWARE
// Logs every 4xx/5xx with full context: route, method, status,
// error message, stack trace, and timestamp (Cairo timezone).
// ============================================================
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const ts = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
  const isDbError = err.code && (
    err.code.startsWith('2') || err.code.startsWith('4') ||
    err.message?.includes('connect') || err.message?.includes('timeout') ||
    err.message?.includes('ECONNRESET') || err.message?.includes('pool')
  );

  console.error([
    `\n🚨 [${ts}] PRODUCTION ERROR`,
    `   Route:   ${req.method} ${req.originalUrl}`,
    `   Status:  ${status}`,
    `   Error:   ${err.message}`,
    isDbError ? `   DB Code: ${err.code}` : null,
    `   Stack:   ${(err.stack || '').split('\n').slice(0, 4).join('\n             ')}`,
  ].filter(Boolean).join('\n'));

  res.status(status).json({
    error: status >= 500 ? 'Something went wrong!' : err.message,
    message: err.message
  });
});

app.use((req, res) => {
  console.warn(`⚠️  [${new Date().toISOString()}] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.path} not found` 
  });
});

// ============================================================
// Price migration - keeps trip prices correct on every startup
// ============================================================
async function runPriceMigration() {
  try {
    await pool.query(`
      UPDATE trips SET
        adult_price = CASE id
          WHEN 16 THEN 290
          WHEN 1  THEN 375
          WHEN 15 THEN 355
          WHEN 9  THEN 390
          WHEN 10 THEN 135
          WHEN 11 THEN 75
          WHEN 12 THEN 295
          WHEN 4  THEN 290
          WHEN 5  THEN 270
          WHEN 3  THEN 50
          ELSE adult_price
        END,
        child_price = CASE id
          WHEN 16 THEN 275
          WHEN 1  THEN 355
          WHEN 15 THEN 345
          WHEN 9  THEN 350
          WHEN 10 THEN 90
          WHEN 11 THEN 55
          WHEN 12 THEN 280
          WHEN 4  THEN 275
          WHEN 5  THEN 260
          WHEN 3  THEN 10
          ELSE child_price
        END
      WHERE id IN (16, 1, 15, 9, 10, 11, 12, 4, 5, 3)
    `);
    console.log('✅ Price migration complete: all trip prices updated');
  } catch (err) {
    console.error('⚠️ Price migration failed (non-critical):', err.message);
  }
}

// ============================================================
// Start server with graceful shutdown
// ============================================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 egtravelmarket Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  runPriceMigration();
});

const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
