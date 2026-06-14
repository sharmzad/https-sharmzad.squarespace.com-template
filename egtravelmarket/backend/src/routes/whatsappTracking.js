const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.post('/track', async (req, res) => {
  try {
    const { serviceName, whatsappNumber, pageSource } = req.body;
    
    if (!serviceName || !whatsappNumber || !pageSource) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['serviceName', 'whatsappNumber', 'pageSource']
      });
    }

    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';

    const result = await pool.query(
      `INSERT INTO whatsapp_clicks 
       (service_name, whatsapp_number, page_source, user_ip, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [serviceName, whatsappNumber, pageSource, userIp, userAgent, referrer]
    );

    console.log(`📱 WhatsApp click tracked: ${serviceName} on ${pageSource}`);
    
    res.json({ 
      success: true, 
      message: 'Click tracked successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error tracking WhatsApp click:', error);
    res.status(500).json({ 
      error: 'Failed to track click',
      message: error.message 
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM whatsapp_clicks 
       ORDER BY created_at DESC 
       LIMIT 1000`
    );

    const clicks = result.rows;

    const stats = {
      totalClicks: clicks.length,
      byService: {},
      byPage: {},
      recent: clicks.slice(0, 50),
    };

    clicks.forEach(click => {
      stats.byService[click.service_name] = (stats.byService[click.service_name] || 0) + 1;
      stats.byPage[click.page_source] = (stats.byPage[click.page_source] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching WhatsApp stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      message: error.message 
    });
  }
});

module.exports = router;
