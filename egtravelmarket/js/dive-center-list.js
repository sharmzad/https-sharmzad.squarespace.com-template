document.addEventListener('DOMContentLoaded', async function() {
  const container = document.querySelector('.grid, #dive-centers-grid');
  
  if (!container) {
    console.error('Grid container not found');
    return;
  }

  let allDiveCenters = [];
  let currentOffset = 0;
  let hasMore = false;
  let totalCenters = 0;
  const PAGE_SIZE = 12;
  let isLoading = false;
  let isFiltered = false;

  const nameFilter = document.getElementById('name-filter');
  const advancedFiltersBtn = document.getElementById('advanced-filters-btn');
  const advancedFiltersPanel = document.getElementById('advanced-filters-panel');
  const filterCountBadge = document.getElementById('filter-count-badge');
  const clearAllFiltersBtn = document.getElementById('clear-all-filters');
  
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  const filterState = {
    name: '',
    base: '',
    verification: '',
    businessType: [],
    locations: [],
    services: [],
    certifications: [],
    divingLevels: [],
    languages: [],
    pricing: ''
  };

  async function fetchDiveCenters(offset = 0, limit = PAGE_SIZE) {
    const response = await fetch(`/api/dive-centers/list?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error('Failed to load dive centers');
    }
    return response.json();
  }

  async function fetchAllDiveCenters() {
    const response = await fetch(`/api/dive-centers/list?limit=500&offset=0`);
    if (!response.ok) {
      throw new Error('Failed to load dive centers');
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
        loadMoreBtn.textContent = 'Load More Dive Centers';
      }
    }
  }

  function hasActiveFilters() {
    return !!(
      filterState.name ||
      filterState.base ||
      filterState.verification ||
      filterState.businessType.length > 0 ||
      filterState.locations.length > 0 ||
      filterState.services.length > 0 ||
      filterState.certifications.length > 0 ||
      filterState.divingLevels.length > 0 ||
      filterState.languages.length > 0 ||
      filterState.pricing
    );
  }

  function countActiveFilters() {
    let count = 0;
    if (filterState.base) count++;
    if (filterState.verification) count++;
    count += filterState.businessType.length;
    count += filterState.locations.length;
    count += filterState.services.length;
    count += filterState.certifications.length;
    count += filterState.divingLevels.length;
    count += filterState.languages.length;
    if (filterState.pricing) count++;
    return count;
  }

  function updateFilterBadge() {
    const count = countActiveFilters();
    if (count > 0) {
      filterCountBadge.textContent = count;
      filterCountBadge.style.display = 'inline-block';
    } else {
      filterCountBadge.style.display = 'none';
    }
  }

  function setupAdvancedFilters() {
    if (advancedFiltersBtn) {
      advancedFiltersBtn.addEventListener('click', function() {
        const isVisible = advancedFiltersPanel.style.display !== 'none';
        advancedFiltersPanel.style.display = isVisible ? 'none' : 'block';
      });
    }

    document.querySelectorAll('.filter-section-header').forEach(header => {
      header.addEventListener('click', function() {
        const section = this.closest('.filter-section');
        const content = section.querySelector('.filter-section-content');
        const chevron = this.querySelector('.chevron');
        
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
      });
    });

    document.querySelectorAll('input[name="base"]').forEach(input => {
      input.addEventListener('change', function() {
        filterState.base = this.value;
        updateFilterBadge();
        applyFilters();
      });
    });

    document.querySelectorAll('input[name="verification"]').forEach(input => {
      input.addEventListener('change', function() {
        filterState.verification = this.value;
        updateFilterBadge();
        applyFilters();
      });
    });

    document.querySelectorAll('input[name="pricing"]').forEach(input => {
      input.addEventListener('change', function() {
        filterState.pricing = this.value;
        updateFilterBadge();
        applyFilters();
      });
    });

    ['businessType', 'locations', 'services', 'certifications', 'divingLevels', 'languages'].forEach(filterName => {
      document.querySelectorAll(`input[name="${filterName}"]`).forEach(input => {
        input.addEventListener('change', function() {
          if (this.checked) {
            if (!filterState[filterName].includes(this.value)) {
              filterState[filterName].push(this.value);
            }
          } else {
            filterState[filterName] = filterState[filterName].filter(v => v !== this.value);
          }
          updateFilterBadge();
          applyFilters();
        });
      });
    });

    if (clearAllFiltersBtn) {
      clearAllFiltersBtn.addEventListener('click', function() {
        filterState.name = '';
        filterState.base = '';
        filterState.verification = '';
        filterState.businessType = [];
        filterState.locations = [];
        filterState.services = [];
        filterState.certifications = [];
        filterState.divingLevels = [];
        filterState.languages = [];
        filterState.pricing = '';

        if (nameFilter) nameFilter.value = '';
        
        document.querySelectorAll('input[name="base"][value=""]').forEach(r => r.checked = true);
        document.querySelectorAll('input[name="verification"][value=""]').forEach(r => r.checked = true);
        document.querySelectorAll('input[name="pricing"][value=""]').forEach(r => r.checked = true);
        
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

        updateFilterBadge();
        applyFilters();
      });
    }
  }

  try {
    const data = await fetchDiveCenters(0, PAGE_SIZE);
    allDiveCenters = data.diveCenters;
    hasMore = data.hasMore;
    totalCenters = data.total;
    currentOffset = data.diveCenters.length;

    renderDiveCenters(allDiveCenters);
    setupFilters();
    setupAdvancedFilters();
    
    if (hasMore) {
      showLoadMore();
    }

  } catch (error) {
    console.error('Error loading dive centers:', error);
    showError();
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function() {
      if (isLoading || isFiltered) return;
      
      setLoadingState(true);
      
      try {
        const data = await fetchDiveCenters(currentOffset, PAGE_SIZE);
        
        allDiveCenters = [...allDiveCenters, ...data.diveCenters];
        currentOffset += data.diveCenters.length;
        hasMore = data.hasMore;
        
        renderDiveCenters(applyFilterLogic(allDiveCenters));
        
        if (!hasMore) {
          hideLoadMore();
        }
      } catch (error) {
        console.error('Error loading more dive centers:', error);
      } finally {
        setLoadingState(false);
      }
    });
  }

  function setupFilters() {
    if (nameFilter) {
      nameFilter.addEventListener('input', debounce(function() {
        filterState.name = this.value.toLowerCase().trim();
        applyFilters();
      }, 300));
    }
  }

  async function applyFilters() {
    const filtersActive = hasActiveFilters();
    
    if (filtersActive && !isFiltered) {
      isFiltered = true;
      showSkeletons(6);
      
      try {
        const data = await fetchAllDiveCenters();
        allDiveCenters = data.diveCenters;
        hasMore = false;
        hideLoadMore();
      } catch (error) {
        console.error('Error fetching all dive centers for filtering:', error);
      }
    } else if (!filtersActive && isFiltered) {
      isFiltered = false;
      showSkeletons(6);
      
      try {
        const data = await fetchDiveCenters(0, PAGE_SIZE);
        allDiveCenters = data.diveCenters;
        hasMore = data.hasMore;
        totalCenters = data.total;
        currentOffset = data.diveCenters.length;
        
        if (hasMore) {
          showLoadMore();
        }
      } catch (error) {
        console.error('Error resetting to paginated view:', error);
      }
    }

    const filtered = applyFilterLogic(allDiveCenters);
    renderDiveCenters(filtered);
  }

  function applyFilterLogic(centers) {
    return centers.filter(center => {
      if (filterState.name) {
        const name = (center.centerName || '').toLowerCase();
        if (!name.includes(filterState.name)) return false;
      }

      if (filterState.base === 'egypt' && center.isInternational) return false;
      if (filterState.base === 'international' && !center.isInternational) return false;

      if (filterState.verification === 'verified' && !center.isVerified) return false;

      if (filterState.businessType.length > 0) {
        const centerBizTypes = center.businessTypes || [];
        const hasAllBizTypes = filterState.businessType.every(bt => 
          centerBizTypes.some(cbt => cbt.toLowerCase().includes(bt.toLowerCase()))
        );
        if (!hasAllBizTypes) return false;
      }

      if (filterState.locations.length > 0) {
        const centerLocation = (center.location || '').toLowerCase();
        const centerDiveSites = (center.diveSites || []).map(s => s.toLowerCase());
        const allLocations = [centerLocation, ...centerDiveSites].join(' ');
        const hasAllLocations = filterState.locations.every(loc => {
          const locLower = loc.toLowerCase();
          return allLocations.includes(locLower);
        });
        if (!hasAllLocations) return false;
      }

      if (filterState.services.length > 0) {
        const centerServices = (center.services || []).map(s => s.toLowerCase());
        const hasAllServices = filterState.services.every(svc => 
          centerServices.some(cs => cs.toLowerCase().includes(svc.toLowerCase()))
        );
        if (!hasAllServices) return false;
      }

      if (filterState.certifications.length > 0) {
        const centerCerts = (center.certifications || []).map(c => c.toLowerCase());
        const hasAllCerts = filterState.certifications.every(cert => {
          const certLower = cert.toLowerCase();
          if (certLower === 'other') {
            return centerCerts.some(cc => !['padi', 'ssi', 'cmas', 'naui', 'raid', 'tdi', 'sdi'].includes(cc));
          }
          if (certLower === 'tdi') {
            return centerCerts.includes('tdi') || centerCerts.includes('sdi');
          }
          return centerCerts.includes(certLower);
        });
        if (!hasAllCerts) return false;
      }

      if (filterState.divingLevels.length > 0) {
        const centerLevels = (center.divingLevels || []).map(l => l.toLowerCase());
        const hasAllLevels = filterState.divingLevels.every(level => {
          const levelLower = level.toLowerCase();
          return centerLevels.some(cl => cl.includes(levelLower));
        });
        if (!hasAllLevels) return false;
      }

      if (filterState.languages.length > 0) {
        const centerLangs = (center.languagesList || []).map(l => l.toLowerCase());
        const hasAllLangs = filterState.languages.every(lang => 
          centerLangs.includes(lang.toLowerCase())
        );
        if (!hasAllLangs) return false;
      }

      if (filterState.pricing) {
        const centerPricing = (center.pricingLevels || []).map(p => p.toLowerCase());
        if (!centerPricing.includes(filterState.pricing.toLowerCase())) return false;
      }

      return true;
    });
  }

  function renderDiveCenters(diveCenters) {
    container.innerHTML = '';

    if (diveCenters.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
      
      const heading = document.createElement('h3');
      heading.textContent = allDiveCenters.length > 0 ? 'No matches found' : 'No dive centers found yet';
      
      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'color: #666; margin: 15px 0;';
      paragraph.textContent = allDiveCenters.length > 0 
        ? 'Try adjusting your filters' 
        : 'Be the first to join our platform!';
      
      emptyDiv.appendChild(heading);
      emptyDiv.appendChild(paragraph);

      if (allDiveCenters.length === 0) {
        const link = document.createElement('a');
        link.href = '/divecenter-signup.html';
        link.className = 'btn primary';
        link.textContent = 'Join as Dive Center';
        emptyDiv.appendChild(link);
      }

      container.appendChild(emptyDiv);
      hideLoadMore();
      return;
    }

    diveCenters.forEach(center => {
      const card = createDiveCenterCard(center);
      container.appendChild(card);
    });
  }

  function showError() {
    container.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Error loading dive centers';
    
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'color: #666;';
    paragraph.textContent = 'Please try again later.';
    
    errorDiv.appendChild(heading);
    errorDiv.appendChild(paragraph);
    container.appendChild(errorDiv);
    hideLoadMore();
  }

  function createDiveCenterCard(center) {
    const card = document.createElement('article');
    card.className = 'card dive-center-card';
    card.style.minHeight = '420px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const defaultLogo = '/attached_assets/guides-divers.webp';
    const logoUrl = center.logoUrl || defaultLogo;
    
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';
    thumbDiv.style.cssText = 'position: relative; height: 140px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%); border-bottom: 1px solid rgba(255,255,255,0.08);';
    
    const logoContainer = document.createElement('div');
    logoContainer.style.cssText = 'width: 90px; height: 90px; border-radius: 14px; overflow: hidden; border: 3px solid #06b6d4; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3); background: #1a3a5c;';
    
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = center.centerName || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; object-position: top center;';
    img.onerror = function() { this.src = defaultLogo; };
    logoContainer.appendChild(img);
    thumbDiv.appendChild(logoContainer);
    
    const badgesContainer = document.createElement('div');
    badgesContainer.style.cssText = 'position: absolute; top: 8px; left: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px;';
    
    if (center.isVerified) {
      const verifiedBadge = document.createElement('span');
      verifiedBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 5px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4); width: fit-content;';
      verifiedBadge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified';
      badgesContainer.appendChild(verifiedBadge);
    }
    
    if (center.isCertified) {
      const certifiedBadge = document.createElement('span');
      certifiedBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 5px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4); width: fit-content;';
      certifiedBadge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Certified';
      badgesContainer.appendChild(certifiedBadge);
    }
    
    const secondaryRow = document.createElement('div');
    secondaryRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
    
    const locBadge = document.createElement('span');
    if (center.isInternational) {
      locBadge.style.cssText = 'background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;';
      locBadge.textContent = 'International';
    } else {
      locBadge.style.cssText = 'background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;';
      locBadge.textContent = 'Egypt-based';
    }
    secondaryRow.appendChild(locBadge);
    
    const businessTypes = center.businessTypes || [];
    let bizBadgeCount = 0;
    for (const bizType of businessTypes) {
      if (bizType === 'International Dive Center') continue;
      if (bizBadgeCount >= 1) break;
      const bizBadge = document.createElement('span');
      bizBadge.style.cssText = 'background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;';
      bizBadge.textContent = bizType;
      secondaryRow.appendChild(bizBadge);
      bizBadgeCount++;
    }
    
    badgesContainer.appendChild(secondaryRow);
    thumbDiv.appendChild(badgesContainer);
    
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'body';
    bodyDiv.style.cssText = 'flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 10px;';
    
    const nameHeading = document.createElement('h3');
    nameHeading.textContent = center.centerName || '';
    nameHeading.style.cssText = 'margin: 0; font-size: 17px; color: #fff; line-height: 1.3;';
    bodyDiv.appendChild(nameHeading);
    
    const metaDiv = document.createElement('div');
    metaDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 12px; color: #94a3b8; font-size: 13px;';
    
    const locationSpan = document.createElement('span');
    locationSpan.textContent = center.location || 'Egypt';
    metaDiv.appendChild(locationSpan);
    
    if (center.yearsInBusiness) {
      const yearsSpan = document.createElement('span');
      yearsSpan.textContent = `${center.yearsInBusiness}+ yrs`;
      metaDiv.appendChild(yearsSpan);
    }
    bodyDiv.appendChild(metaDiv);

    if (center.certifications && center.certifications.length > 0) {
      const certsDiv = document.createElement('div');
      certsDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';
      
      const certColors = {
        'PADI': '#0066cc',
        'SSI': '#00a0e3',
        'CMAS': '#27ae60',
        'NAUI': '#f39c12',
        'TDI': '#e74c3c',
        'SDI': '#e74c3c'
      };
      
      center.certifications.slice(0, 3).forEach(cert => {
        const tag = document.createElement('span');
        const certColor = certColors[cert] || '#06b6d4';
        tag.style.cssText = `background: ${certColor}; color: white; padding: 4px 10px; border-radius: 10px; font-size: 11px; font-weight: 600;`;
        tag.textContent = cert;
        certsDiv.appendChild(tag);
      });
      
      if (center.certifications.length > 3) {
        const moreTag = document.createElement('span');
        moreTag.style.cssText = 'background: rgba(255,255,255,0.1); color: #94a3b8; padding: 4px 10px; border-radius: 10px; font-size: 11px;';
        moreTag.textContent = `+${center.certifications.length - 3}`;
        certsDiv.appendChild(moreTag);
      }
      bodyDiv.appendChild(certsDiv);
    }

    if (center.services && center.services.length > 0) {
      const servicesDiv = document.createElement('div');
      servicesDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto;';
      
      center.services.slice(0, 2).forEach(service => {
        const tag = document.createElement('span');
        tag.style.cssText = 'background: rgba(6, 182, 212, 0.12); color: #06b6d4; padding: 4px 10px; border-radius: 10px; font-size: 11px; font-weight: 500;';
        tag.textContent = service;
        servicesDiv.appendChild(tag);
      });
      bodyDiv.appendChild(servicesDiv);
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    actionsDiv.style.cssText = 'padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;';
    
    const profileLink = document.createElement('a');
    profileLink.className = 'btn primary';
    profileLink.href = `/dive-center/${center.slug || ''}`;
    profileLink.style.cssText = 'display: block; text-align: center; background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 10px 16px; border-radius: 8px; font-weight: 600; color: white; text-decoration: none;';
    profileLink.textContent = 'View Profile';
    actionsDiv.appendChild(profileLink);

    const ctaRow = document.createElement('div');
    ctaRow.style.cssText = 'display: flex; gap: 8px;';

    if (center.whatsapp) {
      const whatsappBtn = document.createElement('a');
      const cleanNumber = center.whatsapp.replace(/[^0-9]/g, '');
      whatsappBtn.href = `https://wa.me/${cleanNumber}`;
      whatsappBtn.target = '_blank';
      whatsappBtn.rel = 'noopener noreferrer';
      whatsappBtn.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3); padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; text-decoration: none;';
      whatsappBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp';
      ctaRow.appendChild(whatsappBtn);
    }

    const requestBtn = document.createElement('a');
    requestBtn.href = `/dive-center/${center.slug || ''}#request`;
    requestBtn.style.cssText = `flex: ${center.whatsapp ? '1' : '1'}; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; text-decoration: none;`;
    requestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Request';
    ctaRow.appendChild(requestBtn);

    actionsDiv.appendChild(ctaRow);
    
    card.appendChild(thumbDiv);
    card.appendChild(bodyDiv);
    card.appendChild(actionsDiv);

    return card;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});
