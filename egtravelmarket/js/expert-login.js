document.addEventListener('DOMContentLoaded', async function() {
  const expertType = document.title.toLowerCase().includes('guide') ? 'guide' 
                   : document.title.toLowerCase().includes('diver') ? 'diver' 
                   : 'mentor';

  // Validate token with the server, not just check if it exists
  if (apiClient.isLoggedIn()) {
    try {
      const user = await apiClient.getCurrentUser();
      if (user && user.user) {
        // Token is valid - redirect to dashboard
        window.location.href = `/${expertType}-dashboard.html`;
        return;
      } else {
        // Token is invalid - clear it
        apiClient.removeAuthToken();
      }
    } catch (error) {
      console.log('Token validation failed, showing login form');
      apiClient.removeAuthToken();
    }
  }

  const form = document.getElementById('login-form');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(form);
    const email = formData.get('email').trim();
    const password = formData.get('password');

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in...';
      submitButton.style.opacity = '0.6';

      console.log('🔐 Attempting login for:', email);
      const result = await apiClient.login(email, password);
      console.log('✅ Login successful:', result);

      submitButton.textContent = '✓ Success!';
      submitButton.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';

      const userType = result.user.userType;
      console.log('👤 User type:', userType);
      
      // Redirect to appropriate dashboard based on user type
      if (userType === 'guide' || userType === 'diver' || userType === 'mentor' || userType === 'agency' || userType === 'divecenter') {
        console.log('🚀 Redirecting to dashboard:', userType);
        window.location.href = `/${userType}-dashboard.html`;
      } else {
        console.log('❌ Unknown user type:', userType);
        window.location.href = '/index.html';
      }

    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Login failed. ';
      if (error.message.includes('Invalid email or password')) {
        errorMessage += 'Invalid email or password. Please try again.';
      } else if (error.message.includes('Account is deactivated')) {
        errorMessage += 'Your account has been deactivated. Please contact support.';
      } else {
        errorMessage += error.message || 'Please check your credentials and try again.';
      }

      alert(errorMessage);
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      submitButton.style.opacity = '1';
      submitButton.style.background = '';
    }
  });

  const emailInput = form.querySelector('input[type="email"]');
  const passwordInput = form.querySelector('input[type="password"]');

  [emailInput, passwordInput].forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        form.dispatchEvent(new Event('submit'));
      }
    });
  });

  console.log(`✅ Expert login form initialized for: ${expertType}`);
});
