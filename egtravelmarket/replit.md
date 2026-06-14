# EG Travel Market

## Overview
The EG Travel Market project provides a comprehensive platform for the travel industry, featuring a robust authentication and profile management system with reliable transactional email delivery for six distinct user types. It supports secure user flows, professionally branded communications, and tailored profile management. The platform aims to create a seamless environment for diverse travel services, from booking to expert trip management, with significant market potential.

## User Preferences
- All emails are asynchronous (non-blocking)
- Email failures don't block user workflows
- Timestamps use Cairo timezone (Africa/Cairo)
- All templates are professionally designed and responsive
- 29 unique colors applied for visual hierarchy
- Deployment configuration ready for Autoscale
- All security requirements verified
- Production: 5 database connections
- Development: 10 database connections
- Statement timeout: 30 seconds
- Idle timeout: 30 seconds
- All email-sending endpoints should follow this pattern to prevent crashes:
```javascript
try {
  await sendEmail(...);
} catch (emailError) {
  console.error('Email failed:', emailError.message);
  // Continue - email failure ≠ endpoint failure
}
```

## System Architecture
The system emphasizes a modular, resilient architecture with clear separation of frontend and backend concerns.

### UI/UX Decisions
- **Professional Branding:** Consistent branding across all platform elements and emails, utilizing 29 color schemes, gradient headers, and responsive layouts.
- **Profile Management & Display:** Dashboards and public profile pages for Experts, Agencies, and Dive Centers support photo/cover image uploads and display comprehensive user-entered information (pricing, availability, trip types, social links).
- **Listing Displays:** Expert profiles feature "Trips by This Expert," Mentor profiles show "Offers by This Mentor," and Dive Center profiles display packages and custom request options.
- **Global Avatar Style:** Consistent rounded square avatars with `object-position: top center`.

### Technical Implementations
- **Centralized Email Service:** Utilizes a dedicated `zeptomail.js` module for consistent, asynchronous, and robust email delivery with retry and error handling.
- **Consistent Data Handling:** Standardized field names for profile photos and cover images.
- **Database Optimization:** Configured connection pooling and timeouts for both production and development environments.
- **Lightweight User Storage:** Essential user data stored in localStorage for efficiency, with full profiles fetched from the backend.

### Feature Specifications
- **Authentication & Authorization:** Full suite of signup, login, email verification, password reset, and a comprehensive admin certification system for all user types. User access control relies on `users.is_active` for login blocking, while `approval_status` manages business workflows.
- **Transactional Emails:** Supports 12 distinct email types, including user verification, booking confirmations, admin notifications, and payment alerts.
- **User Types:** Supports 6 distinct roles: Customer, Tour Guide, Diving Instructor, Travel Mentor, Travel Agency, and Dive Center, each with tailored signup flows and legal compliance requirements.
- **Legal & Certification Systems:** Robust verification processes for Agencies, Dive Centers, Tour Guides, and Divers, including document uploads, legal confirmations, and location-based compliance rules (e.g., Egyptian vs. International agencies/dive centers). Mentors have a specific role clarification system. Only certified/verified users appear in public listings.
- **Profile Management:** Users can upload and manage profile photos/logos and cover images.
- **Trip Management:** Comprehensive workflows for travel requests, expert trips, and admin management of trip lifecycles. Includes strict image quality enforcement for expert trips.
- **Payments:** Integrated Stripe for secure transaction processing, including payment breakdown emails and specific logic for Agency Traveler Request Payments (20% platform commission, 80% agency payout 7 days post-trip). Payment flow enforces tripId/expertTripId validation: backend rejects requests without a valid trip identifier (400 error), frontend uses 3-tier ID resolution (URL params → sessionStorage → page defaults via `resolveTripId()`), and `stripe-payment-helper.js` is loaded on all 14 booking pages.
- **Public Listings & Search:** Enhanced public listing cards and profiles for Agencies and Dive Centers, featuring advanced search filters for various criteria (e.g., Dive Center Base, Business Type, Locations, Services, Certification Agencies, Languages).

### System Design Choices
- **Modular Backend:** Organized structure for maintainability.
- **Environment Variables:** Secure storage of sensitive credentials.
- **Production Readiness:** Configured for autoscale deployment, security hardening, and dual-server setup.

### Security Hardening
- **Authentication Security:** JWT, bcryptjs, 7-day token expiration.
- **API Protection:** Rate limiting, Helmet.js, XSS sanitization.
- **File Upload Security:** MIME type/extension validation, path traversal prevention, size limits, authentication.
- **Payment Security:** Server-side price calculation, double payment prevention, Stripe webhook signature verification.
- **CORS Security:** Exact domain matching with an allowed list of origins.

### Performance Optimizations
- **UI Performance:** Skeleton loaders, lazy loading images, fixed card heights, and reusable components.
- **API Optimization:** Optimized API responses returning only necessary fields, pagination with "Load More" functionality, and API caching (e.g., expert list responses cached for 5 minutes).
- **Smart Filter Handling:** Efficient data fetching and display for filtered content.
- **Autoscale Cold Start Optimization:**
  - Database pool warmup with retry logic (3 attempts with exponential backoff)
  - Handles both Autoscale AND Neon database cold starts simultaneously
  - Streaming uploads proxy (module loaded at startup, not per-request)
  - Health check endpoints respond immediately before other middleware
  - Production connection timeout: 30s (handles Neon cold start ~5-8s)
  - Statement timeout: 45s for complex queries during cold starts
- **Transfer Size Optimization:**
  - Gzip compression enabled (70-90% reduction for text content)
  - Single-query pattern for list endpoints (reduces DB round trips by 50%)
  - Production CSS/JS caching (1 hour with stale-while-revalidate)
  - Image caching (7 days immutable)
  - Font caching (30 days immutable)

### Cloud Storage (Implemented)
- **Replit Object Storage (Google Cloud Storage):** All file uploads now persist permanently in cloud storage.
  - Files uploaded via multer are automatically sent to GCS after local processing
  - Cloud-stored files served via `/objects/uploads/<filename>` route
  - Legacy `/uploads/` paths still work for backward compatibility
  - `cloudStorage.js` utility module handles upload/download/streaming
  - Fallback: if cloud upload fails, files are served locally (development safety net)
  - Files survive Autoscale redeploys and are globally distributed
  - Important files: `backend/src/utils/cloudStorage.js`, `backend/src/routes/file-upload.js`

### Meta Pixel Tracking (Implemented)
- **Meta Pixel ID:** 1217512659898780
  - Integrated across all 112 HTML pages
  - Tracks page views, signups, searches, leads, and custom events
  - Event helper: `js/meta-pixel-events.js`

## External Dependencies
- **ZeptoMail:** Transactional email service.
- **PostgreSQL/Neon:** Database for data persistence.
- **Stripe:** Payment gateway.
- **Replit Object Storage (GCS):** Persistent file/image storage.
- **Meta Pixel:** Marketing analytics and tracking.