# EG Travel Market — Developer Onboarding Summary
### For: Alaa | Last updated: June 2026

---

## 1. Platform Architecture (One Page)

```
Browser
  │
  ▼
Cloudflare Edge  (SSL, DDoS, caches static files)
  │
  ▼
Frontend Server — port 5000  (node frontend-server.js)
  │   Serves: all HTML/CSS/JS files directly
  │   Proxies: /api/* → Backend :3000
  │            /uploads/* → Backend :3000
  │            /objects/* → Backend :3000 (cloud storage)
  ▼
Backend Server — port 3000  (cd backend && node src/server.js)
  │   Express.js API, JWT auth, Stripe, email, file uploads
  ▼
Neon PostgreSQL  (cloud, serverless)
  │
  ├── Replit Object Storage (GCS) — all uploaded images/documents
  ├── ZeptoMail (Zoho) — all transactional emails
  └── Stripe — all payments
```

**Key rule:** Users never hit port 3000 directly. Everything goes through the frontend proxy on port 5000. The backend has no public URL.

**Stack:**
- Frontend: Plain HTML + CSS + Vanilla JS (no React, no Vue, no build step)
- Backend: Node.js + Express.js
- DB: PostgreSQL via `pg` connection pool
- Auth: JWT (7-day expiry) stored in localStorage

---

## 2. Main Frontend Files

| File | What It Does |
|---|---|
| `frontend-server.js` | ★ Entry point — static file server + API reverse proxy |
| `js/api-client.js` | Global API helper, stores JWT in localStorage |
| `js/expert-signup.js` | Guide/diver/mentor signup flow |
| `js/agency-signup.js` | Agency/dive center signup flow |
| `js/stripe-payment-helper.js` | Stripe.js loader for booking pages |
| `js/meta-pixel-events.js` | Meta Pixel tracking |
| `styles.css` | Global stylesheet |
| `header.html` / `header.min.js` | Shared site header (included via fetch on each page) |
| `app.min.js` | Bundled global JS |

**Key HTML Pages:**
| Page | User | Purpose |
|---|---|---|
| `index.html` | Public | Homepage |
| `admin-comprehensive.html` | Admin | ★ Main admin panel (use this one, not admin-dashboard.html) |
| `expert-trips-marketplace.html` | Travelers | Browse expert trips |
| `travel-request.html` | Travelers | Post a custom trip request |
| `travel-requests-browse.html` | Providers | Browse & bid on traveler requests |
| `travel-request-view.html` | Travelers | View bids on their request (code+PIN) |
| `guide-dashboard.html` / `expert-dashboard-enhanced.html` | Guides | Dashboard (ask owner which is live) |
| `agency-dashboard.html` / `travel-agency-dashboard.html` | Agencies | Dashboard (ask owner which is live) |
| `divecenter-dashboard.html` / `dive-center-dashboard.html` | Dive Centers | Dashboard (ask owner which is live) |
| `booking-success.html` | Travelers | Post-payment success page |
| `verify-email.html` | All | Email verification (token from URL) |
| `reset-password.html` | All | Password reset (token from URL) |

> **Warning:** Multiple dashboard versions exist for the same user types. Always ask the owner which one is actively used before editing.

---

## 3. Main Backend Files

```
backend/
├── src/server.js              ★ App entry point, middleware, routes mounting
├── src/middleware/auth.js     ★ verifyToken + requireAdmin (used by all protected routes)
├── src/config/database.js    ★ PostgreSQL pool, startup warmup, auto-indexes
├── src/utils/zeptomail.js    ★ ALL emails go through here (ZeptoMail API)
├── src/utils/cloudStorage.js ★ ALL file uploads go through here (Replit GCS)
├── src/utils/emailBranding.js  HTML email templates
├── src/utils/email.js          Traveler request email functions
├── src/utils/expert-trips-email.js  Expert trip booking email functions
├── src/config/email.js         Standard booking + admin alert emails
│
└── src/routes/
    ├── auth.js                ★ signup, login, verify-email, forgot/reset-password
    ├── admin.js               ★ approve/reject users, bookings, analytics
    ├── adminEnhanced.js         Extended admin: agencies, dive centers, mentors
    ├── expert-trips.js        ★ Expert marketplace: browse, create, book trips
    ├── expert-trips-payments.js ★ Stripe Payment Intent for expert trips (escrow)
    ├── expert-trips-admin.js    Admin: approve/reject trips
    ├── payments.js            ★ Stripe Checkout + shared webhook handler
    ├── agency-request-payments.js  Stripe Checkout for agency offer payments
    ├── experts.js               Expert profile CRUD + public listing
    ├── agencies.js              Agency profile CRUD + public listing
    ├── dive-centers.js          Dive center CRUD + public listing
    ├── travelRequests.js      ★ Traveler requests + bidding (guest_requests)
    ├── bookings.js              Standard tour bookings
    ├── file-upload.js         ★ Multer + cloud storage for all uploads
    ├── jobs.js                  Jobs board
    └── flashOffers.js           Homepage deals
```

