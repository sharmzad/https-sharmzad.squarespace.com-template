// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
    } else {
        navbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
    }
});

// Update total price based on number of people
const personeSelect = document.getElementById('persone');
const totalAmount = document.getElementById('totalAmount');
const PACKAGE_PRICE = 80;

function updateTotal() {
    const value = personeSelect.value;
    let people = parseInt(value);
    if (value === '5+') people = 5;
    const total = PACKAGE_PRICE * people;
    const suffix = value === '5+' ? '+' : '';
    totalAmount.textContent = `${total}${suffix}€`;
}

personeSelect.addEventListener('change', updateTotal);
updateTotal();

// Set minimum date to today
const dateInput = document.getElementById('data');
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

// Form submission
const bookingForm = document.getElementById('bookingForm');
bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(bookingForm);
    const nome = formData.get('nome');
    const email = formData.get('email');
    const telefono = formData.get('telefono');
    const data = formData.get('data');
    const persone = formData.get('persone');
    const hotel = formData.get('hotel') || 'Non specificato';
    const messaggio = formData.get('messaggio') || 'Nessuno';

    const message = `Ciao Sharmzad! Vorrei prenotare il Pacchetto Combo 80€%0A%0A` +
        `*Nome:* ${nome}%0A` +
        `*Email:* ${email}%0A` +
        `*Telefono:* ${telefono}%0A` +
        `*Data:* ${data}%0A` +
        `*Persone:* ${persone}%0A` +
        `*Hotel:* ${hotel}%0A` +
        `*Messaggio:* ${messaggio}`;

    const whatsappUrl = `https://wa.me/201000000000?text=${message}`;

    const button = bookingForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.textContent = 'Richiesta Inviata! ✓';
    button.style.background = 'linear-gradient(135deg, #25d366, #1ea952)';

    setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        button.textContent = originalText;
        button.style.background = '';
        bookingForm.reset();
        updateTotal();
    }, 1500);
});

// Intersection observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.experience-card, .feature-card, .testimonial-card, .stat').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});
