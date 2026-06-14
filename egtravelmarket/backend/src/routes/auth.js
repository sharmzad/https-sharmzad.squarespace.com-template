const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/zeptomail');
const { wrapWithBranding, COLORS } = require('../utils/emailBranding');
const { logAction } = require('../utils/logger');
const { sendAdminNewSignupNotification } = require('../config/email');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      email,
      password,
      fullName,
      phone,
      country,
      basedIn,
      destinations,
      experience,
      userType,
      expertType,
      displayName,
      bio,
      location,
      languages,
      specialties,
      certifications,
      experienceYears,
      photoUrl,
      profilePhoto,
      coverPhotoUrl,
      coverPhoto,
      whatsapp,
      instagram,
      facebook,
      website,
      companyName,
      companyDescription,
      operatingAreas,
      services,
      licenseNumber,
      yearsInBusiness,
      logoUrl,
      websiteUrl,
      centerName,
      centerDescription,
      diveSites,
      padiCenterNumber,
      ssiCenterNumber,
      otherCertifications,
      maxDailyDivers,
      countryOfRegistration,
      cityOfRegistration,
      businessType,
      taxVatNumber,
      businessLicenseUrl,
      sellsEgyptProducts,
      egyptDestinations,
      productsOffered,
      companyBasedIn,
      hasLocalPartner,
      languagesOperated,
      languagesSpoken,
      termsConfirmed,
      tourismLicenseUrl,
      agencyLegalConfirmation,
      foreignAgencyConfirmation,
      // Guide license verification fields
      licenseIssueDate,
      licenseExpiryDate,
      termsAccepted,
      licenseConfirmed,
      verificationConsent,
      ministryLicenseFrontUrl,
      ministryLicenseBackUrl,
      syndicateLicenseFrontUrl,
      syndicateLicenseBackUrl,
      tourismLicenseNumber,
      // Dive center legal fields
      diveCenterBase,
      licenseAuthority,
      licenseFrontUrl,
      licenseBackUrl,
      foreignWebsiteUrl,
      foreignRegistrationId,
      internationalOperationsConfirmation,
      termsAgreement,
      accuracyConfirmation,
      // Diver verification fields
      certificationDocumentUrl,
      insuranceDocumentUrl,
      insuranceExpiryDate,
      diverTermsAgreement,
      diverAccuracyConfirmation,
      diverVerificationConsent,
      // Mentor legal confirmation fields
      mentorRoleAgreement,
      mentorTermsAgreement,
      mentorAccuracyConfirmation,
      mentorVerificationConsent
    } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and full name are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters long'
      });
    }

    if (userType === 'agency' && !companyName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Company name is required for agency registration'
      });
    }

    if (userType === 'divecenter' && !centerName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Center name is required for dive center registration'
      });
    }

    if (userType === 'agency') {
      const sellsEgyptValid = sellsEgyptProducts === true || sellsEgyptProducts === 'true' || sellsEgyptProducts === 'Yes';
      if (!sellsEgyptValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'You must confirm that you sell Egypt-based travel products to register on this platform'
        });
      }

      if (!egyptDestinations || !Array.isArray(egyptDestinations) || egyptDestinations.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Please select at least one Egypt destination you operate in'
        });
      }

      const termsValid = termsConfirmed === true || termsConfirmed === 'true';
      if (!termsValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'You must confirm that your products are related to Egypt tourism and agree to the platform terms'
        });
      }
      
      // Egyptian agency-specific validation
      if (companyBasedIn === 'Egypt') {
        if (!licenseNumber || licenseNumber.trim() === '') {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Tourism License Number is required for Egyptian travel agencies.'
          });
        }
        
        if (!tourismLicenseUrl || tourismLicenseUrl.trim() === '') {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Official tourism license upload is required for Egyptian agencies.'
          });
        }
        
        const egyptLegalValid = agencyLegalConfirmation === true || agencyLegalConfirmation === 'true';
        if (!egyptLegalValid) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'You must confirm that your company is a legally licensed Egyptian travel agency.'
          });
        }
      } else if (companyBasedIn === 'Outside Egypt') {
        const foreignLegalValid = foreignAgencyConfirmation === true || foreignAgencyConfirmation === 'true';
        if (!foreignLegalValid) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'You must confirm that your company is a foreign travel agency and will operate through licensed Egyptian partners.'
          });
        }
      }
    }

    // Dive center legal validation
    if (userType === 'divecenter') {
      const dcBase = diveCenterBase || location || '';
      const isEgyptDiveCenter = dcBase === 'Egypt-based Dive Center';
      const isInternationalDiveCenter = dcBase === 'International Dive Center';
      
      // Validate legal checkboxes for all dive centers
      const termsAgreementValid = termsAgreement === true || termsAgreement === 'true';
      const accuracyValid = accuracyConfirmation === true || accuracyConfirmation === 'true';
      const verificationValid = verificationConsent === true || verificationConsent === 'true';
      
      if (!termsAgreementValid || !accuracyValid || !verificationValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'All three legal confirmation checkboxes are required for dive center registration.'
        });
      }
      
      if (isEgyptDiveCenter) {
        if (!licenseAuthority) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License authority is required for Egyptian dive centers.'
          });
        }
        if (!licenseNumber || licenseNumber.trim() === '') {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License number is required for Egyptian dive centers.'
          });
        }
        if (!licenseIssueDate) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License issue date is required for Egyptian dive centers.'
          });
        }
        if (!licenseExpiryDate) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License expiry date is required for Egyptian dive centers.'
          });
        }
        
        const expiryDate = new Date(licenseExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiryDate <= today) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License expired. Please provide a valid, non-expired license.'
          });
        }
        
        if (!licenseFrontUrl) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License document front upload is required for Egyptian dive centers.'
          });
        }
        if (!licenseBackUrl) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'License document back upload is required for Egyptian dive centers.'
          });
        }
      } else if (isInternationalDiveCenter) {
        if (!countryOfRegistration || countryOfRegistration.trim() === '') {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Country of registration is required for international dive centers.'
          });
        }
        if (!foreignWebsiteUrl && !foreignRegistrationId) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Either website URL or foreign registration ID is required for international dive centers.'
          });
        }
        const intlConfirmValid = internationalOperationsConfirmation === true || internationalOperationsConfirmation === 'true';
        if (!intlConfirmValid) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'You must confirm that all diving activities in Egypt are operated by licensed Egyptian dive centers.'
          });
        }
      }
    }

    // Guide-specific validation for license requirements
    if (expertType === 'guide') {
      // Validate license number
      const guideLicenseNumber = tourismLicenseNumber || licenseNumber;
      if (!guideLicenseNumber || guideLicenseNumber.trim() === '') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Tour guide license number is required.'
        });
      }

      // Validate license issue date
      if (!licenseIssueDate) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'License issue date is required.'
        });
      }

      // Validate license expiry date
      if (!licenseExpiryDate) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'License expiry date is required.'
        });
      }

      // Check if license is expired
      const expiryDate = new Date(licenseExpiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate <= today) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'License expired. Please upload a valid license with a future expiry date.'
        });
      }

      // Validate all 4 license document URLs
      if (!ministryLicenseFrontUrl || !ministryLicenseBackUrl || !syndicateLicenseFrontUrl || !syndicateLicenseBackUrl) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'All license documents are required (Ministry front/back and Syndicate front/back).'
        });
      }

      // Validate legal checkboxes
      const termsAcceptedValid = termsAccepted === true || termsAccepted === 'true';
      const licenseConfirmedValid = licenseConfirmed === true || licenseConfirmed === 'true';
      const verificationConsentValid = verificationConsent === true || verificationConsent === 'true';

      if (!termsAcceptedValid || !licenseConfirmedValid || !verificationConsentValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'All license details and confirmations are required.'
        });
      }
    }

    // Diver-specific validation for verification requirements
    if (expertType === 'diver') {
      // Validate certification document (required for all divers)
      if (!certificationDocumentUrl) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Diving certification document is required for diver registration.'
        });
      }

      // Validate legal checkboxes (required for all divers)
      const diverTermsValid = diverTermsAgreement === true || diverTermsAgreement === 'true';
      const diverAccuracyValid = diverAccuracyConfirmation === true || diverAccuracyConfirmation === 'true';
      const diverConsentValid = diverVerificationConsent === true || diverVerificationConsent === 'true';

      if (!diverTermsValid || !diverAccuracyValid || !diverConsentValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'All three legal confirmations are required for diver registration.'
        });
      }

      // Validate insurance fields if diver is licensed/insured
      const diverLicenseNumber = licenseNumber || tourismLicenseNumber;
      const isInsuredDiver = diverLicenseNumber && diverLicenseNumber.trim() !== '';
      
      if (isInsuredDiver) {
        if (!insuranceDocumentUrl) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Insurance document is required for licensed/insured divers.'
          });
        }
        
        if (!insuranceExpiryDate) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Insurance expiry date is required for licensed/insured divers.'
          });
        }
        
        // Check if insurance is expired
        const insExpiryDate = new Date(insuranceExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (insExpiryDate <= today) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Insurance expired. Please provide valid insurance with a future expiry date.'
          });
        }
      }
    }

    // Mentor-specific validation for legal confirmations
    if (expertType === 'mentor') {
      // Validate role agreement
      const mentorRoleValid = mentorRoleAgreement === true || mentorRoleAgreement === 'true';
      if (!mentorRoleValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Mentor role confirmation is required.'
        });
      }

      // Validate all 3 legal checkboxes
      const mentorTermsValid = mentorTermsAgreement === true || mentorTermsAgreement === 'true';
      const mentorAccuracyValid = mentorAccuracyConfirmation === true || mentorAccuracyConfirmation === 'true';
      const mentorConsentValid = mentorVerificationConsent === true || mentorVerificationConsent === 'true';

      if (!mentorTermsValid || !mentorAccuracyValid || !mentorConsentValid) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'All three legal confirmations are required for mentor registration.'
        });
      }
    }

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await logAction('signup', null, email.toLowerCase(), userType || 'customer', 'failed', 'Email already registered', {});
      return res.status(409).json({
        error: 'Email Already Registered',
        message: 'This email is already registered. Please log in or reset your password.',
        code: 'EMAIL_EXISTS'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const approvalStatus = (userType === 'agency' || userType === 'divecenter' || expertType) ? 'pending' : 'approved';
    // All experts, agencies, and dive centers start with certification_status='pending' for admin review
    const certificationStatus = (userType === 'agency' || userType === 'divecenter' || expertType) ? 'pending' : 'certified';

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, country, user_type, approval_status, certification_status, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, NOW(), NOW())
       RETURNING id, email, full_name, user_type, approval_status, certification_status, created_at`,
      [email.toLowerCase(), passwordHash, fullName, phone, country, userType || 'customer', approvalStatus, certificationStatus]
    );

    const user = userResult.rows[0];
    let expertProfile = null;
    let agencyProfile = null;
    let diveCenterProfile = null;

    // Convert Google Drive URL to direct image URL if needed (used by all profile types)
    const convertGoogleDriveUrl = (url) => {
      if (!url) return null;
      const googleDriveMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (googleDriveMatch) {
        return `https://drive.google.com/uc?export=view&id=${googleDriveMatch[1]}`;
      }
      return url;
    };

    if (expertType && ['guide', 'diver', 'mentor'].includes(expertType)) {
      const slug = (displayName || fullName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const uniqueSlug = `${slug}-${Date.now()}`;

      // Prepare guide-specific license fields
      const isGuide = expertType === 'guide';
      const guideLicenseNumber = isGuide ? (tourismLicenseNumber || licenseNumber) : null;
      const guideLicenseIssueDate = isGuide ? licenseIssueDate : null;
      const guideLicenseExpiryDate = isGuide ? licenseExpiryDate : null;
      const guideMinistryFrontUrl = isGuide ? ministryLicenseFrontUrl : null;
      const guideMinistryBackUrl = isGuide ? ministryLicenseBackUrl : null;
      const guideSyndicateFrontUrl = isGuide ? syndicateLicenseFrontUrl : null;
      const guideSyndicateBackUrl = isGuide ? syndicateLicenseBackUrl : null;
      const guideTermsAccepted = isGuide ? (termsAccepted === true || termsAccepted === 'true') : false;
      const guideLicenseConfirmed = isGuide ? (licenseConfirmed === true || licenseConfirmed === 'true') : false;
      const guideVerificationConsent = isGuide ? (verificationConsent === true || verificationConsent === 'true') : false;
      const guideVerificationStatus = isGuide ? 'pending' : null;
      const guideTermsAcceptedAt = isGuide && guideTermsAccepted ? new Date() : null;

      // Prepare diver-specific verification fields
      const isDiver = expertType === 'diver';
      const diverCertDocUrl = isDiver ? certificationDocumentUrl : null;
      const diverInsDocUrl = isDiver ? insuranceDocumentUrl : null;
      const diverInsExpiryDate = isDiver ? insuranceExpiryDate : null;
      const diverTermsAgreed = isDiver ? (diverTermsAgreement === true || diverTermsAgreement === 'true') : false;
      const diverAccuracyConfirmed = isDiver ? (diverAccuracyConfirmation === true || diverAccuracyConfirmation === 'true') : false;
      const diverVerConsent = isDiver ? (diverVerificationConsent === true || diverVerificationConsent === 'true') : false;

      // Prepare mentor-specific legal confirmation fields
      const isMentor = expertType === 'mentor';
      const mentorRoleAgreed = isMentor ? (mentorRoleAgreement === true || mentorRoleAgreement === 'true') : false;
      const mentorTermsAgreed = isMentor ? (mentorTermsAgreement === true || mentorTermsAgreement === 'true') : false;
      const mentorAccuracyConfirmed = isMentor ? (mentorAccuracyConfirmation === true || mentorAccuracyConfirmation === 'true') : false;
      const mentorVerConsent = isMentor ? (mentorVerificationConsent === true || mentorVerificationConsent === 'true') : false;

      const profileResult = await client.query(
        `INSERT INTO expert_profiles (
          user_id, expert_type, slug, display_name, bio, location,
          languages, specialties, certifications, experience_years,
          profile_photo, cover_photo, whatsapp, instagram, facebook, website,
          country, based_in, destinations,
          availability, rating, total_reviews, total_bookings,
          is_verified, is_featured, view_count,
          license_number, license_issue_date, license_expiry_date,
          ministry_license_front_url, ministry_license_back_url,
          syndicate_license_front_url, syndicate_license_back_url,
          terms_accepted, license_confirmed, verification_consent,
          terms_accepted_at, verification_status,
          certification_document_url, insurance_document_url, insurance_expiry_date,
          diver_terms_agreement, diver_accuracy_confirmation, diver_verification_consent,
          mentor_role_agreement, mentor_terms_agreement, mentor_accuracy_confirmation, mentor_verification_consent,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                'available', 0, 0, 0, false, false, 0,
                $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
                $32, $33, $34, $35, $36, $37,
                $38, $39, $40, $41,
                NOW(), NOW())
        RETURNING id, slug, display_name, expert_type, profile_photo, cover_photo, verification_status`,
        [
          user.id,
          expertType,
          uniqueSlug,
          displayName || fullName,
          bio,
          location || basedIn,
          languages ? JSON.stringify(languages) : null,
          specialties ? JSON.stringify(specialties) : null,
          certifications ? JSON.stringify(certifications) : null,
          experienceYears || (experience ? parseInt(experience) : null),
          convertGoogleDriveUrl(profilePhoto || photoUrl),
          convertGoogleDriveUrl(coverPhoto || coverPhotoUrl),
          whatsapp || phone,
          instagram,
          facebook,
          website,
          country,
          basedIn,
          destinations ? JSON.stringify(destinations) : null,
          guideLicenseNumber,
          guideLicenseIssueDate,
          guideLicenseExpiryDate,
          guideMinistryFrontUrl,
          guideMinistryBackUrl,
          guideSyndicateFrontUrl,
          guideSyndicateBackUrl,
          guideTermsAccepted,
          guideLicenseConfirmed,
          guideVerificationConsent,
          guideTermsAcceptedAt,
          guideVerificationStatus,
          diverCertDocUrl,
          diverInsDocUrl,
          diverInsExpiryDate,
          diverTermsAgreed,
          diverAccuracyConfirmed,
          diverVerConsent,
          mentorRoleAgreed,
          mentorTermsAgreed,
          mentorAccuracyConfirmed,
          mentorVerConsent
        ]
      );

      expertProfile = profileResult.rows[0];
    }

    if (userType === 'agency') {
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const uniqueSlug = `${slug}-${Date.now()}`;

      const agencyResult = await client.query(
        `INSERT INTO agency_profiles (
          user_id, company_name, slug, company_description, location,
          operating_areas, services, specialties, license_number, years_in_business,
          logo_url, website_url, whatsapp, contact_email, facebook, instagram,
          is_verified, is_featured, approval_status, created_at, updated_at,
          country_of_registration, city_of_registration, business_type, tax_vat_number,
          business_license_url, tourism_license_url, sells_egypt_products, egypt_destinations, products_offered,
          company_based_in, has_local_partner, languages_operated, terms_confirmed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false, false, 'pending', NOW(), NOW(),
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        RETURNING id, slug, company_name, approval_status, logo_url`,
        [
          user.id,
          companyName,
          uniqueSlug,
          companyDescription,
          location,
          operatingAreas ? JSON.stringify(operatingAreas) : null,
          services ? JSON.stringify(services) : null,
          specialties ? JSON.stringify(specialties) : null,
          licenseNumber,
          yearsInBusiness,
          convertGoogleDriveUrl(logoUrl),
          websiteUrl,
          whatsapp,
          email.toLowerCase(),
          facebook,
          instagram,
          countryOfRegistration || null,
          cityOfRegistration || null,
          businessType || null,
          taxVatNumber || null,
          businessLicenseUrl || null,
          tourismLicenseUrl || null,
          sellsEgyptProducts !== undefined ? sellsEgyptProducts : true,
          egyptDestinations ? JSON.stringify(egyptDestinations) : null,
          productsOffered ? JSON.stringify(productsOffered) : null,
          companyBasedIn || null,
          hasLocalPartner || null,
          languagesOperated ? JSON.stringify(languagesOperated) : null,
          termsConfirmed !== undefined ? termsConfirmed : false
        ]
      );

      agencyProfile = agencyResult.rows[0];
      
      // Update user with legal confirmation fields
      await client.query(
        `UPDATE users SET agency_legal_confirmation = $1, foreign_agency_confirmation = $2 WHERE id = $3`,
        [
          agencyLegalConfirmation === true || agencyLegalConfirmation === 'true',
          foreignAgencyConfirmation === true || foreignAgencyConfirmation === 'true',
          user.id
        ]
      );
    }

    if (userType === 'divecenter') {
      const slug = centerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const uniqueSlug = `${slug}-${Date.now()}`;

      // Combine specialties with languages (prefixed with 'lang:') for search compatibility
      let combinedSpecialties = Array.isArray(specialties) ? [...specialties] : (specialties ? [specialties] : []);
      if (Array.isArray(languagesSpoken)) {
        languagesSpoken.forEach(lang => {
          combinedSpecialties.push('lang:' + lang);
        });
      }

      const diveCenterResult = await client.query(
        `INSERT INTO dive_center_profiles (
          user_id, center_name, slug, center_description, location,
          dive_sites, services, specialties, padi_center_number, ssi_center_number,
          other_certifications, years_in_business, max_daily_divers,
          logo_url, website_url, whatsapp, contact_email, facebook, instagram,
          languages_spoken,
          dive_center_base, license_authority, license_number, license_issue_date, license_expiry_date,
          license_front_url, license_back_url, country_of_registration, foreign_website_url, foreign_registration_id,
          international_operations_confirmation, terms_agreement, accuracy_confirmation, verification_consent,
          is_verified, is_featured, approval_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
                false, false, 'pending', NOW(), NOW())
        RETURNING id, slug, center_name, approval_status, logo_url`,
        [
          user.id,
          centerName,
          uniqueSlug,
          centerDescription,
          location,
          Array.isArray(diveSites) ? diveSites.join(',') : (diveSites || null),
          Array.isArray(services) ? services.join(',') : (services || null),
          combinedSpecialties.length > 0 ? combinedSpecialties.join(',') : null,
          padiCenterNumber,
          ssiCenterNumber,
          Array.isArray(otherCertifications) ? otherCertifications.join(',') : (otherCertifications || null),
          yearsInBusiness,
          maxDailyDivers,
          convertGoogleDriveUrl(logoUrl),
          websiteUrl,
          whatsapp,
          email.toLowerCase(),
          facebook,
          instagram,
          Array.isArray(languagesSpoken) ? languagesSpoken.join(',') : (languagesSpoken || null),
          diveCenterBase || location || null,
          licenseAuthority || null,
          licenseNumber || null,
          licenseIssueDate || null,
          licenseExpiryDate || null,
          licenseFrontUrl || null,
          licenseBackUrl || null,
          countryOfRegistration || null,
          foreignWebsiteUrl || null,
          foreignRegistrationId || null,
          internationalOperationsConfirmation === true || internationalOperationsConfirmation === 'true',
          termsAgreement === true || termsAgreement === 'true',
          accuracyConfirmation === true || accuracyConfirmation === 'true',
          verificationConsent === true || verificationConsent === 'true'
        ]
      );

      diveCenterProfile = diveCenterResult.rows[0];
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = crypto.createHash('sha256').update(emailVerificationToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await client.query(
      `UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3`,
      [emailVerificationTokenHash, emailVerificationExpires, user.id]
    );

    await client.query('COMMIT');

    // Send verification email via ZeptoMail
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
    const contentHtml = `
      <h2>Welcome to EG Travel Market!</h2>
      <p>Hi ${fullName},</p>
      <p>Thank you for creating an account with us. To complete your registration and start using EG Travel Market, please verify your email address by clicking the button below:</p>
      <p style="text-align: center;">
        <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.primary}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
          ✅ Verify Email Address
        </a>
      </p>
      <p>Or copy and paste this link in your browser:<br/><code style="background: ${COLORS.footer}; padding: 8px; border-radius: 6px; display: block; word-break: break-all; margin-top: 10px; color: ${COLORS.primary}; font-size: 12px;">${verificationUrl}</code></p>
      <p><strong>⏱️ This link will expire in 24 hours.</strong></p>
      <p><strong>Account Type:</strong> ${userType === 'guide' ? 'Tour Guide' : userType === 'diver' ? 'Diving Instructor' : userType === 'mentor' ? 'Travel Mentor' : userType === 'agency' ? 'Travel Agency' : userType === 'divecenter' ? 'Dive Center' : 'Customer'}</p>
      <p style="color: ${COLORS.textMuted}; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
    `;
    const htmlBody = wrapWithBranding(contentHtml, '🎉 Welcome to EG Travel Market!', 'Verify your email to get started');

    // Send email asynchronously (don't block response)
    sendEmail(email, 'Verify Your Email - Welcome to EG Travel Market', htmlBody, fullName).catch(err => {
      console.error('❌ Welcome email send error:', err.message);
    });

    // ❌ DO NOT return token - user must verify email first before login
    const responseMessage = approvalStatus === 'pending' 
      ? 'Registration submitted successfully! Please check your email to verify your account. After verification, admin will review and approve your account.'
      : 'Account created successfully! Please check your email to verify your account.';

    await logAction('signup', user.id, user.email, user.user_type, 'success', `User signed up successfully as ${user.user_type}`, { userType: user.user_type });

    // Send admin notification for new signup (non-blocking)
    const profileName = expertProfile?.display_name || agencyProfile?.company_name || diveCenterProfile?.center_name || null;
    const profileType = expertType || user.user_type;
    sendAdminNewSignupNotification(user, profileType, profileName).catch(err => {
      console.error('❌ Admin signup notification error:', err.message);
    });

    res.status(201).json({
      message: responseMessage,
      token: null,
      requiresEmailVerification: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        approvalStatus: user.approval_status,
        emailVerified: false,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    await logAction('signup', null, req.body.email, req.body.userType || 'customer', 'error', error.message, { errorCode: error.code });
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to create account'
    });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required'
      });
    }

    const result = await client.query(
      `SELECT id, email, password_hash, full_name, user_type, is_active, approval_status, email_verified 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      await logAction('login', null, email.toLowerCase(), 'customer', 'failed', 'Invalid email or password', {});
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated'
      });
    }

    // Allow login if account is not rejected
    if (user.approval_status === 'rejected') {
      return res.status(403).json({
        error: 'Account Rejected',
        message: 'Your account registration was not approved. Please contact support for more information.'
      });
    }

    // Allow pending accounts to login - they can use the system while waiting for approval
    // Email verification is NOT required for initial login to allow testing and account setup

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    await client.query(
      'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    let expertProfile = null;
    if (['guide', 'diver', 'mentor'].includes(user.user_type)) {
      const profileResult = await client.query(
        `SELECT id, slug, display_name, expert_type, profile_photo 
         FROM expert_profiles 
         WHERE user_id = $1`,
        [user.id]
      );
      
      if (profileResult.rows.length > 0) {
        expertProfile = profileResult.rows[0];
      }
    }

    let agencyProfile = null;
    if (user.user_type === 'agency') {
      const agencyResult = await client.query(
        `SELECT id, slug, company_name, logo_url 
         FROM agency_profiles 
         WHERE user_id = $1`,
        [user.id]
      );
      
      if (agencyResult.rows.length > 0) {
        agencyProfile = agencyResult.rows[0];
      }
    }

    let diveCenterProfile = null;
    if (user.user_type === 'divecenter') {
      const diveCenterResult = await client.query(
        `SELECT id, slug, center_name, logo_url 
         FROM dive_center_profiles 
         WHERE user_id = $1`,
        [user.id]
      );
      
      if (diveCenterResult.rows.length > 0) {
        diveCenterProfile = diveCenterResult.rows[0];
      }
    }

    const token = generateToken(user.id, user.email, user.user_type);

    await logAction('login', user.id, user.email, user.user_type, 'success', 'User logged in successfully', {});

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        approvalStatus: user.approval_status
      },
      expertProfile: expertProfile ? {
        id: expertProfile.id,
        slug: expertProfile.slug,
        displayName: expertProfile.display_name,
        expertType: expertProfile.expert_type,
        profilePhoto: expertProfile.profile_photo,
        profileUrl: `/${expertProfile.expert_type}/${expertProfile.slug}`
      } : null,
      agencyProfile: agencyProfile ? {
        id: agencyProfile.id,
        slug: agencyProfile.slug,
        companyName: agencyProfile.company_name,
        logoUrl: agencyProfile.logo_url
      } : null,
      diveCenterProfile: diveCenterProfile ? {
        id: diveCenterProfile.id,
        slug: diveCenterProfile.slug,
        centerName: diveCenterProfile.center_name,
        logoUrl: diveCenterProfile.logo_url
      } : null
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('Stack:', error.stack);
    await logAction('login', null, req.body.email, 'customer', 'error', error.message, { errorCode: error.code });
    res.status(500).json({
      error: 'Server Error',
      message: error.message || 'Login failed'
    });
  } finally {
    client.release();
  }
});

// Admin login with HTML redirect (form-based)
router.post('/admin-form-login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send(`<!DOCTYPE html>
<html><body>
<h1>Error: Email and password required</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
    }

    const result = await client.query(
      `SELECT id, email, password_hash, full_name, user_type, is_active, approval_status 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).send(`<!DOCTYPE html>
<html><body>
<h1>Invalid email or password</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).send(`<!DOCTYPE html>
<html><body>
<h1>Account is deactivated</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
    }

    if (user.user_type !== 'admin') {
      return res.status(403).send(`<!DOCTYPE html>
<html><body>
<h1>Admin access only</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).send(`<!DOCTYPE html>
<html><body>
<h1>Invalid email or password</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
    }

    const token = generateToken(user.id, user.email, user.user_type);

    return res.status(200).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Login Success</title></head>
<body>
<h1>Login successful, redirecting...</h1>
<script>
  localStorage.setItem('authToken', '${token}');
  localStorage.setItem('currentUser', ${JSON.stringify(JSON.stringify({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    userType: user.user_type,
    approvalStatus: user.approval_status
  }))});
  window.location.href = '/admin-comprehensive.html';
</script>
</body>
</html>`);

  } catch (error) {
    console.error('❌ Admin form login error:', error.message);
    return res.status(500).send(`<!DOCTYPE html>
<html><body>
<h1>Server error: ${error.message}</h1>
<script>setTimeout(() => window.location.href = '/admin-login.html', 2000);</script>
</body></html>`);
  } finally {
    client.release();
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(
      `SELECT id, email, full_name, phone, country, user_type, is_active, email_verified, approval_status, created_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    const parseArrayField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'string') {
        const trimmed = field.trim();
        // If it looks like JSON, try to parse it
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            return [];
          } catch (e) {
            // If parsing fails, treat as comma-separated
          }
        }
        // Treat as comma-separated
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    let expertProfile = null;
    if (['guide', 'diver', 'mentor'].includes(user.user_type)) {
      const profileResult = await pool.query(
        `SELECT * FROM expert_profiles WHERE user_id = $1`,
        [user.id]
      );
      
      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        expertProfile = {
          id: profile.id,
          slug: profile.slug,
          displayName: profile.display_name,
          expertType: profile.expert_type,
          bio: profile.bio,
          location: profile.location,
          languages: parseArrayField(profile.languages),
          specialties: parseArrayField(profile.specialties),
          certifications: parseArrayField(profile.certifications),
          experienceYears: profile.experience_years,
          experience: String(profile.experience_years || ''),
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
          rating: profile.rating,
          totalReviews: profile.total_reviews,
          totalBookings: profile.total_bookings,
          isVerified: profile.is_verified,
          isFeatured: profile.is_featured,
          viewCount: profile.view_count,
          profileUrl: `/${profile.expert_type}/${profile.slug}`,
          country: profile.country,
          basedIn: profile.based_in,
          destinations: parseArrayField(profile.destinations)
        };
      }
    }

    let agencyProfile = null;
    if (user.user_type === 'agency') {
      const agencyResult = await pool.query(
        `SELECT * FROM agency_profiles WHERE user_id = $1`,
        [user.id]
      );
      
      if (agencyResult.rows.length > 0) {
        const profile = agencyResult.rows[0];
        agencyProfile = {
          id: profile.id,
          slug: profile.slug,
          companyName: profile.company_name,
          companyDescription: profile.company_description,
          location: profile.location,
          operatingAreas: parseArrayField(profile.operating_areas),
          services: parseArrayField(profile.services),
          specialties: parseArrayField(profile.specialties),
          licenseNumber: profile.license_number,
          yearsInBusiness: profile.years_in_business,
          logoUrl: profile.logo_url,
          websiteUrl: profile.website_url,
          whatsapp: profile.whatsapp,
          contactEmail: profile.contact_email,
          facebook: profile.facebook,
          instagram: profile.instagram,
          isVerified: profile.is_verified,
          isFeatured: profile.is_featured,
          approvalStatus: profile.approval_status,
          rejectionReason: profile.rejection_reason
        };
      }
    }

    let diveCenterProfile = null;
    if (user.user_type === 'divecenter') {
      const diveCenterResult = await pool.query(
        `SELECT * FROM dive_center_profiles WHERE user_id = $1`,
        [user.id]
      );
      
      if (diveCenterResult.rows.length > 0) {
        const profile = diveCenterResult.rows[0];
        
        diveCenterProfile = {
          id: profile.id,
          slug: profile.slug,
          centerName: profile.center_name,
          centerDescription: profile.center_description,
          location: profile.location,
          diveSites: parseArrayField(profile.dive_sites),
          services: parseArrayField(profile.services),
          specialties: parseArrayField(profile.specialties),
          padiCenterNumber: profile.padi_center_number,
          ssiCenterNumber: profile.ssi_center_number,
          otherCertifications: parseArrayField(profile.other_certifications),
          yearsInBusiness: profile.years_in_business,
          maxDailyDivers: profile.max_daily_divers,
          logoUrl: profile.logo_url,
          websiteUrl: profile.website_url,
          whatsapp: profile.whatsapp,
          contactEmail: profile.contact_email,
          facebook: profile.facebook,
          instagram: profile.instagram,
          isVerified: profile.is_verified,
          isFeatured: profile.is_featured,
          approvalStatus: profile.approval_status,
          rejectionReason: profile.rejection_reason
        };
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        country: user.country,
        userType: user.user_type,
        isActive: user.is_active,
        emailVerified: user.email_verified,
        approvalStatus: user.approval_status,
        createdAt: user.created_at
      },
      expertProfile,
      agencyProfile,
      diveCenterProfile
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to get user information'
    });
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and verification token are required'
      });
    }

    const emailVerificationTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const userResult = await client.query(
      `SELECT id FROM users 
       WHERE email = $1 
       AND email_verification_token = $2 
       AND email_verification_expires > NOW()`,
      [email.toLowerCase(), emailVerificationTokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or Expired Token',
        message: 'Verification link has expired or is invalid'
      });
    }

    const user = userResult.rows[0];

    await client.query(
      `UPDATE users 
       SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    res.status(200).json({
      message: 'Email verified successfully. Your account is now active.'
    });

  } catch (error) {
    console.error('❌ Email verification error:', error.message);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to verify email'
    });
  } finally {
    client.release();
  }
});

