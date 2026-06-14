const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const requireAgency = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'agency') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only agencies can access this resource'
    });
  }
  next();
};

// Get all agencies (PUBLIC LIST) - MUST BE BEFORE /:slug
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 500);
    const offset = parseInt(req.query.offset) || 0;

    // Single query with window function to get count and data together (reduces DB round trips)
    const result = await pool.query(
      `SELECT 
        ap.id,
        ap.slug,
        ap.company_name,
        ap.company_description,
        ap.location,
        ap.services,
        ap.operating_areas,
        ap.years_in_business,
        ap.logo_url,
        ap.website_url,
        ap.is_verified,
        ap.is_featured,
        ap.business_type,
        ap.egypt_destinations,
        ap.products_offered,
        ap.company_based_in,
        ap.languages_operated,
        ap.license_number,
        ap.tourism_license_url,
        u.certification_status,
        u.agency_legal_confirmation,
        u.foreign_agency_confirmation,
        COUNT(*) OVER() as total_count
       FROM agency_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE u.is_active = true AND u.approval_status = 'approved' AND u.certification_status = 'certified'
       ORDER BY ap.is_featured DESC, (CASE WHEN ap.logo_url IS NOT NULL AND ap.logo_url != '' THEN 1 ELSE 0 END) DESC, ap.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const hasMore = offset + result.rows.length < total;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      agencies: result.rows.map(profile => {
        const services = profile.services ? profile.services.split(',').map(s => s.trim()).filter(Boolean) : [];
        const productsOffered = profile.products_offered ? profile.products_offered.split(',').map(s => s.trim()).filter(Boolean) : [];
        const operatingAreas = profile.operating_areas ? profile.operating_areas.split(',').map(s => s.trim()).filter(Boolean) : [];
        const egyptDests = profile.egypt_destinations ? profile.egypt_destinations.split(',').map(s => s.trim()).filter(Boolean) : [];
        const businessTypes = profile.business_type ? profile.business_type.split(',').map(s => s.trim()).filter(Boolean) : [];
        const languages = profile.languages_operated ? profile.languages_operated.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        const isCertified = profile.certification_status === 'certified';
        const companyBasedIn = profile.company_based_in || 'Egypt';
        
        let certificationBadge = null;
        if (isCertified) {
          if (companyBasedIn === 'Egypt' && 
              profile.license_number && 
              profile.tourism_license_url && 
              profile.agency_legal_confirmation === true) {
            certificationBadge = {
              type: 'egyptian',
              label: 'Certified Egyptian Travel Agency',
              color: 'green'
            };
          } else if (companyBasedIn === 'Outside Egypt' && 
                     profile.foreign_agency_confirmation === true) {
            certificationBadge = {
              type: 'international',
              label: 'International Partner Agency',
              subtitle: 'Services in Egypt are operated by licensed Egyptian partners.',
              color: 'blue'
            };
          }
        }
        
        return {
          id: profile.id,
          slug: profile.slug,
          companyName: profile.company_name,
          description: profile.company_description,
          location: profile.location,
          services: services,
          operatingAreas: operatingAreas,
          yearsInBusiness: profile.years_in_business,
          logoUrl: profile.logo_url,
          websiteUrl: profile.website_url,
          isVerified: profile.is_verified,
          isFeatured: profile.is_featured,
          isCertified: isCertified,
          certificationBadge: certificationBadge,
          businessType: businessTypes,
          egyptDestinations: egyptDests.length > 0 ? egyptDests : operatingAreas,
          productsOffered: productsOffered.length > 0 ? productsOffered : services,
          companyBasedIn: companyBasedIn,
          languagesOperated: languages
        };
      }),
      total,
      hasMore
    });

  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to fetch agencies'
    });
  }
});

// ============================================================
// AUTHENTICATED PROFILE ROUTES - MUST BE BEFORE /:slug
// ============================================================

// Get agency profile (authenticated user's own profile)
router.get('/profile', verifyToken, requireAgency, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token'
      });
    }

    const result = await pool.query(
      `SELECT ap.*, u.email, u.full_name, u.approval_status
       FROM agency_profiles ap
       INNER JOIN users u ON ap.user_id = u.id
       WHERE ap.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agency profile not found'
      });
    }

    const profile = result.rows[0];

    res.json({
      agencyProfile: {
        id: profile.id,
        slug: profile.slug,
        companyName: profile.company_name,
        companyDescription: profile.company_description,
        location: profile.location,
        operatingAreas: profile.operating_areas ? profile.operating_areas.split(',') : [],
        services: profile.services ? profile.services.split(',') : [],
        specialties: profile.specialties ? profile.specialties.split(',') : [],
        yearsInBusiness: profile.years_in_business,
        licenseNumber: profile.license_number,
        logoUrl: profile.logo_url,
        profilePhoto: profile.profile_photo,
        coverPhoto: profile.cover_photo,
        websiteUrl: profile.website_url,
        contactEmail: profile.contact_email,
        whatsapp: profile.whatsapp,
        facebook: profile.facebook,
        instagram: profile.instagram,
        isVerified: profile.is_verified,
        isFeatured: profile.is_featured
      },
      email: profile.email,
      fullName: profile.full_name,
      approvalStatus: profile.approval_status
    });

  } catch (error) {
    console.error('Get agency profile error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve agency profile'
    });
  }
});

