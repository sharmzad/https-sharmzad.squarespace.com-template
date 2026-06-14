const { sendEmail } = require('./zeptomail');
const { wrapWithBranding, createInfoBox, COLORS } = require('./emailBranding');

async function sendRequestCreatedEmail({ email, name, code, pin, title }) {
  const subject = `Your Traveller Request Confirmation (Code: ${code})`;

  const contentHtml = `
    <h2>Hello ${name},</h2>
    <p>Thank you for submitting your traveller request on EG Travel Market!</p>
    
    ${createInfoBox(`
      <strong>Request Details:</strong>
      <p style="margin: 10px 0 5px 0;"><strong>Title:</strong> ${title}</p>
      <p style="margin: 5px 0 5px 0;"><strong>Request Code:</strong> <span style="color: #0066cc; font-size: 16px; font-weight: bold;">${code}</span></p>
      <p style="margin: 5px 0 0 0;"><strong>PIN:</strong> <span style="color: #0066cc; font-size: 16px; font-weight: bold;">${pin}</span></p>
    `)}
    
    <p><strong>⚠️ Important:</strong> For your security, we do NOT include clickable links in emails.</p>
    <p>Please open <strong>www.egtravelmarket.com</strong> manually in your browser, then go to:</p>
    <p style="background: #f0f8ff; padding: 10px; border-radius: 6px; text-align: center; color: #0066cc;">
      <strong>Traveller Requests → View My Request</strong><br>
      Enter your Request Code + PIN
    </p>
    <p>Expert offers will appear as they come in!</p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '✅ Request Confirmation', 'Your traveller request has been submitted');

  await sendEmail(email, subject, htmlBody, name);
}

async function sendNewBidEmail({ email, title, code }) {
  const subject = `New Offer for Your Traveller Request (Code: ${code})`;

  const contentHtml = `
    <h2>Hello,</h2>
    <p>Great news! Your traveller request "<strong>${title}</strong>" has received a new offer from one of our verified experts!</p>
    
    ${createInfoBox(`
      <strong style="color: #155724;">📋 Request Code:</strong>
      <p style="margin: 8px 0; color: #155724; font-size: 16px; font-weight: bold;">${code}</p>
    `, COLORS.successLight, COLORS.success)}
    
    <p><strong>⚠️ Important:</strong> For your security, we do NOT include clickable links in emails.</p>
    <p>Please open <strong>www.egtravelmarket.com</strong> manually in your browser, then go to:</p>
    <p style="background: #d4edda; padding: 10px; border-radius: 6px; text-align: center; color: #155724;">
      <strong>Traveller Requests → View My Request</strong><br>
      Enter your Request Code + PIN to view all offers
    </p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '🎉 New Offer!', 'You have a new expert offer', COLORS.success);

  await sendEmail(email, subject, htmlBody);
}

async function sendRequestApprovedEmail({ email, name, code, pin, title }) {
  const subject = `Your Traveller Request Has Been Approved! (Code: ${code})`;

  const contentHtml = `
    <h2>Hello ${name},</h2>
    <p>Great news! Your travel request "<strong>${title}</strong>" has been reviewed and <strong style="color: #155724;">approved</strong> by our team.</p>
    
    ${createInfoBox(`
      <strong style="color: #155724;">✅ Request Approved</strong>
      <p style="margin: 10px 0 5px 0;">Your request is now visible to our verified local experts including guides, dive instructors, and travel agencies.</p>
      <p style="margin: 5px 0;">You will start receiving personalized offers soon!</p>
    `, COLORS.successLight, COLORS.success)}
    
    <p><strong>⚠️ Important:</strong> For your security, we do NOT include clickable links in emails.</p>
    <p>Please open <strong>www.egtravelmarket.com</strong> manually in your browser, then go to:</p>
    <p style="background: #d4edda; padding: 10px; border-radius: 6px; text-align: center; color: #155724;">
      <strong>Traveller Requests → View My Request</strong><br>
      Use Code: <strong>${code}</strong> + your PIN to view all offers
    </p>
    <p>We'll notify you by email each time you receive a new offer!</p>
  `;

  const htmlBody = wrapWithBranding(contentHtml, '✅ Request Approved!', 'Your travel request is now live', COLORS.success);

  await sendEmail(email, subject, htmlBody, name);
}

module.exports = { sendEmail: sendEmail, sendRequestCreatedEmail, sendNewBidEmail, sendRequestApprovedEmail };
