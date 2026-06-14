document.addEventListener('DOMContentLoaded', function() {
  // Find the signup form specifically (more robust selector)
  let form = document.getElementById('expert-signup-form') || 
             document.querySelector('form[id*="signup"]') ||
             document.querySelector('form');
  
  if (!form) {
    console.error('❌ Signup form not found!');
    return;
  }
  
  console.log('✅ Found signup form:', form.id || 'unnamed');

  // Get fields that are already in the HTML
  const inputs = {
    fullName: form.querySelector('input[placeholder*="Mohamed"], input[placeholder*="Sara"], input[placeholder*="Ahmed"], input[placeholder*="Name"]') || form.querySelector('input[type="text"]'),
    email: form.querySelector('input[type="email"]'),
    password: document.getElementById('password') || document.getElementById('mentor-password') || document.getElementById('guide-password') || document.getElementById('diver-password') || form.querySelector('input[type="password"][name="password"]'),
    confirmPassword: document.getElementById('confirmPassword') || document.getElementById('mentor-confirm-password') || document.getElementById('guide-confirm-password') || document.getElementById('diver-confirm-password') || form.querySelector('input[type="password"][name="confirmPassword"]'),
    phone: form.querySelector('input[placeholder*="WhatsApp"], input[placeholder*="Phone"], input[placeholder*="XXX"]'),
    location: form.querySelector('input[placeholder*="Cairo"], input[placeholder*="Sharm"], input[placeholder*="Location"]'),
    languages: form.querySelector('input[placeholder*="EN"], input[placeholder*="Languages"], input[placeholder*="AR"]'),
    experienceYears: form.querySelector('input[type="number"]'),
    certifications: form.querySelector('input[placeholder*="License"], input[placeholder*="PADI"], input[placeholder*="Certifications"]'),
    profilePhotoFile: document.getElementById('photo-url'),
    profilePhotoUrl: document.getElementById('photo-url-backup') || form.querySelector('input[placeholder*="https"]'),
    bio: form.querySelector('textarea')
  };

  const expertType = document.title.includes('Guide') ? 'guide' 
                   : document.title.includes('Diver') ? 'diver' 
                   : 'mentor';
  

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    const emailValue = inputs.email?.value?.trim();
    const passwordValue = inputs.password?.value;
    const confirmPasswordValue = inputs.confirmPassword?.value;
    const fullNameValue = inputs.fullName?.value?.trim();
    const phoneValue = inputs.phone?.value?.trim();
    const locationValue = inputs.location?.value?.trim();
    const languagesValue = inputs.languages?.value?.trim();
    const experienceYearsValue = inputs.experienceYears?.value;
    const certificationsValue = inputs.certifications?.value?.trim();
    const bioValue = inputs.bio?.value?.trim();

    if (!emailValue || !passwordValue || !fullNameValue) {
      alert('Please fill in all required fields');
      return;
    }

    if (passwordValue !== confirmPasswordValue) {
      alert('Passwords do not match');
      return;
    }

    if (passwordValue.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    // For mentors and guides, collect from dropdowns; for divers, parse text input
    let languages = [];
    let specialties = [];
    let destinations = [];
    let countryValue = null;
    let basedInValue = null;
    let experienceValue = experienceYearsValue;
    let hasTourismLicense = null;
    let tourismLicenseNumber = null;
    let certifications = [];
    
    if (expertType === 'mentor') {
      // Collect checked languages from checkboxes
      form.querySelectorAll('input[name="languages"]:checked').forEach(cb => {
        languages.push(cb.value);
      });
      
      // Collect checked specialties from checkboxes  
      form.querySelectorAll('input[name="specialties"]:checked').forEach(cb => {
        specialties.push(cb.value);
      });
      
      // Collect checked destinations from checkboxes
      form.querySelectorAll('input[name="destinations"]:checked').forEach(cb => {
        destinations.push(cb.value);
      });
      
      // Get country and basedIn from select dropdowns
      const countrySelect = form.querySelector('select[name="country"]');
      const basedInSelect = form.querySelector('select[name="basedIn"]');
      const experienceSelect = form.querySelector('select[name="experience"]');
      
      countryValue = countrySelect?.value || null;
      basedInValue = basedInSelect?.value || null;
      experienceValue = experienceSelect?.value || null;
      
      // Fallback to defaults if no specialties selected
      if (specialties.length === 0) {
        specialties = ['Travel Planning', 'Trip Consulting', 'Local Insights'];
      }
    } else if (expertType === 'guide') {
      // Guide: collect from checkbox dropdowns
      const languageOther = form.querySelector('input[name="language_other"]');
      
      // Collect languages from checkboxes
      form.querySelectorAll('input[name="languages[]"]:checked').forEach(cb => {
        if (cb.value === 'Other') {
          const otherLang = languageOther?.value?.trim();
          if (otherLang) {
            languages.push(otherLang);
          }
        } else {
          languages.push(cb.value);
        }
      });
      
      // Collect specialties from checkboxes
      form.querySelectorAll('input[name="specialties[]"]:checked').forEach(cb => {
        specialties.push(cb.value);
      });
      
      // Collect locations from checkboxes (use as destinations for guides)
      form.querySelectorAll('input[name="locations[]"]:checked').forEach(cb => {
        destinations.push(cb.value);
      });
      
      // Get license information (now required)
      const licenseNumberInput = form.querySelector('input[name="license_number"]');
      tourismLicenseNumber = licenseNumberInput?.value?.trim() || null;
      hasTourismLicense = !!tourismLicenseNumber;
      
      // Fallback to defaults if no specialties selected
      if (specialties.length === 0) {
        specialties = ['Cultural Tours', 'Historical Tours'];
      }
      
      // Fallback for languages if none selected but text input exists
      if (languages.length === 0 && languagesValue) {
        languages = languagesValue.split(/[,\/]/).map(lang => lang.trim()).filter(Boolean);
      }
    } else if (expertType === 'diver') {
      // Diver: collect from checkbox dropdowns (new structured fields)
      const languageOther = form.querySelector('input[name="language_other"]');
      const certOther = form.querySelector('input[name="certification_other"]');
      
      // Collect languages from checkboxes
      form.querySelectorAll('input[name="languages[]"]:checked').forEach(cb => {
        if (cb.value === 'Other') {
          const otherLang = languageOther?.value?.trim();
          if (otherLang) {
            languages.push(otherLang);
          }
        } else {
          languages.push(cb.value);
        }
      });
      
      // Collect diver roles/types as specialties
      form.querySelectorAll('input[name="diver_roles[]"]:checked').forEach(cb => {
        specialties.push(cb.value);
      });
      
      // Collect certifications from checkboxes
      form.querySelectorAll('input[name="certifications[]"]:checked').forEach(cb => {
        if (cb.value === 'Other') {
          const otherCert = certOther?.value?.trim();
          if (otherCert) {
            certifications.push(otherCert);
          }
        } else {
          certifications.push(cb.value);
        }
      });
      
      // Get primary location
      const primaryLocationSelect = form.querySelector('select[name="primary_location"]');
      basedInValue = primaryLocationSelect?.value || null;
      
      // Collect locations covered as destinations
      form.querySelectorAll('input[name="locations[]"]:checked').forEach(cb => {
        destinations.push(cb.value);
      });
      
      // Get license/insurance info
      const licensedRadio = form.querySelector('input[name="is_licensed"]:checked');
      const licenseNumberInput = form.querySelector('input[name="license_number"]');
      
      hasTourismLicense = licensedRadio?.value === 'yes';
      if (hasTourismLicense && licenseNumberInput?.value?.trim()) {
        tourismLicenseNumber = licenseNumberInput.value.trim();
      }
      
      // Fallback for languages if none selected
      if (languages.length === 0 && languagesValue) {
        languages = languagesValue.split(/[,\/]/).map(lang => lang.trim()).filter(Boolean);
      }
      
      // Fallback for specialties
      if (specialties.length === 0) {
        specialties = ['Scuba Diving', 'Red Sea', 'Underwater Tours'];
      }
    }
    
    // Handle diver-specific verification fields
    let diverVerificationData = {};
    if (expertType === 'diver') {
      const diverTermsAgreement = form.querySelector('input[name="diver_terms_agreement"]')?.checked || false;
      const diverAccuracyConfirmation = form.querySelector('input[name="diver_accuracy_confirmation"]')?.checked || false;
      const diverVerificationConsent = form.querySelector('input[name="diver_verification_consent"]')?.checked || false;
      
      // Validate all legal checkboxes
      if (!diverTermsAgreement || !diverAccuracyConfirmation || !diverVerificationConsent) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
          errorEl.textContent = 'Please accept all legal confirmations to proceed.';
          errorEl.style.display = 'block';
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        return;
      }
      
      // Upload certification document (required)
      const certDocFile = form.querySelector('input[name="certification_document"]');
      const certDocUrl = form.querySelector('input[name="certification_document_url"]')?.value?.trim();
      let certificationDocumentUrl = null;
      
      if (certDocFile?.files?.length > 0) {
        const file = certDocFile.files[0];
        console.log('📄 Uploading certification document:', file.name);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-signup-photo`, {
            method: 'POST',
            body: formData
          });
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            certificationDocumentUrl = uploadData.photoUrl || uploadData.url;
            console.log('✅ Certification document uploaded:', certificationDocumentUrl);
          } else {
            throw new Error('Upload failed');
          }
        } catch (uploadError) {
          console.error('❌ Certification document upload error:', uploadError.message);
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = 'Failed to upload certification document. Please try again.';
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
      } else if (certDocUrl) {
        certificationDocumentUrl = certDocUrl;
      } else {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
          errorEl.textContent = 'Please upload your diving certification document.';
          errorEl.style.display = 'block';
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        return;
      }
      
      // Handle insurance fields (conditional on is_licensed = yes)
      const licensedRadio = form.querySelector('input[name="is_licensed"]:checked');
      const isLicensed = licensedRadio?.value === 'yes';
      let insuranceDocumentUrl = null;
      let insuranceExpiryDate = null;
      
      if (isLicensed) {
        const insDocFile = form.querySelector('input[name="insurance_document"]');
        const insDocUrl = form.querySelector('input[name="insurance_document_url"]')?.value?.trim();
        insuranceExpiryDate = form.querySelector('input[name="insurance_expiry_date"]')?.value;
        
        // Validate insurance expiry date
        if (!insuranceExpiryDate) {
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = 'Insurance expiry date is required for licensed/insured divers.';
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
        
        const expiryDate = new Date(insuranceExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiryDate <= today) {
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = 'Insurance expired. Please provide a valid insurance with a future expiry date.';
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
        
        // Upload insurance document
        if (insDocFile?.files?.length > 0) {
          const file = insDocFile.files[0];
          console.log('📄 Uploading insurance document:', file.name);
          const formData = new FormData();
          formData.append('file', file);
          
          try {
            const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-signup-photo`, {
              method: 'POST',
              body: formData
            });
            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              insuranceDocumentUrl = uploadData.photoUrl || uploadData.url;
              console.log('✅ Insurance document uploaded:', insuranceDocumentUrl);
            } else {
              throw new Error('Upload failed');
            }
          } catch (uploadError) {
            console.error('❌ Insurance document upload error:', uploadError.message);
            const errorEl = document.getElementById('error-message');
            if (errorEl) {
              errorEl.textContent = 'Failed to upload insurance document. Please try again.';
              errorEl.style.display = 'block';
              errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
            return;
          }
        } else if (insDocUrl) {
          insuranceDocumentUrl = insDocUrl;
        } else {
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = 'Please upload your insurance document.';
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
      }
      
      diverVerificationData = {
        certificationDocumentUrl,
        insuranceDocumentUrl,
        insuranceExpiryDate,
        diverTermsAgreement,
        diverAccuracyConfirmation,
        diverVerificationConsent
      };
    }
    
    // Handle mentor-specific legal confirmations
    let mentorLegalData = {};
    if (expertType === 'mentor') {
      const roleAgreement = form.querySelector('input[name="roleAgreement"]')?.checked || false;
      const mentorTermsAgreement = form.querySelector('input[name="mentorTermsAgreement"]')?.checked || false;
      const mentorAccuracyConfirmation = form.querySelector('input[name="mentorAccuracyConfirmation"]')?.checked || false;
      const mentorVerificationConsent = form.querySelector('input[name="mentorVerificationConsent"]')?.checked || false;
      
      // Validate all checkboxes (role + 3 legal)
      if (!roleAgreement || !mentorTermsAgreement || !mentorAccuracyConfirmation || !mentorVerificationConsent) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
          errorEl.textContent = 'Please accept the role confirmation and all legal confirmations to proceed.';
          errorEl.style.display = 'block';
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        return;
      }
      
      mentorLegalData = {
        mentorRoleAgreement: roleAgreement,
        mentorTermsAgreement: mentorTermsAgreement,
        mentorAccuracyConfirmation: mentorAccuracyConfirmation,
        mentorVerificationConsent: mentorVerificationConsent
      };
    }
    
    if (expertType !== 'guide' && expertType !== 'diver') {
      // Generic fallback
      languages = languagesValue ? 
        languagesValue.split(/[,\/]/).map(lang => lang.trim()).filter(Boolean) : [];
      
      specialties = ['Scuba Diving', 'Red Sea', 'Underwater Tours'];
    }

    // For non-diver types, use text input for certifications if not already filled
    if (certifications.length === 0 && certificationsValue) {
      certifications = [certificationsValue];
    }

    // Handle photo file upload
    let profilePhotoUrl = null;
    console.log('📷 Checking photo inputs...');
    console.log('  - File input element:', inputs.profilePhotoFile);
    console.log('  - Files selected:', inputs.profilePhotoFile?.files?.length || 0);
    console.log('  - URL input value:', inputs.profilePhotoUrl?.value || 'empty');
    
    if (inputs.profilePhotoFile?.files?.length > 0) {
      const file = inputs.profilePhotoFile.files[0];
      console.log('📷 Uploading photo:', file.name, file.size, 'bytes');
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-signup-photo`, {
          method: 'POST',
          body: formData
        });
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          profilePhotoUrl = uploadData.photoUrl || uploadData.url;
          console.log('✅ Profile photo uploaded during signup:', profilePhotoUrl);
        } else {
          const errorData = await uploadResponse.json().catch(() => ({}));
          console.warn('⚠️ Photo upload failed:', errorData.error || uploadResponse.status);
        }
      } catch (uploadError) {
        console.warn('⚠️ Photo upload error, continuing without photo:', uploadError.message);
      }
    } else if (inputs.profilePhotoUrl?.value?.trim()) {
      profilePhotoUrl = inputs.profilePhotoUrl.value.trim();
      console.log('📷 Using URL for photo:', profilePhotoUrl);
    } else {
      console.log('📷 No photo provided - continuing without photo');
    }

    // Handle guide-specific license document uploads
    let guideLicenseData = {};
    if (expertType === 'guide') {
      const licenseIssueDate = form.querySelector('input[name="license_issue_date"]')?.value || null;
      const licenseExpiryDate = form.querySelector('input[name="license_expiry_date"]')?.value || null;
      const termsAccepted = form.querySelector('input[name="terms_accepted"]')?.checked || false;
      const licenseConfirmed = form.querySelector('input[name="license_confirmed"]')?.checked || false;
      const verificationConsent = form.querySelector('input[name="verification_consent"]')?.checked || false;
      
      // Validate license expiry date
      if (licenseExpiryDate) {
        const expiryDate = new Date(licenseExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiryDate <= today) {
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = 'License expired. Please upload a valid license with a future expiry date.';
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
      
      // Validate all checkboxes are checked
      if (!termsAccepted || !licenseConfirmed || !verificationConsent) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
          errorEl.textContent = 'Please accept all legal confirmations and agreements to proceed.';
          errorEl.style.display = 'block';
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      
      // Upload license documents
      const licenseFiles = {
        ministryLicenseFront: form.querySelector('input[name="ministry_license_front"]'),
        ministryLicenseBack: form.querySelector('input[name="ministry_license_back"]'),
        syndicateLicenseFront: form.querySelector('input[name="syndicate_license_front"]'),
        syndicateLicenseBack: form.querySelector('input[name="syndicate_license_back"]')
      };
      
      let licenseUrls = {};
      for (const [key, input] of Object.entries(licenseFiles)) {
        if (input?.files?.length > 0) {
          const file = input.files[0];
          console.log(`📄 Uploading ${key}:`, file.name, file.size, 'bytes');
          const formData = new FormData();
          formData.append('file', file);
          
          try {
            const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-signup-photo`, {
              method: 'POST',
              body: formData
            });
            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              licenseUrls[key] = uploadData.photoUrl || uploadData.url;
              console.log(`✅ ${key} uploaded:`, licenseUrls[key]);
            } else {
              throw new Error(`Failed to upload ${key}`);
            }
          } catch (uploadError) {
            console.error(`❌ ${key} upload error:`, uploadError.message);
            const errorEl = document.getElementById('error-message');
            if (errorEl) {
              errorEl.textContent = `Failed to upload ${key.replace(/([A-Z])/g, ' $1').trim()}. Please try again.`;
              errorEl.style.display = 'block';
              errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
          }
        } else {
          const errorEl = document.getElementById('error-message');
          if (errorEl) {
            errorEl.textContent = `Please upload all required license documents.`;
            errorEl.style.display = 'block';
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
      
      guideLicenseData = {
        licenseIssueDate,
        licenseExpiryDate,
        termsAccepted,
        licenseConfirmed,
        verificationConsent,
        ministryLicenseFrontUrl: licenseUrls.ministryLicenseFront,
        ministryLicenseBackUrl: licenseUrls.ministryLicenseBack,
        syndicateLicenseFrontUrl: licenseUrls.syndicateLicenseFront,
        syndicateLicenseBackUrl: licenseUrls.syndicateLicenseBack
      };
    }

    const signupData = {
      email: emailValue,
      password: passwordValue,
      fullName: fullNameValue,
      phone: phoneValue || null,
      country: countryValue || 'Egypt',
      basedIn: basedInValue || null,
      destinations: destinations.length > 0 ? destinations : null,
      experience: experienceValue || null,
      userType: expertType,
      expertType: expertType,
      displayName: fullNameValue,
      bio: bioValue || null,
      location: destinations.length > 0 ? destinations[0] : (locationValue || basedInValue || null),
      languages: languages,
      specialties: specialties,
      certifications: (expertType === 'guide' && tourismLicenseNumber) ? [tourismLicenseNumber] : certifications,
      hasTourismLicense: hasTourismLicense,
      tourismLicenseNumber: tourismLicenseNumber,
      experienceYears: experienceValue ? parseInt(experienceValue) : null,
      whatsapp: phoneValue || null,
      photoUrl: profilePhotoUrl,
      ...guideLicenseData,
      ...diverVerificationData,
      ...mentorLegalData
    };

    try {
      submitButton.disabled = true;
      submitButton.textContent = 'Creating account...';
      submitButton.style.opacity = '0.6';

      // Use apiClient directly (it should be available globally)
      if (typeof apiClient === 'undefined' || !apiClient) {
        throw new Error('API Client not loaded. Please refresh the page.');
      }
      if (typeof apiClient.signup !== 'function') {
        throw new Error('Signup method not available. Please refresh the page.');
      }

      const result = await apiClient.signup(signupData);
      console.log('✅ Signup successful:', result);

      if (window.MetaPixelEvents) {
        window.MetaPixelEvents.trackCompleteRegistration(expertType);
      }

      submitButton.textContent = '✓ Account Created!';
      submitButton.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
      submitButton.disabled = true;

      setTimeout(function() {
        // Show verification message - DO NOT redirect
        const welcomeMessage = `
🎉 Welcome to EgyTravelMarket!

✅ Your ${expertType} account has been created successfully!

📧 VERIFY YOUR EMAIL
We've sent a verification link to: ${emailValue}

Please check your email and click the verification link.

IMPORTANT - Three Steps to Access Your Dashboard:
1️⃣ Click the verification link in your email
2️⃣ Admin will review your profile
3️⃣ Once approved, you can login and access your dashboard

Check your email NOW!
        `;
        alert(welcomeMessage);
        
        // Redirect to login page (user still needs to verify email first)
        window.location.href = `/${expertType}-login.html`;
      }, 1000);

    } catch (error) {
      console.error('❌ Signup error:', error);
      console.error('Error stack:', error.stack);
      
      let errorMessage = 'Failed to create account. ';
      let showLoginLink = false;
      
      if (error.message.includes('already registered') || error.message.includes('EMAIL_EXISTS')) {
        errorMessage = 'This email is already registered. Please log in or reset your password.';
        showLoginLink = true;
      } else if (error.message.includes('password')) {
        errorMessage += 'Please check your password requirements.';
      } else if (error.message.includes('API Client') || error.message.includes('method')) {
        errorMessage += 'System error - please refresh the page and try again.';
      } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        errorMessage = 'Signup couldn\'t be completed because your browser or network security is blocking the connection. Please disable ad-blockers or privacy extensions, or try another browser, then submit again.';
      } else if (error.message.includes('network') || error.message.includes('Connection')) {
        errorMessage = 'Network error: Please check your connection and try again.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }

      console.error('Showing error:', errorMessage);
      
      const errorEl = document.getElementById('error-message');
      if (errorEl) {
        if (showLoginLink) {
          errorEl.innerHTML = `${errorMessage} <a href="/${expertType}-login.html" style="color: #3da9fc; text-decoration: underline;">Log in here</a> | <a href="/forgot-password.html" style="color: #3da9fc; text-decoration: underline;">Reset password</a>`;
        } else {
          errorEl.textContent = errorMessage;
        }
        errorEl.style.display = 'block';
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(errorMessage);
      }
      
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      submitButton.style.opacity = '1';
      submitButton.style.background = '';
    }
  });

  if (inputs.password) {
    inputs.password.addEventListener('input', function() {
      const value = this.value;
      const parent = this.closest('div');
      const helper = parent?.querySelector('small');
      
      if (!helper) return;
      
      if (value.length === 0) {
        helper.style.color = '#666';
        helper.textContent = 'Must be at least 8 characters long';
      } else if (value.length < 8) {
        helper.style.color = '#e74c3c';
        helper.textContent = `⚠ ${8 - value.length} more character${8 - value.length > 1 ? 's' : ''} needed`;
      } else {
        helper.style.color = '#27ae60';
        helper.textContent = '✓ Password meets requirements';
      }
    });
  }

  console.log(`✅ Expert signup form initialized for: ${expertType}`);
});
