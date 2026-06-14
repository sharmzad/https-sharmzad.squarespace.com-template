// ==========================
// Load Flash Offers from API
// ==========================
(async function loadFlashOffers() {
  try {
    // Try to load from API first, fallback to JSON
    let response = await fetch('/api/flash-offers');
    let data = await response.json();
    let offers = data.offers || [];
    
    // Fallback to JSON file if API fails or returns empty
    if (!offers || offers.length === 0) {
      console.log('No offers from API, trying JSON...');
      response = await fetch('flash-offers.json');
      offers = await response.json();
    }
    
    const track = document.querySelector('.flash-track');
    if (!track) return;

    track.innerHTML = '';

    offers.forEach(o => {
      const card = document.createElement('article');
      card.className = 'flash-card';
      
      // Safe DOM manipulation - no innerHTML with external data
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = o.badge || 'Flash Offer';
      
      const title = document.createElement('h3');
      title.textContent = o.title;
      
      // Make description section prominent
      const desc = document.createElement('div');
      desc.className = 'desc-section';
      
      const descText = document.createElement('p');
      descText.className = 'desc-text';
      descText.textContent = o.desc || 'Special limited-time offer. Act fast before it expires!';
      desc.appendChild(descText);
      
      // Add discount badge if available
      if (o.discount_percentage && o.discount_percentage > 0) {
        const discountBadge = document.createElement('span');
        discountBadge.className = 'discount-badge';
        discountBadge.textContent = `Save ${o.discount_percentage}%`;
        desc.appendChild(discountBadge);
      }
      
      const countdown = document.createElement('div');
      countdown.className = 'countdown';
      countdown.setAttribute('data-deadline', o.deadline);
      countdown.textContent = 'Ends in —';
      
      const actions = document.createElement('div');
      actions.className = 'actions';
      
      // Sanitize URLs - prevent javascript: protocol attacks
      const sanitizeUrl = (url) => {
        if (!url || typeof url !== 'string') return '#';
        const trimmed = url.trim().toLowerCase();
        if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return '#';
        return url;
      };
      
      const btnLink = document.createElement('a');
      btnLink.href = sanitizeUrl(o.link);
      btnLink.className = 'btn btn-book';
      btnLink.textContent = '🎯 Book Now';
      
      const detailsLink = document.createElement('a');
      detailsLink.href = sanitizeUrl(o.link);
      detailsLink.className = 'link-more';
      detailsLink.textContent = 'Learn More →';
      
      actions.appendChild(btnLink);
      actions.appendChild(detailsLink);
      
      card.appendChild(badge);
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(countdown);
      card.appendChild(actions);
      
      track.appendChild(card);
    });

    initCountdowns();
    initSlider(track);
    markFlashBadges(offers);

  } catch (err) {
    console.error('Could not load flash-offers.json', err);
  }
})();

// ==========================
// Countdown
// ==========================
function initCountdowns() {
  const els = Array.from(document.querySelectorAll('.countdown[data-deadline]'));
  function two(n){return n<10?'0'+n:n;}

  function tick(){
    const now = new Date().getTime();
    els.forEach(el=>{
      const end = new Date(el.dataset.deadline).getTime();
      const diff = end - now;
      if(isNaN(end)){el.textContent='—';return;}
      if(diff<=0){el.textContent='Offer ended';return;}
      const d=Math.floor(diff/86400000);
      const h=Math.floor((diff/3600000)%24);
      const m=Math.floor((diff/60000)%60);
      el.textContent=`Ends in ${two(d)}d ${two(h)}h ${two(m)}m`;
    });
  }
  tick();
  setInterval(tick,30000);
}

// ==========================
// Simple Auto Slider
// ==========================
function initSlider(track){
  if(!track || track.children.length<=1) return;
  const interval=6000;
  const cards=Array.from(track.children);
  let index=0;
  function next(){
    index=(index+1)%cards.length;
    // Smooth scroll only inside the flash slider (no page jump)
    track.scrollTo({
      left: cards[index].offsetLeft,
      behavior: 'smooth'
    });
  }
  let timer=setInterval(next,interval);
  track.addEventListener('pointerenter',()=>clearInterval(timer));
  track.addEventListener('pointerleave',()=>timer=setInterval(next,interval));
}

// ===== Responsive Cross-Fade Auto Slider =====
(function () {
  const track = document.querySelector('.flash-track[data-autoplay="true"]');
  if (!track) return;

  const cards = Array.from(track.children);
  if (cards.length <= 1) return;

  // Stack cards for fade
  track.style.position = 'relative';
  track.style.minHeight = '420px';
  cards.forEach((card, i) => {
    card.style.position = 'absolute';
    card.style.inset = 0;
    card.style.opacity = i === 0 ? '1' : '0';
    card.style.transition = 'opacity 1.5s ease';
    card.style.zIndex = i === 0 ? '2' : '1';
  });

  let index = 0;

  // Responsive interval: slower on desktop, faster on mobile
  function getInterval() {
    return window.innerWidth < 768 ? 8000 : 10000; // 8 s mobile, 10 s desktop
  }
  let interval = getInterval();

  function crossFade() {
    const current = cards[index];
    const next = cards[(index + 1) % cards.length];

    current.style.zIndex = '2';
    next.style.zIndex = '3';
    next.style.opacity = '1';

    setTimeout(() => {
      current.style.opacity = '0';
      current.style.zIndex = '1';
      next.style.zIndex = '2';
      index = (index + 1) % cards.length;
    }, 1500); // match transition duration
  }

  let timer = setInterval(crossFade, interval);

  // Pause on hover
  track.addEventListener('pointerenter', () => clearInterval(timer));
  track.addEventListener('pointerleave', () => (timer = setInterval(crossFade, interval)));

  // Re-calculate timing if window resized
  window.addEventListener('resize', () => {
    clearInterval(timer);
    interval = getInterval();
    timer = setInterval(crossFade, interval);
  });
})();

// ==========================
// Mark Flash Badges on other pages
// ==========================
function markFlashBadges(offers){
  if(!offers || !offers.length) return;
  const now=new Date().getTime();

  offers.forEach(o=>{
    const end=new Date(o.deadline).getTime();
    if(end>now){
      const linkEls=document.querySelectorAll(`a[href="${o.link}"], a[href*="${o.link}"]`);
      linkEls.forEach(a=>{
        // Skip footer links - only add badges to Discover menu
        if(a.closest('.site-footer') || a.closest('footer')) return;
        if(!a.closest('.flash-badge')){
          const badge=document.createElement('span');
          badge.className='flash-badge';
          badge.textContent='⚡ Flash Offer';
          a.insertAdjacentElement('beforebegin',badge);
        }
      });
    }
  });
}
