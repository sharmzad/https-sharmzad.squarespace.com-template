const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

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

router.get('/pending-signups', verifyToken, requireAdmin, async (req, res) => {
  try {
    const t0 = Date.now();
    const status = req.query.status || 'all';
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const offset = parseInt(req.query.offset) || 0;

    const whereClause = status !== 'all'
      ? `WHERE u.user_type IN ('guide','diver','mentor','agency','divecenter') AND u.approval_status = $3`
      : `WHERE u.user_type IN ('guide','diver','mentor','agency','divecenter')`;
    const params = status !== 'all' ? [limit, offset, status] : [limit, offset];

    const usersResult = await pool.query(`
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.country, u.user_type, u.created_at, u.approval_status, u.email_verified,
        u.certification_status, u.approved_at, u.approved_by, u.rejection_reason,
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
        u.agency_legal_confirmation, u.foreign_agency_confirmation,
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
        dcp.accuracy_confirmation as dcp_accuracy_confirmation, dcp.verification_consent as dcp_verification_consent,
        COUNT(*) OVER() AS total_count
      FROM users u
      LEFT JOIN expert_profiles ep ON u.id = ep.user_id AND u.user_type IN ('guide', 'diver', 'mentor')
      LEFT JOIN agency_profiles ap ON u.id = ap.user_id AND u.user_type = 'agency'
      LEFT JOIN dive_center_profiles dcp ON u.id = dcp.user_id AND u.user_type = 'divecenter'
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    console.log(`✅ pending-signups: ${usersResult.rows.length} rows in ${Date.now() - t0}ms`);

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

    const pendingSignups = usersResult.rows.map(row => {
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

    const total = parseInt(usersResult.rows[0]?.total_count || 0);
    res.json({
      pendingSignups,
      total
    });

  } catch (error) {
    console.error('Get pending signups error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve pending signups'
    });
  }
});

router.post('/approve-signup/:userId', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const adminEmail = req.user.email || req.user.userEmail || 'admin';

    await client.query('BEGIN');

    const userResult = await client.query(
      `UPDATE users SET 
        approval_status = 'approved', 
        certification_status = 'certified',
        approved_at = NOW(),
        approved_by = $2,
        updated_at = NOW()
       WHERE id = $1 AND (approval_status = 'pending' OR certification_status = 'pending')
       RETURNING id, email, full_name, user_type`,
      [userId, adminEmail]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found or already processed'
      });
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
      await client.query(
        `UPDATE dive_center_profiles SET approval_status = 'approved', updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
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
      message: 'Signup approved and certified successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        certificationStatus: 'certified'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve signup error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to approve signup'
    });
  } finally {
    client.release();
  }
});

