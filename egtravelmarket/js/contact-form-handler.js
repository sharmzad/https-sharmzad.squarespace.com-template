document.addEventListener('DOMContentLoaded', function() {
  const contactForms = document.querySelectorAll('.contact-form');
  const miceForms = document.querySelectorAll('.mice-form');
  
  contactForms.forEach(form => {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonContent = Array.from(submitButton.childNodes).map(node => node.cloneNode(true));
      
      submitButton.disabled = true;
      submitButton.textContent = '';
      const spinner = document.createElement('i');
      spinner.className = 'fa-solid fa-spinner fa-spin';
      submitButton.appendChild(spinner);
      submitButton.appendChild(document.createTextNode(' Sending...'));
      
      const formData = {
        name: form.querySelector('[name="name"]').value,
        email: form.querySelector('[name="email"]').value,
        phone: form.querySelector('[name="phone"]')?.value || '',
        subject: form.querySelector('[name="subject"]')?.value || '',
        message: form.querySelector('[name="message"]').value,
        formType: form.getAttribute('data-form-type') || 'General Contact'
      };
      
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          if (window.MetaPixelEvents) {
            window.MetaPixelEvents.trackContactLead();
          }
          alert('✅ Thank you! Your message has been sent successfully. We will get back to you soon.');
          form.reset();
        } else {
          alert('❌ Error: ' + (result.error || 'Failed to send message. Please try again.'));
        }
      } catch (error) {
        console.error('Form submission error:', error);
        alert('❌ Network error. Please check your connection and try again.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '';
        originalButtonContent.forEach(node => submitButton.appendChild(node));
      }
    });
  });
  
  miceForms.forEach(form => {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonContent = Array.from(submitButton.childNodes).map(node => node.cloneNode(true));
      
      submitButton.disabled = true;
      submitButton.textContent = '';
      const spinner = document.createElement('i');
      spinner.className = 'fa-solid fa-spinner fa-spin';
      submitButton.appendChild(spinner);
      submitButton.appendChild(document.createTextNode(' Sending...'));
      
      const company = form.querySelector('[name="company"]').value;
      const role = form.querySelector('[name="role"]').value;
      const eventType = form.querySelector('[name="eventType"]').value;
      const city = form.querySelector('[name="city"]').value;
      const attendees = form.querySelector('[name="attendees"]').value;
      const dates = form.querySelector('[name="dates"]').value;
      const budget = form.querySelector('[name="budget"]')?.value || 'Not specified';
      const requirements = form.querySelector('[name="requirements"]').value;
      
      const message = `MICE Event Request for Proposal

Company: ${company}
Role: ${role}

Event Details:
- Event Type: ${eventType}
- Preferred City: ${city}
- Number of Attendees: ${attendees}
- Event Dates: ${dates}
- Estimated Budget: ${budget}

Requirements & Special Requests:
${requirements}`;
      
      const formData = {
        name: company,
        email: form.querySelector('[name="email"]').value,
        phone: form.querySelector('[name="phone"]')?.value || '',
        subject: `MICE RFP - ${eventType} in ${city}`,
        message: message,
        formType: 'MICE Event RFP'
      };
      
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          if (window.MetaPixelEvents) {
            window.MetaPixelEvents.trackServiceLead('mice');
          }
          alert('✅ Thank you! Your RFP has been submitted successfully. Our MICE team will review it and send you a detailed proposal within 24 hours.');
          form.reset();
        } else {
          alert('❌ Error: ' + (result.error || 'Failed to submit RFP. Please try again.'));
        }
      } catch (error) {
        console.error('Form submission error:', error);
        alert('❌ Network error. Please check your connection and try again.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '';
        originalButtonContent.forEach(node => submitButton.appendChild(node));
      }
    });
  });
});
