const { sendEmail } = require('../utils/zeptomail');
const { wrapWithBranding, createInfoBox, COLORS, getFormattedTime } = require('../utils/emailBranding');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@egtravelmarket.com';

const sendContactFormEmail = async (formData) => {
  const recipientEmail = ADMIN_EMAIL;

  const contentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      📝 New Contact Form Submission
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Name:</strong> ${formData.name}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${formData.email}" style="color: ${COLORS.primary};">${formData.email}</a></p>
      ${formData.phone ? `<p style="margin: 10px 0;"><strong>Phone:</strong> ${formData.phone}</p>` : ''}
      ${formData.subject ? `<p style="margin: 10px 0;"><strong>Subject:</strong> ${formData.subject}</p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 30px;">Message:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 20px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${formData.message}</p>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)<br>
      <strong>Type:</strong> ${formData.formType || 'General Contact'}
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '📝 Contact Form Submission');

  try {
    await sendEmail(recipientEmail, formData.subject ? `Contact Form: ${formData.subject}` : 'New Contact Form Submission', htmlBody);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending contact form email:', error);
    throw error;
  }
};

const sendBookingConfirmationEmail = async (booking) => {
  const contentHtml = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background-color: ${COLORS.success}; color: white; padding: 12px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">
        ✓ Payment Successful
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 22px; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      Booking Details
    </h2>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Booking ID:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          <span style="color: ${COLORS.primary}; font-weight: bold;">#${booking.id}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Package:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${booking.package_name}
        </td>
      </tr>
      ${booking.package_type ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Type:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${booking.package_type}
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Guest Name:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${booking.guest_name}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Travelers:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${booking.adults} Adult(s)${booking.children > 0 ? `, ${booking.children} Child(ren)` : ''}
        </td>
      </tr>
      ${booking.booking_date ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Date:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </td>
      </tr>
      ` : ''}
      ${booking.pickup_location ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Pickup Location:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${booking.pickup_location}
        </td>
      </tr>
      ` : ''}
      <tr style="background-color: ${COLORS.footer};">
        <td style="padding: 16px 0; font-size: 18px;">
          <strong style="color: ${COLORS.text};">Total Paid:</strong>
        </td>
        <td style="padding: 16px 0; text-align: right; font-size: 22px;">
          <strong style="color: ${COLORS.success};">${booking.currency} ${parseFloat(booking.total_amount).toFixed(2)}</strong>
        </td>
      </tr>
    </table>

    ${booking.special_requests ? `
    ${createInfoBox(`
      <strong>Special Requests:</strong>
      <p style="margin: 8px 0 0 0;">${booking.special_requests}</p>
    `, COLORS.warningLight, COLORS.warning)}
    ` : ''}

    <h3 style="margin-top: 30px; color: ${COLORS.text}; font-size: 18px;">
      ❓ Need Help?
    </h3>
    <p style="margin: 0; color: ${COLORS.textLight}; line-height: 1.6;">
      📧 Email: <a href="mailto:info@egtravelmarket.com" style="color: ${COLORS.primary}; text-decoration: none;">info@egtravelmarket.com</a><br>
      📱 WhatsApp: <a href="https://wa.me/201227903329" style="color: #25D366; text-decoration: none; font-weight: bold;">+20 122 790 3329</a>
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🎉 Booking Confirmed!', 'Your Egyptian adventure awaits');

  try {
    await sendEmail(booking.guest_email, `Booking Confirmed: ${booking.package_name} - Eg Travel Market`, htmlBody, booking.guest_name);
    console.log('✅ Booking confirmation email sent to:', booking.guest_email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
    throw error;
  }
};

const sendAdminBookingNotification = async (booking) => {
  const adminEmail = ADMIN_EMAIL;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px;">💰 New Paid Booking!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Booking #${booking.id}</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #155724;">✓ Payment Status:</strong> 
          <span style="color: #28a745; font-size: 18px; font-weight: bold;">PAID</span>
        </div>

        <h2 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 20px;">
          Booking Details
        </h2>
        
        <table width="100%" style="border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Booking ID:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">#${booking.id}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Package:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.package_name}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Amount:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong style="color: #28a745; font-size: 18px;">${booking.currency} ${parseFloat(booking.total_amount).toFixed(2)}</strong></td>
          </tr>
        </table>

        <h3 style="margin-top: 30px; color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
          Customer Information
        </h3>
        
        <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Name:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.guest_name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Email:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
              <a href="mailto:${booking.guest_email}" style="color: #0066cc;">${booking.guest_email}</a>
            </td>
          </tr>
          ${booking.guest_phone ? `
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Phone:</strong></td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
              <a href="tel:${booking.guest_phone}" style="color: #0066cc;">${booking.guest_phone}</a>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="margin: 0 0 15px 0; color: #999; font-size: 12px;">
          Eg Travel Market Admin Notification
        </p>
      </div>
    </div>
  `;

  try {
    await sendEmail(adminEmail, `🔔 New Paid Booking #${booking.id}: ${booking.package_name}`, htmlBody);
    console.log('✅ Admin booking notification sent to:', adminEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin booking notification:', error);
    throw error;
  }
};

// Admin notification for new user signup
const sendAdminNewSignupNotification = async (user, profileType = null, profileName = null) => {
  const userTypeDisplay = {
    'customer': 'Customer',
    'guide': 'Tour Guide',
    'diver': 'Diving Instructor',
    'mentor': 'Travel Mentor',
    'agency': 'Travel Agency',
    'divecenter': 'Dive Center'
  };

  const displayType = profileType ? userTypeDisplay[profileType] : userTypeDisplay[user.user_type] || user.user_type;
  const needsApproval = user.approval_status === 'pending';

  const contentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      👤 New User Signup ${needsApproval ? '(Pending Approval)' : ''}
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Name:</strong> ${user.full_name}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${user.email}" style="color: ${COLORS.primary};">${user.email}</a></p>
      <p style="margin: 10px 0;"><strong>User Type:</strong> ${displayType}</p>
      ${profileName ? `<p style="margin: 10px 0;"><strong>Profile/Company Name:</strong> ${profileName}</p>` : ''}
      ${user.phone ? `<p style="margin: 10px 0;"><strong>Phone:</strong> ${user.phone}</p>` : ''}
      ${user.country ? `<p style="margin: 10px 0;"><strong>Country:</strong> ${user.country}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Approval Status:</strong> <span style="color: ${needsApproval ? COLORS.warning : COLORS.success}; font-weight: bold;">${user.approval_status}</span></p>
    `, COLORS.footer)}
    
    ${needsApproval ? `
    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Action Required:</strong> This user requires admin approval before they can access all features.
    </div>
    ` : ''}
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Registered:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '👤 New User Signup');

  try {
    await sendEmail(ADMIN_EMAIL, `👤 New Signup: ${user.full_name} (${displayType})${needsApproval ? ' - Pending Approval' : ''}`, htmlBody);
    console.log('✅ Admin signup notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin signup notification:', error);
    throw error;
  }
};

