# EG Travel Market — Technical Handover Document
> For a new developer taking over development and maintenance.
> Last updated: June 2026

---

## 1. Executive Technical Summary

### What This Platform Does
EG Travel Market (`www.egtravelmarket.com`) is a **travel marketplace platform** connecting travelers with Egyptian and international travel professionals. The platform supports:
- **Expert Marketplace** — Guides, Divers, and Mentors create and sell trips
- **Agency & Dive Center Marketplace** — Companies list services and receive traveler requests
- **Traveler Request System** — Travelers post custom trip needs; providers bid; traveler picks and pays
- **Admin Control Panel** — Full approval, moderation, analytics, and payout management

### Technologies Used
| Layer | Technology |
|---|---|
| Frontend | Plain HTML5 + CSS3 + Vanilla JavaScript (no framework) |
| Backend | Node.js + Express.js |
| Database | PostgreSQL (Neon serverless) via `pg` pool |
| Payments | Stripe (Checkout Sessions + Payment Intents + Webhooks) |
| Email | ZeptoMail (Zoho) via REST API |
| File Storage | Replit Object Storage (Google Cloud Storage compatible) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend Proxy | Express.js reverse proxy (frontend-server.js) |
| Analytics | Meta Pixel (ID: 1217512659898780) |
| CDN/Edge | Cloudflare (SSL, DDoS, caching) |

### Architecture: Separated Frontend + Backend
The project is **NOT monolithic**. It runs as two separate Node.js processes:

```
User Browser
    │
    ▼
Cloudflare Edge (www.egtravelmarket.com)
    │
    ▼
Frontend Server (port 5000)  ─── serves HTML/CSS/JS files
    │                             proxies /api/* → Backend
    ▼
Backend Server (port 3000)   ─── all API logic, DB access, Stripe, email
    │
    ▼
Neon PostgreSQL (cloud)
```

- **frontend-server.js** — serves all static HTML pages AND proxies all `/api/*`, `/uploads/*`, `/objects/*` requests to the backend
- **backend/src/server.js** — Express API server, never exposed directly to users

---

## 2. Project Structure Map

```
/ (project root)
├── frontend-server.js          ★ CRITICAL — frontend proxy + static server
├── package.json                ★ CRITICAL — workspace scripts and deps
├── start.sh / start-all.sh     ★ CRITICAL — production startup scripts
├── build.sh                    — build script (no build step, echo only)
├── TECHNICAL_HANDOVER.md       — this document
│
├── *.html (112 pages)          ★ CRITICAL — all frontend pages
├── styles.css                  ★ CRITICAL — global stylesheet
├── app.min.js / app.js         ★ CRITICAL — global JS bundle
├── header.html / header.css / header.min.js — shared header component
│
├── js/                         ★ CRITICAL — frontend JS modules
│   ├── api-client.js           — global API helper, stores JWT in localStorage
│   ├── expert-signup.js        — guide/diver/mentor signup flow
│   ├── agency-signup.js        — agency/divecenter signup flow
│   ├── stripe-payment-helper.js — Stripe.js loader for 14 booking pages
│   └── meta-pixel-events.js   — Meta Pixel event tracker
│
├── images/ assets/ static/     — static media (not cloud storage)
│
├── backend/                    ★ CRITICAL — entire API
│   ├── src/
│   │   ├── server.js           ★ CRITICAL — Express app, middleware, routes
│   │   ├── routes/             ★ CRITICAL — all API endpoint files
│   │   │   ├── auth.js         ★ signup, login, verify, forgot/reset password
│   │   │   ├── admin.js        ★ pending signups, approve/reject, analytics
│   │   │   ├── adminEnhanced.js★ extended admin: agencies, dive centers, mentors
│   │   │   ├── experts.js      — expert profile CRUD, public listing
│   │   │   ├── expert-trips.js ★ marketplace trip create/browse/book
│   │   │   ├── expert-trips-payments.js ★ expert trip Stripe flow
│   │   │   ├── expert-trips-admin.js — admin trip approval/management
│   │   │   ├── expert-bank-payouts.js — expert payout management
│   │   │   ├── agencies.js     — agency profile CRUD, public listing
│   │   │   ├── agency-requests.js — agency custom itinerary requests
│   │   │   ├── agency-request-payments.js ★ payment for agency offers
│   │   │   ├── dive-centers.js — dive center CRUD, public listing
│   │   │   ├── dive-center-requests.js — diving package requests
│   │   │   ├── travelRequests.js ★ traveler request + bid system
│   │   │   ├── payments.js     ★ Stripe webhook + general payment
│   │   │   ├── bookings.js     — standard tour/package bookings
│   │   │   ├── trips.js        — standard trip management
│   │   │   ├── jobs.js         — jobs board for agencies hiring experts
│   │   │   ├── applications.js — job applications
│   │   │   ├── file-upload.js  ★ all file upload endpoints + cloud storage
│   │   │   ├── flashOffers.js  — homepage promotional deals
│   │   │   ├── contact.js      — contact form submissions
│   │   │   └── whatsappTracking.js — WhatsApp click analytics
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js         ★ CRITICAL — verifyToken, generateToken, optionalAuth
│   │   │
│   │   ├── config/
│   │   │   ├── database.js     ★ CRITICAL — pg Pool config, warmup, indexes
│   │   │   └── email.js        — admin notifications, booking emails (Nodemailer style)
│   │   │
│   │   ├── utils/
│   │   │   ├── zeptomail.js    ★ CRITICAL — all email delivery via ZeptoMail API
│   │   │   ├── emailBranding.js ★ — HTML email templates and brand colors
│   │   │   ├── email.js        — traveler request email helpers
│   │   │   ├── cloudStorage.js ★ — Replit Object Storage (GCS) integration
│   │   │   ├── logger.js       — admin action audit log helper
│   │   │   └── sanitize.js     — XSS sanitization middleware
│   │   │
│   │   └── models/
│   │       ├── schema.ts       ★ — Drizzle ORM schema (source of truth)
│   │       └── schema.sql      — SQL schema backup
│   │
│   ├── drizzle/                — migration SQL files
│   │   ├── 0000_careful_morgan_stark.sql
│   │   └── 0001_expert_trips.sql
│   ├── uploads/                — temporary local file storage (before cloud upload)
│   ├── .env                    ★ CRITICAL — production environment variables
│   └── package.json            — backend dependencies
│
└── node_modules/               — root dependencies (proxy, compression, etc.)
```

**Files to never edit carelessly:**
- `frontend-server.js` — edits can take the entire site down
- `backend/src/server.js` — middleware order matters; wrong edit = site down
- `backend/src/middleware/auth.js` — breaks all protected routes
- `backend/src/config/database.js` — breaks all DB operations
- `backend/.env` — contains live production credentials

**Files safe to edit:**
- Individual HTML pages (affects only that page)
- Individual route files in `backend/src/routes/` (affects only those endpoints)
- Email templates in `emailBranding.js` (visual only)
- CSS files (visual only)

**Likely unused / old files in root:**
- `akram-workspace.html`, `amr-workspace.html`, `heba-workspace.html` — developer test pages
- `*-OLD.html`, `*-BACKUP.html` files — old versions, safe to delete after review
- `diver-dashboard-preview.html`, `guide-dashboard-preview.html` — static mockups, not functional

---

## 3. Frontend Map