---

## 4. Main Database Tables

| Table | Purpose | Key Status Fields |
|---|---|---|
| `users` | ★ Every account (all types + admin) | `is_active`, `approval_status`, `email_verified` |
| `expert_profiles` | Guides, divers, mentors — profiles + documents | `is_verified`, `is_active` |
| `agency_profiles` | Travel agency profiles + documents | `approval_status` |
| `dive_center_profiles` | Dive center profiles + documents | `approval_status` |
| `expert_trips` | Trips created by experts/agencies | `status`: draft → pending_approval → approved |
| `expert_trip_bookings` | Bookings on expert trips | `booking_status`, `payment_status` |
| `expert_trip_payments` | Escrow: 20% platform, 80% expert | `status`: escrow → released |
| `expert_payouts` | Expert payout tracking | `status`: pending → paid |
| `guest_requests` | Traveler custom requests | `status`: open/closed, `approval_status` |
| `guest_request_bids` | Provider bids on requests | `status`: pending / accepted / rejected |
| `traveler_request_orders` | Payments for accepted bids | `payment_status`: pending → paid |
| `bookings` | Standard tour/package bookings | `status`, `payment_status` |
| `jobs` | Agency job postings | `status` |
| `flash_offers` | Homepage promotional deals | `is_active`, `deadline` |
| `action_logs` | Admin audit trail | — |

**Schema source of truth:** `backend/src/models/schema.ts` (Drizzle ORM)

---

## 5. Main API Endpoints

### Auth
```
POST /api/auth/signup              Register any user type
POST /api/auth/login               Login, returns JWT + profile data
POST /api/auth/verify-email        Confirm email from link
POST /api/auth/forgot-password     Send password reset email
POST /api/auth/reset-password      Save new password, returns userType for redirect
GET  /api/auth/me                  Get current user (requires JWT)
```

### Admin (all require JWT + admin user type)
```
GET  /api/admin/pending-signups            All pending professional users
GET  /api/admin/sign-ups/verified-pending  Verified, awaiting approval
POST /api/admin/approve-signup/:userId     Approve + send email
POST /api/admin/reject-signup/:userId      Reject + send email
GET  /api/admin/analytics                  Platform stats
GET  /api/admin/expert-trips/pending-trips Trips awaiting approval
POST /api/admin/expert-trips/:id/approve   Approve a trip
GET  /api/admin/bookings                   All platform bookings
GET  /api/admin/logs                       Audit trail
```

### Expert Trips
```
GET  /api/expert-trips              Browse approved trips (public)
POST /api/expert-trips/create       Create trip (requires login)
PUT  /api/expert-trips/:id          Edit trip
POST /api/expert-trips/:id/submit-approval  Submit for admin review
POST /api/expert-trips/:id/book     Book a trip (creates Stripe session)
```

### Payments
```
POST /api/payments/create-checkout-session      Standard booking payment
POST /api/payments/webhook                      Stripe webhook (all general payments)
POST /api/expert-trips-payments/create-payment-intent   Expert trip payment
POST /api/expert-trips-payments/confirm-payment         Confirm after Stripe redirect
POST /api/expert-trips-payments/webhook                 Stripe webhook (expert trips)
POST /api/agency-request-payments/:offerId/pay  Pay for accepted agency bid
```

### Requests & Bids
```
POST /api/travel-requests            Submit traveler request
GET  /api/travel-requests            Browse open requests (providers)
POST /api/travel-requests/:id/bids   Provider sends a bid
PUT  /api/travel-requests/bids/:id/status  Accept or reject a bid
```

