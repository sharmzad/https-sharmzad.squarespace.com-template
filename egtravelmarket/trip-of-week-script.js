// --- CONFIG ---
const WEEKLY = {
  tripName: "Cairo by Flight",
  mainDay: "Wednesday",
  priceAdult: 290,
  priceChild: 275,
  itinerary: [
    { day:"Wednesday", title:"Transfer from Hotel to Sharm Airport", notes:"Pick-up 04:00–05:00 AM.", type:"main"},
    { day:"Wednesday", title:"Flight to Cairo", notes:"1-hour flight / Meet guide on arrival.", type:"main"},
    { day:"Wednesday", title:"Pyramids & Sphinx Tour", notes:"Guided visit + photo stops.", type:"main"},
    { day:"Wednesday", title:"Lunch by the Nile", notes:"Buffet meal with river view.", type:"main"},
    { day:"Wednesday", title:"Egyptian Museum / Grand Museum", notes:"Explore ancient treasures.", type:"main"},
    { day:"Wednesday", title:"Return Flight to Sharm", notes:"Evening flight + hotel transfer.", type:"main"},
    { day:"Wednesday", title:"SIM Card 20 GB (Free Bonus)", notes:"Delivered Day 1.", type:"bonus"},
    { day:"Friday", title:"Turkish Bath 15 min (Free Bonus)", notes:"Relaxation session.", type:"bonus"}
  ],
  includes: [
    "Round-trip Flights (Sharm ↔ Cairo)",
    "Air-conditioned Transfers",
    "Lunch by the Nile",
    "Entrance Fees",
    "Professional Guide",
    "SIM Card 20 GB (Bonus)",
    "15-min Turkish Bath (Bonus)"
  ]
};

// --- UTIL ---
const $ = s => document.querySelector(s);

// --- LOAD DATA ON START ---
document.addEventListener("DOMContentLoaded", () => {
  fillItinerary();
  fillIncludes();
  setupWednesdayDatePicker();
  
  // Setup email validation
  const emailInput = $("#email");
  const emailMessage = $("#email-message");
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
  
  const payBtn = $("#payBtn");
  if (payBtn) {
    payBtn.addEventListener("click", proceedToPayment);
  }
});

// itinerary table
function fillItinerary() {
  const tb = $("#itineraryBody");
  tb.textContent = "";
  WEEKLY.itinerary.forEach(i => {
    const tr = document.createElement("tr");
    const tdDay = document.createElement("td");
    tdDay.textContent = i.day;
    const tdTitle = document.createElement("td");
    tdTitle.textContent = i.title;
    const tdNotes = document.createElement("td");
    tdNotes.textContent = i.notes;
    tr.appendChild(tdDay);
    tr.appendChild(tdTitle);
    tr.appendChild(tdNotes);
    tb.appendChild(tr);
  });
}

// includes pills
function fillIncludes() {
  const inc = $("#includes");
  WEEKLY.includes.forEach(t => {
    const s = document.createElement("span");
    s.className = "pill";
    s.textContent = t;
    inc.appendChild(s);
  });
}

// --- SETUP WEDNESDAY-ONLY DATE PICKER ---
function setupWednesdayDatePicker() {
  const dateInput = $("#tripDate");
  if (!dateInput) return;
  
  // Set today as minimum date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = today.toISOString().split('T')[0];
  
  // Set max date 6 months from now
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + 6);
  const maxDateStr = maxDate.toISOString().split('T')[0];
  
  dateInput.setAttribute('min', minDate);
  dateInput.setAttribute('max', maxDateStr);
  
  // Add validation to allow only Wednesdays
  dateInput.addEventListener('change', (e) => {
    const selectedDate = new Date(e.target.value + 'T00:00:00Z');
    if (selectedDate.getUTCDay() !== 3) { // 3 = Wednesday
      alert('Please select a Wednesday. Trip of the Week runs every Wednesday only.');
      e.target.value = '';
    }
  });
  
  // Add input event to prevent non-Wednesday selection on date picker
  dateInput.addEventListener('input', (e) => {
    const selectedDate = new Date(e.target.value + 'T00:00:00Z');
    if (e.target.value && selectedDate.getUTCDay() !== 3) {
      alert('Please select a Wednesday. Trip of the Week runs every Wednesday only.');
      e.target.value = '';
    }
  });
}