### Public Pages
| File | Purpose | Key API Calls | Actions |
|---|---|---|---|
| `index.html` | Homepage | `GET /api/flash-offers` | Search navigation, service links |
| `about.html` | About page | None | Static |
| `contact.html` | Contact form | `POST /api/contact` | Form submission |
| `experts.html` | Expert listing browse | `GET /api/experts` | Filter, view profiles |
| `agencies.html` | Agency listing browse | `GET /api/agencies` | Filter, view profiles |
| `divecenter-listing.html` | Dive center browse | `GET /api/dive-centers` | Filter, view profiles |
| `expert-trips-marketplace.html` | Browse expert trips | `GET /api/expert-trips` | Filter, book modal |
| `travel-request.html` | Traveler posts request | `POST /api/travel-requests` | Multi-step form |
| `travel-requests-browse.html` | Providers browse requests | `GET /api/travel-requests` | Bid on requests |
| `travel-request-view.html` | Traveler views bids | `GET /api/travel-requests/:id` | Accept/reject offers |
| `forgot-password.html` | Initiate password reset | `POST /api/auth/forgot-password` | Email form |
| `reset-password.html` | Set new password | `POST /api/auth/reset-password` | Password form, redirects by user type |
| `verify-email.html` | Email verification | `POST /api/auth/verify-email` | Token from URL params |
| `booking-success.html` | Post-payment success | `POST /api/expert-trips-payments/confirm-payment` | Confirmation display |

### Login Pages (6 separate pages)
| File | User Type | Calls |
|---|---|---|
| `guide-login.html` | Tour Guides | `POST /api/auth/login` |
| `diver-login.html` | Diving Instructors | `POST /api/auth/login` |
| `mentor-login.html` | Travel Mentors | `POST /api/auth/login` |
| `agency-login.html` | Travel Agencies | `POST /api/auth/login` |
| `divecenter-login.html` | Dive Centers | `POST /api/auth/login` |
| `admin-login.html` | Administrators | `POST /api/auth/login` → `admin-comprehensive.html` |

### Signup Pages
| File | User Type |
|---|---|
| `guide-signup.html` | Tour Guides (requires 4 license photos) |
| `diver-signup.html` | Diving Instructors (cert doc + insurance) |
| `mentor-signup.html` | Travel Mentors (role agreement) |
| `agency-signup.html` | Travel Agencies (tourism license for Egypt) |
| `divecenter-signup.html` | Dive Centers (license + photos) |
| `customer-signup.html` | Travelers (simple registration) |

### Dashboard Pages (each user type has its own)
| File | User Type | Key Calls |
|---|---|---|
| `guide-dashboard.html` / `expert-dashboard-enhanced.html` | Guides | `/api/auth/me`, `/api/expert-trips` |
| `diver-dashboard.html` | Divers | `/api/auth/me`, `/api/expert-trips` |
| `mentor-dashboard.html` | Mentors | `/api/auth/me`, `/api/mentor-offers` |
| `agency-dashboard.html` / `travel-agency-dashboard.html` | Agencies | `/api/agencies/me`, `/api/jobs` |
| `divecenter-dashboard.html` / `dive-center-dashboard.html` | Dive Centers | `/api/dive-centers/me` |
| `admin-dashboard.html` | Admin (basic) | `/api/admin/*` |
| `admin-comprehensive.html` | Admin (full) ★ main admin | All `/api/admin/*` endpoints |

> **⚠️ Duplication Warning:** Multiple dashboard files exist for the same user types (e.g., `guide-dashboard.html` vs `expert-dashboard-enhanced.html`). Check with the owner which is the "live" version before editing. The `-enhanced` and `admin-comprehensive` variants appear to be the current active ones.

### Known Frontend Issues
1. **Inconsistent auth handling** — some pages use `localStorage.getItem('authToken')` directly; newer pages use `js/api-client.js`. Both patterns coexist.
2. **Hardcoded API URL** — `js/api-client.js` has `API_BASE_URL = 'https://www.egtravelmarket.com'`. In local dev this must be changed to `http://localhost:5000` or the proxy won't work.
3. **Inline JS overload** — several pages (e.g., `admin-comprehensive.html` at 5,866 lines) contain thousands of lines of inline JavaScript. This makes maintenance difficult.
4. **Developer test files** — `akram-workspace.html`, `amr-workspace.html`, `heba-workspace.html` are left in the project root.
5. **Old/Backup files** — `*-BACKUP.html`, `*-OLD.html` files exist; they are not served intentionally but clutter the repo.

---

## 4. Backend / API Map

### Base URL: `/api/`

All routes are mounted in `backend/src/server.js`. Rate limiting applies:
- **General limiter:** 500 req / 15 min per IP (all `/api/`)
- **Auth limiter:** 15 req / 15 min per real IP (`/login`, `/signup`)
- **Strict limiter:** 20 req / hour per real IP (`/forgot-password`, `/reset-password`)
- IP detection: Uses `CF-Connecting-IP` header (Cloudflare real IP) via `ipKeyGenerator`

---

### Authentication — `POST /api/auth/*` (auth.js)

| Method | Path | Auth? | Admin? | What It Does | DB Tables |
|---|---|---|---|---|---|
| POST | `/auth/signup` | No | No | Register any user type; creates profile record | `users`, `expert_profiles`, `agency_profiles`, `dive_center_profiles` |
| POST | `/auth/login` | No | No | Authenticate, return JWT + user data | `users` |
| POST | `/auth/admin-form-login` | No | No | Legacy HTML form admin login | `users` |
| GET | `/auth/me` | Yes | No | Return current user profile | `users` + profile tables |
| POST | `/auth/verify-email` | No | No | Verify email token from signup email | `users` |
| POST | `/auth/logout` | Yes | No | Client-side logout (server stateless) | — |
| POST | `/auth/forgot-password` | No | No | Generate reset token, send email | `users` |
| POST | `/auth/reset-password` | No | No | Verify token, update password, return userType for redirect | `users` |
| GET | `/auth/admin/users` | Yes | Yes | List all users | `users` |

**Failure points in auth:**
- `signup`: File uploads must succeed before record creation; partial failures possible
- `forgot-password`: Returns 503 if ZeptoMail credits exhausted (check ZeptoMail billing first)
- `login`: Returns 403 if `is_active = false` (admin-deactivated account)

---

### Admin — `GET/POST/PUT /api/admin/*` (admin.js + adminEnhanced.js)

| Method | Path | Auth? | Admin? | What It Does | DB Tables |
|---|---|---|---|---|---|
| GET | `/admin/pending-signups` | Yes | Yes | Paginated list of non-customer users (supports `?status=&limit=&offset=`) | `users` + 3 profile tables |
| POST | `/admin/approve-signup/:userId` | Yes | Yes | Approve user; set `approval_status=approved` | `users`, profile tables |
| POST | `/admin/reject-signup/:userId` | Yes | Yes | Reject with reason; send rejection email | `users` |
| GET | `/admin/sign-ups/pending` | Yes | Yes | Unverified professional users (email_verified=false, limit 200) | `users` + profiles |
| GET | `/admin/sign-ups/verified-pending` | Yes | Yes | Verified + pending approval users (limit 300) | `users` + profiles |
| GET | `/admin/analytics` | Yes | Yes | Platform stats (user counts, booking totals) | Multiple |
| GET | `/admin/bookings` | Yes | Yes | All bookings with filters | `bookings` |
| PUT | `/admin/bookings/:id` | Yes | Yes | Update booking status | `bookings` |
| GET | `/admin/expert-trips/pending-trips` | Yes | Yes | Trips awaiting approval | `expert_trips` |
| POST | `/admin/expert-trips/:id/approve` | Yes | Yes | Approve expert trip | `expert_trips` |
| POST | `/admin/expert-trips/:id/reject` | Yes | Yes | Reject expert trip with reason | `expert_trips` |
| GET | `/admin/logs` | Yes | Yes | Audit action logs (limit 100) | `action_logs` |
| DELETE | `/admin/delete-user/:userId` | Yes | Yes | Permanently delete user + all data | All tables |

