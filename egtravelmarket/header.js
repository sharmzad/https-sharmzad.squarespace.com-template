/* ========================= header.js ========================= */
const body = document.body;
const drawer = document.getElementById("mobile-drawer");
const overlay = document.getElementById("overlay");
const openBtn = document.getElementById("menuToggle");
const closeBtn = document.getElementById("menuClose");
const focusableSelectors =
  'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
let lastFocused = null;

function openMenu() {
  lastFocused = document.activeElement;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  overlay.classList.add("show");
  openBtn.setAttribute("aria-expanded", "true");
  body.style.overflow = "hidden";
  const first = drawer.querySelector(focusableSelectors);
  if (first) first.focus();
  document.addEventListener("keydown", onKeydown);
}

function closeMenu() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.classList.remove("show");
  setTimeout(() => {
    overlay.hidden = true;
  }, 200);
  openBtn.setAttribute("aria-expanded", "false");
  body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
  if (lastFocused) lastFocused.focus();
}

function onKeydown(e) {
  if (e.key === "Escape") return closeMenu();
  if (e.key === "Tab") {
    const nodes = [...drawer.querySelectorAll(focusableSelectors)];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

if (openBtn) openBtn.addEventListener("click", openMenu);
if (closeBtn) closeBtn.addEventListener("click", closeMenu);
if (overlay) overlay.addEventListener("click", closeMenu);
if (drawer)
  drawer.addEventListener("click", (e) => {
    const t = e.target.closest("a");
    if (t) closeMenu();
  });

/* ========================= Dropdown hover fix ========================= */
// Enhanced hover handling for desktop dropdown menus
document.querySelectorAll('.has-sub').forEach(item => {
  item.addEventListener('mouseenter', () => {
    const menu = item.querySelector('.mega');
    if (menu) menu.style.display = 'grid';
  });
  item.addEventListener('mouseleave', () => {
    const menu = item.querySelector('.mega');
    if (menu) menu.style.display = 'none';
  });
});
