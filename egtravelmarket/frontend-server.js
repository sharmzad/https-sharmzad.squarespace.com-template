const express = require('express');
const path = require('path');
const { Readable } = require('stream');
const compression = require('compression');

const app = express();

// ============================================================
// PERFORMANCE: Enable gzip compression for all responses
// Reduces transfer size by 70-90% for text-based content
// ============================================================
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
const PORT = process.env.PORT || 5000;
const BACKEND_PORT = process.env.BACKEND_PORT || 3000;

// ============================================================
// PRIORITY 1: Health check endpoint - BEFORE ANYTHING ELSE
// Respond IMMEDIATELY for deployment health checks (< 100ms)
// No file I/O, no dependencies, no delays
// ============================================================
app.get('/health', (req, res) => {
  res.status(200).end('OK');
});

// ============================================================
// PRIORITY 2: Domain redirect middleware - BEFORE LOGGING
// Redirect egtravelmarket.com → www.egtravelmarket.com (301)
// This ensures www is PRIMARY domain and fixes static asset loading
// ============================================================
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  
  if (host.match(/^egtravelmarket\.com$/i)) {
    const redirectUrl = `${protocol}://www.${host}${req.originalUrl}`;
    console.log(`🔄 301 Redirect: ${protocol}://${host}${req.path} → ${redirectUrl}`);
    return res.redirect(301, redirectUrl);
  }
  
  next();
});

// ============================================================
// BOT-FRIENDLY MIDDLEWARE: Log user-agents for debugging
// ============================================================
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || 'unknown';
  console.log(`🤖 [${new Date().toISOString()}] ${req.method} ${req.path} | User-Agent: ${ua.substring(0, 100)}`);
  next();
});

// ============================================================
// ROOT endpoint - Fast health check for deployment, normal page for users
// ============================================================
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('HealthChecker') || ua.includes('kube-probe') || req.headers['x-health-check']) {
    return res.status(200).end('OK');
  }
  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).sendFile(path.join(__dirname, 'index.html'), { maxAge: '1h' });
});

// Determine backend URL
let BACKEND_URL;
if (process.env.REPLIT_ENVIRONMENT === 'production') {
  BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
  console.log(`🔧 Production mode: Using backend URL ${BACKEND_URL}`);
} else {
  BACKEND_URL = process.env.BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;
  console.log(`🔧 Development mode: Using backend URL ${BACKEND_URL}`);
}

// Helper function to retry fetch with exponential backoff (production-optimized)
async function fetchWithRetry(url, options, maxRetries = 8) {
  let lastError;
  const timeout = options.method === 'POST' ? 20000 : 15000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = Math.min(500 * Math.pow(2, i), 5000);
        console.log(`⏳ Backend retry ${i + 1}/${maxRetries - 1} after ${delay}ms... (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Sanitize responses - remove debug output
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'string' && data.includes('</html>')) {
      data = data
        .replace(/\{"mode":"full","isActive":\s*true,"isUserDisabled":\s*false\}Test/g, '')
        .replace(/{"mode":"full","isActive":true,"isUserDisabled":false}Test/g, '')
        .replace(/\n\s*$/, '');
    }
    return originalSend.call(this, data);
  };
  next();
});

// Add CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================
// IMPORTANT: Routes MUST come BEFORE static middleware
// Email verification and password reset pages need explicit routes
// to properly handle query parameters
// ============================================================
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify-email.html'));
});

app.get('/verify-email.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify-email.html'));
});

// ============================================================
// Uploads proxy - Forward /uploads/* requests to backend
// OPTIMIZED: Uses streaming instead of buffering for better performance
// ============================================================
app.use('/uploads', async (req, res) => {
  try {
    const url = `${BACKEND_URL}/uploads${req.url}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(404).send('File not found');
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    res.type(contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream response instead of buffering for better memory and latency
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(`❌ Uploads proxy error: ${error.message}`);
    res.status(500).send('Error fetching file');
  }
});

