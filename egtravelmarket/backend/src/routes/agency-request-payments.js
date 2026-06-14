const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { 
  sendAgencyRequestPaymentConfirmation,
  sendAgencyRequestPaymentNotificationToAgency,
  sendAgencyRequestPaymentNotificationToAdmin
} = require('../config/email');

const PLATFORM_FEE_PERCENT = 20;

router.post('/:offerId/pay', async (req, res) => {
  try {
    const offerId = parseInt(req.params.offerId, 10);
    const { code, pin, successUrl, cancelUrl } = req.body;

    if (!code || !pin) {
      return res.status(400).json({ success: false, message: 'Code and PIN required' });
    }

    const requestCheck = await pool.query(
      'SELECT * FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid code or PIN' });
    }

    const request = requestCheck.rows[0];

    // Validate that this offer is the accepted offer for this request
    if (request.accepted_offer_id !== offerId) {
      return res.status(400).json({ success: false, message: 'This offer is not the accepted offer for this request' });
    }

    // Validate final_price is set
    if (!request.final_price || parseFloat(request.final_price) <= 0) {
      return res.status(400).json({ success: false, message: 'Final price not set for this request' });
    }

    const offerCheck = await pool.query(
      'SELECT * FROM guest_request_bids WHERE id = $1 AND request_id = $2',
      [offerId, request.id]
    );

    if (offerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const offer = offerCheck.rows[0];

    if (offer.status !== 'accepted') {
      return res.status(400).json({ success: false, message: 'Offer must be accepted before payment' });
    }

    // Check provider_type from offer (expert_type in DB)
    // ALL provider types now support payment: agency, dive_center, guide, diver, mentor, admin
    const payableProviderTypes = ['agency', 'dive_center', 'divecenter', 'guide', 'diver', 'mentor', 'admin'];
    if (!payableProviderTypes.includes(offer.expert_type)) {
      return res.status(400).json({ success: false, message: 'Payment not available for this provider type' });
    }

    const existingPaidOrder = await pool.query(
      'SELECT * FROM traveler_request_orders WHERE offer_id = $1 AND payment_status IN ($2, $3)',
      [offerId, 'paid', 'released']
    );

    if (existingPaidOrder.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'This offer has already been paid' });
    }

    // Check for existing pending order and reuse its Stripe session
    const existingPendingOrder = await pool.query(
      'SELECT * FROM traveler_request_orders WHERE offer_id = $1 AND payment_status = $2 ORDER BY created_at DESC LIMIT 1',
      [offerId, 'pending']
    );

    if (existingPendingOrder.rows.length > 0 && existingPendingOrder.rows[0].stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingPendingOrder.rows[0].stripe_session_id);
        
        // Session still open - reuse it
        if (existingSession.status === 'open') {
          console.log(`✅ Reusing existing Stripe session ${existingSession.id} for order ${existingPendingOrder.rows[0].id}`);
          return res.json({
            success: true,
            sessionId: existingSession.id,
            url: existingSession.url,
            orderId: existingPendingOrder.rows[0].id
          });
        }
        
        // Session completed - payment is processing, don't create new session
        if (existingSession.status === 'complete' || existingSession.payment_status === 'paid') {
          console.log(`⏳ Payment for order ${existingPendingOrder.rows[0].id} is being processed`);
          return res.json({
            success: true,
            processing: true,
            message: 'Payment is being processed. Please refresh the page in a few seconds.',
            orderId: existingPendingOrder.rows[0].id
          });
        }
      } catch (sessionErr) {
        console.log(`Existing session expired or invalid, creating new one: ${sessionErr.message}`);
      }
    }

    // MANDATORY: Use final_price from guest_requests as the Stripe amount
    const grossAmount = parseFloat(request.final_price);
    const platformFee = (grossAmount * PLATFORM_FEE_PERCENT) / 100;
    const providerAmount = grossAmount - platformFee;
    const currency = (offer.currency || 'USD').toUpperCase();

    console.log(`💰 Payment amount from final_price: ${grossAmount} ${currency} (platform: ${platformFee}, provider: ${providerAmount})`);

    let tripDate = null;
    let releaseDate = null;
    
    if (request.travel_date) {
      tripDate = request.travel_date;
      const releaseDateObj = new Date(request.travel_date);
      releaseDateObj.setDate(releaseDateObj.getDate() + 7);
      releaseDate = releaseDateObj.toISOString().split('T')[0];
    }

    const orderResult = await pool.query(
      `INSERT INTO traveler_request_orders 
        (request_id, offer_id, provider_id, provider_type, traveler_email, 
         gross_amount, platform_fee, provider_amount, currency, payment_status, trip_date, release_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [request.id, offerId, offer.expert_id, 'agency', request.email,
       grossAmount, platformFee, providerAmount, currency, 'pending', tripDate, releaseDate]
    );

    const orderId = orderResult.rows[0].id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Travel Request: ${request.title || 'Custom Trip'}`,
              description: `Offer from ${offer.expert_name} - Request #${request.code}`
            },
            unit_amount: Math.round(grossAmount * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/travel-request-view.html?payment=success&code=${request.code}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/travel-request-view.html?payment=cancelled&code=${request.code}`,
      customer_email: request.email,
      client_reference_id: orderId.toString(),
      metadata: {
        orderId: orderId.toString(),
        requestId: request.id.toString(),
        offerId: offerId.toString(),
        type: 'agency_traveler_request'
      }
    });

    await pool.query(
      'UPDATE traveler_request_orders SET stripe_session_id = $1, updated_at = NOW() WHERE id = $2',
      [session.id, orderId]
    );

    console.log(`✅ Created Stripe session ${session.id} for order ${orderId}`);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      orderId: orderId
    });

  } catch (error) {
    console.error('Error creating agency request payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment session',
      error: error.message
    });
  }
});

router.get('/order/:orderId/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const { code, pin } = req.query;

    if (!code || !pin) {
      return res.status(400).json({ success: false, message: 'Code and PIN required' });
    }

    const requestCheck = await pool.query(
      'SELECT id FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid code or PIN' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM traveler_request_orders WHERE id = $1 AND request_id = $2',
      [orderId, requestCheck.rows[0].id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    res.json({
      success: true,
      order: {
        id: order.id,
        paymentStatus: order.payment_status,
        grossAmount: order.gross_amount,
        currency: order.currency,
        paidAt: order.paid_at,
        tripDate: order.trip_date,
        releaseDate: order.release_date
      }
    });

  } catch (error) {
    console.error('Error getting order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/offer/:offerId/payment-status', async (req, res) => {
  try {
    const offerId = parseInt(req.params.offerId, 10);
    const { code, pin } = req.query;

    if (!code || !pin) {
      return res.status(400).json({ success: false, message: 'Code and PIN required' });
    }

    const requestCheck = await pool.query(
      'SELECT id FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid code or PIN' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM traveler_request_orders WHERE offer_id = $1 AND request_id = $2 ORDER BY created_at DESC LIMIT 1',
      [offerId, requestCheck.rows[0].id]
    );

    if (orderResult.rows.length === 0) {
      return res.json({
        success: true,
        hasOrder: false,
        paymentStatus: null
      });
    }

    const order = orderResult.rows[0];

    res.json({
      success: true,
      hasOrder: true,
      orderId: order.id,
      paymentStatus: order.payment_status,
      grossAmount: order.gross_amount,
      currency: order.currency,
      paidAt: order.paid_at
    });

  } catch (error) {
    console.error('Error getting offer payment status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
