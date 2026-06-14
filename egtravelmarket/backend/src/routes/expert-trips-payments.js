const express = require('express');
const pool = require('../config/database');

// Initialize Stripe with platform account
// All payments go to platform account - NO Stripe Connect used
// Manual payout system: Platform collects 100%, Admin releases 80% to experts after 1 week
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

const { verifyToken } = require('../middleware/auth');
const {
  sendBookingConfirmationToTraveler,
  sendBookingNotificationToExpert,
  sendTripApprovalEmail,
  sendTripRejectionEmail
} = require('../utils/expert-trips-email');
const { sendAdminExpertTripBookingNotification } = require('../config/email');

const router = express.Router();

// Helper: Calculate 20% commission
const calculateCommission = (amount) => {
  const commission = parseFloat((amount * 0.2).toFixed(2));
  const expertAmount = parseFloat((amount - commission).toFixed(2));
  return { commission, expertAmount };
};

// Helper: Calculate refund split based on trip duration and cancellation timing
const calculateRefundSplit = (totalAmount, tripDuration, tripStartDate) => {
  const daysUntilTrip = Math.ceil((new Date(tripStartDate) - new Date()) / (24 * 60 * 60 * 1000));
  // Single day trip if it explicitly says "1 day" or "half day" (NOT "2 days", "5 days", etc)
  const isSingleDayTrip = tripDuration && (tripDuration.toLowerCase().includes('1 day') || tripDuration.toLowerCase().includes('half day'));
  
  let refundSplit = {
    travelerRefund: 0,
    platformFee: 0,
    expertCompensation: 0
  };

  if (isSingleDayTrip) {
    // 1-DAY TRIP POLICY
    if (daysUntilTrip >= 2) {
      // 48 hours before or more
      refundSplit.travelerRefund = parseFloat((totalAmount * 0.5).toFixed(2));
      refundSplit.platformFee = parseFloat((totalAmount * 0.5).toFixed(2));
      refundSplit.expertCompensation = 0;
    } else {
      // Less than 24 hours
      refundSplit.travelerRefund = 0;
      refundSplit.platformFee = parseFloat((totalAmount * 0.5).toFixed(2));
      refundSplit.expertCompensation = parseFloat((totalAmount * 0.5).toFixed(2));
    }
  } else {
    // 2+ DAY TRIPS POLICY
    if (daysUntilTrip >= 7) {
      // Before 1 week
      refundSplit.travelerRefund = parseFloat((totalAmount * 0.8).toFixed(2));
      refundSplit.platformFee = parseFloat((totalAmount * 0.2).toFixed(2));
      refundSplit.expertCompensation = 0;
    } else {
      // Less than 1 week
      refundSplit.travelerRefund = 0;
      refundSplit.platformFee = parseFloat((totalAmount * 0.5).toFixed(2));
      refundSplit.expertCompensation = parseFloat((totalAmount * 0.5).toFixed(2));
    }
  }

  return refundSplit;
};

