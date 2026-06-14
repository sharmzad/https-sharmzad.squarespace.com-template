const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendEmail } = require('../utils/zeptomail');
const { wrapWithBranding, createInfoBox, COLORS, getFormattedTime } = require('../utils/emailBranding');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@egtravelmarket.com';

async function sendAgencyRequestNotification(data) {
  const { agencyName, agencyEmail, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const agencyContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      🎉 New Itinerary Request!
    </h2>
    
    <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6;">
      Great news! A traveler has requested a custom itinerary from your agency through EG Travel Market.
    </p>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Traveler Name:</strong> ${travelerName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${travelerEmail}" style="color: ${COLORS.primary};">${travelerEmail}</a></p>
      ${travelerWhatsapp ? `<p style="margin: 10px 0;"><strong>WhatsApp:</strong> <a href="https://wa.me/${String(travelerWhatsapp).replace(/[^0-9]/g, '')}" style="color: #25D366;">${travelerWhatsapp}</a></p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 30px;">Message from Traveler:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 20px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${message}</p>
    
    <p style="margin-top: 30px; color: ${COLORS.text}; font-size: 16px;">
      <strong>Next Steps:</strong>
    </p>
    <ul style="color: ${COLORS.textLight}; line-height: 1.8;">
      <li>Review the traveler's requirements</li>
      <li>Contact them via email or WhatsApp</li>
      <li>Discuss their needs and propose an itinerary</li>
    </ul>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Received:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const agencyHtmlBody = wrapWithBranding(agencyContentHtml, '🎉 New Itinerary Request', 'You have a new request from a traveler');

  try {
    await sendEmail(agencyEmail, `New Itinerary Request from ${travelerName}`, agencyHtmlBody, agencyName);
  } catch (error) {
    console.error('Error sending agency notification email:', error);
  }
}

async function sendAdminAgencyRequestNotification(data) {
  const { agencyName, agencyId, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const adminContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      📋 New Agency Itinerary Request
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Agency:</strong> ${agencyName} (ID: ${agencyId})</p>
      <p style="margin: 10px 0;"><strong>Traveler:</strong> ${travelerName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${travelerEmail}" style="color: ${COLORS.primary};">${travelerEmail}</a></p>
      ${travelerWhatsapp ? `<p style="margin: 10px 0;"><strong>WhatsApp:</strong> ${travelerWhatsapp}</p>` : ''}
    `, COLORS.footer)}
    
    <h3 style="color: ${COLORS.text}; margin-top: 30px;">Request Message:</h3>
    <p style="color: ${COLORS.textLight}; line-height: 1.6; white-space: pre-wrap; background: ${COLORS.white}; padding: 20px; border-left: 4px solid ${COLORS.primary}; border-radius: 4px;">${message}</p>
    
    <p style="margin-top: 20px; color: ${COLORS.textMuted}; font-size: 12px;">
      <strong>Submitted:</strong> ${getFormattedTime()} (Cairo Time)
    </p>
  `;

  const adminHtmlBody = wrapWithBranding(adminContentHtml, '📋 Agency Request', 'New itinerary request submitted');

  try {
    await sendEmail(ADMIN_EMAIL, `Agency Request: ${travelerName} → ${agencyName}`, adminHtmlBody);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
}

router.post('/', async (req, res) => {
  try {
    const { agencyId, agencyName, travelerName, travelerEmail, travelerWhatsapp, message } = req.body || {};

    if (!agencyId || !travelerName || !travelerEmail || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields. Please fill in all required fields.' 
      });
    }

    const numericAgencyId = parseInt(agencyId, 10);
    if (isNaN(numericAgencyId)) {
      return res.status(400).json({ success: false, message: 'Invalid agency ID' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(travelerEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const agencyQuery = await pool.query(
      `SELECT ap.id, ap.company_name, u.email, u.is_active, u.approval_status
       FROM agency_profiles ap 
       JOIN users u ON ap.user_id = u.id 
       WHERE ap.id = $1`,
      [numericAgencyId]
    );

    if (agencyQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const agency = agencyQuery.rows[0];

    if (!agency.is_active || agency.approval_status !== 'approved') {
      return res.status(400).json({ success: false, message: 'This agency is not currently available' });
    }

    const insertResult = await pool.query(
      `INSERT INTO agency_itinerary_requests 
       (agency_id, traveler_name, traveler_email, traveler_whatsapp, message, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [numericAgencyId, travelerName, travelerEmail, travelerWhatsapp || null, message]
    );

    const requestId = insertResult.rows[0].id;

    sendAgencyRequestNotification({
      agencyName: agency.company_name,
      agencyEmail: agency.email,
      travelerName,
      travelerEmail,
      travelerWhatsapp,
      message
    }).catch(err => console.error('Agency notification email error:', err));

    sendAdminAgencyRequestNotification({
      agencyName: agency.company_name,
      agencyId: numericAgencyId,
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
    console.error('Agency itinerary request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
});

module.exports = router;