// --- PAYMENT / SUMMARY ---
let summaryVisible = false;

// Security: HTML escape function to prevent XSS attacks
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Function to update booking summary (using safe DOM methods)
function updateSummary() {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const hotel = $("#hotelName").value.trim();
  const room = $("#roomNumber").value.trim();
  const date = $("#tripDate").value;
  const A = +$("#adults").value;
  const C = +$("#children").value;
  const I = +$("#infants").value;
  const remarks = $("#remarks").value.trim();

  const total = A * WEEKLY.priceAdult + C * WEEKLY.priceChild;
  
  // Create container div
  const container = document.createElement('div');
  container.style.cssText = 'margin-top:10px;padding:15px;background:#f1f5ff;border:1px solid #bfdbfe;border-radius:10px;';
  
  // Title
  const title = document.createElement('strong');
  title.style.cssText = 'font-size:1.1rem;color:#1e3a8a;';
  title.textContent = '📋 Booking Summary';
  container.appendChild(title);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  // Trip name
  const tripLabel = document.createElement('strong');
  tripLabel.textContent = 'Trip:';
  container.appendChild(tripLabel);
  container.appendChild(document.createTextNode(' ' + WEEKLY.tripName));
  container.appendChild(document.createElement('br'));
  
  // Guest name
  const guestLabel = document.createElement('strong');
  guestLabel.textContent = 'Guest:';
  container.appendChild(guestLabel);
  container.appendChild(document.createTextNode(' ' + name));
  container.appendChild(document.createElement('br'));
  
  // Contact info
  const contactLabel = document.createElement('strong');
  contactLabel.textContent = 'Contact:';
  container.appendChild(contactLabel);
  container.appendChild(document.createTextNode(' ' + phone + ' / ' + email));
  container.appendChild(document.createElement('br'));
  
  // Hotel info (if provided)
  if (hotel) {
    const hotelLabel = document.createElement('strong');
    hotelLabel.textContent = 'Hotel:';
    container.appendChild(hotelLabel);
    const hotelText = room ? hotel + ' - Room ' + room : hotel;
    container.appendChild(document.createTextNode(' ' + hotelText));
    container.appendChild(document.createElement('br'));
  }
  
  container.appendChild(document.createElement('br'));
  
  // Trip date
  const dateLabel = document.createElement('strong');
  dateLabel.textContent = 'Trip Date:';
  container.appendChild(dateLabel);
  container.appendChild(document.createElement('br'));
  const formattedDate = new Date(date).toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"});
  container.appendChild(document.createTextNode(formattedDate));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  // Passengers
  const passengersLabel = document.createElement('strong');
  passengersLabel.textContent = 'Passengers:';
  container.appendChild(passengersLabel);
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• Adults: ' + A + ' × $' + WEEKLY.priceAdult + ' = $' + (A * WEEKLY.priceAdult)));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• Children: ' + C + ' × $' + WEEKLY.priceChild + ' = $' + (C * WEEKLY.priceChild)));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createTextNode('• Infants: ' + I + ' (FREE)'));
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  
  // Total
  const totalLabel = document.createElement('strong');
  totalLabel.style.cssText = 'font-size:1.15rem;color:#0f172a;';
  totalLabel.textContent = 'Total: $' + total;
  container.appendChild(totalLabel);
  container.appendChild(document.createElement('br'));
  
  // Special requests (if provided)
  if (remarks) {
    container.appendChild(document.createElement('br'));
    const remarksLabel = document.createElement('strong');
    remarksLabel.textContent = 'Special Requests:';
    container.appendChild(remarksLabel);
    container.appendChild(document.createTextNode(' ' + remarks));
    container.appendChild(document.createElement('br'));
  }
  
  // Replace content safely
  const summaryArea = $("#summaryArea");
  summaryArea.textContent = '';
  summaryArea.appendChild(container);
  
  // Add payment button
  container.appendChild(document.createElement('br'));
  const payNowBtn = document.createElement('button');
  payNowBtn.className = 'btn';
  payNowBtn.textContent = '💳 Pay Now with Stripe';
  payNowBtn.style.cssText = 'margin-top:10px;';
  payNowBtn.addEventListener('click', processStripePayment);
  container.appendChild(payNowBtn);
}

