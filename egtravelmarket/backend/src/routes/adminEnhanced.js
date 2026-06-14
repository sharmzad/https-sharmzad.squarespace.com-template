const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const requireAdmin = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ========== BOOKINGS MANAGEMENT ==========

// Get all bookings with filters
router.get('/bookings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, paymentStatus, startDate, endDate, search } = req.query;
    
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (paymentStatus) {
      paramCount++;
      query += ` AND payment_status = $${paramCount}`;
      params.push(paymentStatus);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND booking_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND booking_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (guest_name ILIKE $${paramCount} OR guest_email ILIKE $${paramCount} OR package_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_revenue
      FROM bookings
    `);
    
    res.json({
      success: true,
      bookings: result.rows,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking
router.put('/bookings/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, adminNotes, assignedTo } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (status) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    
    if (paymentStatus) {
      updates.push(`payment_status = $${paramCount}`);
      values.push(paymentStatus);
      paramCount++;
    }
    
    if (adminNotes !== undefined) {
      updates.push(`admin_notes = $${paramCount}`);
      values.push(adminNotes);
      paramCount++;
    }
    
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assignedTo);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `UPDATE bookings SET ${updates.join(', ')} 
                   WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true, booking: result.rows[0] });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// ========== TRAVELLER REQUESTS ENHANCEMENT ==========

// Add note to request
router.post('/requests/:id/notes', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { noteText } = req.body;
    
    if (!noteText) {
      return res.status(400).json({ error: 'Note text is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO admin_notes (entity_type, entity_id, note_text, created_by)
       VALUES ('guest_request', $1, $2, $3) RETURNING *`,
      [id, noteText, req.user.userId]
    );
    
    res.json({ success: true, note: result.rows[0] });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get notes for request
router.get('/requests/:id/notes', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT an.*, u.full_name as created_by_name 
       FROM admin_notes an
       LEFT JOIN users u ON an.created_by = u.id
       WHERE an.entity_type = 'guest_request' AND an.entity_id = $1
       ORDER BY an.created_at DESC`,
      [id]
    );
    
    res.json({ success: true, notes: result.rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Add tag to request
router.post('/requests/:id/tags', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tagName, tagColor } = req.body;
    
    if (!tagName) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO request_tags (request_id, tag_name, tag_color)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, tagName, tagColor || 'blue']
    );
    
    res.json({ success: true, tag: result.rows[0] });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Create offer for traveller request
router.post('/requests/:id/send-offer', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { expertName, expertType, price, currency, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Offer message is required' });
    }
    
    const request = await pool.query(
      'SELECT * FROM guest_requests WHERE id = $1',
      [id]
    );
    
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const result = await pool.query(
      `INSERT INTO guest_request_bids 
       (request_id, expert_id, expert_name, expert_type, price, currency, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.user.userId, expertName || 'egtravelmarket Admin', expertType || 'admin',
       price || null, currency || 'USD', message]
    );
    
    res.json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error sending offer:', error);
    res.status(500).json({ error: 'Failed to send offer' });
  }
});

// Update request priority
router.patch('/requests/:id/priority', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    
    const result = await pool.query(
      'UPDATE guest_requests SET priority = $1 WHERE id = $2 RETURNING *',
      [priority, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

// ========== WHATSAPP MANAGEMENT ==========

// Get WhatsApp messages log
router.get('/whatsapp/messages', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM whatsapp_messages WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM whatsapp_messages
    `);
    
    res.json({
      success: true,
      messages: result.rows,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching WhatsApp messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send WhatsApp message (logged)
router.post('/whatsapp/send', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { recipientPhone, recipientName, messageText, templateName, entityType, entityId } = req.body;
    
    if (!recipientPhone || !messageText) {
      return res.status(400).json({ error: 'Recipient phone and message text are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO whatsapp_messages 
       (recipient_phone, recipient_name, message_text, template_name, entity_type, entity_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [recipientPhone, recipientName, messageText, templateName, entityType, entityId, req.user.userId]
    );
    
    res.json({
      success: true,
      message: result.rows[0],
      whatsappUrl: `https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(messageText)}`
    });
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
    res.status(500).json({ error: 'Failed to log message' });
  }
});

// ========== USER MANAGEMENT ==========

// Search users
router.get('/users/search', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { query, userType, status } = req.query;
    
    let sql = 'SELECT id, email, full_name, phone, country, user_type, approval_status, created_at FROM users WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (query) {
      paramCount++;
      sql += ` AND (full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${query}%`);
    }
    
    if (userType) {
      paramCount++;
      sql += ` AND user_type = $${paramCount}`;
      params.push(userType);
    }
    
    if (status) {
      paramCount++;
      sql += ` AND approval_status = $${paramCount}`;
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const result = await pool.query(sql, params);
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get pending sign-ups with FULL profile details including documents
router.get('/sign-ups/pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    const t0 = Date.now();
    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.country, u.user_type, u.created_at, u.approval_status, u.email_verified,
        u.certification_status, u.approved_at, u.approved_by, u.rejection_reason,
        u.agency_legal_confirmation, u.foreign_agency_confirmation,
        ep.id as expert_profile_id, ep.expert_type, ep.display_name, ep.bio, ep.location as expert_location,
        ep.languages, ep.specialties, ep.certifications, ep.experience_years, ep.profile_photo,
        ep.license_number, ep.license_issue_date, ep.license_expiry_date,
        ep.ministry_license_front_url, ep.ministry_license_back_url, 
        ep.syndicate_license_front_url, ep.syndicate_license_back_url,
        ep.terms_accepted, ep.license_confirmed, ep.verification_consent, ep.terms_accepted_at,
        ep.verification_status, ep.verified_at, ep.verification_notes,
        ep.certification_document_url, ep.insurance_document_url, ep.insurance_expiry_date,
        ep.diver_terms_agreement, ep.diver_accuracy_confirmation, ep.diver_verification_consent,
        ep.mentor_role_agreement, ep.mentor_terms_agreement, ep.mentor_accuracy_confirmation, ep.mentor_verification_consent,
        ap.id as agency_profile_id, ap.company_name, ap.company_description, ap.location as agency_location,
        ap.operating_areas, ap.services, ap.license_number as agency_license, ap.years_in_business, ap.logo_url,
        ap.tourism_license_url, ap.company_based_in, ap.country_of_registration, ap.city_of_registration,
        ap.business_type, ap.business_license_url, ap.egypt_destinations, ap.products_offered, ap.languages_operated,
        dcp.id as divecenter_profile_id, dcp.center_name, dcp.center_description, dcp.location as divecenter_location,
        dcp.dive_sites, dcp.services as divecenter_services, dcp.padi_center_number, dcp.ssi_center_number, 
        dcp.years_in_business as divecenter_years, dcp.logo_url as divecenter_logo,
        dcp.dive_center_base, dcp.license_authority, dcp.license_number as dcp_license_number,
        dcp.license_issue_date as dcp_license_issue_date, dcp.license_expiry_date as dcp_license_expiry_date,
        dcp.license_front_url, dcp.license_back_url,
        dcp.country_of_registration as dcp_country_registration, dcp.foreign_website_url, dcp.foreign_registration_id,
        dcp.international_operations_confirmation, dcp.terms_agreement as dcp_terms_agreement,
        dcp.accuracy_confirmation as dcp_accuracy_confirmation, dcp.verification_consent as dcp_verification_consent
      FROM users u
      LEFT JOIN expert_profiles ep ON u.id = ep.user_id AND u.user_type IN ('guide', 'diver', 'mentor')
      LEFT JOIN agency_profiles ap ON u.id = ap.user_id AND u.user_type = 'agency'
      LEFT JOIN dive_center_profiles dcp ON u.id = dcp.user_id AND u.user_type = 'divecenter'
      WHERE u.user_type IN ('guide', 'diver', 'mentor', 'agency', 'divecenter')
        AND u.email_verified = false
      ORDER BY u.created_at DESC
      LIMIT 200
    `);
    console.log(`✅ sign-ups/pending: ${result.rows.length} rows in ${Date.now() - t0}ms`);

    const parseJsonField = (field) => {
      if (!field) return [];
      if (typeof field === 'string') {
        try {
          const parsed = JSON.parse(field);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          return field.split(',').map(s => s.trim()).filter(s => s);
        }
      }
      return Array.isArray(field) ? field : [];
    };

    const signUps = result.rows.map(row => {
      const signup = {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        country: row.country,
        user_type: row.user_type,
        created_at: row.created_at,
        approval_status: row.approval_status,
        email_verified: row.email_verified,
        certification_status: row.certification_status || 'pending',
        approved_at: row.approved_at,
        approved_by: row.approved_by,
        rejection_reason: row.rejection_reason
      };

      if (row.expert_profile_id) {
        signup.expertProfile = {
          id: row.expert_profile_id,
          expertType: row.expert_type,
          displayName: row.display_name,
          bio: row.bio,
          location: row.expert_location,
          profilePhoto: row.profile_photo,
          languages: parseJsonField(row.languages),
          specialties: parseJsonField(row.specialties),
          certifications: parseJsonField(row.certifications),
          experienceYears: row.experience_years,
          licenseNumber: row.license_number,
          licenseIssueDate: row.license_issue_date,
          licenseExpiryDate: row.license_expiry_date,
          ministryLicenseFrontUrl: row.ministry_license_front_url,
          ministryLicenseBackUrl: row.ministry_license_back_url,
          syndicateLicenseFrontUrl: row.syndicate_license_front_url,
          syndicateLicenseBackUrl: row.syndicate_license_back_url,
          termsAccepted: row.terms_accepted,
          licenseConfirmed: row.license_confirmed,
          verificationConsent: row.verification_consent,
          termsAcceptedAt: row.terms_accepted_at,
          verificationStatus: row.verification_status,
          verifiedAt: row.verified_at,
          verificationNotes: row.verification_notes,
          certificationDocumentUrl: row.certification_document_url,
          insuranceDocumentUrl: row.insurance_document_url,
          insuranceExpiryDate: row.insurance_expiry_date,
          diverTermsAgreement: row.diver_terms_agreement,
          diverAccuracyConfirmation: row.diver_accuracy_confirmation,
          diverVerificationConsent: row.diver_verification_consent,
          mentorRoleAgreement: row.mentor_role_agreement,
          mentorTermsAgreement: row.mentor_terms_agreement,
          mentorAccuracyConfirmation: row.mentor_accuracy_confirmation,
          mentorVerificationConsent: row.mentor_verification_consent
        };
      }

      if (row.agency_profile_id) {
        signup.agencyProfile = {
          id: row.agency_profile_id,
          companyName: row.company_name,
          companyDescription: row.company_description,
          location: row.agency_location,
          operatingAreas: parseJsonField(row.operating_areas),
          services: parseJsonField(row.services),
          licenseNumber: row.agency_license,
          yearsInBusiness: row.years_in_business,
          logoUrl: row.logo_url,
          tourismLicenseUrl: row.tourism_license_url,
          companyBasedIn: row.company_based_in,
          countryOfRegistration: row.country_of_registration,
          cityOfRegistration: row.city_of_registration,
          businessType: row.business_type,
          businessLicenseUrl: row.business_license_url,
          egyptDestinations: parseJsonField(row.egypt_destinations),
          productsOffered: parseJsonField(row.products_offered),
          languagesOperated: parseJsonField(row.languages_operated),
          agencyLegalConfirmation: row.agency_legal_confirmation,
          foreignAgencyConfirmation: row.foreign_agency_confirmation
        };
      }

      if (row.divecenter_profile_id) {
        signup.diveCenterProfile = {
          id: row.divecenter_profile_id,
          centerName: row.center_name,
          centerDescription: row.center_description,
          location: row.divecenter_location,
          diveSites: parseJsonField(row.dive_sites),
          services: parseJsonField(row.divecenter_services),
          padiCenterNumber: row.padi_center_number,
          ssiCenterNumber: row.ssi_center_number,
          yearsInBusiness: row.divecenter_years,
          logoUrl: row.divecenter_logo,
          diveCenterBase: row.dive_center_base,
          licenseAuthority: row.license_authority,
          licenseNumber: row.dcp_license_number,
          licenseIssueDate: row.dcp_license_issue_date,
          licenseExpiryDate: row.dcp_license_expiry_date,
          licenseFrontUrl: row.license_front_url,
          licenseBackUrl: row.license_back_url,
          countryOfRegistration: row.dcp_country_registration,
          foreignWebsiteUrl: row.foreign_website_url,
          foreignRegistrationId: row.foreign_registration_id,
          internationalOperationsConfirmation: row.international_operations_confirmation,
          termsAgreement: row.dcp_terms_agreement,
          accuracyConfirmation: row.dcp_accuracy_confirmation,
          verificationConsent: row.dcp_verification_consent
        };
      }

      return signup;
    });
    
    res.json({ 
      success: true, 
      signUps,
      total: signUps.length
    });
  } catch (error) {
    console.error('Error fetching pending sign-ups:', error);
    res.status(500).json({ error: 'Failed to fetch pending sign-ups' });
  }
});

// Approve/Reject user sign-up with full certification flow
router.post('/sign-ups/:userId/approve', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const adminEmail = req.user.email || req.user.userEmail || 'admin';
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await client.query('BEGIN');

    if (status === 'approved') {
      const userResult = await client.query(
        `UPDATE users SET 
          approval_status = 'approved', 
          certification_status = 'certified',
          approved_at = NOW(),
          approved_by = $2,
          updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, full_name, user_type`,
        [userId, adminEmail]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      if (user.user_type === 'agency') {
        const agencyCheck = await client.query(
          `SELECT id FROM agency_profiles WHERE user_id = $1`, [userId]
        );
        if (agencyCheck.rows.length === 0) {
          const slug = (user.full_name || 'agency')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
          await client.query(
            `INSERT INTO agency_profiles (user_id, company_name, slug, contact_email, is_verified, is_featured, approval_status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, false, false, 'approved', NOW(), NOW())`,
            [userId, user.full_name || 'Agency', slug, user.email]
          );
          console.log(`⚠️ Created missing agency profile for user ${user.email}`);
        } else {
          await client.query(
            `UPDATE agency_profiles SET approval_status = 'approved', updated_at = NOW()
             WHERE user_id = $1`,
            [userId]
          );
        }
      }

      if (user.user_type === 'divecenter') {
        const dcCheck = await client.query(
          `SELECT id FROM dive_center_profiles WHERE user_id = $1`, [userId]
        );
        if (dcCheck.rows.length === 0) {
          const slug = (user.full_name || 'dive-center')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
          await client.query(
            `INSERT INTO dive_center_profiles (user_id, center_name, slug, contact_email, is_verified, is_featured, approval_status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, false, false, 'approved', NOW(), NOW())`,
            [userId, user.full_name || 'Dive Center', slug, user.email]
          );
          console.log(`⚠️ Created missing dive center profile for user ${user.email}`);
        } else {
          await client.query(
            `UPDATE dive_center_profiles SET approval_status = 'approved', updated_at = NOW()
             WHERE user_id = $1`,
            [userId]
          );
        }
      }

      if (user.user_type === 'guide') {
        await client.query(
          `UPDATE expert_profiles SET verification_status = 'verified', verified_at = NOW(), updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ User ${user.email} approved and certified by ${adminEmail}`);

      res.json({ 
        success: true, 
        message: `User approved and certified successfully`,
        user: { id: user.id, email: user.email, fullName: user.full_name, userType: user.user_type }
      });

    } else {
      const userResult = await client.query(
        `UPDATE users SET 
          approval_status = 'rejected', 
          certification_status = 'rejected',
          rejection_reason = $2,
          approved_by = $3,
          updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, full_name, user_type`,
        [userId, reason || '', adminEmail]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      if (user.user_type === 'agency') {
        await client.query(
          `UPDATE agency_profiles SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE user_id = $2`,
          [reason || '', userId]
        );
      }
      if (user.user_type === 'divecenter') {
        await client.query(
          `UPDATE dive_center_profiles SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE user_id = $2`,
          [reason || '', userId]
        );
      }
      if (user.user_type === 'guide') {
        await client.query(
          `UPDATE expert_profiles SET verification_status = 'rejected', verification_notes = $1, updated_at = NOW() WHERE user_id = $2`,
          [reason || '', userId]
        );
      }

      await client.query('COMMIT');
      console.log(`❌ User ${user.email} rejected by ${adminEmail}`);

      res.json({ 
        success: true, 
        message: `User rejected`,
        user: { id: user.id, email: user.email, fullName: user.full_name, userType: user.user_type }
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user approval:', error);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
});

// Suspend/unsuspend user
router.patch('/users/:id/suspend', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { suspend } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *',
      [!suspend, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ========== FLASH OFFERS MANAGEMENT ==========

// Create flash offer
router.post('/flash-offers', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { badge, title, description, link, deadline, discountPercentage } = req.body;
    
    if (!title || !deadline) {
      return res.status(400).json({ error: 'Title and deadline are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO flash_offers (badge, title, description, link, deadline, discount_percentage, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [badge, title, description, link, deadline, discountPercentage]
    );
    
    res.status(201).json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error creating flash offer:', error);
    res.status(500).json({ error: 'Failed to create flash offer' });
  }
});

// Update flash offer
router.put('/flash-offers/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { badge, title, description, link, deadline, discountPercentage, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE flash_offers 
       SET badge = $1, title = $2, description = $3, link = $4, deadline = $5, 
           discount_percentage = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [badge, title, description, link, deadline, discountPercentage, isActive, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flash offer not found' });
    }
    
    res.json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error updating flash offer:', error);
    res.status(500).json({ error: 'Failed to update flash offer' });
  }
});

// Delete flash offer
router.delete('/flash-offers/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM flash_offers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flash offer not found' });
    }
    
    res.json({ success: true, message: 'Flash offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting flash offer:', error);
    res.status(500).json({ error: 'Failed to delete flash offer' });
  }
});

// ADMIN: Get all flash offers (for admin dashboard)
router.get('/admin/flash-offers', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, badge, title, description, link, deadline, discount_percentage, is_active, created_at, updated_at
       FROM flash_offers 
       ORDER BY created_at DESC`
    );
    
    res.json({ success: true, offers: result.rows });
  } catch (error) {
    console.error('Error fetching flash offers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flash offers', offers: [] });
  }
});

// PUBLIC: Get all active flash offers (for website)
router.get('/flash-offers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, badge, title, description as desc, link, deadline, discount_percentage, is_active, created_at, updated_at
       FROM flash_offers 
       WHERE is_active = true AND deadline > NOW()
       ORDER BY created_at DESC`
    );
    
    res.json({ success: true, offers: result.rows });
  } catch (error) {
    console.error('Error fetching flash offers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flash offers', offers: [] });
  }
});

// ========== ENHANCED ANALYTICS ==========

// Get comprehensive analytics
router.get('/analytics/comprehensive', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = ' WHERE created_at BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }
    
    const analytics = await Promise.all([
      // Users
      pool.query(`SELECT COUNT(*) as total FROM users${dateFilter}`, params),
      pool.query(`SELECT COUNT(*) as total FROM users WHERE approval_status = 'approved'`),
      
      // Bookings & Revenue
      pool.query(`SELECT COUNT(*) as total, SUM(total_amount) as revenue FROM bookings${dateFilter}`, params),
      pool.query(`SELECT COUNT(*) as total FROM bookings WHERE payment_status = 'paid'`),
      
      // Traveller Requests
      pool.query(`SELECT COUNT(*) as total FROM guest_requests${dateFilter}`, params),
      pool.query(`SELECT COUNT(*) as total FROM guest_request_bids${dateFilter}`, params),
      
      // Experts & Jobs
      pool.query(`SELECT COUNT(*) as total FROM expert_profiles`),
      pool.query(`SELECT COUNT(*) as total FROM jobs WHERE approval_status = 'approved'`),
      
      // Employers
      pool.query(`SELECT COUNT(*) as total FROM agency_profiles WHERE approval_status = 'approved'`),
      pool.query(`SELECT COUNT(*) as total FROM dive_center_profiles WHERE approval_status = 'approved'`),
      
      // WhatsApp
      pool.query(`SELECT COUNT(*) as total FROM whatsapp_clicks${dateFilter}`, params),
      pool.query(`SELECT COUNT(*) as total FROM whatsapp_messages WHERE status = 'sent'`),
    ]);
    
    res.json({
      success: true,
      analytics: {
        users: {
          total: parseInt(analytics[0].rows[0].total),
          approved: parseInt(analytics[1].rows[0].total)
        },
        bookings: {
          total: parseInt(analytics[2].rows[0].total),
          revenue: parseFloat(analytics[2].rows[0].revenue || 0),
          paid: parseInt(analytics[3].rows[0].total)
        },
        travellerRequests: {
          total: parseInt(analytics[4].rows[0].total),
          bids: parseInt(analytics[5].rows[0].total)
        },
        platform: {
          experts: parseInt(analytics[6].rows[0].total),
          jobs: parseInt(analytics[7].rows[0].total),
          agencies: parseInt(analytics[8].rows[0].total),
          diveCenters: parseInt(analytics[9].rows[0].total)
        },
        whatsapp: {
          clicks: parseInt(analytics[10].rows[0].total),
          messagesSent: parseInt(analytics[11].rows[0].total)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching comprehensive analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ========== SYSTEM SETTINGS ==========

// Get all settings
router.get('/settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ success: true, settings: result.rows });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update setting
router.put('/settings/:key', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { settingValue, description } = req.body;
    
    const result = await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, description, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $2, description = $3, updated_by = $4, updated_at = NOW()
       RETURNING *`,
      [key, settingValue, description, req.user.userId]
    );
    
    res.json({ success: true, setting: result.rows[0] });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ========== EMPLOYERS MANAGEMENT ==========

// Get all travel agencies
router.get('/agencies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT 
        ap.id, 
        ap.user_id,
        u.full_name, 
        u.email, 
        u.phone, 
        u.country,
        ap.company_name,
        ap.company_description,
        ap.location,
        ap.years_in_business,
        u.is_active,
        u.approval_status,
        ap.created_at
      FROM agency_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE 1=1`;
    
    if (status) {
      sql += ` AND u.approval_status = '${status}'`;
    }
    
    sql += ` ORDER BY u.approval_status = 'pending_approval' DESC, ap.created_at DESC LIMIT 500`;
    
    const result = await pool.query(sql);
    
    res.json({ success: true, agencies: result.rows });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({ error: 'Failed to fetch agencies' });
  }
});

// Get all dive centers
router.get('/dive-centers', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT 
        dcp.id, 
        dcp.user_id,
        u.full_name, 
        u.email, 
        u.phone, 
        u.country,
        dcp.center_name,
        dcp.center_description,
        dcp.location,
        u.is_active,
        u.approval_status,
        dcp.created_at
      FROM dive_center_profiles dcp
      JOIN users u ON dcp.user_id = u.id
      WHERE 1=1`;
    
    if (status) {
      sql += ` AND u.approval_status = '${status}'`;
    }
    
    sql += ` ORDER BY u.approval_status = 'pending_approval' DESC, dcp.created_at DESC LIMIT 500`;
    
    const result = await pool.query(sql);
    
    res.json({ success: true, diveCenters: result.rows });
  } catch (error) {
    console.error('Error fetching dive centers:', error);
    res.status(500).json({ error: 'Failed to fetch dive centers' });
  }
});

// ========== EXPERTS MANAGEMENT ==========

// Get all experts (for approval workflow)
router.get('/experts', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ep.id, 
        ep.user_id,
        u.full_name, 
        u.email, 
        u.phone, 
        u.country,
        ep.expert_type, 
        ep.location, 
        ep.experience_years, 
        ep.bio, 
        ep.specialties,
        ep.certifications,
        ep.hourly_rate,
        ep.daily_rate,
        u.is_active,
        u.approval_status,
        ep.created_at
      FROM expert_profiles ep
      JOIN users u ON ep.user_id = u.id
      ORDER BY u.approval_status = 'pending_approval' DESC, ep.created_at DESC
      LIMIT 500
    `);
    
    res.json({ 
      success: true, 
      experts: result.rows 
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: 'Failed to fetch experts' });
  }
});

// Approve/Reject expert
router.post('/experts/:userId/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, notes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await pool.query(
      `UPDATE users SET approval_status = $1 WHERE id = $2 RETURNING *`,
      [status, userId]
    );
    
    res.json({ 
      success: true, 
      message: `Expert ${status} successfully`,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving expert:', error);
    res.status(500).json({ error: 'Failed to update expert' });
  }
});

// ========== JOB POSTING APPROVAL ==========

// Get all job postings pending approval
router.get('/job-postings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        jp.id,
        jp.employer_id,
        u.full_name as employer_name,
        u.user_type as employer_type,
        jp.job_title,
        jp.job_description,
        jp.required_skills,
        jp.salary_min,
        jp.salary_max,
        jp.currency,
        jp.location,
        jp.job_type,
        jp.approval_status,
        jp.posted_date,
        jp.admin_notes,
        jp.created_at
      FROM job_postings jp
      JOIN users u ON jp.employer_id = u.id
      ORDER BY jp.approval_status = 'pending_approval' DESC, jp.posted_date DESC
      LIMIT 500
    `);
    
    res.json({ 
      success: true, 
      jobPostings: result.rows 
    });
  } catch (error) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({ error: 'Failed to fetch job postings' });
  }
});