### Uploads
```
POST /api/upload/upload-signup-photo   Photo/document during signup (no auth needed)
POST /api/upload/upload-trip-image     Trip image (requires auth, 800px min)
POST /api/upload/upload-photo          General photo upload (requires auth)
GET  /objects/uploads/:filename        Serve file from cloud storage
```

---

## 6. How Login / Admin Works

### Login Flow
1. User submits email + password on their login page (e.g., `guide-login.html`)
2. Frontend calls `POST /api/auth/login`
3. Backend: checks `is_active`, verifies password with bcrypt, generates JWT (7-day)
4. Frontend: saves `authToken` and `currentUser` to `localStorage`
5. Redirect to role-specific dashboard

### Admin Login
- Same endpoint: `POST /api/auth/login`
- If `user_type === 'admin'` in DB → redirects to `admin-comprehensive.html`
- Protected routes check: `verifyToken` (JWT valid) → then `requireAdmin` (userType=admin)

### Key Points
- JWT stored in `localStorage` (not a cookie)
- Every API call must include `Authorization: Bearer <token>` header
- `is_active = false` → 403 error (admin blocks a user, they cannot log in)
- `approval_status = rejected` → 403 error

### Admin Approval Workflow
```
User signs up → email_verified=false, approval_status=pending
  ↓
User clicks verification email → email_verified=true
  ↓
Admin sees in "Verified & Pending" tab of admin-comprehensive.html
  ↓
Admin clicks Approve → approval_status=approved, certification_status=certified → email sent
         OR
Admin clicks Reject → rejection_reason stored → email sent
```

---

## 7. How Experts / Agencies Work

### Signup Requirements
| User Type | Extra Documents Required |
|---|---|
| Guide | Ministry license (front+back), Syndicate license (front+back), expiry dates |
| Diver | Certification document; if insured: insurance doc + expiry |
| Mentor | Role agreement confirmation |
| Agency (Egypt) | Tourism license number + document |
| Agency (International) | Foreign agency confirmation |
| Dive Center (Egypt) | License authority, number, expiry, front+back photos |
| Dive Center (International) | Foreign registration ID |

### After Approval
- Profile appears in public listings (`/api/experts`, `/api/agencies`, `/api/dive-centers`)
- Visibility condition: `approval_status='approved'` AND `is_active=true`
- Expert profile URL: `/expert-profile.html?slug=their-slug`

### Expert Creates and Publishes a Trip
```
Expert logs in → expert-dashboard-enhanced.html
  → POST /api/expert-trips/create (status=draft)
  → Edit content, upload image (min 800px wide)
  → POST /api/expert-trips/:id/submit-approval (status=pending_approval)
  → Admin approves → status=approved
  → Trip appears on expert-trips-marketplace.html
```

---

## 8. How Traveler Requests and Offers Work

```
1. Traveler fills form on travel-request.html
   → POST /api/travel-requests
   → DB: guest_requests (status=pending, approval_status=pending)
   → Traveler receives email with unique CODE + PIN

2. Admin reviews in admin panel
   → PUT /api/travel-requests/admin/:id/approval
   → status=open, approval_status=approved
   → Traveler gets approval email

3. Providers browse on travel-requests-browse.html
   → GET /api/travel-requests (requires login)
   → POST /api/travel-requests/:id/bids (one bid per provider)

4. Traveler views bids using CODE + PIN (no login needed)
   → travel-request-view.html → GET /api/travel-requests/:code?pin=...
   → Traveler clicks Accept: PUT /api/travel-requests/bids/:id/status (accepted)

5. Payment
   → POST /api/agency-request-payments/:offerId/pay
   → Stripe Checkout session created
   → Stripe webhook confirms: traveler_request_orders.payment_status = paid
   → Emails: traveler confirmation + agency notification + admin notification

6. Payout (manual)
   → Admin releases funds to agency through admin panel after trip
```

---

## 9. How Stripe and Emails Work

### Stripe — 3 Separate Flows

| Flow | Creates | Webhook Endpoint |
|---|---|---|
| Standard bookings | `checkout.sessions.create` | `POST /api/payments/webhook` |
| Expert trips | `paymentIntents.create` | `POST /api/expert-trips-payments/webhook` |
| Agency bids | `checkout.sessions.create` with metadata | `POST /api/payments/webhook` (type=agency_traveler_request) |

**Expert trip payments are held in escrow** — 20% platform fee, 80% to expert. Admin releases manually after trip completion. No automation.