> **⚠️ DANGER:** `DELETE /admin/delete-user/:userId` is irreversible and cascades. Always confirm before using.

---

### Expert Trips — `backend/src/routes/expert-trips.js`

| Method | Path | Auth? | What It Does | DB Tables |
|---|---|---|---|---|
| GET | `/expert-trips` | Optional | Browse approved trips with filters/pagination | `expert_trips` |
| GET | `/expert-trips/:tripId` | Optional | Single trip detail | `expert_trips` |
| POST | `/expert-trips/create` | Yes | Create new trip (status=draft) | `expert_trips` |
| PUT | `/expert-trips/:tripId` | Yes | Update trip content | `expert_trips` |
| POST | `/expert-trips/:tripId/submit-approval` | Yes | Submit trip for admin review | `expert_trips` |
| POST | `/expert-trips/:tripId/book` | No | Create booking + Stripe checkout | `expert_trip_bookings` |

---

### Payments — `payments.js`, `expert-trips-payments.js`, `agency-request-payments.js`

| Method | Path | File | What It Does | DB Tables |
|---|---|---|---|---|
| POST | `/payments/create-checkout-session` | payments.js | Stripe Checkout for standard bookings | `bookings` |
| POST | `/payments/create-payment-intent` | payments.js | Stripe Payment Intent | `expert_trip_bookings` |
| POST | `/payments/webhook` | payments.js | **Stripe webhook handler** (handles multiple types) | `bookings`, `traveler_request_orders` |
| POST | `/expert-trips-payments/create-payment-intent` | expert-trips-payments.js | Expert trip payment | `expert_trip_bookings` |
| POST | `/expert-trips-payments/confirm-payment` | expert-trips-payments.js | Confirm success from success page | `expert_trip_bookings`, `expert_trip_payments`, `expert_payouts` |
| POST | `/expert-trips-payments/webhook` | expert-trips-payments.js | Separate webhook for expert trips | `expert_trip_bookings` |
| POST | `/agency-request-payments/:offerId/pay` | agency-request-payments.js | Create Stripe session for agency offer | `traveler_request_orders` |
| GET | `/agency-request-payments/order/:orderId/status` | agency-request-payments.js | Check payment status | `traveler_request_orders` |

---

### File Uploads — `backend/src/routes/file-upload.js`

| Method | Path | Auth? | What It Does |
|---|---|---|---|
| POST | `/upload/upload-signup-photo` | No | Profile/logo/document upload during signup |
| POST | `/upload/upload-trip-image` | Yes | Trip image upload (validates 800px min width, no square) |
| POST | `/upload/upload-photo` | Yes | General authenticated photo upload |
| GET | `/objects/uploads/:filename` | No | Stream file from cloud storage |

---

### Other Routes

| Route Prefix | File | Purpose |
|---|---|---|
| `/api/experts` | experts.js | Expert profile CRUD + public listing |
| `/api/agencies` | agencies.js | Agency profile CRUD + public listing |
| `/api/dive-centers` | dive-centers.js | Dive center profile CRUD + public listing |
| `/api/travel-requests` | travelRequests.js | Traveler requests + bidding system |
| `/api/bookings` | bookings.js | Standard tour bookings |
| `/api/jobs` | jobs.js | Agency jobs board |
| `/api/applications` | applications.js | Job applications |
| `/api/flash-offers` | flashOffers.js | Homepage promotional deals |
| `/api/contact` | contact.js | Contact form |
| `/api/whatsapp/track` | whatsappTracking.js | WhatsApp button analytics |

---

## 5. Database Map

**Engine:** PostgreSQL (Neon serverless)
**Connection file:** `backend/src/config/database.js`
**Pool:** max 8 connections (prod), 10 (dev). KeepAlive + health ping every 60s. Indexes auto-created at startup.
**Schema source:** `backend/src/models/schema.ts` (Drizzle ORM) + `backend/src/models/schema.sql`

---

### Core Tables

#### `users` ★ MOST CRITICAL TABLE
| Column | Type | Purpose |
|---|---|---|
| `id` | Serial PK | Primary identifier |
| `email` | Varchar UNIQUE | Login credential |
| `password_hash` | Varchar | bcrypt hash (10 rounds) |
| `full_name` | Varchar | Display name |
| `user_type` | Varchar | `customer`, `guide`, `diver`, `mentor`, `agency`, `divecenter`, `admin` |
| `approval_status` | Varchar | `pending`, `approved`, `rejected` |
| `is_active` | Boolean | Admin can block login by setting false |
| `email_verified` | Boolean | Must be true before admin approval |
| `email_verification_token` | Varchar | Token sent in signup email |
| `password_reset_token` | Varchar | SHA-256 hash of reset token |
| `password_reset_expires` | Timestamp | 1-hour expiry |
| `certification_status` | Varchar | `pending`, `certified` |
| `approved_at` | Timestamp | When admin approved |
| `approved_by` | Varchar | Admin email who approved |
| `rejection_reason` | Text | Shown to rejected users |
| `last_login` | Timestamp | Updated on each login |
| `created_at` / `updated_at` | Timestamp | Audit fields |

**Indexes (created automatically at startup):**
- `idx_users_approval_status` on `approval_status`
- `idx_users_email_verified` on `email_verified`
- `idx_users_user_type` on `user_type`
- `idx_users_created_at_desc` on `created_at DESC`
- `idx_users_approval_verified` composite on `(approval_status, email_verified)`

---

#### `expert_profiles`
| Key Columns | Purpose |
|---|---|
| `user_id` (FK → users.id) | Ownership |
| `expert_type` | `guide`, `diver`, `mentor` |
| `slug` | URL-friendly identifier for public profile |
| `display_name`, `bio` | Public profile content |
| `profile_photo`, `cover_photo` | Cloud storage URLs |
| `is_verified`, `is_featured`, `is_active` | Listing visibility |
| `ministry_license_front/back_url` | Document uploads (Guides) |
| `syndicate_license_front/back_url` | Document uploads (Guides) |
| `certification_document_url` | Document uploads (Divers) |
| `insurance_document_url`, `insurance_expiry_date` | Insurance (Divers) |
| `hourly_rate`, `day_rate` | Pricing |
| `languages`, `specialties`, `certifications` | JSON arrays |

---

#### `agency_profiles`
| Key Columns | Purpose |
|---|---|
| `user_id` (FK → users.id) | Ownership |
| `company_name`, `slug` | Identity |
| `logo_url`, `tourism_license_url` | Uploads |
| `company_based_in` | `Egypt` or `International` |
| `business_type` | B2B, B2C, both |
| `approval_status` | Mirrors user approval |
| `operating_areas`, `services` | JSON arrays |