// Approve/Reject job posting
router.post('/job-postings/:jobId/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, notes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await pool.query(
      `UPDATE job_postings 
       SET approval_status = $1, admin_notes = $2, approved_by = $3, approved_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, notes || '', req.user.userId, jobId]
    );
    
    res.json({ 
      success: true, 
      message: `Job posting ${status} successfully`,
      jobPosting: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving job posting:', error);
    res.status(500).json({ error: 'Failed to update job posting' });
  }
});

// ========== PAYMENT RECORDS ==========

// Get all payment records (paid bookings)
router.get('/payments', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, search, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id as booking_id,
        guest_name as traveler_name,
        guest_email as traveler_email,
        package_name,
        total_amount as amount_paid,
        currency,
        payment_date,
        payment_status,
        status as booking_status,
        checkout_session_id as stripe_session_id,
        payment_intent_id,
        created_at as booking_created,
        'Stripe' as payment_method
      FROM bookings 
      WHERE payment_status = 'paid'
    `;
    const params = [];
    let paramCount = 0;
    
    if (startDate) {
      paramCount++;
      query += ` AND payment_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND payment_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (guest_name ILIKE $${paramCount} OR guest_email ILIKE $${paramCount} OR package_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY payment_date DESC NULLS LAST, created_at DESC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));
    
    const result = await pool.query(query, params);
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(CASE WHEN payment_date >= NOW() - INTERVAL '7 days' THEN 1 END) as payments_last_7_days,
        COALESCE(SUM(CASE WHEN payment_date >= NOW() - INTERVAL '7 days' THEN total_amount ELSE 0 END), 0) as revenue_last_7_days,
        COUNT(CASE WHEN payment_date >= NOW() - INTERVAL '30 days' THEN 1 END) as payments_last_30_days,
        COALESCE(SUM(CASE WHEN payment_date >= NOW() - INTERVAL '30 days' THEN total_amount ELSE 0 END), 0) as revenue_last_30_days
      FROM bookings 
      WHERE payment_status = 'paid'
    `);
    
    res.json({
      success: true,
      payments: result.rows,
      stats: statsResult.rows[0],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(statsResult.rows[0].total_payments)
      }
    });
  } catch (error) {
    console.error('Error fetching payment records:', error);
    res.status(500).json({ error: 'Failed to fetch payment records' });
  }
});

