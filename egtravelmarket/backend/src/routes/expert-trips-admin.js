const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Admin middleware
const requireAdmin = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
};

// ============ TRIP APPROVAL WORKFLOW ============

// GET all pending trips for approval (supports expert, agency, and dive center trips)
router.get('/pending-trips', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        et.id, et.title, et.description, et.expert_type, et.trip_type,
        et.price, et.kids_price, et.currency, et.location, et.duration, et.status,
        et.created_at, et.admin_notes, et.created_by_type, et.agency_id, et.dive_center_id,
        ep.id as expert_id, ep.display_name,
        ap.company_name as agency_name,
        dcp.center_name as dive_center_name,
        u.email, u.full_name
      FROM expert_trips et
      LEFT JOIN expert_profiles ep ON et.expert_id = ep.id
      LEFT JOIN agency_profiles ap ON et.agency_id = ap.id
      LEFT JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
      JOIN users u ON et.user_id = u.id
      WHERE et.status = 'pending_approval'
      ORDER BY et.created_at DESC
    `);

    const trips = result.rows.map(row => {
      const isAgencyTrip = row.created_by_type === 'agency';
      const isDiveCenterTrip = row.created_by_type === 'dive_center';
      
      let expertName = row.display_name;
      if (isDiveCenterTrip) expertName = row.dive_center_name;
      else if (isAgencyTrip) expertName = row.agency_name;
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        expertType: row.expert_type,
        tripType: row.trip_type,
        price: parseFloat(row.price),
        kidsPrice: row.kids_price ? parseFloat(row.kids_price) : null,
        currency: row.currency,
        location: row.location,
        duration: row.duration,
        createdByType: row.created_by_type || 'expert',
        expertId: row.expert_id,
        expertName: expertName,
        agencyId: row.agency_id,
        agencyName: row.agency_name,
        diveCenterId: row.dive_center_id,
        diveCenterName: row.dive_center_name,
        createdAt: row.created_at,
        adminNotes: row.admin_notes,
      };
    });

    res.json({ trips, total: trips.length });
  } catch (error) {
    console.error('Get pending trips error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET all trips (hidden and published) for admin review - supports both expert and agency trips
router.get('/all-trips', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        et.id, et.title, et.description, et.expert_type, et.trip_type,
        et.price, et.kids_price, et.currency, et.location, et.duration, et.status,
        et.created_at, et.admin_notes, et.cancellation_policy,
        et.highlights, et.requirements, et.included_services, et.excluded_services,
        et.created_by_type, et.agency_id, et.dive_center_id,
        ep.id as expert_id, ep.display_name,
        ap.company_name as agency_name, ap.slug as agency_slug,
        dcp.center_name as dive_center_name, dcp.slug as dive_center_slug,
        u.email, u.full_name
      FROM expert_trips et
      LEFT JOIN expert_profiles ep ON et.expert_id = ep.id
      LEFT JOIN agency_profiles ap ON et.agency_id = ap.id
      LEFT JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
      JOIN users u ON et.user_id = u.id
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` WHERE et.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY et.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const trips = result.rows.map(row => {
      const isAgencyTrip = row.created_by_type === 'agency';
      const isDiveCenterTrip = row.created_by_type === 'dive_center';
      
      let expertName = row.display_name;
      if (isDiveCenterTrip) expertName = row.dive_center_name;
      else if (isAgencyTrip) expertName = row.agency_name;
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        expertType: row.expert_type,
        tripType: row.trip_type,
        price: parseFloat(row.price),
        kidsPrice: row.kids_price ? parseFloat(row.kids_price) : null,
        currency: row.currency,
        location: row.location,
        duration: row.duration,
        status: row.status,
        createdByType: row.created_by_type || 'expert',
        expertId: row.expert_id,
        expertName: expertName,
        agencyId: row.agency_id,
        agencyName: row.agency_name,
        diveCenterId: row.dive_center_id,
        diveCenterName: row.dive_center_name,
        createdAt: row.created_at,
        cancellationPolicy: row.cancellation_policy,
        highlights: row.highlights,
        requirements: row.requirements,
        includedServices: row.included_services,
        excludedServices: row.excluded_services,
        adminNotes: row.admin_notes,
      };
    });

    res.json({ trips, total: result.rows.length });
  } catch (error) {
    console.error('Get all trips error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// APPROVE trip (Admin)
router.post('/:tripId/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;
    const adminNotes = req.body?.adminNotes || null;

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'approved', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending_approval'
       RETURNING *`,
      [adminNotes, tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not pending approval'
      });
    }

    const trip = result.rows[0];

    let expertEmail = null;
    try {
      if (trip.created_by_type === 'agency' && trip.agency_id) {
        const agencyResult = await pool.query(
          `SELECT u.email, ap.company_name as display_name FROM users u
           JOIN agency_profiles ap ON u.id = ap.user_id
           WHERE ap.id = $1`,
          [trip.agency_id]
        );
        expertEmail = agencyResult.rows[0]?.email;
      } else if (trip.created_by_type === 'dive_center' && trip.dive_center_id) {
        const dcResult = await pool.query(
          `SELECT u.email, dcp.center_name as display_name FROM users u
           JOIN dive_center_profiles dcp ON u.id = dcp.user_id
           WHERE dcp.id = $1`,
          [trip.dive_center_id]
        );
        expertEmail = dcResult.rows[0]?.email;
      } else if (trip.user_id) {
        const expertResult = await pool.query(
          `SELECT u.email, ep.display_name FROM users u
           LEFT JOIN expert_profiles ep ON u.id = ep.user_id
           WHERE u.id = $1`,
          [trip.user_id]
        );
        expertEmail = expertResult.rows[0]?.email;
      }
    } catch (emailErr) {
      console.error('Non-critical: Failed to fetch creator email:', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Trip approved successfully',
      trip: {
        id: trip.id,
        title: trip.title,
        status: trip.status,
        expertEmail: expertEmail,
      }
    });
  } catch (error) {
    console.error('Approve trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// REJECT trip (Admin)
router.post('/:tripId/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;
    const reason = req.body?.reason;

    if (!reason) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Rejection reason is required'
      });
    }

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'draft', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending_approval'
       RETURNING *`,
      [reason, tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not pending approval'
      });
    }

    res.json({
      message: 'Trip rejected - reverted to draft',
      trip: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Reject trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ TRIPS MANAGEMENT (ALL STATUSES) ============

// SUSPEND trip (Admin) - Hide from public, disable bookings
router.post('/:tripId/suspend', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;
    const reason = req.body?.reason;

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'suspended', admin_notes = COALESCE($1, admin_notes), updated_at = NOW()
       WHERE id = $2 AND status = 'approved'
       RETURNING *`,
      [reason || 'Suspended by admin', tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not currently approved'
      });
    }

    res.json({
      message: 'Trip suspended - hidden from public and bookings disabled',
      trip: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Suspend trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// UNSUSPEND trip (Admin) - Restore to approved status
router.post('/:tripId/unsuspend', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'approved', admin_notes = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'suspended'
       RETURNING *`,
      [tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not currently suspended'
      });
    }

    res.json({
      message: 'Trip reactivated - now visible and bookable',
      trip: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Unsuspend trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// REVOKE approval (Admin) - Move back to pending for re-review
router.post('/:tripId/revoke', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;
    const reason = req.body?.reason;

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'pending_approval', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('approved', 'suspended')
       RETURNING *`,
      [reason || 'Approval revoked - requires re-review', tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not in approved/suspended status'
      });
    }

    res.json({
      message: 'Trip approval revoked - moved to pending for re-review',
      trip: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Revoke trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// SOFT DELETE trip (Admin) - Mark as deleted, hide everywhere
router.delete('/:tripId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;
    const reason = req.body?.reason || 'Removed by admin';

    const result = await pool.query(
      `UPDATE expert_trips 
       SET status = 'deleted', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 AND status != 'deleted'
       RETURNING *`,
      [reason || 'Removed by admin', tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or already deleted'
      });
    }

    res.json({
      message: 'Trip removed (soft delete)',
      trip: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET bookings for a specific trip
router.get('/:tripId/bookings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tripId } = req.params;

    const result = await pool.query(`
      SELECT 
        etb.id, etb.traveler_name, etb.traveler_email, etb.traveler_phone,
        etb.travelers, etb.total_amount, etb.currency, etb.booking_status,
        etb.payment_status, etb.special_requests, etb.created_at
      FROM expert_trip_bookings etb
      WHERE etb.trip_id = $1
      ORDER BY etb.created_at DESC
    `, [tripId]);

    const bookings = result.rows.map(row => ({
      id: row.id,
      travelerName: row.traveler_name,
      travelerEmail: row.traveler_email,
      travelerPhone: row.traveler_phone,
      travelers: row.travelers,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency,
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status,
      specialRequests: row.special_requests,
      createdAt: row.created_at,
    }));

    res.json({ bookings, total: bookings.length });
  } catch (error) {
    console.error('Get trip bookings error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ BOOKING & PAYMENT MANAGEMENT ============

// GET all bookings
router.get('/bookings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        etb.id, etb.trip_id, etb.traveler_name, etb.traveler_email,
        etb.travelers, etb.total_amount, etb.currency, etb.booking_status,
        etb.payment_status, etb.created_at,
        et.title,
        ep.display_name
      FROM expert_trip_bookings etb
      JOIN expert_trips et ON etb.trip_id = et.id
      JOIN expert_profiles ep ON et.expert_id = ep.id
      ORDER BY etb.created_at DESC
      LIMIT 50
    `);

    const bookings = result.rows.map(row => ({
      id: row.id,
      tripTitle: row.title,
      travelerName: row.traveler_name,
      travelerEmail: row.traveler_email,
      travelers: row.travelers,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency,
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status,
      expertName: row.display_name,
      createdAt: row.created_at,
    }));

    res.json({ bookings, total: bookings.length });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET all disputes
router.get('/disputes', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        etd.id, etd.booking_id, etd.trip_id, etd.complainant_type,
        etd.reason, etd.description, etd.status, etd.created_at,
        etb.traveler_name, et.title, ep.display_name
      FROM expert_trip_disputes etd
      JOIN expert_trip_bookings etb ON etd.booking_id = etb.id
      JOIN expert_trips et ON etd.trip_id = et.id
      JOIN expert_profiles ep ON et.expert_id = ep.id
      ORDER BY etd.created_at DESC
    `);

    const disputes = result.rows.map(row => ({
      id: row.id,
      bookingId: row.booking_id,
      tripTitle: row.title,
      travelerName: row.traveler_name,
      complainantType: row.complainant_type,
      reason: row.reason,
      description: row.description,
      status: row.status,
      expertName: row.display_name,
      createdAt: row.created_at,
    }));

    res.json({ disputes, total: disputes.length });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// RESOLVE dispute (Admin)
router.post('/disputes/:disputeId/resolve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, refundAmount } = req.body;

    const result = await pool.query(
      `UPDATE expert_trip_disputes
       SET status = 'resolved', resolution = $1, refund_amount = $2, 
           resolved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolution, refundAmount || null, disputeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    res.json({
      message: 'Dispute resolved',
      dispute: { id: result.rows[0].id, status: result.rows[0].status }
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ MAINTENANCE ============

// FIX status mismatch - convert 'published' to 'approved' (one-time fix)
router.post('/fix-published-status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE expert_trips 
      SET status = 'approved', updated_at = NOW()
      WHERE status = 'published'
      RETURNING id, title
    `);

    console.log(`Fixed ${result.rows.length} trips from 'published' to 'approved'`);

    res.json({
      message: `Successfully fixed ${result.rows.length} trips`,
      fixedTrips: result.rows.map(r => ({ id: r.id, title: r.title })),
      count: result.rows.length
    });
  } catch (error) {
    console.error('Fix published status error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ STATISTICS ============

// GET expert trips statistics
router.get('/stats/overview', verifyToken, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_count,
        COUNT(CASE WHEN status = 'deleted' THEN 1 END) as deleted_count,
        COUNT(CASE WHEN status != 'deleted' THEN 1 END) as total_trips,
        SUM(CASE WHEN status = 'approved' THEN total_bookings ELSE 0 END) as total_bookings,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM expert_trips
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

module.exports = router;