// Admin notification for new traveler request
const sendAdminTravelRequestNotification = async (request) => {
  const contentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      ✈️ New Travel Request Submitted
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Request Code:</strong> ${request.code}</p>
      <p style="margin: 10px 0;"><strong>Title:</strong> ${request.title}</p>
      <p style="margin: 10px 0;"><strong>Traveler Name:</strong> ${request.name}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${request.email}" style="color: ${COLORS.primary};">${request.email}</a></p>
      ${request.whatsapp ? `<p style="margin: 10px 0;"><strong>WhatsApp:</strong> ${request.whatsapp}</p>` : ''}
      ${request.category ? `<p style="margin: 10px 0;"><strong>Category:</strong> ${request.category}</p>` : ''}
      ${request.location ? `<p style="margin: 10px 0;"><strong>Location:</strong> ${request.location}</p>` : ''}
      ${request.travelDate ? `<p style="margin: 10px 0;"><strong>Travel Date:</strong> ${request.travelDate}</p>` : ''}
      ${request.travelers ? `<p style="margin: 10px 0;"><strong>Travelers:</strong> ${request.travelers}</p>` : ''}
      ${request.budget ? `<p style="margin: 10px 0;"><strong>Budget:</strong> ${request.budget}</p>` : ''}
    `, COLORS.footer)}
    
    ${request.details ? `
    <h3 style="color: ${COLORS.text}; margin-top: 20px;">Request Details:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 15px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${request.details}</p>
    ` : ''}
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '✈️ New Travel Request');

  try {
    await sendEmail(ADMIN_EMAIL, `✈️ New Travel Request: ${request.title} from ${request.name}`, htmlBody);
    console.log('✅ Admin travel request notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin travel request notification:', error);
    throw error;
  }
};

// Admin notification for expert/agency trip submission
const sendAdminExpertTripNotification = async (trip, creator) => {
  const creatorType = creator.type || 'expert';
  const creatorLabel = creatorType === 'agency' ? 'Agency' : 'Expert';
  const creatorName = creator.display_name || creator.full_name || 'Unknown';
  
  const contentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      🎯 New Trip Submitted for Approval (${creatorLabel})
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Trip Title:</strong> ${trip.title}</p>
      <p style="margin: 10px 0;"><strong>Creator Type:</strong> <span style="background: ${creatorType === 'agency' ? '#8b5cf6' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${creatorLabel.toUpperCase()}</span></p>
      <p style="margin: 10px 0;"><strong>${creatorLabel} Name:</strong> ${creatorName}</p>
      ${trip.expert_type ? `<p style="margin: 10px 0;"><strong>Expert Type:</strong> ${trip.expert_type}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Price:</strong> ${trip.currency || 'USD'} ${trip.price}</p>
      <p style="margin: 10px 0;"><strong>Location:</strong> ${trip.location}</p>
      ${trip.duration ? `<p style="margin: 10px 0;"><strong>Duration:</strong> ${trip.duration}</p>` : ''}
      ${trip.trip_type ? `<p style="margin: 10px 0;"><strong>Trip Type:</strong> ${trip.trip_type}</p>` : ''}
    `, COLORS.footer)}
    
    ${trip.description ? `
    <h3 style="color: ${COLORS.text}; margin-top: 20px;">Description:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; background: ${COLORS.white}; padding: 15px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${trip.description.substring(0, 500)}${trip.description.length > 500 ? '...' : ''}</p>
    ` : ''}
    
    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Action Required:</strong> Please review and approve/reject this trip in the admin panel.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, `🎯 ${creatorLabel} Trip Pending Approval`);

  try {
    await sendEmail(ADMIN_EMAIL, `🎯 Trip Pending (${creatorLabel}): ${trip.title} by ${creatorName}`, htmlBody);
    console.log(`✅ Admin ${creatorType} trip notification sent to:`, ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error sending admin ${creatorType} trip notification:`, error);
    throw error;
  }
};

