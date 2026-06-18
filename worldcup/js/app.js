/*
 * Gang Cup 2026 — World Cup prediction game for the gang 🏆
 *
 * Live scores : ESPN public scoreboard API (free, no key, CORS enabled)
 * Shared data : Firebase Firestore (free Spark tier) — players + predictions
 * Scoring     : correct winner (1X2) 2 pts + exact score bonus 5 pts (max 7)
 * Lock        : predictions close 60 minutes before kickoff
 *               (launch day June 12 only: open until 5 min AFTER kickoff)
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const POINTS = { EXACT: 5, WINNER: 2 };
const LOCK_MINUTES = 60;
// Launch-day grace: the gang joined mid-matchday, so matches on this local
// date stay open until ~end of the first half (45 min + stoppage).
const GRACE_DAY = "2026-06-12";
const GRACE_AFTER_MIN = 50;
const TOURNAMENT_RANGE = "20260611-20260719"; // WC2026: Jun 11 – Jul 19
const ESPN_URL =
  `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` +
  `?dates=${TOURNAMENT_RANGE}&limit=200`;
const SUMMARY_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
const POLL_MS = 60_000;
const EMOJIS = ["🦁", "🐺", "🦅", "🐉", "🦂", "🐍", "🦈", "🐅", "🦍", "🐎", "🦊", "🐢",
  "🐻", "🐼", "🐨", "🐯", "🦄", "🐗", "🦏", "🦛", "🐊", "🦅", "🦇", "🐙",
  "🦖", "🐲", "🦬", "🐆", "🦣", "🦓"];
const ADMIN_NAME = "Alaa"; // only this player sees the notifier health pill

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let matches = [];          // normalized ESPN matches, sorted by kickoff
let players = [];          // [{id, name, emoji}]
let predictions = {};      // { `${matchId}_${playerId}`: {matchId, playerId, home, away, updatedAtMs} }
let me = JSON.parse(localStorage.getItem("gangcup_me") || "null");
let db = null, fs = null;  // Firestore handle + module
let fbApp = null;          // Firebase app (needed for messaging)
let activeTab = "matches";
let matchFilter = "today";
let draft = {};            // unsaved stepper values { matchId: {home, away} }
let health = null;         // notifier heartbeat doc (admin-only indicator)
let standingsSnap = null;  // { ranks, prevRanks } from the notifier, for movement arrows
let expandedMatch = null;  // match id whose detail panel is open
let matchDetails = {};     // cache: matchId -> { goals, stats } | { error: true }
let analyticsLog = null;   // Google Analytics logEvent (when Analytics is enabled)
let whatsNewShown = false; // "What's New" pop-up shown this session

const $ = (sel) => document.querySelector(sel);
const view = $("#view");

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
init();

async function init() {
  bindChrome();
  // Only a live exact-score celebration skips the Euro Car intro. The "What's
  // New" card is a non-blocking notification shown AFTER the intro.
  const celeb = getActiveCelebration();
  setupSponsor(!!celeb);
  if (celeb) showCelebration(celeb);
  else if (!window.SPONSOR && announcementPending()) setTimeout(maybeShowWhatsNew, 1500);
  await initFirebase();
  if (!me && db) await tryRestoreLogin();
  if (db) refreshPushToken();           // keep this device's push token fresh
  await loadMatches();
  render();
  setInterval(async () => { await loadMatches(); render(); }, POLL_MS);
}

// ---------------------------------------------------------------------------
// Sponsor branding (see SPONSOR in firebase-config.js; hidden when null)
// ---------------------------------------------------------------------------
function setupSponsor(skipIntro) {
  const s = window.SPONSOR;
  if (!s || !s.name) return;

  // slim strip above the tab menu
  const strip = $("#sponsorStrip");
  if (s.link) strip.href = s.link;
  strip.innerHTML =
    (s.logo ? `<img src="${esc(s.logo)}" alt="" onerror="this.remove()">` : "🚗") +
    `<span>Sponsored by <b>${esc(s.name)}</b></span>` +
    (s.cta ? `<span class="cta">${esc(s.cta)}</span>` : "");
  strip.classList.remove("hidden");
  // keep page content clear of the taller bottom dock
  const dock = document.querySelector(".bottom-dock");
  if (dock) document.body.style.paddingBottom = `${dock.offsetHeight + 12}px`;

  if (!skipIntro) playSponsorIntro(s);
}

// ---------------------------------------------------------------------------
// One-time fireworks announcement (shown once per device on open)
// ---------------------------------------------------------------------------
function announcementPending() {
  const a = window.ANNOUNCEMENT;
  if (!a || !a.id) return false;
  if (a.until) return Date.now() < new Date(a.until).getTime();   // replay until expiry
  return !localStorage.getItem(`announce_${a.id}`);               // else once per device
}

// "What's New" notification card — shown once per app launch, after the intro
function maybeShowWhatsNew() {
  if (whatsNewShown || !announcementPending()) return;
  whatsNewShown = true;
  const a = window.ANNOUNCEMENT, el = $("#whatsnew");
  if (!a || !el) return;
  if (a.emoji) $("#wnIcon").textContent = a.emoji;
  $("#wnTitle").textContent = `What's New${a.version ? ` · v${a.version}` : ""}`;
  $("#wnBody").textContent = a.body || "";
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 450);
  };
  $("#wnClose").onclick = close;
  setTimeout(close, 12000); // auto-dismiss
}

function showAnnouncement() {
  const a = window.ANNOUNCEMENT;
  const el = $("#announce");
  if (!a || !el) return;
  if (!a.until) localStorage.setItem(`announce_${a.id}`, "1");   // only mark seen in once-per-device mode
  if (a.emoji) $("#announceEmoji").textContent = a.emoji;
  $("#announceTitle").textContent = a.title || "🎉";
  el.classList.remove("hidden");
  fillAnnouncement();   // body (with player names) — refreshed again once data loads

  const stop = runFireworks($("#fireworks"), 7000);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    if (stop) stop();
    el.classList.add("done");
    setTimeout(() => el.classList.add("hidden"), 500);
  };
  $("#announceClose").onclick = close;
  setTimeout(close, 8000);
}

// Players who predicted the exact final score named in ANNOUNCEMENT.exact
function announcementExactNames() {
  const ex = window.ANNOUNCEMENT?.exact;
  if (!ex || !matches.length) return [];
  const m = matches
    .filter((x) => x.completed && x.home.score === ex.home && x.away.score === ex.away &&
      [x.home.name, x.away.name].some((n) => n.toLowerCase().includes(ex.team.toLowerCase())))
    .sort((a, b) => b.kickoff - a.kickoff)[0];
  if (!m) return [];
  return players
    .filter((p) => {
      const pr = predictions[`${m.id}_${p.id}`];
      return pr && isValidPrediction(pr, m) && pr.home === m.home.score && pr.away === m.away.score;
    })
    .map((p) => `${p.emoji} ${p.name}`);
}

// Fill the announcement body, injecting live player names for {names}.
function fillAnnouncement() {
  const a = window.ANNOUNCEMENT, el = $("#announce");
  if (!a || !el || el.classList.contains("hidden")) return;
  let text = a.body || "";
  if (text.includes("{names}")) {
    const names = announcementExactNames();
    text = text.replace("{names}", names.length ? names.join(" & ") : "Someone");
  }
  $("#announceBody").textContent = text;
}

// Active exact-score celebration cached from Firestore (null when expired).
function getActiveCelebration() {
  try {
    const c = JSON.parse(localStorage.getItem("active_celebration") || "null");
    return c && c.until > Date.now() ? c : null;
  } catch { return null; }
}

// Show the fireworks celebration once per app launch (per celebration id).
function showCelebration(c) {
  const el = $("#announce");
  if (!el || !c || !c.id) return;
  if (sessionStorage.getItem(`celeb_${c.id}`)) return;
  sessionStorage.setItem(`celeb_${c.id}`, "1");
  $("#announceTitle").textContent = c.title || "🎯 EXACT SCORE!";
  $("#announceBody").textContent = c.body || "";
  el.classList.remove("hidden");
  const stop = runFireworks($("#fireworks"), 7000);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    if (stop) stop();
    el.classList.add("done");
    setTimeout(() => el.classList.add("hidden"), 500);
  };
  $("#announceClose").onclick = close;
  setTimeout(close, 8000);
}

// Compact canvas fireworks; returns a stop() function.
function runFireworks(canvas, duration) {
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;
  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  const colors = ["#f4c542", "#35d07f", "#19b6e6", "#ff6b6b", "#ffffff", "#ff9ff3", "#feca57"];
  const parts = [], rockets = [];
  const start = performance.now();
  let lastLaunch = 0, raf = 0, running = true;

  const explode = (x, y, c) => {
    const n = 48;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.12;
      const sp = 1.5 + Math.random() * 4.5;
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, a: 1, c });
    }
  };

  const loop = (t) => {
    if (!running) return;
    const el = t - start;
    ctx.fillStyle = "rgba(6,15,9,0.25)";
    ctx.fillRect(0, 0, W, H);

    if (el < duration - 1200 && t - lastLaunch > 380) {
      lastLaunch = t;
      rockets.push({
        x: W * (0.15 + Math.random() * 0.7), y: H,
        ty: H * (0.16 + Math.random() * 0.32),
        c: colors[(Math.random() * colors.length) | 0],
      });
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.y -= 9;
      ctx.globalAlpha = 1; ctx.fillStyle = r.c;
      ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, 7); ctx.fill();
      if (r.y <= r.ty) { explode(r.x, r.y, r.c); rockets.splice(i, 1); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += 0.06; p.x += p.vx; p.y += p.vy; p.a -= 0.012;
      if (p.a <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(p.a, 0); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (el < duration || parts.length || rockets.length) raf = requestAnimationFrame(loop);
    else { running = false; window.removeEventListener("resize", resize); }
  };
  raf = requestAnimationFrame(loop);
  return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

// Animated motion-graphics intro, once per app launch (per browser session)
function playSponsorIntro(s) {
  // play on every app open
  const intro = $("#sponsorIntro");
  if (!intro) return;

  // logo if provided, otherwise an animated two-tone wordmark from the name
  if (s.logo) {
    const lg = $("#introLogo");
    lg.src = s.logo;
    lg.onerror = () => { lg.classList.add("hidden"); $("#introWordmark").classList.remove("hidden"); };
    lg.classList.remove("hidden");
    $("#introWordmark").classList.add("hidden");
  } else {
    const parts = s.name.trim().split(/\s+/);
    const head = esc(parts.shift());
    const tail = esc(parts.join(" "));
    $("#introWordmark").innerHTML = `<span class="a">${head}</span>${tail ? ` <span class="b">${tail}</span>` : ""}`;
  }
  $("#introTagline").textContent = s.tagline || "";

  intro.classList.remove("hidden");
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return; dismissed = true;
    intro.classList.add("done");
    setTimeout(() => intro.classList.add("hidden"), 600);
    setTimeout(maybeShowWhatsNew, 700);   // show the What's New card after the intro
  };
  const timer = setTimeout(dismiss, 8600);
  $("#introSkip").onclick = () => { clearTimeout(timer); dismiss(); };
}

// Silently re-register this device's push token on every app open. iOS
// invalidates web-push tokens when the app updates / is re-added to the Home
// Screen, so refreshing here keeps the stored token valid and self-heals
// delivery without the player having to tap the bell again.
async function refreshPushToken() {
  try {
    if (!window.VAPID_KEY || localStorage.getItem("gangcup_notif") !== "1") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
    if (!(await msgMod.isSupported())) return;
    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const token = await msgMod.getToken(msgMod.getMessaging(fbApp), {
      vapidKey: window.VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return;
    localStorage.setItem("gangcup_fcm", token);
    await fs.setDoc(fs.doc(db, "tokens", token), {
      token,
      player: me?.name || "anonymous",
      playerId: me?.id || null,
      updatedAt: fs.serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn("Push token refresh failed", err);
  }
}

// one-line sponsor footer for WhatsApp messages ("" when no sponsor)
function sponsorFooter() {
  const s = window.SPONSOR;
  if (!s || !s.name) return "";
  return `\n\n🚗 Powered by *${s.name}*${s.link ? ` · ${s.link}` : ""}`;
}

// Persist login in localStorage + a long-lived cookie (iOS clears storage
// more eagerly than cookies, e.g. when the app is re-added to Home Screen).
function saveLogin() {
  const v = JSON.stringify(me);
  localStorage.setItem("gangcup_me", v);
  document.cookie = `gangcup_me=${encodeURIComponent(v)};max-age=31536000;path=/;SameSite=Lax`;
  renderChip();
}

function clearLogin() {
  me = null;
  localStorage.removeItem("gangcup_me");
  document.cookie = "gangcup_me=;max-age=0;path=/";
  renderChip();
}

// Try to recover the login without asking for name/PIN again:
// 1. backup cookie; 2. this device's notification registration, which
// remembers which player enabled it.
async function tryRestoreLogin() {
  try {
    const c = document.cookie.match(/(?:^|;\s*)gangcup_me=([^;]+)/);
    if (c) {
      me = JSON.parse(decodeURIComponent(c[1]));
      if (me?.id) { saveLogin(); return; }
      me = null;
    }
    if (!window.VAPID_KEY || !("Notification" in window) || Notification.permission !== "granted") return;
    const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
    if (!(await msgMod.isSupported())) return;
    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const token = await msgMod.getToken(msgMod.getMessaging(fbApp), {
      vapidKey: window.VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return;
    localStorage.setItem("gangcup_fcm", token);
    const tok = await fs.getDoc(fs.doc(db, "tokens", token));
    const playerId = tok.exists() ? tok.data().playerId : null;
    if (!playerId) return;
    const ps = await fs.getDoc(fs.doc(db, "players", playerId));
    if (ps.exists()) {
      me = { id: playerId, name: ps.data().name, emoji: ps.data().emoji };
      saveLogin();
      toast(`${me.emoji} Welcome back, ${me.name}!`);
    }
  } catch (err) {
    console.warn("Login restore failed", err);
  }
}

function bindChrome() {
  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      b.classList.add("active");
      activeTab = b.dataset.tab;
      render();
    })
  );
  $("#playerChip").addEventListener("click", () => {
    if (me) {
      if (confirm(`Logged in as ${me.emoji} ${me.name}. Log out on this device?`)) {
        clearLogin();
        render();
      }
    } else openJoinModal();
  });
  renderChip();
  const bell = $("#bellBtn");
  bell.classList.toggle("on", localStorage.getItem("gangcup_notif") === "1");
  bell.addEventListener("click", enableNotifications);
  // admin (Alaa) taps the health pill to open the analytics dashboard
  $("#adminHealth").addEventListener("click", () => {
    if (me && me.name === ADMIN_NAME) openDashboard();
  });
  $("#dashClose").addEventListener("click", () => $("#dashModal").classList.add("hidden"));
}

// ---------------------------------------------------------------------------
// Admin analytics dashboard (Alaa only)
// ---------------------------------------------------------------------------
function trackEvent(name, params) { if (analyticsLog) analyticsLog(name, params); }

function openDashboard() {
  const todayKey = new Date().toLocaleDateString("en-CA");
  const isToday = (ms) => ms && new Date(ms).toLocaleDateString("en-CA") === todayKey;
  const preds = Object.values(predictions);
  const total = preds.length;
  const predsToday = preds.filter((p) => isToday(p.updatedAtMs));
  const activeIds = new Set(predsToday.map((p) => p.playerId));

  const byPlayer = {};
  preds.forEach((p) => { byPlayer[p.playerId] = (byPlayer[p.playerId] || 0) + 1; });
  let topId = null, topN = 0;
  for (const [id, n] of Object.entries(byPlayer)) if (n > topN) { topN = n; topId = id; }
  const top = players.find((p) => p.id === topId);
  const avg = players.length ? (total / players.length).toFixed(1) : "0";

  const next = matches.filter((m) => isOpen(m)).sort((a, b) => a.kickoff - b.kickoff)[0];
  const nextBets = next ? preds.filter((p) => p.matchId === next.id).length : 0;

  const devices = health && health.devices != null ? health.devices : "—";
  const notifAgo = (() => {
    const t = health?.at?.toMillis?.();
    if (!t) return "—";
    const m = Math.round((Date.now() - t) / 60000);
    return m <= 0 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
  })();

  const card = (icon, label, value, sub) => `
    <div class="dash-cell">
      <div class="dash-val">${icon} ${value}</div>
      <div class="dash-label">${label}</div>
      ${sub ? `<div class="dash-sub">${sub}</div>` : ""}
    </div>`;

  $("#dashBody").innerHTML =
    card("👥", "Players", players.length) +
    card("🟢", "Active today", activeIds.size, "made a pick today") +
    card("🎯", "Predictions", total, `${predsToday.length} today`) +
    card("📈", "Avg / player", avg) +
    card("🔥", "Most active", top ? `${top.emoji}` : "—", top ? `${esc(top.name)} · ${topN} picks` : "") +
    card("🔔", "Notif devices", devices, `notifier ${notifAgo}`) +
    (next ? card("⏭️", "Next match bets", nextBets, `${esc(next.home.abbr)}–${esc(next.away.abbr)}`) : "");

  $("#dashModal").classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Push notifications (Firebase Cloud Messaging)
// ---------------------------------------------------------------------------
async function enableNotifications() {
  if (!db || !window.VAPID_KEY) {
    toast("🔔 Notifications aren't configured yet — ask the admin!");
    return;
  }
  // Apple only allows web push for apps installed on the Home Screen
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (isIOS && !standalone) {
    toast("📲 iPhone: tap Share → Add to Home Screen, then open the app from the new icon and press 🔔 again!");
    return;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    toast("🔕 This browser can't do push — needs iOS 16.4+ or Chrome on Android.");
    return;
  }
  try {
    const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
    if (!(await msgMod.isSupported())) {
      toast("🔕 Push isn't supported in this browser — try Chrome, or update iOS to 16.4+.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      toast(isIOS
        ? "🔕 Blocked. iPhone Settings → El 3eshّa WC26 → Notifications → Allow, then tap 🔔 again."
        : "🔕 Blocked. Tap the 🔒 (or ⓘ) icon left of the address bar → Permissions/Notifications → Allow, then tap 🔔 again.");
      return;
    }
    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const messaging = msgMod.getMessaging(fbApp);
    const token = await msgMod.getToken(messaging, {
      vapidKey: window.VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) throw new Error("No FCM token");
    localStorage.setItem("gangcup_fcm", token);
    await fs.setDoc(fs.doc(db, "tokens", token), {
      token,
      player: me?.name || "anonymous",
      playerId: me?.id || null,
      updatedAt: fs.serverTimestamp(),
    });
    localStorage.setItem("gangcup_notif", "1");
    $("#bellBtn").classList.add("on");
    msgMod.onMessage(messaging, (p) => {
      const d = p.data || p.notification || {};
      if (d.title) toast(`${d.title} — ${d.body || ""}`);
    });
    // Immediate proof this device can show notifications (tests permission +
    // service worker; the banner appears even clearer when the app is backgrounded).
    try {
      await reg.showNotification("✅ El 3eshّa WC26", {
        body: "Test — notifications are working on this device! 🔔",
        icon: "group.jpg", badge: "group.jpg",
      });
    } catch { /* ignore */ }
    trackEvent("notifications_enabled");
    toast("🔔 Device registered — sent a test notification. Lock your phone to see banners!");
  } catch (err) {
    console.error("Notifications failed", err);
    toast(`⚠️ ${err?.code || err?.message || "Couldn't enable notifications on this device."}`);
  }
}

