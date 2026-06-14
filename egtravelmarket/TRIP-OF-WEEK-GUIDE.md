# Trip of the Week - Quick Start Guide

## How to Update Weekly

Open `trip-of-the-week.html` and find the **WEEKLY CONFIG** section in the `<script>` tag. Update these settings:

### 1. Basic Trip Info & Prices
```javascript
tripName: "Cairo by Flight",
mainDay: "Tuesday",
isAirTrip: true,           // true for flights, false for land/sea
seats: 20,                 // Available seats for this week
priceAdult: 180,           // Adult price (fixed, user can't change)
priceChild: 160,           // Child price (fixed, user can't change)
```

### 2. Access Codes & Payment
```javascript
accessCodes: ["ETM2025","VIP001","TRIPWEEK"],  // Add/remove codes
paymentUrl: "https://yourpaymentgateway.com/pay-trip-week",
```

### 3. Trip Content
```javascript
summary: "This week only: Free SIM (20GB) + Turkish Bath 15 min.",
heroImg: "https://images.unsplash.com/photo-1544989164-31dc3c645987...",
description: "Fly from Sharm El-Sheikh to Cairo...",
```

### 4. Itinerary (Each Activity Gets Its Own Calendar)
```javascript
itinerary: [
  { day: "Tuesday", title: "Cairo by Flight", notes: "Main trip...", type:"main" },
  { day: "Tuesday", title: "SIM Card 20GB (Free Bonus)", notes: "...", type:"bonus" },
  { day: "Thursday", title: "Turkish Bath...", notes: "...", type:"bonus" }
],
```
**Note:** Each activity will automatically get its own date selector in the booking form!

### 5. Inclusions
```javascript
includes: ["Transportation", "Professional Guide"]
// Note: "Transportation" and "Flight tickets" (for air trips) are auto-added
```

## NEW Features Added

### ✅ Fixed Prices (Read-Only)
- Adult and Child prices are **displayed but NOT editable** by users
- Prices are set weekly in the WEEKLY config
- Users see: "This Week's Prices" with Adult $180, Child $160

### ✅ Infant Field
- Added **Infants (FREE)** dropdown (0-4 infants)
- Age range: 1 day - 2 years
- Infants are FREE and don't add to the total price
- Included in passenger count but not in price calculation

### ✅ Separate Calendars for Each Trip
- **Each itinerary item gets its own date field!**
- Example: Cairo by Flight (date), SIM Card (date), Turkish Bath (date)
- All dates are required before payment

### ✅ Hotel Information
- **Hotel Name** field (required)
- **Room Number** field (required)
- Automatic note: "⚠️ Waiting area will be outside hotel main gate"

### ✅ Booking Summary on Left Side
- After access code verification, **booking summary appears on left side**
- Shows:
  - Number of Adults, Children, Infants
  - All trip dates selected
  - Total amount
- Updates in real-time as user fills the form

### ✅ Removed Features
- ❌ Print/Save Summary button removed (as requested)
- ❌ Price editing removed (prices are fixed)

## How It Works

### 1. User Enters Access Code
- Enter one of: ETM2025, VIP001, or TRIPWEEK
- Click "Verify"

### 2. Form Appears
- Shows fixed prices (Adult $180, Child $160)
- Passenger selection: Adults, Children, Infants (FREE)
- **Separate date picker for each trip activity**
- Hotel Name & Room Number
- Contact info (Name, Phone, Email)
- Special requests

### 3. Booking Summary Shows
- Left side card displays all details
- Real-time updates as user fills form

### 4. Proceed to Payment
- Button enabled only when ALL fields are filled
- Opens payment gateway with all booking details
- Seats automatically reduced

## Example: Complete Weekly Update

```javascript
const WEEKLY = {
  tripName: "Luxor Temple Tour",
  mainDay: "Wednesday",
  isAirTrip: false,
  seats: 15,
  priceAdult: 120,           // NEW: Fixed adult price
  priceChild: 100,           // NEW: Fixed child price
  accessCodes: ["LUXOR2025","VIP002"],
  paymentUrl: "https://yourpaymentgateway.com/pay-trip-week",

  summary: "This week: Free lunch + Museum entry",
  heroImg: "https://images.unsplash.com/photo-luxor-temple...",
  description: "Visit the majestic Luxor Temple...",

  itinerary: [
    { day: "Wednesday", title: "Luxor Temple Tour", notes: "Full day", type:"main" },
    { day: "Wednesday", title: "Lunch (Free)", notes: "Traditional meal", type:"bonus" }
  ],

  includes: ["Lunch", "Museum Entry", "Expert Guide"]
};
```

## Testing Access Codes

Try these codes:
- `ETM2025`
- `VIP001`
- `TRIPWEEK`

## Payment URL Parameters

The system passes these to your payment gateway:
- `trip` - Trip name
- `adults` - Number of adults
- `children` - Number of children  
- `infants` - Number of infants (FREE)
- `priceAdult` - Adult price
- `priceChild` - Child price
- `total` - Total amount (adults × adult_price + children × child_price)
- `hotelName` - Hotel name
- `roomNumber` - Room number
- `phone`, `email`, `name` - Contact details
- `notes` - Special requests
- `date_Cairo_by_Flight` - Date for Cairo trip
- `date_SIM_Card_20GB_Free_Bonus` - Date for SIM card
- `date_Turkish_Bath_Massage_15_min_Free_Bonus` - Date for Turkish Bath
- (Each trip activity gets its own date parameter)

## Important Notes

- **Seats are tracked locally** (per browser)
- **Infants are FREE** and don't add to total
- **All trip dates required** before payment
- **Hotel pickup note** automatically shown
- **Prices are fixed** - set in config, not editable by users

---

**Need help?** The system automatically validates all fields and shows the booking summary in real-time.
