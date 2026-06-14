function $(sel) {
  return document.querySelector(sel);
}

// Calendar date picker initialized - no date loading needed

function updateSubtotal() {
  const adults = +$('#adults').value || 0;
  const priceAdult = 15;
  const total = adults * priceAdult;
  
  const subtotalEl = $('#subtotal');
  if (subtotalEl) {
    subtotalEl.textContent = `$${total}`;
  }
}

function updateGoodbyeSharmSummary() {
  const date = $('#date').value;
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const hotel = $('#hotel').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  
  if (!date || !name || !email || adults === 0) {
    const summaryArea = $('#summaryArea');
    if (summaryArea) summaryArea.innerHTML = '';
    return;
  }
  
  const priceAdult = 15;
  const total = adults * priceAdult;
  
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
  addText('Goodbye Sharm Trip – City Experience');
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
    addText(`• Children (under 14): ${children} × FREE = $0`);
    addBreak();
  }
  
  addBreak();
  addText(`Total: $${total}`, true, 'font-size:1.15rem;color:#0f172a;');
  addBreak();
  addText('Time: 14:00 – 20:00 (back in time for dinner)', false, 'font-size:0.9rem;color:#666;');
  addBreak(); addBreak();
  
  const payBtn = document.createElement('button');
  payBtn.type = 'button';
  payBtn.textContent = '💳 Pay Now with Stripe';
  payBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;transition:opacity 0.2s;';
  payBtn.addEventListener('mouseenter', () => payBtn.style.opacity = '0.9');
  payBtn.addEventListener('mouseleave', () => payBtn.style.opacity = '1');
  payBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await processGoodbyeSharmPayment(e);
  });
  container.appendChild(payBtn);
  
  summaryArea.appendChild(container);
}

async function processGoodbyeSharmPayment(event) {
  const date = $('#date').value;
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const hotel = $('#hotel').value.trim();
  const room = $('#room').value.trim();
  const adults = +$('#adults').value || 0;
  const children = +$('#children').value || 0;
  const notes = $('#notes').value.trim();
  
  if (!date || !name || !email || adults === 0) {
    alert('Please fill in all required fields (date, name, email, and at least 1 adult)');
    return;
  }
  
  const priceAdult = 15;
  const totalPrice = adults * priceAdult;
  
  let specialRequests = '';
  if (hotel) specialRequests += `Hotel: ${hotel}\n`;
  if (room) specialRequests += `Room: ${room}\n`;
  if (children > 0) specialRequests += `Children (under 14): ${children} (FREE)\n`;
  if (notes) specialRequests += `Notes: ${notes}\n`;
  specialRequests += 'Time: 14:00 – 20:00';
  
  var ids = resolveTripId(2);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Goodbye Sharm – Last Day Program",
    packageType: "goodbye_sharm",
    guestName: name,
    guestEmail: email,
    guestPhone: null,
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
  // Calendar picker ready - no date loading needed
  
  const adultsInput = $('#adults');
  const childrenInput = $('#children');
  const dateInput = $('#date');
  const nameInput = $('#name');
  const emailInput = $('#email');
  const hotelInput = $('#hotel');
  const roomInput = $('#room');
  
  if (adultsInput) adultsInput.addEventListener('change', () => { updateSubtotal(); updateGoodbyeSharmSummary(); });
  if (childrenInput) childrenInput.addEventListener('change', () => { updateSubtotal(); updateGoodbyeSharmSummary(); });
  if (dateInput) dateInput.addEventListener('change', updateGoodbyeSharmSummary);
  if (nameInput) nameInput.addEventListener('input', updateGoodbyeSharmSummary);
  if (emailInput) emailInput.addEventListener('input', updateGoodbyeSharmSummary);
  if (hotelInput) hotelInput.addEventListener('input', updateGoodbyeSharmSummary);
  if (roomInput) roomInput.addEventListener('input', updateGoodbyeSharmSummary);
});
