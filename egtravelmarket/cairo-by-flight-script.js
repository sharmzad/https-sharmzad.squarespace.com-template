function $(sel) {
  return document.querySelector(sel);
}

// Calendar date picker initialized - no date loading needed

function updateSubtotal() {
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  const priceAdult = 290;
  const priceChild = 275;
  const total = (adults * priceAdult) + (children * priceChild);
  
  const subtotalEl = $('#subtotal');
  if (subtotalEl) {
    subtotalEl.textContent = `$${total}`;
  }
}

function updateCairoSummary() {
  const date = $('#date').value;
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const hotel = $('#hotel').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  const infants = +$('#infants').value || 0;
  
  if (!date || !name || !email || adults === 0) {
    const summaryArea = $('#summaryArea');
    if (summaryArea) summaryArea.innerHTML = '';
    return;
  }
  
  const priceAdult = 290;
  const priceChild = 275;
  const total = (adults * priceAdult) + (children * priceChild);
  
  const summaryArea = $('#summaryArea');
  if (!summaryArea) return;
  
  summaryArea.innerHTML = '';
  
  const container = document.createElement('div');
  container.style.cssText = 'margin-top:15px;padding:15px;background:#f1f5ff;border:1px solid #bfdbfe;border-radius:10px;color:#1d2f4f;';
  
  const addText = (text, bold = false, styles = '') => {
    const el = bold ? document.createElement('strong') : document.createElement('span');
    el.textContent = text;
    if (styles) el.style.cssText = styles;
    container.appendChild(el);
  };
  
  const addBreak = () => container.appendChild(document.createElement('br'));
  
  addText('📋 Booking Summary', true, 'font-size:1.1rem;color:#1e3a8a;');
  addBreak(); addBreak();
  
  addText('Tour: ', true);
  addText('Cairo Day Trip from Sharm El-Sheikh');
  addBreak();
  
  addText('Date: ', true);
  addText(new Date(date).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}));
  addBreak(); addBreak();
  
  addText('Guest: ', true);
  addText(name);
  addBreak();
  
  addText('Email: ', true);
  addText(email);
  addBreak();
  
  if (phone) {
    addText('Phone: ', true);
    addText(phone);
    addBreak();
  }
  
  if (hotel) {
    addText('Hotel: ', true);
    addText(hotel);
    addBreak();
  }
  
  addBreak();
  addText('Passengers:', true);
  addBreak();
  
  addText(`• Adults: ${adults} × $${priceAdult} = $${adults * priceAdult}`);
  addBreak();
  
  if (children > 0) {
    addText(`• Children: ${children} × $${priceChild} = $${children * priceChild}`);
    addBreak();
  }
  
  if (infants > 0) {
    addText(`• Infants: ${infants} (FREE)`);
    addBreak();
  }
  
  addBreak();
  addText(`Total: $${total}`, true, 'font-size:1.15rem;color:#0f172a;');
  addBreak(); addBreak();
  
  const payBtn = document.createElement('button');
  payBtn.type = 'button';
  payBtn.textContent = '💳 Pay Now with Stripe';
  payBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;transition:opacity 0.2s;';
  payBtn.addEventListener('mouseenter', () => payBtn.style.opacity = '0.9');
  payBtn.addEventListener('mouseleave', () => payBtn.style.opacity = '1');
  payBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('💳 Stripe payment button clicked for Cairo tour!');
    await processCairoPayment(e);
  });
  container.appendChild(payBtn);
  
  summaryArea.appendChild(container);
}

async function processCairoPayment(event) {
  const date = $('#date').value;
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const hotel = $('#hotel').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  const infants = +$('#infants').value || 0;
  
  if (!date || !name || !email || adults === 0) {
    alert('Please fill in all required fields (date, name, email, and at least 1 adult)');
    return;
  }
  
  const priceAdult = 290;
  const priceChild = 275;
  const totalPrice = (adults * priceAdult) + (children * priceChild);
  
  let specialRequests = '';
  if (hotel) specialRequests += `Hotel: ${hotel}\n`;
  if (infants > 0) specialRequests += `Infants: ${infants} (FREE)\n`;
  
  var ids = resolveTripId(4);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Cairo by Flight",
    packageType: "cairo_by_flight",
    guestName: name,
    guestEmail: email,
    guestPhone: phone || null,
    guestCountry: null,
    adults: adults,
    children: children,
    pickupLocation: hotel || "TBD",
    specialRequests: specialRequests.trim(),
    totalAmount: totalPrice,
    currency: "USD",
    bookingDate: date
  };
  
  try {
    const payBtn = event.target;
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";
    payBtn.style.cursor = "wait";
    
    console.log('📤 Sending booking data to API:', bookingData);
    
    const response = await fetch("/api/bookings/with-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create booking");
    }
    
    const data = await response.json();
    console.log('✅ Booking created successfully:', data);
    
    if (data.checkout_url) {
      console.log('🔄 Redirecting to Stripe checkout...');
      window.location.href = data.checkout_url;
    } else {
      throw new Error("No checkout URL received");
    }
    
  } catch (error) {
    console.error("❌ Payment error:", error);
    alert("Payment failed: " + error.message);
    const payBtn = event.target;
    payBtn.disabled = false;
    payBtn.textContent = "💳 Pay Now with Stripe";
    payBtn.style.cursor = "pointer";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Calendar picker ready - no date loading needed
  
  const adultsInput = $('#adults');
  const childrenInput = $('#children');
  const infantsInput = $('#infants');
  const dateInput = $('#date');
  const nameInput = $('#name');
  const emailInput = $('#email');
  const phoneInput = $('#phone');
  const hotelInput = $('#hotel');
  
  if (adultsInput) adultsInput.addEventListener('change', () => { updateSubtotal(); updateCairoSummary(); });
  if (childrenInput) childrenInput.addEventListener('change', () => { updateSubtotal(); updateCairoSummary(); });
  if (infantsInput) infantsInput.addEventListener('change', updateCairoSummary);
  if (dateInput) dateInput.addEventListener('change', updateCairoSummary);
  if (nameInput) nameInput.addEventListener('input', updateCairoSummary);
  if (emailInput) emailInput.addEventListener('input', updateCairoSummary);
  if (phoneInput) phoneInput.addEventListener('input', updateCairoSummary);
  if (hotelInput) hotelInput.addEventListener('input', updateCairoSummary);
  
  const bookBtn = $('#bookBtn');
  if (bookBtn) {
    bookBtn.style.display = 'none';
  }
});
