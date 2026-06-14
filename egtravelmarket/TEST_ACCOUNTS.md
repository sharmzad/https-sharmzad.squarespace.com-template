# Test Accounts for EgyTravelMarket

## ✅ VERIFIED WORKING TEST ACCOUNTS

### Expert Account (Guide)
**Email:** testguide@test.com  
**Password:** expert123  
**User Type:** Guide  
**Status:** Approved & Active  
**Login Page:** /guide-login.html  

**Expert Profile:**
- Display Name: Ahmed - Expert Guide
- Profile URL: /guide/ahmed-expert-guide-1763410925505

**After logging in, you can:**
1. View your dashboard at `/expert-dashboard-enhanced.html?type=guide`
2. Click the "Traveler Requests 🎯" tab to see all travel requests
3. Filter requests by category, location, date range, and budget
4. Send personalized offers to travelers
5. Browse and apply for jobs in the marketplace
6. Edit your expert profile

### Admin Account
**Email:** admin@test.com  
**Password:** admin123  
**User Type:** Admin  
**Status:** Approved & Active  
**Login Page:** /admin-login.html

**After logging in, you can:**
- Access the admin dashboard at /admin-travel-requests.html
- Monitor ALL travel requests and bids across the platform
- View complete statistics and traveler information (PII)
- Admin users CANNOT browse or bid on requests (separate role)

## Testing the Travel Request Feature

### As a Traveler (No Login Required)
1. Go to /travel-request.html
2. Fill out the form and submit
3. You'll receive a code and PIN via email
4. Use /travel-request-view.html to view your request and manage it
5. You can close or cancel your request using code+PIN

### As a Public Visitor (Browse Requests)
1. Go to /travel-requests-browse.html
2. You can now SEE all open travel requests without logging in
3. Use the filters to find specific requests (category, location, date, budget)
4. To send offers, you must click "Login to Offer" button

### As an Expert (After Login)
1. Login at /guide-login.html (or /diver-login.html, /mentor-login.html, /agency-login.html, /divecenter-login.html)
2. Go to /travel-requests-browse.html
3. Browse all open requests with advanced filters
4. Click "Send Offer" to bid on requests
5. Edit or delete your own bids
6. Travelers receive email notifications for new bids

### As an Admin (After Login)
1. Login at /admin-login.html
2. Go to /admin-travel-requests.html
3. View ALL requests and bids in one place
4. Monitor platform activity and statistics

## Security Features
- Rate limiting: Max 5 status update attempts per 15 minutes per IP+code
- Code+PIN authentication for travelers (no account needed)
- XSS protection on all user inputs
- Admin/Expert role separation
- Bid ownership verification for edits/deletes
