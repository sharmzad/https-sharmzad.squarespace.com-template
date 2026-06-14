const { sendEmail } = require('./zeptomail');
const { wrapWithBranding, createInfoBox, COLORS } = require('./emailBranding');

const sendTripApprovalEmail = async (expertEmail, expertName, tripTitle) => {
  const contentHtml = `
    <h2 style="color: ${COLORS.success};">Congratulations, ${expertName}!</h2>
    
    <p>Great news! Your expert trip "<strong>${tripTitle}</strong>" has been approved by our admin team.</p>
    
    ${createInfoBox(`
      <p style="margin: 0;"><strong style="color: ${COLORS.success};">What's Next?</strong></p>
      <p style="margin: 8px 0 0 0;">
        Log into your dashboard and click "Publish" to make your trip live on the marketplace. Travelers can then book your trip immediately!
      </p>
    `, '#d4edda')}
    
    <p style="margin-top: 20px;">Once published, your trip will appear in:</p>
    <ul style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>Expert Trips Marketplace</li>
      <li>Search results by location and expert type</li>
      <li>Your public profile</li>
    </ul>
    
    <p style="text-align: center; margin: 25px 0;">
      <a href="https://egtravelmarket.com/expert-dashboard.html" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.success}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
        📊 Go to Dashboard
      </a>
    </p>
    
    <p style="color: ${COLORS.textMuted}; font-size: 13px; background: ${COLORS.footer}; padding: 12px; border-radius: 6px;">
      <strong>Remember:</strong> We take 20% commission on each booking to handle payments, provide guarantor protection, and manage disputes.
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '✅ Trip Approved!', 'Your expert trip is ready to publish', COLORS.success);

  try {
    await sendEmail(expertEmail, '✅ Your Expert Trip Has Been Approved!', htmlBody, expertName);
    console.log('✅ Trip approval email sent to:', expertEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending trip approval email:', error);
  }
};

const sendTripRejectionEmail = async (expertEmail, expertName, tripTitle, reason) => {
  const contentHtml = `
    <h2>Hello ${expertName},</h2>
    
    <p>Thank you for submitting your expert trip "<strong>${tripTitle}</strong>". Our admin team has reviewed it and has some feedback.</p>
    
    ${createInfoBox(`
      <p style="margin: 0;"><strong style="color: #856404;">Admin Feedback:</strong></p>
      <p style="margin: 8px 0 0 0; color: #856404;">
        ${reason || 'Please review your trip details and resubmit.'}
      </p>
    `, '#fff3cd')}
    
    <p style="margin-top: 20px;">Your trip has been returned to draft status. You can now edit it in your dashboard and resubmit for approval.</p>
    
    <p>Common reasons for revision requests include:</p>
    <ul style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>Incomplete description or details</li>
      <li>Missing pricing information</li>
      <li>Safety or liability concerns</li>
      <li>Policy compliance issues</li>
    </ul>
    
    <p style="text-align: center; margin: 25px 0;">
      <a href="https://egtravelmarket.com/expert-dashboard.html" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.primary}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
        ✏️ Edit Your Trip
      </a>
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '📝 Trip Review Feedback', 'Your trip needs some revisions', '#ff9800');

  try {
    await sendEmail(expertEmail, '📝 Your Expert Trip Needs Revision', htmlBody, expertName);
    console.log('✅ Trip rejection email sent to:', expertEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending trip rejection email:', error);
  }
};

