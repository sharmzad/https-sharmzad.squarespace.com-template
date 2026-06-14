const API_BASE_URL = 'https://www.egtravelmarket.com';

// Convert Google Drive URLs to direct image URLs
function convertGoogleDriveUrl(url) {
  if (!url) return null;
  const googleDriveMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (googleDriveMatch) {
    return `https://drive.google.com/uc?export=view&id=${googleDriveMatch[1]}`;
  }
  return url;
}

const apiClient = {
  getAuthToken() {
    return localStorage.getItem('authToken');
  },

  setAuthToken(token) {
    localStorage.setItem('authToken', token);
  },

  removeAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  },

  getCurrentUserFromStorage() {
    const userJson = localStorage.getItem('currentUser');
    return userJson ? JSON.parse(userJson) : null;
  },

  setCurrentUserInStorage(user) {
    const essentialUser = {
      id: user.id,
      name: user.name || user.displayName || '',
      email: user.email,
      role: user.role || user.userType || 'customer',
      token: user.token || this.getAuthToken(),
      expertType: user.expertType || null,
      slug: user.slug || null,
      photoUrl: user.photoUrl || null,
      isVerified: user.isVerified || false,
      isApproved: user.isApproved || false
    };
    localStorage.setItem('currentUser', JSON.stringify(essentialUser));
  },

  async signup(signupData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }
      
      const data = await response.json();
      
      if (data.token) {
        this.setAuthToken(data.token);
        this.setCurrentUserInStorage({ ...data.user, expertProfile: data.expertProfile });
      }
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      console.log('📡 API Request to:', `${API_BASE_URL}/api/auth/login`);
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Login failed:', error);
        throw new Error(error.message || 'Login failed');
      }
      
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (data.token) {
        this.setAuthToken(data.token);
        this.setCurrentUserInStorage({ ...data.user, expertProfile: data.expertProfile });
      }
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      const token = this.getAuthToken();
      
      if (!token) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.removeAuthToken();
          return null;
        }
        throw new Error('Failed to get current user');
      }
      
      const data = await response.json();
      this.setCurrentUserInStorage({ ...data.user, expertProfile: data.expertProfile });
      return data;
    } catch (error) {
      console.error('Get current user error:', error);
      this.removeAuthToken();
      return null;
    }
  },

  async logout() {
    try {
      const token = this.getAuthToken();
      
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.removeAuthToken();
    }
  },

  isLoggedIn() {
    return !!this.getAuthToken();
  },

  async createBooking(bookingData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Booking error:', error);
      throw error;
    }
  },

  async getBookings(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE_URL}/api/bookings?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch bookings error:', error);
      throw error;
    }
  },

  async getBookingById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch booking');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch booking error:', error);
      throw error;
    }
  },

  async getFlashOffers(activeOnly = true) {
    try {
      const params = activeOnly ? '?active=true' : '';
      const response = await fetch(`${API_BASE_URL}/api/flash-offers${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch flash offers');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch flash offers error:', error);
      throw error;
    }
  },

  async createFlashOffer(offerData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/flash-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offerData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create flash offer');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Create flash offer error:', error);
      throw error;
    }
  },

  async updateFlashOffer(id, offerData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/flash-offers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offerData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update flash offer');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Update flash offer error:', error);
      throw error;
    }
  },

  async submitContactForm(contactData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit contact form');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Contact form error:', error);
      throw error;
    }
  },

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      return { status: 'error', message: 'Backend unavailable' };
    }
  }
};

console.log('✅ API Client initialized');
console.log('📡 API Base URL:', API_BASE_URL);