// Admin notification for job post submission
const sendAdminJobPostNotification = async (job, poster) => {
  const jobTypeDisplay = {
    'guide': 'Tour Guide',
    'diver': 'Diving Instructor', 
    'mentor': 'Travel Mentor'
  };

  const contentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      💼 New Job Post Submitted for Approval
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Job Title:</strong> ${job.title}</p>
      <p style="margin: 10px 0;"><strong>Job Type:</strong> ${jobTypeDisplay[job.job_type] || job.job_type}</p>
      <p style="margin: 10px 0;"><strong>Posted By:</strong> ${poster.company_name || poster.center_name || poster.full_name}</p>
      <p style="margin: 10px 0;"><strong>Poster Type:</strong> ${job.poster_type}</p>
      <p style="margin: 10px 0;"><strong>Location:</strong> ${job.location}</p>
      ${job.employment_type ? `<p style="margin: 10px 0;"><strong>Employment Type:</strong> ${job.employment_type}</p>` : ''}
      ${job.salary_min || job.salary_max ? `<p style="margin: 10px 0;"><strong>Salary Range:</strong> ${job.currency || 'USD'} ${job.salary_min || 0} - ${job.salary_max || 'Negotiable'}</p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 20px;">Job Description:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; background: ${COLORS.white}; padding: 15px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${job.description.substring(0, 500)}${job.description.length > 500 ? '...' : ''}</p>
    
    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Action Required:</strong> Please review and approve/reject this job posting in the admin panel.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '💼 Job Post Pending Approval');

  try {
    await sendEmail(ADMIN_EMAIL, `💼 Job Post Pending: ${job.title} (${jobTypeDisplay[job.job_type] || job.job_type})`, htmlBody);
    console.log('✅ Admin job post notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin job post notification:', error);
    throw error;
  }
};

// Admin notification for successful payment
const sendAdminPaymentSuccessNotification = async (booking, paymentDetails) => {
  const contentHtml = `
    <h2 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.success}; padding-bottom: 10px;">
      💰 Payment Successful
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Booking ID:</strong> #${booking.id}</p>
      <p style="margin: 10px 0;"><strong>Package:</strong> ${booking.package_name}</p>
      <p style="margin: 10px 0;"><strong>Amount:</strong> <span style="color: ${COLORS.success}; font-weight: bold;">${booking.currency || 'USD'} ${booking.total_amount}</span></p>
      <p style="margin: 10px 0;"><strong>Guest Name:</strong> ${booking.guest_name}</p>
      <p style="margin: 10px 0;"><strong>Guest Email:</strong> <a href="mailto:${booking.guest_email}" style="color: ${COLORS.primary};">${booking.guest_email}</a></p>
      ${paymentDetails?.stripeSessionId ? `<p style="margin: 10px 0;"><strong>Stripe Session:</strong> ${paymentDetails.stripeSessionId}</p>` : ''}
      ${paymentDetails?.paymentIntentId ? `<p style="margin: 10px 0;"><strong>Payment Intent:</strong> ${paymentDetails.paymentIntentId}</p>` : ''}
    `, COLORS.successLight)}
    
    <div style="background: ${COLORS.successLight}; border-left: 4px solid ${COLORS.success}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>✅ Payment Complete:</strong> Booking has been confirmed and customer has been notified.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Processed:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '💰 Payment Successful');

  try {
    await sendEmail(ADMIN_EMAIL, `💰 Payment Received: ${booking.currency || 'USD'} ${booking.total_amount} for Booking #${booking.id}`, htmlBody);
    console.log('✅ Admin payment success notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin payment success notification:', error);
    throw error;
  }
};

