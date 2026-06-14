function resolveTripId(pageDefaultTripId) {
  var params = new URLSearchParams(window.location.search);
  var tripId = params.get('tripId') || null;
  var expertTripId = params.get('expertTripId') || null;

  // Page default ALWAYS wins over stale sessionStorage.
  // sessionStorage is only used as fallback when NO page default exists
  // (e.g. dynamic pages that receive tripId via URL param from a listing page).
  if (!tripId && !expertTripId) {
    if (pageDefaultTripId) {
      tripId = String(pageDefaultTripId);
    } else {
      try { tripId = sessionStorage.getItem('tripId') || null; } catch(e) {}
      if (!tripId) {
        try { expertTripId = sessionStorage.getItem('expertTripId') || null; } catch(e) {}
      }
    }
  }

  if (tripId) {
    try { sessionStorage.setItem('tripId', tripId); sessionStorage.removeItem('expertTripId'); } catch(e) {}
  } else if (expertTripId) {
    try { sessionStorage.setItem('expertTripId', expertTripId); sessionStorage.removeItem('tripId'); } catch(e) {}
  }

  return { tripId: tripId ? parseInt(tripId, 10) : null, expertTripId: expertTripId ? parseInt(expertTripId, 10) : null };
}

function validateTripIdBeforePayment(ids) {
  if (!ids.tripId && !ids.expertTripId) {
    alert('Booking error: Unable to identify the trip. Please go back to the trips page and try again.');
    return false;
  }
  return true;
}

async function createStripeCheckout(bookingData) {
  try {
    if (!bookingData.tripId && !bookingData.expertTripId) {
      throw new Error('Unable to identify the trip. Please go back to the trips page and try again.');
    }

    var payload = Object.assign({}, bookingData);
    delete payload.totalAmount;

    var response = await fetch("/api/bookings/with-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      var error = await response.json();
      throw new Error(error.error || "Failed to create booking");
    }

    var data = await response.json();

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error("No checkout URL received");
    }

  } catch (error) {
    console.error("Payment error:", error);
    alert("Payment failed: " + error.message);
    throw error;
  }
}
