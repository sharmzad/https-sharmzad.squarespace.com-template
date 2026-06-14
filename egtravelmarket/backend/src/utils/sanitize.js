const xss = require('xss');

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return xss(input.trim(), xssOptions);
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return null;
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : null;
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    if (trimmed.startsWith('/') && !trimmed.includes('..')) {
      return trimmed;
    }
    return null;
  }
}

function sanitizePhone(phone) {
  if (typeof phone !== 'string') return null;
  return phone.replace(/[^0-9+\-\s()]/g, '').trim();
}

function createSanitizeMiddleware() {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    next();
  };
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  createSanitizeMiddleware
};