// Update agency profile
router.put('/profile', verifyToken, requireAgency, async (req, res) => {
  try {
    let {
      companyName,
      companyDescription,
      location,
      yearsInBusiness,
      licenseNumber,
      websiteUrl,
      services,
      operatingAreas,
      specialties,
      contactEmail,
      whatsapp,
      facebook,
      instagram,
      logoUrl,
      profilePhoto,
      coverPhoto
    } = req.body;

    // Prevent template/fallback images from being persisted to database
    const isTemplateAsset = (url) => {
      if (!url || typeof url !== 'string') return false;
      const templatePatterns = [
        '/attached_assets/',
        'guides-sphinx',
        'mentor-hero-optimized',
        'placeholder',
        'default-avatar',
        'default-profile',
        'default-cover'
      ];
      return templatePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
    };

    // Strip template assets - these should never be saved to database
    if (logoUrl && isTemplateAsset(logoUrl)) {
      console.log('⚠️ Blocked template asset from being saved as logoUrl:', logoUrl);
      logoUrl = undefined;
    }
    if (profilePhoto && isTemplateAsset(profilePhoto)) {
      console.log('⚠️ Blocked template asset from being saved as profilePhoto:', profilePhoto);
      profilePhoto = undefined;
    }
    if (coverPhoto && isTemplateAsset(coverPhoto)) {
      console.log('⚠️ Blocked template asset from being saved as coverPhoto:', coverPhoto);
      coverPhoto = undefined;
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token'
      });
    }
    const currentProfile = await pool.query(
      'SELECT * FROM agency_profiles WHERE user_id = $1',
      [userId]
    );

    if (currentProfile.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agency profile not found'
      });
    }

    const current = currentProfile.rows[0];

    const servicesArray = Array.isArray(services) ? services.filter(s => s) : (services ? [services] : null);
    const areasArray = Array.isArray(operatingAreas) ? operatingAreas.filter(a => a) : (operatingAreas ? [operatingAreas] : null);
    const specialtiesArray = Array.isArray(specialties) ? specialties.filter(s => s) : (specialties ? [specialties] : null);

    const updates = {
      company_name: companyName !== undefined ? companyName : current.company_name,
      company_description: companyDescription !== undefined ? (companyDescription === '' ? null : companyDescription) : current.company_description,
      location: location !== undefined ? (location === '' ? null : location) : current.location,
      years_in_business: yearsInBusiness !== undefined ? (yearsInBusiness === '' ? null : yearsInBusiness) : current.years_in_business,
      license_number: licenseNumber !== undefined ? (licenseNumber === '' ? null : licenseNumber) : current.license_number,
      website_url: websiteUrl !== undefined ? (websiteUrl === '' ? null : websiteUrl) : current.website_url,
      services: servicesArray !== null ? servicesArray.join(',') : current.services,
      operating_areas: areasArray !== null ? areasArray.join(',') : current.operating_areas,
      specialties: specialtiesArray !== null ? specialtiesArray.join(',') : current.specialties,
      contact_email: contactEmail !== undefined ? (contactEmail === '' ? null : contactEmail) : current.contact_email,
      whatsapp: whatsapp !== undefined ? (whatsapp === '' ? null : whatsapp) : current.whatsapp,
      facebook: facebook !== undefined ? (facebook === '' ? null : facebook) : current.facebook,
      instagram: instagram !== undefined ? (instagram === '' ? null : instagram) : current.instagram,
      logo_url: logoUrl !== undefined ? (logoUrl === '' ? null : logoUrl) : current.logo_url,
      profile_photo: profilePhoto !== undefined ? (profilePhoto === '' ? null : profilePhoto) : current.profile_photo,
      cover_photo: coverPhoto !== undefined ? (coverPhoto === '' ? null : coverPhoto) : current.cover_photo
    };

    await pool.query(
      `UPDATE agency_profiles SET
        company_name = $1,
        company_description = $2,
        location = $3,
        years_in_business = $4,
        license_number = $5,
        website_url = $6,
        services = $7,
        operating_areas = $8,
        specialties = $9,
        contact_email = $10,
        whatsapp = $11,
        facebook = $12,
        instagram = $13,
        logo_url = $14,
        profile_photo = $15,
        cover_photo = $16,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17`,
      [
        updates.company_name,
        updates.company_description,
        updates.location,
        updates.years_in_business,
        updates.license_number,
        updates.website_url,
        updates.services,
        updates.operating_areas,
        updates.specialties,
        updates.contact_email,
        updates.whatsapp,
        updates.facebook,
        updates.instagram,
        updates.logo_url,
        updates.profile_photo,
        updates.cover_photo,
        current.id
      ]
    );

    const updatedProfile = await pool.query(
      `SELECT * FROM agency_profiles WHERE id = $1`,
      [current.id]
    );

    const profile = updatedProfile.rows[0];

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: profile.id,
        companyName: profile.company_name,
        companyDescription: profile.company_description,
        location: profile.location,
        yearsInBusiness: profile.years_in_business,
        licenseNumber: profile.license_number,
        websiteUrl: profile.website_url,
        services: profile.services ? profile.services.split(',') : [],
        operatingAreas: profile.operating_areas ? profile.operating_areas.split(',') : [],
        specialties: profile.specialties ? profile.specialties.split(',') : [],
        contactEmail: profile.contact_email,
        whatsapp: profile.whatsapp,
        facebook: profile.facebook,
        instagram: profile.instagram,
        logoUrl: profile.logo_url,
        profilePhoto: profile.profile_photo,
        coverPhoto: profile.cover_photo,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    console.error('Update agency profile error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to update profile',
      details: error.message
    });
  }
});