---

#### `dive_center_profiles`
| Key Columns | Purpose |
|---|---|
| `user_id` (FK → users.id) | Ownership |
| `center_name`, `slug` | Identity |
| `padi_center_number`, `ssi_center_number` | Certification numbers |
| `dive_center_base` | Location (Red Sea, Mediterranean, etc.) |
| `license_front_url`, `license_back_url` | License documents |
| `approval_status` | Mirrors user approval |

---

#### `expert_trips` ★
| Key Columns | Purpose |
|---|---|
| `expert_id` (FK → expert_profiles.id) | Creator |
| `agency_id` (FK → agency_profiles.id) | If agency-created |
| `title`, `description` | Content |
| `price`, `duration` | Booking parameters |
| `image` | Cloud storage URL |
| `status` | `draft` → `pending_approval` → `approved` / `rejected` |
| `max_participants`, `available_spots` | Capacity |

---

#### `expert_trip_bookings` ★
| Key Columns | Purpose |
|---|---|
| `trip_id` (FK → expert_trips.id) | Which trip |
| `traveler_email`, `traveler_name` | Guest data |
| `total_amount` | Price at time of booking |
| `booking_status` | `pending`, `confirmed`, `cancelled` |
| `payment_status` | `pending`, `paid`, `refunded` |
| `stripe_session_id`, `stripe_payment_intent_id` | Stripe references |

---

#### `expert_trip_payments` ★ (Escrow)
| Key Columns | Purpose |
|---|---|
| `booking_id` (FK → expert_trip_bookings.id) | Reference |
| `platform_commission` | 20% |
| `expert_amount` | 80% |
| `status` | `escrow` → `released` / `refunded` |

---

#### `expert_payouts`
| Key Columns | Purpose |
|---|---|
| `expert_id` (FK → expert_profiles.id) | Recipient |
| `amount` | Payout amount |
| `status` | `pending` → `paid` / `failed` |

---

#### `guest_requests` (Traveler Request System)
| Key Columns | Purpose |
|---|---|
| `code` | Public unique code (travelers use to view their request) |
| `pin` | Private PIN (secures traveler access) |
| `title`, `description` | Request content |
| `category` | Type of service needed |
| `status` | `pending`, `open`, `closed`, `cancelled` |
| `approval_status` | `pending` → `approved` (admin reviews first) |
| `budget_min`, `budget_max` | Traveler budget |
| `travel_date` | Requested date |

---

#### `guest_request_bids`
| Key Columns | Purpose |
|---|---|
| `request_id` (FK → guest_requests.id) | Parent request |
| `expert_id` (FK → users.id) | Bidding provider |
| `price` | Offered price |
| `status` | `pending`, `accepted`, `rejected` |
| `message` | Provider's pitch |

---

#### `traveler_request_orders` (Payment for accepted bids)
| Key Columns | Purpose |
|---|---|
| `request_id` | Linked request |
| `gross_amount` | Total charge |
| `platform_fee` | Platform's cut |
| `provider_amount` | Provider's share |
| `payment_status` | `pending` → `paid` |
| `stripe_session_id` | Stripe reference |
| `paid_at` | Timestamp |

---

#### `bookings` (Standard bookings, separate from expert trips)
| Key Columns | Purpose |
|---|---|
| `user_id`, `expert_id` | Participants |
| `package_name`, `total_amount` | Booking details |
| `status` | `pending`, `confirmed`, `cancelled` |
| `payment_status` | `pending`, `paid`, `failed` |
| `stripe_session_id`, `payment_intent_id` | Stripe |

---

#### Other Tables
| Table | Purpose | Status |
|---|---|---|
| `jobs` | Agency job postings | Active |
| `job_applications` | Expert applications to jobs | Active |
| `transactions` | Payment records for standard bookings | Active |
| `flash_offers` | Homepage promotional deals | Active |
| `action_logs` | Admin audit trail | Active |
| `whatsapp_clicks` | Analytics for WhatsApp buttons | Active |
| `contact_submissions` | Contact form entries | Active |

---

## 6. Authentication and Login Flow

### Login Flow (All User Types)
```
User fills login form (email + password)
    │
    ▼
POST /api/auth/login
    │
    ├── Check users.email (case-insensitive)
    ├── Check users.is_active (403 if false — account blocked by admin)
    ├── bcrypt.compare(password, password_hash)
    ├── Check approval_status (403 if rejected)
    ├── Generate JWT: { userId, email, userType } — 7 day expiry
    ├── Update users.last_login timestamp
    └── Return { token, user, expertProfile/agencyProfile/etc. }
         │
         ▼
    Frontend (api-client.js):
    ├── localStorage.setItem('authToken', token)
    ├── localStorage.setItem('currentUser', JSON.stringify({id, name, email, role, token, ...}))
    └── Redirect to role-specific dashboard
```

### Token Verification (all protected routes)
```
Request arrives with: Authorization: Bearer <JWT>
    │
    ├── verifyToken middleware (backend/src/middleware/auth.js)
    │   └── jwt.verify(token, JWT_SECRET) → sets req.user
    │
    └── requireAdmin middleware (admin routes only)
        └── checks req.user.userType === 'admin'
```

### Password Storage
- Algorithm: **bcryptjs**, 10 salt rounds
- Never stored in plain text
- Password reset: raw token sent in email, SHA-256 hash stored in DB, 1-hour expiry

### Security Notes
- `JWT_SECRET` in `backend/.env` is currently set to a default placeholder — **must be changed for production security**
- Tokens are stored in `localStorage` (not HttpOnly cookies) — vulnerable to XSS if malicious scripts are ever injected
- `trust proxy: 1` is set in Express — combined with Cloudflare, this correctly resolves client IPs via `CF-Connecting-IP`

### Signup Flow
```
User fills signup form → uploads documents/photos (separate API calls)
    │
    ▼
POST /api/auth/signup
    ├── Validate required fields by user_type
    ├── Check email uniqueness
    ├── Hash password (bcrypt, 10 rounds)
    ├── INSERT into users (approval_status='pending', email_verified=false)
    ├── INSERT into expert_profiles / agency_profiles / dive_center_profiles
    ├── Send verification email (ZeptoMail) — async, non-blocking
    └── Send admin notification email — async, non-blocking

User clicks verification email link → /verify-email?token=...&email=...
    └── POST /api/auth/verify-email → sets email_verified=true

Admin reviews in admin-comprehensive.html → approves
    └── POST /api/admin/approve-signup/:userId
        ├── Sets approval_status='approved', certification_status='certified'
        └── Sends approval email to user
```

---

## 7. Admin Dashboard Map

### Two Admin Pages
| File | Purpose | When to Use |
|---|---|---|
| `admin-dashboard.html` | Basic admin view | Legacy, fewer features |
| `admin-comprehensive.html` | **Full admin panel** ★ | Primary admin interface (5,866 lines) |

### Admin Sections in `admin-comprehensive.html`

