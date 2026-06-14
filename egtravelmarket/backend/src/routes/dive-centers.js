const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const requireDiveCenter = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== 'divecenter') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only dive centers can access this resource'
    });
  }
  next();
};

// Get all dive centers (PUBLIC LIST) - MUST BE BEFORE /:slug
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 500);
    const offset = parseInt(req.query.offset) || 0;

    // Single query with window function to get count and data together (reduces DB round trips)
    const result = await pool.query(
      `SELECT 
        dcp.id,
        dcp.slug,
        dcp.center_name,
        dcp.location,
        dcp.services,
        dcp.dive_sites,
        dcp.years_in_business,
        dcp.logo_url,
        dcp.is_verified,
        dcp.is_featured,
        dcp.padi_center_number,
        dcp.ssi_center_number,
        dcp.other_certifications,
        dcp.specialties,
        dcp.whatsapp,
        dcp.dive_center_base,
        dcp.license_authority,
        dcp.license_number,
        dcp.license_front_url,
        dcp.license_back_url,
        dcp.international_operations_confirmation,
        dcp.terms_agreement,
        dcp.accuracy_confirmation,
        dcp.verification_consent,
        u.certification_status,
        COUNT(*) OVER() as total_count
       FROM dive_center_profiles dcp
       JOIN users u ON dcp.user_id = u.id
       WHERE u.is_active = true AND u.approval_status = 'approved' AND u.certification_status = 'certified'
       ORDER BY dcp.is_featured DESC, (CASE WHEN dcp.logo_url IS NOT NULL AND dcp.logo_url != '' THEN 1 ELSE 0 END) DESC, dcp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const hasMore = offset + result.rows.length < total;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      diveCenters: result.rows.map(profile => {
        const certifications = [];
        if (profile.padi_center_number) certifications.push('PADI');
        if (profile.ssi_center_number) certifications.push('SSI');
        
        const otherCerts = profile.other_certifications ? profile.other_certifications.split(',').map(c => c.trim()).filter(c => c) : [];
        otherCerts.forEach(cert => {
          if (!certifications.includes(cert)) certifications.push(cert);
        });
        
        const specialtiesRaw = profile.specialties ? profile.specialties.split(',').map(s => s.trim()).filter(s => s) : [];
        const businessTypes = [];
        const worksWithList = [];
        const languagesList = [];
        const pricingLevels = [];
        const divingLevels = [];
        const safetyList = [];
        const regularSpecialties = [];
        
        specialtiesRaw.forEach(spec => {
          if (spec.startsWith('biz:')) {
            businessTypes.push(spec.replace('biz:', ''));
          } else if (spec.startsWith('works:')) {
            worksWithList.push(spec.replace('works:', ''));
          } else if (spec.startsWith('lang:')) {
            languagesList.push(spec.replace('lang:', ''));
          } else if (spec.startsWith('pricing:')) {
            pricingLevels.push(spec.replace('pricing:', ''));
          } else if (spec.startsWith('level:')) {
            divingLevels.push(spec.replace('level:', ''));
          } else if (spec.startsWith('safety:')) {
            safetyList.push(spec.replace('safety:', ''));
          } else {
            regularSpecialties.push(spec);
          }
        });
        
        const isInternational = businessTypes.includes('International Dive Center');
        
        const isCertified = profile.certification_status === 'certified';
        const diveCenterBase = profile.dive_center_base || profile.location || '';
        const isEgyptDC = diveCenterBase === 'Egypt-based Dive Center';
        const isIntlDC = diveCenterBase === 'International Dive Center';
        
        let certificationBadge = null;
        if (isCertified) {
          if (isEgyptDC && 
              profile.license_number && 
              profile.license_front_url && 
              profile.license_back_url &&
              profile.terms_agreement === true) {
            certificationBadge = {
              type: 'egyptian',
              label: 'Certified Egyptian Dive Center',
              color: 'green'
            };
          } else if (isIntlDC && 
                     profile.international_operations_confirmation === true) {
            certificationBadge = {
              type: 'international',
              label: 'International Dive Center Partner',
              subtitle: 'Diving activities in Egypt operated by licensed Egyptian centers.',
              color: 'blue'
            };
          }
        }
        
        return {
          id: profile.id,
          slug: profile.slug,
          centerName: profile.center_name,
          location: profile.location,
          diveCenterBase: diveCenterBase,
          services: profile.services ? profile.services.split(',').map(s => s.trim()).filter(s => s) : [],
          diveSites: profile.dive_sites ? profile.dive_sites.split(',').map(s => s.trim()).filter(s => s) : [],
          yearsInBusiness: profile.years_in_business,
          logoUrl: profile.logo_url,
          isVerified: profile.is_verified,
          isFeatured: profile.is_featured,
          isCertified: isCertified,
          certificationBadge: certificationBadge,
          certifications,
          businessTypes,
          isInternational,
          worksWithList,
          languagesList,
          pricingLevels,
          divingLevels,
          specialties: regularSpecialties,
          whatsapp: profile.whatsapp
        };
      }),
      total,
      hasMore
    });

  } catch (error) {
    console.error('Error fetching dive centers:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to fetch dive centers'
    });
  }
});

// ============================================================
// AUTHENTICATED PROFILE ROUTES - MUST BE BEFORE /:slug
// ============================================================

// Get dive center profile (authenticated user's own profile)
router.get('/profile', verifyToken, requireDiveCenter, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token'
      });
    }

    const result = await pool.query(
      `SELECT dcp.*, u.email, u.full_name, u.approval_status
       FROM dive_center_profiles dcp
       INNER JOIN users u ON dcp.user_id = u.id
       WHERE dcp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dive center profile not found'
      });
    }

    const profile = result.rows[0];

    res.json({
      diveCenterProfile: {
        id: profile.id,
        slug: profile.slug,
        centerName: profile.center_name,
        centerDescription: profile.center_description,
        location: profile.location,
        diveSites: profile.dive_sites ? profile.dive_sites.split(',') : [],
        services: profile.services ? profile.services.split(',') : [],
        specialties: profile.specialties ? profile.specialties.split(',') : [],
        padiCenterNumber: profile.padi_center_number,
        ssiCenterNumber: profile.ssi_center_number,
        otherCertifications: profile.other_certifications ? profile.other_certifications.split(',') : [],
        yearsInBusiness: profile.years_in_business,
        maxDailyDivers: profile.max_daily_divers,
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
    console.error('Get dive center profile error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve dive center profile'
    });
  }
});

