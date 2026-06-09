/* =========================================================
   Easy Move Car Rental — interactive behaviour
   ========================================================= */
(function () {
  "use strict";

  var WHATSAPP = "201006690316"; // +20 100 669 0316

  /* ---------- current year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- nav scroll state + progress bar ---------- */
  var nav = document.getElementById("nav");
  var progress = document.getElementById("scrollProgress");

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (nav) nav.classList.toggle("scrolled", y > 40);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  function closeMenu() {
    if (!links) return;
    links.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
  }

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e, i) {
          if (e.isIntersecting) {
            // small stagger for siblings
            var delay = Math.min(i * 60, 240);
            e.target.style.transitionDelay = delay + "ms";
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* ---------- animated counters ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var dur = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.floor(eased * target);
      el.textContent = val >= 1000 ? val.toLocaleString() : val;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target >= 1000 ? target.toLocaleString() : target;
    }
    requestAnimationFrame(step);
  }
  var nums = document.querySelectorAll(".stat__num");
  if ("IntersectionObserver" in window) {
    var io2 = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            animateCount(e.target);
            io2.unobserve(e.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    nums.forEach(function (n) {
      io2.observe(n);
    });
  } else {
    nums.forEach(animateCount);
  }

  /* ---------- date helpers ---------- */
  function fmtDate(v) {
    if (!v) return "";
    var d = new Date(v + "T00:00:00");
    if (isNaN(d)) return v;
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function daysBetween(a, b) {
    var d1 = new Date(a), d2 = new Date(b);
    var diff = Math.round((d2 - d1) / 86400000);
    return diff > 0 ? diff : 0;
  }
  // sensible date defaults: pickup = tomorrow, return = +4 days
  function isoOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  document.querySelectorAll('input[name="pickup"]').forEach(function (inp) {
    inp.min = isoOffset(0);
    if (!inp.value) inp.value = isoOffset(1);
  });
  document.querySelectorAll('input[name="return"]').forEach(function (inp) {
    inp.min = isoOffset(1);
    if (!inp.value) inp.value = isoOffset(5);
  });
  // keep return >= pickup
  document.querySelectorAll('input[name="pickup"]').forEach(function (pk) {
    pk.addEventListener("change", function () {
      var form = pk.closest("form");
      var ret = form && form.querySelector('input[name="return"]');
      if (ret) {
        ret.min = pk.value;
        if (ret.value < pk.value) ret.value = pk.value;
      }
    });
  });

  /* ---------- build WhatsApp message + send ---------- */
  function sendToWhatsApp(data) {
    var nights = daysBetween(data.pickup, data["return"]);
    var lines = [
      "Hi Easy Move! 👋 I'd like to book a car in Sharm El Sheikh.",
      "",
      data.name ? "• Name: " + data.name : null,
      "• Car type: " + (data.car || "—"),
      "• Pick-up: " + (data.location || "—"),
      "• From: " + fmtDate(data.pickup),
      "• To: " + fmtDate(data["return"]) + (nights ? " (" + nights + " day" + (nights > 1 ? "s" : "") + ")" : ""),
      data.age ? "• Driver age: " + data.age : null,
      "",
      "Please send me your best price. Thanks!"
    ].filter(Boolean);

    var url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener");
  }

  function handleForm(form) {
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) {
        data[k] = v;
      });
      // gentle feedback
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        var orig = btn.innerHTML;
        btn.innerHTML = "Opening WhatsApp…";
        btn.disabled = true;
        setTimeout(function () {
          btn.innerHTML = orig;
          btn.disabled = false;
        }, 2200);
      }
      sendToWhatsApp(data);
    });
  }
  handleForm(document.getElementById("quickForm"));
  handleForm(document.getElementById("bookForm"));

  /* ---------- reserve buttons (fleet) prefill car type ---------- */
  document.querySelectorAll('.ride .btn--ghost').forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".ride");
      var name = card && card.querySelector("h3");
      if (name) {
        document.querySelectorAll('select[name="car"]').forEach(function (sel) {
          var val = name.textContent.trim();
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value.toLowerCase() === val.toLowerCase()) {
              sel.selectedIndex = i;
              break;
            }
          }
        });
      }
    });
  });
})();
