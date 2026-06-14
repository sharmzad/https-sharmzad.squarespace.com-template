// ============================================================
// GLOBAL API UTILITIES - Retry Logic & Error Handling
// This file provides robust API calls with automatic retries
// to prevent white pages and improve user experience
// ============================================================

const API_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 15000
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(url, options = {}, retries = API_CONFIG.maxRetries) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  
  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  const token = localStorage.getItem('token');
  if (token && !fetchOptions.headers.Authorization) {
    fetchOptions.headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    
    // Don't retry for 401/403/404 - these are intentional responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `Request failed: ${response.status}`);
      error.status = response.status;
      error.skipRetry = [401, 403, 404].includes(response.status);
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Only retry for network/timeout errors, NOT for HTTP status errors (401/403/404)
    const isNetworkError = error.name === 'AbortError' || error.message.includes('Failed to fetch');
    const shouldRetry = retries > 0 && isNetworkError && !error.skipRetry;
    
    if (shouldRetry) {
      console.log(`API retry (${API_CONFIG.maxRetries - retries + 1}/${API_CONFIG.maxRetries}): ${url}`);
      await sleep(API_CONFIG.retryDelay);
      return apiRequest(url, options, retries - 1);
    }
    
    throw error;
  }
}

function showErrorMessage(container, message, showRetry = true) {
  if (!container) return;
  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #ff6b6b;">
      <p style="margin-bottom: 16px;">${message}</p>
      ${showRetry ? '<button onclick="location.reload()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>' : ''}
    </div>
  `;
}

function showLoadingState(container) {
  if (!container) return;
  container.innerHTML = '<div style="padding: 40px; text-align: center;"><p>Loading...</p></div>';
}

window.apiUtils = {
  request: apiRequest,
  showError: showErrorMessage,
  showLoading: showLoadingState,
  config: API_CONFIG
};
