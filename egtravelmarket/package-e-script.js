// --- CONFIG FOR PACKAGE E ---
const PACKAGE_E = {
  packageName: "Package E – Land & Sea Experience",
  priceAdult: 75,
  priceChild: 55,
  trips: [
    {
      id: "ras",
      name: "Ras Mohamed National Park & White Island",
      selectId: "rasDate",
      dataKey: "package_e_ras_mohamed"
    },
    {
      id: "desert",
      name: "Desert Rose Safari, BBQ & Stargazing",
      selectId: "desertDate",
      dataKey: "package_e_desert_safari"
    }
  ]
};

// --- UTIL ---
const $ = s => document.querySelector(s);

// Calendar picker initialized - dates selected manually by user
// No need to load available dates since HTML5 date input works natively

// --- BOOKING SUMMARY ---
let summaryVisible = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Calendar pickers ready - no date loading needed
  
  // Setup email validation
  const emailInput = $("#email");
  const emailMessage = $("#email-message");
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
});

// Function to update booking summary with real-time changes
function updateSummary() {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const hotel = $("#hotelName").value.trim();
  const room = $("#roomNumber").value.trim();
  const rasDate = $("#rasDate").value;
  const desertDate = $("#desertDate").value;
  const A = +$("#adults").value || 0;
  const C = +$("#children").value || 0;
  const I = +$("#infants").value || 0;
  const remarks = $("#remarks").value.trim();

  const total = A * PACKAGE_E.priceAdult + C * PACKAGE_E.priceChild;
  
  const summaryArea = $("#summaryArea");
  summaryArea.textContent = '';
  
  const container = document.createElement('div');
  container.style.cssText = 'margin-top:10px;padding:15px;background:#f1f5ff;border:1px solid #bfdbfe;border-radius:10px;color:#1d2f4f;';
  
  // Title
  const title = document.createElement('strong');
  title.style.cssText = 'font-size:1.1rem;color:#1e3a8a;';
  title.textContent = '📋 Booking Summary';
  container.appendChild(title);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  // Package
  const pkgLabel = document.createElement('strong');
  pkgLabel.textContent = 'Package:';
  container.appendChild(pkgLabel);
  container.appendChild(document.createTextNode(' ' + PACKAGE_E.packageName));
  container.appendChild(document.createElement('br'));
  
  // Guest
  const guestLabel = document.createElement('strong');
  guestLabel.textContent = 'Guest:';
  container.appendChild(guestLabel);
  container.appendChild(document.createTextNode(' ' + name));
  container.appendChild(document.createElement('br'));
  
  // Contact
  const contactLabel = document.createElement('strong');
  contactLabel.textContent = 'Contact:';
  container.appendChild(contactLabel);
  container.appendChild(document.createTextNode(' ' + phone + ' / ' + email));
  container.appendChild(document.createElement('br'));
  
  // Hotel (if provided)
  if (hotel) {
    const hotelLabel = document.createElement('strong');
    hotelLabel.textContent = 'Hotel:';
    container.appendChild(hotelLabel);
    container.appendChild(document.createTextNode(' ' + hotel + (room ? ' - Room ' + room : '')));
    container.appendChild(document.createElement('br'));
  }
  
  container.appendChild(document.createElement('br'));
  
  // Selected Trips
  const tripsLabel = document.createElement('strong');
  tripsLabel.textContent = 'Selected Trips:';
  container.appendChild(tripsLabel);
  container.appendChild(document.createElement('br'));
  
  if (rasDate) {
    container.appendChild(document.createTextNode('• ' + PACKAGE_E.trips[0].name));
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode('  📅 ' + new Date(rasDate).toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"})));
    container.appendChild(document.createElement('br'));
  }
  
  if (desertDate) {
    container.appendChild(document.createTextNode('• ' + PACKAGE_E.trips[1].name));
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createTextNode('  📅 ' + new Date(desertDate).toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"})));
    container.appendChild(document.createElement('br'));
  }
  
  if (!rasDate && !desertDate) {
    const noTrips = document.createElement('em');
    noTrips.style.color = '#666';
    noTrips.textContent = 'No trips selected yet';
    container.appendChild(noTrips);
    container.appendChild(document.createElement('br'));
  }
  
  container.appendChild(document.createElement('br'));
  
  // Passengers
  const passLabel = document.createElement('strong');
  passLabel.textContent = 'Passengers:';
  container.appendChild(passLabel);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Adults: ${A} × $${PACKAGE_E.priceAdult} = $${A * PACKAGE_E.priceAdult}`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Children: ${C} × $${PACKAGE_E.priceChild} = $${C * PACKAGE_E.priceChild}`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode(`• Infants: ${I} (FREE)`));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  // Total
  const totalLabel = document.createElement('strong');
  totalLabel.style.cssText = 'font-size:1.15rem;color:#0f172a;';
  totalLabel.textContent = `Total: $${total}`;
  container.appendChild(totalLabel);
  container.appendChild(document.createElement('br'));
  
  // Remarks
  if (remarks) {
    container.appendChild(document.createElement('br'));
    const remarksLabel = document.createElement('strong');
    remarksLabel.textContent = 'Special Requests:';
    container.appendChild(remarksLabel);
    container.appendChild(document.createTextNode(' ' + remarks));
    container.appendChild(document.createElement('br'));
  }
  
  // Payment button
  container.appendChild(document.createElement('br'));
  const payBtn = document.createElement('button');
  payBtn.type = 'button';
  payBtn.textContent = '💳 Pay Now with Stripe';
  payBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;';
  payBtn.onclick = processPackageEPayment;
  container.appendChild(payBtn);
  summaryArea.appendChild(container);
}

async function processPackageEPayment(event) {
  const name = $("#name").value.trim();
  const email = $("#email").value.trim();
  const phone = $("#phone").value.trim();
  const hotel = $("#hotelName") ? $("#hotelName").value.trim() : "";
  const room = "";
  const adults = +$("#adults").value || 0;
  const children = +$("#children").value || 0;
  const infants = +$("#infants").value || 0;
  const notes = $("#remarks").value.trim();
  const rasDate = $("#rasDate").value;
  const desertDate = $("#desertDate").value;
  const totalPrice = adults * PACKAGE_E.priceAdult + children * PACKAGE_E.priceChild;
  
  let specialRequests = notes || "";
  if (hotel) specialRequests += `\nHotel: ${hotel}`;
  if (room) specialRequests += ` - Room: ${room}`;
  if (rasDate) specialRequests += `\n🌊 Ras Mohamed: ${rasDate}`;
  if (desertDate) specialRequests += `\n🏜️ Desert Rose: ${desertDate}`;
  specialRequests += `\nInfants: ${infants} (FREE)`;
  
  var ids = resolveTripId(11);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: "Package E - Land & Sea Experience",
    packageType: "package_e",
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
    bookingDate: rasDate || desertDate || new Date().toISOString().split('T')[0]
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

// Main payment/booking function
function proceedToPayment() {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const rasDate = $("#rasDate").value;
  const desertDate = $("#desertDate").value;
  const A = +$("#adults").value || 0;
  const C = +$("#children").value || 0;
  
  // Validation
  if (!name || !phone) {
    alert("Please fill in your name and WhatsApp number.");
    return;
  }
  
  // Email validation - check both presence and format
  if (!email) {
    alert("Please fill in your email address.");
    return;
  }
  if (!isValidEmail(email)) {
    const error = getEmailError(email);
    alert('Invalid email: ' + error);
    $("#email").focus();
    return;
  }
  
  if (!rasDate && !desertDate) {
    alert("Please select at least one trip date.");
    return;
  }
  
  if (A === 0 && C === 0) {
    alert("Please select at least one adult or child.");
    return;
  }

  // Show summary
  summaryVisible = true;
  updateSummary();
  
  // Add real-time listeners to passenger inputs
  const adultsInput = $("#adults");
  const childrenInput = $("#children");
  const infantsInput = $("#infants");
  
  [adultsInput, childrenInput, infantsInput].forEach(input => {
    input.removeEventListener('input', handlePassengerChange);
    input.addEventListener('input', handlePassengerChange);
  });
}

// Handle passenger count changes for real-time updates
function handlePassengerChange() {
  if (summaryVisible) {
    updateSummary();
  }
}

// --- INITIALIZE ON PAGE LOAD ---
document.addEventListener("DOMContentLoaded", () => {
  // Setup email validation
  const emailInput = $("#email");
  const emailMessage = $("#email-message");
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
  
  // Attach payment button listener
  const payBtn = $("#payBtn");
  if (payBtn) {
    payBtn.addEventListener("click", proceedToPayment);
  }
});