function renderChip() {
  $("#playerChip").textContent = me ? `${me.emoji} ${me.name}` : "👤 Join";
}

// ---------------------------------------------------------------------------
// Firebase (predictions + players, real-time)
// ---------------------------------------------------------------------------
async function initFirebase() {
  if (!window.FIREBASE_CONFIG) {
    showBanner(
      `⚙️ <b>Scores-only mode.</b> Predictions are disabled until the admin connects ` +
      `the free Firebase database — see <a href="https://github.com/sharmzad/https-sharmzad.squarespace.com-template/blob/master/worldcup/README.md" target="_blank">setup guide</a> (5 min).`
    );
    return;
  }
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    fbApp = initializeApp(window.FIREBASE_CONFIG);
    db = fs.getFirestore(fbApp);

    // Google Analytics — activates once Analytics is enabled (measurementId set)
    if (window.FIREBASE_CONFIG.measurementId) {
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js")
        .then((m) => {
          const inst = m.getAnalytics(fbApp);
          analyticsLog = (name, params) => { try { m.logEvent(inst, name, params || {}); } catch {} };
        })
        .catch((e) => console.warn("Analytics unavailable", e));
    }

    fs.onSnapshot(fs.collection(db, "players"), (snap) => {
      players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    });
    fs.onSnapshot(fs.collection(db, "predictions"), (snap) => {
      predictions = {};
      snap.docs.forEach((d) => {
        const p = d.data();
        predictions[d.id] = { ...p, updatedAtMs: p.updatedAt?.toMillis?.() ?? Date.now() };
      });
      render();
    });
    // notifier heartbeat — drives the admin-only "live" pill
    fs.onSnapshot(fs.doc(db, "health", "notify"), (d) => {
      health = d.exists() ? d.data() : null;
      renderAdminHealth();
    });
    // exact-score celebration — auto-set by the notifier, active for 1h after FT
    fs.onSnapshot(fs.doc(db, "health", "celebration"), (d) => {
      const data = d.exists() ? d.data() : null;
      const until = data?.until?.toMillis?.() ?? data?.until ?? 0;
      if (data && until > Date.now()) {
        const c = { id: data.id || "celebration", title: data.title, body: data.body, until };
        localStorage.setItem("active_celebration", JSON.stringify(c));
        showCelebration(c);
      } else {
        localStorage.removeItem("active_celebration");
      }
    });
    // rank snapshot (prev vs current) for the standings movement arrows
    fs.onSnapshot(fs.doc(db, "health", "standings"), (d) => {
      standingsSnap = d.exists() ? d.data() : null;
      render();
    });
  } catch (err) {
    console.error("Firebase init failed", err);
    showBanner("⚠️ Could not connect to the game database. Live scores still work.");
  }
}