// Get payment summary/dashboard stats
router.get('/payments/summary', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE payment_status = 'paid') as total_paid,
        COUNT(*) FILTER (WHERE payment_status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE payment_status = 'failed') as total_failed,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'pending'), 0) as pending_revenue,
        COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as average_payment,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND payment_date >= CURRENT_DATE) as payments_today,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid' AND payment_date >= CURRENT_DATE), 0) as revenue_today
      FROM bookings
    `);
    
    const recentPayments = await pool.query(`
      SELECT 
        id as booking_id,
        guest_name as traveler_name,
        total_amount as amount_paid,
        currency,
        payment_date,
        package_name
      FROM bookings 
      WHERE payment_status = 'paid'
      ORDER BY payment_date DESC NULLS LAST, created_at DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      summary: result.rows[0],
      recentPayments: recentPayments.rows
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// ========== MENTOR MANAGEMENT ==========

// Get all mentors with filters
router.get('/experts', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { type, status } = req.query;
    
    let query = `
      SELECT 
        u.id, u.email, u.full_name as name, u.country, u.created_at, u.approval_status,
        ep.display_name, ep.expert_type, ep.location as based_in, ep.bio,
        ep.profile_photo, ep.experience_years,
        (SELECT COUNT(*) FROM expert_trips WHERE expert_id = ep.id AND is_active = true) as offers_count,
        (SELECT COALESCE(SUM(b.total_amount * 0.8), 0) FROM bookings b 
         JOIN expert_trips et ON b.trip_id = et.id 
         WHERE et.expert_id = ep.id AND b.payment_status = 'paid') as total_earnings
      FROM users u
      JOIN expert_profiles ep ON u.id = ep.user_id
      WHERE u.user_type IN ('guide', 'diver', 'mentor')
    `;
    const params = [];
    let paramCount = 0;
    
    // Filter by expert type (mentor, guide, diver)
    if (type === 'mentor') {
      paramCount++;
      query += ` AND ep.expert_type = $${paramCount}`;
      params.push('mentor');
    }
    
    // Filter by approval status
    if (status) {
      paramCount++;
      query += ` AND u.approval_status = $${paramCount}`;
      params.push(status);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      experts: result.rows
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: 'Failed to fetch experts' });
  }
});