router.post('/logout', verifyToken, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

// Forgot Password - Request Password Reset
router.post('/forgot-password', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email is required'
      });
    }

    const userResult = await client.query(
      'SELECT id, email, full_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists (security best practice)
      return res.status(200).json({
        message: 'If an account exists with that email, a reset link has been sent'
      });
    }

    const user = userResult.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Store token in database
    await client.query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3`,
      [resetTokenHash, resetExpires, user.id]
    );

    // Create reset URL - adjust domain based on environment
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send email via ZeptoMail with brand colors
    const contentHtml = `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.full_name},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background-color: ${COLORS.primary}; color: ${COLORS.white}; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
          🔑 Reset Password
        </a>
      </p>
      <p>Or copy and paste this link in your browser:<br/><code style="background: ${COLORS.footer}; padding: 8px; border-radius: 6px; display: block; word-break: break-all; margin-top: 10px; color: ${COLORS.primary}; font-size: 12px;">${resetUrl}</code></p>
      <p><strong>⏱️ This link will expire in 1 hour.</strong></p>
      <p>If you didn't request this, please ignore this email or <a href="mailto:info@egtravelmarket.com" style="color: ${COLORS.primary};">contact support</a> immediately.</p>
      <p style="color: ${COLORS.textMuted}; font-size: 12px;">🔒 Your security is important to us. Never share your reset link with anyone.</p>
    `;
    const htmlBody = wrapWithBranding(contentHtml, '🔑 Password Reset', 'Secure link to reset your password');

    try {
      await sendEmail(email, 'Password Reset Request - EG Travel Market', htmlBody, user.full_name);
      console.log('✅ Password reset email sent successfully to:', email);
    } catch (emailError) {
      const zepto = emailError.response?.data;
      const zepto_status = emailError.response?.status;
      const isQuotaExhausted = zepto?.error?.details?.some(d => d.code === 'LE_102');
      console.error('❌ CRITICAL: Email sending failed for password reset:', {
        zeptoStatus: zepto_status,
        zeptoCode: zepto?.error?.code,
        zeptoMessage: zepto?.error?.message,
        localError: emailError.message
      });
      const userMessage = isQuotaExhausted
        ? 'Email service is temporarily unavailable. Please contact support at info@egtravelmarket.com to reset your password.'
        : 'Failed to send password reset email. Please try again or contact support at info@egtravelmarket.com.';
      return res.status(503).json({
        error: 'Email Service Error',
        message: userMessage
      });
    }

    res.status(200).json({
      message: 'If an account exists with that email, a reset link has been sent'
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to process password reset request'
    });
  } finally {
    client.release();
  }
});

// Reset Password - Verify Token and Update Password
router.post('/reset-password', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, token, and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const userResult = await client.query(
      `SELECT id FROM users 
       WHERE email = $1 
       AND password_reset_token = $2 
       AND password_reset_expires > NOW()`,
      [email.toLowerCase(), resetTokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or Expired Token',
        message: 'Reset link has expired or is invalid'
      });
    }

    const user = userResult.rows[0];

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token; return user_type for client redirect
    const updateResult = await client.query(
      `UPDATE users 
       SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
       WHERE id = $2
       RETURNING user_type`,
      [newPasswordHash, user.id]
    );

    const userType = updateResult.rows[0]?.user_type || 'guide';

    res.status(200).json({
      message: 'Password reset successful. Please log in with your new password.',
      userType
    });

  } catch (error) {
    console.error('❌ Reset password error:', error.message);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to reset password'
    });
  } finally {
    client.release();
  }
});

// ========== ADMIN: GET ALL USERS ==========
router.get('/admin/users', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is admin
    if (user.userType !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin only' });
    }
    
    const result = await pool.query(
      `SELECT id, email, full_name, user_type, approval_status, is_active, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
