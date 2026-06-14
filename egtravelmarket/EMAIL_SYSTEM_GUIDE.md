# Email System Guide - Payment Confirmations

## 📧 Complete Payment Flow (With Automatic Emails!)

Here's what happens when a customer pays for a booking:

### Step-by-Step Process:

**1. Customer fills booking form** → Enters tour details, guest information

**2. System creates booking** → Status: "pending", Payment: "pending"

**3. Stripe checkout page opens** → Customer enters credit card

**4. Customer completes payment** → Stripe processes the transaction

**5. Stripe webhook fires** → Sends payment confirmation to your server

**6. System updates booking** → Status: "confirmed", Payment: "paid" ✅

**7. TWO EMAILS SENT AUTOMATICALLY:**
   - ✉️ **Customer Confirmation Email** → Beautiful booking confirmation
   - ✉️ **Admin Notification Email** → Alert to info@egytravelmarket.com

**8. Customer sees success page** → Can close browser

---

## ✨ Customer Confirmation Email

**Sent to:** Guest's email address  
**Subject:** `Booking Confirmed: [Package Name] - EgyTravelMarket`

### What the Customer Sees:

```
┌────────────────────────────────────────────┐
│   🎉 Booking Confirmed!                    │
│   Your Egyptian adventure awaits           │
├────────────────────────────────────────────┤
│                                            │
│         ✓ Payment Successful               │
│                                            │
├────────────────────────────────────────────┤
│  BOOKING DETAILS                           │
│                                            │
│  Booking ID:        #123                   │
│  Package:           Pyramids & Sphinx Tour │
│  Guest Name:        John Doe               │
│  Travelers:         2 Adults, 1 Child      │
│  Date:              Monday, Dec 25, 2025   │
│  Pickup Location:   Hotel Cairo            │
│                                            │
│  Total Paid:        USD 150.00 ✓           │
│                                            │
│  Special Requests: Vegetarian meals        │
│                                            │
├────────────────────────────────────────────┤
│  📋 WHAT HAPPENS NEXT?                     │
│                                            │
│  1. Detailed itinerary within 24 hours     │
│  2. We'll contact you 48h before trip      │
│  3. Arrive 15 min early at pickup          │
│  4. Keep this email for reference          │
│                                            │
├────────────────────────────────────────────┤
│  NEED HELP?                                │
│                                            │
│  📧 Email: info@egtravelmarket.com         │
│  📱 WhatsApp: +20 123 456 7890             │
│                                            │
└────────────────────────────────────────────┘
```