// ---------------------------------------------------------------------------
// ESPN live scores
// ---------------------------------------------------------------------------
async function loadMatches() {
  try {
    const res = await fetch(ESPN_URL);
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();
    matches = (data.events || []).map(normalizeEvent).sort((a, b) => a.kickoff - b.kickoff);
  } catch (err) {
    console.error("Score fetch failed", err);
    if (!matches.length) {
      showBanner("⚠️ Couldn't load fixtures from ESPN right now — will keep retrying every minute.");
    }
  }
}

function normalizeEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const status = comp.status || ev.status || {};
  const side = (ha) => {
    const c = (comp.competitors || []).find((x) => x.homeAway === ha) || {};
    return {
      name: c.team?.shortDisplayName || c.team?.displayName || "TBD",
      abbr: c.team?.abbreviation || "TBD",
      logo: c.team?.logo || "",
      score: c.score != null ? Number(c.score) : null,
    };
  };
  return {
    id: ev.id,
    kickoff: new Date(ev.date),
    state: status.type?.state || "pre",            // pre | in | post
    completed: !!status.type?.completed,
    period: status.period ?? 0,                    // 1 = first half, 2 = second half
    detail: status.type?.shortDetail || "",
    group: comp.notes?.[0]?.headline || ev.season?.slug || "",
    home: side("home"),
    away: side("away"),
  };
}

// Admin overrides: matches listed here stay open for betting until half time
// (kickoff + GRACE_AFTER_MIN), ignoring the normal pre-kickoff lock.
// Match by team abbreviation or name (both must hit).
const OPEN_OVERRIDES = [
  ["KOR", "CZE"], // South Korea vs Czechia — opened on the gang's request
];

const isOverridden = (m) =>
  OPEN_OVERRIDES.some((pair) =>
    pair.every((t) =>
      [m.home.abbr, m.home.name, m.away.abbr, m.away.name].some(
        (n) => n && n.toLowerCase().includes(t.toLowerCase())
      )
    )
  );

const dayKey = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

function lockTime(m) {
  if (dayKey(m.kickoff) === GRACE_DAY) {
    return new Date(m.kickoff.getTime() + GRACE_AFTER_MIN * 60_000);
  }
  return new Date(m.kickoff.getTime() - LOCK_MINUTES * 60_000);
}

// Overridden matches use the live match status, not the clock: open before
// kickoff, through the 1st half and the half-time break; closed once the
// 2nd half starts.
const overrideStillOpen = (m) =>
  m.state === "pre" || m.period === 1 || /half\s?time/i.test(m.detail);

function isOpen(m) {
  if (m.completed) return false;
  if (isOverridden(m)) return overrideStillOpen(m);
  return Date.now() < lockTime(m).getTime();
}

