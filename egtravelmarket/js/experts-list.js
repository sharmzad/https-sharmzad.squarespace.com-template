document.addEventListener('DOMContentLoaded', async function() {
  const expertType = getExpertTypeFromPage();
  const container = document.querySelector('.grid, #experts-grid');
  
  if (!container) {
    console.error('Grid container not found');
    return;
  }

  let allExperts = [];
  let displayedExperts = [];
  let currentOffset = 0;
  let hasMore = false;
  let totalExperts = 0;
  const PAGE_SIZE = 12;
  let isLoading = false;
  let isFiltered = false;

  const nameFilter = document.getElementById('name-filter');
  const locationFilter = document.getElementById('location-filter');
  const languageFilter = document.getElementById('language-filter');
  const specialtyFilter = document.getElementById('specialty-filter');
  const basedInFilter = document.getElementById('based-in-filter');
  const destinationFilter = document.getElementById('destination-filter');
  const experienceFilter = document.getElementById('experience-filter');
  const priceFilter = document.getElementById('price-filter');
  const diverTypeFilter = document.getElementById('diver-type-filter');
  
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  async function fetchExperts(offset = 0, limit = PAGE_SIZE) {
    const response = await fetch(`/api/experts/list/${expertType}?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error('Failed to load experts');
    }
    return response.json();
  }

  async function fetchAllExperts() {
    const response = await fetch(`/api/experts/list/${expertType}?limit=500&offset=0`);
    if (!response.ok) {
      throw new Error('Failed to load experts');
    }
    return response.json();
  }

  function showSkeletons(count = 12) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-card';
      skeleton.innerHTML = `
        <div class="skeleton-thumb">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-badge"></div>
        </div>
        <div class="skeleton-body">
          <div class="skeleton-name"></div>
          <div class="skeleton-rating"></div>
          <div class="skeleton-location"></div>
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
          <div class="skeleton-bio"></div>
        </div>
        <div class="skeleton-actions">
          <div class="skeleton-btn"></div>
        </div>
      `;
      container.appendChild(skeleton);
    }
  }

  function hideLoadMore() {
    if (loadMoreContainer) {
      loadMoreContainer.style.display = 'none';
    }
  }

  function showLoadMore() {
    if (loadMoreContainer && hasMore && !isFiltered) {
      loadMoreContainer.style.display = 'block';
      if (loadMoreBtn) {
        const typeLabel = capitalize(expertType) + 's';
        loadMoreBtn.textContent = `Load More ${typeLabel}`;
      }
    }
  }

  function setLoadingState(loading) {
    isLoading = loading;
    if (loadMoreBtn) {
      if (loading) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="spinner"></span> Loading...';
      } else {
        loadMoreBtn.disabled = false;
        const typeLabel = capitalize(expertType) + 's';
        loadMoreBtn.textContent = `Load More ${typeLabel}`;
      }
    }
  }

  function hasActiveFilters() {
    const nameVal = nameFilter ? nameFilter.value.trim() : '';
    const locationVal = locationFilter ? locationFilter.value : '';
    const languageVal = languageFilter ? languageFilter.value : '';
    const specialtyVal = specialtyFilter ? specialtyFilter.value : '';
    const basedInVal = basedInFilter ? basedInFilter.value : '';
    const destinationVal = destinationFilter ? destinationFilter.value : '';
    const experienceVal = experienceFilter ? experienceFilter.value : '';
    const priceVal = priceFilter ? priceFilter.value : '';
    const diverTypeVal = diverTypeFilter ? diverTypeFilter.value : '';

    return !!(nameVal || locationVal || languageVal || specialtyVal || 
              basedInVal || destinationVal || experienceVal || priceVal || diverTypeVal);
  }

  try {
    const data = await fetchExperts(0, PAGE_SIZE);
    allExperts = data.experts;
    displayedExperts = [...allExperts];
    hasMore = data.hasMore;
    totalExperts = data.total;
    currentOffset = data.experts.length;

    renderExperts(displayedExperts, false);
    setupFilters();
    
    if (hasMore) {
      showLoadMore();
    }

  } catch (error) {
    console.error('Error loading experts:', error);
    showError();
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function() {
      if (isLoading || isFiltered) return;
      
      setLoadingState(true);
      
      try {
        const data = await fetchExperts(currentOffset, PAGE_SIZE);
        
        allExperts = [...allExperts, ...data.experts];
        currentOffset += data.experts.length;
        hasMore = data.hasMore;
        
        renderExperts(allExperts, false);
        
        if (!hasMore) {
          hideLoadMore();
        }
      } catch (error) {
        console.error('Error loading more experts:', error);
      } finally {
        setLoadingState(false);
      }
    });
  }

  function setupFilters() {
    if (nameFilter) {
      nameFilter.addEventListener('input', debounce(applyFilters, 300));
    }
    if (locationFilter) {
      locationFilter.addEventListener('change', applyFilters);
    }
    if (languageFilter) {
      languageFilter.addEventListener('change', applyFilters);
    }
    if (specialtyFilter) {
      specialtyFilter.addEventListener('change', applyFilters);
    }
    if (basedInFilter) {
      basedInFilter.addEventListener('change', applyFilters);
    }
    if (destinationFilter) {
      destinationFilter.addEventListener('change', applyFilters);
    }
    if (experienceFilter) {
      experienceFilter.addEventListener('change', applyFilters);
    }
    if (priceFilter) {
      priceFilter.addEventListener('change', applyFilters);
    }
    if (diverTypeFilter) {
      diverTypeFilter.addEventListener('change', applyFilters);
    }
  }

  async function applyFilters() {
    const filtersActive = hasActiveFilters();
    
    if (filtersActive && !isFiltered) {
      isFiltered = true;
      showSkeletons(6);
      
      try {
        const data = await fetchAllExperts();
        allExperts = data.experts;
        hasMore = false;
        hideLoadMore();
      } catch (error) {
        console.error('Error fetching all experts for filtering:', error);
      }
    } else if (!filtersActive && isFiltered) {
      isFiltered = false;
      showSkeletons(6);
      
      try {
        const data = await fetchExperts(0, PAGE_SIZE);
        allExperts = data.experts;
        hasMore = data.hasMore;
        totalExperts = data.total;
        currentOffset = data.experts.length;
        
        if (hasMore) {
          showLoadMore();
        }
      } catch (error) {
        console.error('Error resetting to paginated view:', error);
      }
    }

    const nameVal = nameFilter ? nameFilter.value.toLowerCase().trim() : '';
    const locationVal = locationFilter ? locationFilter.value.toLowerCase() : '';
    const languageVal = languageFilter ? languageFilter.value.toLowerCase() : '';
    const specialtyVal = specialtyFilter ? specialtyFilter.value.toLowerCase() : '';
    const basedInVal = basedInFilter ? basedInFilter.value.toLowerCase() : '';
    const destinationVal = destinationFilter ? destinationFilter.value.toLowerCase() : '';
    const experienceVal = experienceFilter ? experienceFilter.value : '';
    const priceVal = priceFilter ? priceFilter.value : '';
    const diverTypeVal = diverTypeFilter ? diverTypeFilter.value.toLowerCase() : '';

    const filtered = allExperts.filter(expert => {
      const name = (expert.displayName || '').toLowerCase();
      const slug = (expert.slug || '').toLowerCase();
      const bio = (expert.bio || '').toLowerCase();
      const location = (expert.location || '').toLowerCase();
      const basedIn = (expert.basedIn || '').toLowerCase();
      const primaryLocation = (expert.primaryLocation || '').toLowerCase();
      const primaryRole = (expert.primaryRole || '').toLowerCase();
      
      const diveLocationsCoveredArr = Array.isArray(expert.diveLocationsCovered) 
        ? expert.diveLocationsCovered 
        : (expert.diveLocationsCovered || '').split(/[,\/]/).map(s => s.trim()).filter(Boolean);
      const diveLocationsCovered = diveLocationsCoveredArr.join(',').toLowerCase();
      
      const languagesArr = Array.isArray(expert.languages) 
        ? expert.languages 
        : (expert.languages || '').split(/[,\/]/).map(s => s.trim()).filter(Boolean);
      const languages = languagesArr.join(',').toLowerCase();
      
      let specialtiesArr = [];
      if (expertType === 'diver' && Array.isArray(expert.diveSpecialties) && expert.diveSpecialties.length > 0) {
        specialtiesArr = expert.diveSpecialties;
      } else if (Array.isArray(expert.specialties)) {
        specialtiesArr = expert.specialties;
      } else {
        specialtiesArr = (expert.specialties || '').split(/[,\/]/).map(s => s.trim()).filter(Boolean);
      }
      const specialties = specialtiesArr.join(',').toLowerCase();
      
      const destinationsArr = Array.isArray(expert.destinations) 
        ? expert.destinations 
        : (expert.destinations || '').split(/[,\/]/).map(s => s.trim()).filter(Boolean);
      const destinations = destinationsArr.join(',').toLowerCase();
      
      const experience = expert.experience || '';

      if (nameVal && !name.includes(nameVal) && !slug.includes(nameVal)) {
        return false;
      }

      if (locationVal) {
        if (expertType === 'diver') {
          const locationMatch = primaryLocation.includes(locationVal) || 
                               diveLocationsCovered.includes(locationVal) || 
                               location.includes(locationVal);
          if (!locationMatch) {
            return false;
          }
        } else {
          const locationMatch = location.includes(locationVal) || destinations.includes(locationVal);
          if (!locationMatch) {
            return false;
          }
        }
      }
      
      if (diverTypeVal && expertType === 'diver') {
        if (!primaryRole.includes(diverTypeVal)) {
          return false;
        }
      }

      if (languageVal) {
        const normalizedLangs = languages
          .replace(/\ben\b/gi, 'english')
          .replace(/\bar\b/gi, 'arabic')
          .replace(/\bfr\b/gi, 'french')
          .replace(/\bde\b/gi, 'german')
          .replace(/\bes\b/gi, 'spanish')
          .replace(/\bit\b/gi, 'italian')
          .replace(/\bru\b/gi, 'russian');
        if (!normalizedLangs.includes(languageVal) && !languages.includes(languageVal)) {
          return false;
        }
      }

      if (specialtyVal) {
        const specialtyMatch = specialties.includes(specialtyVal) || bio.includes(specialtyVal);
        if (!specialtyMatch) {
          return false;
        }
      }

      if (expertType !== 'diver') {
        if (basedInVal) {
          if (basedInVal === 'egypt' && basedIn !== 'egypt') return false;
          if (basedInVal === 'abroad' && basedIn !== 'outside egypt' && basedIn !== 'abroad') return false;
        }

        if (destinationVal && !destinations.includes(destinationVal)) {
          return false;
        }

        if (experienceVal && experience !== experienceVal) {
          return false;
        }

        if (priceVal) {
          const price = parseFloat(expert.startingPrice || expert.planningFee || 50);
          if (priceVal === '0-50' && price > 50) return false;
          if (priceVal === '50-100' && (price < 50 || price > 100)) return false;
          if (priceVal === '100-200' && (price < 100 || price > 200)) return false;
          if (priceVal === '200+' && price < 200) return false;
        }
      }

      return true;
    });

    displayedExperts = filtered;
    renderExperts(filtered, false);
  }

  function renderExperts(experts, append = false) {
    if (!append) {
      container.innerHTML = '';
    }

    if (experts.length === 0) {
      const signupPage = expertType === 'mentor' ? '/be-mentor.html' : `/${expertType}-signup.html`;
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
      
      const heading = document.createElement('h3');
      heading.textContent = allExperts.length > 0 ? 'No matches found' : `No ${expertType}s found yet`;
      
      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'color: #666; margin: 15px 0;';
      paragraph.textContent = allExperts.length > 0 
        ? 'Try adjusting your filters' 
        : 'Be the first to join our platform!';
      
      emptyDiv.appendChild(heading);
      emptyDiv.appendChild(paragraph);

      if (allExperts.length === 0) {
        const link = document.createElement('a');
        link.href = signupPage;
        link.className = 'btn primary';
        link.textContent = `Join as ${capitalize(expertType)}`;
        emptyDiv.appendChild(link);
      }

      container.appendChild(emptyDiv);
      hideLoadMore();
      return;
    }

    experts.forEach(expert => {
      const card = createExpertCard(expert, expertType);
      container.appendChild(card);
    });
  }

  function showError() {
    container.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
    
    const heading = document.createElement('h3');
    heading.textContent = `Error loading ${expertType}s`;
    
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'color: #666;';
    paragraph.textContent = 'Please try again later or contact support.';
    
    errorDiv.appendChild(heading);
    errorDiv.appendChild(paragraph);
    container.appendChild(errorDiv);
    hideLoadMore();
  }

  function createExpertCard(expert, type) {
    const card = document.createElement('article');
    card.className = 'card';

    const defaultPhotos = {
      guide: '/attached_assets/guides-sphinx.webp',
      diver: '/attached_assets/guides-divers.webp',
      mentor: '/attached_assets/mentor-hero-optimized.webp'
    };

    const photoUrl = expert.photoUrl || defaultPhotos[type] || '/attached_assets/guides-sphinx.webp';

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';
    
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = expert.displayName || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = function() { this.src = defaultPhotos[type]; };
    thumbDiv.appendChild(img);
    
    if (type !== 'mentor') {
      const locationBadge = document.createElement('span');
      locationBadge.className = 'badge';
      locationBadge.textContent = (type === 'diver' ? (expert.primaryLocation || expert.location) : expert.location) || 'Egypt';
      thumbDiv.appendChild(locationBadge);
      
      if (expert.isFeatured) {
        const featuredBadge = document.createElement('span');
        featuredBadge.className = 'badge';
        featuredBadge.style.cssText = 'background: #ffc107; color: #000; top: 52px;';
        featuredBadge.textContent = '★ Featured';
        thumbDiv.appendChild(featuredBadge);
      }
      if (expert.isVerified) {
        const verifiedBadge = document.createElement('span');
        verifiedBadge.className = 'badge';
        verifiedBadge.style.cssText = 'background: #4caf50; color: white; top: 52px;';
        verifiedBadge.textContent = '✓ Verified';
        thumbDiv.appendChild(verifiedBadge);
      }
    }
    
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'body';
    
    if (expert.isCertified) {
      const certifiedBadge = document.createElement('span');
      certifiedBadge.className = 'certified-badge';
      certifiedBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Certified';
      bodyDiv.appendChild(certifiedBadge);
    }
    
    const nameHeading = document.createElement('h3');
    nameHeading.textContent = expert.displayName || '';
    bodyDiv.appendChild(nameHeading);
    
    if (type !== 'diver') {
      const langArr = Array.isArray(expert.languages) 
        ? expert.languages 
        : (expert.languages || '').split(/[,\/]+/).map(s => s.trim()).filter(Boolean);
      if (langArr.length > 0) {
        const langDiv = document.createElement('div');
        langDiv.className = 'meta';
        const langSpan = document.createElement('span');
        langSpan.textContent = langArr.slice(0, 3).join(', ') + (langArr.length > 3 ? '...' : '');
        langDiv.appendChild(langSpan);
        bodyDiv.appendChild(langDiv);
      }
    }
    
    if (type === 'mentor') {
      const metaDiv1 = document.createElement('div');
      metaDiv1.className = 'meta';
      const basedInSpan = document.createElement('span');
      basedInSpan.textContent = `Based in: ${expert.basedIn === 'Egypt' ? 'Egypt' : 'Abroad'}`;
      metaDiv1.appendChild(basedInSpan);
      bodyDiv.appendChild(metaDiv1);
      
      const specialtiesArr = Array.isArray(expert.specialties) ? expert.specialties : [];
      const destinationsArr = Array.isArray(expert.destinations) ? expert.destinations : [];
      
      if (specialtiesArr.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.cssText = 'margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;';
        specialtiesArr.slice(0, 3).forEach(specialty => {
          const tag = document.createElement('span');
          tag.style.cssText = 'background: rgba(14, 165, 233, 0.15); color: #0ea5e9; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          tag.textContent = specialty;
          tagsDiv.appendChild(tag);
        });
        bodyDiv.appendChild(tagsDiv);
      }
      
      if (destinationsArr.length > 0) {
        const destDiv = document.createElement('div');
        destDiv.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap; gap: 5px;';
        destinationsArr.slice(0, 3).forEach(dest => {
          const tag = document.createElement('span');
          tag.style.cssText = 'background: rgba(39, 174, 96, 0.15); color: #27ae60; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          tag.textContent = dest;
          destDiv.appendChild(tag);
        });
        bodyDiv.appendChild(destDiv);
      }
      
      const priceP = document.createElement('p');
      priceP.style.cssText = 'margin-top: 10px; color: #0066cc; font-weight: 600; font-size: 14px;';
      const price = expert.startingPrice || expert.planningFee || 50;
      priceP.textContent = `Planning from $${price}`;
      bodyDiv.appendChild(priceP);
    } else if (type === 'guide') {
      const metaExp = document.createElement('div');
      metaExp.className = 'meta';
      metaExp.style.marginTop = '4px';
      const expSpan = document.createElement('span');
      expSpan.textContent = `${expert.experience || 0} years experience`;
      metaExp.appendChild(expSpan);
      bodyDiv.appendChild(metaExp);
      
      const specialtiesArr = Array.isArray(expert.specialties) 
        ? expert.specialties 
        : (expert.specialties || '').split(/[,\/]+/).map(s => s.trim()).filter(Boolean);
      if (specialtiesArr.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.cssText = 'margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px;';
        specialtiesArr.slice(0, 2).forEach(specialty => {
          const tag = document.createElement('span');
          tag.style.cssText = 'background: rgba(14, 165, 233, 0.15); color: #0ea5e9; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          tag.textContent = specialty;
          tagsDiv.appendChild(tag);
        });
        if (specialtiesArr.length > 2) {
          const moreTag = document.createElement('span');
          moreTag.style.cssText = 'background: rgba(255,255,255,0.1); color: #888; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          moreTag.textContent = `+${specialtiesArr.length - 2}`;
          tagsDiv.appendChild(moreTag);
        }
        bodyDiv.appendChild(tagsDiv);
      }
      
      if (expert.bio) {
        const bioP = document.createElement('p');
        bioP.style.cssText = 'margin-top: 8px; color: #999; font-size: 13px; line-height: 1.4;';
        bioP.textContent = truncate(expert.bio, 80);
        bodyDiv.appendChild(bioP);
      }
      
      if (expert.hasLicense) {
        const licenseBadge = document.createElement('div');
        licenseBadge.style.cssText = 'margin-top: 8px; display: inline-flex; align-items: center; gap: 4px; background: rgba(39, 174, 96, 0.15); color: #27ae60; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500;';
        licenseBadge.innerHTML = '&#10003; Licensed Guide';
        bodyDiv.appendChild(licenseBadge);
      }
    } else if (type === 'diver') {
      const roleDiv = document.createElement('div');
      roleDiv.className = 'meta';
      roleDiv.style.cssText = 'color: #0ea5e9; font-weight: 500;';
      roleDiv.textContent = expert.primaryRole || 'Diving Instructor';
      bodyDiv.appendChild(roleDiv);
      
      const diverLocation = expert.primaryLocation || expert.location || 'Egypt';
      const locDiv = document.createElement('div');
      locDiv.className = 'meta';
      locDiv.style.marginTop = '4px';
      locDiv.textContent = diverLocation;
      bodyDiv.appendChild(locDiv);
      
      const rating = parseFloat(expert.rating) || 0;
      const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
      const metaDiv1 = document.createElement('div');
      metaDiv1.className = 'meta';
      metaDiv1.style.marginTop = '6px';
      const starsSpan = document.createElement('span');
      starsSpan.style.color = '#ffc107';
      starsSpan.textContent = stars;
      metaDiv1.appendChild(starsSpan);
      const ratingSpan = document.createElement('span');
      ratingSpan.textContent = ` ${rating.toFixed(1)} · ${expert.experience || 0} yrs`;
      metaDiv1.appendChild(ratingSpan);
      bodyDiv.appendChild(metaDiv1);
      
      const bioText = expert.bio || expert.about || '';
      if (bioText) {
        const bioP = document.createElement('p');
        bioP.style.cssText = 'margin-top: 8px; color: #999; font-size: 13px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        bioP.textContent = truncate(bioText, 120);
        bodyDiv.appendChild(bioP);
      }
      
      const specialtiesArr = Array.isArray(expert.diveSpecialties) && expert.diveSpecialties.length > 0
        ? expert.diveSpecialties
        : (Array.isArray(expert.specialties) 
          ? expert.specialties 
          : (expert.specialties || '').split(/[,\/]+/).map(s => s.trim()).filter(Boolean));
      if (specialtiesArr.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.cssText = 'margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px;';
        specialtiesArr.slice(0, 2).forEach(specialty => {
          const tag = document.createElement('span');
          tag.style.cssText = 'background: rgba(14, 165, 233, 0.15); color: #0ea5e9; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          tag.textContent = specialty;
          tagsDiv.appendChild(tag);
        });
        if (specialtiesArr.length > 2) {
          const moreTag = document.createElement('span');
          moreTag.style.cssText = 'background: rgba(255,255,255,0.1); color: #888; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
          moreTag.textContent = `+${specialtiesArr.length - 2} more`;
          tagsDiv.appendChild(moreTag);
        }
        bodyDiv.appendChild(tagsDiv);
      }
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    
    const profileLink = document.createElement('a');
    profileLink.className = 'btn primary';
    profileLink.href = `/${type}/${expert.slug || ''}`;
    profileLink.textContent = 'View Profile';
    actionsDiv.appendChild(profileLink);
    
    card.appendChild(thumbDiv);
    card.appendChild(bodyDiv);
    card.appendChild(actionsDiv);

    return card;
  }

  function getExpertTypeFromPage() {
    const title = document.title.toLowerCase();
    if (title.includes('guide')) return 'guide';
    if (title.includes('diver') || title.includes('diving')) return 'diver';
    if (title.includes('mentor')) return 'mentor';
    return 'guide';
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function truncate(text, length) {
    if (text.length <= length) return text;
    return text.substr(0, length) + '...';
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});
