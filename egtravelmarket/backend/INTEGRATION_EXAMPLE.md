# Frontend Integration Example

This guide shows how to connect your existing booking forms to the backend API.

## Step 1: Include the API Client

Add this script tag to your HTML file (before your custom scripts):

```html
<script src="/js/api-client.js"></script>
```

## Step 2: Update Your Booking Form Handler

### Before (WhatsApp Only):

```javascript
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  
  // Only sends to WhatsApp
  const message = `New Booking:\nName: ${name}\nEmail: ${email}`;
  const whatsappUrl = `https://wa.me/1234567890?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
});
```

### After (Database + WhatsApp):

```javascript
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const bookingData = {
    packageName: "Cairo by Flight",  // Your tour/package name
    guestName: document.getElementById('name').value,
    guestEmail: document.getElementById('email').value,
    guestPhone: document.getElementById('phone')?.value,
    adults: parseInt(document.getElementById('adults')?.value || 1),
    children: parseInt(document.getElementById('children')?.value || 0),
    totalAmount: parseFloat(document.getElementById('total')?.value),
    bookingDate: document.getElementById('date')?.value
  };
  
  try {
    // Save to database
    const response = await apiClient.createBooking(bookingData);
    console.log('Booking saved:', response);
    
    // Show success message
    alert('✅ Booking confirmed! You will receive a confirmation email shortly.');
    
    // Optional: Still send to WhatsApp for instant notification
    const message = `New Booking #${response.booking.id}:\nName: ${bookingData.guestName}\nEmail: ${bookingData.guestEmail}`;
    const whatsappUrl = `https://wa.me/1234567890?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    // Clear form
    bookingForm.reset();
    
  } catch (error) {
    console.error('Booking error:', error);
    alert('❌ Booking failed: ' + error.message);
  }
});
```

## Step 3: Real Example for Cairo by Flight

Here's a complete working example:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Cairo by Flight Booking</title>
  <script src="/js/email-validator.js"></script>
  <script src="/js/api-client.js"></script>
</head>
<body>
  <form id="cairoBookingForm">
    <input type="text" id="name" required placeholder="Full Name">
    <input type="email" id="email" required placeholder="Email">
    <input type="tel" id="phone" placeholder="Phone">
    <input type="number" id="adults" value="1" min="1">
    <input type="number" id="children" value="0" min="0">
    <input type="date" id="date" required>
    <input type="hidden" id="total" value="199.99">
    <button type="submit">Book Now</button>
  </form>
  
  <script>
    const form = document.getElementById('cairoBookingForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validate email first
      const emailInput = document.getElementById('email');
      const error = getEmailError(emailInput.value);
      if (error) {
        alert('Invalid email: ' + error);
        return;
      }
      
      const bookingData = {
        packageName: "Cairo by Flight",
        packageType: "day-tour",
        guestName: document.getElementById('name').value,
        guestEmail: emailInput.value,
        guestPhone: document.getElementById('phone').value,
        adults: parseInt(document.getElementById('adults').value),
        children: parseInt(document.getElementById('children').value),
        totalAmount: parseFloat(document.getElementById('total').value),
        currency: "USD",
        bookingDate: document.getElementById('date').value
      };
      
      try {
        const response = await apiClient.createBooking(bookingData);
        alert('✅ Booking confirmed! Reference #' + response.booking.id);
        form.reset();
      } catch (error) {
        alert('❌ Booking failed: ' + error.message);
      }
    });
  </script>
</body>
</html>
```

## Step 4: Flash Offers Integration

To load flash offers from the database instead of JSON:

```javascript
// Replace flash-offer.js loading logic
(async function loadFlashOffers() {
  try {
    const response = await apiClient.getFlashOffers();
    const offers = response.offers;
    const track = document.querySelector('.flash-track');
    
    if (!track || offers.length === 0) return;
    
    track.innerHTML = '';
    
    offers.forEach(o => {
      const card = document.createElement('article');
      card.className = 'flash-card';
      card.innerHTML = `
        <span class="badge">${o.badge || 'Flash Offer'}</span>
        <h3>${o.title}</h3>
        <p class="desc">${o.description}</p>
        <div class="countdown" data-deadline="${o.deadline}">Ends in —</div>
        <div class="actions">
          <a href="${o.link}" class="btn">Book Now</a>
          <a href="${o.link}#details" class="link">Details</a>
        </div>
      `;
      track.appendChild(card);
    });
    
    initCountdowns();
    initSlider(track);
    
  } catch (err) {
    console.error('Could not load flash offers', err);
  }
})();
```

## Step 5: Contact Form Integration

```javascript
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const contactData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone')?.value,
    subject: document.getElementById('subject')?.value,
    message: document.getElementById('message').value
  };
  
  try {
    const response = await apiClient.submitContactForm(contactData);
    alert('✅ Thank you! We will respond within 24 hours.');
    contactForm.reset();
  } catch (error) {
    alert('❌ Submission failed: ' + error.message);
  }
});
```

## Benefits of Using the Backend API

1. **Data Persistence**: All bookings saved to database
2. **Email Tracking**: Query bookings by customer email
3. **Payment Ready**: Structure ready for Stripe integration
4. **Analytics**: Track booking trends and popular packages
5. **Affiliate Tracking**: Ready for Travelpayouts commission tracking
6. **Admin Access**: View and manage all bookings from dashboard
7. **Backup**: Data survives browser cache clears
8. **Scalability**: Supports thousands of bookings

## Next Steps

1. Update all 16 booking forms to use the API
2. Integrate Stripe for payment processing
3. Add email confirmation using SendGrid
4. Build admin dashboard to view bookings
5. Connect Travelpayouts for flight/hotel data

## Testing the API

Open browser console and test:

```javascript
// Test API connection
apiClient.checkHealth().then(console.log);

// Test creating a booking
apiClient.createBooking({
  packageName: "Test Tour",
  guestName: "Test User",
  guestEmail: "test@example.com"
}).then(console.log);

// View all bookings
apiClient.getBookings().then(console.log);
```

## Need Help?

- Check `backend/API_DOCUMENTATION.md` for complete API reference
- Review `backend/README.md` for setup instructions
- Test endpoints using the browser console
- Check workflow logs for backend errors