// ============================================================
// PUBLIC SLUG ROUTE - MUST BE AFTER /profile routes
// ============================================================

// Get agency profile by slug (PUBLIC)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT 
        ap.*,
        u.full_name, u.email, u.certification_status,
        u.agency_legal_confirmation, u.foreign_agency_confirmation
      FROM agency_profiles ap
      INNER JOIN users u ON ap.user_id = u.id
      WHERE ap.slug = $1 AND u.is_active = true AND u.approval_status = 'approved'`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agency not found'
      });
    }

    const profile = result.rows[0];

    if (profile.certification_status !== 'certified') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'This agency profile is pending certification and not publicly visible yet.'
      });
    }

    const isCertified = profile.certification_status === 'certified';
    const companyBasedIn = profile.company_based_in || 'Egypt';
    
    let certificationBadge = null;
    if (isCertified) {
      if (companyBasedIn === 'Egypt' && 
          profile.license_number && 
          profile.tourism_license_url && 
          profile.agency_legal_confirmation === true) {
        certificationBadge = {
          type: 'egyptian',
          label: 'Certified Egyptian Travel Agency',
          color: 'green'
        };
      } else if (companyBasedIn === 'Outside Egypt' && 
                 profile.foreign_agency_confirmation === true) {
        certificationBadge = {
          type: 'international',
          label: 'International Partner Agency',
          subtitle: 'Services in Egypt are operated by licensed Egyptian partners.',
          color: 'blue'
        };
      }
    }

    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json({
      id: profile.id,
      slug: profile.slug,
      companyName: profile.company_name,
      companyDescription: profile.company_description,
      location: profile.location,
      companyBasedIn: companyBasedIn,
      egyptDestinations: profile.egypt_destinations ? profile.egypt_destinations.split(',').map(s => s.trim()).filter(s => s) : [],
      productsOffered: profile.products_offered ? profile.products_offered.split(',').map(s => s.trim()).filter(s => s) : [],
      languagesOperated: profile.languages_operated ? profile.languages_operated.split(',').map(s => s.trim()).filter(s => s) : [],
      operatingAreas: profile.operating_areas ? profile.operating_areas.split(',') : [],
      services: profile.services ? profile.services.split(',') : [],
      specialties: profile.specialties ? profile.specialties.split(',') : [],
      yearsInBusiness: profile.years_in_business,
      logoUrl: profile.logo_url,
      websiteUrl: profile.website_url,
      contactEmail: profile.contact_email,
      whatsapp: profile.whatsapp,
      facebook: profile.facebook,
      instagram: profile.instagram,
      twitter: profile.twitter,
      linkedin: profile.linkedin,
      coverPhoto: profile.cover_photo,
      isVerified: profile.is_verified,
      isFeatured: profile.is_featured,
      isCertified: isCertified,
      certificationBadge: certificationBadge,
      createdAt: profile.created_at
    });

  } catch (error) {
    console.error('Get agency profile error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve agency profile'
    });
  }
});

module.exports = router;
