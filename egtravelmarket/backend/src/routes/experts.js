const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const userType = req.user.userType || req.user.user_type;
    
    if (!['guide', 'diver', 'mentor'].includes(userType)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only experts can update their profile'
      });
    }

    const userId = req.user.userId || req.user.id;
    console.log('🔧 Updating profile for userId:', userId, 'userType:', userType);
    let {
      displayName,
      phone,
      location,
      languages,
      specialties,
      certifications,
      experienceYears,
      experience,
      bio,
      profilePhoto,
      coverPhoto,
      hourlyRate,
      dailyRate,
      currency,
      whatsapp,
      instagram,
      facebook,
      website,
      availability,
      country,
      basedIn,
      destinations
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
    if (profilePhoto && isTemplateAsset(profilePhoto)) {
      console.log('⚠️ Blocked template asset from being saved as profilePhoto:', profilePhoto);
      profilePhoto = null;
    }
    if (coverPhoto && isTemplateAsset(coverPhoto)) {
      console.log('⚠️ Blocked template asset from being saved as coverPhoto:', coverPhoto);
      coverPhoto = null;
    }

    // Allow both URLs and base64 data URLs
    // Limit profilePhoto to 50MB (base64 encoded, so roughly 50M chars)
    if (profilePhoto && profilePhoto.length > 50000000) {
      profilePhoto = null;
    }

    const normalizeArray = (value, fieldName) => {
      console.log(`📝 normalizeArray [${fieldName}] input:`, value, 'type:', typeof value);
      if (!value) {
        console.log(`📝 normalizeArray [${fieldName}] returning null (empty value)`);
        return null;
      }
      if (Array.isArray(value)) {
        const result = value.join(', ');
        console.log(`📝 normalizeArray [${fieldName}] array -> string:`, result);
        return result;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            const result = Array.isArray(parsed) ? parsed.join(', ') : trimmed;
            console.log(`📝 normalizeArray [${fieldName}] JSON parsed -> string:`, result);
            return result;
          } catch {
            console.log(`📝 normalizeArray [${fieldName}] JSON parse failed, returning trimmed:`, trimmed);
            return trimmed;
          }
        }
        console.log(`📝 normalizeArray [${fieldName}] plain string:`, trimmed);
        return trimmed;
      }
      console.log(`📝 normalizeArray [${fieldName}] returning null (unknown type)`);
      return null;
    };

    // For mentors, experience is stored as a string range (e.g., "2-5"), for others it's a number
    const expYears = experienceYears || (experience && !isNaN(parseInt(experience)) ? parseInt(experience) : null);
    
    const result = await pool.query(
      `UPDATE expert_profiles 
       SET display_name = COALESCE($1, display_name),
           location = COALESCE($2, location),
           languages = COALESCE($3, languages),
           specialties = COALESCE($4, specialties),
           certifications = COALESCE($5, certifications),
           experience_years = COALESCE($6, experience_years),
           bio = COALESCE($7, bio),
           profile_photo = COALESCE($8, profile_photo),
           cover_photo = COALESCE($9, cover_photo),
           hourly_rate = COALESCE($10, hourly_rate),
           daily_rate = COALESCE($11, daily_rate),
           currency = COALESCE($12, currency),
           whatsapp = COALESCE($13, whatsapp),
           instagram = COALESCE($14, instagram),
           facebook = COALESCE($15, facebook),
           website = COALESCE($16, website),
           availability = COALESCE($17, availability),
           country = COALESCE($19, country),
           based_in = COALESCE($20, based_in),
           destinations = COALESCE($21, destinations),
           updated_at = NOW()
       WHERE user_id = $18
       RETURNING *`,
      [
        displayName, location, normalizeArray(languages, 'languages'), normalizeArray(specialties, 'specialties'), 
        normalizeArray(certifications, 'certifications'), expYears, bio, profilePhoto, coverPhoto, 
        hourlyRate, dailyRate, currency, phone || whatsapp, instagram, facebook, website, 
        availability, userId, country, basedIn, normalizeArray(destinations, 'destinations')
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Expert profile not found'
      });
    }

    const profile = result.rows[0];

    if (phone) {
      await pool.query(
        `UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`,
        [phone, userId]
      );
    }

    const parseJsonField = (field, fieldName) => {
      console.log(`📤 parseJsonField [${fieldName}] input from DB:`, field, 'type:', typeof field);
      if (!field) {
        console.log(`📤 parseJsonField [${fieldName}] returning [] (empty)`);
        return [];
      }
      if (typeof field === 'string') {
        try {
          const parsed = JSON.parse(field);
          const result = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`📤 parseJsonField [${fieldName}] JSON parsed:`, result);
          return result;
        } catch {
          const result = field.split(',').map(s => s.trim()).filter(s => s);
          console.log(`📤 parseJsonField [${fieldName}] comma split:`, result);
          return result;
        }
      }
      const result = Array.isArray(field) ? field : [];
      console.log(`📤 parseJsonField [${fieldName}] array result:`, result);
      return result;
    };

    console.log('✅ Profile updated, DB values:', {
      specialties: profile.specialties,
      certifications: profile.certifications
    });

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: profile.id,
        slug: profile.slug,
        expertType: profile.expert_type,
        displayName: profile.display_name,
        bio: profile.bio,
        location: profile.location,
        languages: parseJsonField(profile.languages),
        specialties: parseJsonField(profile.specialties),
        certifications: parseJsonField(profile.certifications),
        experienceYears: profile.experience_years,
        experience: experience || String(profile.experience_years || ''),
        profilePhoto: profile.profile_photo,
        coverPhoto: profile.cover_photo,
        hourlyRate: profile.hourly_rate,
        dailyRate: profile.daily_rate,
        currency: profile.currency,
        whatsapp: profile.whatsapp,
        instagram: profile.instagram,
        facebook: profile.facebook,
        website: profile.website,
        availability: profile.availability,
        country: profile.country,
        basedIn: profile.based_in,
        destinations: parseJsonField(profile.destinations),
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error.message, error.stack);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to update profile',
      details: error.message
    });
  }
});

