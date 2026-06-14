const express = require('express');
const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { sendEmailVerificationToTraveler } = require('../utils/expert-trips-email');
const { logAction } = require('../utils/logger');
const { sendAdminExpertTripNotification } = require('../config/email');

const router = express.Router();

// Helper: Calculate 20% commission
const calculateCommission = (amount) => {
  const commission = parseFloat((amount * 0.2).toFixed(2));
  const expertAmount = parseFloat((amount - commission).toFixed(2));
  return { commission, expertAmount };
};

// Helper: Parse JSON field
const parseJsonField = (field) => {
  if (!field) return [];
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  }
  return Array.isArray(field) ? field : [];
};

// ============ EXPERT TRIP CRUD ============

// GET all approved trips (browsable by travelers) - PUBLIC
// Includes both expert trips AND agency trips
// Only trips with status = 'approved' (admin approved) are visible
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { expertType, location, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const params = [];
    let paramCount = 1;
    
    // Check if filtering by specific creator type
    const isAgencyFilter = expertType === 'travel_agency';
    const isDiveCenterFilter = expertType === 'dive_center';
    
    let query;
    
    if (isAgencyFilter) {
      // Only agency trips
      query = `
        SELECT 
          et.*, 
          ap.company_name as display_name, ap.logo_url as profile_photo, 
          'travel_agency' as expert_type, ap.slug as creator_slug,
          u.full_name, 'agency' as created_by_type, ap.id as agency_profile_id,
          NULL::integer as dive_center_id
        FROM expert_trips et
        JOIN agency_profiles ap ON et.agency_id = ap.id
        JOIN users u ON et.user_id = u.id
        WHERE et.status = 'approved' AND et.created_by_type = 'agency'
      `;
    } else if (isDiveCenterFilter) {
      // Only dive center trips
      query = `
        SELECT 
          et.*, 
          dcp.center_name as display_name, dcp.logo_url as profile_photo, 
          'dive_center' as expert_type, dcp.slug as creator_slug,
          u.full_name, 'dive_center' as created_by_type, dcp.id as dive_center_id,
          NULL::integer as agency_id
        FROM expert_trips et
        JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
        JOIN users u ON et.user_id = u.id
        WHERE et.status = 'approved' AND et.created_by_type = 'dive_center'
      `;
    } else {
      // Combined query: expert trips + agency trips + dive center trips (using UNION)
      query = `
        SELECT * FROM (
          SELECT 
            et.id, et.title, et.description, et.price, et.kids_price, et.currency,
            et.location, et.duration, et.max_group_size, et.image, et.expert_type,
            et.trip_type, et.rating, et.total_reviews, et.status, et.highlights,
            et.requirements, et.included_services, et.excluded_services, et.cancellation_policy,
            et.created_at, et.expert_id, et.agency_id, NULL::integer as dive_center_id,
            ep.display_name, ep.profile_photo, ep.slug as creator_slug,
            u.full_name, 'expert' as created_by_type
          FROM expert_trips et
          JOIN expert_profiles ep ON et.expert_id = ep.id
          JOIN users u ON et.user_id = u.id
          WHERE et.status = 'approved' AND (et.created_by_type = 'expert' OR et.created_by_type IS NULL)
          
          UNION ALL
          
          SELECT 
            et.id, et.title, et.description, et.price, et.kids_price, et.currency,
            et.location, et.duration, et.max_group_size, et.image, 'travel_agency' as expert_type,
            et.trip_type, et.rating, et.total_reviews, et.status, et.highlights,
            et.requirements, et.included_services, et.excluded_services, et.cancellation_policy,
            et.created_at, et.expert_id, et.agency_id, NULL::integer as dive_center_id,
            ap.company_name as display_name, ap.logo_url as profile_photo, ap.slug as creator_slug,
            u.full_name, 'agency' as created_by_type
          FROM expert_trips et
          JOIN agency_profiles ap ON et.agency_id = ap.id
          JOIN users u ON et.user_id = u.id
          WHERE et.status = 'approved' AND et.created_by_type = 'agency'
          
          UNION ALL
          
          SELECT 
            et.id, et.title, et.description, et.price, et.kids_price, et.currency,
            et.location, et.duration, et.max_group_size, et.image, 'dive_center' as expert_type,
            et.trip_type, et.rating, et.total_reviews, et.status, et.highlights,
            et.requirements, et.included_services, et.excluded_services, et.cancellation_policy,
            et.created_at, et.expert_id, NULL::integer as agency_id, et.dive_center_id,
            dcp.center_name as display_name, dcp.logo_url as profile_photo, dcp.slug as creator_slug,
            u.full_name, 'dive_center' as created_by_type
          FROM expert_trips et
          JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
          JOIN users u ON et.user_id = u.id
          WHERE et.status = 'approved' AND et.created_by_type = 'dive_center'
        ) combined
        WHERE 1=1
      `;
      
      if (expertType && expertType !== 'travel_agency' && expertType !== 'dive_center') {
        query += ` AND expert_type = $${paramCount}`;
        params.push(expertType);
        paramCount++;
      }
    }

    if (location) {
      query += ` AND location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const trips = result.rows.map(row => {
      const creatorType = row.created_by_type || 'expert';
      const isAgency = creatorType === 'agency';
      const isDiveCenter = creatorType === 'dive_center';
      const isExpert = !isAgency && !isDiveCenter;
      
      // Determine the creator's profile ID and slug
      let creatorId = row.expert_id;
      if (isAgency) creatorId = row.agency_id;
      else if (isDiveCenter) creatorId = row.dive_center_id;
      const creatorSlug = row.creator_slug || row.expert_slug;
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        price: parseFloat(row.price),
        kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
        currency: row.currency,
        location: row.location,
        duration: row.duration,
        max_group_size: row.max_group_size,
        image: row.image,
        expert_type: row.expert_type,
        trip_type: row.trip_type,
        expert_name: row.display_name,
        expert_slug: creatorSlug,
        expert_profile_id: isExpert ? row.expert_id : null,
        agency_id: isAgency ? row.agency_id : null,
        dive_center_id: isDiveCenter ? row.dive_center_id : null,
        created_by_type: creatorType,
        expertInfo: isExpert ? {
          id: row.expert_id,
          name: row.display_name,
          slug: creatorSlug,
          photo: row.profile_photo,
          rating: parseFloat(row.rating),
          reviews: row.total_reviews,
        } : null,
        agencyInfo: isAgency ? {
          id: row.agency_id,
          name: row.display_name,
          slug: creatorSlug,
          logo: row.profile_photo,
        } : null,
        diveCenterInfo: isDiveCenter ? {
          id: row.dive_center_id,
          name: row.display_name,
          slug: creatorSlug,
          logo: row.profile_photo,
        } : null,
        creatorInfo: {
          id: creatorId,
          type: creatorType,
          name: row.display_name,
          slug: creatorSlug,
          photo: row.profile_photo,
        },
        rating: parseFloat(row.rating),
        reviews: row.total_reviews,
        status: row.status,
        highlights: row.highlights,
        requirements: row.requirements,
        included_services: row.included_services,
        excluded_services: row.excluded_services,
        cancellation_policy: row.cancellation_policy,
      };
    });

    res.json({ trips, total: result.rows.length });
  } catch (error) {
    console.error('Get published trips error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET approved trips by expert profile ID - PUBLIC
// Only admin-approved trips are visible on expert profiles
router.get('/by-expert/:expertId', async (req, res) => {
  try {
    const { expertId } = req.params;

    const result = await pool.query(`
      SELECT 
        et.*, 
        ep.display_name, ep.profile_photo, ep.expert_type,
        u.full_name
      FROM expert_trips et
      JOIN expert_profiles ep ON et.expert_id = ep.id
      JOIN users u ON et.user_id = u.id
      WHERE et.expert_id = $1 AND et.status = 'approved'
      ORDER BY et.created_at DESC
    `, [expertId]);

    const trips = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
      currency: row.currency,
      location: row.location,
      duration: row.duration,
      max_group_size: row.max_group_size,
      image: row.image,
      expert_type: row.expert_type,
      trip_type: row.trip_type,
      expert_name: row.display_name,
      highlights: row.highlights,
      requirements: row.requirements,
      included_services: row.included_services,
      excluded_services: row.excluded_services,
    }));

    res.json({ trips });
  } catch (error) {
    console.error('Get trips by expert error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET my trips (Expert or Agency Dashboard) - MUST BE BEFORE /:tripId
router.get('/my-trips', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { status } = req.query;

    // Check if user is an expert
    const expertResult = await pool.query(
      `SELECT id FROM expert_profiles WHERE user_id = $1`,
      [userId]
    );

    // Check if user is an agency
    const agencyResult = await pool.query(
      `SELECT id FROM agency_profiles WHERE user_id = $1`,
      [userId]
    );

    const isExpert = expertResult.rows.length > 0;
    const isAgency = agencyResult.rows.length > 0;

    if (!isExpert && !isAgency) {
      return res.json({ trips: [] });
    }

    let query;
    let params;

    if (isAgency) {
      // Fetch trips by agency_id
      const agencyId = agencyResult.rows[0].id;
      query = `SELECT * FROM expert_trips WHERE agency_id = $1`;
      params = [agencyId];
    } else {
      // Fetch trips by expert_id
      const expertId = expertResult.rows[0].id;
      query = `SELECT * FROM expert_trips WHERE expert_id = $1`;
      params = [expertId];
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    const trips = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      location: row.location,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      bookings: row.total_bookings || 0,
      createdByType: row.created_by_type || 'expert'
    }));

    res.json({ trips });
  } catch (error) {
    console.error('Get my trips error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET approved trips by agency ID - PUBLIC
router.get('/by-agency/:agencyId', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const result = await pool.query(`
      SELECT 
        et.*, 
        ap.company_name, ap.logo_url, ap.slug as agency_slug,
        u.full_name
      FROM expert_trips et
      JOIN agency_profiles ap ON et.agency_id = ap.id
      JOIN users u ON et.user_id = u.id
      WHERE et.agency_id = $1 AND et.status = 'approved'
      ORDER BY et.created_at DESC
    `, [agencyId]);

    const trips = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
      currency: row.currency,
      location: row.location,
      duration: row.duration,
      max_group_size: row.max_group_size,
      image: row.image,
      trip_type: row.trip_type,
      agency_name: row.company_name,
      agency_slug: row.agency_slug,
      highlights: row.highlights,
      requirements: row.requirements,
      included_services: row.included_services,
      excluded_services: row.excluded_services,
      created_by_type: 'agency'
    }));

    res.json({ trips });
  } catch (error) {
    console.error('Get trips by agency error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET approved packages by dive center ID - PUBLIC
router.get('/by-dive-center/:diveCenterId', async (req, res) => {
  try {
    const { diveCenterId } = req.params;

    const result = await pool.query(`
      SELECT 
        et.*, 
        dcp.center_name, dcp.logo_url, dcp.slug as dive_center_slug,
        u.full_name
      FROM expert_trips et
      JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
      JOIN users u ON et.user_id = u.id
      WHERE et.dive_center_id = $1 AND et.status = 'approved'
      ORDER BY et.created_at DESC
    `, [diveCenterId]);

    const trips = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
      currency: row.currency,
      location: row.location,
      duration: row.duration,
      max_group_size: row.max_group_size,
      image: row.image,
      trip_type: row.trip_type,
      dive_center_name: row.center_name,
      dive_center_slug: row.dive_center_slug,
      highlights: row.highlights,
      requirements: row.requirements,
      included_services: row.included_services,
      excluded_services: row.excluded_services,
      created_by_type: 'dive_center'
    }));

    res.json({ trips });
  } catch (error) {
    console.error('Get trips by dive center error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET single trip details (supports both expert and agency trips, lookup by numeric ID only)
router.get('/:tripId', optionalAuth, async (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Only accept numeric IDs for expert_trips (no slug column in this table)
    const isNumericId = /^\d+$/.test(tripId);
    if (!isNumericId) {
      return res.status(404).json({ error: 'Not Found', message: 'Trip not found' });
    }
    
    // First, get the trip to check if it's an agency or expert trip
    const tripCheck = await pool.query(
      `SELECT id, created_by_type, agency_id, expert_id FROM expert_trips WHERE id = $1 AND status = 'approved'`,
      [tripId]
    );

    if (tripCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Trip not found' });
    }

    const { created_by_type, agency_id, expert_id } = tripCheck.rows[0];
    let result;
    
    // Handle both explicit agency trips and legacy trips with agency_id but null created_by_type
    const isAgency = (created_by_type === 'agency') || (agency_id && !expert_id);

    if (isAgency && agency_id) {
      // Agency trip query
      result = await pool.query(`
        SELECT 
          et.*, 
          ap.company_name, ap.logo_url as profile_photo, ap.slug as creator_slug, ap.whatsapp, ap.company_description as bio,
          u.full_name, u.email
        FROM expert_trips et
        JOIN agency_profiles ap ON et.agency_id = ap.id
        JOIN users u ON et.user_id = u.id
        WHERE et.id = $1 AND et.status = 'approved'
      `, [tripId]);
    } else {
      // Expert trip query (default)
      result = await pool.query(`
        SELECT 
          et.*, 
          ep.display_name, ep.profile_photo, ep.expert_type, ep.whatsapp, ep.bio, ep.slug as creator_slug,
          u.full_name, u.email
        FROM expert_trips et
        JOIN expert_profiles ep ON et.expert_id = ep.id
        JOIN users u ON et.user_id = u.id
        WHERE et.id = $1 AND et.status = 'approved'
      `, [tripId]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Trip not found' });
    }

    const row = result.rows[0];
    const isAgencyTrip = isAgency;

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
      currency: row.currency,
      location: row.location,
      duration: row.duration,
      maxGroupSize: row.max_group_size,
      startDate: row.start_date,
      endDate: row.end_date,
      image: row.image,
      expertType: row.expert_type,
      tripType: row.trip_type,
      highlights: parseJsonField(row.highlights),
      requirements: parseJsonField(row.requirements),
      includedServices: parseJsonField(row.included_services),
      excludedServices: parseJsonField(row.excluded_services),
      cancellationPolicy: row.cancellation_policy,
      createdByType: created_by_type || 'expert',
      creatorInfo: isAgencyTrip ? {
        id: row.agency_id,
        type: 'agency',
        name: row.company_name,
        slug: row.creator_slug,
        email: row.email,
        photo: row.profile_photo,
        whatsapp: row.whatsapp,
        bio: row.bio,
      } : {
        id: row.expert_id,
        type: 'expert',
        name: row.display_name,
        slug: row.creator_slug,
        email: row.email,
        photo: row.profile_photo,
        whatsapp: row.whatsapp,
        bio: row.bio,
        rating: parseFloat(row.rating),
        reviews: row.total_reviews,
      },
      expertInfo: !isAgencyTrip ? {
        id: row.expert_id,
        name: row.display_name,
        email: row.email,
        photo: row.profile_photo,
        whatsapp: row.whatsapp,
        bio: row.bio,
        rating: parseFloat(row.rating),
        reviews: row.total_reviews,
      } : null,
      agencyInfo: isAgencyTrip ? {
        id: row.agency_id,
        name: row.company_name,
        slug: row.creator_slug,
        logo: row.profile_photo,
        whatsapp: row.whatsapp,
      } : null,
      rating: parseFloat(row.rating),
      reviews: row.total_reviews,
      bookings: row.total_bookings,
    });
  } catch (error) {
    console.error('Get trip details error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// CREATE new trip (Expert, Agency, or Dive Center) - DRAFT
router.post('/create', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check if user is an expert
    const expertResult = await pool.query(
      `SELECT id, expert_type FROM expert_profiles WHERE user_id = $1`,
      [userId]
    );

    // Check if user is an agency
    const agencyResult = await pool.query(
      `SELECT id, company_name FROM agency_profiles WHERE user_id = $1`,
      [userId]
    );

    // Check if user is a dive center
    const diveCenterResult = await pool.query(
      `SELECT id, center_name FROM dive_center_profiles WHERE user_id = $1`,
      [userId]
    );

    const isExpert = expertResult.rows.length > 0;
    const isAgency = agencyResult.rows.length > 0;
    const isDiveCenter = diveCenterResult.rows.length > 0;

    if (!isExpert && !isAgency && !isDiveCenter) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only experts (guides, divers, mentors), agencies, or dive centers can create trips'
      });
    }

    const {
      title,
      description,
      tripType,
      price,
      kidsPrice,
      currency,
      location,
      duration,
      maxGroupSize,
      startDate,
      endDate,
      image,
      highlights,
      requirements,
      includedServices,
      excludedServices,
      cancellationPolicy,
      divingType,
      divingLevel,
      certificationAccepted,
      equipmentPolicy,
      targetAudience,
    } = req.body;

    if (!title || !description || !price || !location) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title, description, price, and location are required'
      });
    }

    let result;
    
    if (isDiveCenter) {
      // Dive Center package creation
      const diveCenterId = diveCenterResult.rows[0].id;
      
      // Store diving-specific fields in highlights/requirements as JSON
      const divingMetadata = {
        divingType: divingType || [],
        divingLevel: divingLevel || '',
        certificationAccepted: certificationAccepted || [],
        equipmentPolicy: equipmentPolicy || '',
        targetAudience: targetAudience || []
      };
      
      result = await pool.query(
        `INSERT INTO expert_trips (
          user_id, dive_center_id, created_by_type, title, description, expert_type, trip_type, price, kids_price,
          currency, location, duration, max_group_size, start_date, end_date, 
          image, highlights, requirements, included_services, excluded_services, 
          cancellation_policy, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          userId, diveCenterId, 'dive_center', title, description, 'dive_center', tripType || 'Diving Package', price, kidsPrice || 0, currency,
          location, duration, maxGroupSize, startDate, endDate, image,
          JSON.stringify(highlights || []),
          JSON.stringify({ ...divingMetadata, requirements: requirements || [] }),
          JSON.stringify(includedServices || []),
          JSON.stringify(excludedServices || []),
          cancellationPolicy,
          'draft'
        ]
      );
    } else if (isAgency) {
      // Agency trip creation
      const agencyId = agencyResult.rows[0].id;
      
      result = await pool.query(
        `INSERT INTO expert_trips (
          user_id, agency_id, created_by_type, title, description, trip_type, price, kids_price,
          currency, location, duration, max_group_size, start_date, end_date, 
          image, highlights, requirements, included_services, excluded_services, 
          cancellation_policy, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *`,
        [
          userId, agencyId, 'agency', title, description, tripType, price, kidsPrice || 0, currency,
          location, duration, maxGroupSize, startDate, endDate, image,
          JSON.stringify(highlights || []),
          JSON.stringify(requirements || []),
          JSON.stringify(includedServices || []),
          JSON.stringify(excludedServices || []),
          cancellationPolicy,
          'draft'
        ]
      );
    } else {
      // Expert trip creation (existing logic)
      const expertId = expertResult.rows[0].id;
      const expertType = expertResult.rows[0].expert_type;

      result = await pool.query(
        `INSERT INTO expert_trips (
          expert_id, user_id, created_by_type, title, description, expert_type, trip_type, price, kids_price,
          currency, location, duration, max_group_size, start_date, end_date, 
          image, highlights, requirements, included_services, excluded_services, 
          cancellation_policy, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          expertId, userId, 'expert', title, description, expertType, tripType, price, kidsPrice || 0, currency,
          location, duration, maxGroupSize, startDate, endDate, image,
          JSON.stringify(highlights || []),
          JSON.stringify(requirements || []),
          JSON.stringify(includedServices || []),
          JSON.stringify(excludedServices || []),
          cancellationPolicy,
          'draft'
        ]
      );
    }

    const trip = result.rows[0];

    res.status(201).json({
      message: 'Trip created successfully',
      trip: {
        id: trip.id,
        title: trip.title,
        status: trip.status,
        createdAt: trip.created_at,
        createdByType: trip.created_by_type,
      }
    });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// UPDATE trip (Expert) - Can edit DRAFT or APPROVED trips
router.put('/:tripId', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.userId;
    const {
      title, description, tripType, price, currency, location, duration,
      maxGroupSize, startDate, endDate, image, highlights, requirements,
      includedServices, excludedServices, cancellationPolicy, kidsPrice,
    } = req.body;

    // Verify ownership and get current trip
    const checkResult = await pool.query(
      `SELECT status FROM expert_trips WHERE id = $1 AND user_id = $2`,
      [tripId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trip not found or you do not own this trip'
      });
    }

    const currentStatus = checkResult.rows[0].status;
    
    // Allow editing DRAFT and APPROVED trips only
    if (currentStatus !== 'draft' && currentStatus !== 'approved') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only draft and approved trips can be edited'
      });
    }

    // If editing an approved trip, change status to pending_approval
    const newStatus = currentStatus === 'approved' ? 'pending_approval' : 'draft';

    const updateResult = await pool.query(
      `UPDATE expert_trips SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        trip_type = COALESCE($3, trip_type),
        price = COALESCE($4, price),
        kids_price = COALESCE($5, kids_price),
        currency = COALESCE($6, currency),
        location = COALESCE($7, location),
        duration = COALESCE($8, duration),
        max_group_size = COALESCE($9, max_group_size),
        start_date = COALESCE($10, start_date),
        end_date = COALESCE($11, end_date),
        image = COALESCE($12, image),
        highlights = COALESCE($13, highlights),
        requirements = COALESCE($14, requirements),
        included_services = COALESCE($15, included_services),
        excluded_services = COALESCE($16, excluded_services),
        cancellation_policy = COALESCE($17, cancellation_policy),
        status = $18,
        updated_at = NOW()
      WHERE id = $19
      RETURNING *`,
      [
        title, description, tripType, price, kidsPrice, currency, location, duration, maxGroupSize,
        startDate, endDate, image,
        highlights ? JSON.stringify(highlights) : undefined,
        requirements ? JSON.stringify(requirements) : undefined,
        includedServices ? JSON.stringify(includedServices) : undefined,
        excludedServices ? JSON.stringify(excludedServices) : undefined,
        cancellationPolicy, newStatus, tripId
      ]
    );

    const trip = updateResult.rows[0];

    // If status changed to pending_approval, send admin notification
    if (currentStatus === 'approved' && newStatus === 'pending_approval') {
      // Get expert info for admin notification
      const expertResult = await pool.query(
        `SELECT ep.display_name, u.full_name 
         FROM expert_profiles ep 
         JOIN users u ON ep.user_id = u.id 
         WHERE ep.user_id = $1`,
        [userId]
      );
      const expert = expertResult.rows[0] || { display_name: 'Unknown Expert' };

      // Send admin notification for re-submitted trip (non-blocking)
      sendAdminExpertTripNotification(trip, expert).catch(err => {
        console.error('❌ Admin expert trip notification error:', err.message);
      });
      console.log("ADMIN EMAIL SENT: expert trip submitted", trip.id);
    }

    res.json({
      message: currentStatus === 'approved' 
        ? 'Trip updated and sent back for admin approval' 
        : 'Trip updated successfully',
      trip: { 
        id: trip.id, 
        status: trip.status,
        wasPreviouslyApproved: currentStatus === 'approved'
      }
    });
  } catch (error) {
    console.error('Update trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// SUBMIT for approval (Expert or Agency changes status from DRAFT to PENDING)
router.post('/:tripId/submit-approval', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.userId;

    // First check the trip exists and belongs to user, AND has required image
    const checkResult = await pool.query(
      `SELECT * FROM expert_trips WHERE id = $1 AND user_id = $2`,
      [tripId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trip not found or does not belong to you'
      });
    }

    const tripToCheck = checkResult.rows[0];

    // Validate trip status is draft
    if (tripToCheck.status !== 'draft') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trip must be in draft status to submit for approval'
      });
    }

    // MANDATORY: Trip must have an image
    if (!tripToCheck.image || tripToCheck.image.trim() === '') {
      return res.status(400).json({
        error: 'Image Required',
        message: 'Trip image is mandatory. Please upload a high-quality photo that represents your trip experience before submitting for approval.'
      });
    }

    const result = await pool.query(
      `UPDATE expert_trips SET status = 'pending_approval', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'draft'
       RETURNING *`,
      [tripId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trip must be in draft status to submit for approval'
      });
    }

    const trip = result.rows[0];
    const isAgencyTrip = trip.created_by_type === 'agency';
    const isDiveCenterTrip = trip.created_by_type === 'dive_center';
    let creatorInfo = { display_name: 'Unknown', type: 'expert' };

    if (isDiveCenterTrip && trip.dive_center_id) {
      // Get dive center info for admin notification
      const diveCenterResult = await pool.query(
        `SELECT dcp.center_name, u.full_name 
         FROM dive_center_profiles dcp 
         JOIN users u ON dcp.user_id = u.id 
         WHERE dcp.id = $1`,
        [trip.dive_center_id]
      );
      if (diveCenterResult.rows.length > 0) {
        creatorInfo = { 
          display_name: diveCenterResult.rows[0].center_name, 
          full_name: diveCenterResult.rows[0].full_name,
          type: 'dive_center' 
        };
      }
    } else if (isAgencyTrip && trip.agency_id) {
      // Get agency info for admin notification
      const agencyResult = await pool.query(
        `SELECT ap.company_name, u.full_name 
         FROM agency_profiles ap 
         JOIN users u ON ap.user_id = u.id 
         WHERE ap.id = $1`,
        [trip.agency_id]
      );
      if (agencyResult.rows.length > 0) {
        creatorInfo = { 
          display_name: agencyResult.rows[0].company_name, 
          full_name: agencyResult.rows[0].full_name,
          type: 'agency' 
        };
      }
    } else if (trip.expert_id) {
      // Get expert info for admin notification
      const expertResult = await pool.query(
        `SELECT ep.display_name, u.full_name 
         FROM expert_profiles ep 
         JOIN users u ON ep.user_id = u.id 
         WHERE ep.id = $1`,
        [trip.expert_id]
      );
      if (expertResult.rows.length > 0) {
        creatorInfo = { 
          display_name: expertResult.rows[0].display_name, 
          full_name: expertResult.rows[0].full_name,
          type: 'expert' 
        };
      }
    }

    // Send admin notification for new trip submission (non-blocking)
    sendAdminExpertTripNotification(trip, creatorInfo).catch(err => {
      console.error('❌ Admin trip notification error:', err.message);
    });
    console.log(`ADMIN EMAIL SENT: ${creatorInfo.type} trip submitted`, trip.id);

    res.json({
      message: 'Trip submitted for admin approval',
      trip: { id: trip.id, status: trip.status, createdByType: trip.created_by_type }
    });
  } catch (error) {
    console.error('Submit for approval error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// DEPRECATED: Publish endpoint removed - Approved trips are automatically visible
// Admin approval (status = 'approved') is now the single source of truth for public visibility
// This endpoint kept for backwards compatibility, returns success if trip is approved
router.post('/:tripId/publish', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.userId;

    const checkResult = await pool.query(
      `SELECT * FROM expert_trips WHERE id = $1 AND user_id = $2`,
      [tripId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Trip not found or does not belong to you'
      });
    }

    const trip = checkResult.rows[0];
    
    // Approved trips are automatically visible - no separate "publish" step needed
    if (trip.status === 'approved') {
      return res.json({
        message: 'Trip is already approved and visible to the public',
        trip: { id: trip.id, status: trip.status }
      });
    }

    // If not approved, guide user to submit for approval
    res.status(403).json({
      error: 'Forbidden',
      message: `Trip must be approved by admin before it becomes visible. Current status: ${trip.status}. Please submit for approval first.`
    });
  } catch (error) {
    console.error('Publish trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ BOOKING ============

// CREATE booking with Stripe checkout (Guest Checkout)
router.post('/:tripId/book', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { travelers, adultTravelers, kidTravelers, travelerName, travelerEmail, travelerPhone, specialRequests } = req.body;

    if (!travelers || !travelerName || !travelerEmail || !travelerPhone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Travelers, name, email, and phone are required'
      });
    }

    // Get trip details
    const tripResult = await pool.query(
      `SELECT et.*, ep.display_name FROM expert_trips et 
       JOIN expert_profiles ep ON et.expert_id = ep.id
       WHERE et.id = $1 AND et.status = 'approved'`,
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Trip not found or not available'
      });
    }

    const trip = tripResult.rows[0];
    const adultPrice = parseFloat(trip.price);
    const kidsPrice = parseFloat(trip.kids_price || 0);
    const totalAmount = (adultTravelers || travelers) * adultPrice + (kidTravelers || 0) * kidsPrice;

    // Create booking record first
    const bookingResult = await pool.query(
      `INSERT INTO expert_trip_bookings (
        trip_id, traveler_name, traveler_email, traveler_phone, 
        travelers, total_amount, currency, special_requests, booking_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [tripId, travelerName, travelerEmail, travelerPhone, travelers, totalAmount, trip.currency, specialRequests, 'pending_payment']
    );

    const booking = bookingResult.rows[0];

    // Create Stripe checkout session
    try {
      // Calculate 20% commission split
    const commission = parseFloat((totalAmount * 0.2).toFixed(2));
    const expertAmount = parseFloat((totalAmount - commission).toFixed(2));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: travelerEmail,
        line_items: [
          {
            price_data: {
              currency: (trip.currency || 'USD').toLowerCase(),
              product_data: {
                name: trip.title,
                description: `${trip.expert_type} trip by ${trip.display_name}`,
              },
              unit_amount: Math.round(totalAmount * 100 / travelers),
            },
            quantity: travelers,
          },
        ],
        mode: 'payment',
        metadata: {
          bookingId: booking.id.toString(),
          tripId: tripId.toString(),
          expertId: trip.expert_id.toString(),
          commission: commission.toString(),
          expertAmount: expertAmount.toString(),
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/booking-success?bookingId=${booking.id}&sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/expert-trips-marketplace.html`,
      });

      // Send verification email with checkout link
      const verificationUrl = session.url;
      await sendEmailVerificationToTraveler(
        travelerEmail,
        travelerName,
        booking.id,
        trip.title,
        totalAmount,
        verificationUrl
      ).catch(err => console.error('Email send error (non-blocking):', err));

      await logAction('booking', null, travelerEmail, 'customer', 'success', `Booking created for trip ${tripId}`, { bookingId: booking.id, totalAmount, tripId });

      res.status(201).json({
        success: true,
        message: 'Booking created! Check your email to complete payment',
        booking: {
          id: booking.id,
          tripId: booking.trip_id,
          totalAmount: parseFloat(booking.total_amount),
          status: booking.booking_status,
        },
        checkout: {
          sessionId: session.id,
          redirectUrl: session.url
        }
      });
    } catch (stripeError) {
      console.error('Stripe checkout error:', stripeError);
      await logAction('booking', null, travelerEmail, 'customer', 'failed', `Payment setup failed: ${stripeError.message}`, { tripId, error: stripeError.message });
      res.status(400).json({
        success: false,
        message: 'Payment setup failed: ' + stripeError.message,
        booking: {
          id: booking.id,
          totalAmount: parseFloat(booking.total_amount),
        }
      });
    }
  } catch (error) {
    console.error('Create booking error:', error);
    await logAction('booking', null, req.body.travelerEmail || 'unknown', 'customer', 'error', error.message, { tripId: req.params.tripId });
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// GET booking details
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query(
      `SELECT etb.*, et.title, et.price, ep.display_name
       FROM expert_trip_bookings etb
       JOIN expert_trips et ON etb.trip_id = et.id
       JOIN expert_profiles ep ON et.expert_id = ep.id
       WHERE etb.id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const row = result.rows[0];

    res.json({
      id: row.id,
      tripId: row.trip_id,
      tripTitle: row.title,
      travelerName: row.traveler_name,
      travelerEmail: row.traveler_email,
      travelers: row.travelers,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency,
      status: row.booking_status,
      paymentStatus: row.payment_status,
      expertName: row.display_name,
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// ============ ADMIN ENDPOINTS ============

// GET pending trips for admin approval
router.get('/admin/pending', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        et.id, et.title, et.description, et.expert_type, et.trip_type, et.price, 
        COALESCE(et.kids_price, 0) as kids_price,
        et.location, et.duration, et.max_group_size, et.cancellation_policy,
        et.highlights, et.requirements, et.included_services, et.excluded_services,
        et.created_at, et.status, et.expert_id, et.created_by_type, et.agency_id, et.dive_center_id,
        ep.display_name as expert_name, ep.id as expert_profile_id,
        ap.company_name as agency_name,
        dcp.center_name as dive_center_name,
        u.email as expert_email
      FROM expert_trips et
      LEFT JOIN expert_profiles ep ON et.expert_id = ep.id
      LEFT JOIN agency_profiles ap ON et.agency_id = ap.id
      LEFT JOIN dive_center_profiles dcp ON et.dive_center_id = dcp.id
      JOIN users u ON et.user_id = u.id
      WHERE et.status IN ('draft', 'pending_approval')
      ORDER BY et.created_at DESC
    `);

    const trips = result.rows.map(row => {
      const isAgency = row.created_by_type === 'agency';
      const isDiveCenter = row.created_by_type === 'dive_center';
      
      let expertName = row.expert_name;
      if (isDiveCenter) expertName = row.dive_center_name;
      else if (isAgency) expertName = row.agency_name;
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        expert_name: expertName || 'Unknown',
        expert_id: row.expert_id,
        expert_profile_id: row.expert_profile_id,
        expert_email: row.expert_email,
        trip_type: row.trip_type,
        price: parseFloat(row.price) || 0,
        kids_price: row.kids_price ? parseFloat(row.kids_price) : 0,
        currency: row.currency,
        location: row.location,
        duration: row.duration || '',
        max_group_size: row.max_group_size || 0,
        status: row.status,
        created_at: row.created_at,
        created_by_type: row.created_by_type || 'expert',
        agency_id: row.agency_id,
        agency_name: row.agency_name,
        dive_center_id: row.dive_center_id,
        dive_center_name: row.dive_center_name,
        highlights: row.highlights,
        requirements: row.requirements,
        included_services: row.included_services,
        excluded_services: row.excluded_services,
        cancellation_policy: row.cancellation_policy,
      };
    });

    res.json({ trips });
  } catch (error) {
    console.error('Get pending trips error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// APPROVE trip (Admin)
router.post('/:tripId/approve', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    const result = await pool.query(
      `UPDATE expert_trips SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = result.rows[0];

    // Get expert email for notification
    const expertResult = await pool.query(
      `SELECT u.email, ep.display_name FROM users u JOIN expert_profiles ep ON u.id = ep.user_id WHERE ep.id = $1`,
      [trip.expert_id]
    );

    if (expertResult.rows.length > 0) {
      const { email, display_name } = expertResult.rows[0];
      // Email notification would be sent here
      console.log(`📧 Approval email would be sent to ${email} (${display_name})`);
    }

    res.json({ success: true, message: 'Trip approved', trip });
  } catch (error) {
    console.error('Approve trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// REJECT trip (Admin)
router.post('/:tripId/reject', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { rejection_reason } = req.body;

    const result = await pool.query(
      `UPDATE expert_trips SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [rejection_reason || 'No reason provided', tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = result.rows[0];

    // Get expert email for notification
    const expertResult = await pool.query(
      `SELECT u.email, ep.display_name FROM users u JOIN expert_profiles ep ON u.id = ep.user_id WHERE ep.id = $1`,
      [trip.expert_id]
    );

    if (expertResult.rows.length > 0) {
      const { email, display_name } = expertResult.rows[0];
      // Email notification would be sent here
      console.log(`📧 Rejection email would be sent to ${email} (${display_name})`);
    }

    res.json({ success: true, message: 'Trip rejected', trip });
  } catch (error) {
    console.error('Reject trip error:', error);
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

module.exports = router;
