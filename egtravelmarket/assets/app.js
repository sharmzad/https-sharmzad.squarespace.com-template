/* === EgyTravelMarket — Experts Module (Guides & Divers) === */

// Chat modal logic (frontend-only mock)
const modal = document.getElementById('chat-modal');
const modalTitle = document.getElementById('chat-with-name');
const chatTargetInput = document.getElementById('chat-target');
const openChat = (name) => {
  if (!modal) return;
  modal.classList.add('open');
  if (modalTitle) modalTitle.textContent = `Chat with ${name}`;
  if (chatTargetInput) chatTargetInput.value = name;
}
const closeChat = () => modal && modal.classList.remove('open');

// Delegate clicks for .chat-btn
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.chat-btn');
  if (btn){
    const name = btn.getAttribute('data-name') || 'Expert';
    openChat(name);
  }
  if (e.target.closest('[data-close-modal]')) closeChat();
});

// Fake send
const chatForm = document.getElementById('chat-form');
if (chatForm){
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const yourName = chatForm.querySelector('[name="your_name"]').value.trim();
    const message = chatForm.querySelector('[name="message"]').value.trim();
    if (!yourName || !message){
      alert('Please enter your name and message.');
      return;
    }
    // Here you will POST to backend later
    alert('Message sent! The expert will reply soon.');
    chatForm.reset();
    closeChat();
  });
}

// Helper to build WhatsApp links (if you use data-phone attributes)
document.querySelectorAll('a[data-wa]').forEach(a=>{
  const phone = a.getAttribute('data-wa');
  const text = encodeURIComponent('Hello! I found your profile on EgyTravelMarket and would like to chat.');
  a.href = `https://wa.me/${phone}?text=${text}`;
});
