const axios = require('axios');

const ZEPTOMAIL_API_KEY = process.env.ZEPTOMAIL_API_KEY;
const ZEPTOMAIL_BASE_URL = 'https://api.zeptomail.com/v1.1';
const EMAIL_FROM = process.env.EMAIL_USER || 'info@egtravelmarket.com';

/**
 * Send email via ZeptoMail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} recipientName - Recipient name (optional)
 * @returns {Promise<object>} API response
 */
async function sendEmail(to, subject, htmlBody, recipientName = null) {
  try {
    if (!ZEPTOMAIL_API_KEY) {
      console.error('❌ ZEPTOMAIL_API_KEY not configured');
      throw new Error('Email service not configured - API key missing');
    }

    console.log(`📧 Attempting to send email to ${to}...`);

    const payload = {
      from: {
        address: EMAIL_FROM,
        name: 'EG Travel Market'
      },
      to: [{
        email_address: {
          address: to,
          name: recipientName || to.split('@')[0]
        }
      }],
      subject: subject,
      htmlbody: htmlBody
    };

    console.log('📤 API Request:', {
      url: `${ZEPTOMAIL_BASE_URL}/email`,
      from: payload.from.address,
      to: to,
      subject: subject
    });

    const response = await axios.post(`${ZEPTOMAIL_BASE_URL}/email`, payload, {
      headers: {
        'Authorization': `Zoho-enczapikey ${ZEPTOMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`✅ Email sent successfully to ${to}!`, {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ ZeptoMail error for ${to}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

/**
 * Send email with CC (if API supports it)
 * For now, we'll send separate emails for CC
 */
async function sendEmailWithCC(to, cc, subject, htmlBody, recipientName = null) {
  try {
    // Send main email
    await sendEmail(to, subject, htmlBody, recipientName);
    
    // Send CC emails separately
    if (cc && Array.isArray(cc)) {
      for (const ccEmail of cc) {
        await sendEmail(ccEmail, `[CC] ${subject}`, htmlBody, ccEmail.split('@')[0]);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending email with CC:`, error.message);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendEmailWithCC
};
