const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const { verifyToken } = require('../middleware/auth');

// Helper: Check if user is expert
const isExpert = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM expert_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

// Helper: Check if user is agency
const isAgency = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM agency_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

// Helper: Check if user is dive center
const isDiveCenter = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM dive_center_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

// Helper: Get profile by user ID (checks all types)
const getProfile = async (userId) => {
  const expert = await isExpert(userId);
  if (expert) return { ...expert, type: 'expert', table: 'expert_profiles' };
  
  const agency = await isAgency(userId);
  if (agency) return { ...agency, type: 'agency', table: 'agency_profiles' };
  
  const diveCenter = await isDiveCenter(userId);
  if (diveCenter) return { ...diveCenter, type: 'divecenter', table: 'dive_center_profiles' };
  
  return null;
};

// Helper: Check if user is admin
const isAdmin = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE id = $1 AND user_type = 'admin'`,
    [userId]
  );
  return result.rows.length > 0;
};

// ============ EXPERT ROUTES ============

// GET bank details (expert, agency, or dive center)
router.get('/bank-details', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    res.json({
      bankAccountHolder: profile.bank_account_holder,
      bankName: profile.bank_name,
      bankAccountNumber: profile.bank_account_number ? profile.bank_account_number.slice(-4).padStart(profile.bank_account_number.length, '*') : null,
      bankIban: profile.bank_iban,
      bankCountry: profile.bank_country,
      paymentSetupComplete: profile.payment_setup_complete
    });
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE bank details (expert, agency, or dive center)
router.put('/bank-details', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    const { bankAccountHolder, bankName, bankAccountNumber, bankIban, bankCountry } = req.body;

    if (!bankAccountHolder || !bankName) {
      return res.status(400).json({ error: 'Bank account holder and bank name are required' });
    }

    if (!bankAccountNumber && !bankIban) {
      return res.status(400).json({ error: 'Either bank account number or IBAN is required' });
    }

    const result = await pool.query(
      `UPDATE ${profile.table} 
       SET bank_account_holder = $1,
           bank_name = $2,
           bank_account_number = $3,
           bank_iban = $4,
           bank_country = $5,
           payment_setup_complete = true,
           updated_at = NOW()
       WHERE user_id = $6
       RETURNING *`,
      [bankAccountHolder, bankName, bankAccountNumber, bankIban, bankCountry, userId]
    );

    res.json({
      message: 'Bank details updated successfully',
      paymentSetupComplete: true
    });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET payouts history (expert, agency, or dive center)
router.get('/my-payouts', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    let result, stats;

    if (profile.type === 'expert') {
      // Expert payouts
      result = await pool.query(
        `SELECT ep.*, etb.traveler_name, et.title, u.full_name as approved_by_name
         FROM expert_payouts ep
         LEFT JOIN expert_trip_bookings etb ON ep.booking_id = etb.id
         LEFT JOIN expert_trips et ON ep.trip_id = et.id
         LEFT JOIN users u ON ep.approved_by = u.id
         WHERE ep.expert_id = $1
         ORDER BY ep.created_at DESC`,
        [profile.id]
      );

      stats = await pool.query(
        `SELECT 
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved
         FROM expert_payouts
         WHERE expert_id = $1`,
        [profile.id]
      );
    } else if (profile.type === 'agency') {
      // Agency payouts
      result = await pool.query(
        `SELECT ap.*, u.full_name as approved_by_name
         FROM agency_payouts ap
         LEFT JOIN users u ON ap.approved_by = u.id
         WHERE ap.agency_id = $1
         ORDER BY ap.created_at DESC`,
        [profile.id]
      );

      stats = await pool.query(
        `SELECT 
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved
         FROM agency_payouts
         WHERE agency_id = $1`,
        [profile.id]
      );
    } else if (profile.type === 'divecenter') {
      // Dive center payouts
      result = await pool.query(
        `SELECT dp.*, u.full_name as approved_by_name
         FROM dive_center_payouts dp
         LEFT JOIN users u ON dp.approved_by = u.id
         WHERE dp.dive_center_id = $1
         ORDER BY dp.created_at DESC`,
        [profile.id]
      );

      stats = await pool.query(
        `SELECT 
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved
         FROM dive_center_payouts
         WHERE dive_center_id = $1`,
        [profile.id]
      );
    }

    res.json({
      payouts: result.rows,
      stats: stats.rows[0] || { total_paid: 0, total_pending: 0, total_approved: 0 }
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ADMIN ROUTES ============

// GET all pending payouts for admin dashboard (EXPERT + AGENCY + DIVE CENTER)
router.get('/admin/pending-payouts', verifyToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    // Expert payouts
    const expertPayouts = await pool.query(
      `SELECT 'expert' as type, ep.*, u.full_name as entity_name, u.email as entity_email,
              ep_profile.bank_account_holder, ep_profile.bank_name, ep_profile.bank_iban,
              ep_profile.bank_country, ep_profile.payment_setup_complete,
              COALESCE(etb.booking_status, 'N/A') as booking_status,
              COALESCE(etb.payment_status, 'N/A') as payment_status
       FROM expert_payouts ep
       JOIN expert_profiles ep_profile ON ep.expert_id = ep_profile.id
       JOIN users u ON ep_profile.user_id = u.id
       LEFT JOIN expert_trip_bookings etb ON ep.booking_id = etb.id
       WHERE ep.status IN ('pending', 'approved')`
    );


    // Agency payouts
    const agencyPayouts = await pool.query(
      `SELECT 'agency' as type, ap.*, u.full_name as entity_name, u.email as entity_email,
              apf.bank_account_holder, apf.bank_name, apf.bank_iban,
              apf.bank_country, apf.payment_setup_complete
       FROM agency_payouts ap
       JOIN agency_profiles apf ON ap.agency_id = apf.id
       JOIN users u ON apf.user_id = u.id
       WHERE ap.status IN ('pending', 'approved')`
    );

    // Dive center payouts
    const divecenterPayouts = await pool.query(
      `SELECT 'divecenter' as type, dp.*, u.full_name as entity_name, u.email as entity_email,
              dpf.bank_account_holder, dpf.bank_name, dpf.bank_iban,
              dpf.bank_country, dpf.payment_setup_complete
       FROM dive_center_payouts dp
       JOIN dive_center_profiles dpf ON dp.dive_center_id = dpf.id
       JOIN users u ON dpf.user_id = u.id
       WHERE dp.status IN ('pending', 'approved')`
    );

    // Combine all payouts
    const allPayouts = [
      ...expertPayouts.rows,
      ...agencyPayouts.rows,
      ...divecenterPayouts.rows
    ].sort((a, b) => {
      // Sort by status (approved first), then by date
      if (a.status !== b.status) {
        return a.status === 'approved' ? -1 : 1;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({
      payouts: allPayouts
    });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// APPROVE payout (after verification, ready for 1-week waiting period)
router.put('/admin/payouts/:payoutId/approve', verifyToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { payoutId } = req.params;
    const { notes } = req.body;

    // Get payout with booking date to calculate when it can be released
    const payoutCheckResult = await pool.query(
      `SELECT ep.*, etb.created_at as booking_date
       FROM expert_payouts ep
       JOIN expert_trip_bookings etb ON ep.booking_id = etb.id
       WHERE ep.id = $1`,
      [payoutId]
    );

    if (payoutCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    const payout = payoutCheckResult.rows[0];
    const bookingDate = new Date(payout.booking_date);
    const releaseDate = new Date(bookingDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `UPDATE expert_payouts 
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [req.user.userId, notes, payoutId]
    );

    res.json({
      message: 'Payout approved - waiting period active',
      payout: result.rows[0],
      waitingPeriod: {
        bookingDate: bookingDate.toISOString(),
        releaseDate: releaseDate.toISOString(),
        daysUntilRelease: Math.ceil((releaseDate - new Date()) / (24 * 60 * 60 * 1000))
      }
    });
  } catch (error) {
    console.error('Error approving payout:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PROCESS/RELEASE payout (manual transfer - no Stripe involved)
// Admin manually releases 80% to expert after 1 week waiting period
router.post('/admin/payouts/:payoutId/process', verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const admin = await isAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { payoutId } = req.params;
    const { transactionReference } = req.body; // For admin to track manual transfer (e.g., bank transfer ID)

    await client.query('BEGIN');

    // Get payout details with booking creation date
    const payoutResult = await client.query(
      `SELECT ep.*, etb.created_at as booking_date, 
              ep_profile.bank_iban, ep_profile.bank_account_number, 
              ep_profile.bank_account_holder, ep_profile.bank_name, u.email, u.full_name
       FROM expert_payouts ep
       JOIN expert_trip_bookings etb ON ep.booking_id = etb.id
       JOIN expert_profiles ep_profile ON ep.expert_id = ep_profile.id
       JOIN users u ON ep_profile.user_id = u.id
       WHERE ep.id = $1 AND ep.status = 'approved'`,
      [payoutId]
    );

    if (payoutResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payout not found or not approved' });
    }

    const payout = payoutResult.rows[0];

    // Check 1-week waiting period (7 days after booking)
    const bookingDate = new Date(payout.booking_date);
    const oneWeekLater = new Date(bookingDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now < oneWeekLater) {
      await client.query('ROLLBACK');
      const daysRemaining = Math.ceil((oneWeekLater - now) / (24 * 60 * 60 * 1000));
      return res.status(400).json({
        error: 'Payout locked during waiting period',
        message: `Cannot release until ${oneWeekLater.toISOString()}. Days remaining: ${daysRemaining}`,
        daysRemaining,
        releaseDate: oneWeekLater.toISOString()
      });
    }

    // Mark payout as released/paid
    await client.query(
      `UPDATE expert_payouts 
       SET status = 'paid',
           released_at = NOW(),
           transaction_reference = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [transactionReference || null, payoutId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Payout released successfully',
      payout: {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        expertName: payout.full_name,
        expertEmail: payout.email,
        bankAccountHolder: payout.bank_account_holder,
        bankName: payout.bank_name,
        bankIban: payout.bank_iban,
        transactionReference,
        status: 'paid',
        releasedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