// ---------------------------------------------------------------------------
// Scoring — two predictions per match: winner (1X2) + exact score
// ---------------------------------------------------------------------------
const resultOf = (hs, as) => (hs > as ? "home" : hs < as ? "away" : "draw");

// The winner is taken from the score when the score is decisive (a 0–2 can't be
// a "draw" — that's a mis-tap). For a drawn score, the explicit pick stands
// (lets you back a team to win while leaving the exact guess at a draw).
const predWinner = (pred) => {
  const dir = resultOf(pred.home, pred.away);
  return dir !== "draw" ? dir : (pred.winner || "draw");
};

function scorePrediction(pred, hs, as) {
  let pts = 0;
  if (predWinner(pred) === resultOf(hs, as)) pts += POINTS.WINNER;
  if (pred.home === hs && pred.away === as) pts += POINTS.EXACT;
  return pts;
}

// A prediction only counts if it was saved before the lock (server timestamp).
// Overridden matches accept every saved prediction (the UI gates saving).
const isValidPrediction = (pred, m) =>
  isOverridden(m) || pred.updatedAtMs <= lockTime(m).getTime();

// Admin-granted grace points (see BONUS_POINTS in firebase-config.js)
function bonusFor(name) {
  const b = window.BONUS_POINTS || {};
  return b[name] !== undefined ? b[name] : (b["*"] || 0);
}

function buildStandings(live = false) {
  const rows = players.map((p) => ({ ...p, pts: bonusFor(p.name), exact: 0, outcomes: 0, played: 0, livePts: 0 }));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const m of matches) {
    const final = m.completed && m.home.score != null;
    const inPlay = live && m.state === "in" && m.home.score != null;
    if (!final && !inPlay) continue;
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      const r = byId[p.id];
      const pts = scorePrediction(pred, m.home.score, m.away.score);
      r.pts += pts;
      if (final) {
        r.played++;
        if (pred.home === m.home.score && pred.away === m.away.score) r.exact++;
        if (predWinner(pred) === resultOf(m.home.score, m.away.score)) r.outcomes++;
      } else {
        r.livePts += pts; // provisional, from an in-progress match
      }
    }
  }
  // "Only winner" bonus: sole scorer on a completed match (from RULES.bonusFrom)
  const owb = onlyWinnerBonuses();
  for (const [id, b] of Object.entries(owb)) if (byId[id]) byId[id].pts += b;
  // "Underdog" bonus: correctly backed the lower-ranked team to win
  const udb = underdogBonuses();
  for (const [id, b] of Object.entries(udb)) if (byId[id]) byId[id].pts += b;

  return rows.sort(
    (a, b) => b.pts - a.pts || b.exact - a.exact || b.outcomes - a.outcomes || a.name.localeCompare(b.name)
  );
}

// The lower-FIFA-ranked side if it WON a decisive match (the "upset" winner),
// else null. Used for the underdog bonus.
function upsetWinSide(m) {
  if (m.home.score == null) return null;
  const res = resultOf(m.home.score, m.away.score);
  if (res === "draw") return null;
  const rh = fifaRank(m.home.name), ra = fifaRank(m.away.name);
  if (rh == null || ra == null) return null;
  if (res === "home" && rh > ra) return "home"; // home won and is ranked worse
  if (res === "away" && ra > rh) return "away";
  return null;
}

// { playerId: bonusPoints } — +RULES.underdogBonus to players who correctly
// backed the lower-ranked winner, counted from RULES.bonusFrom.
function underdogBonuses() {
  const R = window.RULES || {};
  const out = {};
  if (!R.underdogBonus) return out;
  const fromMs = R.bonusFrom ? Date.parse(R.bonusFrom) : 0;
  for (const m of matches) {
    if (!m.completed || m.home.score == null || m.kickoff.getTime() < fromMs) continue;
    const side = upsetWinSide(m);
    if (!side) continue;
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      if (predWinner(pred) === side) out[p.id] = (out[p.id] || 0) + R.underdogBonus;
    }
  }
  return out;
}

// { playerId: bonusPoints } — +RULES.onlyWinnerBonus to the lone scorer of each
// completed match (everyone else got 0), counted only from RULES.bonusFrom.
function onlyWinnerBonuses() {
  const R = window.RULES || {};
  const out = {};
  if (!R.onlyWinnerBonus) return out;
  const fromMs = R.bonusFrom ? Date.parse(R.bonusFrom) : 0;
  for (const m of matches) {
    if (!m.completed || m.home.score == null) continue;
    if (m.kickoff.getTime() < fromMs) continue;
    const scorers = [];
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      if (scorePrediction(pred, m.home.score, m.away.score) > 0) scorers.push(p.id);
    }
    if (scorers.length === 1) out[scorers[0]] = (out[scorers[0]] || 0) + R.onlyWinnerBonus;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  renderAdminHealth();
  fillAnnouncement();   // reveal exact-score player names once data is loaded
  if (activeTab === "matches") renderMatches();
  else if (activeTab === "table") renderTable();
  else if (activeTab === "share") renderShare();
  else renderRules();
}

// Admin-only (Alaa) pill showing the notifier heartbeat. Hidden for everyone else.
function renderAdminHealth() {
  const el = $("#adminHealth");
  if (!el) return;
  if (!me || me.name !== ADMIN_NAME || !health) { el.classList.add("hidden"); return; }

  const ms = health.at?.toMillis?.() ? Date.now() - health.at.toMillis() : null;
  const mins = ms == null ? null : Math.round(ms / 60000);
  let status = "bad", label = "notifier offline";
  if (mins != null && mins <= 12) { status = "ok"; label = "notifier live"; }
  else if (mins != null && mins <= 30) { status = "warn"; label = "notifier slow"; }

  const ago = mins == null ? "never"
    : mins <= 0 ? "just now"
    : mins < 60 ? `${mins} min ago`
    : `${Math.round(mins / 60)} h ago`;
  const extra = health.messages != null ? ` · last run sent ${health.messages}` : "";
  const fail = health.failures ? ` · ⚠️ ${health.failures} failed` : "";

  el.className = `admin-health ${status}`;
  el.innerHTML = `<span class="dot"></span>${label} · updated ${ago}${extra}${fail}`;
  el.classList.remove("hidden");
}

function renderMatches() {
  const today = new Date();
  const sameDay = (d) => d.toDateString() === today.toDateString();
  let list = matches;
  if (matchFilter === "today") list = matches.filter((m) => sameDay(m.kickoff));
  else if (matchFilter === "upcoming") list = matches.filter((m) => m.state === "pre");
  else if (matchFilter === "finished") list = matches.filter((m) => m.completed);

  const pills = ["today", "upcoming", "finished", "all"]
    .map((f) => `<button class="pill ${f === matchFilter ? "active" : ""}" data-filter="${f}">${cap(f)}</button>`)
    .join("");

  let html = `<div class="pills">${pills}</div>`;
  if (!list.length) {
    html += `<div class="empty">😴 No matches here.<br>${
      matchFilter === "today" ? "Check <b>Upcoming</b> for the next fixtures!" : ""
    }</div>`;
  }

  let lastDay = "";
  for (const m of list) {
    const day = m.kickoff.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    if (day !== lastDay) {
      html += `<div class="date-head">📅 ${day}</div>`;
      lastDay = day;
    }
    html += matchCard(m);
  }
  view.innerHTML = html;

  view.querySelectorAll(".pill").forEach((b) =>
    b.addEventListener("click", () => { matchFilter = b.dataset.filter; renderMatches(); })
  );
  view.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", onStep));
  view.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", onSave));
  view.querySelectorAll("[data-winner]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const [matchId, val] = e.currentTarget.dataset.winner.split("|");
      draft[matchId].winner = val;
      e.currentTarget.closest(".winner-row").querySelectorAll(".wbtn")
        .forEach((x) => x.classList.toggle("sel", x === e.currentTarget));
    })
  );
  view.querySelectorAll("[data-expand]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.expand;
      if (expandedMatch === id) { expandedMatch = null; renderMatches(); return; }
      expandedMatch = id;
      renderMatches();
      const mm = matches.find((x) => x.id === id);
      const live = mm?.state === "in";              // live → refresh on each open
      if (!matchDetails[id] || live) {
        await fetchMatchDetail(id, live);
        if (expandedMatch === id) renderMatches();
      }
    })
  );
}