**Design Features:**
- ✅ Blue gradient header matching your brand (#0066cc)
- ✅ Professional layout with clear sections
- ✅ Mobile-friendly responsive design
- ✅ Payment status badge in green
- ✅ All booking details clearly displayed
- ✅ Next steps guide for the customer
- ✅ Contact information for support

---

## 🔔 Admin Notification Email

**Sent to:** info@egtravelmarket.com  
**Subject:** `🔔 New Paid Booking #123: Pyramids & Sphinx Tour`

### What You (Admin) See:

```
┌────────────────────────────────────────────┐
│   💰 New Paid Booking!                     │
│   Booking #123                             │
├────────────────────────────────────────────┤
│                                            │
│  ✓ Payment Status: PAID                    │
│                                            │
├────────────────────────────────────────────┤
│  BOOKING DETAILS                           │
│                                            │
│  Booking ID:  #123                         │
│  Package:     Pyramids & Sphinx Tour       │
│  Amount:      USD 150.00                   │
│                                            │
├────────────────────────────────────────────┤
│  CUSTOMER INFORMATION                      │
│                                            │
│  Name:        John Doe                     │
│  Email:       john@example.com             │
│  Phone:       +1 234 567 8900              │
│  Country:     USA                          │
│  Travelers:   2 Adults, 1 Child            │
│  Travel Date: Monday, December 25, 2025    │
│  Pickup:      Hotel Cairo                  │
│                                            │
│  Special Requests:                         │
│  Vegetarian meals for all travelers        │
│                                            │
├────────────────────────────────────────────┤
│  Payment ID: cs_live_abc123...             │
│  Booked on: Nov 7, 2025, 5:30 PM Cairo     │
└────────────────────────────────────────────┘
```

**Design Features:**
- ✅ Green header showing paid status
- ✅ All customer contact details
- ✅ Special requests highlighted
- ✅ Payment reference for records
- ✅ Easy to forward to tour operators

---

## 🎨 How to Customize the Emails

### Update Contact Information

**File:** `backend/src/config/email.js`

**Change WhatsApp Number:**
```javascript
// Line 247 (Customer Email)
📱 WhatsApp: <a href="https://wa.me/YOUR_NUMBER">+20 YOUR NUMBER</a>

// Example:
📱 WhatsApp: <a href="https://wa.me/201234567890">+20 123 456 7890</a>
```

**Change Admin Email:**
```javascript
// Line 329 (Admin Email Function)
const adminEmail = 'info@egtravelmarket.com'; // Change this to your email
```

### Update Brand Colors

**Change Header Color:**
```javascript
// Line 116 (Customer Email)
background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);

// Current: Blue gradient (#0066cc to #004999)
// Example: Green gradient: #28a745 to #20c997
```

**Change Accent Color:**
```javascript
// Line 138 - Border color
border-bottom: 2px solid #YOUR_COLOR;
```

### Update "What Happens Next" Section

```javascript
// Lines 227-235 (Customer Email)
<ol style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
  <li>Your custom step 1</li>
  <li>Your custom step 2</li>
  <li>Your custom step 3</li>
  <li>Your custom step 4</li>
</ol>
```

### Add Your Logo

```javascript
// Add after line 115 (Header section)
<tr>
  <td style="background: #ffffff; padding: 20px; text-align: center;">
    <img src="https://your-domain.com/logo.png" alt="EgyTravelMarket" style="max-width: 200px;"/>
  </td>
</tr>
```

---

## ⚙️ Setup Email Credentials

To actually **send emails** (not just log them), you need to add your email credentials:

### Option 1: Gmail (Easiest for Testing)

1. **Create App Password** (if using Gmail):
   - Go to Google Account → Security
   - Enable 2-Step Verification
   - Go to App Passwords
   - Create new app password for "Mail"

2. **Add to Replit Secrets:**
   - `EMAIL_USER` = your-email@gmail.com
   - `EMAIL_PASSWORD` = your-app-password (16 characters)

3. **Update email config** in `backend/src/config/email.js`:
```javascript
// Line 13-21
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',    // Change from Zoho
  port: 587,                  // Gmail uses 587
  secure: false,              // false for port 587
  auth: {
    user: emailUser,
    pass: emailPassword
  }
});
```

### Option 2: Zoho Mail (Current Setup)

1. **Add to Replit Secrets:**
   - `EMAIL_USER` = your-email@egtravelmarket.com
   - `EMAIL_PASSWORD` = your-zoho-password

2. Config is already set for Zoho (port 465, secure: true)

### Option 3: Other Email Providers

**SendGrid, Mailgun, AWS SES, etc.** - Update SMTP settings in `email.js`

---

## 🧪 Testing Emails Without Sending

**Current behavior:**  
If `EMAIL_USER` and `EMAIL_PASSWORD` are not configured, emails are **logged to console** instead of being sent.

**Check the logs:**
```
📧 Booking confirmation email would be sent to: john@example.com
Subject: Booking Confirmed: Pyramids Tour
Booking ID: 123
```

**Test a payment to see logs:**
1. Make a test booking
2. Check backend logs for email output
3. Verify all details appear correctly

---

## 📱 Email Design Preview

### Desktop View (600px width):
- Professional table-based layout
- Gradient headers
- Clear sections with borders
- Responsive buttons

### Mobile View:
- Automatically stacks content
- Full-width tables
- Readable font sizes
- Touch-friendly links

---

## 🚨 Important Notes

1. **Emails only send AFTER payment succeeds** (via webhook)
2. **Failed payments do NOT send emails** (by design)
3. **Email failures won't stop the booking** (non-blocking)
4. **Emails are logged even if sending fails** (for debugging)
5. **Both emails sent in parallel** (customer + admin)

---

## 🛠 Advanced Customization

### Add Attachment (PDF Itinerary)

```javascript
const emailContent = {
  from: '...',
  to: '...',
  subject: '...',
  html: '...',
  attachments: [
    {
      filename: 'itinerary.pdf',
      path: './pdfs/itinerary.pdf'
    }
  ]
};
```

### Send to Multiple Admins

```javascript
// Line 329
const adminEmail = 'info@egtravelmarket.com, manager@egtravelmarket.com, tours@egtravelmarket.com';
```

### Add CC/BCC

```javascript
const emailContent = {
  from: '...',
  to: booking.guest_email,
  cc: 'sales@egtravelmarket.com',
  bcc: 'archive@egtravelmarket.com',
  subject: '...',
  html: '...'
};
```

---

## 📊 Email Statistics

Want to track email opens, clicks, and deliverability?

**Recommended Services:**
- SendGrid (free tier: 100 emails/day)
- Mailgun (free tier: 5,000 emails/month)
- AWS SES (very cheap, requires setup)

These provide analytics dashboards showing:
- Email delivery rate
- Open rate
- Click-through rate
- Bounce/spam reports

---

## ✅ Quick Checklist

- [ ] Update WhatsApp number in customer email
- [ ] Update admin email address if needed
- [ ] Test brand colors match your website
- [ ] Customize "What Happens Next" section
- [ ] Add email credentials to Replit Secrets
- [ ] Test with a real booking
- [ ] Check emails in spam folder first time
- [ ] Save email templates for reference

---

## 🎯 Summary

**What works now:**
✅ Automatic emails after successful payment  
✅ Beautiful HTML design matching your brand  
✅ Customer confirmation with all details  
✅ Admin notification with contact info  
✅ Error handling (emails won't break bookings)  
✅ Console logging for testing  

**What you need to do:**
1. Add email credentials (EMAIL_USER, EMAIL_PASSWORD)
2. Customize contact details (WhatsApp, email)
3. Test with a real booking
4. Optionally customize colors/content

**Questions?**  
Check the email logs or test a booking to see how it works!
