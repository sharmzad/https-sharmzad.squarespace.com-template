const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { 
  sendBookingConfirmationEmail, 
  sendAdminBookingNotification,
  sendAdminPaymentSuccessNotification,
  sendAdminPaymentFailedNotification,
  sendAdminSystemErrorNotification,
  sendAgencyRequestPaymentConfirmation,
  sendAgencyRequestPaymentNotificationToAgency,
  sendAgencyRequestPaymentNotificationToAdmin
} = require('../config/email');

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['bookingId']
      });
    }

    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // SECURITY: Use server-side stored amount, never trust client-provided amount
    if (!booking.total_amount || booking.total_amount <= 0) {
      return res.status(400).json({ error: 'Booking has no valid total amount' });
    }

    // Prevent double payment
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ error: 'Booking is already paid' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.total_amount * 100),
      currency: (booking.currency || 'usd').toLowerCase(),
      metadata: {
        bookingId: bookingId.toString(),
        guestEmail: booking.guest_email,
        packageName: booking.package_name
      },
      description: `Booking for ${booking.package_name}`
    });

    await pool.query(
      'UPDATE bookings SET payment_intent_id = $1, updated_at = NOW() WHERE id = $2',
      [paymentIntent.id, bookingId]
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: booking.total_amount,
      currency: booking.currency || 'USD'
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { bookingId, successUrl, cancelUrl } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (!booking.total_amount || booking.total_amount <= 0) {
      return res.status(400).json({ error: 'Booking has no valid total amount' });
    }

    // SECURITY: Prevent double payment
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ error: 'Booking is already paid' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: booking.currency || 'usd',
            product_data: {
              name: booking.package_name,
              description: `${booking.adults || 1} adult(s)${booking.children ? `, ${booking.children} child(ren)` : ''}`
            },
            unit_amount: Math.round(booking.total_amount * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/booking-cancelled`,
      customer_email: booking.guest_email,
      client_reference_id: bookingId.toString(),
      metadata: {
        bookingId: bookingId.toString()
      }
    });

    await pool.query(
      'UPDATE bookings SET checkout_session_id = $1, updated_at = NOW() WHERE id = $2',
      [session.id, bookingId]
    );

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      success: true,
      session: {
        id: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        currency: session.currency
      }
    });

  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve session',
      details: error.message
    });
  }
});

const webhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('❌ SECURITY: STRIPE_WEBHOOK_SECRET not set - rejecting webhook');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }
    
    if (!sig) {
      console.error('❌ SECURITY: Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const stripeSessionId = session.id;
        const paymentType = session.metadata?.type;
        
        // Handle Agency Traveler Request Payments
        if (paymentType === 'agency_traveler_request') {
          const orderId = session.client_reference_id || session.metadata?.orderId;
          
          if (orderId) {
            // Check if already processed to prevent duplicate handling
            const existingOrder = await pool.query(
              'SELECT payment_status FROM traveler_request_orders WHERE id = $1',
              [orderId]
            );
            
            if (existingOrder.rows.length > 0 && existingOrder.rows[0].payment_status === 'paid') {
              console.log(`⚠️ Order ${orderId} already processed, skipping duplicate webhook`);
              break;
            }
            
            await pool.query(
              `UPDATE traveler_request_orders 
               SET payment_status = 'paid', 
                   paid_at = NOW(),
                   stripe_session_id = $2,
                   updated_at = NOW()
               WHERE id = $1 AND payment_status = 'pending'`,
              [orderId, stripeSessionId]
            );
            console.log(`✅ Agency request order ${orderId} marked as paid (Session: ${stripeSessionId})`);
            
            // Fetch order details for email notifications
            const orderResult = await pool.query(
              'SELECT * FROM traveler_request_orders WHERE id = $1',
              [orderId]
            );
            
            if (orderResult.rows.length > 0) {
              const order = orderResult.rows[0];
              
              // Fetch request details
              const requestResult = await pool.query(
                'SELECT * FROM guest_requests WHERE id = $1',
                [order.request_id]
              );
              
              // Fetch agency details
              const agencyResult = await pool.query(
                `SELECT u.email, u.full_name, ap.company_name 
                 FROM users u 
                 LEFT JOIN agency_profiles ap ON ap.user_id = u.id
                 WHERE u.id = $1`,
                [order.provider_id]
              );
              
              const request = requestResult.rows[0] || {};
              const agencyData = agencyResult.rows[0] || {};
              const agency = {
                name: agencyData.company_name || agencyData.full_name || 'Agency',
                email: agencyData.email
              };
              
              // Send confirmation to traveler
              try {
                await sendAgencyRequestPaymentConfirmation(order, request, agency);
                console.log(`📧 Agency request payment confirmation sent to ${order.traveler_email}`);
              } catch (emailError) {
                console.error('⚠️  Failed to send traveler confirmation:', emailError.message);
              }
              
              // Send notification to agency
              if (agency.email) {
                try {
                  await sendAgencyRequestPaymentNotificationToAgency(order, request, agency);
                  console.log(`📧 Agency notification sent to ${agency.email}`);
                } catch (emailError) {
                  console.error('⚠️  Failed to send agency notification:', emailError.message);
                }
              }
              
              // Send notification to admin
              try {
                await sendAgencyRequestPaymentNotificationToAdmin(order, request, agency);
                console.log(`📧 Admin agency payment notification sent`);
              } catch (emailError) {
                console.error('⚠️  Failed to send admin notification:', emailError.message);
              }
            }
          }
          break;
        }
        
        // Handle Regular Bookings
        const bookingId = session.client_reference_id || session.metadata?.bookingId;

        if (bookingId) {
          await pool.query(
            `UPDATE bookings 
             SET payment_status = 'paid', 
                 status = 'confirmed',
                 payment_date = NOW(),
                 checkout_session_id = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [bookingId, stripeSessionId]
          );
          console.log(`✅ Booking ${bookingId} marked as paid and confirmed (Session: ${stripeSessionId})`);
          
          const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
          if (bookingResult.rows.length > 0) {
            const booking = bookingResult.rows[0];
            
            try {
              await sendBookingConfirmationEmail(booking);
              console.log(`📧 Confirmation email sent to ${booking.guest_email}`);
            } catch (emailError) {
              console.error('⚠️  Failed to send customer confirmation email:', emailError.message);
            }
            
            try {
              await sendAdminBookingNotification(booking);
              console.log(`📧 Admin notification sent for booking ${bookingId}`);
            } catch (emailError) {
              console.error('⚠️  Failed to send admin notification email:', emailError.message);
            }

            // Send payment success notification to admin
            try {
              await sendAdminPaymentSuccessNotification(booking, { stripeSessionId });
              console.log(`📧 Admin payment success notification sent for booking ${bookingId}`);
            } catch (emailError) {
              console.error('⚠️  Failed to send admin payment success notification:', emailError.message);
            }
          }
        } else {
          console.error('⚠️ Webhook received but no bookingId found in session');
          // Notify admin about webhook error
          sendAdminSystemErrorNotification('Webhook Error', {
            endpoint: '/webhook/stripe',
            message: 'Webhook received but no bookingId found in checkout.session.completed event',
            stripeSessionId: session?.id
          }).catch(err => console.error('Failed to send system error notification:', err.message));
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata.bookingId;

        if (bookingId) {
          await pool.query(
            `UPDATE bookings 
             SET payment_status = 'paid',
                 status = 'confirmed',
                 payment_date = NOW(),
                 payment_intent_id = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [bookingId, paymentIntent.id]
          );
          console.log(`✅ Payment succeeded for booking ${bookingId} (PaymentIntent: ${paymentIntent.id})`);
          
          const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
          if (bookingResult.rows.length > 0) {
            const booking = bookingResult.rows[0];
            
            try {
              await sendBookingConfirmationEmail(booking);
              console.log(`📧 Confirmation email sent to ${booking.guest_email}`);
            } catch (emailError) {
              console.error('⚠️  Failed to send customer confirmation email:', emailError.message);
            }
            
            try {
              await sendAdminBookingNotification(booking);
              console.log(`📧 Admin notification sent for booking ${bookingId}`);
            } catch (emailError) {
              console.error('⚠️  Failed to send admin notification email:', emailError.message);
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata.bookingId;

        if (bookingId) {
          await pool.query(
            `UPDATE bookings 
             SET payment_status = 'failed',
                 status = 'cancelled',
                 updated_at = NOW()
             WHERE id = $1`,
            [bookingId]
          );
          console.log(`❌ Payment failed for booking ${bookingId}`);

          // Send payment failed notification to admin
          sendAdminPaymentFailedNotification(bookingId, {
            paymentIntentId: paymentIntent.id,
            errorMessage: paymentIntent.last_payment_error?.message || 'Unknown error'
          }).catch(err => console.error('Failed to send payment failed notification:', err.message));
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Send system error notification to admin
    sendAdminSystemErrorNotification('Webhook Processing Error', {
      endpoint: '/webhook/stripe',
      message: error.message,
      stack: error.stack
    }).catch(err => console.error('Failed to send system error notification:', err.message));
    
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = router;
module.exports.webhookHandler = webhookHandler;