| Tab | What It Shows | Key APIs | Actions |
|---|---|---|---|
| **Sign Up Approval** | Unverified users (email_verified=false) | `GET /api/admin/sign-ups/pending` | View details, Approve, Reject |
| **Verified & Pending** | Verified users awaiting admin approval | `GET /api/admin/sign-ups/verified-pending` | View docs, Approve, Reject |
| **Agencies** | All agency accounts | `GET /api/admin/agencies` | Edit, Activate/Deactivate |
| **Dive Centers** | All dive center accounts | `GET /api/admin/dive-centers` | Edit, Activate/Deactivate |
| **Guides** | All guide accounts | `GET /api/admin/guides` | Edit, Activate/Deactivate |
| **Divers** | All diver accounts | `GET /api/admin/divers` | Edit, Activate/Deactivate |
| **Mentors** | All mentor accounts | `GET /api/admin/mentors` | Edit, Activate/Deactivate |
| **Expert Trips** | Trips pending approval | `GET /api/admin/expert-trips/pending-trips` | Approve, Reject |
| **Travel Requests** | All traveler requests | `GET /api/admin/travel-requests` | Approve, reject, manage |
| **Bookings** | All platform bookings | `GET /api/admin/bookings` | View, update status |
| **Payouts** | Expert payout requests | `GET /api/admin/payouts` | Release funds |
| **Flash Offers** | Homepage promotions | `GET /api/admin/flash-offers` | Create, Edit, Delete |
| **Jobs** | Job board listings | `GET /api/admin/jobs` | Approve, Delete |
| **Analytics** | Platform statistics | `GET /api/admin/analytics` | View only |
| **Logs** | Admin action audit trail | `GET /api/admin/logs` | View only |

### Known Admin Dashboard Issues
- `admin-comprehensive.html` is **5,866 lines** of combined HTML + inline CSS + inline JS. Difficult to maintain.
- Approve/reject actions trigger emails — if ZeptoMail credits are exhausted, the action still completes but the user won't receive the email notification.
- The "Delete User" action is **permanent and irreversible** — no soft delete.

---

## 8. Experts System Flow

### Signup → Approval → Public Profile

```
1. SIGNUP
   Page: guide-signup.html / diver-signup.html / mentor-signup.html
   JS: js/expert-signup.js
   Uploads: POST /api/upload/upload-signup-photo (license documents, profile photo)
   Submit: POST /api/auth/signup
   DB: users (pending) + expert_profiles

2. EMAIL VERIFICATION
   Email link: /verify-email?token=...
   API: POST /api/auth/verify-email
   DB: users.email_verified = true

3. ADMIN REVIEW
   Page: admin-comprehensive.html → "Verified & Pending" tab
   API: GET /api/admin/sign-ups/verified-pending
   Admin reviews: name, type, documents, license photos
   Action: POST /api/admin/approve-signup/:userId
   DB: users.approval_status = 'approved', certification_status = 'certified'
   Email: Approval notification sent to expert

4. EXPERT LOGS IN
   Page: guide-login.html / diver-login.html / mentor-login.html
   API: POST /api/auth/login
   Dashboard: guide-dashboard.html / expert-dashboard-enhanced.html

5. EXPERT CREATES TRIPS
   Page: expert-dashboard-enhanced.html
   API: POST /api/expert-trips/create (status='draft')
   Submit for approval: POST /api/expert-trips/:tripId/submit-approval (status='pending_approval')
   Admin approves: status='approved' → trip appears on marketplace

6. PUBLIC PROFILE IS LIVE
   URL: /expert-profile.html?slug=their-slug
   API: GET /api/experts/:slug
   Condition: is_verified=true AND is_active=true AND approval_status='approved'
```

### Expert Trip Search/Filter Logic
- Endpoint: `GET /api/expert-trips`
- Filters: `type`, `location`, `priceMin`, `priceMax`, `duration`, `page`, `limit`
- Response is cached for 5 minutes (API-level cache)
- Only `status='approved'` trips appear publicly

---

## 9. Agencies / Dive Centers Flow

### Similar to Experts but with Different Approval Requirements

```
1. SIGNUP
   Pages: agency-signup.html / divecenter-signup.html
   JS: js/agency-signup.js
   Egyptian agencies: must provide tourism license number + upload
   International agencies: foreign_agency_confirmation required
   Egyptian dive centers: license authority, number, dates, front+back photos
   International dive centers: foreign_registration_id + international_operations_confirmation

2. APPROVAL (same as experts)
   Admin approves in "Verified & Pending" tab
   Also triggers UPDATE agency_profiles/dive_center_profiles SET approval_status='approved'
   (If agency profile doesn't exist at approval time, one is auto-created)

3. DASHBOARD
   agency-dashboard.html / travel-agency-dashboard.html
   divecenter-dashboard.html / dive-center-dashboard.html
   Note: Duplicate dashboards exist — confirm with owner which is live

4. PUBLIC LISTING
   Agencies: /agencies.html → GET /api/agencies (filters: type, location, services)
   Dive Centers: /divecenter-listing.html → GET /api/dive-centers (filters: base, services)
   Condition: approval_status='approved' AND is_active=true

5. REQUEST FLOW
   Travelers request custom itineraries:
   Agency: POST /api/agency-requests
   Dive Center: POST /api/dive-center-requests
   Admin/Provider notified → Provider responds → Email confirmation
```

### Shared Logic with Experts
- Same `POST /api/auth/signup` endpoint handles all user types
- Same admin approval workflow
- Same JWT authentication
- Same file upload system

---

## 10. Traveler Request / Offers / Booking Flow

```
STEP 1 — Traveler Submits Request
  Page: travel-request.html
  Form: Name, Email, Title, Category, Location, Date, Budget, Details
  API: POST /api/travel-requests
  DB: guest_requests (status='pending', approval_status='pending')
       Generates unique code + PIN
  Emails: Confirmation to traveler + notification to admin
  Fail point: ZeptoMail down → email fails but request IS saved

STEP 2 — Admin Approves Request
  Page: admin-comprehensive.html → Travel Requests tab
  API: PUT /api/travel-requests/admin/:id/approval
  DB: guest_requests (status='open', approval_status='approved')
  Email: Approval notification to traveler

STEP 3 — Providers Browse & Bid
  Page: travel-requests-browse.html (requires provider login)
  API: GET /api/travel-requests (filters: category, location, budget)
  Bid: POST /api/travel-requests/:id/bids
  DB: guest_request_bids (status='pending')
  Rule: One bid per provider per request enforced

STEP 4 — Traveler Views Bids
  Page: travel-request-view.html
  Access: code + PIN from confirmation email (no login required)
  API: GET /api/travel-requests/:code (requires PIN in query)
  Actions: Accept bid → PUT /api/travel-requests/bids/:bidId/status (status='accepted')
  DB: guest_request_bids.status = 'accepted', request status changes

STEP 5 — Payment
  API: POST /api/agency-request-payments/:offerId/pay
  Creates: Stripe Checkout Session
  DB: traveler_request_orders (payment_status='pending')
  Redirect: Traveler to Stripe payment page

STEP 6 — Stripe Confirms Payment
  Webhook: POST /api/payments/webhook (metadata.type='agency_traveler_request')
  DB: traveler_request_orders.payment_status = 'paid', paid_at = NOW()
  Emails: Confirmation to traveler + notification to agency + admin notification

STEP 7 — Manual Payout (no auto-payout)
  Admin logs in → Payouts section
  Releases funds to agency manually after trip completion
  API: POST /api/admin/release-payout (or similar)

```

**Key status fields to track:**
- `guest_requests.status`: `pending` → `open` → `closed` / `cancelled`
- `guest_requests.approval_status`: `pending` → `approved` / `rejected`
- `guest_request_bids.status`: `pending` → `accepted` / `rejected`
- `traveler_request_orders.payment_status`: `pending` → `paid`