// Approve expert/mentor
router.post('/experts/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE users SET approval_status = 'approved', updated_at = NOW()
       WHERE id = $1 RETURNING id, email, full_name, user_type`,
      [id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Also update expert profile approval status
    await client.query(
      `UPDATE expert_profiles SET approval_status = 'approved', updated_at = NOW()
       WHERE user_id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Expert approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving expert:', error);
    res.status(500).json({ error: 'Failed to approve expert' });
  } finally {
    client.release();
  }
});

// Reject expert/mentor
router.post('/experts/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE users SET approval_status = 'rejected', updated_at = NOW()
       WHERE id = $1 RETURNING id, email, full_name, user_type`,
      [id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    await client.query(
      `UPDATE expert_profiles SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [reason || 'No reason provided', id]
    );
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Expert rejected' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting expert:', error);
    res.status(500).json({ error: 'Failed to reject expert' });
  } finally {
    client.release();
  }
});

// Suspend expert/mentor
router.post('/experts/:id/suspend', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await client.query('BEGIN');
    
    // Set is_active = false to block login (primary access control)
    // Keep approval_status = 'suspended' for UI/business workflow purposes
    const result = await client.query(
      `UPDATE users SET is_active = false, approval_status = 'suspended', updated_at = NOW()
       WHERE id = $1 RETURNING id, email, full_name, user_type, is_active`,
      [id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    await client.query(
      `UPDATE expert_profiles SET approval_status = 'suspended', rejection_reason = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [reason || 'Account suspended by admin', id]
    );
    
    // Disable all their trips/offers
    await client.query(
      `UPDATE expert_trips SET is_active = false, status = 'disabled', updated_at = NOW()
       WHERE expert_id = (SELECT id FROM expert_profiles WHERE user_id = $1)`,
      [id]
    );
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Expert suspended' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error suspending expert:', error);
    res.status(500).json({ error: 'Failed to suspend expert' });
  } finally {
    client.release();
  }
});

// Unsuspend expert/mentor - restore login access
router.post('/experts/:id/unsuspend', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Set is_active = true to restore login access (primary access control)
    // Restore approval_status to 'approved' for UI/business workflow purposes
    const result = await client.query(
      `UPDATE users SET is_active = true, approval_status = 'approved', updated_at = NOW()
       WHERE id = $1 RETURNING id, email, full_name, user_type, is_active`,
      [id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    await client.query(
      `UPDATE expert_profiles SET approval_status = 'approved', rejection_reason = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [id]
    );
    
    // Note: Trips remain disabled - admin must manually re-approve trips if needed
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Expert unsuspended - login access restored' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error unsuspending expert:', error);
    res.status(500).json({ error: 'Failed to unsuspend expert' });
  } finally {
    client.release();
  }
});