router.post('/reject-signup/:userId', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminEmail = req.user.email || req.user.userEmail || 'admin';

    await client.query('BEGIN');

    const userResult = await client.query(
      `UPDATE users SET 
        approval_status = 'rejected', 
        certification_status = 'rejected',
        rejection_reason = $2,
        approved_by = $3,
        updated_at = NOW()
       WHERE id = $1 AND (approval_status = 'pending' OR certification_status = 'pending')
       RETURNING id, email, full_name, user_type`,
      [userId, reason, adminEmail]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found or already processed'
      });
    }

    const user = userResult.rows[0];

    if (user.user_type === 'agency') {
      await client.query(
        `UPDATE agency_profiles SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [reason, userId]
      );
    }

    if (user.user_type === 'divecenter') {
      await client.query(
        `UPDATE dive_center_profiles SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [reason, userId]
      );
    }

    if (user.user_type === 'guide') {
      await client.query(
        `UPDATE expert_profiles SET verification_status = 'rejected', verification_notes = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [reason, userId]
      );
    }

    await client.query('COMMIT');

    console.log(`❌ User ${user.email} rejected by ${adminEmail}: ${reason || 'No reason given'}`);

    res.json({
      message: 'Signup rejected',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        certificationStatus: 'rejected'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject signup error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to reject signup'
    });
  } finally {
    client.release();
  }
});

router.get('/pending-jobs', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('📍 Fetching ALL jobs (no filter)');
    const jobsResult = await pool.query(`
      SELECT 
        j.*,
        u.full_name as poster_name,
        u.email as poster_email,
        ap.company_name,
        ep.display_name as expert_name,
        dcp.center_name
      FROM jobs j
      INNER JOIN users u ON j.posted_by = u.id
      LEFT JOIN agency_profiles ap ON u.id = ap.user_id AND j.poster_type = 'agency'
      LEFT JOIN expert_profiles ep ON u.id = ep.user_id AND j.poster_type = 'expert'
      LEFT JOIN dive_center_profiles dcp ON u.id = dcp.user_id AND j.poster_type = 'divecenter'
      ORDER BY j.created_at DESC
    `);
    console.log('✅ Total jobs:', jobsResult.rows.length);

    const pendingJobs = jobsResult.rows.map(row => {
      let posterName = row.expert_name;
      if (row.poster_type === 'agency') posterName = row.company_name;
      if (row.poster_type === 'divecenter') posterName = row.center_name;
      
      return {
        id: row.id,
        postedBy: row.posted_by,
        posterType: row.poster_type,
        posterName: posterName,
        posterEmail: row.poster_email,
      jobType: row.job_type,
      title: row.title,
      description: row.description,
      location: row.location,
      employmentType: row.employment_type,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      currency: row.currency,
      salaryPeriod: row.salary_period,
      requirements: row.requirements,
      benefits: row.benefits,
      startDate: row.start_date,
      duration: row.duration,
      contactWhatsapp: row.contact_whatsapp,
      contactEmail: row.contact_email,
      applicationDeadline: row.application_deadline,
      createdAt: row.created_at
      };
    });

    res.json({
      pendingJobs,
      total: pendingJobs.length
    });

  } catch (error) {
    console.error('Get pending jobs error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve pending jobs'
    });
  }
});

router.post('/approve-job/:jobId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await pool.query(
      `UPDATE jobs SET approval_status = 'approved', status = 'active', updated_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, title, posted_by`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found or already processed'
      });
    }

    const job = result.rows[0];

    res.json({
      message: 'Job approved successfully',
      job: {
        id: job.id,
        title: job.title,
        postedBy: job.posted_by
      }
    });

  } catch (error) {
    console.error('Approve job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to approve job'
    });
  }
});

router.post('/reject-job/:jobId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    const result = await pool.query(
      `UPDATE jobs SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND approval_status = 'pending'
       RETURNING id, title, posted_by`,
      [reason, jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Job not found or already processed'
      });
    }

    const job = result.rows[0];

    res.json({
      message: 'Job rejected',
      job: {
        id: job.id,
        title: job.title,
        postedBy: job.posted_by
      }
    });

  } catch (error) {
    console.error('Reject job error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to reject job'
    });
  }
});

// ===== NEW ENDPOINT: Verified & Pending Approval =====
router.get('/sign-ups/verified-pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    const t0 = Date.now();
    const usersResult = await pool.query(`
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.country, u.user_type, u.created_at, u.approval_status, u.email_verified, u.updated_at,
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
      WHERE u.email_verified = true AND u.approval_status = 'pending'
        AND u.user_type IN ('guide', 'diver', 'mentor', 'agency', 'divecenter')
      ORDER BY u.updated_at DESC
      LIMIT 300
    `);

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

    const signUps = usersResult.rows.map(row => {
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
        updated_at: row.updated_at,
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

    console.log(`✅ verified-pending: ${signUps.length} rows in ${Date.now() - t0}ms`);
    res.json({
      success: true,
      signUps,
      total: signUps.length
    });

  } catch (error) {
    console.error('Get verified-pending signups error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: 'Failed to retrieve verified-pending signups'
    });
  }
});

router.get('/analytics', verifyToken, requireAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as total FROM users WHERE approval_status = $1', ['pending']),
      pool.query('SELECT COUNT(*) as total FROM jobs'),
      pool.query('SELECT COUNT(*) as total FROM jobs WHERE approval_status = $1', ['pending']),
      pool.query('SELECT COUNT(*) as total FROM agency_profiles WHERE approval_status = $1', ['approved']),
      pool.query('SELECT COUNT(*) as total FROM expert_profiles'),
      pool.query('SELECT COUNT(*) as total FROM job_applications'),
      pool.query('SELECT COUNT(*) as total FROM jobs WHERE approval_status = $1', ['approved']),
    ]);

    const analytics = {
      totalUsers: parseInt(stats[0].rows[0].total),
      pendingUsers: parseInt(stats[1].rows[0].total),
      totalJobs: parseInt(stats[2].rows[0].total),
      pendingJobs: parseInt(stats[3].rows[0].total),
      activeAgencies: parseInt(stats[4].rows[0].total),
      activeExperts: parseInt(stats[5].rows[0].total),
      totalApplications: parseInt(stats[6].rows[0].total),
      approvedJobs: parseInt(stats[7].rows[0].total)
    };

    res.json(analytics);

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve analytics'
    });
  }
});

router.delete('/delete-user/:userId', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'User ID is required'
      });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id, email, full_name, user_type FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    await client.query('DELETE FROM expert_profiles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM agency_profiles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM dive_center_profiles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM job_applications WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM jobs WHERE posted_by = $1', [userId]);
    await client.query('DELETE FROM bookings WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM expert_trip_bookings WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM applications WHERE user_id = $1', [userId]);
    
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    res.json({
      message: 'User deleted successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to delete user'
    });
  } finally {
    client.release();
  }
});

// Get action logs with filtering
router.get('/logs', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { action, status, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM action_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (action) {
      query += ` AND action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }
    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM action_logs WHERE 1=1' + 
      (action ? ' AND action = $1' : '') + 
      (status ? ` AND status = ${action ? '$2' : '$1'}` : ''),
      action && status ? [action, status] : (action ? [action] : (status ? [status] : []))
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch logs' });
  }
});

module.exports = router;
