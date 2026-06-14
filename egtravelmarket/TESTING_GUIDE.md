# Refund System Testing Guide

## Overview
This guide helps test the new cancellation policy and refund system for expert trips.

## Policy Summary

### 1-Day Trips
- **Cancelled 48+ hours before**: Traveler gets 50% refund, Platform keeps 50%, Expert gets 0%
- **Cancelled <24 hours before**: Traveler gets 0% refund, Platform gets 50%, Expert gets 50% compensation

### 2+ Day Trips
- **Cancelled before 1 week**: Traveler gets 80% refund, Platform keeps 20%, Expert gets 0%
- **Cancelled <1 week before**: Traveler gets 0% refund, Platform gets 50%, Expert gets 50% compensation

## Testing Steps

### Part 1: Create Test Bookings

1. **1-Day Trip Booking**
   - Go to `/expert-trips-marketplace.html`
   - Find a 1-day trip (duration = "1 day" or "Half day")
   - Click "Book Now"
   - Fill in traveler info
   - Review the cancellation policy displayed on the booking form
   - Complete booking and make payment

2. **2+ Day Trip Booking**
   - Find a trip with duration like "2 days", "3 days", "1 week", etc.
   - Click "Book Now"
   - Fill in traveler info
   - Verify cancellation policy shows different thresholds
   - Complete booking and make payment

### Part 2: Test Refund Processing

**Via Admin Dashboard:**
1. Go to `/admin-comprehensive.html`
2. Click the "💰 Expert Payouts" tab
3. You should see payout records for the bookings just created

**Test 1-Day Trip Refund (48+ hours before trip):**
```bash
curl -X POST http://localhost:3000/api/expert-trips-payments/admin/refund/[BOOKING_ID] \
  -H "Authorization: Bearer [ADMIN_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Traveller requested cancellation"}'
```

Expected Response:
```json
{
  "message": "Refund processed successfully",
  "refundDetails": {
    "tripDuration": "1 day",
    "refundSplit": {
      "travelerRefund": 50,
      "platformFee": 50,
      "expertCompensation": 0
    }
  }
}
```

**Test 2+ Day Trip Refund (before 1 week):**
```bash
curl -X POST http://localhost:3000/api/expert-trips-payments/admin/refund/[BOOKING_ID] \
  -H "Authorization: Bearer [ADMIN_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Traveller requested cancellation"}'
```

Expected Response:
```json
{
  "message": "Refund processed successfully",
  "refundDetails": {
    "tripDuration": "2 days",
    "refundSplit": {
      "travelerRefund": 80,
      "platformFee": 20,
      "expertCompensation": 0
    }
  }
}
```

### Part 3: Verify in Database

```sql
-- Check refunded bookings
SELECT * FROM expert_trip_bookings WHERE booking_status = 'cancelled' AND payment_status = 'refunded';

-- Check expert payouts after refund
SELECT status, amount, notes FROM expert_payouts WHERE booking_id = [BOOKING_ID];
```

### Part 4: Test Edge Cases

1. **Test with Actual Trip Dates**
   - Create booking for trip starting 3 days from now
   - Try refund (should fail if booking only 3 days away on 2+ day trip policy)

2. **Test Multiple Refunds**
   - Create 5 bookings for same trip
   - Process refunds for all
   - Verify payouts table updates correctly

3. **Test with Different Trip Types**
   - Diving trip (2-3 days)
   - Desert safari (1 day)
   - Cultural tour (5 days)
   - Multi-week expedition

## Expected Behavior

✅ **Cancellation policy displays on booking page**
✅ **Policy text changes based on trip duration detected**
✅ **Refund endpoint calculates correct splits**
✅ **Stripe refund processes when traveler refund > 0**
✅ **Expert payout updated or cancelled**
✅ **Transaction recorded in database**

## Troubleshooting

**Issue: Policy not displaying**
- Check browser console for JS errors
- Verify `cancellation-policy.js` is loaded
- Check trip duration format

**Issue: Refund returns 400 error**
- Verify booking ID exists and payment_status = 'paid'
- Check admin token is valid
- Ensure trip_start_date is set correctly

**Issue: Wrong refund amounts**
- Verify trip duration is correctly parsed
- Check current date vs. trip start date calculation
- Review calculateRefundSplit() logic in backend

## Files Modified

- `backend/src/routes/expert-trips-payments.js` - Added refund endpoint
- `backend/src/routes/expert-bank-payouts.js` - Updated payout approval flow
- `expert-trips-marketplace.html` - Added policy display
- `admin-comprehensive.html` - Added refund button (coming soon)
- `cancellation-policy.js` - Helper functions for calculations