// ========== MENTOR OFFER/TRIP MANAGEMENT ==========

// Get expert trips with filters (for mentor offers)
router.get('/expert-trips', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { expertType, status, expertId } = req.query;
    
    let query = `
      SELECT 
        et.id, et.title, et.description, et.price, et.currency, et.duration,
        et.trip_type, et.location, et.status, et.created_at,
        ep.display_name as expert_name, ep.expert_type,
        u.email as expert_email,
        (SELECT COUNT(*) FROM bookings WHERE trip_id = et.id) as bookings_count
      FROM expert_trips et
      JOIN expert_profiles ep ON et.expert_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (expertType === 'mentor') {
      paramCount++;
      query += ` AND ep.expert_type = $${paramCount}`;
      params.push('mentor');
    }
    
    if (status) {
      paramCount++;
      query += ` AND et.status = $${paramCount}`;
      params.push(status);
    }
    
    if (expertId) {
      paramCount++;
      query += ` AND ep.user_id = $${paramCount}`;
      params.push(expertId);
    }
    
    query += ' ORDER BY et.created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      trips: result.rows
    });
  } catch (error) {
    console.error('Error fetching expert trips:', error);
    res.status(500).json({ error: 'Failed to fetch expert trips' });
  }
});

// Mentor planning-only compliance validation
const EXECUTION_KEYWORDS = [
  'hotel booking', 'book hotel', 'hotel reservation', 'accommodation booking',
  'transport booking', 'book transport', 'car rental', 'driver',
  'guide booking', 'book guide', 'tour operator',
  'payment outside', 'pay directly', 'whatsapp payment', 'bank transfer',
  'cash payment', 'direct payment', 'pay me directly',
  'my supplier', 'my hotel', 'my driver', 'my partner',
  'we will book', 'i will arrange', 'i will book'
];

function checkMentorCompliance(text) {
  if (!text) return { compliant: true, violations: [] };
  const lowerText = text.toLowerCase();
  const violations = EXECUTION_KEYWORDS.filter(keyword => lowerText.includes(keyword));
  return { 
    compliant: violations.length === 0, 
    violations 
  };
}

// Approve expert trip/offer
router.post('/expert-trips/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const skipComplianceCheck = req.body?.skipComplianceCheck;
    
    const tripResult = await pool.query(
      `SELECT et.*, ep.expert_type 
       FROM expert_trips et 
       LEFT JOIN expert_profiles ep ON et.expert_id = ep.id 
       WHERE et.id = $1`,
      [id]
    );
    
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip/offer not found' });
    }
    
    const trip = tripResult.rows[0];
    
    if (trip.expert_type === 'mentor' && !skipComplianceCheck) {
      const textToCheck = `${trip.title || ''} ${trip.description || ''} ${trip.included || ''} ${trip.itinerary || ''}`;
      const compliance = checkMentorCompliance(textToCheck);
      
      if (!compliance.compliant) {
        return res.status(400).json({ 
          error: 'Compliance violation', 
          message: 'Mentor offer contains execution promises. Mentors can only provide planning/consultation services.',
          violations: compliance.violations,
          hint: 'Remove references to bookings, transport, or direct payments. Add skipComplianceCheck=true to override.'
        });
      }
    }
    
    const result = await pool.query(
      `UPDATE expert_trips SET status = 'approved', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    res.json({ success: true, message: 'Trip approved successfully', trip: result.rows[0] });
  } catch (error) {
    console.error('Error approving trip:', error);
    res.status(500).json({ error: 'Failed to approve trip', message: error.message });
  }
});