const sendEmailVerificationToTraveler = async (travelerEmail, travelerName, bookingId, tripTitle, totalAmount, verificationUrl) => {
  const contentHtml = `
    <h2>Hello ${travelerName},</h2>
    
    <p>We received your booking request for <strong>${tripTitle}</strong>. Please verify that this email address is correct before we process your payment.</p>
    
    ${createInfoBox(`
      <p style="margin: 0;"><strong style="color: ${COLORS.primary};">Booking Details:</strong></p>
      <p style="margin: 8px 0 0 0; color: ${COLORS.primary};">
        <strong>Trip:</strong> ${tripTitle}<br>
        <strong>Total Amount:</strong> $${totalAmount.toFixed(2)}<br>
        <strong>Booking ID:</strong> #${bookingId}
      </p>
    `, '#e3f2fd')}
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.primary}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
        ✅ Verify Email & Proceed to Payment
      </a>
    </p>
    
    <p style="color: ${COLORS.textMuted}; font-size: 13px; text-align: center;">
      If you did not request this booking, please ignore this email.
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '📧 Verify Your Email', 'Complete your expert trip booking');

  try {
    await sendEmail(travelerEmail, '✅ Verify Your Email - Complete Your Expert Trip Booking', htmlBody, travelerName);
    console.log('✅ Email verification sent to:', travelerEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email verification:', error);
    throw error;
  }
};

const sendBookingConfirmationToTraveler = async (travelerEmail, travelerName, tripTitle, bookingId, totalAmount) => {
  const contentHtml = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background-color: ${COLORS.success}; color: white; padding: 12px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">
        ✓ Payment Successful
      </div>
    </div>
    
    <h2>Hello ${travelerName},</h2>
    
    <p>Your booking for <strong>"${tripTitle}"</strong> has been confirmed! Your payment has been securely held by EG Travel Market.</p>
    
    ${createInfoBox(`
      <p style="margin: 0;"><strong style="color: #0c5460;">Booking Details:</strong></p>
      <p style="margin: 8px 0 0 0; color: #0c5460;">
        <strong>Booking ID:</strong> #${bookingId}<br>
        <strong>Total Amount:</strong> $${parseFloat(totalAmount).toFixed(2)}<br>
        <strong>Status:</strong> Confirmed
      </p>
    `, '#d1ecf1')}
    
    <h3 style="color: ${COLORS.text}; margin-top: 25px;">What Happens Next?</h3>
    <ol style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>The expert will contact you within 24 hours to confirm details</li>
      <li>Detailed itinerary and final instructions will be sent to your email</li>
      <li>Payment is held safely until the trip is completed</li>
      <li>After the trip, you can rate and review your experience</li>
    </ol>
    
    <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${COLORS.primary};">
      <strong style="color: ${COLORS.primary};">🔒 Your Payment is Protected</strong>
      <p style="color: ${COLORS.textLight}; margin: 8px 0 0 0; font-size: 14px;">
        EG Travel Market acts as your guarantor. Your payment is held in escrow until you confirm the trip is satisfactory.
      </p>
    </div>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🎉 Booking Confirmed!', 'Your expert trip is booked', COLORS.success);

  try {
    await sendEmail(travelerEmail, `🎉 Your Expert Trip Booking is Confirmed - ${tripTitle}`, htmlBody, travelerName);
    console.log('✅ Booking confirmation email sent to:', travelerEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
  }
};

const sendBookingNotificationToExpert = async (expertEmail, expertName, tripTitle, bookingId, totalAmount) => {
  const contentHtml = `
    <h2>Congratulations, ${expertName}!</h2>
    
    <p>Someone just booked your expert trip "<strong>${tripTitle}</strong>".</p>
    
    ${createInfoBox(`
      <p style="margin: 0;"><strong style="color: ${COLORS.success};">Booking Details:</strong></p>
      <p style="margin: 8px 0 0 0;">
        <strong>Booking ID:</strong> #${bookingId}<br>
        <strong>Trip:</strong> ${tripTitle}<br>
        <strong>Booking Amount:</strong> $${parseFloat(totalAmount).toFixed(2)}<br>
        <strong>Your Earnings (80%):</strong> <span style="color: ${COLORS.success}; font-weight: bold;">$${(parseFloat(totalAmount) * 0.8).toFixed(2)}</span>
      </p>
    `, '#d4edda')}
    
    <h3 style="color: ${COLORS.text}; margin-top: 25px;">Next Steps:</h3>
    <ol style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>Check your dashboard for traveler contact information</li>
      <li>Reach out to confirm trip details and answer questions</li>
      <li>Coordinate final arrangements</li>
      <li>After trip completion, 80% payment will be released to you</li>
    </ol>
    
    <p style="text-align: center; margin: 25px 0;">
      <a href="https://egtravelmarket.com/expert-dashboard.html" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.success}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
        📊 View Booking Details
      </a>
    </p>
    
    <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${COLORS.primary};">
      <strong style="color: ${COLORS.primary};">💰 Your Payment</strong>
      <p style="color: ${COLORS.textLight}; margin: 8px 0 0 0; font-size: 14px;">
        80% of the booking amount ($${(parseFloat(totalAmount) * 0.8).toFixed(2)}) will be released to you after the trip is completed and confirmed. EG Travel Market takes 20% as a platform fee.
      </p>
    </div>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🎯 New Booking!', 'Someone just booked your trip', COLORS.success);

  try {
    await sendEmail(expertEmail, `🎯 New Booking for Your Trip: ${tripTitle}`, htmlBody, expertName);
    console.log('✅ Booking notification email sent to:', expertEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking notification email:', error);
  }
};

module.exports = {
  sendTripApprovalEmail,
  sendTripRejectionEmail,
  sendEmailVerificationToTraveler,
  sendBookingConfirmationToTraveler,
  sendBookingNotificationToExpert
};
