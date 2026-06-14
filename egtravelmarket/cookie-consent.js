(function() {
  const COOKIE_CONSENT_KEY = 'egytravel_cookie_consent';
  const CONSENT_EXPIRY_DAYS = 365;

  function getCookieConsent() {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (consent) {
        const data = JSON.parse(consent);
        const expiryDate = new Date(data.expiry);
        if (expiryDate > new Date()) {
          return data.value;
        }
        localStorage.removeItem(COOKIE_CONSENT_KEY);
      }
    } catch (e) {
      console.error('Error reading cookie consent:', e);
    }
    return null;
  }

  function setCookieConsent(value) {
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + CONSENT_EXPIRY_DAYS);
      const data = {
        value: value,
        expiry: expiry.toISOString(),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving cookie consent:', e);
    }
  }

  function createCookieBanner() {
    const banner = document.createElement('div');
    banner.className = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');

    banner.innerHTML = `
      <p class="cookie-consent-text">
        We use cookies to improve your experience. By using this site, you agree to our <a href="privacy.html">Privacy Policy</a>.
      </p>
      <div class="cookie-consent-buttons">
        <button class="cookie-consent-btn cookie-consent-btn-accept" id="cookie-consent-accept">
          Accept
        </button>
        <button class="cookie-consent-btn cookie-consent-btn-reject" id="cookie-consent-reject">
          Reject
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    return banner;
  }

  function showCookieBanner() {
    const banner = document.querySelector('.cookie-consent-banner');
    if (banner) {
      setTimeout(() => {
        banner.classList.add('show');
      }, 500);
    }
  }

  function hideCookieBanner() {
    const banner = document.querySelector('.cookie-consent-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => {
        banner.remove();
      }, 300);
    }
  }

  function handleAccept() {
    setCookieConsent('accepted');
    hideCookieBanner();
  }

  function handleReject() {
    setCookieConsent('rejected');
    hideCookieBanner();
  }

  function initCookieConsent() {
    if (localStorage.getItem('cookiesAccepted')) {
      localStorage.removeItem('cookiesAccepted');
    }
    
    const consent = getCookieConsent();
    
    if (consent === null) {
      const banner = createCookieBanner();
      
      const acceptBtn = banner.querySelector('#cookie-consent-accept');
      const rejectBtn = banner.querySelector('#cookie-consent-reject');
      
      if (acceptBtn) acceptBtn.addEventListener('click', handleAccept);
      if (rejectBtn) rejectBtn.addEventListener('click', handleReject);
      
      showCookieBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }

  window.resetCookieConsent = function() {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    location.reload();
  };
})();