// Reject expert trip/offer
router.post('/expert-trips/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason;
    
    const result = await pool.query(
      `UPDATE expert_trips SET status = 'rejected', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason || 'No reason provided', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip/offer not found' });
    }
    
    res.json({ success: true, message: 'Offer rejected', trip: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting trip:', error);
    res.status(500).json({ error: 'Failed to reject trip' });
  }
});

// Disable expert trip/offer
router.post('/expert-trips/:id/disable', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE expert_trips SET status = 'disabled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip/offer not found' });
    }
    
    res.json({ success: true, message: 'Offer disabled', trip: result.rows[0] });
  } catch (error) {
    console.error('Error disabling trip:', error);
    res.status(500).json({ error: 'Failed to disable trip' });
  }
});

// ========== MENTOR BOOKINGS ==========

// Get mentor bookings
router.get('/mentor-bookings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        b.id, b.status, b.total_amount, b.currency, b.payment_status,
        b.guest_name as traveler_name, b.guest_email as traveler_email,
        b.guest_phone as traveler_phone, b.created_at, b.admin_notes,
        b.assigned_to,
        et.title as offer_title, et.trip_type as offer_type, et.price as planning_fee,
        ep.display_name as mentor_name, ep.expert_type,
        u.email as mentor_email
      FROM bookings b
      JOIN expert_trips et ON b.trip_id = et.id
      JOIN expert_profiles ep ON et.expert_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE ep.expert_type = 'mentor'
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND b.status = $${paramCount}`;
      params.push(status);
    }
    
    query += ' ORDER BY b.created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error('Error fetching mentor bookings:', error);
    res.status(500).json({ error: 'Failed to fetch mentor bookings' });
  }
});

