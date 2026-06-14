---
name: Admin signup approval query performance
description: Why admin sign-up approval was slow and how it was fixed
---

Three endpoints were doing full-table scans on `users` with 4-table LEFT JOINs and no LIMIT:
- `GET /api/admin/pending-signups` (admin.js)
- `GET /api/admin/sign-ups/verified-pending` (admin.js)
- `GET /api/admin/sign-ups/pending` (adminEnhanced.js)

**Fixes applied:**
1. Added `WHERE user_type IN ('guide','diver','mentor','agency','divecenter')` to exclude customers from all three
2. Added `AND email_verified = false` to the `sign-ups/pending` endpoint (unverified users only)
3. Added `LIMIT 200–300` to cap result size
4. Added `COUNT(*) OVER()` window function for accurate totals without a second query
5. Created DB indexes at startup via `ensureIndexes()` in `database.js`: `approval_status`, `email_verified`, `user_type`, `created_at DESC`, composite `(approval_status, email_verified)`

**Why:** Without the WHERE filter, all approved/rejected users from the entire platform history were JOINed into every admin page load.

**How to apply:** Any new admin list endpoint touching `users` must include a `user_type` or `approval_status` filter and a `LIMIT`.