**Double payment prevention:** Backend checks `payment_status='paid'` before creating a new Stripe session.

**Webhook security:** `STRIPE_WEBHOOK_SECRET` must be set in production or signature validation is skipped.

---

### Emails — ZeptoMail

All emails go through `backend/src/utils/zeptomail.js` → POST to `https://api.zeptomail.com/v1.1/email`

**Credential:** `ZEPTOMAIL_API_KEY` environment variable.

**Non-blocking pattern (used everywhere):**
```javascript
sendEmail(...).catch(err => console.error('Email failed:', err.message));
// The endpoint continues even if email fails
```

**Only blocking:** `POST /api/auth/forgot-password` — if email fails, returns 503 to user (intentional).

**If ALL emails suddenly stop working:** Check ZeptoMail billing. Error code `LE_102` = credits exhausted. Fix: top up at zeptomail.com.

**What triggers emails:**
- Signup → verification email to user + alert to admin
- Approval/rejection → notification to user
- Password reset → reset link to user
- Travel request → confirmation to traveler + admin alert
- Booking confirmed → traveler + expert/agency + admin
- Payment success/failure → admin

---

## 10. Top 10 Risks

| # | Risk | Severity | Fix |
|---|---|---|---|
| 1 | `JWT_SECRET` is a placeholder in `backend/.env` | 🔴 CRITICAL | Change immediately to a strong 64-char random string |
| 2 | All emails fail when ZeptoMail credits run out | 🔴 CRITICAL | Set billing alert in ZeptoMail dashboard |
| 3 | "Delete User" is permanent — no recovery | 🔴 CRITICAL | Never use without confirming backup exists |
| 4 | Expert payout is 100% manual — no reminders | 🟡 HIGH | Experts won't be paid unless admin remembers |
| 5 | Duplicate dashboard files (which is live?) | 🟡 HIGH | Confirm with owner before editing any dashboard |
| 6 | `admin-comprehensive.html` is 5,866 lines of inline JS | 🟡 HIGH | One typo breaks the entire admin panel |
| 7 | `STRIPE_WEBHOOK_SECRET` missing = no webhook validation | 🟡 HIGH | Must be set in production Replit secrets |
| 8 | If cloud upload fails, fallback is local — disappears on redeploy | 🟡 HIGH | Monitor cloud storage logs after uploads |
| 9 | `authToken` in localStorage — XSS-vulnerable | 🟠 MEDIUM | Accept for now, plan HttpOnly cookie migration |
| 10 | `API_BASE_URL` hardcoded to `https://www.egtravelmarket.com` in `js/api-client.js` | 🟠 MEDIUM | Must change to `http://localhost:5000` for local dev |

---

## 11. First 10 Tasks for Alaa

| # | Task | Why |
|---|---|---|
| 1 | **Change `JWT_SECRET`** in `backend/.env` and in Replit Secrets to a real random 64-char string | Security — placeholder is dangerous |
| 2 | **Ask the owner which dashboard files are live** for each user type | You'll waste time editing the wrong file |
| 3 | **Set up ZeptoMail billing alert** in the ZeptoMail dashboard | Prevents silent email outages |
| 4 | **Export a full database backup** (PostgreSQL dump from Neon) | Before touching any schema |
| 5 | **Read `backend/src/server.js` lines 1–100** | Understand middleware stack and route mounting order |
| 6 | **Read `backend/src/middleware/auth.js`** entirely | Every protected route depends on this |
| 7 | **Set `STRIPE_WEBHOOK_SECRET`** in Replit Secrets if not already set | Payment webhooks are unvalidated without it |
| 8 | **Run the full testing checklist** (Section 13 below) against production **before** any code change | Know what's already broken vs. what you broke |
| 9 | **Create a `.env.example` file** listing all env var names with blank values | Future developers will thank you |
| 10 | **Delete or clearly label** `akram-workspace.html`, `amr-workspace.html`, `heba-workspace.html`, and `*-BACKUP.html`, `*-OLD.html` files | Confusing cruft in the root directory |

---

## 12. Files You Must Not Edit Before Backup / Testing

### 🔴 Never Edit Without Full Testing Plan

