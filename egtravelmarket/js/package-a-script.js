// Package A Booking Script
const $ = s => document.querySelector(s);

// Calendar picker initialized - dates selected manually by user
// No need to load available dates since HTML5 date input works natively

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  
  // Setup email validation
  const emailInput = $('#pkgA-email');
  const emailMessage = $('#pkgA-email-message');
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
  
  // Accordion toggle
  document.querySelectorAll('.acc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.acc-item');
      item.classList.toggle('open');
    });
  });
  
  // Open accordion by clicking the small trip pills
  document.querySelectorAll('button[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-open');
      const target = document.getElementById(targetId);
      if (!target) return;
      
      // close all others
      document.querySelectorAll('.acc-item').forEach(it => it.classList.remove('open'));
      
      // open the target
      target.classList.add('open');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

// Booking summary
let pkgASummaryVisible = false;

function updatePackageASummary() {
  const name = $('#pkgA-name').value.trim();
  const phone = $('#pkgA-phone').value.trim();
  const email = $('#pkgA-email').value.trim();
  const hotel = $('#pkgA-hotel').value.trim();
  const room = $('#pkgA-room').value.trim();
  const adults = +$('#pkgA-adults').value;
  const children = +$('#pkgA-children').value;
  const infants = +$('#pkgA-infants').value;
  const dateJeep = $('#pkgA-date-jeep').value;
  const dateSeascope = $('#pkgA-date-seascope').value;
  const dateCairo = $('#pkgA-date-cairo').value;
  const remarks = $('#pkgA-remarks').value.trim();

  const priceAdult = 375;
  const priceChild = 355;
  const total = (adults * priceAdult) + (children * priceChild);

  const summaryArea = $('#pkgA-summaryArea');
  summaryArea.textContent = '';

  const container = document.createElement('div');
  container.style.cssText = 'margin-top:10px;padding:15px;background:#f1f5ff;border:1px solid #bfdbfe;border-radius:10px;color:#1d2f4f;';

  const addText = (text, bold = false, styles = '') => {
    const el = bold ? document.createElement('strong') : document.createElement('span');
    el.textContent = text;
    if (styles) el.style.cssText = styles;
    container.appendChild(el);
  };

  const addBreak = () => container.appendChild(document.createElement('br'));

  addText('📋 Booking Summary', true, 'font-size:1.1rem;color:#1e3a8a;');
  addBreak(); addBreak();

  addText('Package: ', true);
  addText('Package A — 3 Trips');
  addBreak();

  addText('Guest: ', true);
  addText(name);
  addBreak();

  addText('Contact: ', true);
  addText(phone + ' / ' + email);
  addBreak();

  if (hotel) {
    addText('Hotel: ', true);
    addText(hotel + (room ? ' - Room ' + room : ''));
    addBreak();
  }

  addBreak();
  addText('Trip Dates:', true);
  addBreak();

  addText('• Jeep Safari: ');
  addText(new Date(dateJeep).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}));
  addBreak();

  addText('• Sea Scope: ');
  addText(new Date(dateSeascope).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}));
  addBreak();

  addText('• Cairo by Flight: ');
  addText(new Date(dateCairo).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}));
  addBreak(); addBreak();

  addText('Passengers:', true);
  addBreak();

  addText(`• Adults: ${adults} × $${priceAdult} = $${adults * priceAdult}`);
  addBreak();

  addText(`• Children: ${children} × $${priceChild} = $${children * priceChild}`);
  addBreak();

  addText(`• Infants: ${infants} (FREE)`);
  addBreak(); addBreak();

  addText(`Total: $${total}`, true, 'font-size:1.15rem;color:#0f172a;');
  addBreak();

  if (remarks) {
    addBreak();
    addText('Special Requests: ', true);
    addText(remarks);
    addBreak();
  }

  addBreak();
  const payBtn = document.createElement('button');
  payBtn.type = 'button';
  payBtn.textContent = '💳 Pay Now with Stripe';
  payBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;';
  payBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('💳 Stripe payment button clicked!');
    await processPackageAPayment(e);
  });
  container.appendChild(payBtn);

  summaryArea.appendChild(container);
}

async function processPackageAPayment(event) {
  const name = $('#pkgA-name').value.trim();
  const email = $('#pkgA-email').value.trim();
  const phone = $('#pkgA-phone').value.trim();
  const hotel = $('#pkgA-hotel').value.trim();
  const room = $('#pkgA-room').value.trim();
  const adults = +$('#pkgA-adults').value || 0;
  const children = +$('#pkgA-children').value || 0;
  const infants = +$('#pkgA-infants').value || 0;
  const notes = $('#pkgA-remarks').value.trim();
  const dateJeep = $('#pkgA-date-jeep').value;
  const dateSeascope = $('#pkgA-date-seascope').value;
  const dateCairo = $('#pkgA-date-cairo').value;
  const totalPrice = adults * 375 + children * 355;
  
  let specialRequests = notes || "";
  if (hotel) specialRequests += `\nHotel: ${hotel}`;
  if (room) specialRequests += ` - Room: ${room}`;
  if (dateJeep) specialRequests += `\n🏜️ Jeep Safari: ${dateJeep}`;
  if (dateSeascope) specialRequests += `\n🌊 Sea Scope: ${dateSeascope}`;
  if (dateCairo) specialRequests += `\n✈️ Cairo Flight: ${dateCairo}`;
  specialRequests += `\nInfants: ${infants} (FREE)`;
  
  var ids = resolveTripId(1);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Package A – Cairo by Air",
    packageType: "package_a",
    guestName: name,
    guestEmail: email,
    guestPhone: phone,
    guestCountry: null,
    adults: adults,
    children: children,
    pickupLocation: hotel || "N/A",
    specialRequests: specialRequests.trim(),
    totalAmount: totalPrice,
    currency: "usd",
    bookingDate: dateJeep || dateSeascope || dateCairo || new Date().toISOString().split('T')[0]
  };
  
  try {
    const payBtn = event.target;
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";
    
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
    event.target.disabled = false;
    event.target.textContent = "💳 Pay Now with Stripe";
  }
}

// "Proceed to Payment" button click handler
const pkgAPayBtn = $('#pkgA-payBtn');
pkgAPayBtn?.addEventListener('click', () => {
  const name = $('#pkgA-name').value.trim();
  const phone = $('#pkgA-phone').value.trim();
  const email = $('#pkgA-email').value.trim();
  const adults = +$('#pkgA-adults').value;
  const children = +$('#pkgA-children').value;
  const dateJeep = $('#pkgA-date-jeep').value;
  const dateSeascope = $('#pkgA-date-seascope').value;
  const dateCairo = $('#pkgA-date-cairo').value;

  if (!name || !phone || !email) return alert('Please fill in your name, phone, and email.');
  
  // Validate email format
  if (!isValidEmail(email)) {
    const error = getEmailError(email);
    alert('Invalid email: ' + error);
    $('#pkgA-email').focus();
    return;
  }
  
  if (!dateJeep || !dateSeascope || !dateCairo) return alert('Please select all three trip dates.');
  if (adults === 0 && children === 0) return alert('Please select at least one adult or child.');

  pkgASummaryVisible = true;
  updatePackageASummary();
});

// Add real-time listeners to passenger inputs
const pkgAAdults = $('#pkgA-adults');
const pkgAChildren = $('#pkgA-children');
const pkgAInfants = $('#pkgA-infants');

[pkgAAdults, pkgAChildren, pkgAInfants].forEach(input => {
  input?.addEventListener('input', () => {
    if (pkgASummaryVisible) {
      updatePackageASummary();
    }
  });
});
