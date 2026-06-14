# EgyTravelMarket Backend API Documentation

## Base URL
- **Development**: `http://localhost:3000`
- **Production**: Your Replit deployment URL

## Authentication
Currently, the API does not require authentication. This will be added in future updates with Stripe integration.

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the API is running.

**Response:**
```json
{
  "status": "healthy",
  "message": "EgyTravelMarket Backend API is running",
  "timestamp": "2025-10-31T21:44:14.005Z"
}
```

---

### 2. Bookings

#### Create a Booking

**POST** `/api/bookings`

Create a new booking for a tour or package.

**Request Body:**
```json
{
  "packageName": "Cairo by Flight",
  "packageType": "day-tour",
  "guestName": "John Smith",
  "guestEmail": "john@example.com",
  "guestPhone": "+1234567890",
  "guestCountry": "United States",
  "adults": 2,
  "children": 1,
  "pickupLocation": "Cairo Hotel",
  "specialRequests": "Vegetarian meals",
  "totalAmount": 299.99,
  "currency": "USD",
  "bookingDate": "2025-12-15"
}
```

**Required Fields:**
- `packageName` (string)
- `guestName` (string)
- `guestEmail` (string)

**Response:**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "booking": {
    "id": 1,
    "package_name": "Cairo by Flight",
    "guest_name": "John Smith",
    "guest_email": "john@example.com",
    "status": "pending",
    "payment_status": "pending",
    "created_at": "2025-10-31T21:50:00.000Z"
  }
}
```

---

#### Get All Bookings

**GET** `/api/bookings`

Retrieve bookings with optional filters.

**Query Parameters:**
- `email` (string, optional): Filter by guest email
- `status` (string, optional): Filter by booking status (pending, confirmed, cancelled)
- `limit` (number, optional): Maximum number of results (default: 50)

**Example:**
```
GET /api/bookings?email=john@example.com&status=pending
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "bookings": [...]
}
```

---

#### Get Single Booking

**GET** `/api/bookings/:id`

Retrieve a specific booking by ID.

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": 1,
    "package_name": "Cairo by Flight",
    ...
  }
}
```

---

#### Update Booking Status

**PATCH** `/api/bookings/:id/status`

Update the status of a booking.

**Request Body:**
```json
{
  "status": "confirmed",
  "paymentStatus": "completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking updated successfully",
  "booking": {...}
}
```

---

### 3. Flash Offers

#### Create Flash Offer

**POST** `/api/flash-offers`

Create a new flash offer.

**Request Body:**
```json
{
  "badge": "Ends Soon",
  "title": "Cairo Adventure - 30% Off",
  "description": "Limited time offer for Cairo day tours",
  "link": "cairo-by-flight.html",
  "deadline": "2025-12-31T23:59:59Z",
  "discountPercentage": 30
}
```

**Required Fields:**
- `title` (string)
- `deadline` (ISO 8601 timestamp)

**Response:**
```json
{
  "success": true,
  "message": "Flash offer created successfully",
  "offer": {...}
}
```

---

#### Get Flash Offers

**GET** `/api/flash-offers`

Retrieve all flash offers.

**Query Parameters:**
- `active` (boolean, default: true): Show only active offers with future deadlines

**Response:**
```json
{
  "success": true,
  "count": 3,
  "offers": [...]
}
```

---

#### Update Flash Offer

**PATCH** `/api/flash-offers/:id`

Update an existing flash offer.

**Request Body:**
```json
{
  "title": "Updated Title",
  "isActive": false
}
```

---

#### Delete Flash Offer

**DELETE** `/api/flash-offers/:id`

Delete a flash offer.

**Response:**
```json
{
  "success": true,
  "message": "Flash offer deleted successfully",
  "offer": {...}
}
```

---

### 4. Contact Submissions

#### Submit Contact Form

**POST** `/api/contact`

Submit a contact form inquiry.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "subject": "General Inquiry",
  "message": "I would like to know more about your packages."
}
```

**Required Fields:**
- `name` (string)
- `email` (string)
- `message` (string)

**Response:**
```json
{
  "success": true,
  "message": "Contact submission received successfully",
  "submission": {...}
}
```

---

#### Get Contact Submissions

**GET** `/api/contact`

Retrieve contact form submissions.

**Query Parameters:**
- `status` (string, optional): Filter by status (new, read, replied)
- `limit` (number, optional): Maximum results (default: 50)

---

## Database Schema

### Tables

1. **users**: Customer accounts
2. **bookings**: Tour and package reservations
3. **transactions**: Payment records (prepared for Stripe)
4. **flash_offers**: Promotional deals
5. **contact_submissions**: Contact form entries
6. **affiliate_tracking**: Travelpayouts integration data

### Booking Statuses
- `pending`: Awaiting confirmation
- `confirmed`: Booking confirmed
- `completed`: Tour completed
- `cancelled`: Booking cancelled

### Payment Statuses
- `pending`: Payment not received
- `processing`: Payment being processed
- `completed`: Payment successful
- `failed`: Payment failed
- `refunded`: Payment refunded

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error title",
  "message": "Detailed error message",
  "details": "Additional information"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `404`: Not Found
- `500`: Internal Server Error

---

## Frontend Integration

Include the API client in your HTML:

```html
<script src="js/api-client.js"></script>
```

### Example: Create a Booking

```javascript
const bookingData = {
  packageName: "Cairo by Flight",
  guestName: document.getElementById('name').value,
  guestEmail: document.getElementById('email').value,
  adults: 2
};

apiClient.createBooking(bookingData)
  .then(response => {
    console.log('Booking created:', response);
    alert('Booking successful! Confirmation sent to your email.');
  })
  .catch(error => {
    console.error('Booking failed:', error);
    alert('Booking failed: ' + error.message);
  });
```

### Example: Load Flash Offers

```javascript
apiClient.getFlashOffers()
  .then(response => {
    console.log('Flash offers:', response.offers);
    // Display offers in your UI
  })
  .catch(error => {
    console.error('Failed to load offers:', error);
  });
```

---

## Next Steps (Coming Soon)

1. **Stripe Payment Integration**
   - Payment processing endpoints
   - Secure checkout flow
   - Transaction tracking

2. **Travelpayouts API Integration**
   - Flight search and booking
   - Hotel availability
   - Commission tracking

3. **User Authentication**
   - Login/register endpoints
   - JWT token authentication
   - User profile management

4. **Email Notifications**
   - Booking confirmations
   - Payment receipts
   - Promotional emails

---

## Support

For API support, contact the development team or check the project repository.