---

## 11. Stripe Payment Flow

### Three Independent Payment Flows

#### Flow A — Standard Bookings
```
POST /api/payments/create-checkout-session
    → stripe.checkout.sessions.create({ mode: 'payment' })
    → Redirect user to Stripe
    → Stripe webhook: POST /api/payments/webhook
    → checkout.session.completed
    → UPDATE bookings SET payment_status='paid'
    → Send confirmation emails
```

#### Flow B — Expert Trips (Escrow)
```
POST /api/expert-trips-payments/create-payment-intent
    → stripe.paymentIntents.create
    → Redirect to booking-success.html
    → booking-success.html calls: POST /api/expert-trips-payments/confirm-payment
    → INSERT expert_trip_payments (status='escrow', commission=20%, expert=80%)
    → INSERT expert_payouts (status='pending')
    → Admin releases manually via /admin/release-payment endpoint
    → Separate webhook: POST /api/expert-trips-payments/webhook
```

#### Flow C — Agency Request Payments
```
POST /api/agency-request-payments/:offerId/pay
    → Check: session re-use if pending Stripe session still open
    → stripe.checkout.sessions.create({ metadata: { type: 'agency_traveler_request' } })
    → Stripe webhook: POST /api/payments/webhook (shared)
    → Detected by metadata.type === 'agency_traveler_request'
    → UPDATE traveler_request_orders SET payment_status='paid'
```

### Security Protections in Place
| Risk | Protection |
|---|---|
| Double payment | DB checks for `paid` status before creating new session |
| Webhook spoofing | `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` |
| Client-side price tampering | Amounts calculated server-side from DB prices |
| Missing webhook | `booking-success.html` has fallback confirm call |
| Expert payout | Funds held in escrow; manual admin release only |

### Risks to Watch
- `STRIPE_WEBHOOK_SECRET` must be set in production or webhook validation is skipped/warned
- Expert payout is entirely manual — no automation or reminder system
- Admin cancel/refund: `stripe.refunds.create` is used for tiered cancellation, check business rules before triggering

---

## 12. Email Flow

### Provider
**ZeptoMail** (Zoho) — REST API at `https://api.zeptomail.com/v1.1/email`

### Configuration Files
| File | Role |
|---|---|
| `backend/src/utils/zeptomail.js` | Low-level API connector — all emails pass through here |
| `backend/src/utils/emailBranding.js` | HTML templates, brand colors (`#0066cc` blue, `#28a745` green) |
| `backend/src/config/email.js` | Standard booking + admin alert email functions |
| `backend/src/utils/email.js` | Traveler request flow emails |
| `backend/src/utils/expert-trips-email.js` | Expert marketplace booking emails |

### Events That Trigger Emails
| Event | Recipients | File |
|---|---|---|
| User signup | User (verification link) + Admin (new user alert) | auth.js |
| Email verification success | None (client-side feedback) | — |
| Admin approves user | User (approval confirmation) | admin.js |
| Admin rejects user | User (rejection + reason) | admin.js |
| Password reset request | User (reset link, 1hr expiry) | auth.js |
| Travel request submitted | Traveler (code+PIN) + Admin | travelRequests.js / utils/email.js |
| Travel request approved | Traveler | travelRequests.js |
| New bid on traveler request | Traveler | guest_request_bids route |
| Booking confirmed (standard) | Traveler + Admin | config/email.js |
| Booking confirmed (expert trip) | Traveler + Expert + Admin | expert-trips-email.js |
| Payment success | Traveler + Admin | payments.js |
| Payment failed | Admin | payments.js |
| Agency request payment | Traveler + Agency + Admin | agency-request-payments.js |

### Error Handling Pattern
Most emails are **non-blocking** (fire-and-forget):
```javascript
sendEmail(...).catch(err => console.error('Email failed:', err.message));
// workflow continues regardless
```
Exception: `forgot-password` is **blocking** — if email fails, returns 503 to user (intentional, user needs the email to reset).

### ⚠️ Known Failure Mode
ZeptoMail returns HTTP 429 with code `LE_102` ("Credit exhausted") when billing runs out.
This causes ALL platform emails to silently fail.
**Fix:** Log into ZeptoMail dashboard and top up credits.

---

## 13. File Uploads / Images

### Upload Path
```
User selects file on HTML page
    │
    ▼
POST /api/upload/upload-signup-photo (or upload-photo / upload-trip-image)
    │
    ▼
Multer (diskStorage) saves file temporarily to backend/uploads/
    │
    ├── Validation: extension (.jpg, .jpeg, .png, .webp, .gif, .svg), MIME type, 5MB max
    ├── Trip images only: sharp validates min 800px width, rejects squares
    │
    ▼
cloudStorage.uploadFileToCloud (backend/src/utils/cloudStorage.js)
    │
    ├── SUCCESS: File sent to Replit Object Storage (GCS via sidecar at 127.0.0.1:1106)
    │           Local file deleted (fs.unlink)
    │           Returns: /objects/uploads/filename
    │
    └── FAILURE: Fallback to local file
                Returns: /uploads/filename
```

### Serving Files
| URL Pattern | Served From | Notes |
|---|---|---|
| `/objects/uploads/:filename` | Cloud (GCS) via streaming | `GET /objects/uploads/` route in server.js |
| `/uploads/:filename` | Local `backend/uploads/` | Legacy fallback |

### Database Fields Storing URLs
- `expert_profiles`: `profile_photo`, `cover_photo`, `ministry_license_front_url`, `ministry_license_back_url`, `syndicate_license_front_url`, `syndicate_license_back_url`, `certification_document_url`, `insurance_document_url`
- `agency_profiles`: `logo_url`, `tourism_license_url`
- `dive_center_profiles`: `logo_url`, `license_front_url`, `license_back_url`
- `expert_trips`: `image`

### Production Safety
- Cloud storage **persists across Replit redeploys** ✓
- Local fallback files **do NOT persist** across Replit VM restarts ✗
- If cloud upload fails silently and URL stored as `/uploads/...` → file will disappear on next redeploy

---

## 14. Environment Variables and Secrets

