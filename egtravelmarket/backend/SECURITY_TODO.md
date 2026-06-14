# Security & Production Readiness Checklist

## 🔴 CRITICAL - Must Complete Before Production

### 1. Authentication & Authorization
- [ ] **Implement JWT-based authentication** for user login/signup
- [ ] **Add admin authentication** for sensitive endpoints
- [ ] **Create middleware** for route protection (e.g., requireAuth, requireAdmin)
- [ ] **Add API key system** for admin access to:
  - GET /api/bookings (currently disabled)
  - PATCH /api/bookings/:id/status (currently disabled)
  - POST /api/flash-offers (currently disabled)
  - PATCH /api/flash-offers/:id (currently disabled)
  - DELETE /api/flash-offers/:id (currently disabled)

### 2. Input Validation & Sanitization
- [ ] **Install validation library** (Joi or Zod)
- [ ] **Validate all input fields**:
  - Email format and domain verification
  - Phone number format
  - Date ranges and formats
  - Numeric fields (min/max values)
  - String length limits
  - Required field enforcement
- [ ] **Sanitize all user inputs** to prevent XSS attacks
- [ ] **Add rate limiting** on all endpoints (express-rate-limit)

### 3. Database Security
- [ ] **Add prepared statement verification** (already using $1, $2 params - good!)
- [ ] **Implement connection pooling limits**
- [ ] **Add database backup strategy**
- [ ] **Enable SSL for database connections** in production

### 4. Error Handling
- [ ] **Remove detailed error messages** from production responses
- [ ] **Implement proper error logging** (Winston or similar)
- [ ] **Don't expose stack traces** to clients
- [ ] **Add monitoring/alerting** for errors

---

## 🟡 HIGH PRIORITY - Before Accepting Payments

### 5. Payment Integration (Stripe)
- [ ] **Use Replit Stripe integration** for secure API key management
- [ ] **Implement webhook verification** for Stripe events
- [ ] **Add payment idempotency** to prevent duplicate charges
- [ ] **Store transaction records** securely
- [ ] **Add PCI compliance measures**
- [ ] **Test in Stripe test mode** extensively

### 6. Data Protection
- [ ] **Encrypt sensitive data** at rest (credit card tokens, personal info)
- [ ] **Implement GDPR compliance** measures:
  - Data export functionality
  - Data deletion requests
  - Cookie consent tracking
  - Privacy policy enforcement
- [ ] **Add CORS restrictions** (currently open to all origins)
- [ ] **Implement HTTPS-only** in production

### 7. Admin Dashboard Security
- [ ] **Create secure admin panel** with proper authentication
- [ ] **Add role-based access control** (RBAC)
- [ ] **Implement audit logging** for admin actions
- [ ] **Add 2FA for admin accounts**

---

## 🟢 MEDIUM PRIORITY - Before Full Launch

### 8. API Security
- [ ] **Add request size limits** (body-parser limits)
- [ ] **Implement API versioning** (/api/v1/...)
- [ ] **Add request throttling** per user/IP
- [ ] **Set security headers** (Helmet.js)
- [ ] **Add CSRF protection** for state-changing operations

### 9. Testing & Validation
- [ ] **Write unit tests** for all routes
- [ ] **Add integration tests** for API flows
- [ ] **Perform security audit** before production
- [ ] **Test with production-like data volume**

### 10. Monitoring & Logging
- [ ] **Add structured logging** (JSON format)
- [ ] **Implement request logging** (Morgan)
- [ ] **Set up error tracking** (Sentry or similar)
- [ ] **Add performance monitoring**
- [ ] **Create health check dashboard**

---

## Current Security Status

### ✅ What's Good
- Using parameterized queries ($1, $2) prevents SQL injection
- CORS enabled for cross-origin requests
- Email validation in place
- Database connection pooling implemented
- Environment variables for sensitive data

### ⚠️ What's Risky (Temporarily Disabled)
- **Admin endpoints removed until authentication is added**:
  - Cannot view all bookings (GET /api/bookings)
  - Cannot update booking status (PATCH /api/bookings/:id/status)
  - Cannot manage flash offers (POST/PATCH/DELETE)
- Public endpoints are safe:
  - POST /api/bookings (customers can create bookings)
  - GET /api/bookings/customer/:email (customers can view their own bookings only)
  - GET /api/flash-offers (public read-only)
  - POST /api/contact (public contact form)

### 🔒 Temporarily Disabled Routes
These routes require admin authentication before re-enabling:

```javascript
// Disabled until authentication is implemented
// GET /api/bookings - View all bookings (admin only)
// GET /api/bookings/:id - View specific booking (admin only)
// PATCH /api/bookings/:id/status - Update booking (admin only)
// POST /api/flash-offers - Create offer (admin only)
// PATCH /api/flash-offers/:id - Update offer (admin only)
// DELETE /api/flash-offers/:id - Delete offer (admin only)
// GET /api/contact - View submissions (admin only)
```

---

## Next Steps

1. **Phase 1 (Before Payment Processing)**:
   - Implement JWT authentication
   - Add input validation library
   - Re-enable admin routes with proper auth
   - Add rate limiting

2. **Phase 2 (Stripe Integration)**:
   - Set up Replit Stripe integration
   - Implement secure payment flow
   - Add webhook handlers
   - Test thoroughly in test mode

3. **Phase 3 (Production Hardening)**:
   - Complete security audit
   - Add monitoring and logging
   - Implement GDPR compliance
   - Set up backup and recovery

---

## Recommended Libraries

```bash
npm install --save \
  jsonwebtoken \           # JWT auth
  bcrypt \                 # Password hashing
  joi \                    # Input validation
  express-rate-limit \     # Rate limiting
  helmet \                 # Security headers
  winston \                # Logging
  express-validator        # Request validation
```

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Stripe Security Guide](https://stripe.com/docs/security)