// ---------------------------------------------------------------------------
// FIFA rankings (tournament reference) + match detail (ESPN summary endpoint)
// ---------------------------------------------------------------------------
const FIFA_RANKS = [
  ["mexico",15],["south africa",60],["korea",25],["czech",41],
  ["canada",30],["bosnia",65],["qatar",55],["switzerland",19],
  ["brazil",6],["morocco",8],["haiti",83],["scotland",43],
  ["united states",16],["usa",16],["paraguay",40],["australia",27],["türkiye",22],["turkey",22],
  ["germany",10],["curaç",82],["curac",82],["ivory",34],["côte",34],["cote",34],["ecuador",23],
  ["netherlands",7],["japan",18],["sweden",38],["tunisia",44],
  ["belgium",9],["egypt",29],["iran",21],["new zealand",85],
  ["spain",2],["cabo verde",69],["cape verde",69],["saudi",61],["uruguay",17],
  ["france",3],["senegal",14],["iraq",57],["norway",31],
  ["argentina",1],["algeria",28],["austria",24],["jordan",63],
  ["portugal",5],["dr congo",46],["congo",46],["uzbek",50],["colombia",13],
  ["england",4],["croatia",11],["ghana",74],["panama",33],
];
function fifaRank(name) {
  const n = (name || "").toLowerCase();
  for (const [k, r] of FIFA_RANKS) if (n.includes(k)) return r;
  return null;
}

async function fetchMatchDetail(id, force) {
  if (matchDetails[id] && !force) return matchDetails[id];
  try {
    const res = await fetch(`${SUMMARY_BASE}?event=${id}`);
    if (!res.ok) throw new Error(res.status);
    matchDetails[id] = parseMatchDetail(await res.json());
  } catch (err) {
    console.warn("match detail fetch failed", err);
    matchDetails[id] = { error: true };
  }
  return matchDetails[id];
}

function parseMatchDetail(data) {
  const comps = data?.header?.competitions?.[0]?.competitors || [];
  const homeC = comps.find((c) => c.homeAway === "home") || {};
  const homeId = homeC.id || homeC.team?.id;
  const sideOf = (tid) => (String(tid) === String(homeId) ? "home" : "away");

  const goals = [];
  for (const e of (data?.keyEvents || [])) {
    const txt = (e.type?.text || "").toLowerCase();
    if (!txt.includes("goal") || txt.includes("disallow") || txt.includes("no goal")) continue;
    const name = e.athletesInvolved?.[0]?.displayName
      || e.participants?.[0]?.athlete?.displayName || "Goal";
    goals.push({
      side: sideOf(e.team?.id),
      name, min: e.clock?.displayValue || "",
      own: txt.includes("own"), pen: txt.includes("penalty"),
    });
  }

  const wanted = [["possession", "Possession"], ["totalshots", "Shots"],
    ["shotsontarget", "On target"], ["woncorners", "Corners"]];
  const teams = data?.boxscore?.teams || [];
  const byId = {};
  for (const t of teams) byId[sideOf(t.team?.id)] = t.statistics || [];
  const pick = (arr, key) => {
    const s = (arr || []).find((x) =>
      (x.name || "").toLowerCase().replace(/[^a-z]/g, "").includes(key));
    return s ? s.displayValue : null;
  };
  const stats = [];
  for (const [key, label] of wanted) {
    const h = pick(byId.home, key), a = pick(byId.away, key);
    if (h != null || a != null) stats.push({ label, home: h ?? "–", away: a ?? "–" });
  }

  // ESPN pre-match win prediction (matchup predictor)
  let predictor = null;
  const pr = data?.predictor;
  if (pr) {
    const h = parseFloat(pr.homeTeam?.gameProjection ?? pr.homeTeam?.teamChanceWin);
    const a = parseFloat(pr.awayTeam?.gameProjection ?? pr.awayTeam?.teamChanceWin);
    if (!isNaN(h) && !isNaN(a)) {
      predictor = { home: h, draw: Math.max(0, 100 - h - a), away: a };
    }
  }
  return { goals, stats, predictor };
}

// The three host nations get a real edge playing on home soil (WC 2026).
const HOST_NATIONS = ["mexico", "united states", "usa", "canada"];
function isHostNation(name) {
  const n = (name || "").toLowerCase();
  return HOST_NATIONS.some((h) => n.includes(h));
}

// Win-probability estimate built from FIFA ranks (always available, no API call).
// Converts ranks to an Elo-style rating, adds a home-soil boost for host nations,
// then splits into home / draw / away percentages.
function winProbFromRanks(rh, ra, hostH, hostA) {
  if (rh == null || ra == null) return null;
  const rate = (r) => 1900 - 7.2 * r;
  let eloH = rate(rh), eloA = rate(ra);
  if (hostH) eloH += 65;                 // playing in their own country
  if (hostA) eloA += 65;
  const eh = 1 / (1 + Math.pow(10, (eloA - eloH) / 400));
  const draw = 0.27 * (1 - Math.abs(2 * eh - 1) * 0.85);
  let home = Math.max(eh - draw / 2, 0.02);
  let away = Math.max((1 - eh) - draw / 2, 0.02);
  const s = home + draw + away;
  return { home: home / s * 100, draw: draw / s * 100, away: away / s * 100, est: true };
}

// ESPN prediction if one is ever published, else the FIFA-rank estimate.
function matchWinProb(m) {
  const det = matchDetails[m.id];
  if (det && det.predictor) return det.predictor;
  return winProbFromRanks(
    fifaRank(m.home.name), fifaRank(m.away.name),
    isHostNation(m.home.name), isHostNation(m.away.name)
  );
}

function winProbHtml(m, p) {
  const R = (x) => Math.round(x);
  return `
    <div class="wp">
      <div class="wp-h">${p.est ? "🔮 Win prediction" : "🔮 ESPN prediction"}</div>
      <div class="wp-bar"><i class="h" style="width:${p.home}%"></i><i class="d" style="width:${p.draw}%"></i><i class="a" style="width:${p.away}%"></i></div>
      <div class="wp-legend">
        <span><b>${esc(m.home.abbr)}</b> ${R(p.home)}%</span>
        <span>Draw ${R(p.draw)}%</span>
        <span>${R(p.away)}% <b>${esc(m.away.abbr)}</b></span>
      </div>
    </div>`;
}

function matchDetailHtml(m) {
  const d = matchDetails[m.id];
  if (!d) return `<div class="md-loading">Loading match details…</div>`;
  if (d.error) return `<div class="md-loading">Live details aren't available for this match.</div>`;
  const goalList = (side) =>
    d.goals.filter((g) => g.side === side)
      .map((g) => `<div class="md-goal">⚽ ${esc(g.name)} <span>${esc(g.min)}${g.pen ? " (P)" : ""}${g.own ? " (OG)" : ""}</span></div>`)
      .join("") || `<div class="md-goal md-none">—</div>`;
  const statRow = (s) => {
    const hn = parseFloat(s.home) || 0, an = parseFloat(s.away) || 0, tot = hn + an || 1;
    return `<div class="md-statline"><span class="md-h">${esc(String(s.home))}</span>` +
      `<span class="md-label">${s.label}</span><span class="md-a">${esc(String(s.away))}</span></div>` +
      `<div class="md-bar"><i style="width:${(hn / tot) * 100}%"></i></div>`;
  };
  const probBar = d.predictor ? winProbHtml(m, d.predictor) : "";
  if (!d.goals.length && !d.stats.length && !d.predictor) {
    return `<div class="md-loading">No goals or stats logged yet.</div>`;
  }
  return `
    <div class="mdetail">
      ${probBar}
      ${d.goals.length ? `<div class="md-goals"><div>${goalList("home")}</div><div>${goalList("away")}</div></div>` : ""}
      ${d.stats.map(statRow).join("")}
    </div>`;
}