// Assign execution for mentor booking
router.post('/mentor-bookings/:id/assign', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    
    const result = await pool.query(
      `UPDATE bookings SET assigned_to = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [assigned_to, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Execution assigned', booking: result.rows[0] });
  } catch (error) {
    console.error('Error assigning execution:', error);
    res.status(500).json({ error: 'Failed to assign execution' });
  }
});

// Update mentor booking status
router.post('/mentor-bookings/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Status updated', booking: result.rows[0] });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Cancel mentor booking
router.post('/mentor-bookings/:id/cancel', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE bookings SET status = 'cancelled', payment_status = 'refund_pending', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking cancelled', booking: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ========== MENTOR PAYMENTS ==========

// Get mentor payments
router.get('/mentor-payments', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        b.id, b.total_amount as total, b.payment_status, b.payout_status,
        b.payment_date, b.payout_date, b.created_at, b.admin_notes,
        et.title as offer_title, et.price as planning_fee,
        (b.total_amount * 0.20) as commission,
        (b.total_amount * 0.80) as mentor_earnings,
        ep.display_name as mentor_name, ep.expert_type,
        u.email as mentor_email, u.id as mentor_user_id
      FROM bookings b
      JOIN expert_trips et ON b.trip_id = et.id
      JOIN expert_profiles ep ON et.expert_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE ep.expert_type = 'mentor' AND b.payment_status = 'paid'
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND COALESCE(b.payout_status, 'pending') = $${paramCount}`;
      params.push(status);
    }
    
    query += ' ORDER BY b.payment_date DESC NULLS LAST, b.created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    
    // Map with proper payout status
    const payments = result.rows.map(p => ({
      ...p,
      status: p.payout_status || 'pending'
    }));
    
    res.json({
      success: true,
      payments: payments
    });
  } catch (error) {
    console.error('Error fetching mentor payments:', error);
    res.status(500).json({ error: 'Failed to fetch mentor payments' });
  }
});

