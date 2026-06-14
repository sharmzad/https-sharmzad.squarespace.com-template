// Cancellation Policy Helper - Expert Trips
// Calculates refund splits based on trip duration and cancellation timing

const CancellationPolicy = {
  // Calculate refund split
  calculateRefund: (totalAmount, tripDuration, tripStartDate) => {
    const daysUntilTrip = Math.ceil((new Date(tripStartDate) - new Date()) / (24 * 60 * 60 * 1000));
    const isSingleDay = tripDuration && 
      tripDuration.toLowerCase().includes('day') && 
      !tripDuration.toLowerCase().match(/\b[2-9]|week|month/);

    let result = {
      travelerRefund: 0,
      platformFee: 0,
      expertCompensation: 0,
      policyType: ''
    };

    if (isSingleDay) {
      if (daysUntilTrip >= 2) {
        result = {
          travelerRefund: parseFloat((totalAmount * 0.5).toFixed(2)),
          platformFee: parseFloat((totalAmount * 0.5).toFixed(2)),
          expertCompensation: 0,
          policyType: '1-DAY: 48h+ before (50% refund)'
        };
      } else {
        result = {
          travelerRefund: 0,
          platformFee: parseFloat((totalAmount * 0.5).toFixed(2)),
          expertCompensation: parseFloat((totalAmount * 0.5).toFixed(2)),
          policyType: '1-DAY: <24h before (No refund)'
        };
      }
    } else {
      if (daysUntilTrip >= 7) {
        result = {
          travelerRefund: parseFloat((totalAmount * 0.8).toFixed(2)),
          platformFee: parseFloat((totalAmount * 0.2).toFixed(2)),
          expertCompensation: 0,
          policyType: '2+ DAYS: Before 1 week (80% refund)'
        };
      } else {
        result = {
          travelerRefund: 0,
          platformFee: parseFloat((totalAmount * 0.5).toFixed(2)),
          expertCompensation: parseFloat((totalAmount * 0.5).toFixed(2)),
          policyType: '2+ DAYS: <1 week (No refund)'
        };
      }
    }

    return result;
  },

  // Process refund via API
  processRefund: async (bookingId, reason) => {
    try {
      const response = await fetch('/api/expert-trips-payments/admin/refund/' + bookingId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Refund failed');
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Display policy on page
  showPolicyInfoBox: () => {
    return `
      <div style="background: linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(233,30,99,0.05) 100%); 
                  border: 1px solid rgba(255,152,0,0.3); border-radius: 12px; padding: 1.5rem; 
                  margin: 2rem 0; font-size: 0.95rem; line-height: 1.8;">
        <h3 style="color: #ff9800; margin-top: 0; margin-bottom: 1rem;">🔄 Cancellation & Refund Policy</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
          <div>
            <strong style="color: #ff9800; display: block; margin-bottom: 0.5rem;">1-DAY TRIPS</strong>
            <ul style="margin: 0; padding-left: 1.2rem; color: #e8f1ff;">
              <li><strong>48h+ before:</strong> Traveler 50% ↩️</li>
              <li><strong>&lt;24h before:</strong> No refund</li>
            </ul>
          </div>
          <div>
            <strong style="color: #ff9800; display: block; margin-bottom: 0.5rem;">2+ DAY TRIPS</strong>
            <ul style="margin: 0; padding-left: 1.2rem; color: #e8f1ff;">
              <li><strong>Before 1 week:</strong> Traveler 80% ↩️</li>
              <li><strong>&lt;1 week:</strong> No refund</li>
            </ul>
          </div>
        </div>
        
        <div style="background: rgba(76,175,80,0.1); border-left: 3px solid #4caf50; padding: 0.75rem 1rem; border-radius: 6px;">
          <strong style="color: #4caf50;">✓ Expert Protection:</strong> 
          Experts receive 50% compensation for last-minute cancellations (<24h or <1 week)
        </div>
      </div>
    `;
  }
};