| File | What Breaks If You Mess Up |
|---|---|
| `frontend-server.js` | **Entire site goes down** — it's the only entry point |
| `backend/src/server.js` | Middleware order, CORS, rate limiters — site down |
| `backend/src/middleware/auth.js` | **All protected API routes stop working** |
| `backend/src/config/database.js` | **All database operations fail** |
| `backend/.env` | Production credentials — handle with care |
| `backend/src/routes/payments.js` | Stripe webhook logic — broken = unconfirmed payments |
| `backend/src/routes/auth.js` | Login, signup, password reset broken |
| `admin-comprehensive.html` | 5,866 lines — one JS error breaks the entire admin UI |

### Before Editing Any Route File
1. Understand what endpoints the file contains
2. Identify all frontend pages that call those endpoints
3. Test those pages after the edit
4. Check the browser console for errors

### Before Changing Any DB Schema
1. Export a full Neon database dump first
2. Test the migration on a copy of the DB before running on production
3. Check all API endpoints that query the changed table

---

## 13. Full Testing Checklist After Any Change

Run through this checklist manually after making any significant change.

### Public Access
- [ ] `index.html` loads without errors
- [ ] Flash offers appear on homepage
- [ ] Expert listing page loads (`/experts.html`)
- [ ] Expert profile page opens via slug URL
- [ ] Agency listing loads with filters working
- [ ] Dive center listing loads with filters working
- [ ] Expert trips marketplace loads and shows trips
- [ ] Contact form submits without error

### Authentication
- [ ] Guide login works → lands on guide dashboard
- [ ] Agency login works → lands on agency dashboard
- [ ] Admin login works → lands on `admin-comprehensive.html`
- [ ] Wrong password shows clear error (not crash)
- [ ] Blocked account (`is_active=false`) shows error, cannot log in
- [ ] Guide signup completes, verification email received
- [ ] Email verification link opens and confirms successfully
- [ ] Forgot password email received within 2 minutes
- [ ] Reset link in email opens `reset-password.html` correctly
- [ ] New password saves and user can log in
- [ ] After reset, correct login page opens (guide → guide-login, agency → agency-login)

### Admin Dashboard
- [ ] Admin can log in
- [ ] "Sign Up Approval" tab loads (unverified users)
- [ ] "Verified & Pending" tab loads
- [ ] Admin approves a user → user receives approval email
- [ ] Admin rejects with a reason → user receives rejection email
- [ ] Expert trips pending tab loads
- [ ] Admin approves a trip → trip appears on marketplace
- [ ] Analytics tab loads without crash
- [ ] Logs tab shows recent actions

### Expert Trip Flow
- [ ] Expert can create a new trip from dashboard
- [ ] Expert can upload a trip image (must be min 800px wide)
- [ ] Expert submits trip for approval
- [ ] Admin approves trip — it appears on marketplace
- [ ] Traveler can book the trip
- [ ] Stripe payment page opens (test mode)
- [ ] Test payment completes (Stripe test card: 4242 4242 4242 4242)
- [ ] Booking confirmation email received by traveler
- [ ] Expert receives booking notification
- [ ] Admin receives booking notification
- [ ] Expert payout record created with 80% amount

### Traveler Request Flow
- [ ] Travel request form submits successfully
- [ ] Traveler receives confirmation email with CODE + PIN
- [ ] Admin sees request in dashboard
- [ ] Admin approves → traveler receives approval email
- [ ] Logged-in provider can see and bid on the request
- [ ] Traveler opens request using CODE + PIN
- [ ] Traveler can accept a bid
- [ ] Payment page opens
- [ ] Test payment completes
- [ ] Traveler + agency receive payment confirmation emails

### File Uploads
- [ ] Profile photo upload during signup works
- [ ] Document (license) upload during signup works
- [ ] Trip image upload works (check 800px minimum is enforced)
- [ ] Uploaded images appear correctly on profile pages
- [ ] Images load from `/objects/uploads/` path (cloud storage, not local)

### Mobile Responsiveness
- [ ] Homepage layout looks correct on mobile
- [ ] Expert listing is scrollable and usable on mobile
- [ ] Login forms work on mobile keyboard
- [ ] Dashboard navigation works on mobile

### Performance
- [ ] Expert listing page loads in under 3 seconds
- [ ] Admin "Verified & Pending" tab loads in under 5 seconds
- [ ] No browser console errors on homepage or dashboards

---

*End of Alaa's Onboarding Summary*
*No files were modified to produce this document.*