// Admin notification for failed payment
const sendAdminPaymentFailedNotification = async (bookingId, paymentDetails) => {
  const contentHtml = `
    <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
      ❌ Payment Failed
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Booking ID:</strong> #${bookingId}</p>
      ${paymentDetails?.paymentIntentId ? `<p style="margin: 10px 0;"><strong>Payment Intent:</strong> ${paymentDetails.paymentIntentId}</p>` : ''}
      ${paymentDetails?.errorMessage ? `<p style="margin: 10px 0;"><strong>Error:</strong> ${paymentDetails.errorMessage}</p>` : ''}
    `, '#ffebee')}
    
    <div style="background: #ffebee; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Attention:</strong> A payment has failed. The booking status has been updated to cancelled.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Failed at:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '❌ Payment Failed');

  try {
    await sendEmail(ADMIN_EMAIL, `❌ Payment Failed: Booking #${bookingId}`, htmlBody);
    console.log('✅ Admin payment failed notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin payment failed notification:', error);
    throw error;
  }
};

// Admin notification for system errors
const sendAdminSystemErrorNotification = async (errorType, errorDetails) => {
  const contentHtml = `
    <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
      🚨 System Error Alert
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Error Type:</strong> ${errorType}</p>
      ${errorDetails.endpoint ? `<p style="margin: 10px 0;"><strong>Endpoint:</strong> ${errorDetails.endpoint}</p>` : ''}
      ${errorDetails.userId ? `<p style="margin: 10px 0;"><strong>User ID:</strong> ${errorDetails.userId}</p>` : ''}
      ${errorDetails.bookingId ? `<p style="margin: 10px 0;"><strong>Booking ID:</strong> ${errorDetails.bookingId}</p>` : ''}
    `, '#ffebee')}
    
    <h3 style="color: ${COLORS.text}; margin-top: 20px;">Error Message:</h3>
    <p style="color: #dc3545; line-height: 1.6; background: #fff5f5; padding: 15px; border-left: 4px solid #dc3545; border-radius: 4px; font-family: monospace;">${errorDetails.message || 'Unknown error'}</p>
    
    ${errorDetails.stack ? `
    <h3 style="color: ${COLORS.text}; margin-top: 20px;">Stack Trace:</h3>
    <pre style="color: ${COLORS.textMuted}; line-height: 1.4; background: #f8f9fa; padding: 15px; border-radius: 4px; font-size: 11px; overflow-x: auto;">${errorDetails.stack.substring(0, 1000)}${errorDetails.stack.length > 1000 ? '...' : ''}</pre>
    ` : ''}
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Occurred at:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🚨 System Error');

  try {
    await sendEmail(ADMIN_EMAIL, `🚨 System Error: ${errorType}`, htmlBody);
    console.log('✅ Admin system error notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin system error notification:', error);
    throw error;
  }
};

