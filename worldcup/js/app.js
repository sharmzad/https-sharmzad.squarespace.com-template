/*
 * Gang Cup 2026 — World Cup prediction game for the gang 🏆
 *
 * Live scores : ESPN public scoreboard API (free, no key, CORS enabled)
 * Shared data : Firebase Firestore (free Spark tier) — players + predictions
 * Scoring     : correct winner (1X2) 2 pts + exact score bonus 5 pts (max 7)
 * Lock        : predictions close 15 minutes before kickoff
 *               (launch day June 12 only: open until 5 min AFTER kickoff)
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const POINTS = { EXACT: 5, WINNER: 2 };
const LOCK_MINUTES = 15;
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
let standingsPhase = null;  // Table phase: null=auto, "group" | "knockout" | "overall"
let koSlots = {};          // live-resolved knockout slot teams: `${matchId}|${side}` -> {name,abbr,logo}
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
  maybeShowTutorial();   // first-open knockout how-to (self-defers past the intro)
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

// ---------------------------------------------------------------------------
// First-open knockout how-to walkthrough (fun, skippable, 24h window)
// ---------------------------------------------------------------------------
function tutorialPending() {
  const t = window.TUTORIAL;
  if (!t || !t.id) return false;
  if (t.until && Date.now() >= new Date(t.until).getTime()) return false;  // window closed
  const max = t.repeat || 1;                                               // times to show per device
  const seen = parseInt(localStorage.getItem(`tutorial_${t.id}`) || "0", 10) || 0;
  return seen < max;
}

const TUTORIAL_STEPS = [
  { emoji: "🏆⚔️", title: "Knockout Time!",
    body: "Group stage is over — it's now <b>WIN OR GO HOME</b>. Knockout bets work a little differently. 30 seconds and you'll be a pro 👇" },
  { emoji: "1️⃣", title: "Pick WHO wins &amp; HOW",
    visual: `<div class="tut-grid">
        <span class="tut-cell on">🇧🇷<small>in 90'</small></span><span class="tut-cell">🇧🇷<small>Extra Time</small></span><span class="tut-cell">🇧🇷<small>Penalties</small></span>
        <span class="tut-cell">🇯🇵<small>in 90'</small></span><span class="tut-cell">🇯🇵<small>Extra Time</small></span><span class="tut-cell">🇯🇵<small>Penalties</small></span>
      </div>`,
    body: "Tap <b>one card</b>: your team <b>AND</b> how they go through — in <b>90'</b> ⏱, <b>Extra Time</b> ⌛ or <b>Penalties</b> 🥅. Calling the drama = more points!" },
  { emoji: "2️⃣", title: "Set the 90-min score",
    visual: `<div class="tut-score"><span class="tut-step">−</span><b>2</b><span class="tut-step">+</span><i>—</i><span class="tut-step">−</span><b>1</b><span class="tut-step">+</span></div>`,
    body: "Use <b>−</b> / <b>+</b> to predict the <b>exact score after 90 minutes</b>. (Extra time &amp; pens don't change this number!) 🎯 Then smash <b>Save</b>." },
  { emoji: "💰", title: "Stack the points",
    body: "✅ Right team <b>+3</b> · ⏱ Right how <b>+3</b> · 🎯 Exact score <b>+3</b> = up to <b>9</b>! And every round <b>multiplies</b> — the Final is <b>×5</b>. 🔥" },
  { emoji: "🚀", title: "You're ready!",
    body: "Go make your knockout picks before kickoff and climb the table. Edit any time until it locks. <b>Yalla!</b> ⚽" },
];

function maybeShowTutorial(retries = 0) {
  if (!tutorialPending()) return;
  // wait for the sponsor intro / celebration overlay to clear first
  const blocked = ["#sponsorIntro", "#announce"].some((sel) => {
    const el = $(sel); return el && !el.classList.contains("hidden");
  });
  if (blocked && retries < 40) { setTimeout(() => maybeShowTutorial(retries + 1), 800); return; }
  if (document.querySelector(".tut")) return;   // already open

  // Count this view immediately, so it still counts even if they skip / escape it.
  const key = `tutorial_${window.TUTORIAL.id}`;
  const seen = parseInt(localStorage.getItem(key) || "0", 10) || 0;
  localStorage.setItem(key, String(seen + 1));

  let i = 0;
  const overlay = document.createElement("div");
  overlay.className = "tut";
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const finish = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 300);
  };
  const draw = () => {
    const s = TUTORIAL_STEPS[i];
    const last = i === TUTORIAL_STEPS.length - 1;
    const dots = TUTORIAL_STEPS.map((_, k) => `<span class="tut-dot ${k === i ? "on" : ""}"></span>`).join("");
    overlay.innerHTML = `
      <div class="tut-card">
        <button class="tut-skip">Skip ›</button>
        <div class="tut-emoji">${s.emoji}</div>
        ${s.visual || ""}
        <h2 class="tut-title">${s.title}</h2>
        <p class="tut-body">${s.body}</p>
        <div class="tut-dots">${dots}</div>
        <div class="tut-actions">
          ${i > 0 ? `<button class="btn ghost tut-back">‹ Back</button>` : `<span></span>`}
          <button class="btn primary tut-next">${last ? "Let's go ⚽" : "Next ›"}</button>
        </div>
      </div>`;
    overlay.querySelector(".tut-skip").onclick = finish;
    overlay.querySelector(".tut-next").onclick = () => { if (last) finish(); else { i++; draw(); } };
    const back = overlay.querySelector(".tut-back");
    if (back) back.onclick = () => { i--; draw(); };
  };
  draw();
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
  localStorage.setItem("gangcup_me", JSON.stringify(me));
  // Cookie is the iOS fallback — keep it slim (no photo data-URL; cookies cap ~4KB).
  const slim = JSON.stringify({ id: me.id, name: me.name, emoji: me.emoji });
  document.cookie = `gangcup_me=${encodeURIComponent(slim)};max-age=31536000;path=/;SameSite=Lax`;
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

  // 🔔 notification coverage from the notifier heartbeat
  const onCount = health?.playersOn;
  const offCount = health?.playersOff;
  const offNames = health?.playersOffNames || [];
  const totalReg = health?.playersTotal ?? players.length;

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
    card("🔔", "Getting alerts", onCount != null ? `${onCount}/${totalReg}` : "—", `${devices} devices · ${notifAgo}`) +
    card("🔕", "No alerts", offCount != null ? offCount : "—", offNames.length ? "see list below" : "everyone's covered 🎉") +
    (next ? card("⏭️", "Next match bets", nextBets, `${esc(next.home.abbr)}–${esc(next.away.abbr)}`) : "") +
    (offNames.length
      ? `<div class="dash-cell dash-wide">
           <div class="dash-label">🔕 Not receiving notifications (${offNames.length})</div>
           <div class="dash-sub">${offNames.map((n) => esc(n)).join(", ")}</div>
         </div>`
      : "");

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
  const chip = $("#playerChip");
  if (!me) { chip.textContent = "👤 Join"; return; }
  const photo = playerPhoto(me);
  chip.innerHTML = `${photo ? `<img class="chip-img" src="${esc(photo)}" alt="">` : me.emoji} ${esc(me.name)}`;
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
    // Persistent local cache (IndexedDB): on reopen, the snapshot listeners
    // resume from cached state and only fetch docs CHANGED since the last sync,
    // instead of re-reading the whole collection on every launch. This is the
    // main Firestore read saver that keeps us under the free-tier daily quota.
    try {
      db = fs.initializeFirestore(fbApp, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      console.warn("Persistent cache unavailable, using default:", e?.message || e);
      db = fs.getFirestore(fbApp);
    }

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
      shootout: c.shootoutScore != null ? Number(c.shootoutScore) : null, // penalty shootout
    };
  };
  const winC = (comp.competitors || []).find((c) => c.winner === true);
  return {
    id: ev.id,
    kickoff: new Date(ev.date),
    state: status.type?.state || "pre",            // pre | in | post
    completed: !!status.type?.completed,
    period: status.period ?? 0,                    // 1 = first half, 2 = second half
    detail: status.type?.shortDetail || "",
    statusName: status.type?.name || "",           // e.g. STATUS_DELAYED / STATUS_POSTPONED
    group: comp.notes?.[0]?.headline || ev.season?.slug || "",
    advanced: winC ? (winC.homeAway === "home" ? "home" : "away") : null, // who went through (knockout)
    home: side("home"),
    away: side("away"),
  };
}

// True when ESPN flags the match as delayed / postponed / suspended.
const isDelayed = (m) =>
  !m.completed && /delay|postpon|suspend/i.test(`${m.statusName} ${m.detail}`);

// Admin overrides: matches listed here stay open for betting until half time
// (kickoff + GRACE_AFTER_MIN), ignoring the normal pre-kickoff lock.
// Match by team abbreviation or name (both must hit).
const OPEN_OVERRIDES = [
  ["KOR", "CZE"], // South Korea vs Czechia — opened on the gang's request
  ["canada", "south africa"], // Canada vs South Africa — opened on request
  ["brazil", "japan"], // Brazil vs Japan — opened on request (R32)
];

const teamsMatch = (m, pair) =>
  pair.every((t) =>
    [m.home.abbr, m.home.name, m.away.abbr, m.away.name].some(
      (n) => n && n.toLowerCase().includes(t.toLowerCase())
    )
  );

const isOverridden = (m) => OPEN_OVERRIDES.some((pair) => teamsMatch(m, pair));

// Time-boxed admin re-opens: reopen a match for betting until a fixed moment,
// then it locks again — regardless of the live match state. The lock time IS the
// `until`, so a bet saved in the window freezes lockAt = until and stays valid
// (isValidPrediction / the notifier's deadlineMs both read that frozen lockAt).
const TIMED_OVERRIDES = [
  { teams: ["spain", "france"], until: "2026-07-14T19:30:00Z" }, // ~10-min reopen on request (22:30 Cairo)
];
const timedOverrideFor = (m) => TIMED_OVERRIDES.find((o) => teamsMatch(m, o.teams));
const timedOverrideOpen = (m) => {
  const o = timedOverrideFor(m);
  return !!o && Date.now() < Date.parse(o.until);
};

const dayKey = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

function lockTime(m) {
  const o = timedOverrideFor(m);
  if (o) return new Date(Date.parse(o.until));   // reopened → lock at the window's end
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
  if (timedOverrideOpen(m)) return true;          // short admin re-open window
  if (isOverridden(m)) return overrideStillOpen(m);
  return Date.now() < lockTime(m).getTime();
}

// ---------------------------------------------------------------------------
// Scoring — two predictions per match: winner (1X2) + exact score
// ---------------------------------------------------------------------------
const resultOf = (hs, as) => (hs > as ? "home" : hs < as ? "away" : "draw");

// The outcome is ALWAYS read from the predicted score: a level score is a draw
// (never a team win), a decisive score backs that team. The winner buttons are
// just a shortcut kept in sync with the score, so the two can't contradict —
// scoring 1–1 but tapping a team no longer counts as backing that team.
const predWinner = (pred) => resultOf(pred.home, pred.away);

function scorePrediction(pred, hs, as) {
  let pts = 0;
  const exact = pred.home === hs && pred.away === as;
  // An exact score inherently nails the result, so it always earns the winner
  // points too — even if the player's explicit 1X2 pick disagreed (e.g. scored
  // 0–0 but also tapped a team). Exact score = the full 7.
  if (exact || predWinner(pred) === resultOf(hs, as)) pts += POINTS.WINNER;
  if (exact) pts += POINTS.EXACT;
  return pts;
}

// A prediction only counts if it was saved before that match's lock. The lock
// deadline is frozen ON the prediction (lockAt) when it is saved, so later
// changes to the lock window can't retroactively turn an on-time old bet into a
// "late" one. Legacy bets saved before lockAt existed are grandfathered: valid
// as long as they were placed before kickoff. Overridden matches accept all.
const isValidPrediction = (pred, m) =>
  isOverridden(m) || pred.updatedAtMs <= (pred.lockAt ?? m.kickoff.getTime());

// Round 3 (final group round) gate — its bonuses count only from RULES.round3From.
const round3On = (m) => {
  const f = (window.RULES || {}).round3From;
  return f ? m.kickoff.getTime() >= Date.parse(f) : false;
};

// ---------------------------------------------------------------------------
// Knockout stage ("Road to WC26 Final")
// ---------------------------------------------------------------------------
const KO = () => window.KNOCKOUT || {};
const knockoutFromMs = () => (KO().from ? Date.parse(KO().from) : Infinity);
const knockoutLabel = (m) =>
  /round[\s-]of[\s-]32|round[\s-]of[\s-]16|quarter|semi[\s-]?final|\bfinal\b|third[\s-]place|3rd[\s-]place|play[\s-]?offs?|knockout/i.test(m.group || "");
const knownGroupMatch = (m) => {
  const h = groupOf(m.home.name), a = groupOf(m.away.name);
  return h && h === a;
};
// ESPN can list final group matches on the same day the knockout stage starts.
// Keep same-group fixtures in the group race unless ESPN explicitly labels them
// as a knockout round.
const isKnockout = (m) =>
  knockoutLabel(m) || (m.kickoff.getTime() >= knockoutFromMs() && !knownGroupMatch(m));
const hasKnockout = () => matches.some(isKnockout);
// Knockout has actually STARTED (not just scheduled): past the cutoff, or a
// knockout match is live/finished. Drives the default Table view.
const koStarted = () =>
  Date.now() >= knockoutFromMs() || matches.some((m) => isKnockout(m) && m.state !== "pre");
// Display team for a (possibly placeholder) knockout slot — the live-resolved
// team if we have one, else ESPN's value (real team, or a "2A"/"3RD …" label).
const koTeam = (m, side) => koSlots[`${m.id}|${side}`] || m[side];

// A later knockout round is only "reached" once the previous round is fully
// played — until then its matchups are unknown, so we never show concrete teams
// (not even ESPN's pre-projected ones). R32 is always shown (projected from groups).
const KO_ORDER = ["R32", "R16", "QF", "SF", "F"];
const koFeederLabel = (round) =>
  ({ R16: "R32 winner", QF: "R16 winner", SF: "QF winner", F: "SF winner", "3P": "SF loser" }[round] || "TBD");
function koPrevComplete(round) {
  const prev = (round === "F" || round === "3P") ? "SF" : KO_ORDER[KO_ORDER.indexOf(round) - 1];
  if (!prev) return true; // R32
  const ms = matches.filter((m) => isKnockout(m) && koRound(m) === prev);
  return ms.length > 0 && ms.every((m) => m.completed);
}
const koReached = (m) => koRound(m) === "R32" || koPrevComplete(koRound(m));
// The round feeding this match has at least kicked off — enough to trust ESPN's
// per-slot fills (it only names a concrete team once that slot is decided).
const koPrevStarted = (m) => {
  const round = koRound(m);
  const prev = (round === "F" || round === "3P") ? "SF" : KO_ORDER[KO_ORDER.indexOf(round) - 1];
  if (!prev) return true; // R32
  return matches.some((x) => isKnockout(x) && koRound(x) === prev && x.state !== "pre");
};
const isPlaceholderName = (n) => /\d|^[12]\s*[a-l]$|3rd|third|winner|loser|runner|rd\d|w\d/i.test(n || "");
// Team to render. Once the feeding round is underway, show each real team as soon
// as ESPN fills its slot (partial bracket allocation as results land); otherwise
// show a feeder label ("R32 winner") so we never display an unconfirmed team.
function koDisplayTeam(m, side) {
  const t = koTeam(m, side);
  if (!isKnockout(m) || koReached(m)) return t;
  if (!isPlaceholderName(t.name) && koPrevStarted(m)) return t;   // slot decided → real team
  const name = koFeederLabel(koRound(m));
  return { name, abbr: name.slice(0, 3).toUpperCase(), logo: "" };
}

// Which knockout round a match belongs to (label from ESPN, else by date).
function koRound(m) {
  const g = (m.group || "").toLowerCase();
  if (/round[\s-]of[\s-]32/.test(g)) return "R32";
  if (/round[\s-]of[\s-]16/.test(g)) return "R16";
  if (/quarter/.test(g)) return "QF";
  if (/semi/.test(g)) return "SF";
  if (/third[\s-]place|3rd[\s-]place/.test(g)) return "3P";
  if (/\bfinal\b/.test(g)) return "F";
  const t = m.kickoff.getTime();
  if (t < Date.parse("2026-07-05")) return "R32";   // R32 runs through Jul 4
  if (t < Date.parse("2026-07-08")) return "R16";
  if (t < Date.parse("2026-07-13")) return "QF";
  if (t < Date.parse("2026-07-17")) return "SF";
  if (t < Date.parse("2026-07-19")) return "3P";
  return "F";
}
const KO_ROUND_NAME = { R32: "Round of 32", R16: "Round of 16", QF: "Quarter-finals", SF: "Semi-finals", "3P": "Third place", F: "Final" };
const roundMult = (m) => (KO().mult && KO().mult[koRound(m)]) || 1;

// Knockout score: who ADVANCES (ESPN 'advanced' covers penalties/ET) + exact
// 90-minute score, times the round multiplier (escalating).
// Who advanced from a knockout tie: ESPN's flag (covers extra time / penalties),
// else the decisive 90-minute result. Returns "home" | "away" | null.
function koAdvancer(m) {
  return m.advanced ||
    (m.completed && m.home.score != null && resultOf(m.home.score, m.away.score) !== "draw"
      ? resultOf(m.home.score, m.away.score) : null);
}

// How a finished knockout tie was decided: "reg" (90'), "et" (extra time) or
// "pen" (penalty shootout) — derived from ESPN status + shootout scores. Returns
// null if not a finished knockout match (or the data is too vague to tell).
// NOTE: the exact status strings need a sanity-check against a live ET/pens tie.
function koMatchMethod(m) {
  if (!isKnockout(m) || !m.completed || m.home.score == null) return null;
  const txt = `${m.statusName} ${m.detail}`.toLowerCase();
  if (m.home.shootout != null || m.away.shootout != null || /pen|shootout/.test(txt)) return "pen";
  if (/aet|a\.e\.t|extra/.test(txt) || (m.period && m.period > 2)) return "et";
  return "reg";
}

// A player's knockout advancer pick: the explicit who+how grid choice if present,
// else derived from the 90-min score (picks saved before the grid existed).
const koWinnerPick = (pred) =>
  pred.koWinner || (pred.home > pred.away ? "home" : pred.home < pred.away ? "away" : null);

// Knockout points: right team to advance (+3), right method (+3, only if the
// team is also right — you can't earn "how they win" when your team didn't win),
// and exact 90-min score (+3), each ×round multiplier.
function scoreKnockout(pred, m) {
  const k = KO();
  let base = 0;
  const adv = koAdvancer(m);
  const teamRight = !!adv && koWinnerPick(pred) === adv;
  if (teamRight) base += (k.advancePts ?? 3);                                  // 🏆 who advances
  const method = koMatchMethod(m);
  if (teamRight && method && pred.koMethod && pred.koMethod === method) base += (k.methodPts ?? 3); // ⏱ how
  // 🎯 exact — of the phase you predicted: 90-min score for a 90' pick, the
  // after-ET score for an ET pick, the end-of-ET draw for a penalties pick.
  // (ESPN reports that deciding score.) Legacy picks with no method = 90'.
  const predMethod = pred.koMethod || "reg";
  if (method && predMethod === method && pred.home === m.home.score && pred.away === m.away.score) {
    base += (k.exactPts ?? 3);
  }
  return base * roundMult(m);
}

// ---------------------------------------------------------------------------
// 🎰 THE FINAL GAMBLE — final-only luck/nerve overlay on top of the core score.
// Kept OUT of scoreKnockout/matchPoints on purpose: the core knockout points
// still drive only-winner / underdog / goal-rush / the live power bar, and the
// gamble is layered on top of the standings total (like a bonus) + shown at
// reveal. See FINAL_GAMBLE in firebase-config.js.
// ---------------------------------------------------------------------------
const FG = () => window.FINAL_GAMBLE || null;
const isFinalMatch = (m) => {
  const fg = FG();
  return !!(fg && fg.enabled && isKnockout(m) && koRound(m) === "F");
};
// Stable 32-bit string hash (FNV-1a). MUST match notify.js so a player's wheel
// spin is identical on every device and on the server — no re-rolls, no cheating.
function fgHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
// The wheel segment locked to this player for this match (weighted, deterministic).
function wheelFor(playerId, matchId) {
  const fg = FG();
  const segs = (fg && fg.wheel) || [];
  if (!segs.length) return null;
  const total = segs.reduce((s, x) => s + (x.weight || 1), 0);
  let r = fgHash(`${playerId}|${matchId}|wheel`) % total;
  for (const seg of segs) { r -= (seg.weight || 1); if (r < 0) return seg; }
  return segs[segs.length - 1];
}
// Did the player's chosen Joker prop hit? (final result + how it was decided)
function resolveJoker(pred, m) {
  const jk = pred.finalJoker;
  if (!jk || m.home.score == null) return false;
  const hs = m.home.score, as = m.away.score, total = hs + as, margin = Math.abs(hs - as);
  switch (jk) {
    case "over":    return total >= 3;
    case "under":   return total <= 2;
    case "btts_y":  return hs > 0 && as > 0;
    case "btts_n":  return !(hs > 0 && as > 0);
    case "margin2": return margin >= 2;
    case "close":   return margin <= 1;
    default:        return false;
  }
}
// Net points the gamble adds/subtracts for this player on the final (0 otherwise).
// core = the round-multiplied knockout score BEFORE the gamble.
function finalGambleDelta(pred, m, playerId) {
  const fg = FG();
  if (!isFinalMatch(m) || !m.completed || m.home.score == null) return 0;
  const pid = playerId || pred.playerId;
  const core = scoreKnockout(pred, m);
  const stake = fg.stakes.includes(pred.finalStake) ? pred.finalStake : 1;
  const seg = wheelFor(pid, m.id) || {};
  let delta = 0;
  if (core > 0) {
    delta += core * (stake - 1);                                   // 🎰 multiply the win
  } else {
    const pen = (fg.penalty && fg.penalty[stake]) || 0;            // 🎰 or pay the miss…
    if (pen && seg.kind !== "insure") delta -= pen;               //    …unless insured
  }
  if (resolveJoker(pred, m)) {                                     // 🃏 flat prop, ×2 on Double
    delta += (fg.jokerPts || 0) * (seg.kind === "dblJoker" ? 2 : 1);
  }
  if (seg.add) delta += seg.add;                                  // 🎡 pure luck add
  return delta;
}
// Compact reveal chips for a player's final gamble (stake · joker · wheel).
function gambleRevealStrip(pred, m, playerId) {
  const fg = FG();
  if (!fg || m.home.score == null) return "";
  const core = scoreKnockout(pred, m);
  const stake = fg.stakes.includes(pred.finalStake) ? pred.finalStake : 1;
  const seg = wheelFor(playerId || pred.playerId, m.id) || {};
  const chips = [];
  // 🎰 stake
  if (core > 0) {
    chips.push(`<span class="fgc win">🎰 ×${stake} → +${core * stake}</span>`);
  } else {
    const pen = (fg.penalty && fg.penalty[stake]) || 0;
    if (stake === 1) chips.push(`<span class="fgc safe">🎰 ×1 safe</span>`);
    else if (seg.kind === "insure") chips.push(`<span class="fgc save">🎰 ×${stake} miss · 🛡️ saved</span>`);
    else chips.push(`<span class="fgc loss">🎰 ×${stake} miss −${pen}</span>`);
  }
  // 🃏 joker
  if (pred.finalJoker) {
    const j = fg.jokers.find((x) => x.id === pred.finalJoker);
    const hit = resolveJoker(pred, m);
    const dbl = hit && seg.kind === "dblJoker";
    chips.push(`<span class="fgc ${hit ? "win" : "miss"}">🃏 ${j ? esc(j.label) : "?"} ${hit ? `✓ +${fg.jokerPts * (dbl ? 2 : 1)}${dbl ? " (2×)" : ""}` : "✗"}</span>`);
  }
  // 🎡 wheel
  if (seg.emoji) {
    const w = seg.add ? `+${seg.add}` : seg.kind === "dblJoker" ? "2× Joker" : seg.kind === "insure" ? "Insurance" : "";
    chips.push(`<span class="fgc luck">🎡 ${seg.emoji} ${w}</span>`);
  }
  return `<div class="pr-gamble">${chips.join("")}</div>`;
}

// Points for a single match, by phase (knockout vs group).
const matchPoints = (pred, m) =>
  isKnockout(m) ? scoreKnockout(pred, m) : scorePrediction(pred, m.home.score, m.away.score);

// Max points a single match can award right now — the full set, minus the
// knockout method bonus until full time (it can't be known mid-match). Powers
// the live "how close to maxing this game" bar.
function maxMatchPoints(m) {
  if (isKnockout(m)) {
    const k = KO();
    const methodPart = m.completed ? (k.methodPts ?? 3) : 0;
    return ((k.advancePts ?? 3) + methodPart + (k.exactPts ?? 3)) * roundMult(m);
  }
  return POINTS.WINNER + POINTS.EXACT;
}

// What a player's pick is worth if the match froze at (hs, as). For knockout the
// advancer is taken from whoever currently LEADS (provisional); the method only
// counts once the match has actually finished.
function liveMatchScore(pred, m, hs, as) {
  if (isKnockout(m)) {
    const k = KO();
    let base = 0;
    const leader = hs > as ? "home" : hs < as ? "away" : null;
    const teamRight = !!leader && koWinnerPick(pred) === leader;
    if (teamRight) base += (k.advancePts ?? 3);
    if (m.completed && teamRight) {
      const meth = koMatchMethod(m);
      if (meth && pred.koMethod === meth) base += (k.methodPts ?? 3);
    }
    if (pred.home === hs && pred.away === as) base += (k.exactPts ?? 3);
    return base * roundMult(m);
  }
  return scorePrediction(pred, hs, as);
}

// Admin-granted grace points (see BONUS_POINTS in firebase-config.js)
function bonusFor(name) {
  const b = window.BONUS_POINTS || {};
  return b[name] !== undefined ? b[name] : (b["*"] || 0);
}

// phase: "group" | "knockout" | "overall". Group-stage bonuses and grace points
// count toward group/overall only; the knockout race starts fresh from zero.
function buildStandings(live = false, phase = "overall") {
  const wantGroup = phase !== "knockout";
  const wantKO = phase !== "group";
  const R = window.RULES || {};
  const rows = players.map((p) => {
    const grace = wantGroup ? bonusFor(p.name) : 0;
    return { ...p, pts: grace, bonus: grace, exact: 0, outcomes: 0, played: 0, livePts: 0,
      gamble: 0,                                                          // 🎰 net final-gamble points
      bd: { onlyWinner: 0, underdog: 0, perfectPair: 0, goalRush: 0 } };   // bd = times earned
  });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const m of matches) {
    const ko = isKnockout(m);
    if (ko && !wantKO) continue;
    if (!ko && !wantGroup) continue;
    const final = m.completed && m.home.score != null;
    const inPlay = live && m.state === "in" && m.home.score != null;
    if (!final && !inPlay) continue;
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      const r = byId[p.id];
      const pts = matchPoints(pred, m);   // basic: winner/exact (or knockout score)
      r.pts += pts;
      if (final) {
        r.played++;
        const isExact = pred.home === m.home.score && pred.away === m.away.score;
        if (isExact) r.exact++;
        if (isExact || predWinner(pred) === resultOf(m.home.score, m.away.score)) r.outcomes++;
        // ⚽ Goal Rush — Round 3 onward & knockout: consolation for a 0-point
        // pick that still nailed the total goals (home + away)
        if (R.goalRush && round3On(m) && pts === 0 &&
            (pred.home + pred.away) === (m.home.score + m.away.score)) {
          r.pts += R.goalRush; r.bonus += R.goalRush; r.bd.goalRush += 1;
        }
        // 🎰 The Final Gamble — stake multiplier / penalty + joker + wheel
        if (isFinalMatch(m)) {
          const gd = finalGambleDelta(pred, m, p.id);
          r.pts += gd; r.gamble += gd;
        }
      } else {
        r.livePts += pts; // provisional, from an in-progress match
      }
    }
  }
  // All four bonus cards apply in BOTH phases (group + knockout through the
  // final), each scoped to its own race.
  if (wantGroup) {
    for (const [id, v] of Object.entries(onlyWinnerBonuses(false))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.onlyWinner += v.n; }
    for (const [id, v] of Object.entries(underdogBonuses(false))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.underdog += v.n; }
    for (const [id, v] of Object.entries(perfectPairBonuses(false))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.perfectPair += v.n; }
  }
  if (wantKO) {
    for (const [id, v] of Object.entries(onlyWinnerBonuses(true))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.onlyWinner += v.n; }
    for (const [id, v] of Object.entries(underdogBonuses(true))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.underdog += v.n; }
    for (const [id, v] of Object.entries(perfectPairBonuses(true))) if (byId[id]) { byId[id].pts += v.pts; byId[id].bonus += v.pts; byId[id].bd.perfectPair += v.n; }
  }
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

// Knockout underdog: the lower-FIFA-ranked side, but only if it ADVANCED
// (penalties / extra time included). Else null.
function koUpsetSide(m) {
  const adv = koAdvancer(m);
  if (!adv) return null;
  const rh = fifaRank(m.home.name), ra = fifaRank(m.away.name);
  if (rh == null || ra == null) return null;
  if (adv === "home" && rh > ra) return "home";
  if (adv === "away" && ra > rh) return "away";
  return null;
}

// { playerId: {pts, n} } — +RULES.underdogBonus each time a player correctly
// backed the lower-ranked winner, counted from RULES.bonusFrom. n = times earned.
function underdogBonuses(ko = false) {
  const R = window.RULES || {};
  const out = {};
  const add = (id, pts) => { out[id] = out[id] || { pts: 0, n: 0 }; out[id].pts += pts; out[id].n += 1; };
  if (!R.underdogBonus) return out;
  const fromMs = R.bonusFrom ? Date.parse(R.bonusFrom) : 0;
  for (const m of matches) {
    if (isKnockout(m) !== ko) continue;                 // scope to the requested phase
    if (!m.completed || m.home.score == null) continue;
    if (!ko && m.kickoff.getTime() < fromMs) continue;  // group bonus has a start date
    const side = ko ? koUpsetSide(m) : upsetWinSide(m);
    if (!side) continue;
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      const pick = ko ? koWinnerPick(pred) : predWinner(pred);
      if (pick === side) add(p.id, R.underdogBonus);
    }
  }
  return out;
}

// { playerId: {pts, n} } — +RULES.onlyWinnerBonus each time a player is the lone
// scorer of a completed match. Applies in BOTH phases: pass ko=true for the
// knockout race, ko=false for the group race (gated by RULES.bonusFrom).
function onlyWinnerBonuses(ko = false) {
  const R = window.RULES || {};
  const out = {};
  const add = (id, pts) => { out[id] = out[id] || { pts: 0, n: 0 }; out[id].pts += pts; out[id].n += 1; };
  if (!R.onlyWinnerBonus) return out;
  const fromMs = R.bonusFrom ? Date.parse(R.bonusFrom) : 0;
  for (const m of matches) {
    if (isKnockout(m) !== ko) continue;                 // scope to the requested phase
    if (!m.completed || m.home.score == null) continue;
    if (!ko && m.kickoff.getTime() < fromMs) continue;  // group bonus has a start date
    const scorers = [];
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      if (matchPoints(pred, m) > 0) scorers.push(p.id);
    }
    if (scorers.length === 1) add(scorers[0], R.onlyWinnerBonus);
  }
  return out;
}

// { playerId: {pts, n} } — "Perfect Pair": two matches that kick off at the same
// time. Get BOTH outcomes right → +perfectPairOutcome (once); both exact →
// +perfectPairExact. n = pairs nailed. Group stage: a group's two Round-3 matches.
// Knockout (ko=true): any two ties kicking off simultaneously, through the final.
function perfectPairBonuses(ko = false) {
  const R = window.RULES || {};
  const out = {};
  const add = (id, pts) => { out[id] = out[id] || { pts: 0, n: 0 }; out[id].pts += pts; out[id].n += 1; };
  if (!R.perfectPairOutcome && !R.perfectPairExact) return out;
  const pairs = {};
  for (const m of matches) {
    if (isKnockout(m) !== ko) continue;
    if (!m.completed || m.home.score == null) continue;
    if (ko) {
      const key = `ko@${m.kickoff.getTime()}`;          // two knockout ties at the same time
      (pairs[key] = pairs[key] || []).push(m);
    } else {
      if (!round3On(m)) continue;
      const g = groupOf(m.home.name);
      if (!g || groupOf(m.away.name) !== g) continue;   // both teams same group
      const key = `${g}@${m.kickoff.getTime()}`;        // a group's simultaneous slot
      (pairs[key] = pairs[key] || []).push(m);
    }
  }
  for (const key of Object.keys(pairs)) {
    const pair = pairs[key];
    if (pair.length !== 2) continue;                     // need exactly two, both done
    for (const p of players) {
      let allOutcome = true, allExact = true;
      for (const m of pair) {
        const pred = predictions[`${m.id}_${p.id}`];
        if (!pred || !isValidPrediction(pred, m)) { allOutcome = false; break; }
        const exact = pred.home === m.home.score && pred.away === m.away.score;
        const outcome = ko
          ? koWinnerPick(pred) === koAdvancer(m)          // knockout: correct advancer
          : exact || predWinner(pred) === resultOf(m.home.score, m.away.score);
        if (!outcome) allOutcome = false;
        if (!exact) allExact = false;
      }
      if (!allOutcome) continue;
      add(p.id, allExact ? R.perfectPairExact : R.perfectPairOutcome);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  renderAdminHealth();
  fillAnnouncement();   // reveal exact-score player names once data is loaded
  koSlots = hasKnockout() ? koSlotMap() : {};   // live-resolve bracket placeholders
  if (activeTab === "matches") renderMatches();
  else if (activeTab === "table") renderTable();
  else if (activeTab === "share") renderShare();
  else if (activeTab === "profile") renderProfile();
  else renderMatches();
  // analytics: the admin's device reports EVERYONE's points (a full snapshot /
  // backfill of accumulated points); everyone else reports just their own.
  if (me && me.name === ADMIN_NAME) trackAllScores();
  else trackScore();
}

const scoreEvent = (r, rank, total) => trackEvent("player_score", {
  player: r.name, points: r.pts, rank, exact: r.exact, played: r.played,
  phase: "overall", players_total: total,
});

// Report the logged-in player's live score to Google Analytics whenever it
// changes (fires once per open, then on every points move). Register `player`
// (custom dimension) and `points` (custom metric) in GA4 to chart them.
let lastTrackedScore = null;
function trackScore() {
  if (!me || !db || !analyticsLog || !players.length) return;
  const rows = buildStandings(false, "overall");
  const idx = rows.findIndex((r) => r.id === me.id);
  if (idx < 0) return;
  if (lastTrackedScore === rows[idx].pts) return;   // only emit when it changes
  lastTrackedScore = rows[idx].pts;
  scoreEvent(rows[idx], idx + 1, rows.length);
}

// Admin-only: emit a player_score event for EVERY player (backfills accumulated
// points now, then re-sends the full board whenever any total changes).
let lastAllScoresKey = null;
function trackAllScores() {
  if (!db || !analyticsLog || !players.length) return;
  const rows = buildStandings(false, "overall");
  const key = rows.map((r) => `${r.id}:${r.pts}`).join(",");
  if (key === lastAllScoresKey) return;             // no change → skip
  lastAllScoresKey = key;
  rows.forEach((r, i) => scoreEvent(r, i + 1, rows.length));
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
  // Finished: most-recent first (newest day + newest kickoff at the top).
  else if (matchFilter === "finished") list = matches.filter((m) => m.completed).reverse();

  // Always pin live match(es) to the very top, no matter which filter is on,
  // and drop them from the list below so they aren't shown twice.
  const pinned = matches.filter((m) => m.state === "in");
  const pinnedIds = new Set(pinned.map((m) => m.id));
  if (pinned.length) list = list.filter((m) => !pinnedIds.has(m.id));

  const pills = ["today", "upcoming", "finished", "all"]
    .map((f) => `<button class="pill ${f === matchFilter ? "active" : ""}" data-filter="${f}">${cap(f)}</button>`)
    .join("");

  let html = "";
  if (pinned.length) {
    html += `<div class="pinned-live"><div class="pinned-head">📌 Live now</div>`;
    for (const m of pinned) html += matchCard(m);
    html += `</div>`;
  }
  html += `<div class="pills">${pills}</div>`;
  if (!list.length && !pinned.length) {
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
  view.querySelectorAll("[data-kocell]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const [matchId, side, method] = e.currentTarget.dataset.kocell.split("|");
      const d = draft[matchId];
      d.koWinner = side; d.koMethod = method;
      // Keep the score consistent with the pick: 90' or Extra Time → the chosen
      // team must lead (the score is the deciding-phase result); Penalties → level.
      koSyncScore(d);
      $(`#st-${matchId}-home`).textContent = d.home;
      $(`#st-${matchId}-away`).textContent = d.away;
      const when = $(`#ko-exact-when-${matchId}`); if (when) when.textContent = `· ${koExactWhen(method)}`;
      const hint = $(`#ko-exact-hint-${matchId}`); if (hint) hint.textContent = koExactHint(method);
      e.currentTarget.closest(".kogrid").querySelectorAll(".kocell")
        .forEach((x) => x.classList.toggle("sel", x === e.currentTarget));
    })
  );
  // 🎰 Final Gamble — stake selector
  view.querySelectorAll("[data-fstake]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const [matchId, s] = e.currentTarget.dataset.fstake.split("|");
      draft[matchId].finalStake = Number(s);
      e.currentTarget.closest(".fg-stakes").querySelectorAll(".fg-stake")
        .forEach((x) => x.classList.toggle("sel", x === e.currentTarget));
    })
  );
  // 🃏 Final Gamble — joker prop (tap again to clear)
  view.querySelectorAll("[data-fjoker]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const [matchId, id] = e.currentTarget.dataset.fjoker.split("|");
      const d = draft[matchId];
      const wasSel = d.finalJoker === id;
      d.finalJoker = wasSel ? null : id;
      e.currentTarget.closest(".fg-jokers").querySelectorAll(".fg-joker")
        .forEach((x) => x.classList.toggle("sel", !wasSel && x === e.currentTarget));
    })
  );
  // 🎡 Final Gamble — the player taps SPIN to roll the big wheel
  view.querySelectorAll("[data-spin]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const el = e.currentTarget.closest(".fg-wheelwrap");
      if (el) spinWheel(el);
    })
  );
  view.querySelectorAll("[data-winner]").forEach((b) =>
    b.addEventListener("click", (e) => {
      const [matchId, val] = e.currentTarget.dataset.winner.split("|");
      const d = draft[matchId];
      // Keep the score consistent with the chosen outcome so they can't
      // contradict: Draw → level the score; a team → make that team lead.
      if (val === "draw") {
        const lvl = Math.min(d.home, d.away);
        d.home = lvl; d.away = lvl;
      } else if (val === "home" && d.home <= d.away) {
        d.home = d.away + 1;
      } else if (val === "away" && d.away <= d.home) {
        d.away = d.home + 1;
      }
      d.winner = val;
      $(`#st-${matchId}-home`).textContent = d.home;
      $(`#st-${matchId}-away`).textContent = d.away;
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
  const H = koDisplayTeam(m, "home"), A = koDisplayTeam(m, "away");  // resolved/suppressed for knockout
  // knockout teams shown are a live projection until the slot is confirmed
  const projected = isKnockout(m) && (koSlots[`${m.id}|home`] || koSlots[`${m.id}|away`]);
  const badge = isDelayed(m)
    ? `<span class="badge delayed">⏸ DELAYED</span>`
    : m.state === "in"
    ? `<span class="badge live">● LIVE</span>`
    : m.completed
      ? `<span class="badge ft">FT</span>`
      : open
        ? `<span class="badge open">OPEN</span>`
        : `<span class="badge locked">🔒 LOCKED</span>`;

  const center = (m.state === "pre" && !isDelayed(m))
    ? `<div class="ko-time">${fmtTime(m.kickoff)}</div><div class="clock">kickoff</div>`
    : `<div class="score ${m.state === "in" ? "live-score" : ""}">${m.home.score ?? "-"} : ${m.away.score ?? "-"}</div>
       <div class="clock">${isDelayed(m) ? "⏸ Delayed" : esc(m.detail)}</div>`;

  const flag = (t) => t.logo
    ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=flag-fallback>⚽</div>'">`
    : `<div class="flag-fallback">⚽</div>`;

  let body = "";
  if (open && db && me) {
    const mine = predictions[`${m.id}_${me.id}`];
    const d = draft[m.id] || {
      home: mine?.home ?? 0,
      away: mine?.away ?? 0,
      winner: resultOf(mine?.home ?? 0, mine?.away ?? 0),
      koWinner: mine?.koWinner ?? null,
      koMethod: mine?.koMethod ?? null,
      finalStake: mine?.finalStake ?? 1,
      finalJoker: mine?.finalJoker ?? null,
    };
    draft[m.id] = d;
    const lockNote = `<div class="lock-note">${mine ? `✅ Your bet: <b>${pickLabel(mine, m)}</b> · ` : ""}${
        isOverridden(m) ? "🔓 Re-opened by admin — closes when the 2nd half starts!" : `🔒 Locks at ${fmtTime(lockTime(m))}`
      }</div>`;
    if (isKnockout(m)) {
      body = koPredictBody(m, mine, H, A, d) + lockNote;
    } else {
      const wbtn = (val, label) =>
        `<button class="wbtn ${d.winner === val ? "sel" : ""}" data-winner="${m.id}|${val}">${label}</button>`;
      body = `
        <div class="winner-row">
          ${wbtn("home", `🏆 ${esc(H.abbr)}`)}
          ${wbtn("draw", "🤝 Draw")}
          ${wbtn("away", `🏆 ${esc(A.abbr)}`)}
        </div>
        <div class="predict">
          ${stepper(m.id, "home", d.home)}
          <span class="vs">—</span>
          ${stepper(m.id, "away", d.away)}
          <button class="save-btn" data-save="${m.id}">${mine ? "Update" : "Save"} 🎯</button>
        </div>
        ${lockNote}`;
    }
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
  const mr = { ...m, home: H, away: A };   // resolved teams for rank-based win prob
  const probP = m.state === "pre" ? matchWinProb(mr) : null;
  const prob = probP ? winProbHtml(mr, probP) : "";

  return `
    <div class="match">
      <div class="match-top"><span>${esc(m.group || "World Cup 2026")}${projected ? ' · <span class="proj-tag">📊 as it stands</span>' : ""}</span>${badge}</div>
      <div class="teams">
        ${teamHtml(H)}
        <div class="center">${center}</div>
        ${teamHtml(A)}
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

// Knockout "who + how" predict body: a team × method grid (90' / Extra Time /
// Penalties) plus an exact-score picker that follows the chosen method.
const KO_METHODS = [["reg", "in 90'"], ["et", "Extra&nbsp;Time"], ["pen", "Penalties"]];
const koExactWhen = (mk) => mk === "et" ? "after extra time" : mk === "pen" ? "end of extra time" : "at 90 minutes";
const koExactHint = (mk) => mk === "et"
  ? "Predict the final score after extra time (your team ahead)."
  : mk === "pen"
  ? "Penalties → predict the level score at the end of extra time."
  : "Predict the 90-minute score. Tap Extra Time above to predict an ET score instead.";
function koPredictBody(m, mine, H, A, d) {
  const cellFlag = (t) => t.logo
    ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='⚽'">`
    : "⚽";
  const cellsFor = (side, t) => KO_METHODS.map(([mk, lbl]) => {
    const sel = d.koWinner === side && d.koMethod === mk;
    return `<button class="kocell ${sel ? "sel" : ""}" data-kocell="${m.id}|${side}|${mk}">
        <span class="kocell-flag">${cellFlag(t)}</span>
        <span class="kocell-team">${esc(t.abbr)}</span>
        <span class="kocell-how">${lbl}</span>
      </button>`;
  }).join("");
  const gamble = isFinalMatch(m) ? finalGambleBody(m, d) : "";
  const saveRow = `
      <div class="predict">
        ${stepper(m.id, "home", d.home)}
        <span class="vs">—</span>
        ${stepper(m.id, "away", d.away)}
        ${gamble ? "" : `<button class="save-btn" data-save="${m.id}">${mine ? "Update" : "Save"} 🎯</button>`}
      </div>
      <div class="ko-hint" id="ko-exact-hint-${m.id}">${koExactHint(d.koMethod)}</div>`;
  return `
    <div class="kopredict${gamble ? " is-final" : ""}">
      <div class="ko-sec-h"><b>1</b> Who will win &amp; how?</div>
      <div class="kogrid">${cellsFor("home", H)}${cellsFor("away", A)}</div>
      <div class="ko-sec-h"><b>2</b> Exact score <small id="ko-exact-when-${m.id}">· ${koExactWhen(d.koMethod)}</small></div>
      ${saveRow}
      ${gamble}
      ${gamble ? `<button class="save-btn save-final" data-save="${m.id}">🎰 ${mine ? "Update my gamble" : "Lock in my gamble"}</button>` : ""}
    </div>`;
}

// 🎰 THE FINAL GAMBLE predict UI — Stake / Joker / Wheel, shown only on the Final.
function finalGambleBody(m, d) {
  const fg = FG();
  if (!fg) return "";
  const stakeLbl = { 1: "×1 Safe", 2: "×2 Bold", 3: "×3 All-in" };
  const stakeSub = { 1: "never loses", 2: `miss −${fg.penalty[2]}`, 3: `miss −${fg.penalty[3]}` };
  const stakeBtns = fg.stakes.map((s) =>
    `<button class="fg-stake ${d.finalStake === s ? "sel" : ""}" data-fstake="${m.id}|${s}">
       <b>${stakeLbl[s] || "×" + s}</b><small>${stakeSub[s] || ""}</small>
     </button>`).join("");
  const jokerBtns = fg.jokers.map((j) =>
    `<button class="fg-joker ${d.finalJoker === j.id ? "sel" : ""}" data-fjoker="${m.id}|${j.id}" title="${esc(j.hint || "")}">
       <span class="fg-j-emoji">${j.emoji}</span>
       <span class="fg-j-lbl">${esc(j.label)}</span>
     </button>`).join("");
  const wheelCard = buildWheel(m);
  return `
    <div class="fg-wrap">
      <div class="fg-title">🎰 THE FINAL GAMBLE <span>make it count</span></div>

      <div class="ko-sec-h"><b>3</b> 🎰 The Stake — multiply your base Final points</div>
      <div class="fg-stakes">${stakeBtns}</div>
      <div class="ko-hint">Get your who + how + exact right, then bank it: ×1 keeps it safe, ×2/×3 multiply it — but if you miss everything you <b>pay</b> the ×2/×3 penalty. ×1 never loses.</div>

      <div class="ko-sec-h"><b>4</b> 🃏 The Joker — one side-bet for a flat +${fg.jokerPts}</div>
      <div class="fg-jokers">${jokerBtns}</div>
      <div class="ko-hint">Pick the ONE you think lands. Right → <b>+${fg.jokerPts}</b>. (Tap again to unpick — the Joker is optional.)</div>

      <div class="ko-sec-h"><b>5</b> 🎡 The Wheel — spin for a luck bonus</div>
      ${wheelCard}
      <div class="ko-hint">Everyone gets <b>one</b> spin. The result is sealed to you — it lands the same no matter when you spin, so nobody can re-roll for a better one. It's added to your Final score automatically, even if you forget to spin.</div>
    </div>`;
}
// Plain-language result line for a landed wheel segment.
function wheelResultHtml(seg) {
  if (seg.kind === "dblJoker")
    return `<b>2️⃣ Double Joker!</b><small>Your Joker reward counts <b>double</b> (+${(FG().jokerPts || 5) * 2} if it lands).</small>`;
  if (seg.kind === "insure")
    return `<b>🛡️ Insurance!</b><small>If your stake misses, the penalty is <b>cancelled</b> — you can't go negative.</small>`;
  if (seg.id === "jackpot")
    return `<b>💎 JACKPOT +${seg.add}!</b><small><b>+${seg.add} points</b> added straight to your Final score. 🤑</small>`;
  return `<b>${seg.emoji} +${seg.add}</b><small><b>+${seg.add} bonus points</b> added straight to your Final score.</small>`;
}
// Per-device "already spun this match" flag (so the reveal sticks between opens).
// The scoring outcome is deterministic regardless — this only gates the animation.
const fgSpun = (mid) => { try { return !!localStorage.getItem(`fgspin_${mid}`); } catch { return false; } };
const fgMarkSpun = (mid) => { try { localStorage.setItem(`fgspin_${mid}`, "1"); } catch {} };

const SPIN_MS = 10000;                         // wheel spin duration (~10s decel)
const WHEEL_COLORS = ["#7c3aed", "#f4c542", "#2ea36b", "#e0632b", "#3aa0e0", "#c8489a"];
const wheelValLbl = (seg) =>
  seg.kind === "dblJoker" ? "2× JOKER" : seg.kind === "insure" ? "INSURE" : `+${seg.add}`;

// Point on the wheel (viewBox 0..100), angle measured CLOCKWISE from the top.
function wheelPt(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180;
  return [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
}
// Where this player's wheel lands: the sealed segment, its index, and the wheel's
// resting rotation (so the segment sits under the top pointer). Deterministic.
function wheelLanding(playerId, matchId) {
  const segs = (FG() && FG().wheel) || [];
  const seg = wheelFor(playerId, matchId);
  const idx = Math.max(0, segs.indexOf(seg));
  const step = 360 / segs.length;
  const jitter = (fgHash(`${playerId}|${matchId}|jit`) % 41) - 20;   // ±20° within the slice
  const rest = ((-(idx * step + step / 2) + jitter) % 360 + 360) % 360;
  return { seg, idx, step, rest };
}
// The big prize wheel: an SVG disc with every segment visible, a pointer, and a
// SPIN hub. All outcomes are shown; it lands on the player's sealed one.
function buildWheel(m) {
  const fg = FG();
  if (!fg || !me) return `<div class="fg-wheel-empty">🔒 Join the game to spin your wheel</div>`;
  const segs = fg.wheel;
  const step = 360 / segs.length;
  const slices = segs.map((seg, k) => {
    const [x0, y0] = wheelPt(k * step, 48);
    const [x1, y1] = wheelPt((k + 1) * step, 48);
    const large = step > 180 ? 1 : 0;
    const [ex, ey] = wheelPt(k * step + step / 2, 31);   // label anchor
    const col = WHEEL_COLORS[k % WHEEL_COLORS.length];
    return `
      <path d="M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A48 48 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z"
            fill="${col}" stroke="#0b0716" stroke-width="0.7"/>
      <g transform="translate(${ex.toFixed(2)} ${ey.toFixed(2)})">
        <text text-anchor="middle" y="-1" font-size="8">${seg.emoji}</text>
        <text text-anchor="middle" y="6" font-size="3.6" font-weight="800" fill="#fff">${wheelValLbl(seg)}</text>
      </g>`;
  }).join("");
  const { rest } = wheelLanding(me.id, m.id);
  const spun = fgSpun(m.id);
  const restStyle = spun ? ` style="transform:rotate(${rest}deg)"` : "";
  const seg = wheelFor(me.id, m.id);
  return `
    <div class="fg-wheelbox">
      <div class="fg-wheelwrap ${spun ? "done" : "ready"}" data-wheel="${m.id}">
        <div class="fg-pointer"></div>
        <svg class="fg-wheel-svg" viewBox="0 0 100 100"${restStyle} aria-hidden="true">
          <circle cx="50" cy="50" r="49" fill="none" stroke="#f4c542" stroke-width="1.5"/>
          ${slices}
          <circle cx="50" cy="50" r="9" fill="#140c26" stroke="#f4c542" stroke-width="1"/>
        </svg>
        <button class="fg-hub" data-spin="${m.id}">SPIN</button>
      </div>
      <div class="fg-wheel-out">${spun ? wheelResultHtml(seg) : `<b>Give it a spin! 🎡</b><small>Watch it roll — it'll land on your surprise bonus.</small>`}</div>
    </div>`;
}

// Big-wheel spin: many turns + a long ease-out, settling on the sealed segment.
function spinWheel(wrap) {
  const mid = wrap.dataset.wheel;
  const fg = FG();
  const svg = wrap.querySelector(".fg-wheel-svg");
  const hub = wrap.querySelector(".fg-hub");
  const out = wrap.closest(".fg-wheelbox")?.querySelector(".fg-wheel-out");
  if (!svg || !fg || !me || wrap.classList.contains("spinning")) return;
  const { seg, rest } = wheelLanding(me.id, mid);
  if (!seg) return;
  wrap.classList.add("spinning");
  wrap.classList.remove("ready", "done");
  if (hub) { hub.disabled = true; hub.textContent = "…"; }
  // Reset to 0 (clearing any resting rotation from a previous spin), force a
  // reflow so the reset lands, then animate the full spin in the next frame.
  svg.style.transition = "none";
  svg.style.transform = "rotate(0deg)";
  void svg.getBoundingClientRect();
  const target = rest + 360 * 9;                 // 9 full turns, then settle
  requestAnimationFrame(() => {
    svg.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.62, 0.05, 1)`;
    svg.style.transform = `rotate(${target}deg)`;
  });
  const finish = () => {
    wrap.classList.remove("spinning");
    wrap.classList.add("done");
    if (hub) { hub.disabled = false; hub.textContent = "SPIN"; }
    if (out) { out.innerHTML = wheelResultHtml(seg); out.classList.add("pop"); }
    fgMarkSpun(mid);
  };
  let done = false;
  const once = () => { if (done) return; done = true; finish(); };
  svg.addEventListener("transitionend", once, { once: true });
  setTimeout(once, SPIN_MS + 250);               // fallback if transitionend is missed
}

function revealBlock(m) {
  const done = m.completed && m.home.score != null;
  const R = window.RULES || {};
  const ko = isKnockout(m);
  const bonusOn = done && (ko || !R.bonusFrom || m.kickoff.getTime() >= Date.parse(R.bonusFrom));
  // All bonus cards apply in both phases; underdog uses the advancer in knockout.
  const upset = bonusOn && R.underdogBonus ? (ko ? koUpsetSide(m) : upsetWinSide(m)) : null;
  // who scored on this match (for the only-winner bonus)
  const scorerIds = !bonusOn || !R.onlyWinnerBonus ? [] : players
    .filter((p) => {
      const pr = predictions[`${m.id}_${p.id}`];
      return pr && isValidPrediction(pr, m) && matchPoints(pr, m) > 0;
    })
    .map((p) => p.id);
  const soleId = scorerIds.length === 1 ? scorerIds[0] : null;

  const list = players
    .map((p) => {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred) return null;
      const late = !isValidPrediction(pred, m);
      const base = (done && !late) ? matchPoints(pred, m) : null;
      let bonus = 0, badges = "";
      if (base != null && bonusOn) {
        if (soleId === p.id) { bonus += R.onlyWinnerBonus; badges += "🏅"; }
        const advPick = ko ? koWinnerPick(pred) : predWinner(pred);
        if (upset && advPick === upset) { bonus += R.underdogBonus; badges += "🐺"; }
      }
      // ⚽ Goal Rush (Round 3 onward & knockout): consolation for a 0-point pick
      // that still nailed the total goals (no reward if the player already scored)
      if (base === 0 && R.goalRush && round3On(m) &&
          (pred.home + pred.away) === (m.home.score + m.away.score)) {
        bonus += R.goalRush; badges += "⚽";
      }
      // 🎰 The Final Gamble — fold the stake/joker/wheel swing into this row
      let gambleStrip = "";
      if (base != null && isFinalMatch(m)) {
        bonus += finalGambleDelta(pred, m, p.id);
        gambleStrip = gambleRevealStrip(pred, m, p.id);
      }
      const pts = base == null ? null : base + bonus;
      return { p, pred, late, base, pts, badges, gambleStrip };
    })
    .filter(Boolean);
  if (!list.length) return `<div class="lock-note">No predictions for this match 🤷</div>`;
  if (done) list.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1));

  const HOW_LBL = { reg: "90'", et: "ET", pen: "PEN" };
  const rows = list.map(({ p, pred, late, base, pts, badges, gambleStrip }) => {
    let team, how = "";
    if (ko) {
      const wp = koWinnerPick(pred);   // explicit advancer pick (falls back to score)
      team = wp ? esc(wp === "home" ? m.home.abbr : m.away.abbr) : "—";
      if (pred.koMethod && HOW_LBL[pred.koMethod]) {
        how = ` <i class="pr-how ${pred.koMethod}">${HOW_LBL[pred.koMethod]}</i>`;
      }
    } else {
      const w = predWinner(pred);
      team = w === "draw" ? "Draw" : esc(w === "home" ? m.home.abbr : m.away.abbr);
    }
    const ptsTxt = pts != null ? `${pts >= 0 ? "+" : ""}${pts}` : "";
    const ptsHtml = late
      ? `<span class="pr-pts late">late</span>`
      : (pts != null ? `<span class="pr-pts p${base}${pts < 0 ? " neg" : ""}">${ptsTxt}${badges ? ` <span class="pr-badge">${badges}</span>` : ""}</span>` : `<span class="pr-pts pending">—</span>`);
    return `
      <div class="pr-row ${me && p.id === me.id ? "mine" : ""}${gambleStrip ? " has-gamble" : ""}">
        <div class="pr-av">${p.emoji}</div>
        <div class="pr-name">${esc(p.name)}</div>
        <div class="pr-pick"><b>${pred.home}–${pred.away}</b><span class="pr-team">${team}${how}</span></div>
        ${ptsHtml}
        ${gambleStrip}
      </div>`;
  }).join("");
  return `<div class="reveal">${rows}</div>`;
}

// Keep a knockout draft's 90-min score consistent with the who+how pick:
// a 90' win → the chosen team must lead; Extra Time / Penalties → level at 90'.
function koSyncScore(d) {
  if (!d.koWinner || !d.koMethod) return;
  if (d.koMethod === "pen") {                // penalties → level at the end of ET
    const lvl = Math.min(d.home, d.away);
    d.home = lvl; d.away = lvl;
  } else {                                   // 90' or Extra Time → chosen team wins
    if (d.koWinner === "home" && d.home <= d.away) d.home = d.away + 1;
    else if (d.koWinner === "away" && d.away <= d.home) d.away = d.home + 1;
  }
}
// True when a knockout draft's score contradicts its who+how pick.
function koInconsistent(d) {
  if (!d.koWinner || !d.koMethod) return false;
  if (d.koMethod === "pen") return d.home !== d.away;   // pens must be level at ET end
  return d.koWinner === "home" ? d.home <= d.away : d.away <= d.home; // 90'/ET: team ahead
}

function onStep(e) {
  const [matchId, side, delta] = e.currentTarget.dataset.step.split("|");
  const d = draft[matchId];
  const m = matches.find((x) => x.id === matchId);
  d[side] = Math.max(0, Math.min(15, d[side] + Number(delta)));
  // Knockout "win in 90' / after extra time": the leading team IS the team you
  // back to advance, so keep the grid pick in lockstep with the score.
  if (m && isKnockout(m) && (d.koMethod === "reg" || d.koMethod === "et")) {
    const lead = resultOf(d.home, d.away);
    if (lead !== "draw") {
      d.koWinner = lead;
      const grid = e.currentTarget.closest(".match")?.querySelector(".kogrid");
      if (grid) grid.querySelectorAll(".kocell").forEach((x) =>
        x.classList.toggle("sel", x.dataset.kocell.split("|")[1] === lead && x.dataset.kocell.split("|")[2] === d.koMethod));
    }
  }
  $(`#st-${matchId}-${side}`).textContent = d[side];
  // keep the winner highlight in sync with the score (level = draw) — group stage
  d.winner = resultOf(d.home, d.away);
  const row = e.currentTarget.closest(".match")?.querySelector(".winner-row");
  if (row) row.querySelectorAll(".wbtn").forEach((x) =>
    x.classList.toggle("sel", x.dataset.winner.split("|")[1] === d.winner));
}

async function onSave(e) {
  const matchId = e.currentTarget.dataset.save;
  const m = matches.find((x) => x.id === matchId);
  if (!m || !me || !db) return;
  if (!isOpen(m)) { toast("🔒 Too late — predictions are locked!"); render(); return; }
  const d = draft[matchId];
  const ko = isKnockout(m);
  if (ko && (!d.koWinner || !d.koMethod)) { toast("👆 Tap who wins & how first!"); return; }
  if (ko && koInconsistent(d)) {
    const team = koDisplayTeam(m, d.koWinner).abbr;
    toast(d.koMethod === "pen"
      ? "⚠️ Penalties means it's level at the end of extra time — make the score a draw."
      : `⚠️ You picked ${team} to win ${d.koMethod === "et" ? "after extra time" : "in 90'"} — the score must show ${team} ahead.`);
    return;
  }
  // outcome follows the score (level = draw, decisive = that team)
  const winner = resultOf(d.home, d.away);
  const doc = {
    matchId,
    playerId: me.id,
    winner,
    home: d.home,
    away: d.away,
    kickoff: m.kickoff.toISOString(),
    lockAt: lockTime(m).getTime(),   // freeze the deadline at save time
    updatedAt: fs.serverTimestamp(),
  };
  if (ko) { doc.koWinner = d.koWinner; doc.koMethod = d.koMethod; }
  if (ko && isFinalMatch(m)) {
    doc.finalStake = FG().stakes.includes(d.finalStake) ? d.finalStake : 1;
    doc.finalJoker = d.finalJoker || null;
  }
  try {
    await fs.setDoc(fs.doc(db, "predictions", `${matchId}_${me.id}`), doc);
    trackEvent("prediction_saved", { match: `${m.home.abbr}-${m.away.abbr}` });
    toast(`🎯 Saved: ${pickLabel(doc, m)}`);
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
  const ko = hasKnockout();
  // Default to Group during the group stage, switch to Knockout once it starts.
  const defaultPhase = ko ? (koStarted() ? "knockout" : "group") : "overall";
  const phase = ko ? (standingsPhase || defaultPhase) : "overall";
  const liveMatches = matches.filter((m) => m.state === "in" && m.home.score != null &&
    (phase === "overall" || (phase === "knockout") === isKnockout(m)));
  const isLive = liveMatches.length > 0;
  const rows = buildStandings(isLive, phase);
  if (!rows.length) {
    view.innerHTML = `<div class="empty">No players yet — be the first to join! 🎉</div>`;
    return;
  }
  // When live, movement shows the shuffle caused by in-play results (vs the
  // confirmed table); otherwise it's "since the last finished match".
  let prevRanks;
  if (isLive) {
    prevRanks = {};
    buildStandings(false, phase).forEach((r, i) => (prevRanks[r.id] = i + 1));
  } else {
    prevRanks = phase === "overall" ? (standingsSnap?.prevRanks || null) : null;
  }
  const glyph = { up: "▲", down: "▼", same: "–" };
  // grace is intentionally omitted — it counts toward the total but folds into "base"
  const BONUS_ICONS = [["onlyWinner", "🏅"], ["underdog", "🐺"], ["perfectPair", "🤝"], ["goalRush", "⚽"]];

  const html = rows.map((r, i) => {
    const rank = i + 1;
    const medal = ["🥇", "🥈", "🥉"][i] || rank;
    const rcls = rank <= 3 ? ` r${rank}` : "";
    const prevRank = prevRanks ? prevRanks[r.id] : null;
    const mv = prevRank == null ? "same" : (prevRank - rank > 0 ? "up" : prevRank - rank < 0 ? "down" : "same");
    const dots = formDots(r.id).map((f) => `<span class="st-dot ${f}"></span>`).join("");
    const meCls = me && r.id === me.id ? " me" : "";
    // second-line breakdown: each bonus type earned (with icon) + live portion
    const bonusChips = (r.bd ? BONUS_ICONS : [])
      .filter(([k]) => r.bd[k] > 0)
      .map(([k, ic]) => `<span class="st-chip bonus">${ic} <b>×${r.bd[k]}</b></span>`)
      .join("");
    const liveChip = isLive && r.livePts ? `<span class="st-chip live">🔴 +${r.livePts}<small>live</small></span>` : "";
    const gambleChip = r.gamble ? `<span class="st-chip gamble">🎰 ${r.gamble > 0 ? "+" : ""}${r.gamble}<small>final</small></span>` : "";
    const breakdown = (bonusChips || liveChip || gambleChip)
      ? `<div class="st-breakdown">${bonusChips}${gambleChip}${liveChip}</div>`
      : "";
    // live power meter — how close THIS player's pick is to maxing out the
    // points on the current live game(s). Only shown while a game is in play.
    let power = "";
    if (isLive) {
      let earned = 0, maxp = 0;
      for (const lm of liveMatches) {
        maxp += maxMatchPoints(lm);
        const pr = predictions[`${lm.id}_${r.id}`];
        if (pr && isValidPrediction(pr, lm)) earned += liveMatchScore(pr, lm, lm.home.score, lm.away.score);
      }
      if (maxp > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((earned / maxp) * 100)));
        const zone = pct >= 65 ? "z-hot" : pct >= 28 ? "z-mid" : "z-cold";
        power = `<div class="st-power ${zone}" title="On track for ${earned}/${maxp} pts on the live game">
            <span class="st-power-track"><i class="st-power-fill" style="width:${pct}%"></i></span>
            <b class="st-power-pct">${pct}%</b>
          </div>`;
      }
    }
    return `
      <div class="st-row${meCls}${r.livePts ? " gaining" : ""}">
        <div class="st-rank${rcls}">${medal}</div>
        <div class="st-move ${mv}">${glyph[mv]}</div>
        <div class="st-av">${avatarHtml(r)}</div>
        <div class="st-meta">
          <div class="st-name">${esc(r.name)}${meCls ? '<span class="st-you">YOU</span>' : ""}</div>
          <div class="st-sub">Played ${r.played} · 🎯 ${r.exact} exact <span class="st-form">${dots}</span></div>
        </div>
        <div class="st-pts"><div class="st-total"><b>${r.pts}</b><span class="st-unit">pts</span></div></div>
        ${power}
        ${breakdown}
      </div>`;
  }).join("");

  const liveBanner = isLive
    ? `<div class="st-livebar">🔴 LIVE — table updates with every goal · ${liveMatches
        .map((m) => `${esc(m.home.abbr)} ${m.home.score}–${m.away.score} ${esc(m.away.abbr)}`)
        .join(" · ")} · final at full time</div>`
    : "";

  const title = phase === "knockout" ? "🏆 Road to WC26 Final"
    : phase === "group" ? "🌍 Group stage" : "🏅 Standings";
  const phasePills = ko
    ? `<div class="pills phase-pills">${["group", "knockout", "overall"]
        .map((p) => `<button class="pill ${p === phase ? "active" : ""}" data-phase="${p}">${
          p === "knockout" ? "🏆 Knockout" : p === "group" ? "🌍 Group" : "Σ Overall"}</button>`)
        .join("")}</div>`
    : "";

  view.innerHTML = `
    <div class="section-title">${title}${isLive ? ' <span class="st-livetag">LIVE</span>' : ""}</div>
    ${phasePills}
    ${liveBanner}
    ${html}
    <p class="lock-note" style="margin-top:10px">${
      phase === "knockout" ? `Knockout scoring: correct advancer +3, exact 90-min score +3 (6 total), ×round (R32 →×1, Final →×5). All bonus cards count too — 🏅 Only Winner · 🐺 Underdog · 🤝 Perfect Pair · ⚽ Goal Rush. ${window.FINAL_GAMBLE?.enabled ? "🎰 The Final adds The Gamble — Stake ×1/×2/×3, a 🃏 Joker, and a 🎡 luck Wheel (see Rules). " : ""}` : ""
    }${isLive ? "⚡ The power bar shows how close each player's pick is to maxing out the points on the live game right now (100% = nailing it). It moves with every goal. " : ""}Tiebreakers: most exact scores 🎯, then correct results · ▲▼ ${isLive ? "live movement from in-play results" : "since the last match"}.</p>`;

  view.querySelectorAll("[data-phase]").forEach((b) =>
    b.addEventListener("click", () => { standingsPhase = b.dataset.phase; renderTable(); }));
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
// World Cup 2026 group structure, keyed by team-name substrings (same keys as
// FIFA_RANKS). ESPN's feed doesn't reliably label matches with a group name, so
// we assign teams to groups ourselves — this keeps all 12 tables on screen from
// day one and lets standings fill in live as results come in.
const WC_GROUPS = {
  A: ["mexico", "south africa", "korea", "czech"],
  B: ["canada", "bosnia", "qatar", "switzerland"],
  C: ["brazil", "morocco", "haiti", "scotland"],
  D: ["united states", "usa", "paraguay", "australia", "türkiye", "turkey"],
  E: ["germany", "curaç", "curac", "ivory", "côte", "cote", "ecuador"],
  F: ["netherlands", "japan", "sweden", "tunisia"],
  G: ["belgium", "egypt", "iran", "new zealand"],
  H: ["spain", "cabo verde", "cape verde", "saudi", "uruguay"],
  I: ["france", "senegal", "iraq", "norway"],
  J: ["argentina", "algeria", "austria", "jordan"],
  K: ["portugal", "dr congo", "congo", "uzbek", "colombia"],
  L: ["england", "croatia", "ghana", "panama"],
};
function groupOf(name) {
  const n = (name || "").toLowerCase();
  for (const [g, keys] of Object.entries(WC_GROUPS))
    if (keys.some((k) => n.includes(k))) return g;
  return null;
}

// Build live World Cup group tables. Every team is seeded from the fixture list
// (so all 12 tables show immediately), and only COMPLETED matches are tallied
// (official standings don't count a game until full time).
function buildGroupStandings() {
  const groups = {};                               // letter -> { teamName -> row }
  for (const g of Object.keys(WC_GROUPS)) groups[g] = {};
  const ensure = (g, t) => groups[g][t.name] ||
    (groups[g][t.name] = { name: t.name, logo: t.logo, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });

  // seed teams (names + flags) from every fixture they appear in
  for (const m of matches) {
    if (isKnockout(m)) continue;                    // group tables only
    for (const t of [m.home, m.away]) {
      const g = groupOf(t.name);
      if (g) ensure(g, t);
    }
  }
  // tally completed group-stage results
  for (const m of matches) {
    if (isKnockout(m)) continue;                    // a knockout result must not count in a group
    if (!m.completed || m.home.score == null || m.away.score == null) continue;
    const g = groupOf(m.home.name);
    if (!g || groupOf(m.away.name) !== g) continue; // both teams in the same group
    const H = ensure(g, m.home), A = ensure(g, m.away);
    const hs = m.home.score, as = m.away.score;
    H.mp++; A.mp++;
    H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; H.pts += 3; A.l++; }
    else if (hs < as) { A.w++; A.pts += 3; H.l++; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  }

  const out = {};
  for (const g of Object.keys(WC_GROUPS)) {
    const rows = Object.values(groups[g]);
    if (!rows.length) continue;                    // teams not loaded yet
    out["Group " + g] = rows.sort((a, b) =>
      b.pts - a.pts ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name));
  }
  return out;
}

// The 12 third-placed teams ranked head-to-head (pts, GD, GF). The top 8 fill
// the remaining Round-of-32 places alongside every group's top two.
function thirdPlaceRace(groups) {
  const thirds = [];
  for (const key of Object.keys(groups)) {
    const rows = groups[key];
    if (rows.length >= 3) thirds.push({ g: key.replace("Group ", ""), ...rows[2] });
  }
  thirds.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name));
  return thirds; // first 8 are "in"
}

// Live-resolve knockout slot placeholders to real teams from the current group
// standings. "1A"/"2B" → that group's leader/runner-up (deterministic). "3RD
// A/B/C/D/F" → a qualifying third-placed team whose group is in the candidate
// set, assigned most-constrained-first so each third is used once. Returns
// `${matchId}|${side}` -> {name, abbr, logo}. Provisional — shifts with results.
function koSlotMap() {
  const map = {};
  const standings = buildGroupStandings();
  // team abbreviations/flags registry from the group-stage fixtures
  const reg = {};
  for (const m of matches) {
    if (isKnockout(m)) continue;
    for (const t of [m.home, m.away]) if (t.name) reg[t.name] = { abbr: t.abbr, logo: t.logo };
  }
  const team = (t) => ({
    name: t.name,
    abbr: reg[t.name]?.abbr || t.name.slice(0, 3).toUpperCase(),
    logo: t.logo || reg[t.name]?.logo || "",
  });
  // 1) winner / runner-up slots — directly from the live table (Round of 32 only;
  //    later rounds depend on knockout results, not group standings)
  for (const m of matches) {
    if (!isKnockout(m) || koRound(m) !== "R32") continue;
    for (const side of ["home", "away"]) {
      const wm = (m[side].name || "").match(/^([12])\s*([A-L])$/i);
      if (!wm) continue;
      const rows = standings["Group " + wm[2].toUpperCase()];
      const t = rows && rows[Number(wm[1]) - 1];
      if (t) map[`${m.id}|${side}`] = team(t);
    }
  }
  // 2) third-placed slots — assign the qualifying thirds to candidate slots (R32 only)
  const thirds = thirdPlaceRace(standings).slice(0, 8);
  const slots = [];
  for (const m of matches) {
    if (!isKnockout(m) || koRound(m) !== "R32") continue;
    for (const side of ["home", "away"]) {
      const lbl = m[side].name || "";
      if (/3rd|third/i.test(lbl)) {
        const cand = (lbl.match(/[A-L]/gi) || []).map((c) => c.toUpperCase());
        slots.push({ key: `${m.id}|${side}`, cand });
      }
    }
  }
  slots.sort((a, b) => a.cand.length - b.cand.length); // most-constrained first
  const used = new Set();
  for (const slot of slots) {
    const pick = thirds.find((t) => !used.has(t.name) && (!slot.cand.length || slot.cand.includes(t.g)));
    if (pick) { used.add(pick.name); map[slot.key] = team(pick); }
  }
  return map;
}

// One knockout match row (home — score/time — away), winner highlighted.
function koMatchRow(m) {
  const H = koDisplayTeam(m, "home"), A = koDisplayTeam(m, "away");  // resolved/suppressed slots
  const flag = (t) => t.logo
    ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=sched-fb>⚽</span>'">`
    : `<span class="sched-fb">⚽</span>`;
  let mid;
  if (m.state === "in") mid = `<span class="ko-score live">${m.home.score ?? "-"}–${m.away.score ?? "-"}</span>`;
  else if (m.completed) mid = `<span class="ko-score">${m.home.score ?? "-"}–${m.away.score ?? "-"}</span>`;
  else mid = `<span class="ko-time">${fmtTime(m.kickoff)}</span>`;
  const hw = m.advanced === "home" ? " ko-win" : "";
  const aw = m.advanced === "away" ? " ko-win" : "";
  return `
    <div class="ko-match">
      <div class="ko-team h${hw}"><b>${esc(H.name)}</b>${flag(H)}</div>
      <div class="ko-mid">${mid}</div>
      <div class="ko-team a${aw}">${flag(A)}<b>${esc(A.name)}</b></div>
    </div>`;
}

// "Road to WC26 Final" bracket — knockout fixtures grouped by round (empty until
// ESPN lists them). Each round shows its escalating points multiplier.
function koBracketHtml() {
  const ks = matches.filter(isKnockout).sort((a, b) => a.kickoff - b.kickoff);
  if (!ks.length) return "";
  const byRound = {};
  for (const m of ks) (byRound[koRound(m)] = byRound[koRound(m)] || []).push(m);
  const anyProjected = ks.some((m) => koSlots[`${m.id}|home`] || koSlots[`${m.id}|away`]);
  let html = `
    <div class="sched-bar ko-bar">
      <div class="sched-title">🏆 Road to WC26 Final</div>
      <div class="sched-sub">Knockout bracket${anyProjected ? ' · <b class="proj-tag">📊 teams shown “as it stands”</b> — shift with results' : " · live from results"} · points escalate each round (R32 ×1 → Final ×5)</div>
    </div>`;
  for (const r of ["R32", "R16", "QF", "SF", "3P", "F"]) {
    const ms = byRound[r];
    if (!ms || !ms.length) continue;
    const mult = (KO().mult && KO().mult[r]) || 1;
    html += `<div class="ko-round"><div class="ko-round-head">${KO_ROUND_NAME[r]} <span class="ko-mult">×${mult}</span></div>`;
    let lastDay = "";
    for (const m of ms) {
      const day = m.kickoff.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
      if (day !== lastDay) { html += `<div class="ko-day">📅 ${day}</div>`; lastDay = day; }
      html += koMatchRow(m);
    }
    html += `</div>`;
  }
  return html;
}

function renderShare() {
  const groups = buildGroupStandings();
  const keys = Object.keys(groups);

  let html = koBracketHtml() + `
    <div class="sched-bar">
      <div class="sched-title">🌍 World Cup 2026 — Group standings</div>
      <div class="sched-sub">Live tournament tables · updates from results · top 2 advance 🟢</div>
      <div class="share-actions">
        <button class="btn wa" data-share-groups>📲 Share standings</button>
        <button class="btn ghost" data-share-invite>🔗 Invite</button>
      </div>
    </div>`;

  if (!keys.length) {
    html += `<div class="empty">⚽ Loading the group tables…<br>Hang on a sec while fixtures load.</div>`;
    view.innerHTML = html;
    wireGroupButtons();
    return;
  }

  // 🎟️ Road to the Last 32 — live qualification projection
  const thirds = thirdPlaceRace(groups);
  if (thirds.length) {
    html += `
      <div class="grp qual">
        <div class="grp-head">🎟️ Road to the Last 32</div>
        <div class="qual-note">Every group's <b>top 2</b> qualify, plus the <b>8 best 3rd-placed</b> teams. Live projection — shifts with results.</div>
        <div class="grp-row grp-h">
          <span class="grp-pos">#</span>
          <span class="grp-team">Best 3rd-placed</span>
          <span>Grp</span>
          <span>MP</span>
          <span class="grp-pts">PTS</span>
        </div>`;
    thirds.forEach((t, i) => {
      const flag = t.logo
        ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=grp-fb>⚽</span>'">`
        : `<span class="grp-fb">⚽</span>`;
      const inCut = i < 8;
      html += `
        <div class="grp-row ${inCut ? "adv" : "qout"}">
          <span class="grp-pos">${i + 1}</span>
          <span class="grp-team">${flag}<b>${esc(t.name)}</b> <span class="qual-tag ${inCut ? "in" : "out"}">${inCut ? "IN" : "OUT"}</span></span>
          <span>${esc(t.g)}</span>
          <span>${t.mp}</span>
          <span class="grp-pts">${t.pts}</span>
        </div>`;
    });
    html += `</div>`;
  }

  for (const key of keys) {
    html += `
      <div class="grp">
        <div class="grp-head">${key}</div>
        <div class="grp-row grp-h">
          <span class="grp-pos">#</span>
          <span class="grp-team">Team</span>
          <span>MP</span>
          <span>G</span>
          <span class="grp-pts">PTS</span>
        </div>`;
    groups[key].forEach((t, i) => {
      const flag = t.logo
        ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=grp-fb>⚽</span>'">`
        : `<span class="grp-fb">⚽</span>`;
      html += `
        <div class="grp-row${i < 2 ? " adv" : ""}">
          <span class="grp-pos">${i + 1}</span>
          <span class="grp-team">${flag}<b>${esc(t.name)}</b></span>
          <span>${t.mp}</span>
          <span class="grp-g">${t.gf}:${t.ga}</span>
          <span class="grp-pts">${t.pts}</span>
        </div>`;
    });
    html += `</div>`;
  }

  view.innerHTML = html;
  wireGroupButtons();
}

function wireGroupButtons() {
  const g = view.querySelector("[data-share-groups]");
  if (g) g.addEventListener("click", () => openWhatsApp(groupsMessage()));
  const inv = view.querySelector("[data-share-invite]");
  if (inv) inv.addEventListener("click", () => openWhatsApp(inviteMessage()));
}

function groupsMessage() {
  const groups = buildGroupStandings();
  const appUrl = window.APP_LINK || location.href.split("#")[0];
  let msg = `🏆 *WORLD CUP 2026 — GROUP STANDINGS* 🏆\n\n`;
  const keys = Object.keys(groups);
  if (!keys.length) {
    msg += `No group results yet 😴\n\n`;
    return msg + appUrl;
  }
  for (const key of keys) {
    msg += `*${key}*\n`;
    groups[key].forEach((t, i) => {
      const tick = i < 2 ? "🟢" : "  ";
      msg += `${tick} ${i + 1}. ${t.name} — *${t.pts}* pts · ${t.mp} MP · ${t.gf}:${t.ga}\n`;
    });
    msg += `\n`;
  }
  return msg + appUrl;
}

function inviteMessage() {
  return (
    `🏆 *EL 3ESHّA WORLD CUP 26 — you're invited!* 🏆\n\n` +
    `World Cup prediction battle for the gang 😁⚽\n` +
    `Each match: pick the *winner* + the *exact score*\n` +
    `✅ Winner = ${POINTS.WINNER} pts · 🎯 Exact score = +${POINTS.EXACT} pts bonus\n` +
    `🔒 Bets close 15 minutes before kickoff ⚡\n\n` +
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
function rulesHtml() {
  return `
    <div class="rules-card">
      <h3>🎯 How to play</h3>
      <ul>
        <li>Every match = <b>2 predictions</b>: pick <b>who wins</b> (or draw) 🏆 <i>and</i> the <b>exact score</b>.</li>
        <li>🔒 Predictions <b>lock ${LOCK_MINUTES} minutes before kickoff</b> — no late bets!</li>
        <li>⚡ <b>Launch day (June 12) only:</b> bets stay open until the <b>end of the 1st half</b> (${GRACE_AFTER_MIN} min after kickoff).</li>
        <li>Everyone's picks stay hidden until lock time, then they're revealed. 👀</li>
        <li>Knockout games use the new style: pick <b>who advances AND how</b> (90' / Extra Time / Penalties) <i>and</i> the exact score for that phase (90-min, or after extra time if you called ET).</li>
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
    ${window.RULES?.perfectPairOutcome ? `
    <div class="rules-card">
      <h3>🤝 Perfect Pair <span style="font-size:11px;color:var(--green)">NEW · Round 3</span></h3>
      <ul>
        <li>In the final group round, each group's <b>two matches kick off at the same time</b>.</li>
        <li>Get <b>both outcomes right</b> in that pair → <b>+${window.RULES.perfectPairOutcome} bonus</b> (once for the pair).</li>
        <li>Nail <b>both exact scores</b> → <b>+${window.RULES.perfectPairExact} bonus</b> instead! 🎯🎯</li>
        <li>This is <b>on top of</b> your normal points for each match.</li>
      </ul>
    </div>` : ""}
    ${window.RULES?.goalRush ? `
    <div class="rules-card">
      <h3>⚽ Goal Rush <span style="font-size:11px;color:var(--green)">NEW · Round 3</span></h3>
      <ul>
        <li>Got <b>0 points</b> on a match but <b>called the total goals</b> right (home + away)? Take <b>+${window.RULES.goalRush}</b>. 🙌</li>
        <li>A consolation for the unlucky — if you already scored on the match, it doesn't apply.</li>
      </ul>
    </div>` : ""}
    ${window.KNOCKOUT ? `
    <div class="rules-card">
      <h3>🏆 Road to WC26 Final <span style="font-size:11px;color:var(--gold)">KNOCKOUT</span></h3>
      <ul>
        <li>The knockout stage runs on a <b>fresh leaderboard from zero</b> — group points stay in their own table (toggle Group / Knockout / Overall on the Table tab).</li>
        <li>🏆 <b>Who advances:</b> pick the right team to go through (penalties & extra time count) → <b>+${window.KNOCKOUT.advancePts}</b>.</li>
        <li>⏱ <b>How it's decided:</b> nail the method — in 90', Extra Time or Penalties → <b>+${window.KNOCKOUT.methodPts ?? 3}</b> <i>(only if you also got the team right)</i>.</li>
        <li>🎯 <b>Exact score</b> → <b>+${window.KNOCKOUT.exactPts}</b>, judged on the <b>phase you predicted</b>: the <b>90-min</b> score for a 90' pick, the <b>after-extra-time</b> score for an ET pick, or the <b>end-of-ET draw</b> for a Penalties pick. It only counts if your method is right too. A perfect call = <b>+${(window.KNOCKOUT.advancePts) + (window.KNOCKOUT.methodPts ?? 3) + (window.KNOCKOUT.exactPts)}</b>!</li>
        <li>📐 Your <b>score must match your pick</b>: win in 90' or after Extra Time → your team ahead; Penalties → a draw (it's level at the end of extra time).</li>
        <li><b>Stakes escalate every round:</b> these are multiplied — Round of 32 ×1, Round of 16 ×2, Quarters ×3, Semis ×4, <b>Final ×5</b>. Late rounds are where titles are won! 🔥</li>
        <li><b>All the bonus cards still count — right through the final:</b>
          🏅 <b>Only Winner</b> +${window.RULES?.onlyWinnerBonus ?? 2} (sole correct advancer) ·
          🐺 <b>Underdog</b> +${window.RULES?.underdogBonus ?? 2} (back the lower-ranked team to go through) ·
          🤝 <b>Perfect Pair</b> +${window.RULES?.perfectPairOutcome ?? 3}/+${window.RULES?.perfectPairExact ?? 6} (nail both ties that kick off together) ·
          ⚽ <b>Goal Rush</b> +${window.RULES?.goalRush ?? 1} (0 points but right total goals). These are flat — not multiplied.</li>
      </ul>
    </div>` : ""}
    ${(window.FINAL_GAMBLE?.enabled) ? `
    <div class="rules-card">
      <h3>🎰 The Final Gamble <span style="font-size:11px;color:var(--gold)">FINAL ONLY</span></h3>
      <ul>
        <li>The <b>Final</b> gets three extra layers on top of your normal who + how + exact pick (base ×5). This is where the title swings — big nerve, big luck. 🔥</li>
        <li>🎰 <b>The Stake:</b> bank your base final points at <b>×1 Safe</b>, <b>×2 Bold</b> or <b>×3 All-in</b>. Nail your core pick → it's multiplied. <b>Miss it (0 base) and you PAY:</b> ×2 = <b>−${window.FINAL_GAMBLE.penalty[2]}</b>, ×3 = <b>−${window.FINAL_GAMBLE.penalty[3]}</b>. ×1 never loses.</li>
        <li>🃏 <b>The Joker:</b> pick ONE side-bet for a flat <b>+${window.FINAL_GAMBLE.jokerPts}</b> — Over/Under 2.5 goals, Both teams to score (or a clean sheet), or Won by 2+ goals vs a 1-goal game/draw. (It's optional — tap again to unpick.)</li>
        <li>🎡 <b>The Wheel:</b> tap <b>SPIN</b> once for a luck bonus. Your spin is <b>sealed to you</b> — it lands the same on every device, so nobody can re-roll for a better one. Land on <b>+5 / +8 / +10 / 💎 Jackpot +15</b> (straight bonus points), <b>2️⃣ Double</b> your Joker, or <b>🛡️ Insurance</b> that cancels a stake miss. It counts even if you forget to spin.</li>
        <li>Everything reveals at full time with the result — check the Final's card and the 🎰 chip on the Knockout table.</li>
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
// Profile tab — the player's home: avatar (with photo upload), rank, points,
// every achievement since the group stage, full prediction history, account
// actions, and a collapsible Rules section.
// ---------------------------------------------------------------------------

// Current photo for a player (live from the players collection, else the cached
// login). Returns a data-URL string or null.
function playerPhoto(p) {
  const row = p && players.find((x) => x.id === p.id);
  return row?.photo || p?.photo || null;
}

// Avatar markup: uploaded photo if there is one, else the chosen emoji.
function avatarHtml(p, cls = "") {
  const photo = playerPhoto(p);
  const emoji = (players.find((x) => x.id === p.id) || p).emoji || "👤";
  return photo
    ? `<img class="avatar-img ${cls}" src="${esc(photo)}" alt="">`
    : `<span class="avatar-emoji ${cls}">${emoji}</span>`;
}

function renderProfile() {
  if (!me) {
    view.innerHTML = `<div class="empty">👤 Join the game to unlock your profile —
      your rank, points, achievements and full history live here.<br><br>
      <button class="btn primary" onclick="document.getElementById('playerChip').click()">Join now ⚽</button></div>`;
    return;
  }
  if (!db) { view.innerHTML = `<div class="empty">Profile appears once the database is connected.</div>`; return; }

  const overall = buildStandings(false, "overall");
  const rankIdx = overall.findIndex((r) => r.id === me.id);
  const mine = rankIdx >= 0 ? overall[rankIdx] : null;
  const ko = hasKnockout();
  const grpRow = ko ? buildStandings(false, "group").find((r) => r.id === me.id) : null;
  const koRow = ko ? buildStandings(false, "knockout").find((r) => r.id === me.id) : null;

  // history (most-recent first) + current scoring streak
  const done = matches.filter((m) => m.completed && m.home.score != null)
    .sort((a, b) => b.kickoff - a.kickoff);
  const history = [];
  let streak = 0, streakLive = true;
  for (const m of done) {
    const pred = predictions[`${m.id}_${me.id}`];
    if (!pred || !isValidPrediction(pred, m)) continue;
    const pts = matchPoints(pred, m);
    history.push({ m, pred, pts });
    if (streakLive) { if (pts > 0) streak++; else streakLive = false; }
  }

  const bd = mine?.bd || { onlyWinner: 0, underdog: 0, perfectPair: 0, goalRush: 0 };
  const rankTxt = rankIdx >= 0 ? `#${rankIdx + 1}` : "—";
  const rankCls = rankIdx === 0 ? "r1" : rankIdx === 1 ? "r2" : rankIdx === 2 ? "r3" : "";

  const stat = (ic, label, val) =>
    `<div class="pf-stat"><div class="pf-stat-ic">${ic}</div><div class="pf-stat-val">${val}</div><div class="pf-stat-lbl">${label}</div></div>`;

  const splits = ko ? `
    <div class="pf-splits">
      <div><span>🌍 Group</span><b>${grpRow?.pts ?? 0}</b></div>
      <div><span>🏆 Knockout</span><b>${koRow?.pts ?? 0}</b></div>
      <div><span>Σ Overall</span><b>${mine?.pts ?? 0}</b></div>
    </div>` : "";

  const HOW_TAG = { reg: "90'", et: "ET", pen: "PEN" };
  const histRow = ({ m, pred, pts }) => {
    const exact = pred.home === m.home.score && pred.away === m.away.score;
    const tag = pts > 0 ? (exact ? "ex" : "win") : "miss";
    const ic = pts > 0 ? (exact ? "🎯" : "✅") : "❌";
    let pickHtml;
    if (isKnockout(m)) {
      const wp = koWinnerPick(pred);
      const teamAb = wp ? esc(wp === "home" ? m.home.abbr : m.away.abbr) : "—";
      const how = pred.koMethod && HOW_TAG[pred.koMethod]
        ? ` <i class="pr-how ${pred.koMethod}">${HOW_TAG[pred.koMethod]}</i>` : "";
      pickHtml = `🏆 ${teamAb}${how} · ${pred.home}–${pred.away}`;
    } else {
      pickHtml = pickLabel(pred, m);
    }
    return `<div class="pf-hist ${tag}">
        <div class="pf-hist-d">${m.kickoff.toLocaleDateString([], { day: "numeric", month: "short" })}</div>
        <div class="pf-hist-m">${esc(m.home.abbr)} <span>${m.home.score}–${m.away.score}</span> ${esc(m.away.abbr)}
          <div class="pf-hist-pick">${ic} ${pickHtml}</div></div>
        <div class="pf-hist-pts ${pts > 0 ? "pos" : ""}">${pts > 0 ? `+${pts}` : "0"}</div>
      </div>`;
  };

  view.innerHTML = `
    <div class="pf-head">
      <div class="pf-avatar">
        ${avatarHtml(me)}
        <label class="pf-cam" for="pfPhoto" title="Upload a photo">📷</label>
        <input type="file" id="pfPhoto" accept="image/*" class="pf-file">
      </div>
      <div class="pf-id">
        <div class="pf-name">${esc(me.name)}</div>
        <div class="pf-rank ${rankCls}">${rankTxt} of ${overall.length} · <b>${mine?.pts ?? 0} pts</b></div>
      </div>
    </div>
    ${splits}
    <div class="pf-section-h">🏅 Achievements</div>
    <div class="pf-stats">
      ${stat("🎯", "Exact scores", mine?.exact ?? 0)}
      ${stat("✅", "Correct results", mine?.outcomes ?? 0)}
      ${stat("🔥", "Streak", streak)}
      ${stat("🏅", "Only Winner", bd.onlyWinner)}
      ${stat("🐺", "Underdog", bd.underdog)}
      ${stat("🤝", "Perfect Pair", bd.perfectPair)}
      ${stat("⚽", "Goal Rush", bd.goalRush)}
      ${stat("📋", "Played", mine?.played ?? 0)}
    </div>
    <div class="pf-section-h">📜 Your history</div>
    <div class="pf-hist-list">
      ${history.length ? history.map(histRow).join("") : `<div class="lock-note">No finished predictions yet — your results will show up here.</div>`}
    </div>
    <details class="pf-rules">
      <summary>📖 Game rules &amp; scoring</summary>
      <div class="pf-rules-body">${rulesHtml()}</div>
    </details>
    <div class="pf-actions">
      <button id="pfNotif" class="btn ghost">🔔 Notifications</button>
      <button id="pfLogout" class="btn ghost">↩️ Log out</button>
    </div>`;

  const photoInput = $("#pfPhoto");
  if (photoInput) photoInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) uploadProfilePhoto(f);
  });
  $("#pfNotif")?.addEventListener("click", enableNotifications);
  $("#pfLogout")?.addEventListener("click", () => {
    if (confirm(`Log out ${me.name} on this device?`)) { clearLogin(); activeTab = "matches"; render(); }
  });
}

// Downscale an image file to a small square-ish JPEG data-URL (kept well under
// Firestore's 1 MB document limit, so we avoid needing Firebase Storage).
function compressImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}

async function uploadProfilePhoto(file) {
  if (!file || !me || !db) return;
  // iPhones may report HEIC as an empty type — allow it and let decoding decide.
  if (file.type && !/^image\//.test(file.type)) { toast("📷 Please pick an image file."); return; }
  let dataUrl;
  try {
    toast("📸 Updating photo…");
    dataUrl = await compressImage(file, 256);
  } catch (err) {
    console.error("image decode failed", err);
    toast("📷 Couldn't read that photo — try a JPG/PNG, or a different image.");
    return;
  }
  if (dataUrl.length > 750_000) { toast("📷 That image is too large — try another."); return; }
  try {
    await fs.setDoc(fs.doc(db, "players", me.id), { photo: dataUrl }, { merge: true });
    me.photo = dataUrl; saveLogin();
    renderChip();
    toast("✅ Profile photo updated!");
    render();
  } catch (err) {
    console.error("photo save failed", err);
    const code = err?.code || err?.message || String(err);
    if (/permission|insufficient|denied/i.test(code)) {
      toast("🔒 Database blocked the save (rules). Tell the admin: allow update on players.");
    } else {
      toast("⚠️ Couldn't save photo: " + code);
    }
  }
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
  if (isKnockout(m) && pred.koWinner) {
    const ab = pred.koWinner === "home" ? m.home.abbr : m.away.abbr;
    const how = { reg: "in 90'", et: "in ET", pen: "on pens" }[pred.koMethod] || "";
    let extra = "";
    if (isFinalMatch(m)) {
      const fg = FG();
      const st = fg.stakes.includes(pred.finalStake) ? pred.finalStake : 1;
      const j = pred.finalJoker && fg.jokers.find((x) => x.id === pred.finalJoker);
      extra = ` · 🎰 ×${st}${j ? ` · 🃏 ${esc(j.label)}` : ""}`;
    }
    return `🏆 ${esc(ab)} ${how} · ${pred.home}–${pred.away}${extra}`;
  }
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
