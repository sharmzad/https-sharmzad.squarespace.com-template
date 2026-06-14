// EgyTravelMarket app.js
// Flash sale ticker + search filter + smooth scroll

document.addEventListener('DOMContentLoaded', () => {
  // Flash sale ticker content (placeholder offers)
  const offers = [
    "Flash Sale: Cairo by Flight — Save 15% today!",
    "Sharm Pirates Boat — Kids go half price",
    "Luxor by Flight — Early bird discount",
    "Free SIM (23GB) with Trip Card"
  ];
  const track = document.getElementById('tickerTrack');
  if (track) {
    for (let i=0;i<3;i++){ // repeat for long track
      offers.forEach(o => {
        const span = document.createElement('span');
        span.textContent = o;
        track.appendChild(span);
      });
    }
    let x = 0;
    const animate = () => {
      x -= 0.6;
      track.style.transform = `translateX(${x}px)`;
      if (Math.abs(x) > track.scrollWidth/3) x = 0;
      requestAnimationFrame(animate);
    };
    animate();
  }

  // Search filter (demo filters product cards by text)
  const input = document.getElementById('searchInput');
  const grid = document.querySelector('.product-grid');
  if (input && grid) {
    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.product-card').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // Smooth scroll for internal anchors
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({behavior:'smooth', block:'start'});
        }
      }
    });
  });
});

function openChat(){
  alert("Chat placeholder: your custom GPT / n8n chat will open here.");
}

// Make orbit chips clickable
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.orbit-chip');
  if (chip && chip.dataset.href) {
    const href = chip.dataset.href;
    if (href.startsWith('#')) {
      // same-page anchor
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = href;
    }
  }
});

// Popup logic for Access Code
function openAccessPopup() {
  document.getElementById("accessPopup").style.display = "block";
}
function closeAccessPopup() {
  document.getElementById("accessPopup").style.display = "none";
}

// Placeholder booking function
function openBookingForm(packageName) {
  alert(`Booking form will open for: ${packageName}`);
}

// Booking form submission (internal placeholder)
function submitBookingForm(event) {
  event.preventDefault();
  document.getElementById("bookingSuccessPopup").style.display = "block";
  return false;
}

function closeBookingPopup() {
  document.getElementById("bookingSuccessPopup").style.display = "none";
}

// ===== Hero Slider Logic =====
document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll("#hero-slider .slide");
  const next = document.querySelector(".next");
  const prev = document.querySelector(".prev");
  
  if (!slides.length) return;
  
  let currentSlide = 0;
  const totalSlides = slides.length;

  function showSlide(index) {
    slides.forEach(slide => slide.classList.remove("active"));
    const currentSlideEl = slides[index];
    
    // Lazy load background image if not already loaded
    if (currentSlideEl.dataset.bg && !currentSlideEl.dataset.loaded) {
      currentSlideEl.style.backgroundImage = `url('${currentSlideEl.dataset.bg}')`;
      currentSlideEl.dataset.loaded = 'true';
    }
    
    currentSlideEl.classList.add("active");
    
    // Preload next slide image
    const nextIndex = (index + 1) % totalSlides;
    const nextSlide = slides[nextIndex];
    if (nextSlide.dataset.bg && !nextSlide.dataset.loaded) {
      const img = new Image();
      img.src = nextSlide.dataset.bg;
      img.onload = () => {
        nextSlide.style.backgroundImage = `url('${nextSlide.dataset.bg}')`;
        nextSlide.dataset.loaded = 'true';
      };
    }
  }

  if (next) {
    next.addEventListener("click", () => {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    });
  }

  if (prev) {
    prev.addEventListener("click", () => {
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      showSlide(currentSlide);
    });
  }

  // Auto slide every 5 seconds
  setInterval(() => {
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
  }, 5000);
});

// ===== Make Popular Tours Cards Clickable =====
document.addEventListener('DOMContentLoaded', () => {
  const popularToursCards = document.querySelectorAll('#popular-tours .card');
  
  popularToursCards.forEach(card => {
    const button = card.querySelector('.btn');
    if (button) {
      const targetUrl = button.getAttribute('href');
      
      card.style.cursor = 'pointer';
      
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
          return;
        }
        
        if (targetUrl) {
          window.location.href = targetUrl;
        }
      });
      
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      });
    }
  });
});