// Admin notification for expert trip booking payment (80/20 split)
const sendAdminExpertTripBookingNotification = async (booking, expert, paymentDetails) => {
  const totalAmount = parseFloat(paymentDetails.totalAmount);
  const platformCommission = totalAmount * 0.2;
  const expertAmount = totalAmount * 0.8;

  const contentHtml = `
    <h2 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.success}; padding-bottom: 10px;">
      💰 Expert Trip Payment Received
    </h2>
    
    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #2e7d32; margin: 0 0 15px 0;">📊 Payment Breakdown</h3>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #1b5e20;">Total Paid by Customer:</span>
        <strong style="color: #1b5e20; font-size: 1.1em;">$${totalAmount.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #ff9800;">Platform Commission (20%):</span>
        <strong style="color: #ff9800;">$${platformCommission.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0;">
        <span style="color: #2196f3;">Expert Payout (80%):</span>
        <strong style="color: #2196f3; font-size: 1.2em;">$${expertAmount.toFixed(2)}</strong>
      </div>
    </div>

    ${createInfoBox(`
      <h4 style="color: ${COLORS.primary}; margin: 0 0 10px 0;">🎯 Expert to Pay</h4>
      <p style="margin: 8px 0;"><strong>Name:</strong> ${expert.name}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${expert.email}" style="color: ${COLORS.primary};">${expert.email}</a></p>
      <p style="margin: 8px 0;"><strong>Expert Type:</strong> ${expert.type || 'Expert'}</p>
      <p style="margin: 8px 0;"><strong>Bank Setup:</strong> ${expert.bankSetupComplete ? '✅ Complete' : '❌ Not Complete'}</p>
      ${expert.bankName ? `<p style="margin: 8px 0;"><strong>Bank:</strong> ${expert.bankName}</p>` : ''}
      ${expert.bankAccountHolder ? `<p style="margin: 8px 0;"><strong>Account Holder:</strong> ${expert.bankAccountHolder}</p>` : ''}
    `, '#e3f2fd')}

    ${createInfoBox(`
      <h4 style="color: #0c5460; margin: 0 0 10px 0;">📋 Booking Details</h4>
      <p style="margin: 8px 0;"><strong>Booking ID:</strong> #${booking.id}</p>
      <p style="margin: 8px 0;"><strong>Trip:</strong> ${booking.tripTitle}</p>
      <p style="margin: 8px 0;"><strong>Traveler:</strong> ${booking.travelerName}</p>
      <p style="margin: 8px 0;"><strong>Traveler Email:</strong> <a href="mailto:${booking.travelerEmail}" style="color: ${COLORS.primary};">${booking.travelerEmail}</a></p>
      ${paymentDetails.stripeSessionId ? `<p style="margin: 8px 0;"><strong>Stripe Session:</strong> ${paymentDetails.stripeSessionId}</p>` : ''}
    `, '#d1ecf1')}

    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Action Required:</strong><br>
      After 1 week (waiting period), release <strong style="color: #2196f3;">$${expertAmount.toFixed(2)}</strong> to <strong>${expert.name}</strong> via the Admin Payouts dashboard.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Payment Received:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '💰 Expert Trip Payment', 'New expert trip booking payment received', COLORS.success);

  try {
    await sendEmail(ADMIN_EMAIL, `💰 Expert Trip Payment: $${totalAmount.toFixed(2)} - Pay $${expertAmount.toFixed(2)} to ${expert.name}`, htmlBody);
    console.log('✅ Admin expert trip booking notification sent to:', ADMIN_EMAIL);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin expert trip booking notification:', error);
    throw error;
  }
};

// Agency Request Payment - Confirmation to Traveler
const sendAgencyRequestPaymentConfirmation = async (order, request, agency) => {
  const contentHtml = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background-color: ${COLORS.success}; color: white; padding: 12px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">
        ✓ Payment Successful
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 22px; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      Your Booking Is Confirmed
    </h2>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Order ID:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          <span style="color: ${COLORS.primary}; font-weight: bold;">#${order.id}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Request:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${request.title || 'Custom Trip'} (Code: ${request.code})
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Provider:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${agency.name} (Travel Agency)
        </td>
      </tr>
      ${request.travel_date ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.textLight};">Trip Date:</strong>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.border}; text-align: right;">
          ${new Date(request.travel_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </td>
      </tr>
      ` : ''}
      <tr style="background-color: ${COLORS.footer};">
        <td style="padding: 16px 0; font-size: 18px;">
          <strong style="color: ${COLORS.text};">Total Paid:</strong>
        </td>
        <td style="padding: 16px 0; text-align: right; font-size: 22px;">
          <strong style="color: ${COLORS.success};">${order.currency} ${parseFloat(order.gross_amount).toFixed(2)}</strong>
        </td>
      </tr>
    </table>

    ${createInfoBox(`
      <strong>What happens next?</strong>
      <p style="margin: 8px 0 0 0;">The agency has been notified and will contact you to finalize the details. Your payment is held securely by EgTravelMarket until 7 days after your trip date.</p>
    `, COLORS.footer, COLORS.primary)}

    <h3 style="margin-top: 30px; color: ${COLORS.text}; font-size: 18px;">
      ❓ Need Help?
    </h3>
    <p style="margin: 0; color: ${COLORS.textLight}; line-height: 1.6;">
      📧 Email: <a href="mailto:info@egtravelmarket.com" style="color: ${COLORS.primary}; text-decoration: none;">info@egtravelmarket.com</a><br>
      📱 WhatsApp: <a href="https://wa.me/201227903329" style="color: #25D366; text-decoration: none; font-weight: bold;">+20 122 790 3329</a>
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🎉 Booking Confirmed!', 'Your Egyptian adventure awaits');

  try {
    await sendEmail(order.traveler_email, `Booking Confirmed: ${request.title || 'Custom Trip'} - Eg Travel Market`, htmlBody, request.name);
    console.log('✅ Agency request payment confirmation sent to:', order.traveler_email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending agency request payment confirmation:', error);
    throw error;
  }
};