// Simple email validation fallback if email-validator.js doesn't load
function basicEmailValidation(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function proceedToPayment() {
  console.log('🔵 proceedToPayment clicked');
  
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const date = $("#tripDate").value;
  const A = +$("#adults").value;
  const C = +$("#children").value;
  
  console.log('Form values:', {name, phone, email, date, adults: A, children: C});
  
  if (!name || !phone) {
    alert("Please fill your name and WhatsApp number.");
    return;
  }
  
  // Validate email format
  if (!email) {
    alert("Please fill in your email address.");
    return;
  }
  
  // Use email-validator if available, otherwise use basic validation
  const isValidEmailFn = typeof isValidEmail === 'function' ? isValidEmail : basicEmailValidation;
  if (!isValidEmailFn(email)) {
    if (typeof getEmailError === 'function') {
      const error = getEmailError(email);
      alert('Invalid email: ' + error);
    } else {
      alert('Invalid email address. Please check and try again.');
    }
    $("#email").focus();
    return;
  }
  
  if (!date) {
    alert("Please select a trip date.");
    return;
  }
  
  if (A === 0 && C === 0) {
    alert("Please select at least one adult or child.");
    return;
  }

  console.log('✅ All validations passed, showing summary...');
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

function handlePassengerChange() {
  if (summaryVisible) {
    updateSummary();
  }
}

// --- STRIPE PAYMENT INTEGRATION ---
async function processStripePayment(event) {
  console.log('💳 processStripePayment called');
  
  try {
    const name = $("#name").value.trim();
    const phone = $("#phone").value.trim();
    const email = $("#email").value.trim();
    const hotel = $("#hotelName").value.trim();
    const room = $("#roomNumber").value.trim();
    const date = $("#tripDate").value;
    const adults = +$("#adults").value || 0;
    const children = +$("#children").value || 0;
    const infants = +$("#infants").value || 0;
    const remarks = $("#remarks").value.trim();
    
    console.log('Payment form data:', {name, email, date, adults, children});
    
    const totalPrice = (adults * WEEKLY.priceAdult) + (children * WEEKLY.priceChild);
    
    if (totalPrice <= 0) {
      alert("Please select at least one adult or child.");
      return;
    }
    
    // Build special requests including hotel and trip date info
    let specialRequestsText = remarks || "";
    if (hotel) {
      specialRequestsText += `\nHotel: ${hotel}`;
    }
    if (room) {
      specialRequestsText += ` - Room: ${room}`;
    }
    specialRequestsText += `\nTrip Date: ${date}`;
    specialRequestsText += `\nInfants: ${infants} (FREE)`;
    
    var ids = resolveTripId(16);
    if (!validateTripIdBeforePayment(ids)) return;

    const bookingData = {
      tripId: ids.tripId,
      expertTripId: ids.expertTripId,
      packageName: WEEKLY.tripName,
      packageType: "trip_of_week",
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      guestCountry: null,
      adults: adults,
      children: children,
      pickupLocation: hotel || "N/A",
      specialRequests: specialRequestsText.trim(),
      totalAmount: totalPrice,
      currency: "usd",
      bookingDate: date
    };
    
    console.log('📤 Sending booking data:', bookingData);
    
    // Show loading state
    const payBtn = event && event.target ? event.target : document.querySelector('#summaryArea .btn');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Processing...";
    }
    
    // Create booking and get Stripe checkout session
    const response = await fetch("/api/bookings/with-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create booking");
    }
    
    const data = await response.json();
    console.log('✅ Booking created:', data);
    
    // Redirect to Stripe checkout
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error("No checkout URL received");
    }
    
  } catch (error) {
    console.error("❌ Payment error:", error);
    alert("Payment failed: " + error.message);
    
    // Restore button state
    const payBtn = document.querySelector('#summaryArea .btn');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "💳 Pay Now with Stripe";
    }
  }
}
