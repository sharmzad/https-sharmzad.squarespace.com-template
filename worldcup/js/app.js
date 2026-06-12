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
const POLL_MS = 60_000;
const EMOJIS = ["🦁", "🐺", "🦅", "🐉", "🦂", "🐍", "🦈", "🐅", "🦍", "🐎", "🦊", "🐢"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let matches = [];          // normalized ESPN matches, sorted by kickoff
let players = [];          // [{id, name, emoji}]
let predictions = {};      // { `${matchId}_${playerId}`: {matchId, playerId, home, away, updatedAtMs} }
let me = JSON.parse(localStorage.getItem("gangcup_me") || "null");
let db = null, fs = null;  // Firestore handle + module
let activeTab = "matches";
let matchFilter = "today";
let draft = {};            // unsaved stepper values { matchId: {home, away} }

const $ = (sel) => document.querySelector(sel);
const view = $("#view");

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
init();

async function init() {
  bindChrome();
  await initFirebase();
  await loadMatches();
  render();
  setInterval(async () => { await loadMatches(); render(); }, POLL_MS);
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
        me = null;
        localStorage.removeItem("gangcup_me");
        renderChip();
        render();
      }
    } else openJoinModal();
  });
  renderChip();
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
    db = fs.getFirestore(initializeApp(window.FIREBASE_CONFIG));

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
    detail: status.type?.shortDetail || "",
    group: comp.notes?.[0]?.headline || ev.season?.slug || "",
    home: side("home"),
    away: side("away"),
  };
}

const dayKey = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

function lockTime(m) {
  if (dayKey(m.kickoff) === GRACE_DAY) {
    return new Date(m.kickoff.getTime() + GRACE_AFTER_MIN * 60_000);
  }
  return new Date(m.kickoff.getTime() - LOCK_MINUTES * 60_000);
}
const isOpen = (m) => !m.completed && Date.now() < lockTime(m).getTime();

// ---------------------------------------------------------------------------
// Scoring — two predictions per match: winner (1X2) + exact score
// ---------------------------------------------------------------------------
const resultOf = (hs, as) => (hs > as ? "home" : hs < as ? "away" : "draw");

// older predictions may not have a winner pick — derive it from the score
const predWinner = (pred) => pred.winner || resultOf(pred.home, pred.away);

function scorePrediction(pred, hs, as) {
  let pts = 0;
  if (predWinner(pred) === resultOf(hs, as)) pts += POINTS.WINNER;
  if (pred.home === hs && pred.away === as) pts += POINTS.EXACT;
  return pts;
}

// A prediction only counts if it was saved before the lock (server timestamp).
const isValidPrediction = (pred, m) => pred.updatedAtMs <= lockTime(m).getTime();