router.get('/profile/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT 
        ep.*, 
        u.email, 
        u.full_name, 
        u.phone,
        u.is_active,
        u.certification_status
       FROM expert_profiles ep
       JOIN users u ON ep.user_id = u.id
       WHERE ep.slug = $1 AND u.is_active = true AND u.approval_status = 'approved'`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Expert profile not found'
      });
    }

    const profile = result.rows[0];

    // All experts require certification to be publicly visible
    if (profile.certification_status !== 'certified') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'This expert profile is pending certification and not publicly visible yet.'
      });
    }

    // For guides, also require verification_status = 'verified'
    if (profile.expert_type === 'guide' && profile.verification_status !== 'verified') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'This guide profile is pending license verification and not publicly visible yet.'
      });
    }

    // Update view count asynchronously (non-blocking for faster response)
    pool.query(
      `UPDATE expert_profiles SET view_count = view_count + 1 WHERE id = $1`,
      [profile.id]
    ).catch(err => console.error('View count update failed:', err.message));

    // Helper to parse JSON fields safely (optimized - no verbose logging)
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

    // Short-term caching (60 seconds) for better performance
    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
    res.json({
      profile: {
        id: profile.id,
        slug: profile.slug,
        expertType: profile.expert_type,
        displayName: profile.display_name,
        bio: profile.bio,
        location: profile.location,
        languages: parseJsonField(profile.languages),
        specialties: parseJsonField(profile.specialties),
        certifications: parseJsonField(profile.certifications),
        experience: profile.experience_years,
        photoUrl: profile.profile_photo,
        profilePhoto: profile.profile_photo,
        coverPhoto: profile.cover_photo,
        phone: profile.phone,
        email: profile.email,
        whatsapp: profile.whatsapp,
        instagram: profile.instagram,
        facebook: profile.facebook,
        website: profile.website,
        hourlyRate: profile.hourly_rate,
        dailyRate: profile.daily_rate,
        currency: profile.currency || 'USD',
        availability: profile.availability,
        rating: parseFloat(profile.rating) || 0,
        totalReviews: profile.total_reviews,
        totalBookings: profile.total_bookings,
        viewCount: profile.view_count + 1,
        isVerified: profile.is_verified,
        isFeatured: profile.is_featured,
        country: profile.country,
        basedIn: profile.based_in,
        destinations: parseJsonField(profile.destinations),
        verificationStatus: profile.verification_status,
        isCertified: profile.certification_status === 'certified',
        isLicensedAndVerified: profile.expert_type === 'guide' && profile.verification_status === 'verified'
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to fetch profile'
    });
  }
});

router.get('/list/:expertType', async (req, res) => {
  try {
    const { expertType } = req.params;
    const { limit = 12, offset = 0 } = req.query;

    if (!['guide', 'diver', 'mentor'].includes(expertType)) {
      return res.status(400).json({
        error: 'Invalid expert type'
      });
    }

    const parsedLimit = Math.min(parseInt(limit) || 12, 50);
    const parsedOffset = parseInt(offset) || 0;

    // For guides, only show those with verification_status = 'verified'
    // All expert types require certification_status = 'certified'
    const guideVerificationFilter = expertType === 'guide' 
      ? "AND ep.verification_status = 'verified'" 
      : "";

    // Single query with window function to get count and data together (reduces DB round trips)
    const result = await pool.query(
      `SELECT 
        ep.id,
        ep.slug,
        ep.expert_type,
        ep.display_name,
        ep.location,
        ep.languages,
        ep.specialties,
        ep.experience_years,
        ep.profile_photo,
        ep.rating,
        ep.total_reviews,
        ep.is_verified,
        ep.is_featured,
        ep.country,
        ep.destinations,
        ep.verification_status,
        u.certification_status,
        COUNT(*) OVER() as total_count
       FROM expert_profiles ep
       JOIN users u ON ep.user_id = u.id
       WHERE ep.expert_type = $1 AND u.is_active = true AND u.approval_status = 'approved' AND u.certification_status = 'certified' ${guideVerificationFilter}
       ORDER BY ep.is_featured DESC, (CASE WHEN ep.profile_photo IS NOT NULL AND ep.profile_photo != '' THEN 1 ELSE 0 END) DESC, ep.rating DESC, ep.total_reviews DESC
       LIMIT $2 OFFSET $3`,
      [expertType, parsedLimit, parsedOffset]
    );
    
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

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

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      experts: result.rows.map(profile => ({
        id: profile.id,
        slug: profile.slug,
        expertType: profile.expert_type,
        displayName: profile.display_name,
        location: profile.location,
        languages: parseJsonField(profile.languages),
        specialties: parseJsonField(profile.specialties),
        experience: profile.experience_years,
        photoUrl: profile.profile_photo,
        rating: parseFloat(profile.rating) || 0,
        totalReviews: profile.total_reviews,
        isVerified: profile.is_verified,
        isFeatured: profile.is_featured,
        country: profile.country,
        destinations: parseJsonField(profile.destinations),
        verificationStatus: profile.verification_status,
        isCertified: profile.certification_status === 'certified',
        isLicensedAndVerified: profile.expert_type === 'guide' && profile.verification_status === 'verified'
      })),
      total: total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + result.rows.length < total
    });

  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to fetch experts'
    });
  }
});

module.exports = router;
