const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendContactFormEmail } = require('../config/email');

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message, subject, formType } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'email', 'message']
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await pool.query(
      `INSERT INTO contact_submissions 
       (name, email, phone, message, subject, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone || null, message, subject || null, 'new']
    );

    try {
      await sendContactFormEmail({
        name,
        email,
        phone,
        message,
        subject,
        formType: formType || 'General Contact'
      });
      console.log(`✅ Email notification sent for submission from ${email}`);
    } catch (emailError) {
      console.error('⚠️  Failed to send email notification:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Contact submission received successfully',
      submission: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating contact submission:', error);
    res.status(500).json({ 
      error: 'Failed to submit contact form',
      details: error.message
    });
  }
});

module.exports = router;
