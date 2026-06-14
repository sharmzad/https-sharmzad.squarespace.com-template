const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendEmail } = require('../utils/zeptomail');
const { wrapWithBranding, createInfoBox, COLORS, getFormattedTime } = require('../utils/emailBranding');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@egtravelmarket.com';

async function sendGuideRequestNotification(data) {
  const { guideName, guideEmail, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const guideContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      🎉 New Itinerary Request!
    </h2>
    
    <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6;">
      Great news! A traveler has requested a custom itinerary from you through EG Travel Market.
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

  const guideHtmlBody = wrapWithBranding(guideContentHtml, '🎉 New Itinerary Request', 'You have a new request from a traveler');

  try {
    await sendEmail(guideEmail, `New Itinerary Request from ${travelerName}`, guideHtmlBody, guideName);
  } catch (error) {
    console.error('Error sending guide notification email:', error);
  }
}

async function sendAdminRequestNotification(data) {
  const { guideName, guideId, travelerName, travelerEmail, travelerWhatsapp, message } = data;

  const adminContentHtml = `
    <h2 style="color: ${COLORS.primary}; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 10px;">
      📋 New Guide Itinerary Request
    </h2>
    
    ${createInfoBox(`
      <p style="margin: 10px 0;"><strong>Guide:</strong> ${guideName} (ID: ${guideId})</p>
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

  const adminHtmlBody = wrapWithBranding(adminContentHtml, '📋 Guide Request', 'New itinerary request submitted');

  try {
    await sendEmail(ADMIN_EMAIL, `Guide Request: ${travelerName} → ${guideName}`, adminHtmlBody);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
}

router.post('/', async (req, res) => {
  try {
    const { guideId, guideName, travelerName, travelerEmail, travelerWhatsapp, message } = req.body || {};

    if (!guideId || !travelerName || !travelerEmail || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields. Please fill in all required fields.' 
      });
    }

    const numericGuideId = parseInt(guideId, 10);
    if (isNaN(numericGuideId)) {
      return res.status(400).json({ success: false, message: 'Invalid guide ID' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(travelerEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const guideQuery = await pool.query(
      `SELECT ep.id, ep.display_name, ep.expert_type, u.email, u.is_active, u.approval_status
       FROM expert_profiles ep 
       JOIN users u ON ep.user_id = u.id 
       WHERE ep.id = $1`,
      [numericGuideId]
    );

    if (guideQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Guide not found' });
    }

    const guide = guideQuery.rows[0];

    if (!guide.is_active || guide.approval_status !== 'approved') {
      return res.status(400).json({ success: false, message: 'This guide is not currently available' });
    }

    if (!['guide', 'diver'].includes(guide.expert_type)) {
      return res.status(400).json({ success: false, message: 'This expert does not accept itinerary requests' });
    }

    const result = await pool.query(
      `INSERT INTO guide_itinerary_requests 
        (guide_id, guide_name, traveler_name, traveler_email, traveler_whatsapp, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [numericGuideId, guide.display_name, travelerName, travelerEmail, travelerWhatsapp || null, message]
    );

    sendGuideRequestNotification({
      guideName: guide.display_name,
      guideEmail: guide.email,
      travelerName,
      travelerEmail,
      travelerWhatsapp,
      message
    }).catch(err => console.error('Guide notification error:', err));

    sendAdminRequestNotification({
      guideName: guide.display_name,
      guideId,
      travelerName,
      travelerEmail,
      travelerWhatsapp,
      message
    }).catch(err => console.error('Admin notification error:', err));

    return res.json({ 
      success: true, 
      message: 'Your request has been sent successfully! The guide will contact you soon.',
      requestId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error creating guide request:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.get('/admin/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gir.*, ep.slug as guide_slug
       FROM guide_itinerary_requests gir
       LEFT JOIN expert_profiles ep ON gir.guide_id = ep.id
       ORDER BY gir.created_at DESC
       LIMIT 500`
    );

    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Error fetching guide requests:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/admin/:id/status', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status, adminNotes } = req.body;

    if (!['new', 'contacted', 'converted', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE guide_itinerary_requests 
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
       WHERE id = $3
       RETURNING id, status`,
      [status, adminNotes || null, requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    return res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error updating guide request:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