| Variable | Purpose | Files That Use It | Dev Required | Prod Required |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) | `backend/src/config/database.js` | ✅ Yes | ✅ Yes |
| `JWT_SECRET` | Signs/verifies all JWTs | `backend/src/middleware/auth.js` | ✅ Yes | ✅ Yes (must be strong random value) |
| `ZEPTOMAIL_API_KEY` | ZeptoMail email API key | `backend/src/utils/zeptomail.js` | ✅ Yes | ✅ Yes |
| `EMAIL_USER` | Sender address for emails | `backend/src/utils/zeptomail.js` | Optional (default: info@egtravelmarket.com) | ✅ Yes |
| `ADMIN_EMAIL` | Recipient for admin notifications | `backend/src/config/email.js` | Optional | ✅ Yes |
| `FRONTEND_URL` | Base URL for email links (verification, reset) | `backend/src/routes/auth.js` | Optional | ✅ Yes (must be `https://www.egtravelmarket.com`) |
| `STRIPE_SECRET_KEY` | Stripe private key (server-side) | `payments.js`, `agency-request-payments.js` | ✅ Yes | ✅ Yes |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key | `payments.js` | ✅ Yes | ✅ Yes |
| `STRIPE_WEBHOOK_SECRET` | Verify Stripe webhook signatures | `payments.js` | Optional | ✅ Yes |
| `PORT` | Frontend server port | `frontend-server.js` | Optional (5000) | ✅ Yes (80 in prod) |
| `BACKEND_PORT` | Backend server port | `server.js`, `frontend-server.js` | Optional (3000) | Optional (3000) |
| `NODE_ENV` | `production` or `development` | `server.js`, `database.js` | Optional | ✅ Yes (set to `production`) |
| `PRIVATE_OBJECT_DIR` | Cloud storage bucket path | `backend/src/utils/cloudStorage.js` | ✅ Yes (for uploads) | ✅ Yes |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Cloud asset search paths | `backend/src/utils/cloudStorage.js` | Optional | Optional |
| `REPLIT_ENVIRONMENT` | Replit-specific platform flag | `frontend-server.js` | No | No (set by Replit) |
| `BACKEND_URL` | Internal URL for proxy to reach backend | `frontend-server.js` | Optional | Optional |
| `EMAIL_PASSWORD` | Legacy Gmail credential (currently unused by ZeptoMail) | `backend/.env` only | No | No |

> **Security concern:** `JWT_SECRET` in `backend/.env` is currently `your_jwt_secret_key_here_change_in_production` — this MUST be changed to a cryptographically strong random string before the platform handles real users.

---

## 15. Current Runtime / Deployment Setup

### How the App Runs on Replit

| Server | Command | Port | Role |
|---|---|---|---|
| Backend | `cd backend && node src/server.js` | 3000 | API server |
| Frontend | `node frontend-server.js` | 5000 (dev) / 80 (prod) | Static files + API proxy |

### Startup Scripts
- **`start.sh`** — primary production start script (starts both servers)
- **`start-all.sh`** — alternate: starts backend in background, waits for health check, then starts frontend
- **`build.sh`** — no actual build step (`echo "No build step required"`)

### Replit Workflow Configuration
The `.replit` config defines:
- `Backend Server` workflow: `cd backend && node src/server.js`
- `Frontend Server` workflow: `node frontend-server.js`

### Database Connection at Runtime
On backend startup (`database.js`):
1. `warmUpPool()` — attempts DB connection with 3 retries + exponential backoff
2. `fixMissingProfiles()` — repairs any agency/dive center profiles missing after manual approval
3. `ensureIndexes()` — creates 5 performance indexes if they don't exist
4. `setInterval(healthPing, 60000)` — keeps Neon serverless connection alive

### Cloudflare Configuration
- DNS: CNAME pointing to `.replit.app` domain
- SSL mode: **"Full"** (not Full Strict) — required because Replit uses a self-signed cert
- `trust proxy: 1` set in Express; `CF-Connecting-IP` header used for rate limiting

### Production vs Development Differences
| Setting | Development | Production |
|---|---|---|
| Pool max connections | 10 | 8 |
| Connection timeout | 15s | 30s (handles Neon cold start) |
| Statement timeout | 45s | 45s |
| CSS/JS caching | No cache | 1 hour |
| Image caching | No cache | 7 days immutable |
| Gzip compression | Yes | Yes |
| Error detail in responses | Full | Hidden |

---

## 16. Known Technical Risks

### 🔴 Critical Risks
1. **JWT_SECRET is a placeholder** — `your_jwt_secret_key_here_change_in_production` in `backend/.env`. If not changed, any developer who reads this can forge admin tokens.
2. **ZeptoMail credit depletion = all emails stop** — No alerting. Platform appears to work but no emails are delivered. Check ZeptoMail dashboard if users report missing emails.
3. **No soft delete** — Admin "Delete User" permanently removes all data. No recovery possible.
4. **Expert payout is 100% manual** — No automation, no reminder. If admin forgets, experts don't get paid after trips complete.
5. **STRIPE_WEBHOOK_SECRET missing in dev** — Webhook validation is skipped. Spoofing possible in dev/staging.

### 🟡 Important Risks
6. **Duplicate dashboard files** — Multiple versions of the same dashboard exist. Editing the wrong file (e.g., the old one) has no visible effect but wastes time.
7. **`admin-comprehensive.html` is 5,866 lines** — Any small typo in the inline JS can break the entire admin panel.
8. **Local file fallback** — If cloud storage fails during upload and falls back to local, that file disappears on next redeploy.
9. **No input validation on several older endpoints** — Some older route files have minimal sanitization. The `sanitize.js` middleware is applied globally but regex bypasses exist.
10. **`loadAllUsers()` in admin-dashboard.html calls the same endpoint as pending-signups** — If this endpoint filter changes, it could show wrong data.

### 🟢 Lower-Risk But Worth Noting
11. **`authToken` in localStorage** — Vulnerable to XSS. Moving to HttpOnly cookies would be more secure.
12. **No automated testing** — Zero test coverage. Any change risks silent breakage.
13. **Hardcoded `API_BASE_URL`** in `js/api-client.js` — Must be manually changed for local development.
14. **Multiple admin pages** (`admin-dashboard.html` vs `admin-comprehensive.html`) — New developer may edit the wrong one.
15. **Old/dev files in root** — `akram-workspace.html`, `*-BACKUP.html`, etc., should be cleaned up.

---

## 17. Recommended Developer Action Plan

### 🔴 Fix Immediately (Before Any Development)
1. **Change `JWT_SECRET`** to a strong random 64-character string in `backend/.env` AND in Replit Secrets
2. **Understand which dashboard files are "live"** — ask the owner to confirm before editing anything
3. **Set up ZeptoMail credit alerts** in the ZeptoMail dashboard so email outages are caught early
4. **Back up the database** — export a full PostgreSQL dump before touching any schema

### 🟡 Important Improvements (First 2 Weeks)
5. Extract inline JS from `admin-comprehensive.html` into a separate `admin.js` file
6. Consolidate duplicate dashboard files — deprecate and remove old versions
7. Add `STRIPE_WEBHOOK_SECRET` validation to fail loudly if missing in production
8. Move `authToken` to HttpOnly cookies for better XSS protection
9. Add automated expert payout reminders (email admin after trip completion date passes)
10. Clean up dev/test HTML files from the root directory

### 🔵 Gradual Refactoring (Ongoing)
11. Standardize all pages to use `js/api-client.js` instead of raw `fetch()` with hardcoded URLs
12. Add basic API integration tests (at least for payment webhooks and auth endpoints)
13. Add a `.env.example` file documenting all required variables
14. Move inline CSS from HTML pages into `styles.css`

### ⛔ Do Not Touch Yet
- `backend/src/config/database.js` — pool configuration is production-tuned; changing it carelessly can cause connection exhaustion
- `frontend-server.js` — the multipart/file upload proxy logic is delicate
- `backend/src/middleware/auth.js` — any change breaks all protected routes
- The Stripe webhook handlers — test thoroughly in Stripe CLI before deploying changes

---

## 18. Safe Development Rules

### Files That Are Dangerous to Edit
| File | Risk Level | Why |
|---|---|---|
| `frontend-server.js` | 🔴 Critical | Takes entire site down if broken |
| `backend/src/server.js` | 🔴 Critical | Middleware order, CORS, rate limiter |
| `backend/src/middleware/auth.js` | 🔴 Critical | All auth breaks |
| `backend/src/config/database.js` | 🔴 Critical | All DB operations break |
| `backend/.env` | 🔴 Critical | Production credentials |
| `backend/src/routes/payments.js` | 🟡 High | Stripe webhook logic |
| `admin-comprehensive.html` | 🟡 High | 5,866 lines; one typo breaks admin |