function matchCard(m) {
  const open = isOpen(m);
  const badge = m.state === "in"
    ? `<span class="badge live">● LIVE</span>`
    : m.completed
      ? `<span class="badge ft">FT</span>`
      : open
        ? `<span class="badge open">OPEN</span>`
        : `<span class="badge locked">🔒 LOCKED</span>`;

  const center = m.state === "pre"
    ? `<div class="ko-time">${fmtTime(m.kickoff)}</div><div class="clock">kickoff</div>`
    : `<div class="score ${m.state === "in" ? "live-score" : ""}">${m.home.score ?? "-"} : ${m.away.score ?? "-"}</div>
       <div class="clock">${esc(m.detail)}</div>`;

  const flag = (t) => t.logo
    ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=flag-fallback>⚽</div>'">`
    : `<div class="flag-fallback">⚽</div>`;

  let body = "";
  if (open && db && me) {
    const mine = predictions[`${m.id}_${me.id}`];
    const d = draft[m.id] || {
      home: mine?.home ?? 0,
      away: mine?.away ?? 0,
      winner: mine ? predWinner(mine) : null,
    };
    draft[m.id] = d;
    const wbtn = (val, label) =>
      `<button class="wbtn ${d.winner === val ? "sel" : ""}" data-winner="${m.id}|${val}">${label}</button>`;
    body = `
      <div class="winner-row">
        ${wbtn("home", `🏆 ${esc(m.home.abbr)}`)}
        ${wbtn("draw", "🤝 Draw")}
        ${wbtn("away", `🏆 ${esc(m.away.abbr)}`)}
      </div>
      <div class="predict">
        ${stepper(m.id, "home", d.home)}
        <span class="vs">—</span>
        ${stepper(m.id, "away", d.away)}
        <button class="save-btn" data-save="${m.id}">${mine ? "Update" : "Save"} 🎯</button>
      </div>
      <div class="lock-note">${mine ? `✅ Your bet: <b>${pickLabel(mine, m)}</b> · ` : ""}${
        isOverridden(m) ? "🔓 Re-opened by admin — closes when the 2nd half starts!" : `🔒 Locks at ${fmtTime(lockTime(m))}`
      }</div>`;
  } else if (open && db && !me) {
    body = `<div class="lock-note">👤 <a href="#" onclick="document.getElementById('playerChip').click();return false" style="color:var(--gold)">Join the game</a> to predict · 🔒 locks at ${fmtTime(lockTime(m))}</div>`;
  } else if (!open && db) {
    body = revealBlock(m);
  }

  const teamHtml = (t) => {
    const r = fifaRank(t.name);
    return `<div class="team">${flag(t)}<b>${esc(t.name)}</b>${r != null ? `<span class="fifa">#${r}</span>` : ""}</div>`;
  };
  const canDetail = m.state === "in" || m.completed;
  const expanded = expandedMatch === m.id;
  const detailToggle = canDetail
    ? `<button class="md-toggle" data-expand="${m.id}">${expanded ? "Hide details ▲" : "📊 Match details ▾"}</button>`
    : "";
  const detail = (canDetail && expanded) ? matchDetailHtml(m) : "";

  // pre-match win prediction (hint before betting) — upcoming matches only
  const probP = m.state === "pre" ? matchWinProb(m) : null;
  const prob = probP ? winProbHtml(m, probP) : "";

  return `
    <div class="match">
      <div class="match-top"><span>${esc(m.group || "World Cup 2026")}</span>${badge}</div>
      <div class="teams">
        ${teamHtml(m.home)}
        <div class="center">${center}</div>
        ${teamHtml(m.away)}
      </div>
      ${prob}
      ${body}
      ${detailToggle}
      ${detail}
    </div>`;
}

function stepper(matchId, side, val) {
  return `
    <div class="stepper">
      <button data-step="${matchId}|${side}|-1">−</button>
      <span id="st-${matchId}-${side}">${val}</span>
      <button data-step="${matchId}|${side}|1">+</button>
    </div>`;
}

function revealBlock(m) {
  const done = m.completed && m.home.score != null;
  const R = window.RULES || {};
  const bonusOn = done && (!R.bonusFrom || m.kickoff.getTime() >= Date.parse(R.bonusFrom));
  const upset = bonusOn && R.underdogBonus ? upsetWinSide(m) : null;
  // who scored on this match (for the only-winner bonus)
  const scorerIds = !bonusOn || !R.onlyWinnerBonus ? [] : players
    .filter((p) => {
      const pr = predictions[`${m.id}_${p.id}`];
      return pr && isValidPrediction(pr, m) && scorePrediction(pr, m.home.score, m.away.score) > 0;
    })
    .map((p) => p.id);
  const soleId = scorerIds.length === 1 ? scorerIds[0] : null;

  const list = players
    .map((p) => {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred) return null;
      const late = !isValidPrediction(pred, m);
      const base = (done && !late) ? scorePrediction(pred, m.home.score, m.away.score) : null;
      let bonus = 0, badges = "";
      if (base != null && bonusOn) {
        if (soleId === p.id) { bonus += R.onlyWinnerBonus; badges += "🏅"; }
        if (upset && predWinner(pred) === upset) { bonus += R.underdogBonus; badges += "🐺"; }
      }
      const pts = base == null ? null : base + bonus;
      return { p, pred, late, base, pts, badges };
    })
    .filter(Boolean);
  if (!list.length) return `<div class="lock-note">No predictions for this match 🤷</div>`;
  if (done) list.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1));

  const rows = list.map(({ p, pred, late, base, pts, badges }) => {
    const w = predWinner(pred);
    const team = w === "draw" ? "Draw" : esc(w === "home" ? m.home.abbr : m.away.abbr);
    const ptsHtml = late
      ? `<span class="pr-pts late">late</span>`
      : (pts != null ? `<span class="pr-pts p${base}">+${pts}${badges ? ` <span class="pr-badge">${badges}</span>` : ""}</span>` : `<span class="pr-pts pending">—</span>`);
    return `
      <div class="pr-row ${me && p.id === me.id ? "mine" : ""}">
        <div class="pr-av">${p.emoji}</div>
        <div class="pr-name">${esc(p.name)}</div>
        <div class="pr-pick"><b>${pred.home}–${pred.away}</b><span class="pr-team">${team}</span></div>
        ${ptsHtml}
      </div>`;
  }).join("");
  return `<div class="reveal">${rows}</div>`;
}

function onStep(e) {
  const [matchId, side, delta] = e.currentTarget.dataset.step.split("|");
  const d = draft[matchId];
  d[side] = Math.max(0, Math.min(15, d[side] + Number(delta)));
  $(`#st-${matchId}-${side}`).textContent = d[side];
}

async function onSave(e) {
  const matchId = e.currentTarget.dataset.save;
  const m = matches.find((x) => x.id === matchId);
  if (!m || !me || !db) return;
  if (!isOpen(m)) { toast("🔒 Too late — predictions are locked!"); render(); return; }
  const d = draft[matchId];
  // decisive score → winner follows the score; drawn score → keep the pick
  const dir = resultOf(d.home, d.away);
  const winner = dir !== "draw" ? dir : (d.winner || "draw");
  try {
    await fs.setDoc(fs.doc(db, "predictions", `${matchId}_${me.id}`), {
      matchId,
      playerId: me.id,
      winner,
      home: d.home,
      away: d.away,
      kickoff: m.kickoff.toISOString(),
      updatedAt: fs.serverTimestamp(),
    });
    trackEvent("prediction_saved", { match: `${m.home.abbr}-${m.away.abbr}` });
    toast(`🎯 Saved: ${pickLabel({ winner, home: d.home, away: d.away }, m)}`);
  } catch (err) {
    console.error(err);
    toast("⚠️ Save failed — check your connection.");
  }
}