function buildStandings() {
  const rows = players.map((p) => ({ ...p, pts: 0, exact: 0, outcomes: 0, played: 0 }));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const m of matches) {
    if (!m.completed || m.home.score == null) continue;
    for (const p of players) {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred || !isValidPrediction(pred, m)) continue;
      const r = byId[p.id];
      r.played++;
      r.pts += scorePrediction(pred, m.home.score, m.away.score);
      if (pred.home === m.home.score && pred.away === m.away.score) r.exact++;
      if (predWinner(pred) === resultOf(m.home.score, m.away.score)) r.outcomes++;
    }
  }
  return rows.sort(
    (a, b) => b.pts - a.pts || b.exact - a.exact || b.outcomes - a.outcomes || a.name.localeCompare(b.name)
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  if (activeTab === "matches") renderMatches();
  else if (activeTab === "table") renderTable();
  else if (activeTab === "share") renderShare();
  else renderRules();
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
      <div class="lock-note">${mine ? `✅ Your bet: <b>${pickLabel(mine, m)}</b> · ` : ""}🔒 Locks at ${fmtTime(lockTime(m))}</div>`;
  } else if (open && db && !me) {
    body = `<div class="lock-note">👤 <a href="#" onclick="document.getElementById('playerChip').click();return false" style="color:var(--gold)">Join the game</a> to predict · 🔒 locks at ${fmtTime(lockTime(m))}</div>`;
  } else if (!open && db) {
    body = revealBlock(m);
  }

  return `
    <div class="match">
      <div class="match-top"><span>${esc(m.group || "World Cup 2026")}</span>${badge}</div>
      <div class="teams">
        <div class="team">${flag(m.home)}<b>${esc(m.home.name)}</b></div>
        <div class="center">${center}</div>
        <div class="team">${flag(m.away)}<b>${esc(m.away.name)}</b></div>
      </div>
      ${body}
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
  const rows = players
    .map((p) => {
      const pred = predictions[`${m.id}_${p.id}`];
      if (!pred) return null;
      const late = !isValidPrediction(pred, m);
      let ptsHtml = "";
      if (m.completed && m.home.score != null && !late) {
        const pts = scorePrediction(pred, m.home.score, m.away.score);
        ptsHtml = `<span class="pts p${pts}">+${pts}</span>`;
      }
      return `
        <div class="reveal-row ${me && p.id === me.id ? "mine" : ""}">
          <span>${p.emoji} ${esc(p.name)}</span>
          <span><b>${pickLabel(pred, m)}</b> ${late ? '<span class="late">(late ⛔)</span>' : ""} ${ptsHtml}</span>
        </div>`;
    })
    .filter(Boolean);
  if (!rows.length) return `<div class="lock-note">No predictions for this match 🤷</div>`;
  return `<div class="reveal">${rows.join("")}</div>`;
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
  const winner = d.winner || resultOf(d.home, d.away); // no pick? derive from score
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
    view.innerHTML = `<div class="empty">🏅 The leaderboard appears once the admin connects the database.<br>See the setup guide in the README.</div>`;
    return;
  }
  const rows = buildStandings();
  if (!rows.length) {
    view.innerHTML = `<div class="empty">No players yet — be the first to join! 🎉</div>`;
    return;
  }
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  view.innerHTML = `
    <div class="section-title">Gang standings</div>
    <table class="lb">
      <tr><th>#</th><th>Player</th><th>Played</th><th>Exact 🎯</th><th>Pts</th></tr>
      ${rows.map((r, i) => `
        <tr class="${me && r.id === me.id ? "me" : ""}">
          <td class="rank">${medal(i)}</td>
          <td>${r.emoji} ${esc(r.name)}</td>
          <td>${r.played}</td>
          <td>${r.exact}</td>
          <td class="total">${r.pts}</td>
        </tr>`).join("")}
    </table>
    <p class="lock-note" style="margin-top:10px">Tiebreakers: exact scores 🎯, then correct results.</p>`;
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
  const appUrl = location.href.split("#")[0];

  if (kind === "today") {
    const list = matches.filter((m) => sameDay(m.kickoff) && m.state === "pre");
    if (!list.length) return `🏆 *3AM EL SHEIKH ETMAN CUP* 🏆\n\nNo more matches today 😴 — rest day for the gang!\n\n${appUrl}`;
    let msg = `🏆 *3AM EL SHEIKH ETMAN CUP* 🏆\n📅 *Today's matches — place your bets!*\n\n`;
    for (const m of list) {
      msg += `⚽ *${m.home.name}* 🆚 *${m.away.name}*\n   🕐 ${fmtTime(m.kickoff)} · 🔒 betting closes ${fmtTime(lockTime(m))}\n\n`;
    }
    msg += `🎯 Predict now 👇\n${appUrl}`;
    return msg;
  }

  if (kind === "live") {
    const live = matches.filter((m) => m.state === "in");
    const done = matches.filter((m) => sameDay(m.kickoff) && m.completed);
    let msg = `🏆 *3AM EL SHEIKH ETMAN CUP* 🏆\n\n`;
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
  let msg = `🏆 *3AM EL SHEIKH ETMAN — STANDINGS* 🏆\n\n`;
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
    `🏆 *3AM EL SHEIKH ETMAN CUP — you're invited!* 🏆\n\n` +
    `World Cup prediction battle for the gang 😁⚽\n` +
    `Each match: pick the *winner* + the *exact score*\n` +
    `✅ Winner = ${POINTS.WINNER} pts · 🎯 Exact score = +${POINTS.EXACT} pts bonus\n` +
    `🔒 Bets close 1 hour before kickoff (today only: open till end of 1st half ⚡)\n\n` +
    `Join here 👇 (group code: *${window.GROUP_CODE}*)\n${location.href.split("#")[0]}`
  );
}

function openWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("📋 Copied — paste it in the group!");
  } catch {
    prompt("Copy this message:", text);
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
    <div class="rules-card">
      <h3>🏆 Winning</h3>
      <ul>
        <li>Most points after the final wins the Gang Cup. 👑</li>
        <li>Tiebreakers: most exact scores 🎯, then most correct results.</li>
        <li>Prize: decided by the gang... loser buys dinner? 😁</li>
      </ul>
    </div>`;
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

  const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  try {
    if (existing) {
      if (existing.pin !== pin) return fail("That name is taken and the PIN doesn't match.");
      me = { id: existing.id, name: existing.name, emoji: existing.emoji };
    } else {
      if (players.length >= (window.MAX_PLAYERS || 10)) return fail("The game is full! 🙈");
      const ref = await fs.addDoc(fs.collection(db, "players"), {
        name, pin, emoji: chosenEmoji, joinedAt: fs.serverTimestamp(),
      });
      me = { id: ref.id, name, emoji: chosenEmoji };
    }
    localStorage.setItem("gangcup_me", JSON.stringify(me));
    $("#joinModal").classList.add("hidden");
    renderChip();
    render();
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
