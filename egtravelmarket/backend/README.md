# EgyTravelMarket Backend

Node.js + Express + PostgreSQL backend API for the EgyTravelMarket platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database (provided by Replit)
- Environment variables configured

### Installation

```bash
cd backend
npm install
```

### Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "EgyTravelMarket Backend API is running",
  "timestamp": "2025-10-31T21:44:14.005Z"
}
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js       # PostgreSQL connection pool
│   ├── models/
│   │   └── schema.sql        # Database schema definition
│   ├── routes/
│   │   ├── bookings.js       # Booking endpoints
│   │   ├── flashOffers.js    # Flash offer endpoints
│   │   └── contact.js        # Contact form endpoints
│   └── server.js             # Main Express application
├── package.json
├── .env.example
├── API_DOCUMENTATION.md      # Complete API reference
└── README.md                 # This file
```

---

## 🗄️ Database Schema

The backend uses PostgreSQL with the following tables:

### Core Tables
1. **users** - Customer accounts
2. **bookings** - Tour and package reservations
3. **transactions** - Payment records (Stripe integration)
4. **flash_offers** - Promotional deals
5. **contact_submissions** - Contact form inquiries
6. **affiliate_tracking** - Travelpayouts commission tracking

### Indexes
- Email lookups on bookings
- Status filtering
- Date-based queries
- Active offers filtering

---

## 🔌 API Endpoints

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - List all bookings (with filters)
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id/status` - Update booking status

### Flash Offers
- `POST /api/flash-offers` - Create flash offer
- `GET /api/flash-offers` - List active offers
- `PATCH /api/flash-offers/:id` - Update offer
- `DELETE /api/flash-offers/:id` - Delete offer

### Contact
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - List submissions

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete details.

---

## 🌐 Frontend Integration

### 1. Include the API Client

Add to your HTML files:
```html
<script src="/js/api-client.js"></script>
```

### 2. Use the API Client

```javascript
// Example: Create a booking
const bookingData = {
  packageName: "Cairo by Flight",
  guestName: "John Doe",
  guestEmail: "john@example.com",
  adults: 2,
  totalAmount: 299.99
};

apiClient.createBooking(bookingData)
  .then(response => {
    console.log('Success:', response);
    alert('Booking confirmed!');
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Booking failed: ' + error.message);
  });
```

---

## 🔧 Environment Variables

The backend automatically uses Replit's database environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name
- `PORT` - API server port (default: 3000)

---

## 🧪 Testing the API

### Create a Test Booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "packageName": "Cairo Tour",
    "guestName": "Test User",
    "guestEmail": "test@example.com",
    "adults": 2,
    "totalAmount": 199.99
  }'
```

### Get All Bookings

```bash
curl http://localhost:3000/api/bookings
```

### Check Flash Offers

```bash
curl http://localhost:3000/api/flash-offers
```

---

## 📦 Dependencies

- **express** - Web framework
- **pg** - PostgreSQL client
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **body-parser** - Request body parsing

---

## 🔜 Upcoming Features

### Phase 1: Payment Processing
- [ ] Stripe integration for payments
- [ ] Transaction recording
- [ ] Payment status webhooks
- [ ] Receipt generation

### Phase 2: Affiliate Integration
- [ ] Travelpayouts API integration
- [ ] Flight search and pricing
- [ ] Hotel availability
- [ ] Commission tracking

### Phase 3: Authentication
- [ ] User registration and login
- [ ] JWT token authentication
- [ ] Password hashing (bcrypt)
- [ ] Role-based access control

### Phase 4: Notifications
- [ ] Email confirmations (SendGrid/Mailgun)
- [ ] SMS notifications (Twilio)
- [ ] WhatsApp integration
- [ ] Admin dashboard

---

## 🐛 Debugging

### Check if Backend is Running

```bash
curl http://localhost:3000/health
```

### View Database Tables

```sql
\dt
```

### Check Recent Bookings

```sql
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10;
```

### View Logs

Check the Backend API workflow logs in Replit's console.

---

## 🚀 Deployment

The backend is automatically deployed when you publish your Replit project.

### Custom Domain Setup
1. Publish your Replit app
2. Go to Deployments → Settings
3. Add your custom domain: `www.egtravelmarket.com`
4. Update DNS records at your domain registrar
5. Wait for DNS propagation

---

## 📞 Support

For questions or issues:
1. Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
2. Review error logs in Replit console
3. Test individual endpoints with curl
4. Verify database connection

---

## 📝 License

Copyright © 2025 EgyTravelMarket. All rights reserved.