// ============================================================
// Cloud Storage proxy - Forward /objects/* requests to backend
// Serves files stored in persistent cloud storage
// ============================================================
app.use('/objects', async (req, res) => {
  try {
    const url = `${BACKEND_URL}/objects${req.url}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(404).send('File not found');
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    res.type(contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(`❌ Cloud storage proxy error: ${error.message}`);
    res.status(500).send('Error fetching file');
  }
});

// ============================================================
// API proxy routes - Handle multipart uploads specially
// ============================================================
const http = require('http');

app.use('/api', async (req, res) => {
  try {
    const url = `${BACKEND_URL}/api${req.url}`;
    const contentType = req.headers['content-type'] || '';
    
    // Handle multipart form data (file uploads) - pipe raw request to backend
    if (contentType.includes('multipart/form-data')) {
      console.log(`📤 Proxy ${req.method} ${url} | Multipart upload`);
      
      const backendUrl = new URL(url);
      const proxyReq = http.request({
        hostname: backendUrl.hostname,
        port: backendUrl.port || BACKEND_PORT,
        path: backendUrl.pathname + backendUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${BACKEND_PORT}`
        }
      }, (proxyRes) => {
        console.log(`✅ Response ${proxyRes.statusCode} from ${url}`);
        res.status(proxyRes.statusCode);
        res.set(proxyRes.headers);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        proxyRes.pipe(res);
      });
      
      proxyReq.on('error', (error) => {
        console.error(`❌ Proxy upload error: ${error.message}`);
        res.status(500).json({ error: 'Upload proxy error', message: error.message });
      });
      
      req.pipe(proxyReq);
      return;
    }
    
    // Handle regular JSON requests
    const headers = {};
    
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const isAuthLogin = url.includes('/api/auth/login');
    const options = {
      method: req.method,
      headers,
    };
    
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(req.body || {});
    }
    
    console.log(`📤 Proxy ${req.method} ${url} | Body: ${JSON.stringify(req.body || {})}`);
    const response = await fetchWithRetry(url, options, isAuthLogin ? 3 : 5);
    const respContentType = response.headers.get('content-type') || 'application/json';
    const data = await response.text();
    
    console.log(`✅ Response ${response.status} from ${url}`);
    res.status(response.status);
    res.type(respContentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(data);
  } catch (error) {
    console.error(`❌ API Proxy Error on ${req.method} /api${req.url}`);
    console.error(`   Backend URL: ${BACKEND_URL}`);
    console.error(`   Error Code: ${error.code}`);
    console.error(`   Error Message: ${error.message}`);
    console.error(`   Error Stack: ${error.stack}`);
    res.status(500).json({ error: 'Proxy Error', message: error.message, code: error.code, details: 'Check server logs' });
  }
});

// ============================================================
// Explicit OG image route - HIGHEST PRIORITY
// Ensures crawlers ALWAYS get the image (200 OK)
// ============================================================
app.get('/static/images/og-image.jpg', (req, res) => {
  console.log(`✅ Serving OG image to crawler: ${req.headers['user-agent']?.substring(0, 80) || 'unknown'}`);
  res.status(200)
    .setHeader('Content-Type', 'image/jpeg')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Cache-Control', 'public, max-age=3600')
    .sendFile(path.join(__dirname, 'static/images/og-image.jpg'));
});

// ============================================================
// Static files middleware with optimized caching
// In production: cache CSS/JS for 1 hour with revalidation
// ============================================================
const isProduction = process.env.REPLIT_ENVIRONMENT === 'production';

app.use(express.static(__dirname, {
  maxAge: 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml')) {
      res.setHeader('Content-Type', filePath.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath.match(/\.(jpg|jpeg|png|webp|gif|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (filePath.match(/\.(css|js)$/)) {
      // Production: cache for 1 hour, Development: no cache
      if (isProduction) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    } else if (filePath.match(/\.(woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
}));

// ============================================================
// TRIP DETAIL ROUTE: /trip/:slug or /trip/:id
// Handles individual trip detail pages
// ============================================================
app.get('/trip/:slugOrId', (req, res) => {
  res.sendFile(path.join(__dirname, 'trip-detail.html'));
});

// ============================================================
// CRITICAL: Expert/Agency/Dive Center profile routes
// ⚠️ DO NOT DELETE OR MODIFY THESE ROUTES ⚠️
// These routes handle public profile pages and MUST be present
// for the site to function correctly. If removed, users will
// see white/404 pages when clicking on profiles.
// ============================================================
app.get('/:expertType/:slug', (req, res) => {
  const { expertType, slug } = req.params;
  // Allow expert types and reject only obvious file extensions (not slugs with periods)
  const isFileExtension = /\.(html|css|js|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|pdf)$/i.test(slug);
  if (['guide', 'diver', 'mentor'].includes(expertType) && !isFileExtension) {
    res.sendFile(path.join(__dirname, 'expert-profile.html'));
  } else if (expertType === 'agency' && !isFileExtension) {
    res.sendFile(path.join(__dirname, 'agency-profile.html'));
  } else if (expertType === 'dive-center' && !isFileExtension) {
    res.sendFile(path.join(__dirname, 'dive-center-profile.html'));
  } else {
    res.status(404).send('Page not found');
  }
});

// ============================================================
// Catch-all 404 - Return proper 404 for all other routes
// ============================================================
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).type('text/plain').send('404 Not Found');
});

// Start frontend immediately on correct port
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 EgyTravelMarket Frontend running on port ${PORT}`);
  console.log(`📱 Open: http://localhost:${PORT}`);
  console.log(`🎨 Smart caching enabled`);
});

module.exports = app;