// ---------------------------------------------------------------------------
// Leaderboard tab
// ---------------------------------------------------------------------------
function renderTable() {
  if (!db) {
    view.innerHTML = `<div class="empty">🏅 The standings appear once the admin connects the database.<br>See the setup guide in the README.</div>`;
    return;
  }
  const liveMatches = matches.filter((m) => m.state === "in" && m.home.score != null);
  const isLive = liveMatches.length > 0;
  const rows = buildStandings(isLive);
  if (!rows.length) {
    view.innerHTML = `<div class="empty">No players yet — be the first to join! 🎉</div>`;
    return;
  }
  // When live, movement shows the shuffle caused by in-play results (vs the
  // confirmed table); otherwise it's "since the last finished match".
  let prevRanks;
  if (isLive) {
    prevRanks = {};
    buildStandings(false).forEach((r, i) => (prevRanks[r.id] = i + 1));
  } else {
    prevRanks = standingsSnap?.prevRanks || null;
  }
  const glyph = { up: "▲", down: "▼", same: "–" };

  const html = rows.map((r, i) => {
    const rank = i + 1;
    const medal = ["🥇", "🥈", "🥉"][i] || rank;
    const rcls = rank <= 3 ? ` r${rank}` : "";
    const prevRank = prevRanks ? prevRanks[r.id] : null;
    const mv = prevRank == null ? "same" : (prevRank - rank > 0 ? "up" : prevRank - rank < 0 ? "down" : "same");
    const dots = formDots(r.id).map((f) => `<span class="st-dot ${f}"></span>`).join("");
    const meCls = me && r.id === me.id ? " me" : "";
    const livePts = isLive && r.livePts ? `<span class="st-live">+${r.livePts}</span>` : "";
    return `
      <div class="st-row${meCls}${r.livePts ? " gaining" : ""}">
        <div class="st-rank${rcls}">${medal}</div>
        <div class="st-move ${mv}">${glyph[mv]}</div>
        <div class="st-av">${r.emoji}</div>
        <div class="st-meta">
          <div class="st-name">${esc(r.name)}${meCls ? '<span class="st-you">YOU</span>' : ""}</div>
          <div class="st-sub">Played ${r.played} · 🎯 ${r.exact} exact <span class="st-form">${dots}</span></div>
        </div>
        <div class="st-pts"><b>${r.pts}</b>${livePts}<span>pts</span></div>
      </div>`;
  }).join("");

  const liveBanner = isLive
    ? `<div class="st-livebar">🔴 LIVE — table updates with every goal · ${liveMatches
        .map((m) => `${esc(m.home.abbr)} ${m.home.score}–${m.away.score} ${esc(m.away.abbr)}`)
        .join(" · ")} · final at full time</div>`
    : "";

  view.innerHTML = `
    <div class="section-title">🏅 Standings${isLive ? ' <span class="st-livetag">LIVE</span>' : ""}</div>
    ${liveBanner}
    ${html}
    <p class="lock-note" style="margin-top:10px">Tiebreakers: most exact scores 🎯, then correct results · ▲▼ ${isLive ? "live movement from in-play results" : "since the last match"}.</p>`;
}

// Last 3 completed matches as form dots: "ex" (exact +7), "win" (any points), "" (none)
function formDots(playerId) {
  const last3 = matches
    .filter((m) => m.completed && m.home.score != null)
    .sort((a, b) => a.kickoff - b.kickoff)
    .slice(-3);
  return last3.map((m) => {
    const pr = predictions[`${m.id}_${playerId}`];
    if (!pr || !isValidPrediction(pr, m)) return "";
    const exact = pr.home === m.home.score && pr.away === m.away.score;
    return exact ? "ex" : (scorePrediction(pr, m.home.score, m.away.score) > 0 ? "win" : "");
  });
}

// ---------------------------------------------------------------------------
// WhatsApp tab
// ---------------------------------------------------------------------------
function renderShare() {
  view.innerHTML = `
    <div class="section-title">Send to the gang group 😁</div>
    ${shareCard("📅 Today's matches", "Fixtures, kickoff times and when betting closes — send this every morning.", "today")}
    ${shareCard("🔴 Live & results", "Current scores of live matches plus today's finished results.", "live")}
    ${shareCard("🏅 Leaderboard", "Current standings with medals — perfect after each match day.", "table")}
    <div class="share-card">
      <h3>🔔 Push notifications</h3>
      <p>Get "betting closes soon" reminders and full-time results with points, even with the app closed.
      <b>iPhone:</b> first Share → <b>Add to Home Screen</b>, then open the app from the new icon and tap the button.
      <b>Android:</b> just tap and allow.</p>
      <div class="share-actions">
        <button class="btn primary" data-notif>Enable on this device 🔔</button>
      </div>
    </div>
    <div class="share-card">
      <h3>🔗 Invite link</h3>
      <p>Pin this app link + the group code in your WhatsApp group description so everyone can join.</p>
      <div class="share-actions">
        <button class="btn wa" data-share-invite>Share on WhatsApp</button>
        <button class="btn ghost" data-copy-invite>Copy</button>
      </div>
    </div>`;
  view.querySelectorAll("[data-share]").forEach((b) =>
    b.addEventListener("click", () => openWhatsApp(buildMessage(b.dataset.share)))
  );
  view.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => copyText(buildMessage(b.dataset.copy)))
  );
  view.querySelector("[data-share-invite]").addEventListener("click", () => openWhatsApp(inviteMessage()));
  view.querySelector("[data-copy-invite]").addEventListener("click", () => copyText(inviteMessage()));
  view.querySelector("[data-notif]").addEventListener("click", enableNotifications);
}

function shareCard(title, desc, kind) {
  return `
    <div class="share-card">
      <h3>${title}</h3>
      <p>${desc}</p>
      <div class="share-actions">
        <button class="btn wa" data-share="${kind}">Share on WhatsApp</button>
        <button class="btn ghost" data-copy="${kind}">Copy</button>
      </div>
    </div>`;
}

function buildMessage(kind) {
  const today = new Date();
  const sameDay = (d) => d.toDateString() === today.toDateString();
  const appUrl = window.APP_LINK || location.href.split("#")[0];

  if (kind === "today") {
    const list = matches.filter((m) => sameDay(m.kickoff) && m.state === "pre");
    if (!list.length) return `🏆 *EL 3ESHّA WORLD CUP 26* 🏆\n\nNo more matches today 😴 — rest day for the gang!\n\n${appUrl}`;
    let msg = `🏆 *EL 3ESHّA WORLD CUP 26* 🏆\n📅 *Today's matches — place your bets!*\n\n`;
    for (const m of list) {
      msg += `⚽ *${m.home.name}* 🆚 *${m.away.name}*\n   🕐 ${fmtTime(m.kickoff)} · 🔒 betting closes ${fmtTime(lockTime(m))}\n\n`;
    }
    msg += `🎯 Predict now 👇\n${appUrl}`;
    return msg;
  }

  if (kind === "live") {
    const live = matches.filter((m) => m.state === "in");
    const done = matches.filter((m) => sameDay(m.kickoff) && m.completed);
    let msg = `🏆 *EL 3ESHّA WORLD CUP 26* 🏆\n\n`;
    if (live.length) {
      msg += `🔴 *LIVE NOW*\n`;
      for (const m of live) msg += `⚽ ${m.home.name} *${m.home.score}–${m.away.score}* ${m.away.name} (${m.detail})\n`;
      msg += `\n`;
    }
    if (done.length) {
      msg += `✅ *FULL TIME today*\n`;
      for (const m of done) msg += `⚽ ${m.home.name} *${m.home.score}–${m.away.score}* ${m.away.name}\n`;
      msg += `\n`;
    }
    if (!live.length && !done.length) msg += `No live matches right now 😴\n\n`;
    msg += appUrl;
    return msg;
  }

  // leaderboard
  const rows = buildStandings();
  let msg = `🏆 *EL 3ESHّA WC26 — STANDINGS* 🏆\n\n`;
  if (!rows.length) msg += `Nobody has joined yet — be the first! 🎉\n\n`;
  rows.forEach((r, i) => {
    const medal = ["🥇", "🥈", "🥉"][i] || ` ${i + 1}.`;
    msg += `${medal} ${r.emoji} *${r.name}* — ${r.pts} pts (🎯 ${r.exact} exact)\n`;
  });
  msg += `\n${appUrl}`;
  return msg;
}

function inviteMessage() {
  return (
    `🏆 *EL 3ESHّA WORLD CUP 26 — you're invited!* 🏆\n\n` +
    `World Cup prediction battle for the gang 😁⚽\n` +
    `Each match: pick the *winner* + the *exact score*\n` +
    `✅ Winner = ${POINTS.WINNER} pts · 🎯 Exact score = +${POINTS.EXACT} pts bonus\n` +
    `🔒 Bets close 1 hour before kickoff (today only: open till end of 1st half ⚡)\n\n` +
    `Join here 👇 (group code: *${window.GROUP_CODE}*)\n${window.APP_LINK || location.href.split("#")[0]}`
  );
}

function openWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text + sponsorFooter())}`, "_blank");
}

async function copyText(text) {
  const full = text + sponsorFooter();
  try {
    await navigator.clipboard.writeText(full);
    toast("📋 Copied — paste it in the group!");
  } catch {
    prompt("Copy this message:", full);
  }
}

// ---------------------------------------------------------------------------
// Rules tab
// ---------------------------------------------------------------------------
function renderRules() {
  view.innerHTML = `
    <div class="rules-card">
      <h3>🎯 How to play</h3>
      <ul>
        <li>Every match = <b>2 predictions</b>: pick <b>who wins</b> (or draw) 🏆 <i>and</i> the <b>exact score</b>.</li>
        <li>🔒 Predictions <b>lock ${LOCK_MINUTES} minutes before kickoff</b> — no late bets!</li>
        <li>⚡ <b>Launch day (June 12) only:</b> bets stay open until the <b>end of the 1st half</b> (${GRACE_AFTER_MIN} min after kickoff).</li>
        <li>Everyone's picks stay hidden until lock time, then they're revealed. 👀</li>
        <li>Knockout games: predict the score <b>after extra time</b> (penalty shootouts don't count).</li>
      </ul>
    </div>
    <div class="rules-card">
      <h3>🏅 Points</h3>
      <ul>
        <li>✅ <b>${POINTS.WINNER} pts</b> — correct winner/draw pick</li>
        <li>🎯 <b>+${POINTS.EXACT} pts bonus</b> — exact final score</li>
        <li>👑 <b>${POINTS.WINNER + POINTS.EXACT} pts max</b> per match — nail them both!</li>
        <li>❌ <b>0 pts</b> — wrong on everything, habibi 😅</li>
      </ul>
    </div>
    ${window.RULES?.onlyWinnerBonus ? `
    <div class="rules-card">
      <h3>🏅 Only-Winner Bonus <span style="font-size:11px;color:var(--green)">NEW · Round 2</span></h3>
      <ul>
        <li>If you're the <b>ONLY</b> player to score on a match (everyone else got 0), you get <b>+${window.RULES.onlyWinnerBonus} bonus</b>! 🔥</li>
        <li>So a lone correct winner = <b>${POINTS.WINNER + window.RULES.onlyWinnerBonus} pts</b>, and a lone exact score = <b>${POINTS.WINNER + POINTS.EXACT + window.RULES.onlyWinnerBonus} pts</b>.</li>
        <li>Reward for the brave, unique pick! 💪</li>
      </ul>
    </div>` : ""}
    ${window.RULES?.underdogBonus ? `
    <div class="rules-card">
      <h3>🐺 Underdog Bonus <span style="font-size:11px;color:var(--green)">NEW · Round 2</span></h3>
      <ul>
        <li>Correctly back the <b>lower-ranked team to win</b> (an upset) and get <b>+${window.RULES.underdogBonus} bonus</b>! 🐺</li>
        <li>Ranking is the FIFA # shown on each team — back the bigger number to win.</li>
        <li>Bonuses <b>stack</b>: a lone correct underdog call can be worth a LOT. 💰</li>
      </ul>
    </div>` : ""}
    <div class="rules-card">
      <h3>📲 Install the app & turn on notifications</h3>
      <ul>
        <li><b>🍎 iPhone:</b> open this page in <b>Safari</b> → tap <b>Share</b> (square with arrow ⬆️) → <b>Add to Home Screen</b> → Add. Then <b>close Safari and open the app from the new icon</b> — only then tap the 🔔 bell at the top and press <b>Allow</b>. (Needs iOS 16.4 or newer.)</li>
        <li><b>🤖 Android:</b> open this page in <b>Chrome</b> → tap the 🔔 bell → <b>Allow</b>. Done! Optional: menu ⋮ → <b>Add to Home screen</b> for a real app icon.</li>
        <li>You'll get: ⏰ bet reminders · 🥅 kickoff with everyone's picks · ⚽ goal alerts (🎯 if the score hits your pick!) · ✍️ "someone placed a bet" · 🏁 full-time results with points · 👑 new-leader alerts.</li>
        <li>No notification? Make sure you opened the app <b>from the Home Screen icon</b> (iPhone), and that notifications are allowed in your phone settings.</li>
      </ul>
    </div>
    <div class="rules-card">
      <h3>🏆 Winning</h3>
      <ul>
        <li>Most points after the final wins El 3eshّa World Cup 26. 👑</li>
        <li>Tiebreakers: most exact scores 🎯, then most correct results.</li>
        ${window.SPONSOR?.prize
          ? `<li>${esc(window.SPONSOR.prize)}</li>`
          : `<li>Prize: decided by the gang... loser buys dinner? 😁</li>`}
      </ul>
    </div>
    ${window.SPONSOR?.name ? `
    <div class="rules-card" style="text-align:center">
      <h3>🤝 Official Sponsor</h3>
      ${window.SPONSOR.logo ? `<img src="${esc(window.SPONSOR.logo)}" alt="${esc(window.SPONSOR.name)}" style="max-width:60%;max-height:90px;border-radius:10px;margin:4px auto 10px;display:block" onerror="this.remove()">` : ""}
      ${window.SPONSOR.tagline ? `<p style="color:var(--muted);font-size:13px">${esc(window.SPONSOR.tagline)}</p>` : ""}
      ${window.SPONSOR.link ? `<div class="share-actions" style="justify-content:center;margin-top:12px"><a class="btn wa" href="${esc(window.SPONSOR.link)}" target="_blank" rel="noopener">${esc(window.SPONSOR.cta || "Visit")}</a></div>` : ""}
    </div>` : ""}
    <p class="app-version">El 3eshّa WC 26 · v${esc(window.APP_VERSION || "1.0")}</p>`;
}

// ---------------------------------------------------------------------------
// Join / login
// ---------------------------------------------------------------------------
let chosenEmoji = EMOJIS[0];

function openJoinModal() {
  if (!db) { toast("⚙️ The database isn't connected yet — ask the admin!"); return; }
  $("#joinModal").classList.remove("hidden");
  $("#joinError").classList.add("hidden");
  const row = $("#emojiRow");
  row.innerHTML = EMOJIS.map(
    (e) => `<button type="button" class="${e === chosenEmoji ? "sel" : ""}" data-emoji="${e}">${e}</button>`
  ).join("");
  row.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      chosenEmoji = b.dataset.emoji;
      row.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
    })
  );
  $("#joinCancel").onclick = () => $("#joinModal").classList.add("hidden");
  $("#joinSubmit").onclick = submitJoin;
}

async function submitJoin() {
  const code = $("#joinCode").value.trim();
  const name = $("#joinName").value.trim();
  const pin = $("#joinPin").value.trim();
  const fail = (msg) => { const el = $("#joinError"); el.textContent = msg; el.classList.remove("hidden"); };

  if (code !== window.GROUP_CODE) return fail("Wrong group code — ask in the gang group 😉");
  if (!name || name.length < 2) return fail("Enter your name (at least 2 letters).");
  if (!/^\d{4}$/.test(pin)) return fail("PIN must be exactly 4 digits.");

  const existingLocal = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  try {
    // Re-check against the LIVE database (not the maybe-unloaded local list)
    // so we never create a duplicate name due to a slow first snapshot.
    let all = players;
    try {
      const snap = await fs.getDocs(fs.collection(db, "players"));
      all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { /* offline — fall back to local list */ }
    const existing = all.find((p) => (p.name || "").trim().toLowerCase() === name.toLowerCase())
      || existingLocal;

    if (existing) {
      if (existing.pin !== pin) return fail("That name is taken and the PIN doesn't match.");
      me = { id: existing.id, name: existing.name, emoji: existing.emoji };
    } else {
      if (all.length >= (window.MAX_PLAYERS || 10)) return fail("The game is full! 🙈");
      const ref = await fs.addDoc(fs.collection(db, "players"), {
        name, pin, emoji: chosenEmoji, joinedAt: fs.serverTimestamp(),
      });
      me = { id: ref.id, name, emoji: chosenEmoji };
    }
    saveLogin();
    // Link this device's notification registration to the player so the
    // login can be restored even if the phone wipes local storage.
    const fcm = localStorage.getItem("gangcup_fcm");
    if (fcm) {
      fs.setDoc(fs.doc(db, "tokens", fcm), { playerId: me.id, player: me.name }, { merge: true })
        .catch(() => {});
    }
    $("#joinModal").classList.add("hidden");
    render();
    trackEvent("player_joined", { name: me.name });
    toast(`${me.emoji} Welcome, ${me.name}! Go predict ⚽`);
  } catch (err) {
    console.error(err);
    fail("Couldn't reach the database — try again.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "🏆 ARG · 2–1" / "🤝 Draw · 1–1" — a player's full bet for a match
function pickLabel(pred, m) {
  const w = predWinner(pred);
  const who = w === "draw" ? "🤝 Draw" : `🏆 ${esc(w === "home" ? m.home.abbr : m.away.abbr)}`;
  return `${who} · ${pred.home}–${pred.away}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function showBanner(html) {
  const b = $("#banner");
  b.innerHTML = html;
  b.classList.remove("hidden");
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}