### Flows to Test After ANY Change
1. **Login** — all 6 user types
2. **Signup** — at least one expert type and agency
3. **Password reset** — full flow (request → email → reset → login)
4. **Expert trip** — create → submit → admin approve → book → payment
5. **Admin dashboard** — sign-up approval, trip approval
6. **File upload** — profile photo and document upload

### Database Tables That Need Backup Before Schema Changes
- `users` — loss = all accounts gone
- `expert_trip_payments` — loss = escrow records gone (financial)
- `expert_payouts` — loss = payout history gone (financial)
- `bookings` and `expert_trip_bookings` — loss = booking history gone
- `traveler_request_orders` — loss = payment records gone

### Features That Must NOT Be Rewritten Suddenly
- Stripe webhook handling — test with Stripe CLI first
- Email system — changes affect all transactional emails
- JWT auth — any breaking change logs out all users instantly
- File upload route — storage path changes orphan existing files

### Development Workflow
1. Never commit directly to the main branch with untested API changes
2. Test Stripe webhooks locally using the Stripe CLI: `stripe listen --forward-to localhost:3000/api/payments/webhook`
3. Use `NODE_ENV=development` locally — this changes DB pool size, cache headers, and error verbosity
4. After any backend change, restart the Backend Server workflow
5. After any HTML/JS/CSS change, the Frontend Server automatically serves the new files (no restart needed)

---

## 19. Testing Checklist

Use this checklist manually after any significant change.

### Public Pages
- [ ] Homepage (`index.html`) loads without errors; flash offers appear
- [ ] Expert listing page loads; filters work (type, location, price)
- [ ] Expert public profile loads (slug URL)
- [ ] Agency listing loads; search filters work
- [ ] Agency public profile loads
- [ ] Dive center listing loads
- [ ] Expert trips marketplace loads; filter by type/location works

### Authentication
- [ ] Guide signup with required license photos — verification email received
- [ ] Email verification link works
- [ ] Guide login works — redirects to guide dashboard
- [ ] Agency login works — redirects to agency dashboard
- [ ] Admin login works — redirects to admin-comprehensive.html
- [ ] Incorrect password returns clear error, not crash
- [ ] Inactive account returns clear error
- [ ] Forgot password — email received within 2 minutes
- [ ] Reset password link in email is clickable and opens correct page
- [ ] New password saves and user can log in with it
- [ ] Redirect after reset goes to correct login page (guide → guide-login, agency → agency-login, etc.)

### Admin Dashboard
- [ ] Admin can log in
- [ ] Sign-up approval list loads within 5 seconds
- [ ] Verified & Pending tab loads
- [ ] Admin can approve a pending expert — expert receives approval email
- [ ] Admin can reject with a reason — expert receives rejection email
- [ ] Expert trip pending list loads
- [ ] Admin can approve a trip — trip appears on marketplace
- [ ] Analytics section loads without crash
- [ ] Logs section loads

### Booking & Payment
- [ ] Expert trip booking flow reaches Stripe payment page
- [ ] Test payment (Stripe test card) completes
- [ ] Booking confirmation email received by traveler
- [ ] Expert receives booking notification
- [ ] Admin receives booking notification
- [ ] Booking appears in admin bookings list
- [ ] Expert payout record created with 80% amount

### Traveler Request Flow
- [ ] Travel request form submits successfully
- [ ] Traveler receives confirmation with code + PIN
- [ ] Admin sees request in dashboard
- [ ] Admin approves — traveler receives approval email
- [ ] Provider can see and bid on request
- [ ] Traveler can view bids using code + PIN
- [ ] Traveler accepts bid
- [ ] Payment flow completes
- [ ] Traveler and agency receive payment emails

### File Uploads
- [ ] Profile photo upload during signup works
- [ ] Document upload (license) during signup works
- [ ] Expert trip image upload works (check 800px minimum enforced)
- [ ] Uploaded images appear correctly on profile pages

### Mobile
- [ ] Homepage is responsive on mobile
- [ ] Expert listing is usable on mobile
- [ ] Login forms work on mobile
- [ ] Dashboard is navigable on mobile

---

## 20. New Developer Quick Start

### How to Read This Project
1. Read this document fully first
2. Look at `backend/src/server.js` (middleware setup, routes mounting)
3. Look at `frontend-server.js` (how static files are served and API is proxied)
4. Look at `backend/src/config/database.js` (connection pool and startup logic)
5. Look at `backend/src/middleware/auth.js` (JWT — every protected route uses this)
6. Look at `backend/src/utils/zeptomail.js` (email — every notification uses this)
7. Pick ONE feature to trace end-to-end: e.g., follow a guide signup from HTML form → API → DB → email

### First 10 Files to Inspect (in order)
1. `TECHNICAL_HANDOVER.md` — this document
2. `frontend-server.js` — understand the proxy
3. `backend/src/server.js` — understand middleware stack and route mounting
4. `backend/src/middleware/auth.js` — understand JWT
5. `backend/src/config/database.js` — understand DB pool
6. `backend/src/routes/auth.js` — understand signup/login/password reset
7. `backend/src/routes/admin.js` — understand approval workflows
8. `backend/src/utils/zeptomail.js` — understand email
9. `backend/src/utils/cloudStorage.js` — understand file storage
10. `admin-comprehensive.html` — understand the admin interface (lines 1–100 for structure)

### How to Run Locally
```bash
# 1. Clone the project

# 2. Copy and fill environment variables
cp backend/.env.example backend/.env  # (if exists, else copy backend/.env and clear real values)
# Fill: DATABASE_URL, JWT_SECRET, ZEPTOMAIL_API_KEY, STRIPE_SECRET_KEY, etc.

# 3. Install root dependencies
npm install

# 4. Install backend dependencies
cd backend && npm install && cd ..

# 5. Start both servers (two terminal windows)
# Terminal 1:
cd backend && node src/server.js

# Terminal 2:
node frontend-server.js

# 6. Open browser at http://localhost:5000

# 7. For Stripe webhook testing (third terminal):
stripe listen --forward-to localhost:3000/api/payments/webhook
```

### What to Ask the Owner Before Starting
1. **Which dashboard file is "live"** — `guide-dashboard.html` or `expert-dashboard-enhanced.html`? Same question for agencies, dive centers.
2. **The real `JWT_SECRET`** value used in production
3. **The ZeptoMail account login** to check credit balance
4. **The Stripe dashboard access** to verify webhook endpoint and test mode
5. **Which `.html` files are actively used by real users** vs which are old/experimental
6. **The Neon database access** for direct SQL inspection

### What to Fix First
1. ✅ Change `JWT_SECRET` to a real strong secret
2. ✅ Confirm which dashboard files are live and delete the duplicates
3. ✅ Add a `.env.example` file with all required variable names (no values)
4. ✅ Set up ZeptoMail billing alerts
5. ✅ Add `STRIPE_WEBHOOK_SECRET` to production secrets if missing

---

*End of Technical Handover Document*
*This document was generated by inspecting the live codebase — no files were modified.*