// Update dive center profile
router.put('/profile', verifyToken, requireDiveCenter, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    let {
      centerName,
      centerDescription,
      location,
      yearsInBusiness,
      padiCenterNumber,
      ssiCenterNumber,
      maxDailyDivers,
      websiteUrl,
      services,
      diveSites,
      specialties,
      otherCertifications,
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

    const currentProfile = await pool.query(
      'SELECT * FROM dive_center_profiles WHERE user_id = $1',
      [userId]
    );

    if (currentProfile.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dive center profile not found'
      });
    }

    const current = currentProfile.rows[0];

    const servicesArray = Array.isArray(services) ? services.filter(s => s) : (services ? [services] : null);
    const sitesArray = Array.isArray(diveSites) ? diveSites.filter(a => a) : (diveSites ? [diveSites] : null);
    const specialtiesArray = Array.isArray(specialties) ? specialties.filter(s => s) : (specialties ? [specialties] : null);
    const certsArray = Array.isArray(otherCertifications) ? otherCertifications.filter(c => c) : (otherCertifications ? [otherCertifications] : null);

    const updates = {
      center_name: centerName !== undefined ? centerName : current.center_name,
      center_description: centerDescription !== undefined ? (centerDescription === '' ? null : centerDescription) : current.center_description,
      location: location !== undefined ? (location === '' ? null : location) : current.location,
      years_in_business: yearsInBusiness !== undefined ? (yearsInBusiness === '' ? null : yearsInBusiness) : current.years_in_business,
      padi_center_number: padiCenterNumber !== undefined ? (padiCenterNumber === '' ? null : padiCenterNumber) : current.padi_center_number,
      ssi_center_number: ssiCenterNumber !== undefined ? (ssiCenterNumber === '' ? null : ssiCenterNumber) : current.ssi_center_number,
      max_daily_divers: maxDailyDivers !== undefined ? (maxDailyDivers === '' ? null : maxDailyDivers) : current.max_daily_divers,
      website_url: websiteUrl !== undefined ? (websiteUrl === '' ? null : websiteUrl) : current.website_url,
      services: servicesArray !== null ? servicesArray.join(',') : current.services,
      dive_sites: sitesArray !== null ? sitesArray.join(',') : current.dive_sites,
      specialties: specialtiesArray !== null ? specialtiesArray.join(',') : current.specialties,
      other_certifications: certsArray !== null ? certsArray.join(',') : current.other_certifications,
      contact_email: contactEmail !== undefined ? (contactEmail === '' ? null : contactEmail) : current.contact_email,
      whatsapp: whatsapp !== undefined ? (whatsapp === '' ? null : whatsapp) : current.whatsapp,
      facebook: facebook !== undefined ? (facebook === '' ? null : facebook) : current.facebook,
      instagram: instagram !== undefined ? (instagram === '' ? null : instagram) : current.instagram,
      logo_url: logoUrl !== undefined ? (logoUrl === '' ? null : logoUrl) : current.logo_url,
      profile_photo: profilePhoto !== undefined ? (profilePhoto === '' ? null : profilePhoto) : current.profile_photo,
      cover_photo: coverPhoto !== undefined ? (coverPhoto === '' ? null : coverPhoto) : current.cover_photo
    };

    await pool.query(
      `UPDATE dive_center_profiles SET
        center_name = $1,
        center_description = $2,
        location = $3,
        years_in_business = $4,
        padi_center_number = $5,
        ssi_center_number = $6,
        max_daily_divers = $7,
        website_url = $8,
        services = $9,
        dive_sites = $10,
        specialties = $11,
        other_certifications = $12,
        contact_email = $13,
        whatsapp = $14,
        facebook = $15,
        instagram = $16,
        logo_url = $17,
        profile_photo = $18,
        cover_photo = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20`,
      [
        updates.center_name,
        updates.center_description,
        updates.location,
        updates.years_in_business,
        updates.padi_center_number,
        updates.ssi_center_number,
        updates.max_daily_divers,
        updates.website_url,
        updates.services,
        updates.dive_sites,
        updates.specialties,
        updates.other_certifications,
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
      `SELECT * FROM dive_center_profiles WHERE id = $1`,
      [current.id]
    );

    const profile = updatedProfile.rows[0];

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: profile.id,
        centerName: profile.center_name,
        centerDescription: profile.center_description,
        location: profile.location,
        yearsInBusiness: profile.years_in_business,
        padiCenterNumber: profile.padi_center_number,
        ssiCenterNumber: profile.ssi_center_number,
        maxDailyDivers: profile.max_daily_divers,
        websiteUrl: profile.website_url,
        services: profile.services ? profile.services.split(',') : [],
        diveSites: profile.dive_sites ? profile.dive_sites.split(',') : [],
        specialties: profile.specialties ? profile.specialties.split(',') : [],
        otherCertifications: profile.other_certifications ? profile.other_certifications.split(',') : [],
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
    console.error('Update dive center profile error:', error);
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

// Get dive center by slug (PUBLIC)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT 
        dcp.*,
        u.full_name, u.email, u.certification_status
      FROM dive_center_profiles dcp
      INNER JOIN users u ON dcp.user_id = u.id
      WHERE dcp.slug = $1 AND u.is_active = true AND u.approval_status = 'approved'`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dive center not found'
      });
    }

    const profile = result.rows[0];

    if (profile.certification_status !== 'certified') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'This dive center profile is pending certification and not publicly visible yet.'
      });
    }

    const isCertified = profile.certification_status === 'certified';
    const diveCenterBase = profile.dive_center_base || profile.location || '';
    const isEgyptDC = diveCenterBase === 'Egypt-based Dive Center';
    const isIntlDC = diveCenterBase === 'International Dive Center';
    
    let certificationBadge = null;
    if (isCertified) {
      if (isEgyptDC && 
          profile.license_number && 
          profile.license_front_url && 
          profile.license_back_url &&
          profile.terms_agreement === true) {
        certificationBadge = {
          type: 'egyptian',
          label: 'Certified Egyptian Dive Center',
          color: 'green'
        };
      } else if (isIntlDC && 
                 profile.international_operations_confirmation === true) {
        certificationBadge = {
          type: 'international',
          label: 'International Dive Center Partner',
          subtitle: 'Diving activities in Egypt operated by licensed Egyptian centers.',
          color: 'blue'
        };
      }
    }

    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json({
      id: profile.id,
      slug: profile.slug,
      centerName: profile.center_name,
      centerDescription: profile.center_description,
      location: profile.location,
      diveCenterBase: diveCenterBase,
      diveSites: profile.dive_sites ? profile.dive_sites.split(',') : [],
      services: profile.services ? profile.services.split(',') : [],
      specialties: profile.specialties ? profile.specialties.split(',') : [],
      padiCenterNumber: profile.padi_center_number,
      ssiCenterNumber: profile.ssi_center_number,
      otherCertifications: profile.other_certifications ? profile.other_certifications.split(',') : [],
      yearsInBusiness: profile.years_in_business,
      maxDailyDivers: profile.max_daily_divers,
      logoUrl: profile.logo_url,
      websiteUrl: profile.website_url,
      contactEmail: profile.contact_email,
      whatsapp: profile.whatsapp,
      facebook: profile.facebook,
      instagram: profile.instagram,
      coverPhoto: profile.cover_photo,
      isVerified: profile.is_verified,
      isFeatured: profile.is_featured,
      isCertified: isCertified,
      certificationBadge: certificationBadge,
      createdAt: profile.created_at
    });

  } catch (error) {
    console.error('Get dive center profile error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to retrieve dive center profile'
    });
  }
});

module.exports = router;
