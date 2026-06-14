const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const requireAdmin = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  next();
};

// ============================================================
// ENSURE TABLE EXISTS ON STARTUP
// ============================================================
const ensureTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_finder_leads (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        nationality VARCHAR(100),
        adults INTEGER NOT NULL DEFAULT 1,
        children_ages TEXT,
        notes TEXT,
        dream_trip VARCHAR(255),
        first_time_egypt VARCHAR(100),
        travel_with VARCHAR(100),
        pace VARCHAR(100),
        duration VARCHAR(100),
        selected_experiences TEXT,
        comfort_level VARCHAR(100),
        travel_time VARCHAR(100),
        start_from VARCHAR(100),
        result_key VARCHAR(100),
        result_title VARCHAR(255),
        suggested_route TEXT,
        lead_temperature VARCHAR(50) DEFAULT 'Cold',
        source_page VARCHAR(100) DEFAULT 'trip-finder',
        status VARCHAR(100) DEFAULT 'New',
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tfl_status ON trip_finder_leads(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tfl_created ON trip_finder_leads(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tfl_temperature ON trip_finder_leads(lead_temperature)`);
    console.log('✅ trip_finder_leads table verified');
  } catch (err) {
    console.error('⚠️ trip_finder_leads table setup error:', err.message);
  }
};
ensureTable();

// ============================================================
// LEAD TEMPERATURE LOGIC
// ============================================================
function calcTemperature(travel_time, whatsapp) {
  if (!whatsapp) return 'Cold';
  if (travel_time === 'This month' || travel_time === 'Next 1–3 months') return 'Hot';
  if (travel_time === 'In 3–6 months') return 'Warm';
  return 'Cold';
}

// ============================================================
// POST /api/trip-finder/leads  — create new lead (public)
// ============================================================
router.post('/leads', async (req, res) => {
  try {
    const {
      full_name, whatsapp, email, nationality, adults, children_ages, notes,
      dream_trip, first_time_egypt, travel_with, pace, duration,
      selected_experiences, comfort_level, travel_time, start_from,
      result_key, result_title, suggested_route
    } = req.body;

    if (!full_name || !whatsapp || !adults) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['full_name', 'whatsapp', 'adults']
      });
    }

    const lead_temperature = calcTemperature(travel_time, whatsapp);
    const exp = Array.isArray(selected_experiences)
      ? selected_experiences.join(', ')
      : (selected_experiences || '');

    const result = await pool.query(
      `INSERT INTO trip_finder_leads
        (full_name, whatsapp, email, nationality, adults, children_ages, notes,
         dream_trip, first_time_egypt, travel_with, pace, duration,
         selected_experiences, comfort_level, travel_time, start_from,
         result_key, result_title, suggested_route, lead_temperature,
         source_page, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               'trip-finder','New',NOW(),NOW())
       RETURNING *`,
      [full_name, whatsapp, email || null, nationality || null, parseInt(adults) || 1,
       children_ages || null, notes || null, dream_trip || null, first_time_egypt || null,
       travel_with || null, pace || null, duration || null, exp || null,
       comfort_level || null, travel_time || null, start_from || null,
       result_key || null, result_title || null, suggested_route || null, lead_temperature]
    );

    console.log(`✅ Trip Finder Lead saved: ${full_name} (${lead_temperature})`);
    res.status(201).json({ success: true, lead: result.rows[0] });

  } catch (error) {
    console.error('Error saving trip finder lead:', error);
    res.status(500).json({ error: 'Failed to save lead', details: error.message });
  }
});

// ============================================================
// GET /api/trip-finder/leads  — list leads (admin only)
// ============================================================
router.get('/leads', verifyToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || '';
    const temperature = req.query.temperature || '';
    const search = req.query.search || '';

    let conditions = [];
    let params = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (temperature) { conditions.push(`lead_temperature = $${idx++}`); params.push(temperature); }
    if (search) {
      conditions.push(`(full_name ILIKE $${idx} OR whatsapp ILIKE $${idx} OR nationality ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit); params.push(offset);

    const result = await pool.query(
      `SELECT *, COUNT(*) OVER() AS total_count
       FROM trip_finder_leads
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'New') AS new_leads,
        COUNT(*) FILTER (WHERE lead_temperature = 'Hot') AS hot,
        COUNT(*) FILTER (WHERE lead_temperature = 'Warm') AS warm,
        COUNT(*) FILTER (WHERE status = 'Confirmed') AS confirmed
      FROM trip_finder_leads
    `);

    res.json({
      success: true,
      leads: result.rows,
      total: result.rows[0]?.total_count || 0,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error loading trip finder leads:', error);
    res.status(500).json({ error: 'Failed to load leads', details: error.message });
  }
});

// ============================================================
// GET /api/trip-finder/leads/:id  — single lead (admin only)
// ============================================================
router.get('/leads/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trip_finder_leads WHERE id = $1', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load lead', details: error.message });
  }
});

// ============================================================
// PATCH /api/trip-finder/leads/:id/status  — update status
// ============================================================
router.patch('/leads/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['New','Contacted','Quotation Needed','Quotation Sent','Follow Up','Confirmed','Lost'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE trip_finder_leads SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
});

// ============================================================
// PATCH /api/trip-finder/leads/:id/notes  — update admin notes
// ============================================================
router.patch('/leads/:id/notes', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const result = await pool.query(
      'UPDATE trip_finder_leads SET admin_notes=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [admin_notes || '', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notes', details: error.message });
  }
});

// ============================================================
// GET /api/trip-finder/leads/export/csv  — CSV export (admin)
// ============================================================
router.get('/leads/export/csv', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trip_finder_leads ORDER BY created_at DESC'
    );
    const headers = [
      'id','full_name','whatsapp','email','nationality','adults','children_ages',
      'dream_trip','first_time_egypt','travel_with','pace','duration',
      'selected_experiences','comfort_level','travel_time','start_from',
      'result_title','suggested_route','lead_temperature','status','admin_notes',
      'notes','created_at'
    ];

    const escapeCSV = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const csv = [
      headers.join(','),
      ...result.rows.map(row => headers.map(h => escapeCSV(row[h])).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="trip-finder-leads.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV', details: error.message });
  }
});

module.exports = router;
