document.addEventListener('DOMContentLoaded', async function() {
  const container = document.querySelector('.grid, #agencies-grid');
  
  if (!container) {
    console.error('Grid container not found');
    return;
  }

  let allAgencies = [];
  let currentOffset = 0;
  let hasMore = false;
  let totalAgencies = 0;
  const PAGE_SIZE = 12;
  let isLoading = false;
  let isFiltered = false;

  const nameFilter = document.getElementById('name-filter');
  const filterToggle = document.getElementById('filter-toggle');
  const filtersPanel = document.getElementById('filters-panel');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const activeFiltersCount = document.getElementById('active-filters-count');
  const experienceFilter = document.getElementById('experience-filter');
  
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  async function fetchAgencies(offset = 0, limit = PAGE_SIZE) {
    const response = await fetch(`/api/agencies/list?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error('Failed to load agencies');
    }
    return response.json();
  }

  async function fetchAllAgencies() {
    const response = await fetch(`/api/agencies/list?limit=500&offset=0`);
    if (!response.ok) {
      throw new Error('Failed to load agencies');
    }
    return response.json();
  }

  function showSkeletons(count = 6) {
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
        loadMoreBtn.textContent = 'Load More Agencies';
      }
    }
  }

  function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  function hasActiveFilters() {
    const nameVal = nameFilter ? nameFilter.value.trim() : '';
    const destinations = getCheckedValues('destinations-filter');
    const services = getCheckedValues('services-filter');
    const businessTypes = getCheckedValues('business-type-filter');
    const bases = getCheckedValues('base-filter');
    const experience = experienceFilter ? experienceFilter.value : '';
    
    return !!(nameVal || destinations.length || services.length || businessTypes.length || bases.length || experience);
  }

  function updateActiveFiltersCount() {
    const destinations = getCheckedValues('destinations-filter').length;
    const services = getCheckedValues('services-filter').length;
    const businessTypes = getCheckedValues('business-type-filter').length;
    const bases = getCheckedValues('base-filter').length;
    const experience = experienceFilter && experienceFilter.value ? 1 : 0;
    const name = nameFilter && nameFilter.value.trim() ? 1 : 0;
    
    const total = destinations + services + businessTypes + bases + experience + name;
    
    if (activeFiltersCount) {
      if (total > 0) {
        activeFiltersCount.textContent = total;
        activeFiltersCount.style.display = 'inline';
      } else {
        activeFiltersCount.style.display = 'none';
      }
    }
  }

  try {
    const data = await fetchAgencies(0, PAGE_SIZE);
    allAgencies = data.agencies;
    hasMore = data.hasMore;
    totalAgencies = data.total;
    currentOffset = data.agencies.length;

    renderAgencies(allAgencies);
    setupFilters();
    
    if (hasMore) {
      showLoadMore();
    }

  } catch (error) {
    console.error('Error loading agencies:', error);
    showError();
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function() {
      if (isLoading || isFiltered) return;
      
      setLoadingState(true);
      
      try {
        const data = await fetchAgencies(currentOffset, PAGE_SIZE);
        
        allAgencies = [...allAgencies, ...data.agencies];
        currentOffset += data.agencies.length;
        hasMore = data.hasMore;
        
        renderAgencies(allAgencies);
        
        if (!hasMore) {
          hideLoadMore();
        }
      } catch (error) {
        console.error('Error loading more agencies:', error);
      } finally {
        setLoadingState(false);
      }
    });
  }

  if (filterToggle && filtersPanel) {
    filterToggle.addEventListener('click', function() {
      filtersPanel.classList.toggle('collapsed');
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
      if (nameFilter) nameFilter.value = '';
      if (experienceFilter) experienceFilter.value = '';
      
      document.querySelectorAll('#filters-panel input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      
      updateActiveFiltersCount();
      applyFilters();
    });
  }

  function setupFilters() {
    if (nameFilter) {
      nameFilter.addEventListener('input', debounce(function() {
        updateActiveFiltersCount();
        applyFilters();
      }, 300));
    }
    
    document.querySelectorAll('#destinations-filter input, #services-filter input, #business-type-filter input, #base-filter input').forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        updateActiveFiltersCount();
        applyFilters();
      });
    });
    
    if (experienceFilter) {
      experienceFilter.addEventListener('change', function() {
        updateActiveFiltersCount();
        applyFilters();
      });
    }
  }

  async function applyFilters() {
    const filtersActive = hasActiveFilters();
    
    if (filtersActive && !isFiltered) {
      isFiltered = true;
      showSkeletons(6);
      
      try {
        const data = await fetchAllAgencies();
        allAgencies = data.agencies;
        hasMore = false;
        hideLoadMore();
      } catch (error) {
        console.error('Error fetching all agencies for filtering:', error);
      }
    } else if (!filtersActive && isFiltered) {
      isFiltered = false;
      showSkeletons(6);
      
      try {
        const data = await fetchAgencies(0, PAGE_SIZE);
        allAgencies = data.agencies;
        hasMore = data.hasMore;
        totalAgencies = data.total;
        currentOffset = data.agencies.length;
        
        if (hasMore) {
          showLoadMore();
        }
      } catch (error) {
        console.error('Error resetting to paginated view:', error);
      }
    }

    const nameVal = nameFilter ? nameFilter.value.toLowerCase().trim() : '';
    const selectedDestinations = getCheckedValues('destinations-filter').map(d => d.toLowerCase());
    const selectedServices = getCheckedValues('services-filter').map(s => s.toLowerCase());
    const selectedBusinessTypes = getCheckedValues('business-type-filter').map(t => t.toLowerCase());
    const selectedBases = getCheckedValues('base-filter').map(b => b.toLowerCase());
    const experienceVal = experienceFilter ? experienceFilter.value : '';

    const filtered = allAgencies.filter(agency => {
      const name = (agency.companyName || '').toLowerCase();
      
      if (nameVal && !name.includes(nameVal)) {
        return false;
      }

      if (selectedDestinations.length > 0) {
        const agencyDests = [
          ...(agency.egyptDestinations || []),
          ...(agency.operatingAreas || [])
        ].map(d => d.toLowerCase());
        const hasMatchingDest = selectedDestinations.some(dest => 
          agencyDests.some(ad => ad.includes(dest) || dest.includes(ad))
        );
        if (!hasMatchingDest) return false;
      }

      if (selectedServices.length > 0) {
        const agencyProducts = [
          ...(agency.productsOffered || []),
          ...(agency.services || [])
        ].map(s => s.toLowerCase());
        const hasMatchingService = selectedServices.some(svc => 
          agencyProducts.some(ap => ap.includes(svc) || svc.includes(ap))
        );
        if (!hasMatchingService) return false;
      }

      if (selectedBusinessTypes.length > 0) {
        const agencyTypes = Array.isArray(agency.businessType) 
          ? agency.businessType.map(t => t.toLowerCase())
          : (agency.businessType || '').toLowerCase().split(',').map(t => t.trim());
        const hasMatchingType = selectedBusinessTypes.some(bt => 
          agencyTypes.some(at => at.includes(bt) || bt.includes(at))
        );
        if (!hasMatchingType) return false;
      }

      if (selectedBases.length > 0) {
        const agencyBase = (agency.companyBasedIn || 'egypt').toLowerCase();
        const hasMatchingBase = selectedBases.some(base => {
          if (base === 'egypt') {
            return agencyBase === 'egypt' || agencyBase.includes('egypt');
          } else {
            return agencyBase === 'outside egypt' || agencyBase.includes('outside') || agencyBase.includes('international');
          }
        });
        if (!hasMatchingBase) return false;
      }

      if (experienceVal) {
        const years = agency.yearsInBusiness || 0;
        switch (experienceVal) {
          case '1-3':
            if (years < 1 || years > 3) return false;
            break;
          case '4-7':
            if (years < 4 || years > 7) return false;
            break;
          case '8-15':
            if (years < 8 || years > 15) return false;
            break;
          case '15+':
            if (years < 15) return false;
            break;
        }
      }

      return true;
    });

    renderAgencies(filtered);
  }

  function renderAgencies(agencies) {
    container.innerHTML = '';

    if (agencies.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
      
      const heading = document.createElement('h3');
      heading.textContent = allAgencies.length > 0 ? 'No matches found' : 'No travel agencies found yet';
      
      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'color: #666; margin: 15px 0;';
      paragraph.textContent = allAgencies.length > 0 
        ? 'Try adjusting your filters' 
        : 'Be the first to join our platform!';
      
      emptyDiv.appendChild(heading);
      emptyDiv.appendChild(paragraph);

      if (allAgencies.length === 0) {
        const link = document.createElement('a');
        link.href = '/agency-signup.html';
        link.className = 'btn primary';
        link.textContent = 'Join as Travel Agency';
        emptyDiv.appendChild(link);
      }

      container.appendChild(emptyDiv);
      hideLoadMore();
      return;
    }

    agencies.forEach(agency => {
      const card = createAgencyCard(agency);
      container.appendChild(card);
    });
  }

  function showError() {
    container.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Error loading travel agencies';
    
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'color: #666;';
    paragraph.textContent = 'Please try again later.';
    
    errorDiv.appendChild(heading);
    errorDiv.appendChild(paragraph);
    container.appendChild(errorDiv);
    hideLoadMore();
  }

  function createAgencyCard(agency) {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.minHeight = '420px';

    const defaultLogo = '/attached_assets/guides-sphinx.webp';
    const logoUrl = agency.logoUrl || defaultLogo;
    
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';
    thumbDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 20px; background: linear-gradient(135deg, #0f1f2f 0%, #1a3a5c 100%);';
    
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = agency.companyName || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 12px; border: 2px solid rgba(255,255,255,0.1);';
    img.onerror = function() { this.src = defaultLogo; };
    thumbDiv.appendChild(img);
    
    const basedIn = agency.companyBasedIn || 'Egypt';
    const basedInBadge = document.createElement('span');
    basedInBadge.className = 'badge';
    if (basedIn === 'Outside Egypt' || basedIn.toLowerCase().includes('international')) {
      basedInBadge.style.cssText = 'background: #9b59b6; color: white;';
      basedInBadge.textContent = 'International';
    } else {
      basedInBadge.style.cssText = 'background: #e74c3c; color: white;';
      basedInBadge.textContent = 'Egypt-based';
    }
    thumbDiv.appendChild(basedInBadge);
    
    if (agency.isFeatured) {
      const featuredBadge = document.createElement('span');
      featuredBadge.className = 'badge';
      featuredBadge.style.cssText = 'background: #ffc107; color: #000; top: 52px;';
      featuredBadge.textContent = 'Featured';
      thumbDiv.appendChild(featuredBadge);
    }
    if (agency.isVerified) {
      const verifiedBadge = document.createElement('span');
      verifiedBadge.className = 'badge';
      verifiedBadge.style.cssText = 'background: #4caf50; color: white; top: ' + (agency.isFeatured ? '90px' : '52px') + ';';
      verifiedBadge.textContent = 'Verified';
      thumbDiv.appendChild(verifiedBadge);
    }
    
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'body';
    
    bodyDiv.style.cssText = 'padding: 16px;';
    
    if (agency.certificationBadge) {
      const certBadge = document.createElement('div');
      if (agency.certificationBadge.type === 'egyptian') {
        certBadge.className = 'agency-badge-egyptian';
        certBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ' + agency.certificationBadge.label;
      } else if (agency.certificationBadge.type === 'international') {
        certBadge.className = 'agency-badge-international';
        certBadge.innerHTML = '<div class="badge-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> ' + agency.certificationBadge.label + '</div><span class="badge-subtitle">' + agency.certificationBadge.subtitle + '</span>';
      }
      bodyDiv.appendChild(certBadge);
    }
    
    const nameHeading = document.createElement('h3');
    nameHeading.style.cssText = 'margin: 0 0 8px 0; font-size: 18px; color: #fff;';
    nameHeading.textContent = agency.companyName || '';
    bodyDiv.appendChild(nameHeading);

    const businessTypes = Array.isArray(agency.businessType) ? agency.businessType : 
      (agency.businessType ? agency.businessType.split(',').map(t => t.trim()) : []);
    if (businessTypes.length > 0) {
      const typeBadgesDiv = document.createElement('div');
      typeBadgesDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;';
      businessTypes.forEach(type => {
        const badge = document.createElement('span');
        badge.className = 'business-type-badge';
        const typeLower = type.toLowerCase();
        if (typeLower.includes('dmc')) {
          badge.classList.add('badge-dmc');
          badge.textContent = 'DMC';
        } else if (typeLower.includes('tour operator')) {
          badge.classList.add('badge-tour-operator');
          badge.textContent = 'Tour Operator';
        } else if (typeLower.includes('travel agency')) {
          badge.classList.add('badge-travel-agency');
          badge.textContent = 'Travel Agency';
        } else {
          badge.classList.add('badge-travel-agency');
          badge.textContent = type;
        }
        typeBadgesDiv.appendChild(badge);
      });
      bodyDiv.appendChild(typeBadgesDiv);
    }
    
    const metaDiv = document.createElement('div');
    metaDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: #aaa; margin-bottom: 12px;';
    
    const locationSpan = document.createElement('span');
    locationSpan.innerHTML = `<span style="opacity:0.7">📍</span> ${agency.location || 'Egypt'}`;
    metaDiv.appendChild(locationSpan);
    
    if (agency.yearsInBusiness) {
      const yearsSpan = document.createElement('span');
      yearsSpan.innerHTML = `<span style="opacity:0.7">🏢</span> ${agency.yearsInBusiness}+ years`;
      metaDiv.appendChild(yearsSpan);
    }
    bodyDiv.appendChild(metaDiv);

    const egyptDests = (agency.egyptDestinations && agency.egyptDestinations.length > 0) 
      ? agency.egyptDestinations 
      : (agency.operatingAreas || []);
    if (egyptDests.length > 0) {
      const destLabel = document.createElement('div');
      destLabel.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
      destLabel.textContent = 'Top Destinations';
      bodyDiv.appendChild(destLabel);
      
      const destDiv = document.createElement('div');
      destDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;';
      egyptDests.slice(0, 3).forEach(dest => {
        const tag = document.createElement('span');
        tag.style.cssText = 'background: rgba(14, 165, 233, 0.15); color: #0ea5e9; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
        tag.textContent = dest;
        destDiv.appendChild(tag);
      });
      if (egyptDests.length > 3) {
        const moreTag = document.createElement('span');
        moreTag.style.cssText = 'background: rgba(255,255,255,0.1); color: #888; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
        moreTag.textContent = `+${egyptDests.length - 3} more`;
        destDiv.appendChild(moreTag);
      }
      bodyDiv.appendChild(destDiv);
    }

    const products = (agency.productsOffered && agency.productsOffered.length > 0) 
      ? agency.productsOffered 
      : (agency.services || []);
    if (products.length > 0) {
      const prodLabel = document.createElement('div');
      prodLabel.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
      prodLabel.textContent = 'Top Services';
      bodyDiv.appendChild(prodLabel);
      
      const prodDiv = document.createElement('div');
      prodDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;';
      products.slice(0, 3).forEach(prod => {
        const tag = document.createElement('span');
        tag.style.cssText = 'background: rgba(39, 174, 96, 0.15); color: #27ae60; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
        tag.textContent = truncate(prod, 22);
        prodDiv.appendChild(tag);
      });
      if (products.length > 3) {
        const moreTag = document.createElement('span');
        moreTag.style.cssText = 'background: rgba(255,255,255,0.1); color: #888; padding: 3px 8px; border-radius: 12px; font-size: 11px;';
        moreTag.textContent = `+${products.length - 3} more`;
        prodDiv.appendChild(moreTag);
      }
      bodyDiv.appendChild(prodDiv);
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    actionsDiv.style.cssText = 'padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1);';
    
    const profileLink = document.createElement('a');
    profileLink.className = 'btn primary';
    profileLink.style.cssText = 'width: 100%; text-align: center;';
    profileLink.href = `/agency/${agency.slug || ''}`;
    profileLink.textContent = 'View Profile';
    actionsDiv.appendChild(profileLink);
    
    card.appendChild(thumbDiv);
    card.appendChild(bodyDiv);
    card.appendChild(actionsDiv);

    return card;
  }

  function truncate(text, length) {
    if (!text) return '';
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
