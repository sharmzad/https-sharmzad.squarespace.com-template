document.addEventListener('DOMContentLoaded', async function() {
  const expertType = getExpertType();
  let currentProfile = null;
  let currentUser = null;
  let allTrips = [];
  let filteredStatus = 'all';

  // First check if there's a token at all
  if (!apiClient.isLoggedIn()) {
    window.location.href = `/${expertType}-login.html`;
    return;
  }

  try {
    // Validate token by fetching user data - this will throw if token is invalid
    const userData = await apiClient.getCurrentUser();
    
    // If no user data returned, token is invalid
    if (!userData || !userData.user) {
      apiClient.removeAuthToken();
      window.location.href = `/${expertType}-login.html`;
      return;
    }

    currentUser = userData.user;
    currentProfile = userData.expertProfile;

    if (!currentProfile) {
      alert('No expert profile found. Please contact support.');
      apiClient.logout();
      window.location.href = '/index.html';
      return;
    }

    if (currentProfile.expertType !== expertType) {
      alert(`This dashboard is for ${expertType}s only.`);
      window.location.href = `/${currentProfile.expertType}-dashboard.html`;
      return;
    }

    loadProfileData();
    loadApplications();
    loadTrips();
    setupEventListeners();

  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Failed to load your profile. Please try logging in again.');
    apiClient.logout();
    window.location.href = `/${expertType}-login.html`;
  }

  function getExpertType() {
    const title = document.title.toLowerCase();
    if (title.includes('guide')) return 'guide';
    if (title.includes('diver')) return 'diver';
    if (title.includes('mentor')) return 'mentor';
    return 'guide';
  }

  function loadProfileData() {
    const baseUrl = window.location.origin;
    const profileUrl = `${baseUrl}/${expertType}/${currentProfile.slug}`;
    document.getElementById('profile-url').value = profileUrl;

    // Display profile data
    document.getElementById('view-name').textContent = currentProfile.displayName || currentUser.fullName || 'Not provided';
    document.getElementById('view-email').textContent = currentUser.email;
    document.getElementById('view-location').textContent = currentProfile.location || 'Not specified';
    
    // Handle array fields - convert to comma-separated string
    const languagesText = Array.isArray(currentProfile.languages) ? currentProfile.languages.join(', ') : (currentProfile.languages || 'Not specified');
    document.getElementById('view-languages').textContent = languagesText;
    
    const specialtiesText = Array.isArray(currentProfile.specialties) ? currentProfile.specialties.join(', ') : (currentProfile.specialties || 'Not specified');
    document.getElementById('view-specialties').textContent = specialtiesText;
    
    document.getElementById('view-experience').textContent = currentProfile.experienceYears || currentProfile.experience || '0';
    document.getElementById('view-bio').textContent = currentProfile.bio || 'No bio provided yet.';
    
    const certificationsText = Array.isArray(currentProfile.certifications) ? currentProfile.certifications.join(', ') : (currentProfile.certifications || 'Not provided');
    document.getElementById('view-certifications').textContent = certificationsText;

    if (currentProfile.profilePhoto) {
      const photoEl = document.getElementById('view-photo');
      if (photoEl) photoEl.src = currentProfile.profilePhoto;
    }

    if (currentProfile.coverPhoto) {
      const coverEl = document.getElementById('view-cover');
      if (coverEl) coverEl.src = currentProfile.coverPhoto;
    }

    // Populate edit form - basic fields
    document.getElementById('edit-name').value = currentProfile.displayName || currentUser.fullName || '';
    document.getElementById('edit-email').value = currentUser.email;
    
    // Phone field
    const phoneInput = document.getElementById('edit-phone');
    if (phoneInput) phoneInput.value = currentProfile.whatsapp || currentUser.phone || '';
    
    // Bio
    const bioInput = document.getElementById('edit-bio');
    if (bioInput) bioInput.value = currentProfile.bio || '';
    
    // Photo URLs
    const photoInput = document.getElementById('edit-photo');
    if (photoInput) photoInput.value = currentProfile.profilePhoto || currentProfile.profile_photo || '';
    
    const coverInput = document.getElementById('edit-cover-photo');
    if (coverInput) coverInput.value = currentProfile.coverPhoto || currentProfile.cover_photo || '';

    // Mentor-specific fields (for mentor dashboard)
    if (expertType === 'mentor') {
      // Country of Residence
      const countrySelect = document.getElementById('edit-country');
      if (countrySelect && currentProfile.country) {
        countrySelect.value = currentProfile.country;
      }
      
      // Based In (Egypt/Outside Egypt)
      const basedInSelect = document.getElementById('edit-based-in');
      if (basedInSelect && currentProfile.basedIn) {
        basedInSelect.value = currentProfile.basedIn;
      }
      
      // Experience (select dropdown for mentors)
      const experienceSelect = document.getElementById('edit-experience');
      if (experienceSelect) {
        const expValue = currentProfile.experience || currentProfile.experienceYears || '';
        if (experienceSelect.tagName === 'SELECT') {
          experienceSelect.value = expValue;
        } else {
          experienceSelect.value = expValue;
        }
      }
      
      // Languages (checkboxes)
      const languagesArray = parseArrayField(currentProfile.languages);
      document.querySelectorAll('input[name="languages"]').forEach(checkbox => {
        checkbox.checked = languagesArray.includes(checkbox.value);
      });
      
      // Specialties (checkboxes)
      const specialtiesArray = parseArrayField(currentProfile.specialties);
      document.querySelectorAll('input[name="specialties"]').forEach(checkbox => {
        checkbox.checked = specialtiesArray.includes(checkbox.value);
      });
      
      // Destinations (checkboxes)
      const destinationsArray = parseArrayField(currentProfile.destinations);
      document.querySelectorAll('input[name="destinations"]').forEach(checkbox => {
        checkbox.checked = destinationsArray.includes(checkbox.value);
      });
    } else {
      // Non-mentor experts use simple text inputs
      const locationInput = document.getElementById('edit-location');
      if (locationInput) locationInput.value = currentProfile.location || '';
      
      const languagesInput = document.getElementById('edit-languages');
      if (languagesInput) {
        const languagesValue = Array.isArray(currentProfile.languages) ? currentProfile.languages.join(', ') : (currentProfile.languages || '');
        languagesInput.value = languagesValue;
      }
      
      const specialtiesInput = document.getElementById('edit-specialties');
      if (specialtiesInput) {
        const specialtiesValue = Array.isArray(currentProfile.specialties) ? currentProfile.specialties.join(', ') : (currentProfile.specialties || '');
        specialtiesInput.value = specialtiesValue;
      }
      
      const experienceInput = document.getElementById('edit-experience');
      if (experienceInput) experienceInput.value = currentProfile.experienceYears || 0;
      
      const certificationsInput = document.getElementById('edit-certifications');
      if (certificationsInput) {
        const certificationsValue = Array.isArray(currentProfile.certifications) ? currentProfile.certifications.join(', ') : (currentProfile.certifications || '');
        certificationsInput.value = certificationsValue;
      }
    }

    document.getElementById('profile-status').textContent = currentProfile.isVerified ? 'Verified' : 'Pending Verification';
  }
  
  // Helper function to parse array fields from various formats
  function parseArrayField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadApplications() {
    try {
      const response = await fetch('/api/applications/my-applications', {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load applications');
      }

      const data = await response.json();
      const applications = data.applications || data || [];
      const container = document.getElementById('applications-list');

      if (!Array.isArray(applications) || applications.length === 0) {
        container.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #666;">
            <p>No job applications yet.</p>
            <a href="/jobs-marketplace.html" class="btn primary" style="margin-top: 12px; display: inline-block;">Browse Available Jobs</a>
          </div>
        `;
        return;
      }

      container.innerHTML = applications.map(app => {
        const statusColors = {
          applied: '#ffc107',
          viewed: '#17a2b8',
          contacted: '#0066cc',
          hired: '#27ae60',
          rejected: '#ff4d4d'
        };
        const statusColor = statusColors[app.status] || '#666';
        
        return `
          <div style="border-left: 4px solid ${statusColor}; padding: 16px; margin-bottom: 16px; background: #f8f9fa; border-radius: 6px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">${escapeHtml(app.job?.title || 'Job Position')}</h4>
            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
              <span style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600; margin-right: 8px;">
                ${escapeHtml(app.status.toUpperCase())}
              </span>
              <span>📍 ${escapeHtml(app.job?.location || 'Location N/A')}</span>
              <span style="margin-left: 12px;">💰 ${app.job?.salaryMin && app.job?.salaryMax ? `$${escapeHtml(app.job.salaryMin)} - $${escapeHtml(app.job.salaryMax)}` : 'Salary not specified'}</span>
            </div>
            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
              ${app.job?.company?.slug ? `
                <span>${app.job.posterType === 'divecenter' ? '🤿' : '🏢'} 
                  <a href="/${escapeHtml(app.job.posterType === 'divecenter' ? 'divecenter' : 'agency')}/${escapeHtml(app.job.company.slug)}" 
                     target="_blank" 
                     style="color: #3da9fc; text-decoration: none; font-weight: 600; border-bottom: 1px solid #3da9fc;">
                     ${escapeHtml(app.job.company.name)} 🔗
                  </a>
                </span>
              ` : `<span>${app.job?.posterType === 'divecenter' ? '🤿' : '🏢'} ${escapeHtml(app.job?.company?.name || 'Company Name N/A')}</span>`}
              <span style="margin-left: 12px;">📅 Applied: ${new Date(app.createdAt || app.created_at).toLocaleDateString()}</span>
            </div>
            ${app.coverMessage || app.cover_message ? `
              <div style="margin-top: 8px; font-size: 13px; color: #555; font-style: italic;">
                "${escapeHtml((app.coverMessage || app.cover_message).substring(0, 100))}${(app.coverMessage || app.cover_message).length > 100 ? '...' : ''}"
              </div>
            ` : ''}
            ${app.status === 'hired' ? `
              <div style="margin-top: 12px; padding: 10px; background: #d4edda; border-radius: 4px; color: #155724;">
                🎉 <strong>Congratulations!</strong> You've been hired for this position! ${escapeHtml(app.job?.company?.name || 'The employer')} will contact you soon.
              </div>
            ` : ''}
            ${app.status === 'rejected' ? `
              <div style="margin-top: 12px; padding: 10px; background: #f8d7da; border-radius: 4px; color: #721c24;">
                Unfortunately, your application was not selected for this position.
              </div>
            ` : ''}
            ${app.status === 'contacted' ? `
              <div style="margin-top: 12px; padding: 10px; background: #d1ecf1; border-radius: 4px; color: #0c5460;">
                ✉️ ${escapeHtml(app.job?.company?.name || 'The employer')} has contacted you regarding this application. Check your email/phone!
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading applications:', error);
      document.getElementById('applications-list').innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc3545;">
          <p>Error loading applications. Please try again later.</p>
        </div>
      `;
    }
  }

  async function loadTrips() {
    try {
      const response = await fetch('/api/expert-trips/my-trips', {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`
        }
      });

      if (!response.ok) throw new Error('Failed to load trips');
      
      const data = await response.json();
      allTrips = data.trips || [];
      updateTripStats();
      displayTrips(allTrips);
    } catch (error) {
      console.error('Error loading trips:', error);
      if (document.getElementById('loadingSpinner')) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
      }
    }
  }

  function updateTripStats() {
    if (!document.getElementById('draftCount')) return;
    
    const draftCount = allTrips.filter(t => t.status === 'draft').length;
    const publishedCount = allTrips.filter(t => t.status === 'published').length;
    const totalBookings = allTrips.reduce((sum, t) => sum + (t.total_bookings || t.bookings || 0), 0);
    const earnings = allTrips.reduce((sum, t) => sum + (parseFloat(t.price || 0) * (t.total_bookings || 0) * 0.8), 0);

    document.getElementById('draftCount').textContent = draftCount;
    document.getElementById('publishedCount').textContent = publishedCount;
    document.getElementById('bookingCount').textContent = totalBookings;
    document.getElementById('earningsAmount').textContent = '$' + earnings.toFixed(2);
  }

  function displayTrips(trips) {
    if (!document.getElementById('loadingSpinner')) return;
    
    const spinner = document.getElementById('loadingSpinner');
    const container = document.getElementById('tripsContainer');
    const empty = document.getElementById('emptyState');
    const tbody = document.getElementById('tripsTableBody');

    spinner.style.display = 'none';

    if (trips.length === 0) {
      container.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    empty.style.display = 'none';

    tbody.innerHTML = trips.map(trip => {
      const safeId = parseInt(trip.id, 10) || 0;
      return `
      <tr>
        <td><strong>${escapeHtml(trip.title)}</strong></td>
        <td>$${parseFloat(trip.price).toFixed(2)}</td>
        <td><span class="status-badge status-${escapeHtml(trip.status)}">${escapeHtml(trip.status.replace(/_/g, ' ').toUpperCase())}</span></td>
        <td>${parseInt(trip.total_bookings || trip.bookings || 0, 10)}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary" onclick="window.viewTripDetails(${safeId})">View</button>
            ${trip.status === 'draft' ? `<button class="btn btn-primary" onclick="window.editTrip(${safeId})">Edit</button>` : ''}
            ${trip.status === 'draft' ? `<button class="btn btn-warning" onclick="window.submitTrip(${safeId})">Submit</button>` : ''}
            ${trip.status === 'approved' ? `<button class="btn btn-success" onclick="window.publishTrip(${safeId})">Publish</button>` : ''}
          </div>
        </td>
      </tr>
    `;
    }).join('');
  }

  window.filterByStatus = function(status) {
    filteredStatus = status;
    const filtered = status === 'all' ? allTrips : allTrips.filter(t => t.status === status);
    displayTrips(filtered);

    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
  };

  window.openCreateTrip = function() {
    const modal = document.getElementById('createTripModal');
    if (modal) modal.classList.add('active');
  };

  window.closeCreateTrip = function() {
    const modal = document.getElementById('createTripModal');
    if (modal) {
      modal.classList.remove('active');
      const form = modal.querySelector('form');
      if (form) form.reset();
    }
  };

  window.handleCreateTrip = async function(e) {
    e.preventDefault();

    const tripData = {
      title: document.getElementById('tripTitle')?.value,
      description: document.getElementById('tripDescription')?.value,
      tripType: document.getElementById('tripType')?.value,
      price: parseFloat(document.getElementById('tripPrice')?.value),
      location: document.getElementById('tripLocation')?.value,
      duration: document.getElementById('tripDuration')?.value,
      maxGroupSize: parseInt(document.getElementById('tripMaxGroup')?.value) || null,
      startDate: document.getElementById('tripStartDate')?.value,
      endDate: document.getElementById('tripEndDate')?.value,
      image: document.getElementById('tripImage')?.value,
      includedServices: document.getElementById('tripIncluded')?.value.split(',').map(s => s.trim()).filter(Boolean) || [],
      requirements: document.getElementById('tripRequirements')?.value.split(',').map(s => s.trim()).filter(Boolean) || [],
    };

    try {
      const response = await fetch('/api/expert-trips/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tripData)
      });

      if (!response.ok) throw new Error('Failed to create offer');
      
      alert('✅ Offer created successfully as draft!');
      window.closeCreateTrip();
      loadTrips();
    } catch (error) {
      console.error('Error creating offer:', error);
      alert('Failed to create offer: ' + error.message);
    }
  };

  window.submitTrip = async function(tripId) {
    if (!confirm('Submit this offer for admin approval?')) return;

    try {
      const response = await fetch(`/api/expert-trips/${tripId}/submit-approval`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiClient.getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to submit');
      alert('✅ Offer submitted for admin approval!');
      loadTrips();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to submit offer: ' + error.message);
    }
  };

  window.publishTrip = async function(tripId) {
    if (!confirm('Publish this offer to the marketplace?')) return;

    try {
      const response = await fetch(`/api/expert-trips/${tripId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiClient.getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to publish');
      alert('✅ Offer is now live on the marketplace!');
      loadTrips();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to publish offer: ' + error.message);
    }
  };

  window.viewTripDetails = function(tripId) {
    const trip = allTrips.find(t => t.id === tripId);
    if (!trip) return;

    const content = document.getElementById('tripDetailsContent');
    if (!content) return;
    
    content.textContent = '';
    
    const createField = (label, value) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(value));
      return p;
    };
    
    content.appendChild(createField('Title', trip.title));
    
    const statusP = document.createElement('p');
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = 'Status: ';
    statusP.appendChild(statusStrong);
    const statusSpan = document.createElement('span');
    statusSpan.className = 'status-badge status-' + (trip.status || '').replace(/[^a-zA-Z0-9_-]/g, '');
    statusSpan.textContent = (trip.status || '').replace(/_/g, ' ').toUpperCase();
    statusP.appendChild(statusSpan);
    content.appendChild(statusP);
    
    content.appendChild(createField('Planning Fee', '$' + parseFloat(trip.price).toFixed(2)));
    content.appendChild(createField('Location', trip.location));
    content.appendChild(createField('Duration', trip.duration || 'N/A'));
    content.appendChild(createField('Type', trip.trip_type || trip.tripType || 'N/A'));
    
    const descP = document.createElement('p');
    const descStrong = document.createElement('strong');
    descStrong.textContent = 'Description:';
    descP.appendChild(descStrong);
    descP.appendChild(document.createElement('br'));
    descP.appendChild(document.createTextNode(trip.description));
    content.appendChild(descP);
    
    if (trip.highlights) {
      const highlightsP = document.createElement('p');
      const highlightsStrong = document.createElement('strong');
      highlightsStrong.textContent = 'Highlights:';
      highlightsP.appendChild(highlightsStrong);
      highlightsP.appendChild(document.createElement('br'));
      const highlightsText = typeof trip.highlights === 'string' ? trip.highlights : trip.highlights.join(', ');
      highlightsP.appendChild(document.createTextNode(highlightsText));
      content.appendChild(highlightsP);
    }
    
    const modal = document.getElementById('tripDetailsModal');
    if (modal) modal.classList.add('active');
  };

  window.closeTripDetails = function() {
    const modal = document.getElementById('tripDetailsModal');
    if (modal) modal.classList.remove('active');
  };

  window.editTrip = function(tripId) {
    alert('Edit functionality coming soon');
  };

  function setupEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        apiClient.logout();
        window.location.href = '/index.html';
      }
    });

    document.getElementById('copy-url-btn').addEventListener('click', function() {
      const urlInput = document.getElementById('profile-url');
      urlInput.select();
      document.execCommand('copy');
      
      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.style.background = '#27ae60';
      
      setTimeout(function() {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    });

    document.getElementById('edit-profile-btn').addEventListener('click', function() {
      document.getElementById('view-mode').classList.remove('active');
      document.getElementById('edit-mode').classList.add('active');
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', function() {
      document.getElementById('edit-mode').classList.remove('active');
      document.getElementById('view-mode').classList.add('active');
      loadProfileData();
    });

    document.getElementById('edit-profile-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const photoEl = document.getElementById('edit-photo');
      const coverEl = document.getElementById('edit-cover-photo');
      
      // Build updates object based on expert type
      const updates = {
        displayName: formData.get('displayName'),
        phone: formData.get('phone'),
        bio: formData.get('bio'),
        profilePhoto: photoEl ? photoEl.value : null,
        coverPhoto: coverEl ? coverEl.value : null
      };
      
      // Mentor-specific fields use checkboxes
      if (expertType === 'mentor') {
        // Country and Based In (select dropdowns)
        updates.country = formData.get('country') || '';
        updates.basedIn = formData.get('basedIn') || '';
        updates.experience = formData.get('experience') || '';
        
        // Collect checked languages
        const languagesChecked = [];
        document.querySelectorAll('input[name="languages"]:checked').forEach(cb => {
          languagesChecked.push(cb.value);
        });
        updates.languages = languagesChecked;
        
        // Collect checked specialties
        const specialtiesChecked = [];
        document.querySelectorAll('input[name="specialties"]:checked').forEach(cb => {
          specialtiesChecked.push(cb.value);
        });
        updates.specialties = specialtiesChecked;
        
        // Collect checked destinations
        const destinationsChecked = [];
        document.querySelectorAll('input[name="destinations"]:checked').forEach(cb => {
          destinationsChecked.push(cb.value);
        });
        updates.destinations = destinationsChecked;
      } else {
        // Non-mentor experts use text inputs
        updates.location = formData.get('location');
        updates.languages = formData.get('languages');
        updates.specialties = formData.get('specialties');
        updates.experienceYears = parseInt(formData.get('experience')) || 0;
        updates.certifications = formData.get('certifications');
      }

      try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const response = await fetch('/api/experts/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiClient.getToken()}`
          },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error('Failed to update profile');
        }

        const result = await response.json();
        currentProfile = result.profile;

        alert('✓ Profile updated successfully!');
        loadProfileData();
        document.getElementById('edit-mode').classList.remove('active');
        document.getElementById('view-mode').classList.add('active');

      } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile. Please try again.');
      } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Changes';
      }
    });
  }

  console.log(`✅ ${expertType} dashboard loaded for:`, currentProfile.displayName);
});