// Agency Request Payment - Notification to Agency
const sendAgencyRequestPaymentNotificationToAgency = async (order, request, agency) => {
  const contentHtml = `
    <h2 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.success}; padding-bottom: 10px;">
      💰 New Booking Payment Received!
    </h2>
    
    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #2e7d32; margin: 0 0 15px 0;">📊 Payment Details</h3>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #1b5e20;">Total Booking Value:</span>
        <strong style="color: #1b5e20; font-size: 1.1em;">${order.currency} ${parseFloat(order.gross_amount).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #ff9800;">Platform Fee (20%):</span>
        <strong style="color: #ff9800;">${order.currency} ${parseFloat(order.platform_fee).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0;">
        <span style="color: #2196f3;">Your Payout (80%):</span>
        <strong style="color: #2196f3; font-size: 1.2em;">${order.currency} ${parseFloat(order.provider_amount).toFixed(2)}</strong>
      </div>
    </div>

    ${createInfoBox(`
      <h4 style="color: ${COLORS.primary}; margin: 0 0 10px 0;">📋 Booking Details</h4>
      <p style="margin: 8px 0;"><strong>Request:</strong> ${request.title || 'Custom Trip'}</p>
      <p style="margin: 8px 0;"><strong>Request Code:</strong> ${request.code}</p>
      <p style="margin: 8px 0;"><strong>Traveler:</strong> ${request.name}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${request.email}" style="color: ${COLORS.primary};">${request.email}</a></p>
      ${request.whatsapp ? `<p style="margin: 8px 0;"><strong>WhatsApp:</strong> ${request.whatsapp}</p>` : ''}
      ${request.travel_date ? `<p style="margin: 8px 0;"><strong>Trip Date:</strong> ${new Date(request.travel_date).toLocaleDateString()}</p>` : ''}
    `, '#e3f2fd')}

    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Important:</strong><br>
      Please contact the traveler to confirm all trip details. Your payout of <strong>${order.currency} ${parseFloat(order.provider_amount).toFixed(2)}</strong> will be released 7 days after the trip date${order.release_date ? ` (${new Date(order.release_date).toLocaleDateString()})` : ''}.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Payment Received:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '💰 New Booking Payment!', 'A traveler has paid for your offer');

  try {
    await sendEmail(agency.email, `💰 New Paid Booking: ${request.title || 'Custom Trip'} - ${order.currency} ${parseFloat(order.gross_amount).toFixed(2)}`, htmlBody, agency.name);
    console.log('✅ Agency request payment notification sent to agency:', agency.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending agency payment notification:', error);
    throw error;
  }
};

// Agency Request Payment - Notification to Admin
const sendAgencyRequestPaymentNotificationToAdmin = async (order, request, agency) => {
  const contentHtml = `
    <h2 style="color: ${COLORS.success}; border-bottom: 2px solid ${COLORS.success}; padding-bottom: 10px;">
      💰 Agency Request Payment Received
    </h2>
    
    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #2e7d32; margin: 0 0 15px 0;">📊 Payment Breakdown</h3>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #1b5e20;">Total Paid by Traveler:</span>
        <strong style="color: #1b5e20; font-size: 1.1em;">${order.currency} ${parseFloat(order.gross_amount).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px dashed #81c784;">
        <span style="color: #ff9800;">Platform Commission (20%):</span>
        <strong style="color: #ff9800;">${order.currency} ${parseFloat(order.platform_fee).toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0;">
        <span style="color: #2196f3;">Agency Payout (80%):</span>
        <strong style="color: #2196f3; font-size: 1.2em;">${order.currency} ${parseFloat(order.provider_amount).toFixed(2)}</strong>
      </div>
    </div>

    ${createInfoBox(`
      <h4 style="color: ${COLORS.primary}; margin: 0 0 10px 0;">🏢 Agency to Pay</h4>
      <p style="margin: 8px 0;"><strong>Agency Name:</strong> ${agency.name}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${agency.email}" style="color: ${COLORS.primary};">${agency.email}</a></p>
      <p style="margin: 8px 0;"><strong>Order ID:</strong> #${order.id}</p>
      <p style="margin: 8px 0;"><strong>Offer ID:</strong> #${order.offer_id}</p>
    `, '#e3f2fd')}

    ${createInfoBox(`
      <h4 style="color: #0c5460; margin: 0 0 10px 0;">📋 Request Details</h4>
      <p style="margin: 8px 0;"><strong>Request Code:</strong> ${request.code}</p>
      <p style="margin: 8px 0;"><strong>Title:</strong> ${request.title || 'Custom Trip'}</p>
      <p style="margin: 8px 0;"><strong>Traveler:</strong> ${request.name}</p>
      <p style="margin: 8px 0;"><strong>Traveler Email:</strong> <a href="mailto:${request.email}" style="color: ${COLORS.primary};">${request.email}</a></p>
      ${request.travel_date ? `<p style="margin: 8px 0;"><strong>Trip Date:</strong> ${new Date(request.travel_date).toLocaleDateString()}</p>` : ''}
      ${order.release_date ? `<p style="margin: 8px 0;"><strong>Release Date:</strong> ${new Date(order.release_date).toLocaleDateString()}</p>` : ''}
    `, '#d1ecf1')}

    <div style="background: ${COLORS.warningLight}; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>⚠️ Action Required:</strong><br>
      Release <strong style="color: #2196f3;">${order.currency} ${parseFloat(order.provider_amount).toFixed(2)}</strong> to <strong>${agency.name}</strong> after the trip completion${order.release_date ? ` (on ${new Date(order.release_date).toLocaleDateString()})` : ''}.
    </div>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Payment Received:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '💰 Agency Request Payment', 'New agency request payment received', COLORS.success);

  try {
    await sendEmail(ADMIN_EMAIL, `💰 Agency Payment: ${order.currency} ${parseFloat(order.gross_amount).toFixed(2)} - Pay ${order.currency} ${parseFloat(order.provider_amount).toFixed(2)} to ${agency.name}`, htmlBody);
    console.log('✅ Admin agency request payment notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending admin agency request payment notification:', error);
    throw error;
  }
};

module.exports = {
  sendContactFormEmail,
  sendBookingConfirmationEmail,
  sendAdminBookingNotification,
  sendAdminNewSignupNotification,
  sendAdminTravelRequestNotification,
  sendAdminExpertTripNotification,
  sendAdminJobPostNotification,
  sendAdminPaymentSuccessNotification,
  sendAdminPaymentFailedNotification,
  sendAdminSystemErrorNotification,
  sendAdminExpertTripBookingNotification,
  sendAgencyRequestPaymentConfirmation,
  sendAgencyRequestPaymentNotificationToAgency,
  sendAgencyRequestPaymentNotificationToAdmin,
  ADMIN_EMAIL
};
