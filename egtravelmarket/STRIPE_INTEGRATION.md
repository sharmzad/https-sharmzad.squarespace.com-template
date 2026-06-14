# Stripe Payment Integration Guide

## Overview
EgyTravelMarket now supports secure payment processing through Stripe. Customers can pay for bookings using credit/debit cards.

## API Endpoints

### 1. Create Booking with Payment
**POST** `/api/bookings/with-payment`

Creates a booking and immediately generates a Stripe checkout session.

**Request Body:**
```json
{
  "packageName": "Pyramids & Sphinx Tour",
  "packageType": "Day Tour",
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+1234567890",
  "guestCountry": "USA",
  "adults": 2,
  "children": 1,
  "totalAmount": 150.00,
  "currency": "USD",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "booking": { ... },
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_..."
}
```

**Usage:**
Redirect customer to `checkoutUrl` to complete payment.

### 2. Get Stripe Publishable Key
**GET** `/api/payments/config`

Returns the Stripe publishable key for frontend integration.

**Response:**
```json
{
  "publishableKey": "pk_live_..."
}
```

### 3. Create Payment Intent
**POST** `/api/payments/create-payment-intent`

Creates a payment intent for custom payment flows.

**Request Body:**
```json
{
  "bookingId": 123,
  "amount": 150.00,
  "currency": "usd"
}
```

### 4. Create Checkout Session
**POST** `/api/payments/create-checkout-session`

Creates a checkout session for an existing booking.

**Request Body:**
```json
{
  "bookingId": 123,
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

### 5. Retrieve Session Details
**GET** `/api/payments/session/:sessionId`

Gets payment session details by session ID.

### 6. Webhook Endpoint
**POST** `/api/payments/webhook`

Receives Stripe webhook events. Configure this in your Stripe dashboard.

**Webhook URL:** `https://your-domain.com/api/payments/webhook`

## Payment Flow

### Simple Flow (Recommended)
1. Customer fills out booking form
2. Frontend calls `POST /api/bookings/with-payment`
3. Backend creates booking and Stripe checkout session
4. Redirect customer to `checkoutUrl` 
5. Customer completes payment on Stripe
6. Stripe webhook updates booking status to "confirmed"
7. Customer redirected to success page

### Custom Flow
1. Create booking: `POST /api/bookings/`
2. Create payment intent: `POST /api/payments/create-payment-intent`
3. Use Stripe Elements in frontend with `clientSecret`
4. Process payment
5. Webhook confirms and updates booking

## Frontend Integration Example

```javascript
// Create booking with payment
async function createBookingWithPayment(bookingData) {
  const response = await fetch('/api/bookings/with-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...bookingData,
      successUrl: `${window.location.origin}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/booking-cancelled`
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Redirect to Stripe checkout
    window.location.href = data.checkoutUrl;
  }
}

// Verify payment on success page
async function verifyPayment(sessionId) {
  const response = await fetch(`/api/payments/session/${sessionId}`);
  const data = await response.json();
  
  if (data.session.paymentStatus === 'paid') {
    // Show success message
    console.log('Payment successful!');
  }
}
```

## Webhook Configuration

**Important:** The webhook endpoint uses raw body parsing and is mounted at `/api/payments/webhook` before JSON parsing middleware. This is required for Stripe signature verification.

### Step 1: Get Webhook Signing Secret
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter webhook URL: `https://your-domain.com/api/payments/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the "Signing secret" (starts with `whsec_`)

### Step 2: Add to Environment Variables
Add the webhook secret to your Replit Secrets (required for production):
- Key: `STRIPE_WEBHOOK_SECRET`
- Value: `whsec_...`

**Note:** Without the webhook secret, signature verification is skipped (not recommended for production). The webhook will still function but won't verify that events are genuinely from Stripe.

## Database Schema Updates

The following columns were added to the `bookings` table:
- `payment_intent_id` - Stores Stripe PaymentIntent ID
- `checkout_session_id` - Stores Stripe Checkout Session ID

## Payment Status Flow

1. **pending** → Initial booking state
2. **paid** → Payment successful (set by webhook)
3. **failed** → Payment failed (set by webhook)

Booking status automatically updates from `pending` to `confirmed` when payment succeeds.

## Testing

### Test Mode
Use Stripe test keys for development:
- Test card: 4242 4242 4242 4242
- Any future expiry date
- Any 3-digit CVC

### Live Mode
When ready for production, replace test keys with live keys in Secrets.

## Security Notes

1. **Never expose secret keys** - Only use publishable key in frontend
2. **Validate webhooks** - Webhook signature verification is automatic
3. **HTTPS required** - Stripe webhooks require HTTPS in production
4. **Amount verification** - Always verify amounts server-side

## Error Handling

All endpoints return consistent error format:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

Common errors:
- 400: Missing required fields or invalid data
- 404: Booking not found
- 500: Server or Stripe API error
