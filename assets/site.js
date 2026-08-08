// Shared Sharmzad site JS
(function() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => navMenu.classList.toggle('open'));
        navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navMenu.classList.remove('open')));
    }

    const nav = document.getElementById('nav');
    if (nav) {
        window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 50));
    }

    // Booking form → WhatsApp
    const form = document.getElementById('bookForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const fd = new FormData(this);
            const parts = ['Ciao Sharmzad! Vorrei prenotare:%0A'];
            for (const [k, v] of fd.entries()) {
                if (!v) continue;
                const label = form.querySelector(`[name="${k}"]`)?.dataset.label || k;
                parts.push(`%0A*${label}:* ${v}`);
            }
            window.open(`https://wa.me/41765567633?text=${parts.join('')}`, '_blank');
        });
    }

    const dateInput = document.getElementById('fDate');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
})();
