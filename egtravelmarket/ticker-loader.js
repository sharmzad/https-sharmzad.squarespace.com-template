// ==============================
// Dynamic Flash Sale Ticker
// ==============================

function initFlashTicker() {
  (async function loadFlashTicker() {
    try {
      // Wait for element to be available
      let inner = document.querySelector('.flash-sale__inner');
      if (!inner) {
        console.log('Ticker element not found, retrying...');
        setTimeout(initFlashTicker, 500);
        return;
      }
      
      // Fetch active flash offers from API
      const response = await fetch('/api/flash-offers');
      const data = await response.json();
      const offers = data.offers || [];
      
      console.log('Loaded offers from API:', offers.length);
      
      if (offers.length === 0) {
        console.log('No offers available');
        inner.innerHTML = '<span>No active deals right now</span>';
        return;
      }
      
      // Clear default content
      inner.innerHTML = '';
      
      // Create clickable links for each offer
      offers.forEach(offer => {
        const link = document.createElement('a');
        link.href = offer.link || '#';
        link.className = 'ticker-item';
        link.title = `${offer.title}: ${offer.description}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // Format: "Title - Badge | Save X%"
        const discount = offer.discount_percentage ? ` | Save ${offer.discount_percentage}%` : '';
        const text = `${offer.title} — ${offer.badge || 'SPECIAL'}${discount}`;
        
        link.textContent = text;
        inner.appendChild(link);
      });
      
      // Duplicate items for seamless scrolling
      const items = Array.from(inner.querySelectorAll('.ticker-item'));
      items.forEach(item => {
        inner.appendChild(item.cloneNode(true));
      });
      
      console.log('Flash ticker loaded with', offers.length, 'offers');
      
    } catch (err) {
      console.error('Error loading flash offers for ticker:', err);
    }
  })();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlashTicker);
} else {
  initFlashTicker();
}
