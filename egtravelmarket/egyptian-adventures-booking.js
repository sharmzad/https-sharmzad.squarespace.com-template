// --- CONFIG ---
const PACKAGE_B = {
  packageName: "Egyptian Adventures (Package B)",
  priceAdult: 355,
  priceChild: 345,
  trips: [
    { id: "cairo", name: "Cairo by Flight", icon: "✈️" },
    { id: "ras", name: "Ras Mohamed National Park", icon: "🌊" },
    { id: "quad", name: "Sinai Quad Bike Safari", icon: "🏜️" }
  ]
};

// --- UTIL ---
const $ = s => document.querySelector(s);

// HTML escape function to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- LOAD DATA ON START ---
document.addEventListener("DOMContentLoaded", () => {
  // Calendar pickers ready - no date loading needed
  
  // Setup email validation
  const emailInput = $("#email");
  const emailMessage = $("#email-message");
  if (emailInput && emailMessage) {
    setupEmailValidation(emailInput, emailMessage);
  }
  
  // Add real-time listeners to all inputs
  const inputs = ["#name", "#phone", "#email", "#hotel", "#room", "#adults", "#children", "#infants", "#notes", 
                  "#dateCairo", "#paxCairo", "#dateRas", "#paxRas", "#dateQuad", "#paxQuad"];
  inputs.forEach(sel => {
    const el = $(sel);
    if (el) {
      el.addEventListener('input', updateSummaryIfVisible);
      el.addEventListener('change', updateSummaryIfVisible);
    }
  });
  
  // Add click handler to show summary button
  const showBtn = $("#showSummaryBtn");
  if (showBtn) {
    showBtn.addEventListener("click", showBookingSummary);
  }
});

// --- BOOKING SUMMARY ---
let summaryVisible = false;

