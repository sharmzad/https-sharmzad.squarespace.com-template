const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { sendRequestCreatedEmail, sendNewBidEmail, sendRequestApprovedEmail } = require('../utils/email');
const { sendAdminTravelRequestNotification } = require('../config/email');

const statusUpdateAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function generatePin() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function requireExpert(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  
  const expertTypes = ['guide', 'diver', 'mentor', 'agency', 'divecenter', 'expert'];
  if (!expertTypes.includes(req.user.userType)) {
    return res.status(403).json({ success: false, message: 'Experts only' });
  }
  
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

function checkRateLimit(ip, code) {
  const key = `${ip}:${code}`;
  const now = Date.now();
  const attempts = statusUpdateAttempts.get(key) || [];
  
  const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false;
  }
  
  recentAttempts.push(now);
  statusUpdateAttempts.set(key, recentAttempts);
  
  setTimeout(() => {
    const current = statusUpdateAttempts.get(key) || [];
    const filtered = current.filter(time => Date.now() - time < RATE_LIMIT_WINDOW);
    if (filtered.length === 0) {
      statusUpdateAttempts.delete(key);
    } else {
      statusUpdateAttempts.set(key, filtered);
    }
  }, RATE_LIMIT_WINDOW);
  
  return true;
}

router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      whatsapp,
      title,
      category,
      location,
      travelDate,
      travelers,
      budget,
      details,
      contactPreference
    } = req.body || {};

    if (!name || !email || !title || !travelDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    let code, pin, exists;
    do {
      code = generateCode();
      pin = generatePin();
      const check = await pool.query('SELECT id FROM guest_requests WHERE code = $1', [code]);
      exists = check.rows.length > 0;
    } while (exists);

    const insert = await pool.query(
      `INSERT INTO guest_requests
        (code, pin, name, email, whatsapp, title, category, location, travel_date, travelers, budget, details, contact_preference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [code, pin, name, email, whatsapp || null, title, category || null, location || null,
       travelDate || null, travelers || null, budget || null, details || null, contactPreference || null]
    );

    sendRequestCreatedEmail({ email, name, code, pin, title }).catch(err => {
      console.error('Error sending request confirmation email:', err);
    });

    // Send admin notification for new travel request (non-blocking)
    sendAdminTravelRequestNotification({
      code, name, email, whatsapp, title, category, location, travelDate, travelers, budget, details
    }).catch(err => {
      console.error('❌ Admin travel request notification error:', err.message);
    });

    return res.json({ success: true, code, pin });
  } catch (err) {
    console.error('Error creating guest request', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/view', async (req, res) => {
  try {
    const { code, pin } = req.body || {};
    if (!code || !pin) {
      return res.status(400).json({ success: false, message: 'Code and PIN required' });
    }

    const q = await pool.query(
      'SELECT * FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = q.rows[0];

    const bidsQ = await pool.query(
      `SELECT 
        grb.id, 
        grb.expert_id as provider_id, 
        grb.expert_name as provider_name, 
        grb.expert_type as provider_type, 
        grb.price, 
        grb.currency, 
        grb.message, 
        grb.status, 
        grb.created_at,
        COALESCE(ep.slug, ap.slug, dcp.slug) as provider_slug,
        COALESCE(ep.is_verified, ap.is_verified, dcp.is_verified, false) as is_verified
       FROM guest_request_bids grb
       LEFT JOIN expert_profiles ep ON grb.expert_id = ep.user_id AND grb.expert_type IN ('guide', 'diver', 'mentor')
       LEFT JOIN agency_profiles ap ON grb.expert_id = ap.user_id AND grb.expert_type = 'agency'
       LEFT JOIN dive_center_profiles dcp ON grb.expert_id = dcp.user_id AND grb.expert_type IN ('divecenter', 'dive_center')
       WHERE grb.request_id = $1 
       ORDER BY grb.created_at DESC`,
      [request.id]
    );

    return res.json({
      success: true,
      request: {
        ...request,
        final_price: request.final_price,
        accepted_offer_id: request.accepted_offer_id
      },
      bids: bidsQ.rows,
      accepted_offer_id: request.accepted_offer_id,
      final_price: request.final_price
    });
  } catch (err) {
    console.error('Error viewing guest request', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const requestsQ = await pool.query(
      `SELECT id, code, name, email, whatsapp, title, category, location, travel_date, travelers, budget, details, status, approval_status, created_at
       FROM guest_requests
       ORDER BY created_at DESC
       LIMIT 500`
    );

    const requests = requestsQ.rows;
    const requestsWithBids = await Promise.all(requests.map(async (request) => {
      const bidsQ = await pool.query(
        'SELECT id, expert_name, expert_type, price, currency, message, status, created_at FROM guest_request_bids WHERE request_id = $1 ORDER BY created_at DESC',
        [request.id]
      );
      return { ...request, bids: bidsQ.rows };
    }));

    return res.json({ success: true, requests: requestsWithBids });
  } catch (err) {
    console.error('Error fetching admin requests', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin approve/reject traveller request
router.put('/admin/:id/approval', verifyToken, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { approval_status, notes } = req.body;

    if (!['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    const newStatus = approval_status === 'approved' ? 'open' : 'closed';

    // Get current request data for email
    const currentQ = await pool.query(
      'SELECT email, name, code, pin, title, approval_status FROM guest_requests WHERE id = $1',
      [requestId]
    );

    if (currentQ.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const currentRequest = currentQ.rows[0];

    const result = await pool.query(
      `UPDATE guest_requests 
       SET approval_status = $1, admin_notes = COALESCE($2, admin_notes), status = $3
       WHERE id = $4
       RETURNING id, approval_status, status`,
      [approval_status, notes || null, newStatus, requestId]
    );

    // Send approval email to traveler (only if newly approved)
    if (approval_status === 'approved' && currentRequest.approval_status !== 'approved') {
      sendRequestApprovedEmail({
        email: currentRequest.email,
        name: currentRequest.name,
        code: currentRequest.code,
        pin: currentRequest.pin,
        title: currentRequest.title
      }).catch(err => {
        console.error('Error sending approval email:', err);
      });
    }

    return res.json({ success: true, message: `Request ${approval_status}`, request: result.rows[0] });
  } catch (err) {
    console.error('Error updating request approval:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin view single request (bypasses code/pin)
router.get('/admin/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    
    const requestQ = await pool.query(
      `SELECT id, code, pin, name, email, whatsapp, title, category, location, travel_date, travelers, budget, details, status, approval_status, admin_notes, contact_preference, created_at
       FROM guest_requests
       WHERE id = $1`,
      [requestId]
    );

    if (requestQ.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requestQ.rows[0];

    const bidsQ = await pool.query(
      `SELECT 
        grb.id, grb.expert_name, grb.expert_type, grb.price, grb.currency, 
        grb.message, grb.status, grb.created_at,
        COALESCE(ep.slug, ap.slug, dcp.slug) as expert_slug
       FROM guest_request_bids grb
       LEFT JOIN expert_profiles ep ON grb.expert_id = ep.user_id AND grb.expert_type IN ('guide', 'diver', 'mentor')
       LEFT JOIN agency_profiles ap ON grb.expert_id = ap.user_id AND grb.expert_type = 'agency'
       LEFT JOIN dive_center_profiles dcp ON grb.expert_id = dcp.user_id AND grb.expert_type = 'divecenter'
       WHERE grb.request_id = $1 
       ORDER BY grb.created_at DESC`,
      [requestId]
    );

    return res.json({
      success: true,
      request,
      bids: bidsQ.rows
    });
  } catch (err) {
    console.error('Error viewing admin request', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, location, dateFrom, dateTo, budgetMin, budgetMax } = req.query;
    
    console.log('📍 Fetching approved travel requests for providers');
    let query = `SELECT id, code, title, category, location, travel_date, travelers, budget, details, status, created_at, approval_status
                 FROM guest_requests
                 WHERE approval_status = 'approved' AND status = 'open'`;
    const params = [];
    let paramCount = 0;

    if (category && category !== 'all') {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (location) {
      paramCount++;
      query += ` AND LOWER(location) LIKE $${paramCount}`;
      params.push(`%${location.toLowerCase()}%`);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND travel_date >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND travel_date <= $${paramCount}`;
      params.push(dateTo);
    }

    if (budgetMin) {
      paramCount++;
      query += ` AND budget IS NOT NULL 
                 AND NULLIF(REGEXP_REPLACE(budget, '[^0-9.]', '', 'g'), '') IS NOT NULL
                 AND CAST(REGEXP_REPLACE(budget, '[^0-9.]', '', 'g') AS NUMERIC) >= $${paramCount}`;
      params.push(budgetMin);
    }

    if (budgetMax) {
      paramCount++;
      query += ` AND budget IS NOT NULL 
                 AND NULLIF(REGEXP_REPLACE(budget, '[^0-9.]', '', 'g'), '') IS NOT NULL
                 AND CAST(REGEXP_REPLACE(budget, '[^0-9.]', '', 'g') AS NUMERIC) <= $${paramCount}`;
      params.push(budgetMax);
    }

    query += ` ORDER BY created_at DESC LIMIT 200`;

    const q = await pool.query(query, params);
    return res.json({ success: true, requests: q.rows });
  } catch (err) {
    console.error('Error listing guest requests', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { code, pin, status } = req.body || {};

    if (!code || !pin || !status) {
      return res.status(400).json({ success: false, message: 'Code, PIN and status required' });
    }

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp, code)) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many attempts. Please wait 15 minutes before trying again.' 
      });
    }

    const validStatuses = ['open', 'closed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await pool.query(
      'UPDATE guest_requests SET status = $1 WHERE id = $2 AND code = $3 AND pin = $4 RETURNING id',
      [status, requestId, code, pin]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or invalid credentials' });
    }

    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    console.error('Error updating request status', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/history', async (req, res) => {
  try {
    const { code, pin } = req.body || {};
    if (!code || !pin) {
      return res.status(400).json({ success: false, message: 'Code and PIN required' });
    }

    const q = await pool.query(
      'SELECT * FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No requests found' });
    }

    const requests = q.rows;
    const requestsWithBids = await Promise.all(requests.map(async (request) => {
      const bidsQ = await pool.query(
        'SELECT id, expert_name, expert_type, price, currency, message, created_at FROM guest_request_bids WHERE request_id = $1 ORDER BY created_at DESC',
        [request.id]
      );
      return { ...request, bids: bidsQ.rows };
    }));

    return res.json({
      success: true,
      requests: requestsWithBids
    });
  } catch (err) {
    console.error('Error fetching request history', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper to check if user can send bids (experts or admin)
function requireExpertOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  
  const expertTypes = ['guide', 'diver', 'mentor', 'agency', 'divecenter', 'expert', 'admin'];
  if (!expertTypes.includes(req.user.userType)) {
    return res.status(403).json({ success: false, message: 'Experts or admin only' });
  }
  
  next();
}

router.post('/:id/bids', verifyToken, requireExpertOrAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { price, currency, message } = req.body || {};

    if (!requestId || !message) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const rq = await pool.query('SELECT id, email, title, code, status FROM guest_requests WHERE id = $1', [requestId]);
    if (rq.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = rq.rows[0];
    if (request.status !== 'open') {
      return res.status(400).json({ success: false, message: 'Request is not open' });
    }

    const expertId = req.user.userId;

    // Check for duplicate bid - one offer per provider per request
    const existingBid = await pool.query(
      'SELECT id FROM guest_request_bids WHERE request_id = $1 AND expert_id = $2',
      [requestId, expertId]
    );
    if (existingBid.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already sent an offer for this request. You can only send one offer per request.' });
    }
    let expertName = 'EgTravelMarket Expert';
    let expertType = req.user.userType || 'expert';

    // Admin offers get special labeling
    if (req.user.userType === 'admin') {
      expertName = 'EgTravelMarket Offer';
      expertType = 'admin';
    } else if (['guide', 'diver', 'mentor'].includes(req.user.userType)) {
      const profileQ = await pool.query(
        'SELECT display_name, expert_type FROM expert_profiles WHERE user_id = $1',
        [expertId]
      );
      if (profileQ.rows.length > 0) {
        expertName = profileQ.rows[0].display_name || expertName;
        expertType = profileQ.rows[0].expert_type || expertType;
      }
    } else if (req.user.userType === 'agency') {
      const agencyQ = await pool.query(
        'SELECT company_name FROM agency_profiles WHERE user_id = $1',
        [expertId]
      );
      if (agencyQ.rows.length > 0) {
        expertName = agencyQ.rows[0].company_name || expertName;
      }
    } else if (req.user.userType === 'divecenter') {
      const centerQ = await pool.query(
        'SELECT center_name FROM dive_center_profiles WHERE user_id = $1',
        [expertId]
      );
      if (centerQ.rows.length > 0) {
        expertName = centerQ.rows[0].center_name || expertName;
      }
    }

    await pool.query(
      `INSERT INTO guest_request_bids
        (request_id, expert_id, expert_name, expert_type, price, currency, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [requestId, expertId, expertName, expertType,
       price ? Number(price) : null, currency || null, message]
    );

    sendNewBidEmail({ email: request.email, title: request.title, code: request.code }).catch(err => {
      console.error('Error sending bid notification email:', err);
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Error creating bid', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:requestId/bids/:bidId', verifyToken, requireExpertOrAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    const bidId = parseInt(req.params.bidId, 10);
    const { price, currency, message } = req.body || {};

    if (!bidId || !message) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const bidCheck = await pool.query(
      'SELECT expert_id FROM guest_request_bids WHERE id = $1 AND request_id = $2',
      [bidId, requestId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bid not found' });
    }

    if (bidCheck.rows[0].expert_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own bids' });
    }

    await pool.query(
      'UPDATE guest_request_bids SET price = $1, currency = $2, message = $3 WHERE id = $4',
      [price ? Number(price) : null, currency || null, message, bidId]
    );

    return res.json({ success: true, message: 'Bid updated' });
  } catch (err) {
    console.error('Error updating bid', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:requestId/bids/:bidId', verifyToken, requireExpertOrAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    const bidId = parseInt(req.params.bidId, 10);

    const bidCheck = await pool.query(
      'SELECT expert_id FROM guest_request_bids WHERE id = $1 AND request_id = $2',
      [bidId, requestId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bid not found' });
    }

    if (bidCheck.rows[0].expert_id !== req.user.userId && req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own bids' });
    }

    await pool.query('DELETE FROM guest_request_bids WHERE id = $1', [bidId]);

    return res.json({ success: true, message: 'Bid deleted' });
  } catch (err) {
    console.error('Error deleting bid', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-bids', verifyToken, requireExpertOrAdmin, async (req, res) => {
  try {
    const expertId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        b.id as bid_id,
        b.price,
        b.currency,
        b.message,
        b.status,
        b.created_at as bid_created_at,
        r.id as request_id,
        r.title,
        r.category,
        r.location,
        r.travel_date,
        r.travelers,
        r.budget,
        r.status as request_status,
        r.created_at as request_created_at
      FROM guest_request_bids b
      INNER JOIN guest_requests r ON b.request_id = r.id
      WHERE b.expert_id = $1
      ORDER BY b.created_at DESC
    `, [expertId]);

    return res.json({ success: true, bids: result.rows });
  } catch (err) {
    console.error('Error fetching my bids', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/bids/:bidId/status', async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId, 10);
    const { code, pin, status } = req.body;

    if (!code || !pin || !status) {
      return res.status(400).json({ success: false, message: 'Code, PIN, and status required' });
    }

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const requestCheck = await pool.query(
      'SELECT id, accepted_offer_id FROM guest_requests WHERE code = $1 AND pin = $2',
      [code, pin]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid code or PIN' });
    }

    const requestId = requestCheck.rows[0].id;
    const existingAcceptedId = requestCheck.rows[0].accepted_offer_id;

    // Prevent accepting if already have an accepted offer
    if (status === 'accepted' && existingAcceptedId && existingAcceptedId !== bidId) {
      return res.status(400).json({ success: false, message: 'An offer has already been accepted for this request' });
    }

    const bidCheck = await pool.query(
      'SELECT id, expert_id, expert_name, expert_type, price, currency, message FROM guest_request_bids WHERE id = $1 AND request_id = $2',
      [bidId, requestId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bid not found for your request' });
    }

    const bid = bidCheck.rows[0];

    // Update bid status
    await pool.query(
      'UPDATE guest_request_bids SET status = $1 WHERE id = $2',
      [status, bidId]
    );

    // If accepting, update the request with accepted_offer_id, final_price, and status
    if (status === 'accepted') {
      await pool.query(
        'UPDATE guest_requests SET accepted_offer_id = $1, final_price = $2, status = $3 WHERE id = $4',
        [bidId, bid.price, 'accepted', requestId]
      );
    }

    // If rejecting a previously accepted offer, clear accepted_offer_id and final_price
    if (status === 'rejected' && existingAcceptedId === bidId) {
      await pool.query(
        'UPDATE guest_requests SET accepted_offer_id = NULL, final_price = NULL, status = $1 WHERE id = $2',
        ['open', requestId]
      );
    }

    return res.json({ 
      success: true, 
      message: `Bid ${status}`,
      acceptedOffer: status === 'accepted' ? {
        id: bid.id,
        provider_id: bid.expert_id,
        provider_name: bid.expert_name,
        provider_type: bid.expert_type,
        price: bid.price,
        currency: bid.currency
      } : null
    });
  } catch (err) {
    console.error('Error updating bid status', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
