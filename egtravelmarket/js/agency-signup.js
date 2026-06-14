document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('agency-signup-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');

  // Override form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';

    const password = form.querySelector('#password').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;

    if (password !== confirmPassword) {
      if (errorMessage) {
        errorMessage.textContent = 'Passwords do not match';
        errorMessage.style.display = 'block';
      }
      return;
    }

    const services = [];
    form.querySelectorAll('input[id^="service-"]:checked').forEach(checkbox => {
      services.push(checkbox.value);
    });

    const operatingAreas = [];
    form.querySelectorAll('input[id^="area-"]:checked').forEach(checkbox => {
      operatingAreas.push(checkbox.value);
    });

    // Get photo URL from input field
    const logoUrl = form.querySelector('#photoUrl')?.value.trim() || null;

    const email = form.querySelector('#email').value.trim();
    // Normalize website URL
    let websiteUrl = form.querySelector('#websiteUrl').value.trim();
    if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = 'https://' + websiteUrl;
    }
    const formData = {
      email: email,
      password: password,
      fullName: form.querySelector('#fullName').value.trim(),
      phone: form.querySelector('#phone').value.trim() || null,
      userType: 'agency',
      companyName: form.querySelector('#companyName').value.trim(),
      companyDescription: form.querySelector('#companyDescription').value.trim() || null,
      location: form.querySelector('#location').value.trim() || null,
      services: services,
      operatingAreas: operatingAreas,
      licenseNumber: form.querySelector('#licenseNumber').value.trim() || null,
      yearsInBusiness: form.querySelector('#yearsInBusiness').value ? parseInt(form.querySelector('#yearsInBusiness').value) : null,
      websiteUrl: websiteUrl || null,
      whatsapp: form.querySelector('#phone').value.trim() || null,
      facebook: form.querySelector('#facebook').value.trim() || null,
      instagram: form.querySelector('#instagram').value.trim() || null,
      logoUrl: logoUrl
    };

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
        if (successMessage) {
          // Create safe DOM structure to prevent XSS
          successMessage.innerHTML = `✅ <strong>Registration submitted successfully!</strong><br><br>
📧 <strong>VERIFY YOUR EMAIL</strong><br>
We've sent a verification link to <strong id="email-display"></strong>. Please click the link to verify your account.<br><br>
After verification:
- You'll be able to login
- Your profile will be pending admin approval
- Once approved, you can access your agency dashboard<br><br>
<em>Check your email now!</em>`;
          // Safely inject email using textContent to prevent XSS
          const emailDisplay = successMessage.querySelector('#email-display');
          if (emailDisplay) {
            emailDisplay.textContent = email;
          }
          successMessage.style.display = 'block';
        }
        form.reset();
        
        setTimeout(() => {
          window.location.href = '/agency-login.html';
        }, 4000);
      } else {
        if (errorMessage) {
          errorMessage.textContent = data.message || 'Registration failed. Please try again.';
          errorMessage.style.display = 'block';
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
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Registration';
    }
  }, { once: false });

  console.log('✅ Agency signup form initialized');
});