function showBookingSummary() {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const adults = +$("#adults").value || 0;
  const children = +$("#children").value || 0;
  
  if (!name) {
    alert("Please enter your name.");
    $("#name").focus();
    return;
  }
  
  if (!phone) {
    alert("Please enter your WhatsApp number.");
    $("#phone").focus();
    return;
  }
  
  if (!email) {
    alert("Please enter your email.");
    $("#email").focus();
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    const error = getEmailError(email);
    alert('Invalid email: ' + error);
    $("#email").focus();
    return;
  }
  
  if (adults === 0 && children === 0) {
    alert("Please select at least one adult or child.");
    return;
  }
  
  const dateCairo = $("#dateCairo").value;
  const dateRas = $("#dateRas").value;
  const dateQuad = $("#dateQuad").value;
  
  if (!dateCairo && !dateRas && !dateQuad) {
    alert("Please select at least one trip date.");
    return;
  }
  
  summaryVisible = true;
  updateSummary();
  
  // Scroll to summary
  const summaryArea = $("#summaryArea");
  if (summaryArea) {
    summaryArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateSummaryIfVisible() {
  if (summaryVisible) {
    updateSummary();
  }
}

function updateSummary() {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const hotel = $("#hotel").value.trim();
  const room = $("#room").value.trim();
  const adults = +$("#adults").value || 0;
  const children = +$("#children").value || 0;
  const infants = +$("#infants").value || 0;
  const notes = $("#notes").value.trim();
  
  const dateCairo = $("#dateCairo").value;
  const paxCairo = +$("#paxCairo").value || 0;
  const dateRas = $("#dateRas").value;
  const paxRas = +$("#paxRas").value || 0;
  const dateQuad = $("#dateQuad").value;
  const paxQuad = +$("#paxQuad").value || 0;
  
  const total = adults * PACKAGE_B.priceAdult + children * PACKAGE_B.priceChild;
  
  // Clear previous content
  const summaryArea = $("#summaryArea");
  summaryArea.textContent = '';
  
  // Create container div using safe DOM methods
  const container = document.createElement('div');
  container.style.cssText = 'margin-top:20px;padding:20px;background:#f1f5ff;border:2px solid #0a66c2;border-radius:12px;';
  
  // Helper to add text nodes and breaks safely
  const addText = (text, isBold = false, styles = '') => {
    const el = isBold ? document.createElement('strong') : document.createElement('span');
    el.textContent = text;
    if (styles) el.style.cssText = styles;
    container.appendChild(el);
  };
  
  const addBreak = () => container.appendChild(document.createElement('br'));
  
  // Title
  addText('📋 Booking Summary', true, 'font-size:1.2rem;color:#0a3d9b;');
  addBreak(); addBreak();
  
  // Package
  addText('Package: ', true);
  addText(PACKAGE_B.packageName);
  addBreak(); addBreak();
  
  // Customer Info
  addText('👤 Customer Information:', true);
  addBreak();
  addText('Name: ', true);
  addText(name || '(not entered)');
  addBreak();
  addText('WhatsApp: ', true);
  addText(phone || '(not entered)');
  addBreak();
  addText('Email: ', true);
  addText(email || '(not entered)');
  addBreak();
  
  // Hotel
  if (hotel) {
    addText('Hotel: ', true);
    addText(hotel);
    if (room) {
      addText(' - Room ');
      addText(room);
    }
    addBreak();
  }
  
  // Trips section
  addBreak();
  addText('📅 Selected Trips & Dates:', true);
  addBreak();
  
  // Cairo trip
  if (dateCairo) {
    const dt = new Date(dateCairo);
    const tripDiv = document.createElement('div');
    tripDiv.style.cssText = 'margin:8px 0;padding:8px;background:#fff;border-radius:6px;';
    tripDiv.textContent = '✈️ ';
    const boldName = document.createElement('strong');
    boldName.textContent = 'Cairo by Flight';
    tripDiv.appendChild(boldName);
    tripDiv.appendChild(document.createElement('br'));
    const dateText = document.createTextNode(`    Date: ${dt.toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"})}`);
    tripDiv.appendChild(dateText);
    tripDiv.appendChild(document.createElement('br'));
    const paxText = document.createTextNode(`    Passengers: ${paxCairo || adults}`);
    tripDiv.appendChild(paxText);
    container.appendChild(tripDiv);
  }
  
  // Ras Mohamed trip
  if (dateRas) {
    const dt = new Date(dateRas);
    const tripDiv = document.createElement('div');
    tripDiv.style.cssText = 'margin:8px 0;padding:8px;background:#fff;border-radius:6px;';
    tripDiv.textContent = '🌊 ';
    const boldName = document.createElement('strong');
    boldName.textContent = 'Ras Mohamed National Park';
    tripDiv.appendChild(boldName);
    tripDiv.appendChild(document.createElement('br'));
    const dateText = document.createTextNode(`    Date: ${dt.toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"})}`);
    tripDiv.appendChild(dateText);
    tripDiv.appendChild(document.createElement('br'));
    const paxText = document.createTextNode(`    Passengers: ${paxRas || adults}`);
    tripDiv.appendChild(paxText);
    container.appendChild(tripDiv);
  }
  
  // Quad Safari trip
  if (dateQuad) {
    const dt = new Date(dateQuad);
    const tripDiv = document.createElement('div');
    tripDiv.style.cssText = 'margin:8px 0;padding:8px;background:#fff;border-radius:6px;';
    tripDiv.textContent = '🏜️ ';
    const boldName = document.createElement('strong');
    boldName.textContent = 'Sinai Quad Bike Safari';
    tripDiv.appendChild(boldName);
    tripDiv.appendChild(document.createElement('br'));
    const dateText = document.createTextNode(`    Date: ${dt.toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short", year:"numeric"})}`);
    tripDiv.appendChild(dateText);
    tripDiv.appendChild(document.createElement('br'));
    const ridersText = document.createTextNode(`    Riders: ${paxQuad || adults}`);
    tripDiv.appendChild(ridersText);
    container.appendChild(tripDiv);
  }
  
  // Pricing
  addBreak();
  addText('👥 Passengers & Pricing:', true);
  addBreak();
  addText(`• Adults: ${adults} × $${PACKAGE_B.priceAdult} = $${adults * PACKAGE_B.priceAdult}`);
  addBreak();
  addText(`• Children: ${children} × $${PACKAGE_B.priceChild} = $${children * PACKAGE_B.priceChild}`);
  addBreak();
  
  if (infants > 0) {
    addText(`• Infants: ${infants} (FREE)`);
    addBreak();
  }
  
  // Total
  addBreak();
  addText(`💰 Total Package Price: $${total} USD`, true, 'font-size:1.3rem;color:#0f172a;');
  addBreak();
  
  // Notes
  if (notes) {
    addBreak();
    addText('📝 Special Requests:', true);
    addBreak();
    addText(notes);
    addBreak();
  }
  
  // Append container to summary area using safe appendChild
  summaryArea.appendChild(container);
  
  // Add payment button
  addBreak();
  const payNowBtn = document.createElement('button');
  payNowBtn.className = 'btn';
  payNowBtn.textContent = '💳 Pay Now with Stripe';
  payNowBtn.style.cssText = 'margin-top:15px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1.1rem;cursor:pointer;';
  payNowBtn.addEventListener('click', processStripePayment);
  container.appendChild(payNowBtn);
}

// Form submission
function submitB(e) {
  e.preventDefault();
  
  if (!summaryVisible) {
    showBookingSummary();
    return false;
  }
  
  // Show success popup
  document.getElementById('okPopup').style.display = 'block';
  return false;
}

// --- STRIPE PAYMENT INTEGRATION ---
async function processStripePayment(event) {
  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const email = $("#email").value.trim();
  const hotel = $("#hotel").value.trim();
  const room = $("#room").value.trim();
  const adults = +$("#adults").value || 0;
  const children = +$("#children").value || 0;
  const infants = +$("#infants").value || 0;
  const notes = $("#notes").value.trim();
  
  const dateCairo = $("#dateCairo").value;
  const paxCairo = +$("#paxCairo").value || adults;
  const dateRas = $("#dateRas").value;
  const paxRas = +$("#paxRas").value || adults;
  const dateQuad = $("#dateQuad").value;
  const paxQuad = +$("#paxQuad").value || adults;
  
  const totalPrice = (adults * PACKAGE_B.priceAdult) + (children * PACKAGE_B.priceChild);
  
  if (totalPrice <= 0) {
    alert("Please select at least one adult or child.");
    return;
  }
  
  // Build special requests with trip details
  let specialRequestsText = notes || "";
  if (hotel) {
    specialRequestsText += `\nHotel: ${hotel}`;
  }
  if (room) {
    specialRequestsText += ` - Room: ${room}`;
  }
  if (dateCairo) {
    specialRequestsText += `\n\n✈️ Cairo by Flight: ${dateCairo} (${paxCairo} passengers)`;
  }
  if (dateRas) {
    specialRequestsText += `\n🌊 Ras Mohamed: ${dateRas} (${paxRas} passengers)`;
  }
  if (dateQuad) {
    specialRequestsText += `\n🏜️ Quad Safari: ${dateQuad} (${paxQuad} riders)`;
  }
  specialRequestsText += `\nInfants: ${infants} (FREE)`;
  
  var ids = resolveTripId(15);
  if (!validateTripIdBeforePayment(ids)) return;

  const bookingData = {
    tripId: ids.tripId,
    expertTripId: ids.expertTripId,
    packageName: PACKAGE_B.packageName,
    packageType: "package_b",
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
    bookingDate: dateCairo || dateRas || dateQuad || new Date().toISOString().split('T')[0]
  };
  
  try {
    // Show loading state
    const payBtn = event.target;
    const originalText = payBtn.textContent;
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";
    
    // Create booking and get Stripe checkout session
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
    
    // Redirect to Stripe checkout
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error("No checkout URL received");
    }
    
  } catch (error) {
    console.error("Payment error:", error);
    alert("Payment failed: " + error.message);
    
    // Restore button state
    const payBtn = document.querySelector('#summaryArea .btn');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "💳 Pay Now with Stripe";
    }
  }
}
