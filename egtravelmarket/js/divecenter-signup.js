document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('divecenter-signup-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';

    const diveCenterBase = form.querySelector('#diveCenterBase')?.value || '';
    const isEgyptBased = diveCenterBase === 'Egypt-based Dive Center';
    const isInternational = diveCenterBase === 'International Dive Center';

    const termsAgreement = document.getElementById('termsAgreement');
    const accuracyConfirmation = document.getElementById('accuracyConfirmation');
    const verificationConsent = document.getElementById('verificationConsent');
    
    if (!termsAgreement?.checked || !accuracyConfirmation?.checked || !verificationConsent?.checked) {
      if (errorMessage) {
        errorMessage.textContent = 'Please check all three legal confirmation boxes before submitting.';
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (isEgyptBased) {
      const licenseAuthority = form.querySelector('#licenseAuthority')?.value;
      const licenseNumber = form.querySelector('#licenseNumber')?.value.trim();
      const licenseIssueDate = form.querySelector('#licenseIssueDate')?.value;
      const licenseExpiryDate = form.querySelector('#licenseExpiryDate')?.value;
      const licenseFrontUrl = form.querySelector('#licenseFrontUrl')?.value;
      const licenseBackUrl = form.querySelector('#licenseBackUrl')?.value;

      if (!licenseAuthority) {
        showError('Please select your license authority.');
        return;
      }
      if (!licenseNumber) {
        showError('Please enter your license number.');
        return;
      }
      if (!licenseIssueDate) {
        showError('Please enter your license issue date.');
        return;
      }
      if (!licenseExpiryDate) {
        showError('Please enter your license expiry date.');
        return;
      }
      
      const expiryDate = new Date(licenseExpiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        showError('Your license has expired. Please provide a valid, non-expired license.');
        return;
      }
      
      if (!licenseFrontUrl) {
        showError('Please upload your license document front.');
        return;
      }
      if (!licenseBackUrl) {
        showError('Please upload your license document back.');
        return;
      }
    }

    if (isInternational) {
      const countryOfRegistration = form.querySelector('#countryOfRegistration')?.value.trim();
      const foreignWebsiteUrl = form.querySelector('#foreignWebsiteUrl')?.value.trim();
      const foreignRegistrationId = form.querySelector('#foreignRegistrationId')?.value.trim();
      const internationalConfirmation = form.querySelector('#internationalOperationsConfirmation')?.checked;

      if (!countryOfRegistration) {
        showError('Please enter your country of registration.');
        return;
      }
      if (!foreignWebsiteUrl && !foreignRegistrationId) {
        showError('Please provide either your website URL or foreign business registration ID.');
        return;
      }
      if (!internationalConfirmation) {
        showError('Please confirm that all diving activities in Egypt are operated by licensed Egyptian dive centers.');
        return;
      }
    }

    const password = form.querySelector('#password').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    const services = [];
    form.querySelectorAll('input[id^="service-"]:checked').forEach(checkbox => {
      services.push(checkbox.value);
    });

    const divingLocations = [];
    form.querySelectorAll('input[id^="location-"]:checked').forEach(checkbox => {
      divingLocations.push(checkbox.value);
    });

    const certifications = [];
    form.querySelectorAll('input[id^="cert-"]:checked').forEach(checkbox => {
      if (checkbox.id !== 'cert-other') {
        certifications.push(checkbox.value);
      }
    });
    const certOtherText = form.querySelector('#certOtherText')?.value.trim();
    if (certOtherText) {
      certifications.push(certOtherText);
    }

    const languagesSpoken = [];
    form.querySelectorAll('input[id^="lang-"]:checked').forEach(checkbox => {
      if (checkbox.id !== 'lang-other') {
        languagesSpoken.push(checkbox.value);
      }
    });
    const langOtherText = form.querySelector('#langOtherText')?.value.trim();
    if (langOtherText) {
      langOtherText.split(',').forEach(lang => {
        const trimmed = lang.trim();
        if (trimmed) languagesSpoken.push(trimmed);
      });
    }

    if (languagesSpoken.length === 0) {
      showError('Please select at least one language spoken');
      return;
    }

    const logoUrl = form.querySelector('#photoUrl')?.value.trim() || null;

    const email = form.querySelector('#email').value.trim();
    let websiteUrl = form.querySelector('#websiteUrl')?.value.trim() || '';
    if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = 'https://' + websiteUrl;
    }

    const businessType = form.querySelector('#businessType')?.value || '';
    const yearsExperience = form.querySelector('#yearsExperience')?.value || '';

    const specialtiesArr = [];
    if (businessType) specialtiesArr.push(businessType);
    if (yearsExperience) specialtiesArr.push(yearsExperience);

    const formData = {
      email: email,
      password: password,
      fullName: form.querySelector('#fullName').value.trim(),
      phone: form.querySelector('#phone')?.value.trim() || null,
      userType: 'divecenter',
      centerName: form.querySelector('#centerName').value.trim(),
      centerDescription: form.querySelector('#centerDescription')?.value.trim() || null,
      location: diveCenterBase,
      diveCenterBase: diveCenterBase,
      services: services,
      diveSites: divingLocations,
      otherCertifications: certifications,
      specialties: specialtiesArr,
      yearsInBusiness: null,
      websiteUrl: websiteUrl || null,
      whatsapp: form.querySelector('#whatsapp')?.value.trim() || form.querySelector('#phone')?.value.trim() || null,
      facebook: form.querySelector('#facebook')?.value.trim() || null,
      instagram: form.querySelector('#instagram')?.value.trim() || null,
      logoUrl: logoUrl,
      languagesSpoken: languagesSpoken,
      termsAgreement: termsAgreement?.checked || false,
      accuracyConfirmation: accuracyConfirmation?.checked || false,
      verificationConsent: verificationConsent?.checked || false
    };

    if (isEgyptBased) {
      formData.licenseAuthority = form.querySelector('#licenseAuthority')?.value || null;
      formData.licenseNumber = form.querySelector('#licenseNumber')?.value.trim() || null;
      formData.licenseIssueDate = form.querySelector('#licenseIssueDate')?.value || null;
      formData.licenseExpiryDate = form.querySelector('#licenseExpiryDate')?.value || null;
      formData.licenseFrontUrl = form.querySelector('#licenseFrontUrl')?.value || null;
      formData.licenseBackUrl = form.querySelector('#licenseBackUrl')?.value || null;
    }

    if (isInternational) {
      formData.countryOfRegistration = form.querySelector('#countryOfRegistration')?.value.trim() || null;
      let foreignWebsite = form.querySelector('#foreignWebsiteUrl')?.value.trim() || '';
      if (foreignWebsite && !foreignWebsite.startsWith('http://') && !foreignWebsite.startsWith('https://')) {
        foreignWebsite = 'https://' + foreignWebsite;
      }
      formData.foreignWebsiteUrl = foreignWebsite || null;
      formData.foreignRegistrationId = form.querySelector('#foreignRegistrationId')?.value.trim() || null;
      formData.internationalOperationsConfirmation = form.querySelector('#internationalOperationsConfirmation')?.checked || false;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        if (window.MetaPixelEvents) {
          window.MetaPixelEvents.trackCompleteRegistration('dive_center');
        }
        if (successMessage) {
          successMessage.innerHTML = `<strong>Registration submitted successfully!</strong><br><br>
We've sent a verification link to <strong id="user-email-display"></strong>. Please click the link to verify your account.<br><br>
After verification:
- You'll be able to login
- Your profile will be pending admin approval
- Once approved, you can access your dive center dashboard<br><br>
<em>Check your email now!</em>`;
          const emailDisplay = successMessage.querySelector('#user-email-display');
          if (emailDisplay) {
            emailDisplay.textContent = email;
          }
          successMessage.style.display = 'block';
        }
        form.reset();
        
        setTimeout(() => {
          window.location.href = '/divecenter-login.html';
        }, 4000);
      } else {
        if (errorMessage) {
          const msg = data.message || 'Registration failed. Please try again.';
          if (msg.includes('already registered') || data.code === 'EMAIL_EXISTS') {
            errorMessage.innerHTML = `This email is already registered. Please <a href="/divecenter-login.html" style="color: #3da9fc; text-decoration: underline;">log in here</a> or <a href="/forgot-password.html" style="color: #3da9fc; text-decoration: underline;">reset your password</a>.`;
          } else {
            errorMessage.textContent = msg;
          }
          errorMessage.style.display = 'block';
          errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Registration';
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (errorMessage) {
        let errorText = 'An error occurred. Please try again.';
        if (error.message && error.message.includes('Failed to fetch') || error.name === 'TypeError') {
          errorText = 'Signup couldn\'t be completed because your browser or network security is blocking the connection. Please disable ad-blockers or privacy extensions, or try another browser, then submit again.';
        } else if (error.message && error.message.includes('network')) {
          errorText = 'Network error: Please check your connection and try again.';
        }
        errorMessage.textContent = errorText;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Registration';
    }
  }, { once: false });

  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  console.log('Dive center signup form initialized');
});
