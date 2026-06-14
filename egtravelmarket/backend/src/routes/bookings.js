const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/', async (req, res) => {
  try {
    const {
      packageName,
      packageType,
      tripId,
      expertTripId,
      guestName,
      guestEmail,
      guestPhone,
      guestCountry,
      adults,
      children,
      pickupLocation,
      specialRequests,
      currency,
      bookingDate
    } = req.body;

    if (!guestName || !guestEmail || !packageName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['guestName', 'guestEmail', 'packageName']
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // SECURITY: Calculate price server-side - never trust client-provided amounts
    let calculatedAmount = 0;
    let tripCurrency = currency || 'USD';
    const numAdults = Math.max(1, parseInt(adults) || 1);
    const numChildren = Math.max(0, parseInt(children) || 0);

    if (expertTripId) {
      const tripResult = await pool.query(
        'SELECT price, kids_price, currency FROM expert_trips WHERE id = $1 AND status = $2',
        [expertTripId, 'approved']
      );
      if (tripResult.rows.length > 0) {
        const trip = tripResult.rows[0];
        const adultPrice = parseFloat(trip.price) || 0;
        const childPrice = parseFloat(trip.kids_price) || adultPrice;
        calculatedAmount = (adultPrice * numAdults) + (childPrice * numChildren);
        tripCurrency = trip.currency || 'USD';
      }
    } else if (tripId) {
      const tripResult = await pool.query(
        'SELECT price, adult_price, child_price, currency FROM trips WHERE id = $1 AND is_active = true',
        [tripId]
      );
      if (tripResult.rows.length > 0) {
        const trip = tripResult.rows[0];
        const adultPrice = parseFloat(trip.adult_price) || parseFloat(trip.price) || 0;
        const childPrice = parseFloat(trip.child_price) || adultPrice;
        calculatedAmount = (adultPrice * numAdults) + (childPrice * numChildren);
        tripCurrency = trip.currency || 'USD';
      }
    } else {
      // Fallback: Look up by package name
      const tripResult = await pool.query(
        'SELECT price, adult_price, child_price, currency FROM trips WHERE (title = $1 OR slug = $1) AND is_active = true LIMIT 1',
        [packageName]
      );
      if (tripResult.rows.length > 0) {
        const trip = tripResult.rows[0];
        const adultPrice = parseFloat(trip.adult_price) || parseFloat(trip.price) || 0;
        const childPrice = parseFloat(trip.child_price) || adultPrice;
        calculatedAmount = (adultPrice * numAdults) + (childPrice * numChildren);
        tripCurrency = trip.currency || 'USD';
      }
    }

    // Note: For inquiry-only bookings without payment, amount can be 0
    // Payment will be calculated when payment is initiated

    const result = await pool.query(
      `INSERT INTO bookings 
       (package_name, package_type, guest_name, guest_email, guest_phone, 
        guest_country, adults, children, pickup_location, special_requests, 
        total_amount, currency, booking_date, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        packageName,
        packageType || null,
        guestName,
        guestEmail,
        guestPhone || null,
        guestCountry || null,
        numAdults,
        numChildren,
        pickupLocation || null,
        specialRequests || null,
        calculatedAmount > 0 ? calculatedAmount : null,
        tripCurrency,
        bookingDate || new Date(),
        'pending',
        'pending'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: error.message
    });
  }
});

router.post('/with-payment', async (req, res) => {
  try {
    const {
      packageName,
      packageType,
      tripId,
      expertTripId,
      guestName,
      guestEmail,
      guestPhone,
      guestCountry,
      adults,
      children,
      pickupLocation,
      specialRequests,
      currency,
      bookingDate,
      successUrl,
      cancelUrl
    } = req.body;

    console.log('[BOOKING] Received request:', { tripId, expertTripId, packageName, packageType, adults, children, guestEmail: guestEmail ? '***' : null });

    if (!guestName || !guestEmail || !packageName) {
      console.log('[BOOKING] Rejected: missing required fields', { guestName: !!guestName, guestEmail: !!guestEmail, packageName: !!packageName });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['guestName', 'guestEmail', 'packageName'],
        received: Object.keys(req.body)
      });
    }

    if (!tripId && !expertTripId) {
      console.log('[BOOKING] Rejected: no tripId or expertTripId provided');
      return res.status(400).json({ error: 'Missing trip identifier. Please provide tripId or expertTripId.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let calculatedAmount = 0;
    let tripCurrency = currency || 'USD';
    const numAdults = Math.max(1, parseInt(adults) || 1);
    const numChildren = Math.max(0, parseInt(children) || 0);

    if (expertTripId) {
      const tripResult = await pool.query(
        'SELECT price, kids_price, currency FROM expert_trips WHERE id = $1 AND status = $2',
        [expertTripId, 'approved']
      );
      if (tripResult.rows.length === 0) {
        console.log('[BOOKING] Rejected: expert trip not found', { expertTripId });
        return res.status(400).json({ error: 'Trip not found or not available' });
      }
      const trip = tripResult.rows[0];
      const adultPrice = parseFloat(trip.price) || 0;
      const childPrice = parseFloat(trip.kids_price) || adultPrice;
      calculatedAmount = (adultPrice * numAdults) + (childPrice * numChildren);
      tripCurrency = trip.currency || 'USD';
      console.log('[BOOKING] Expert trip resolved:', { expertTripId, adultPrice, childPrice, calculatedAmount });
    } else if (tripId) {
      const tripResult = await pool.query(
        'SELECT price, adult_price, child_price, currency FROM trips WHERE id = $1 AND is_active = true',
        [tripId]
      );
      if (tripResult.rows.length === 0) {
        console.log('[BOOKING] Rejected: regular trip not found', { tripId });
        return res.status(400).json({ error: 'Trip not found or not available' });
      }
      const trip = tripResult.rows[0];
      const adultPrice = parseFloat(trip.adult_price) || parseFloat(trip.price) || 0;
      const childPrice = parseFloat(trip.child_price) || adultPrice;
      calculatedAmount = (adultPrice * numAdults) + (childPrice * numChildren);
      tripCurrency = trip.currency || 'USD';
      console.log('[BOOKING] Regular trip resolved:', { tripId, adultPrice, childPrice, calculatedAmount });
    }

    if (calculatedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid trip price' });
    }

    console.log(`💰 Server-calculated amount: ${calculatedAmount} ${tripCurrency} (${numAdults} adults, ${numChildren} children)`);

    const bookingResult = await pool.query(
      `INSERT INTO bookings 
       (package_name, package_type, guest_name, guest_email, guest_phone, 
        guest_country, adults, children, pickup_location, special_requests, 
        total_amount, currency, booking_date, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        packageName,
        packageType || null,
        guestName,
        guestEmail,
        guestPhone || null,
        guestCountry || null,
        numAdults,
        numChildren,
        pickupLocation || null,
        specialRequests || null,
        calculatedAmount,
        tripCurrency,
        bookingDate || new Date(),
        'pending',
        'pending'
      ]
    );

    const booking = bookingResult.rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: booking.currency.toLowerCase() || 'usd',
            product_data: {
              name: booking.package_name,
              description: `${booking.adults} adult(s)${booking.children ? `, ${booking.children} child(ren)` : ''}`
            },
            unit_amount: Math.round(parseFloat(booking.total_amount) * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:5000'}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:5000'}/booking-cancelled`,
      customer_email: booking.guest_email,
      metadata: {
        bookingId: booking.id.toString()
      }
    });

    await pool.query(
      'UPDATE bookings SET checkout_session_id = $1, updated_at = NOW() WHERE id = $2',
      [session.id, booking.id]
    );

    console.log('✅ Stripe checkout created:', session.url);
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        ...booking,
        checkout_session_id: session.id
      },
      checkout_url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Error creating booking with payment:', error);
    res.status(500).json({ 
      error: 'Failed to create booking with payment',
      details: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      booking: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking',
      details: error.message
    });
  }
});

router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const result = await pool.query(
      'SELECT id, package_name, package_type, guest_name, adults, children, total_amount, currency, booking_date, status, payment_status, created_at FROM bookings WHERE guest_email = $1 ORDER BY created_at DESC LIMIT 10',
      [email]
    );

    res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows
    });

  } catch (error) {
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      details: error.message
    });
  }
});

module.exports = router;
