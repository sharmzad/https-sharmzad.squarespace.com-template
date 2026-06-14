document.addEventListener('DOMContentLoaded', async function() {
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const expertType = pathParts[0];
  const slug = pathParts[1];

  if (!expertType || !slug) {
    showError();
    return;
  }

  try {
    const response = await fetch(`/api/experts/profile/${slug}`);
    
    if (!response.ok) {
      throw new Error('Profile not found');
    }

    const data = await response.json();
    const profile = data.profile;

    document.getElementById('page-title').textContent = `${profile.displayName} - ${capitalize(profile.expertType)} | Eg Travel Market`;
    document.getElementById('page-description').setAttribute('content', `${profile.displayName} - ${profile.expertType} in ${profile.location || 'Egypt'}. ${profile.bio || ''}`);

    if (profile.photoUrl || profile.profilePhoto) {
      document.getElementById('hero-photo').src = profile.photoUrl || profile.profilePhoto;
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        ogImage.setAttribute('content', profile.photoUrl || profile.profilePhoto);
      }
    }
    
    const coverPhotoUrl = profile.coverPhoto || profile.cover_photo;
    if (coverPhotoUrl) {
      const heroSection = document.querySelector('#profile-content .profile-hero');
      if (heroSection) {
        heroSection.style.backgroundImage = `url('${coverPhotoUrl}')`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
        heroSection.style.backgroundRepeat = 'no-repeat';
        heroSection.classList.add('has-cover');
      }
    }

    document.getElementById('hero-name').textContent = profile.displayName;
    
    // For mentors, show basedIn + country; for divers show primaryLocation, for others show location
    if (profile.expertType === 'mentor') {
      let locationText = '';
      if (profile.basedIn) {
        locationText = profile.basedIn === 'Egypt' ? 'Based in Egypt' : 'Based Abroad';
      }
      if (profile.country) {
        locationText += locationText ? ` (${profile.country})` : profile.country;
      }
      document.getElementById('hero-location').textContent = locationText || profile.location || 'Egypt';
    } else if (profile.expertType === 'diver') {
      // For divers: prefer primaryLocation (structured), fallback to location (legacy)
      document.getElementById('hero-location').textContent = profile.primaryLocation || profile.location || 'Egypt';
    } else {
      document.getElementById('hero-location').textContent = profile.location || 'Egypt';
    }

    const badgesContainer = document.getElementById('hero-badges');
    badgesContainer.innerHTML = '';
    if (profile.isCertified) {
      const certifiedBadge = document.createElement('span');
      certifiedBadge.className = 'profile-certified-badge';
      certifiedBadge.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Certified by ETM';
      badgesContainer.appendChild(certifiedBadge);
    }
    if (profile.isVerified) {
      const verifiedBadge = document.createElement('span');
      verifiedBadge.className = 'badge verified';
      verifiedBadge.textContent = '✓ Verified';
      badgesContainer.appendChild(verifiedBadge);
    }
    if (profile.isFeatured) {
      const featuredBadge = document.createElement('span');
      featuredBadge.className = 'badge featured';
      featuredBadge.textContent = '★ Featured';
      badgesContainer.appendChild(featuredBadge);
    }

    const rating = parseFloat(profile.rating) || 0;
    const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
    
    const heroRating = document.getElementById('hero-rating');
    heroRating.innerHTML = '';
    
    const starsSpan = document.createElement('span');
    starsSpan.className = 'rating-stars';
    starsSpan.textContent = stars;
    heroRating.appendChild(starsSpan);
    
    const ratingText = document.createElement('span');
    ratingText.style.marginLeft = '10px';
    ratingText.style.opacity = '0.9';
    ratingText.textContent = `${rating.toFixed(1)} (${profile.totalReviews} reviews)`;
    heroRating.appendChild(ratingText);

    document.getElementById('stat-experience').textContent = profile.experience || 0;
    document.getElementById('stat-bookings').textContent = profile.totalBookings || 0;
    document.getElementById('stat-rating').textContent = rating.toFixed(1);
    document.getElementById('stat-views').textContent = profile.viewCount || 0;

    const bookingsEl = document.getElementById('stat-bookings');
    const ratingEl = document.getElementById('stat-rating');
    const bookingsItem = document.getElementById('stat-bookings-item');
    const ratingItem = document.getElementById('stat-rating-item');
    
    if ((profile.totalBookings || 0) === 0 && bookingsEl) {
      bookingsEl.style.color = '#64748b';
      if (bookingsItem) bookingsItem.title = 'New guide - building their profile';
    }
    if (rating === 0 && ratingEl) {
      ratingEl.style.color = '#64748b';
      if (ratingItem) ratingItem.title = 'No reviews yet';
    }

    // Bio fallback: bio > about > default text
    const bioText = profile.bio || profile.about || 'No bio provided yet.';
    const bioEl = document.getElementById('profile-bio');
    const bioReadMoreBtn = document.getElementById('bio-read-more');
    const MAX_BIO_CHARS = 400;
    
    if (bioText.length > MAX_BIO_CHARS && bioEl && bioReadMoreBtn) {
      let isExpanded = false;
      const truncatedBio = bioText.substring(0, MAX_BIO_CHARS) + '...';
      bioEl.textContent = truncatedBio;
      bioReadMoreBtn.style.display = 'inline-block';
      
      bioReadMoreBtn.addEventListener('click', function() {
        if (isExpanded) {
          bioEl.textContent = truncatedBio;
          bioReadMoreBtn.textContent = 'Read more';
        } else {
          bioEl.textContent = bioText;
          bioReadMoreBtn.textContent = 'Read less';
        }
        isExpanded = !isExpanded;
      });
    } else if (bioEl) {
      bioEl.textContent = bioText;
    }

    if (profile.expertType !== 'mentor') {
      const ctaBtn = document.getElementById('request-itinerary-btn');
      const emptyTripsCta = document.getElementById('empty-trips-cta');
      
      if (ctaBtn) {
        ctaBtn.style.display = 'inline-block';
        // Update CTA button text based on expert type
        if (profile.expertType === 'diver') {
          ctaBtn.textContent = 'Request a Diving Experience';
        } else {
          ctaBtn.textContent = 'Request Custom Itinerary';
        }
        ctaBtn.addEventListener('click', function() { openRequestModal(profile); });
      }
      if (emptyTripsCta) {
        emptyTripsCta.addEventListener('click', function() { openRequestModal(profile); });
      }
    }
    document.getElementById("profile-languages").textContent = Array.isArray(profile.languages) ? profile.languages.join(", ") : (typeof profile.languages === "string" ? profile.languages : "Not specified") || 'Not specified';
    
    if (profile.expertType === 'mentor') {
      document.getElementById('cert-title').textContent = 'Expertise Areas';
    }
    
    const certifications = profile.certifications || [];
    let certsArray = [];
    if (Array.isArray(certifications)) {
      certsArray = certifications.filter(c => c);
    } else if (typeof certifications === 'string' && certifications.trim()) {
      try {
        certsArray = JSON.parse(certifications).filter(c => c);
      } catch (e) {
        certsArray = certifications.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    const certText = certsArray.length > 0 ? certsArray.join(", ") : 'Not provided';
    document.getElementById("profile-certifications").textContent = certText;

    // For divers: prefer diveSpecialties, fallback to specialties
    const specialties = (profile.expertType === 'diver' && Array.isArray(profile.diveSpecialties) && profile.diveSpecialties.length > 0)
      ? profile.diveSpecialties
      : (profile.specialties || []);
    let specialtiesArray = [];
    if (Array.isArray(specialties)) {
      specialtiesArray = specialties.filter(s => s);
    } else if (typeof specialties === 'string' && specialties.trim()) {
      try {
        specialtiesArray = JSON.parse(specialties).filter(s => s);
      } catch (e) {
        specialtiesArray = specialties.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    if (specialtiesArray.length > 0) {
      const section = document.getElementById('specialties-section');
      const specialtiesContainer = document.getElementById('profile-specialties');
      
      if (section) {
        section.style.display = 'block';
      }
      
      if (specialtiesContainer) {
        specialtiesContainer.innerHTML = '';
        specialtiesArray.forEach(s => {
          if (s) {
            const badge = document.createElement('span');
            badge.style.cssText = 'position:static; display:inline-block; background:#e3f2fd; color:#1976d2; margin:5px; padding:8px 16px; border-radius:20px; font-size:14px;';
            badge.textContent = s;
            specialtiesContainer.appendChild(badge);
          }
        });
      }
    }

    // Display destinations (backend already returns arrays)
    const destinationsArray = Array.isArray(profile.destinations) ? profile.destinations.filter(d => d) : [];
    
    if (destinationsArray.length > 0) {
      const destSection = document.getElementById('destinations-section');
      const destContainer = document.getElementById('profile-destinations');
      
      if (destSection) {
        destSection.style.display = 'block';
      }
      
      if (destContainer) {
        destContainer.innerHTML = '';
        destinationsArray.forEach(d => {
          if (d) {
            const badge = document.createElement('span');
            badge.style.cssText = 'position:static; display:inline-block; background:#fff3e0; color:#e65100; margin:5px; padding:8px 16px; border-radius:20px; font-size:14px;';
            badge.textContent = d;
            destContainer.appendChild(badge);
          }
        });
      }
    }

    // Hide contact details for mentors (private info) - must do BEFORE populating fields
    const isMentor = profile.expertType === 'mentor';
    const contactEmailEl = document.getElementById('contact-email');
    const contactPhoneEl = document.getElementById('contact-phone');
    const whatsappBtn = document.getElementById('whatsapp-btn');
    const emailBtn = document.getElementById('email-btn');
    const socialLinksEl = document.getElementById('social-links');
    
    if (isMentor) {
      // Hide private contact details for mentors
      if (contactEmailEl) {
        const emailP = contactEmailEl.closest('p');
        if (emailP) emailP.style.display = 'none';
      }
      if (contactPhoneEl) {
        const phoneP = contactPhoneEl.closest('p');
        if (phoneP) phoneP.style.display = 'none';
      }
      
      // Hide WhatsApp, email buttons, and social links
      if (whatsappBtn) whatsappBtn.style.display = 'none';
      if (emailBtn) emailBtn.style.display = 'none';
      if (socialLinksEl) socialLinksEl.style.display = 'none';
      
      // Hide the contact section entirely for mentors - find it by traversing from known element
      if (emailBtn) {
        const contactCard = emailBtn.closest('.profile-card');
        if (contactCard) contactCard.style.display = 'none';
      }
    } else {
      // Non-mentor: show contact info only if provided
      if (profile.email && contactEmailEl) {
        contactEmailEl.textContent = profile.email;
        if (emailBtn) {
          emailBtn.href = `mailto:${profile.email}?subject=Inquiry from EgyTravelMarket`;
          emailBtn.style.display = 'inline-flex';
        }
      } else {
        // Hide email row and button if no email
        if (contactEmailEl) {
          const emailP = contactEmailEl.closest('p');
          if (emailP) emailP.style.display = 'none';
        }
        if (emailBtn) emailBtn.style.display = 'none';
      }
      
      if (profile.phone && contactPhoneEl) {
        contactPhoneEl.textContent = profile.phone;
      } else {
        // Hide phone row if no phone
        if (contactPhoneEl) {
          const phoneP = contactPhoneEl.closest('p');
          if (phoneP) phoneP.style.display = 'none';
        }
      }

      if (profile.whatsapp && whatsappBtn) {
        whatsappBtn.style.display = 'inline-flex';
        whatsappBtn.href = `https://wa.me/${profile.whatsapp.replace(/[^0-9]/g, '')}`;
      }
    }

    // Hide rates for divers as per user request
    const hasPricing = profile.hourlyRate || profile.dailyRate;
    if (hasPricing && profile.expertType !== 'diver') {
      document.getElementById('pricing-section').style.display = 'block';
      const currency = profile.currency || 'USD';
      
      if (profile.hourlyRate) {
        document.getElementById('hourly-rate-item').style.display = 'block';
        document.getElementById('hourly-rate').textContent = `${currency} ${parseFloat(profile.hourlyRate).toFixed(0)}`;
      }
      
      if (profile.dailyRate) {
        document.getElementById('daily-rate-item').style.display = 'block';
        document.getElementById('daily-rate').textContent = `${currency} ${parseFloat(profile.dailyRate).toFixed(0)}`;
      }
    }

    if (profile.availability) {
      const availText = document.getElementById('availability-text');
      availText.textContent = `Availability: ${profile.availability}`;
      availText.style.display = 'block';
    }

    let hasSocialLinks = false;
    
    if (profile.facebook) {
      const fbLink = document.getElementById('facebook-link');
      let fbUrl = profile.facebook;
      if (!fbUrl.startsWith('http')) {
        fbUrl = `https://facebook.com/${fbUrl.replace(/^@/, '')}`;
      }
      if (fbLink) {
        fbLink.href = fbUrl;
        fbLink.style.display = 'inline-flex';
      }
      hasSocialLinks = true;
    }
    
    if (profile.instagram) {
      const igLink = document.getElementById('instagram-link');
      let igUrl = profile.instagram;
      if (!igUrl.startsWith('http')) {
        igUrl = `https://instagram.com/${igUrl.replace(/^@/, '')}`;
      }
      if (igLink) {
        igLink.href = igUrl;
        igLink.style.display = 'inline-flex';
      }
      hasSocialLinks = true;
    }
    
    if (profile.website) {
      const webLink = document.getElementById('website-link');
      let webUrl = profile.website;
      if (!webUrl.startsWith('http')) {
        webUrl = `https://${webUrl}`;
      }
      webLink.href = webUrl;
      webLink.style.display = 'inline-flex';
      hasSocialLinks = true;
    }
    
    if (hasSocialLinks) {
      document.getElementById('social-links').style.display = 'flex';
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('profile-content').style.display = 'block';

    // For mentors: show offers section, hide trips section
    // For guides/divers: show trips section
    if (profile.expertType === 'mentor') {
      document.getElementById('expert-trips-section').style.display = 'none';
      document.getElementById('mentor-offers-section').style.display = 'block';
      loadMentorOffers(profile.id);
    } else {
      loadExpertTrips(profile.id);
    }

  } catch (error) {
    console.error('Error loading profile:', error);
    showError();
  }

  async function loadMentorOffers(expertId) {
    const loadingEl = document.getElementById('mentor-offers-loading');
    const emptyEl = document.getElementById('mentor-offers-empty');
    const planningContainer = document.getElementById('planning-offers-container');
    const planningGrid = document.getElementById('planning-offers-grid');
    const consultationContainer = document.getElementById('consultation-offers-container');
    const consultationGrid = document.getElementById('consultation-offers-grid');

    try {
      const response = await fetch(`/api/expert-trips/by-expert/${expertId}`);
      const data = await response.json();

      loadingEl.style.display = 'none';

      if (!data.trips || data.trips.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      // Categorize offers into planning vs consultations
      const planningOffers = [];
      const consultationOffers = [];

      data.trips.forEach(offer => {
        const title = (offer.title || '').toLowerCase();
        const type = (offer.trip_type || '').toLowerCase();
        const description = (offer.description || '').toLowerCase();
        
        // Check if it's a consultation offer
        const isConsultation = 
          type.includes('consultation') || 
          type.includes('online') ||
          type.includes('call') ||
          title.includes('consultation') ||
          title.includes('video call') ||
          title.includes('zoom') ||
          title.includes('google meet') ||
          description.includes('consultation') ||
          description.includes('video call');
        
        if (isConsultation) {
          consultationOffers.push(offer);
        } else {
          planningOffers.push(offer);
        }
      });

      // Render planning offers
      if (planningOffers.length > 0) {
        planningContainer.style.display = 'block';
        planningGrid.innerHTML = '';
        planningOffers.forEach(offer => {
          planningGrid.appendChild(createMentorOfferCard(offer, 'planning'));
        });
      }

      // Render consultation offers
      if (consultationOffers.length > 0) {
        consultationContainer.style.display = 'block';
        consultationGrid.innerHTML = '';
        consultationOffers.forEach(offer => {
          consultationGrid.appendChild(createMentorOfferCard(offer, 'consultation'));
        });
      }

      // If no offers in either category, show empty state
      if (planningOffers.length === 0 && consultationOffers.length === 0) {
        emptyEl.style.display = 'block';
      }

    } catch (error) {
      console.error('Error loading mentor offers:', error);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
    }
  }

  function createMentorOfferCard(offer, category) {
    const card = document.createElement('div');
    card.className = 'trip-card';
    
    const img = document.createElement('img');
    img.src = offer.image || '/attached_assets/guides-sphinx.webp';
    img.alt = offer.title || 'Offer';
    img.className = 'trip-card-image';
    img.onerror = function() { this.src = '/attached_assets/guides-sphinx.webp'; };
    card.appendChild(img);
    
    const content = document.createElement('div');
    content.className = 'trip-card-content';
    
    const title = document.createElement('h3');
    title.className = 'trip-card-title';
    title.textContent = offer.title || 'Untitled Offer';
    content.appendChild(title);
    
    // Duration
    if (offer.duration) {
      const duration = document.createElement('p');
      duration.className = 'trip-card-location';
      duration.textContent = '⏱️ ' + offer.duration;
      content.appendChild(duration);
    }
    
    // Short description (truncated)
    if (offer.description) {
      const desc = document.createElement('p');
      desc.style.cssText = 'color: #94a3b8; font-size: 14px; margin-bottom: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;';
      desc.textContent = offer.description.substring(0, 150) + (offer.description.length > 150 ? '...' : '');
      content.appendChild(desc);
    }
    
    // Price with appropriate label
    const priceContainer = document.createElement('div');
    priceContainer.className = 'trip-card-price';
    priceContainer.textContent = (offer.currency || 'USD') + ' ' + (offer.price || 0).toFixed(0);
    const priceLabel = document.createElement('small');
    priceLabel.textContent = category === 'consultation' ? ' Consultation Price' : ' Planning Fee';
    priceContainer.appendChild(priceLabel);
    content.appendChild(priceContainer);
    
    // CTA button
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'margin-top: 15px;';
    
    const bookBtn = document.createElement('a');
    bookBtn.href = '/expert-trips-marketplace.html?trip=' + encodeURIComponent(offer.id) + '&book=true';
    bookBtn.className = 'trip-card-btn';
    bookBtn.style.cssText = 'display: block; text-align: center;';
    
    if (category === 'consultation') {
      bookBtn.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
      bookBtn.textContent = '📹 Book Consultation';
    } else {
      bookBtn.style.background = 'linear-gradient(135deg, #0ea5e9, #38bdf8)';
      bookBtn.textContent = '🗺️ Request Planning';
    }
    
    btnContainer.appendChild(bookBtn);
    content.appendChild(btnContainer);
    
    card.appendChild(content);
    return card;
  }

  async function loadExpertTrips(expertId) {
    const loadingEl = document.getElementById('expert-trips-loading');
    const emptyEl = document.getElementById('expert-trips-empty');
    const gridEl = document.getElementById('expert-trips-grid');

    try {
      const response = await fetch(`/api/expert-trips/by-expert/${expertId}`);
      const data = await response.json();

      loadingEl.style.display = 'none';

      if (!data.trips || data.trips.length === 0) {
        emptyEl.style.display = 'block';
        gridEl.style.display = 'none';
        return;
      }

      gridEl.innerHTML = '';
      
      data.trips.forEach(trip => {
        const card = document.createElement('div');
        card.className = 'trip-card';
        
        const img = document.createElement('img');
        img.src = trip.image || '/attached_assets/guides-sphinx.webp';
        img.alt = trip.title || 'Trip';
        img.className = 'trip-card-image';
        img.onerror = function() { this.src = '/attached_assets/guides-sphinx.webp'; };
        card.appendChild(img);
        
        const content = document.createElement('div');
        content.className = 'trip-card-content';
        
        const title = document.createElement('h3');
        title.className = 'trip-card-title';
        title.textContent = trip.title || 'Untitled Trip';
        content.appendChild(title);
        
        const location = document.createElement('p');
        location.className = 'trip-card-location';
        location.textContent = '📍 ' + (trip.location || 'Egypt');
        content.appendChild(location);
        
        const meta = document.createElement('div');
        meta.className = 'trip-card-meta';
        const durationSpan = document.createElement('span');
        durationSpan.textContent = '⏱️ ' + (trip.duration || 'Flexible');
        meta.appendChild(durationSpan);
        const groupSpan = document.createElement('span');
        groupSpan.textContent = '👥 Max ' + (trip.max_group_size || 10) + ' people';
        meta.appendChild(groupSpan);
        content.appendChild(meta);
        
        const price = document.createElement('div');
        price.className = 'trip-card-price';
        price.textContent = (trip.currency || 'USD') + ' ' + trip.price.toFixed(0);
        const priceSmall = document.createElement('small');
        priceSmall.textContent = ' / person';
        price.appendChild(priceSmall);
        content.appendChild(price);
        
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';
        
        const detailsBtn = document.createElement('a');
        detailsBtn.href = '/expert-trips-marketplace.html?trip=' + encodeURIComponent(trip.id);
        detailsBtn.className = 'trip-card-btn';
        detailsBtn.style.cssText = 'flex: 1; background: linear-gradient(135deg, #1e3a5f, #2d4a6f); text-align: center;';
        detailsBtn.textContent = '📖 Details';
        btnContainer.appendChild(detailsBtn);
        
        const bookBtn = document.createElement('a');
        bookBtn.href = '/expert-trips-marketplace.html?trip=' + encodeURIComponent(trip.id) + '&book=true';
        bookBtn.className = 'trip-card-btn';
        bookBtn.style.cssText = 'flex: 1; background: linear-gradient(135deg, #0ea5e9, #38bdf8); text-align: center;';
        bookBtn.textContent = '✈️ Book Now';
        btnContainer.appendChild(bookBtn);
        
        content.appendChild(btnContainer);
        
        card.appendChild(content);
        gridEl.appendChild(card);
      });

      gridEl.style.display = 'grid';
      emptyEl.style.display = 'none';
    } catch (error) {
      console.error('Error loading expert trips:', error);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
    }
  }

  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorEl = document.getElementById('error');
    errorEl.style.display = 'block';
    errorEl.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <h2 style="color: #ff6b6b; margin-bottom: 16px;">Profile Not Found</h2>
        <p style="color: #a0aec0; margin-bottom: 20px;">${message || "Sorry, we couldn't find this expert profile."}</p>
        <button onclick="location.reload()" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 10px;">Try Again</button>
        <a href="/" style="padding: 12px 24px; background: #2d3748; color: white; text-decoration: none; border-radius: 8px;">← Back to Home</a>
      </div>
    `;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function openRequestModal(profile) {
    const modal = document.getElementById('request-modal');
    const modalGuideName = document.getElementById('modal-guide-name');
    const modalGuidePhoto = document.getElementById('modal-guide-photo');
    const formGuideId = document.getElementById('form-guide-id');
    const formGuideName = document.getElementById('form-guide-name');
    
    if (modal && profile) {
      modalGuideName.textContent = profile.displayName || 'Guide';
      if (profile.photoUrl || profile.profilePhoto) {
        modalGuidePhoto.src = profile.photoUrl || profile.profilePhoto;
      }
      formGuideId.value = profile.id;
      formGuideName.value = profile.displayName || 'Guide';
      
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeRequestModal() {
    const modal = document.getElementById('request-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeRequestModal);
  }

  const requestModal = document.getElementById('request-modal');
  if (requestModal) {
    requestModal.addEventListener('click', function(e) {
      if (e.target === requestModal) {
        closeRequestModal();
      }
    });
  }

  const requestForm = document.getElementById('request-itinerary-form');
  if (requestForm) {
    requestForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-request-btn');
      const formMessage = document.getElementById('form-message');
      const originalBtnText = submitBtn.textContent;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      formMessage.style.display = 'none';
      
      const formData = {
        guideId: document.getElementById('form-guide-id').value,
        guideName: document.getElementById('form-guide-name').value,
        travelerName: document.getElementById('traveler-name').value.trim(),
        travelerEmail: document.getElementById('traveler-email').value.trim(),
        travelerWhatsapp: document.getElementById('traveler-whatsapp').value.trim(),
        message: document.getElementById('traveler-message').value.trim()
      };
      
      if (!formData.travelerName || !formData.travelerEmail || !formData.message) {
        formMessage.textContent = 'Please fill in all required fields.';
        formMessage.style.display = 'block';
        formMessage.style.background = 'rgba(239, 68, 68, 0.2)';
        formMessage.style.color = '#ef4444';
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }
      
      try {
        const response = await fetch('/api/guide-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          formMessage.textContent = 'Your request has been sent! The guide will contact you soon.';
          formMessage.style.display = 'block';
          formMessage.style.background = 'rgba(16, 185, 129, 0.2)';
          formMessage.style.color = '#10b981';
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          
          requestForm.reset();
          
          setTimeout(closeRequestModal, 3000);
        } else {
          formMessage.textContent = result.message || 'Failed to send request. Please try again.';
          formMessage.style.display = 'block';
          formMessage.style.background = 'rgba(239, 68, 68, 0.2)';
          formMessage.style.color = '#ef4444';
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      } catch (error) {
        console.error('Error submitting request:', error);
        formMessage.textContent = 'Network error. Please try again.';
        formMessage.style.display = 'block';
        formMessage.style.background = 'rgba(239, 68, 68, 0.2)';
        formMessage.style.color = '#ef4444';
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }
});
