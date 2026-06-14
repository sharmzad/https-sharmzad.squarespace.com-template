const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendEmail } = require('../utils/zeptomail');
const { wrapWithBranding, createInfoBox, COLORS, getFormattedTime } = require('../utils/emailBranding');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@egtravelmarket.com';

async function sendDiveCenterRequestNotification(data) {
  const { centerName, centerEmail, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const centerContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      🎉 New Diving Package Request!
    </h2>
    
    <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6;">
      Great news! A diver has requested a custom diving package from your dive center through EG Travel Market.
    </p>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Diver Name:</strong> ${travelerName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${travelerEmail}" style="color: ${COLORS.primary};">${travelerEmail}</a></p>
      ${travelerWhatsapp ? `<p style="margin: 10px 0;"><strong>WhatsApp:</strong> <a href="https://wa.me/${String(travelerWhatsapp).replace(/[^0-9]/g, '')}" style="color: #25D366;">${travelerWhatsapp}</a></p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 30px;">Message from Diver:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 20px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${message}</p>
    
    <p style="margin-top: 30px; color: ${COLORS.text}; font-size: 16px;">
      <strong>Next Steps:</strong>
    </p>
    <ul style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>Review the diver's requirements</li>
      <li>Contact them via email or WhatsApp</li>
      <li>Discuss their needs and propose a diving package</li>
    </ul>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Received:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const centerHtmlBody = wrapWithBranding(centerContentHtml, '🎉 New Diving Package Request', 'You have a new request from a diver');

  try {
    await sendEmail(centerEmail, `New Diving Package Request from ${travelerName}`, centerHtmlBody, centerName);
  } catch (error) {
    console.error('Error sending dive center notification email:', error);
  }
}

async function sendAdminDiveCenterRequestNotification(data) {
  const { centerName, centerId, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const adminContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      🤿 New Dive Center Package Request
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Dive Center:</strong> ${centerName} (ID: ${centerId})</p>
      <p style="margin: 10px 0;"><strong>Diver:</strong> ${travelerName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${travelerEmail}" style="color: ${COLORS.primary};">${travelerEmail}</a></p>
      ${travelerWhatsapp ? `<p style="margin: 10px 0;"><strong>WhatsApp:</strong> ${travelerWhatsapp}</p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 30px;">Request Message:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 20px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${message}</p>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const adminHtmlBody = wrapWithBranding(adminContentHtml, '🤿 Dive Center Request', 'New diving package request submitted');

  try {
    await sendEmail(ADMIN_EMAIL, `Dive Center Request: ${travelerName} → ${centerName}`, adminHtmlBody);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
}

router.post('/', async (req, res) => {
  try {
    const { diveCenterId, diveCenterName, travelerName, travelerEmail, travelerWhatsapp, message } = req.body || {};

    if (!diveCenterId || !travelerName || !travelerEmail || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields. Please fill in all required fields.' 
      });
    }

    const numericCenterId = parseInt(diveCenterId, 10);
    if (isNaN(numericCenterId)) {
      return res.status(400).json({ success: false, message: 'Invalid dive center ID' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(travelerEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const centerQuery = await pool.query(
      `SELECT dcp.id, dcp.center_name, u.email, u.is_active, u.approval_status
       FROM dive_center_profiles dcp 
       JOIN users u ON dcp.user_id = u.id 
       WHERE dcp.id = $1`,
      [numericCenterId]
    );

    if (centerQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dive center not found' });
    }

    const center = centerQuery.rows[0];

    if (!center.is_active || center.approval_status !== 'approved') {
      return res.status(400).json({ success: false, message: 'This dive center is not currently available' });
    }

    const insertResult = await pool.query(
      `INSERT INTO dive_center_itinerary_requests 
       (dive_center_id, traveler_name, traveler_email, traveler_whatsapp, message, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [numericCenterId, travelerName, travelerEmail, travelerWhatsapp || null, message]
    );

    const requestId = insertResult.rows[0].id;

    sendDiveCenterRequestNotification({
      centerName: center.center_name,
      centerEmail: center.email,
      travelerName,
      travelerEmail,
      travelerWhatsapp,
      message
    }).catch(err => console.error('Dive center notification email error:', err));

    sendAdminDiveCenterRequestNotification({
      centerName: center.center_name,
      centerId: numericCenterId,
      travelerName,
      travelerEmail,
      travelerWhatsapp,
      message
    }).catch(err => console.error('Admin notification email error:', err));

    res.json({ 
      success: true, 
      message: 'Your request has been sent successfully!',
      requestId 
    });

  } catch (error) {
    console.error('Dive center package request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
});

module.exports = router;