// Release mentor payment
router.post('/mentor-payments/:id/release', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE bookings SET payout_status = 'released', payout_date = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ success: true, message: 'Payment released' });
  } catch (error) {
    console.error('Error releasing payment:', error);
    res.status(500).json({ error: 'Failed to release payment' });
  }
});

// Hold mentor payment
router.post('/mentor-payments/:id/hold', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await pool.query(
      `UPDATE bookings SET payout_status = 'held', admin_notes = COALESCE(admin_notes || ' | ', '') || $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [`HOLD: ${reason || 'Held by admin'}`, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ success: true, message: 'Payment held' });
  } catch (error) {
    console.error('Error holding payment:', error);
    res.status(500).json({ error: 'Failed to hold payment' });
  }
});

// Block mentor payment (permanent)
router.post('/mentor-payments/:id/block', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE bookings SET payout_status = 'blocked', admin_notes = COALESCE(admin_notes || ' | ', '') || 'BLOCKED: Policy violation', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ success: true, message: 'Payment blocked' });
  } catch (error) {
    console.error('Error blocking payment:', error);
    res.status(500).json({ error: 'Failed to block payment' });
  }
});

// ========== MENTOR COMMUNICATION MONITORING ==========

// Get mentor communications (flagged messages)
router.get('/mentor-communications', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, mentorId } = req.query;
    
    // For now, return from admin_notes table with type='communication_flag'
    // In production, this would connect to a messaging system
    let query = `
      SELECT 
        an.id, an.entity_id as booking_id, an.note_text as message_preview,
        an.created_at as flagged_at, an.created_by as flagged_by,
        COALESCE(an.flag_status, 'pending') as status,
        b.guest_name as traveler_name, b.guest_email as traveler_email,
        ep.display_name as mentor_name,
        u.email as mentor_email, u.id as mentor_user_id,
        af.full_name as flagged_by_name
      FROM admin_notes an
      LEFT JOIN bookings b ON an.entity_id = b.id AND an.entity_type = 'mentor_communication'
      LEFT JOIN expert_trips et ON b.trip_id = et.id
      LEFT JOIN expert_profiles ep ON et.expert_id = ep.id
      LEFT JOIN users u ON ep.user_id = u.id
      LEFT JOIN users af ON an.created_by = af.id
      WHERE an.entity_type = 'mentor_communication'
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND COALESCE(an.flag_status, 'pending') = $${paramCount}`;
      params.push(status);
    }
    
    if (mentorId) {
      paramCount++;
      query += ` AND u.id = $${paramCount}`;
      params.push(mentorId);
    }
    
    query += ' ORDER BY an.created_at DESC LIMIT 100';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      communications: result.rows
    });
  } catch (error) {
    console.error('Error fetching mentor communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// Flag a mentor communication
router.post('/mentor-communications/flag', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { bookingId, messagePreview, violationType } = req.body;
    
    if (!bookingId || !messagePreview) {
      return res.status(400).json({ error: 'Booking ID and message preview required' });
    }
    
    const result = await pool.query(
      `INSERT INTO admin_notes (entity_type, entity_id, note_text, created_by, flag_status, violation_type)
       VALUES ('mentor_communication', $1, $2, $3, 'pending', $4) RETURNING *`,
      [bookingId, messagePreview, req.user.userId, violationType || 'unspecified']
    );
    
    res.json({ success: true, flag: result.rows[0] });
  } catch (error) {
    console.error('Error flagging communication:', error);
    res.status(500).json({ error: 'Failed to flag communication' });
  }
});

// Resolve a flagged communication
router.post('/mentor-communications/:id/resolve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, actionTaken } = req.body;
    
    const result = await pool.query(
      `UPDATE admin_notes 
       SET flag_status = 'resolved', 
           resolution_notes = $1, 
           action_taken = $2,
           resolved_at = NOW(),
           resolved_by = $3
       WHERE id = $4 AND entity_type = 'mentor_communication' 
       RETURNING *`,
      [resolution || 'Resolved by admin', actionTaken || 'none', req.user.userId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    res.json({ success: true, message: 'Flag resolved' });
  } catch (error) {
    console.error('Error resolving flag:', error);
    res.status(500).json({ error: 'Failed to resolve flag' });
  }
});

// Escalate a flagged communication
router.post('/mentor-communications/:id/escalate', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await pool.query(
      `UPDATE admin_notes 
       SET flag_status = 'escalated', 
           note_text = note_text || ' | ESCALATED: ' || $1,
           escalated_at = NOW(),
           escalated_by = $2
       WHERE id = $3 AND entity_type = 'mentor_communication' 
       RETURNING *`,
      [reason || 'Escalated for review', req.user.userId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    res.json({ success: true, message: 'Flag escalated' });
  } catch (error) {
    console.error('Error escalating flag:', error);
    res.status(500).json({ error: 'Failed to escalate flag' });
  }
});

module.exports = router;
