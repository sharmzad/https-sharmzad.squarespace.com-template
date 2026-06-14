// Email Validation Utility
// Simple, effective email validation for booking forms

/**
 * Validates email format using a robust regex pattern
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Comprehensive email regex pattern
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Provides user-friendly error messages for invalid emails
 * @param {string} email - The email address to check
 * @returns {string} - Error message or empty string if valid
 */
function getEmailError(email) {
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  
  const trimmed = email.trim();
  
  if (!trimmed.includes('@')) {
    return 'Email must contain @';
  }
  
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return 'Email format is invalid';
  }
  
  const [localPart, domain] = parts;
  
  if (!localPart || localPart.length === 0) {
    return 'Email must have text before @';
  }
  
  if (!domain || domain.length === 0) {
    return 'Email must have a domain after @';
  }
  
  if (!domain.includes('.')) {
    return 'Email domain must include a period (e.g., gmail.com)';
  }
  
  const domainParts = domain.split('.');
  const extension = domainParts[domainParts.length - 1];
  
  if (extension.length < 2) {
    return 'Email domain extension is too short';
  }
  
  if (!isValidEmail(trimmed)) {
    return 'Email format is invalid';
  }
  
  return ''; // No error - email is valid
}

/**
 * Suggests corrections for common email typos
 * @param {string} email - The email address to check
 * @returns {string|null} - Suggested correction or null
 */
function suggestEmailCorrection(email) {
  if (!email) return null;
  
  const trimmed = email.toLowerCase().trim();
  
  // Common typos mapping
  const commonTypos = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahoo.con': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'outlook.con': 'outlook.com'
  };
  
  // Check if domain has a typo
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return null;
  
  const domain = trimmed.substring(atIndex + 1);
  
  if (commonTypos[domain]) {
    const localPart = trimmed.substring(0, atIndex);
    return localPart + '@' + commonTypos[domain];
  }
  
  return null;
}

/**
 * Adds visual validation feedback to an email input field
 * @param {HTMLInputElement} inputElement - The email input element
 * @param {HTMLElement} messageElement - Element to display validation messages
 */
function setupEmailValidation(inputElement, messageElement) {
  if (!inputElement) return;
  
  // Add type="email" for basic browser validation
  inputElement.setAttribute('type', 'email');
  
  // Validation on blur (when user leaves the field)
  inputElement.addEventListener('blur', function() {
    const email = this.value.trim();
    
    if (!email) {
      // Don't show error if field is empty on blur
      if (messageElement) {
        messageElement.textContent = '';
        messageElement.style.display = 'none';
      }
      inputElement.style.borderColor = '';
      return;
    }
    
    const error = getEmailError(email);
    
    if (error) {
      // Show error
      inputElement.style.borderColor = '#ef4444';
      if (messageElement) {
        messageElement.textContent = '❌ ' + error;
        messageElement.style.color = '#ef4444';
        messageElement.style.display = 'block';
        messageElement.style.fontSize = '0.875rem';
        messageElement.style.marginTop = '4px';
      }
      
      // Check for typo suggestions
      const suggestion = suggestEmailCorrection(email);
      if (suggestion && messageElement) {
        messageElement.textContent = '❌ ' + error + '. Did you mean ' + suggestion + '?';
      }
    } else {
      // Show success
      inputElement.style.borderColor = '#22c55e';
      if (messageElement) {
        messageElement.textContent = '✓ Email looks good';
        messageElement.style.color = '#22c55e';
        messageElement.style.display = 'block';
        messageElement.style.fontSize = '0.875rem';
        messageElement.style.marginTop = '4px';
      }
    }
  });
  
  // Clear validation styling on focus
  inputElement.addEventListener('focus', function() {
    this.style.borderColor = '#0077cc';
    if (messageElement) {
      messageElement.style.display = 'none';
    }
  });
}
