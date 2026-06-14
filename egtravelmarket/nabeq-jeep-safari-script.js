function $(sel) {
  return document.querySelector(sel);
}

async function loadNabeqDates() {
  try {
    const res = await fetch('/data/trip-availability.json');
    const data = await res.json();
    
    const dateSelect = $('#date');
    if (dateSelect) {
      dateSelect.outerHTML = '<select id="date" required></select>';
      const newDateSelect = $('#date');
      newDateSelect.innerHTML = '<option value="">Select a date</option>';
      
      const nabeqDates = data.nabeq_jeep_safari || [];
      nabeqDates.forEach(d => {
        if (d.seats_left > 0) {
          const dt = new Date(d.date);
          const opt = document.createElement('option');
          opt.value = d.date;
          opt.textContent = `${dt.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'})} — ${d.seats_left} seats left`;
          newDateSelect.appendChild(opt);
        }
      });
      
      if (newDateSelect.options.length === 1) {
        newDateSelect.innerHTML = '<option value="">No dates available</option>';
      }
    }
  } catch (err) {
    console.error('Error loading Nabeq dates:', err);
    const dateSelect = $('#date');
    if (dateSelect) {
      dateSelect.outerHTML = '<select id="date" required></select>';
      const newDateSelect = $('#date');
      newDateSelect.innerHTML = '<option value="">Error loading dates</option>';
    }
  }
}

function updateSubtotal() {
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  const priceAdult = 60;
  const priceChild = 40;
  const total = (adults * priceAdult) + (children * priceChild);
  
  const subtotalEl = $('#total-price');
  if (subtotalEl) {
    subtotalEl.textContent = `$${total}`;
  }
}

function updateNabeqSummary() {
  const date = $('#date').value;
  const name = $('#full-name').value.trim();
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const hotel = $('#hotel').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  
  if (!date || !name || !email || adults === 0) {
    const summaryArea = $('#summaryArea');
    if (summaryArea) summaryArea.innerHTML = '';
    return;
  }
  
  const priceAdult = 60;
  const priceChild = 40;
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
  addText('Nabeq National Park Jeep Safari Adventure');
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
    await processNabeqPayment(e);
  });
  container.appendChild(payBtn);
  
  summaryArea.appendChild(container);
}

async function processNabeqPayment(event) {
  const date = $('#date').value;
  const name = $('#full-name').value.trim();
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const hotel = $('#hotel').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  
  if (!date || !name || !email || adults === 0) {
    alert('Please fill in all required fields (date, name, email, and at least 1 adult)');
    return;
  }
  
  const priceAdult = 60;
  const priceChild = 40;
  const totalPrice = (adults * priceAdult) + (children * priceChild);
  
  let specialRequests = '';
  if (hotel) specialRequests += `Hotel: ${hotel}\n`;
  specialRequests += 'Available: Tuesday - Friday\nDuration: 7 Hours (08:00-15:00)';
  
  var ids = resolveTripId(14);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Nabeq National Park Jeep Safari",
    packageType: "nabeq_jeep_safari",
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
    
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error("No checkout URL received");
    }
    
  } catch (error) {
    console.error("Payment error:", error);
    alert("Payment failed: " + error.message);
    const payBtn = event.target;
    payBtn.disabled = false;
    payBtn.textContent = "💳 Pay Now with Stripe";
    payBtn.style.cursor = "pointer";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const adultsInput = $('#adults');
  const childrenInput = $('#children');
  const dateInput = $('#date');
  const nameInput = $('#full-name');
  const emailInput = $('#email');
  const phoneInput = $('#phone');
  const hotelInput = $('#hotel');
  
  if (adultsInput) adultsInput.addEventListener('change', () => { updateSubtotal(); updateNabeqSummary(); });
  if (childrenInput) childrenInput.addEventListener('change', () => { updateSubtotal(); updateNabeqSummary(); });
  if (dateInput) dateInput.addEventListener('change', updateNabeqSummary);
  if (nameInput) nameInput.addEventListener('input', updateNabeqSummary);
  if (emailInput) emailInput.addEventListener('input', updateNabeqSummary);
  if (phoneInput) phoneInput.addEventListener('input', updateNabeqSummary);
  if (hotelInput) hotelInput.addEventListener('input', updateNabeqSummary);
  
  const bookBtn = $('#bookBtn');
  if (bookBtn) {
    bookBtn.style.display = 'none';
  }
});
