// Package C Booking Script
const $ = s => document.querySelector(s);

// Calendar picker initialized - dates selected manually by user
// No need to load available dates since HTML5 date input works natively

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  
  // Setup email validation
  const emailInput = $('#pkgC-email');
  const emailMessage = $('#pkgC-email-message');
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
});

// Booking summary
let pkgCSummaryVisible = false;

function updatePackageCSummary() {
  const name = $('#pkgC-name').value.trim();
  const phone = $('#pkgC-phone').value.trim();
  const email = $('#pkgC-email').value.trim();
  const hotel = $('#pkgC-hotel').value.trim();
  const room = $('#pkgC-room').value.trim();
  const adults = +$('#pkgC-adults').value;
  const children = +$('#pkgC-children').value;
  const infants = +$('#pkgC-infants').value;
  const dateDahab = $('#pkgC-date-dahab').value;
  const dateLuxor = $('#pkgC-date-luxor').value;
  const dateDesert = $('#pkgC-date-desert').value;
  const remarks = $('#pkgC-remarks').value.trim();

  const priceAdult = 390;
  const priceChild = 350;
  const total = (adults * priceAdult) + (children * priceChild);

  const summaryArea = $('#pkgC-summaryArea');
  summaryArea.textContent = '';
  
  const container = document.createElement('div');
  container.style.cssText = 'margin-top:10px;padding:15px;background:#f1f5ff;border:1px solid #bfdbfe;border-radius:10px;color:#1d2f4f;';
  
  const title = document.createElement('strong');
  title.style.cssText = 'font-size:1.1rem;color:#1e3a8a;';
  title.textContent = '📋 Booking Summary';
  container.appendChild(title);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  const pkgLabel = document.createElement('strong');
  pkgLabel.textContent = 'Package:';
  container.appendChild(pkgLabel);
  container.appendChild(document.createTextNode(' Package C — Egyptian Explorer Triple Pack'));
  container.appendChild(document.createElement('br'));
  
  const guestLabel = document.createElement('strong');
  guestLabel.textContent = 'Guest:';
  container.appendChild(guestLabel);
  container.appendChild(document.createTextNode(' ' + name));
  container.appendChild(document.createElement('br'));
  
  const contactLabel = document.createElement('strong');
  contactLabel.textContent = 'Contact:';
  container.appendChild(contactLabel);
  container.appendChild(document.createTextNode(' ' + phone + ' / ' + email));
  container.appendChild(document.createElement('br'));
  
  if (hotel) {
    const hotelLabel = document.createElement('strong');
    hotelLabel.textContent = 'Hotel:';
    container.appendChild(hotelLabel);
    container.appendChild(document.createTextNode(' ' + hotel + (room ? ' - Room ' + room : '')));
    container.appendChild(document.createElement('br'));
  }
  
  container.appendChild(document.createElement('br'));
  
  const datesLabel = document.createElement('strong');
  datesLabel.textContent = 'Trip Dates:';
  container.appendChild(datesLabel);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• Dahab Discovery: ' + (dateDahab ? new Date(dateDahab).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}) : 'Not selected')));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• Luxor by Flight: ' + (dateLuxor ? new Date(dateLuxor).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}) : 'Not selected')));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• 5-in-1 Desert Rose: ' + (dateDesert ? new Date(dateDesert).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'short', year:'numeric'}) : 'Not selected')));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  const passLabel = document.createElement('strong');
  passLabel.textContent = 'Passengers:';
  container.appendChild(passLabel);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Adults: ${adults} × $${priceAdult} = $${adults * priceAdult}`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Children: ${children} × $${priceChild} = $${children * priceChild}`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Infants: ${infants} (FREE)`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  const totalLabel = document.createElement('strong');
  totalLabel.style.cssText = 'font-size:1.15rem;color:#0f172a;';
  totalLabel.textContent = `Total: $${total}`;
  container.appendChild(totalLabel);
  container.appendChild(document.createElement('br'));
  
  if (remarks) {
    container.appendChild(document.createElement('br'));
    const remarksLabel = document.createElement('strong');
    remarksLabel.textContent = 'Special Requests:';
    container.appendChild(remarksLabel);
    container.appendChild(document.createTextNode(' ' + remarks));
    container.appendChild(document.createElement('br'));
  }
  
  container.appendChild(document.createElement('br'));
  const payBtn = document.createElement('button');
  payBtn.type = 'button';
  payBtn.textContent = '💳 Pay Now with Stripe';
  payBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;';
  payBtn.onclick = processPackageCPayment;
  container.appendChild(payBtn);
  summaryArea.appendChild(container);
}

async function processPackageCPayment(event) {
  const name = $('#pkgC-name').value.trim();
  const email = $('#pkgC-email').value.trim();
  const phone = $('#pkgC-phone').value.trim();
  const hotel = $('#pkgC-hotel').value.trim();
  const room = $('#pkgC-room').value.trim();
  const adults = +$('#pkgC-adults').value || 0;
  const children = +$('#pkgC-children').value || 0;
  const infants = +$('#pkgC-infants').value || 0;
  const notes = $('#pkgC-remarks').value.trim();
  const dateDahab = $('#pkgC-date-dahab').value;
  const dateLuxor = $('#pkgC-date-luxor').value;
  const dateDesert = $('#pkgC-date-desert').value;
  const totalPrice = adults * 390 + children * 350;
  
  let specialRequests = notes || "";
  if (hotel) specialRequests += `\nHotel: ${hotel}`;
  if (room) specialRequests += ` - Room: ${room}`;
  if (dateDahab) specialRequests += `\n🌊 Dahab: ${dateDahab}`;
  if (dateLuxor) specialRequests += `\n✈️ Luxor: ${dateLuxor}`;
  if (dateDesert) specialRequests += `\n🏜️ Desert Rose: ${dateDesert}`;
  specialRequests += `\nInfants: ${infants} (FREE)`;
  
  var ids = resolveTripId(9);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Package C - Egyptian Explorer Triple Pack",
    packageType: "package_c",
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
    bookingDate: dateDahab || dateLuxor || dateDesert || new Date().toISOString().split('T')[0]
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
const pkgCPayBtn = $('#pkgC-payBtn');
pkgCPayBtn?.addEventListener('click', () => {
  const name = $('#pkgC-name').value.trim();
  const phone = $('#pkgC-phone').value.trim();
  const email = $('#pkgC-email').value.trim();
  const adults = +$('#pkgC-adults').value;
  const children = +$('#pkgC-children').value;
  const dateDahab = $('#pkgC-date-dahab').value;
  const dateLuxor = $('#pkgC-date-luxor').value;
  const dateDesert = $('#pkgC-date-desert').value;

  if (!name || !phone || !email) return alert('Please fill in your name, phone, and email.');
  
  // Validate email format
  if (!isValidEmail(email)) {
    const error = getEmailError(email);
    alert('Invalid email: ' + error);
    $('#pkgC-email').focus();
    return;
  }
  
  if (!dateDahab || !dateLuxor || !dateDesert) return alert('Please select all three trip dates.');
  if (adults === 0 && children === 0) return alert('Please select at least one adult or child.');

  pkgCSummaryVisible = true;
  updatePackageCSummary();
});

// Add real-time listeners to passenger inputs
const pkgCAdults = $('#pkgC-adults');
const pkgCChildren = $('#pkgC-children');
const pkgCInfants = $('#pkgC-infants');

[pkgCAdults, pkgCChildren, pkgCInfants].forEach(input => {
  input?.addEventListener('input', () => {
    if (pkgCSummaryVisible) {
      updatePackageCSummary();
    }
  });
});
