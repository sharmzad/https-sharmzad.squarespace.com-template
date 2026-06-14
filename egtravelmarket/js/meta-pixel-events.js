(function() {
  'use strict';

  window.MetaPixelEvents = {
    fired: {},

    safeTrack: function(eventName, params) {
      var eventKey = eventName + '_' + JSON.stringify(params || {});
      if (this.fired[eventKey]) {
        console.log('[Meta Pixel] Event already fired, skipping duplicate:', eventName);
        return false;
      }
      if (window.fbq) {
        fbq('track', eventName, params || {});
        this.fired[eventKey] = true;
        console.log('[Meta Pixel] Event tracked:', eventName, params || {});
        return true;
      } else {
        console.warn('[Meta Pixel] fbq not available');
        return false;
      }
    },

    trackSignupPageView: function() {
      this.safeTrack('ViewContent', { content_name: 'signup_page' });
    },

    trackSignupSubmit: function() {
      this.safeTrack('Lead', { lead_type: 'signup_submit' });
    },

    trackCompleteRegistration: function(userType) {
      this.safeTrack('CompleteRegistration', { user_type: userType });
    },

    trackServiceLead: function(serviceType) {
      this.safeTrack('Lead', { service_type: serviceType });
    },

    trackTravellerRequest: function() {
      this.safeTrack('Lead', { lead_type: 'traveller_request' });
    },

    trackPurchase: function(value, currency, bookingSource, expertType) {
      var params = {
        value: value || 0,
        currency: currency || 'USD',
        booking_source: bookingSource || 'website'
      };
      if (bookingSource === 'expert' && expertType) {
        params.expert_type = expertType;
      }
      this.safeTrack('Purchase', params);
    },

    trackContactLead: function() {
      this.safeTrack('Lead', { service_type: 'contact_inquiry' });
    },

    getUserTypeFromPage: function() {
      var path = window.location.pathname.toLowerCase();
      var title = document.title.toLowerCase();
      
      if (path.includes('guide') || title.includes('guide')) return 'guide';
      if (path.includes('diver') || title.includes('diver')) return 'diver';
      if (path.includes('agency') || title.includes('agency')) return 'travel_agency';
      if (path.includes('divecenter') || path.includes('dive-center') || title.includes('dive center')) return 'dive_center';
      if (path.includes('mentor') || title.includes('mentor')) return 'mentor';
      return 'unknown';
    },

    initSignupPage: function() {
      var self = this;
      
      this.trackSignupPageView();
      
      var form = document.getElementById('expert-signup-form') || 
                 document.querySelector('form[id*="signup"]') ||
                 document.querySelector('form');
      
      if (form && !form.dataset.metaPixelAttached) {
        form.dataset.metaPixelAttached = 'true';
        form.addEventListener('submit', function() {
          self.trackSignupSubmit();
        });
        console.log('[Meta Pixel] Signup form listener attached');
      }
    },

    initServicePage: function(serviceType) {
      var self = this;
      var forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        if (!form.dataset.metaPixelAttached) {
          form.dataset.metaPixelAttached = 'true';
          form.addEventListener('submit', function() {
            self.trackServiceLead(serviceType);
          });
        }
      });
    },

    initTravellerRequestPage: function() {
      var self = this;
      var forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        if (!form.dataset.metaPixelAttached) {
          form.dataset.metaPixelAttached = 'true';
          form.addEventListener('submit', function() {
            self.trackTravellerRequest();
          });
        }
      });
    },

    initBookingPage: function() {
      var self = this;
      var forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        if (!form.dataset.metaPixelAttached) {
          form.dataset.metaPixelAttached = 'true';
          form.addEventListener('submit', function() {
            var valueInput = form.querySelector('input[name="total"], input[name="price"], input[name="amount"], [data-booking-value]');
            var value = valueInput ? parseFloat(valueInput.value) || 0 : 0;
            self.trackPurchase(value, 'USD', 'trip_booking');
          });
        }
      });
    },

    initContactPage: function() {
      var self = this;
      var forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        if (!form.dataset.metaPixelAttached) {
          form.dataset.metaPixelAttached = 'true';
          form.addEventListener('submit', function() {
            self.trackContactLead();
          });
        }
      });
    },

    autoInit: function() {
      var path = window.location.pathname.toLowerCase();
      
      if (path.includes('signup') || path.includes('be-mentor')) {
        this.initSignupPage();
      }
      
      if (path.includes('mice')) {
        this.initServicePage('mice');
      }
      
      if (path.includes('dmc')) {
        this.initServicePage('dmc');
      }
      
      if (path.includes('medical')) {
        this.initServicePage('medical_insurance');
      }
      
      if (path.includes('travel-request') || path.includes('travelers-request')) {
        this.initTravellerRequestPage();
      }
      
      if (path.includes('book') || path.includes('booking')) {
        this.initBookingPage();
      }
      
      if (path.includes('contact')) {
        this.initContactPage();
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.MetaPixelEvents.autoInit();
    });
  } else {
    window.MetaPixelEvents.autoInit();
  }
})();
