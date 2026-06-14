# 🚀 EMAIL VERIFICATION & PASSWORD RESET TEST GUIDE
**Status: Testing Required**

---

## ❌ PROBLEM: Emails Bouncing

You're receiving "Undelivered Mail Returned to Sender" errors.

**Likely Causes:**
1. ❌ Email addresses being used (@test.com) don't exist - mail server bounces them
2. ❌ Zoho Mail credentials not properly configured
3. ❌ SPF/DKIM records not set up for egtravelmarket.com
4. ❌ Sender address (info@egtravelmarket.com) not verified in Zoho Mail

---

## ✅ SOLUTION: Use Real, Valid Email Addresses

### Option 1: Use Your Personal Email (RECOMMENDED)
1. Register a test account with **your own Gmail** or personal email
2. Test verification → You'll receive the email
3. Click the link to verify
4. Test password reset → Same way

### Option 2: Use Multiple Test Emails
- Gmail: gmail.com (personal account)
- Outlook: outlook.com (free account)
- Yahoo: yahoo.com (free account)

### Option 3: Use Temporary Email Service
- https://tempmail.com (one-time emails)
- https://maildrop.cc (one-time emails)
- https://mailinator.com (one-time emails)

---

## 🧪 COMPLETE EMAIL TEST (All 6 User Types)

### Test 1: EMAIL VERIFICATION (with real email)
```
1. Signup as Customer → Use your real email
2. Check your inbox
3. Should receive: "Welcome to EG Travel Market!"
4. Click "Verify Email Address" button
5. /verify-email page should show success ✅
6. Can now login ✅
```

### Test 2: PASSWORD RESET (with real email)
```
1. Logged in with Customer account
2. Click "Forgot Password"
3. Enter your email
4. Check your inbox
5. Should receive: "Password Reset Request"
6. Click "Reset Password" button
7. Enter new password
8. Should show success ✅
9. Login with new password ✅
```

### Test 3: Repeat for All 6 User Types
- 👤 Customer
- 🗺️ Tour Guide
- 🤿 Diving Instructor
- 🧭 Travel Mentor
- 🏢 Travel Agency
- 🏊 Dive Center

---

## 📋 STEP-BY-STEP: Test With Your Email

### 1. Go to Application
Visit: https://REPLIT_URL

### 2. Sign Up (Customer)
```
Email: your-real-email@gmail.com (or whatever you use)
Password: TestPass123!
Full Name: Your Name
User Type: Customer
```

### 3. Check Email
- Open your email inbox
- Look for email from: info@egtravelmarket.com
- Subject: "Welcome to EG Travel Market!"

### 4. Click Verification Link
- Click the blue "Verify Email Address" button
- Or copy/paste the verification link

### 5. Verify in Browser
- Page should show: ✅ "Email verified successfully!"
- You can now login

### 6. Test Password Reset
```
1. Click "Forgot Password"
2. Enter your email: your-real-email@gmail.com
3. Check inbox for reset email
4. Click reset link
5. Enter new password
6. Success message ✅
7. Login with new password
```

---

## 🔧 IF EMAILS STILL DON'T ARRIVE

### Check #1: Verify Backend Logs
```bash
Look for error messages when email is sent
Check backend console for: "❌ Welcome email send error" or similar
```

### Check #2: Verify Zoho Configuration
```
In backend/.env:
- EMAIL_USER: info@egtravelmarket.com ✅
- EMAIL_PASSWORD: Should be app-specific password from Zoho
- Not: Your regular Zoho password
```

### Check #3: Add SPF & DKIM Records
In your domain registrar (GoDaddy, Namecheap):
```
SPF Record:
v=spf1 include:zoho.com ~all

DKIM Record:
From Zoho Mail settings > Authentication
```

### Check #4: Verify Sender in Zoho
```
In Zoho Mail:
1. Settings → Email Accounts
2. Verify: info@egtravelmarket.com is added
3. Verify MX records are pointing to Zoho
```

---

## 📊 TESTING CHECKLIST

### Basic Test (1 user type)
- [ ] Signup with real email
- [ ] Receive verification email
- [ ] Click link → verify ✅
- [ ] Login works ✅
- [ ] Request password reset
- [ ] Receive reset email
- [ ] Reset password works ✅
- [ ] Login with new password ✅

### Full Test (All 6 types)
- [ ] Customer → email verification ✅
- [ ] Customer → password reset ✅
- [ ] Tour Guide → email verification ✅
- [ ] Tour Guide → password reset ✅
- [ ] Diving Instructor → email verification ✅
- [ ] Diving Instructor → password reset ✅
- [ ] Travel Mentor → email verification ✅
- [ ] Travel Mentor → password reset ✅
- [ ] Travel Agency → email verification ✅
- [ ] Travel Agency → password reset ✅
- [ ] Dive Center → email verification ✅
- [ ] Dive Center → password reset ✅

---

## 🎯 NEXT STEPS

1. **Prepare:** Get a real email address (your Gmail)
2. **Test:** Follow Step-by-Step guide above
3. **Report:** Tell me if:
   - ✅ Email arrives (SUCCESS!)
   - ❌ Email doesn't arrive (we'll debug)
   - ⚠️ Different error

---

## 📞 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| No email in inbox | Check spam folder, wait 2-3 mins |
| "Invalid token" error | Verification link expired (24 hours) |
| Password reset link expired | Link expires after 1 hour |
| Email shows error | Check Zoho Mail configuration |
| Inbox full | Try different email address |

---

## ✅ WHEN TESTING SUCCEEDS

Once emails work for all 6 user types:
1. Update .env with production Zoho credentials
2. Re-deploy to egtravelmarket.com
3. Do final production test
4. Go live! 🚀

---

**Ready to test? Use your real email and let me know the results!**