// CREATE Stripe payment intent for booking
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { bookingId, totalAmount, currency = 'USD' } = req.body;

    if (!bookingId || !totalAmount) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Booking ID and total amount are required'
      });
    }

    // Get booking details
    const bookingResult = await pool.query(
      `SELECT etb.*, et.id as trip_id, ep.id as expert_id, u.email, u.full_name
       FROM expert_trip_bookings etb
       JOIN expert_trips et ON etb.trip_id = et.id
       JOIN expert_profiles ep ON et.expert_id = ep.id
       JOIN users u ON et.user_id = u.id
       WHERE etb.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: bookingId.toString(),
        tripId: booking.trip_id.toString(),
        expertId: booking.expert_id.toString(),
      },
      description: `Expert Trip Booking #${bookingId}`
    });

    // Update booking with payment intent
    await pool.query(
      `UPDATE expert_trip_bookings SET payment_intent_id = $1 WHERE id = $2`,
      [paymentIntent.id, bookingId]
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// CONFIRM payment and create payment records
router.post('/confirm-payment', async (req, res) => {
  const client = await pool.connect();

  try {
    const { bookingId, paymentIntentId } = req.body;

    if (!bookingId || !paymentIntentId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Booking ID and payment intent ID are required'
      });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment Not Completed',
        message: 'Payment intent status is ' + paymentIntent.status
      });
    }

    await client.query('BEGIN');

    // Get booking details with expert bank info
    const bookingResult = await client.query(
      `SELECT etb.*, et.id as trip_id, et.title, et.price, ep.id as expert_id, ep.expert_type,
              ep.bank_name, ep.bank_account_holder, ep.payment_setup_complete,
              u.email as expert_email, u.full_name as expert_name
       FROM expert_trip_bookings etb
       JOIN expert_trips et ON etb.trip_id = et.id
       JOIN expert_profiles ep ON et.expert_id = ep.id
       JOIN users u ON et.user_id = u.id
       WHERE etb.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const totalAmount = parseFloat(booking.total_amount);
    const { commission, expertAmount } = calculateCommission(totalAmount);

    // Update booking status
    await client.query(
      `UPDATE expert_trip_bookings 
       SET booking_status = 'confirmed', payment_status = 'paid', updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO expert_trip_payments (
        booking_id, trip_id, expert_id, total_amount, 
        platform_commission, expert_amount, currency, 
        status, payment_method, stripe_payment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        bookingId,
        booking.trip_id,
        booking.expert_id,
        totalAmount,
        commission,
        expertAmount,
        booking.currency,
        'escrow',
        'stripe',
        paymentIntentId
      ]
    );

    // Create payout record for expert (80% of booking)
    await client.query(
      `INSERT INTO expert_payouts (
        expert_id, booking_id, trip_id, amount, currency, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [
        booking.expert_id,
        bookingId,
        booking.trip_id,
        expertAmount,
        booking.currency
      ]
    );

    await client.query('COMMIT');

    // Send confirmation emails (async, don't wait)
    sendBookingConfirmationToTraveler(
      booking.traveler_email,
      booking.traveler_name,
      booking.title || 'Expert Trip',
      bookingId,
      totalAmount
    ).catch(err => console.error('Error sending traveler email:', err));

    sendBookingNotificationToExpert(
      booking.expert_email,
      booking.expert_name,
      booking.title || 'Expert Trip',
      bookingId,
      totalAmount
    ).catch(err => console.error('Error sending expert email:', err));

    // Send admin notification with expert payout details
    sendAdminExpertTripBookingNotification(
      {
        id: bookingId,
        tripTitle: booking.title || 'Expert Trip',
        travelerName: booking.traveler_name,
        travelerEmail: booking.traveler_email
      },
      {
        name: booking.expert_name,
        email: booking.expert_email,
        type: booking.expert_type,
        bankSetupComplete: booking.payment_setup_complete,
        bankName: booking.bank_name,
        bankAccountHolder: booking.bank_account_holder
      },
      {
        totalAmount,
        stripeSessionId: paymentIntentId
      }
    ).catch(err => console.error('Error sending admin notification:', err));

    res.json({
      message: 'Payment confirmed successfully',
      payment: {
        id: paymentResult.rows[0].id,
        totalAmount,
        commission,
        expertAmount,
        status: 'escrow',
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment confirmation error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  } finally {
    client.release();
  }
});

// Stripe webhook for payment events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log('✅ Payment succeeded:', paymentIntent.id);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      console.log('❌ Payment failed:', paymentIntent.id);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// Approve trip and send email
router.post('/approve-trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    // Get trip and expert info
    const tripResult = await pool.query(
      `SELECT et.*, u.email, u.full_name FROM expert_trips et
       JOIN users u ON et.user_id = u.id
       WHERE et.id = $1`,
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];

    // Send approval email
    await sendTripApprovalEmail(trip.email, trip.full_name, trip.title);

    res.json({
      message: 'Trip approved and email sent',
      trip: { id: trip.id, title: trip.title }
    });
  } catch (error) {
    console.error('Error approving trip:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// Reject trip and send email
router.post('/reject-trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { reason } = req.body;

    // Get trip and expert info
    const tripResult = await pool.query(
      `SELECT et.*, u.email, u.full_name FROM expert_trips et
       JOIN users u ON et.user_id = u.id
       WHERE et.id = $1`,
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];

    // Send rejection email
    await sendTripRejectionEmail(trip.email, trip.full_name, trip.title, reason);

    res.json({
      message: 'Trip rejected and email sent',
      trip: { id: trip.id, title: trip.title }
    });
  } catch (error) {
    console.error('Error rejecting trip:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// Confirm payment success (called from success page)
router.post('/confirm-payment-success', async (req, res) => {
  const client = await pool.connect();

  try {
    const { bookingId, sessionId } = req.body;

    if (!bookingId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and session ID are required'
      });
    }

    await client.query('BEGIN');

    // Get booking and trip details with expert bank info
    const bookingResult = await client.query(
      `SELECT etb.*, et.id as trip_id, et.title, et.price, ep.id as expert_id, ep.expert_type,
              ep.bank_name, ep.bank_account_holder, ep.payment_setup_complete, ep.whatsapp,
              u.email as expert_email, u.full_name as expert_name
       FROM expert_trip_bookings etb
       JOIN expert_trips et ON etb.trip_id = et.id
       JOIN expert_profiles ep ON et.expert_id = ep.id
       JOIN users u ON et.user_id = u.id
       WHERE etb.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const totalAmount = parseFloat(booking.total_amount);
    const { commission, expertAmount } = calculateCommission(totalAmount);

    // Update booking status to confirmed
    await client.query(
      `UPDATE expert_trip_bookings SET booking_status = 'confirmed', payment_session_id = $1, updated_at = NOW() WHERE id = $2`,
      [sessionId, bookingId]
    );

    // Create payment record
    await client.query(
      `INSERT INTO expert_trip_payments (
        booking_id, trip_id, expert_id, total_amount, 
        platform_commission, expert_amount, currency, 
        status, payment_method, stripe_payment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING`,
      [
        bookingId,
        booking.trip_id,
        booking.expert_id,
        totalAmount,
        commission,
        expertAmount,
        booking.currency || 'USD',
        'escrow',
        'stripe',
        sessionId
      ]
    );

    // Create payout record for expert (80% of booking)
    await client.query(
      `INSERT INTO expert_payouts (
        expert_id, booking_id, trip_id, amount, currency, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      ON CONFLICT DO NOTHING`,
      [
        booking.expert_id,
        bookingId,
        booking.trip_id,
        expertAmount,
        booking.currency || 'USD'
      ]
    );

    await client.query('COMMIT');

    // Send confirmation emails (async, don't wait)
    await sendBookingConfirmationToTraveler(
      booking.traveler_email,
      booking.traveler_name,
      booking.title || 'Expert Trip',
      bookingId,
      totalAmount
    ).catch(err => console.error('Error sending traveler confirmation email:', err));

    await sendBookingNotificationToExpert(
      booking.expert_email,
      booking.expert_name,
      booking.title || 'Expert Trip',
      bookingId,
      totalAmount
    ).catch(err => console.error('Error sending expert notification email:', err));

    // Send admin notification with expert payout details
    sendAdminExpertTripBookingNotification(
      {
        id: bookingId,
        tripTitle: booking.title || 'Expert Trip',
        travelerName: booking.traveler_name,
        travelerEmail: booking.traveler_email
      },
      {
        name: booking.expert_name,
        email: booking.expert_email,
        type: booking.expert_type,
        bankSetupComplete: booking.payment_setup_complete,
        bankName: booking.bank_name,
        bankAccountHolder: booking.bank_account_holder
      },
      {
        totalAmount,
        stripeSessionId: sessionId
      }
    ).catch(err => console.error('Error sending admin notification:', err));

    res.json({
      success: true,
      message: 'Booking confirmed and emails sent',
      bookingId,
      tripTitle: booking.title,
      totalAmount,
      travelerEmail: booking.traveler_email,
      expertName: booking.expert_name,
      expertEmail: booking.expert_email,
      expertWhatsapp: booking.whatsapp,
      expertType: booking.expert_type
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment success confirmation error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Release payment to expert (after trip completion)
router.post('/release-payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const result = await pool.query(
      `UPDATE expert_trip_payments 
       SET status = 'released', release_date = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'escrow'
       RETURNING *`,
      [paymentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or not in escrow' });
    }

    res.json({
      message: 'Payment released to expert',
      payment: {
        id: result.rows[0].id,
        expertAmount: result.rows[0].expert_amount,
        status: 'released'
      }
    });
  } catch (error) {
    console.error('Payment release error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ADMIN: Process refund with tiered cancellation policy
// POST /api/expert-trips/payments/admin/refund/:payoutId
router.post('/admin/refund/:payoutId', verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { payoutId } = req.params;
    const { reason } = req.body;

    // Verify admin
    const userId = req.user.userId || req.user.id;
    const adminCheck = await client.query(
      `SELECT * FROM users WHERE id = $1 AND user_type = 'admin'`,
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin only' });
    }

    await client.query('BEGIN');

    // Look up bookingId from payoutId
    const payoutResult = await client.query(
      `SELECT booking_id FROM expert_payouts WHERE id = $1`,
      [payoutId]
    );

    if (payoutResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payout not found' });
    }

    const bookingId = payoutResult.rows[0].booking_id;

    // Get booking & trip details
    const bookingResult = await client.query(
      `SELECT etb.*, et.id as trip_id, et.price, et.duration, et.start_date as trip_start_date, ep.id as expert_id, 
              u.email as traveler_email, u.full_name as traveler_name
       FROM expert_trip_bookings etb
       JOIN expert_trips et ON etb.trip_id = et.id
       JOIN expert_profiles ep ON et.expert_id = ep.id
       JOIN users u ON etb.user_id = u.id
       WHERE etb.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const totalAmount = parseFloat(booking.total_amount);
    const tripStartDate = booking.trip_start_date;

    // Calculate refund split
    const refundSplit = calculateRefundSplit(totalAmount, booking.duration, tripStartDate);

    // Process Stripe refund to traveler
    if (refundSplit.travelerRefund > 0) {
      try {
        const payment = await pool.query(
          `SELECT stripe_payment_id FROM expert_trip_payments WHERE booking_id = $1 LIMIT 1`,
          [bookingId]
        );

        if (payment.rows.length > 0 && payment.rows[0].stripe_payment_id) {
          await stripe.refunds.create({
            payment_intent: payment.rows[0].stripe_payment_id,
            amount: Math.round(refundSplit.travelerRefund * 100),
            reason: 'cancellation'
          });
        }
      } catch (stripeErr) {
        console.error('Stripe refund error:', stripeErr);
      }
    }

    // Update booking status
    await client.query(
      `UPDATE expert_trip_bookings 
       SET booking_status = 'cancelled', payment_status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    // Handle expert payout
    if (refundSplit.expertCompensation > 0) {
      // Create/update expert payout with compensation amount
      await client.query(
        `INSERT INTO expert_payouts (expert_id, booking_id, trip_id, amount, currency, status, notes)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         ON CONFLICT DO NOTHING`,
        [
          booking.expert_id,
          bookingId,
          booking.trip_id,
          refundSplit.expertCompensation,
          booking.currency || 'USD',
          `Cancellation compensation: ${reason || 'No reason provided'}`
        ]
      );
    } else {
      // Cancel expert payout
      await client.query(
        `UPDATE expert_payouts SET status = 'cancelled', notes = $1 WHERE booking_id = $2`,
        [`Cancelled due to: ${reason || 'No reason'}`, bookingId]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: 'Refund processed successfully',
      refundDetails: {
        bookingId,
        totalAmount,
        tripDuration: booking.duration,
        refundSplit,
        travelerRefundProcessed: refundSplit.travelerRefund > 0,
        expertCompensation: refundSplit.expertCompensation,
        platformRetained: refundSplit.platformFee
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refund processing error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
