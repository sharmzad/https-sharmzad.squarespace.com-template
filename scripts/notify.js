/*
 * 3am El Sheikh Etman — push notification sender
 *
 * Run by .github/workflows/notify.yml on a cron. Sends FCM web-push to every
 * registered device:
 *   ⏰ "Betting closes soon"        — lock within ~30 min
 *   ⏸ Delayed / ▶️ resumed          — when a match is delayed, then back on
 *   🥅 Kickoff + everyone's picks   — when a match goes live
 *   ⚽ Goal alerts                  — live score changed since last run
 *   🏁 Full-time result + points    — with each player's score (+ Round 3 bonuses)
 *   🤝 Perfect Pair                 — both of a group's simultaneous matches right
 *   👑 New leaderboard leader       — after results land
 *
 * Firestore `notifications/{key}` docs hold dedupe markers and live state.
 * Requires env FIREBASE_SERVICE_ACCOUNT = full service-account JSON.
 */
const admin = require("firebase-admin");

const APP_URL = "https://sharmzad.github.io/https-sharmzad.squarespace.com-template/worldcup/";
const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard" +
  "?dates=20260611-20260719&limit=200";

// Mirror of the game rules in worldcup/js/app.js
const POINTS = { EXACT: 5, WINNER: 2 };
const LOCK_MINUTES = 15;
const GRACE_DAY = "2026-06-12"; // Egypt local date, lock = KO + 50 min
const GRACE_AFTER_MIN = 50;
const OPEN_OVERRIDES = [["KOR", "CZE"], ["canada", "south africa"], ["brazil", "japan"]];
const REMIND_WINDOW_MIN = 30; // notify when lock is at most this far away
// Keep in sync with BONUS_POINTS / RULES in worldcup/js/firebase-config.js
const BONUS_POINTS = { "*": 2, "Alaa": 0 };
const bonusFor = (name) =>
  BONUS_POINTS[name] !== undefined ? BONUS_POINTS[name] : (BONUS_POINTS["*"] || 0);
const ONLY_WINNER_BONUS = 2;
const UNDERDOG_BONUS = 2;
const BONUS_FROM_MS = Date.parse("2026-06-18T00:00:00Z"); // Round 2 onward
// Round 3 (final group round) challenges
const PERFECT_PAIR_OUTCOME = 3;
const PERFECT_PAIR_EXACT = 6;
const GOAL_RUSH = 1;
const ROUND3_FROM_MS = Date.parse("2026-06-24T19:00:00Z"); // 22:00 Cairo — keep in sync with RULES.round3From
// Knockout stage (keep in sync with KNOCKOUT in worldcup/js/firebase-config.js)
const KNOCKOUT_FROM_MS = Date.parse("2026-06-28T00:00:00Z");
const KO_ADVANCE_PTS = 3;
const KO_METHOD_PTS = 3;
const KO_EXACT_PTS = 3;
const KO_MULT = { R32: 1, R16: 2, QF: 3, SF: 4, "3P": 4, F: 5 };
const knockoutLabel = (m) =>
  /round[\s-]of[\s-]32|round[\s-]of[\s-]16|quarter|semi[\s-]?final|\bfinal\b|third[\s-]place|3rd[\s-]place|play[\s-]?offs?|knockout/i.test(m.group || "");
const knownGroupMatch = (m) => {
  const h = groupOf(m.home.name), a = groupOf(m.away.name);
  return h && h === a;
};
const isKnockout = (m) =>
  knockoutLabel(m) || (m.kickoff.getTime() >= KNOCKOUT_FROM_MS && !knownGroupMatch(m));
function koRound(m) {
  const g = (m.group || "").toLowerCase();
  if (/round[\s-]of[\s-]32/.test(g)) return "R32";
  if (/round[\s-]of[\s-]16/.test(g)) return "R16";
  if (/quarter/.test(g)) return "QF";
  if (/semi/.test(g)) return "SF";
  if (/third[\s-]place|3rd[\s-]place/.test(g)) return "3P";
  if (/\bfinal\b/.test(g)) return "F";
  const t = m.kickoff.getTime();
  if (t < Date.parse("2026-07-05")) return "R32";
  if (t < Date.parse("2026-07-08")) return "R16";
  if (t < Date.parse("2026-07-13")) return "QF";
  if (t < Date.parse("2026-07-17")) return "SF";
  if (t < Date.parse("2026-07-19")) return "3P";
  return "F";
}
// Who advanced from a knockout tie (ESPN flag covers ET/penalties), else the
// decisive 90-minute result. Returns "home" | "away" | null.
function koAdvancer(m) {
  return m.advanced ||
    (m.completed && m.home.score != null && resultOf(m.home.score, m.away.score) !== "draw"
      ? resultOf(m.home.score, m.away.score) : null);
}
// How a finished knockout tie was decided: "reg" | "et" | "pen" | null.
function koMatchMethod(m) {
  if (!isKnockout(m) || !m.completed || m.home.score == null) return null;
  const txt = `${m.statusName} ${m.detail}`.toLowerCase();
  if (m.home.shootout != null || m.away.shootout != null || /pen|shootout/.test(txt)) return "pen";
  if (/aet|a\.e\.t|extra/.test(txt) || (m.period && m.period > 2)) return "et";
  return "reg";
}
// A player's knockout advancer pick: explicit who+how choice, else from score.
const koWinnerPick = (pred) =>
  pred.koWinner || (pred.home > pred.away ? "home" : pred.home < pred.away ? "away" : null);

function scoreKnockout(pred, m) {
  let base = 0;
  const adv = koAdvancer(m);
  const teamRight = !!adv && koWinnerPick(pred) === adv;
  if (teamRight) base += KO_ADVANCE_PTS;
  const method = koMatchMethod(m);
  // method only counts if the team pick is also right
  if (teamRight && method && pred.koMethod && pred.koMethod === method) base += KO_METHOD_PTS;
  // exact of the phase you predicted (90-min / after-ET / end-of-ET draw). ESPN
  // reports that deciding score. Legacy picks with no method = 90'.
  const predMethod = pred.koMethod || "reg";
  if (method && predMethod === method && pred.home === m.home.score && pred.away === m.away.score) base += KO_EXACT_PTS;
  return base * (KO_MULT[koRound(m)] || 1);
}
const matchPoints = (pred, m) =>
  isKnockout(m) ? scoreKnockout(pred, m) : scorePrediction(pred, m.home.score, m.away.score);

// 🎰 THE FINAL GAMBLE (keep in sync with FINAL_GAMBLE in firebase-config.js and
// the finalGambleDelta/wheelFor/resolveJoker helpers in worldcup/js/app.js).
const FINAL_GAMBLE = {
  enabled: true,
  stakes: [1, 2, 3],
  penalty: { 2: 5, 3: 10 },
  jokerPts: 5,
  wheel: [
    { id: "p5", add: 5, weight: 30 }, { id: "p8", add: 8, weight: 22 },
    { id: "p10", add: 10, weight: 14 }, { id: "jackpot", add: 15, weight: 8 },
    { id: "dbl", kind: "dblJoker", weight: 14 }, { id: "ins", kind: "insure", weight: 12 },
  ],
};
const isFinalMatch = (m) => FINAL_GAMBLE.enabled && isKnockout(m) && koRound(m) === "F";
function fgHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function wheelFor(playerId, matchId) {
  const segs = FINAL_GAMBLE.wheel, total = segs.reduce((s, x) => s + (x.weight || 1), 0);
  let r = fgHash(`${playerId}|${matchId}|wheel`) % total;
  for (const seg of segs) { r -= (seg.weight || 1); if (r < 0) return seg; }
  return segs[segs.length - 1];
}
function resolveJoker(pred, m) {
  const jk = pred.finalJoker;
  if (!jk || m.home.score == null) return false;
  const hs = m.home.score, as = m.away.score, total = hs + as, margin = Math.abs(hs - as);
  switch (jk) {
    case "over": return total >= 3;
    case "under": return total <= 2;
    case "btts_y": return hs > 0 && as > 0;
    case "btts_n": return !(hs > 0 && as > 0);
    case "margin2": return margin >= 2;
    case "close": return margin <= 1;
    default: return false;
  }
}
function finalGambleDelta(pred, m, playerId) {
  if (!isFinalMatch(m) || !m.completed || m.home.score == null) return 0;
  const core = scoreKnockout(pred, m);
  const stake = FINAL_GAMBLE.stakes.includes(pred.finalStake) ? pred.finalStake : 1;
  const seg = wheelFor(playerId || pred.playerId, m.id) || {};
  let delta = 0;
  if (core > 0) delta += core * (stake - 1);
  else { const pen = FINAL_GAMBLE.penalty[stake] || 0; if (pen && seg.kind !== "insure") delta -= pen; }
  if (resolveJoker(pred, m)) delta += FINAL_GAMBLE.jokerPts * (seg.kind === "dblJoker" ? 2 : 1);
  if (seg.add) delta += seg.add;
  return delta;
}

// FIFA ranks — keep in sync with FIFA_RANKS in worldcup/js/app.js
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
const fifaRank = (name) => {
  const n = (name || "").toLowerCase();
  for (const [k, r] of FIFA_RANKS) if (n.includes(k)) return r;
  return null;
};
// WC2026 groups (keep in sync with WC_GROUPS in worldcup/js/app.js) — used to
// pair a group's two simultaneous Round-3 matches for the Perfect Pair bonus.
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
const groupOf = (name) => {
  const n = (name || "").toLowerCase();
  for (const [g, keys] of Object.entries(WC_GROUPS))
    if (keys.some((k) => n.includes(k))) return g;
  return null;
};
// the lower-ranked side if it WON a decisive match, else null
const upsetWinSide = (m) => {
  if (m.home.score == null) return null;
  const res = resultOf(m.home.score, m.away.score);
  if (res === "draw") return null;
  const rh = fifaRank(m.home.name), ra = fifaRank(m.away.name);
  if (rh == null || ra == null) return null;
  if (res === "home" && rh > ra) return "home";
  if (res === "away" && ra > rh) return "away";
  return null;
};
// Knockout underdog: lower-ranked side, only if it ADVANCED (ET/pens included).
const koUpsetSide = (m) => {
  const adv = koAdvancer(m);
  if (!adv) return null;
  const rh = fifaRank(m.home.name), ra = fifaRank(m.away.name);
  if (rh == null || ra == null) return null;
  if (adv === "home" && rh > ra) return "home";
  if (adv === "away" && ra > rh) return "away";
  return null;
};

// "Perfect Pair": both of two simultaneous matches right. Group stage pairs a
// group's two Round-3 matches; knockout (ko=true) pairs any two ties kicking off
// together, through the final. Mirrors perfectPairBonuses() in worldcup/js/app.js.
function perfectPairBonuses(matches, allPreds, players, ko = false) {
  const out = {};
  const pairs = {};
  for (const m of matches) {
    if (isKnockout(m) !== ko) continue;
    if (!m.completed || m.home.score == null) continue;
    if (ko) {
      const key = `ko@${m.kickoff.getTime()}`;
      (pairs[key] = pairs[key] || []).push(m);
    } else {
      if (m.kickoff.getTime() < ROUND3_FROM_MS) continue;
      const g = groupOf(m.home.name);
      if (!g || groupOf(m.away.name) !== g) continue;
      const key = `${g}@${m.kickoff.getTime()}`;
      (pairs[key] = pairs[key] || []).push(m);
    }
  }
  for (const key of Object.keys(pairs)) {
    const pair = pairs[key];
    if (pair.length !== 2) continue;
    for (const pid of Object.keys(players)) {
      let allOutcome = true, allExact = true;
      for (const m of pair) {
        const pr = allPreds.find((p) => p.matchId === m.id && p.playerId === pid);
        const valid = pr && (isOverridden(m) || (pr.updatedAt?.toMillis?.() ?? 0) <= deadlineMs(pr, m));
        if (!valid) { allOutcome = false; break; }
        const exact = pr.home === m.home.score && pr.away === m.away.score;
        const outcome = ko
          ? koWinnerPick(pr) === koAdvancer(m)
          : exact || predWinner(pr) === resultOf(m.home.score, m.away.score);
        if (!outcome) allOutcome = false;
        if (!exact) allExact = false;
      }
      if (!allOutcome) continue;
      out[pid] = (out[pid] || 0) + (allExact ? PERFECT_PAIR_EXACT : PERFECT_PAIR_OUTCOME);
    }
  }
  return out;
}

function dayKeyCairo(d) {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

function lockMs(m) {
  if (dayKeyCairo(m.kickoff) === GRACE_DAY) {
    return m.kickoff.getTime() + GRACE_AFTER_MIN * 60_000;
  }
  return m.kickoff.getTime() - LOCK_MINUTES * 60_000;
}

// Validity deadline frozen on the bet when it was saved (the app stores lockAt).
// Legacy bets without it are grandfathered to kickoff, so later changes to the
// lock window can't retroactively mark an on-time old bet "late". Mirrors app.js.
const deadlineMs = (p, m) =>
  typeof p.lockAt === "number" ? p.lockAt : m.kickoff.getTime();

const isOverridden = (m) =>
  OPEN_OVERRIDES.some((pair) =>
    pair.every((t) =>
      [m.home.abbr, m.home.name, m.away.abbr, m.away.name].some(
        (n) => n && n.toLowerCase().includes(t.toLowerCase())
      )
    )
  );

const resultOf = (hs, as) => (hs > as ? "home" : hs < as ? "away" : "draw");
// Outcome is always read from the predicted score: a level score is a draw
// (never a team win), a decisive score backs that team. Keep in sync with app.js.
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

function normalizeEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const status = comp.status || ev.status || {};
  const side = (ha) => {
    const c = (comp.competitors || []).find((x) => x.homeAway === ha) || {};
    return {
      name: c.team?.shortDisplayName || c.team?.displayName || "TBD",
      abbr: c.team?.abbreviation || "TBD",
      score: c.score != null ? Number(c.score) : null,
      shootout: c.shootoutScore != null ? Number(c.shootoutScore) : null,
    };
  };
  const winC = (comp.competitors || []).find((c) => c.winner === true);
  return {
    id: ev.id,
    kickoff: new Date(ev.date),
    state: status.type?.state || "pre", // pre | in | post
    completed: !!status.type?.completed,
    period: status.period ?? 0,
    detail: status.type?.shortDetail || "",
    statusName: status.type?.name || "", // e.g. STATUS_DELAYED / STATUS_POSTPONED
    group: comp.notes?.[0]?.headline || ev.season?.slug || "",
    advanced: winC ? (winC.homeAway === "home" ? "home" : "away") : null,
    home: side("home"),
    away: side("away"),
  };
}

// True when ESPN flags the match as delayed / postponed / suspended.
const isDelayed = (m) =>
  !m.completed && /delay|postpon|suspend/i.test(`${m.statusName} ${m.detail}`);

function fmtCairo(d) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo",
  });
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  const db = admin.firestore();
  const markers = db.collection("notifications");

  // Heartbeat so the admin can see the notifier is alive (read in the app).
  const heartbeat = (extra = {}) =>
    db.collection("health").doc("notify").set(
      { at: admin.firestore.FieldValue.serverTimestamp(), ...extra },
      { merge: true }
    );

  const tokenDocs = (await db.collection("tokens").get()).docs;
  const tokens = tokenDocs.map((d) => d.id);
  const playerTokens = {}; // playerId -> [tokens] (for targeted reminders)
  for (const d of tokenDocs) {
    const pid = d.data().playerId;
    if (pid) (playerTokens[pid] = playerTokens[pid] || []).push(d.id);
  }

  // Players (loaded up front so we can report notification coverage every run).
  const players = Object.fromEntries(
    (await db.collection("players").get()).docs.map((d) => [d.id, d.data()])
  );

  // 🔔 Notification coverage: who CAN receive (has ≥1 registered device) vs who
  // CAN'T. Written into the heartbeat so the admin dashboard shows it live.
  const covered = new Set(Object.keys(playerTokens).filter((pid) => players[pid]));
  const offNames = Object.entries(players)
    .filter(([id]) => !covered.has(id))
    .map(([, p]) => p.name);
  const coverage = {
    playersTotal: Object.keys(players).length,
    playersOn: covered.size,
    playersOff: offNames.length,
    playersOffNames: offNames,
  };
  console.log(
    `Notification coverage: ${coverage.playersOn}/${coverage.playersTotal} players ON, ` +
    `${coverage.playersOff} OFF${offNames.length ? ` (${offNames.join(", ")})` : ""}; ` +
    `${tokens.length} devices registered`
  );

  // No devices yet? Do nothing, so no event gets burned.
  if (!tokens.length) {
    console.log("No registered devices yet.");
    await heartbeat({ devices: 0, messages: 0, ...coverage });
    return;
  }

  const res = await fetch(ESPN_URL);
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const matches = ((await res.json()).events || []).map(normalizeEvent);
  const now = Date.now();

  // Lazily fetch a single match's predictions, only when an event needs them,
  // cached per run. Keeps Firestore reads tiny vs reading every prediction.
  const predCache = {};
  const matchPreds = async (m) => {
    if (!predCache[m.id]) {
      const snap = await db.collection("predictions").where("matchId", "==", m.id).get();
      predCache[m.id] = snap.docs.map((d) => d.data());
    }
    return predCache[m.id];
  };

  // claim() returns true exactly once per key across all runs
  const claim = async (key) => {
    try {
      await markers.doc(key).create({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return true;
    } catch { return false; }
  };

  // 🔧 One-off admin correction (runs exactly once via claim): Walid was mid-bet
  // on Brazil vs Japan, choosing Brazil 2–1 in 90', when the app updated and his
  // save was lost. Stamp his pick as an on-time "Brazil 2–1, in 90'".
  {
    const FIX = "fix-walid-bra-jpn-2026-06-29";
    const walid = Object.entries(players).find(([, p]) => /walid/i.test(p.name || ""));
    const bjp = matches.find((m) =>
      isKnockout(m) &&
      /brazil/i.test(`${m.home.name} ${m.away.name}`) &&
      /japan/i.test(`${m.home.name} ${m.away.name}`));
    if (walid && bjp && (await claim(FIX))) {
      const [wid] = walid;
      const braHome = /brazil/i.test(bjp.home.name);
      const side = braHome ? "home" : "away";       // Brazil's side in this fixture
      const k = bjp.kickoff.getTime();
      await db.collection("predictions").doc(`${bjp.id}_${wid}`).set({
        matchId: bjp.id,
        playerId: wid,
        home: braHome ? 2 : 1,
        away: braHome ? 1 : 2,
        winner: side,
        koWinner: side,
        koMethod: "reg",                            // "in 90'"
        kickoff: bjp.kickoff.toISOString(),
        lockAt: k - 15 * 60_000,                    // standard knockout lock
        updatedAt: admin.firestore.Timestamp.fromMillis(k - 20 * 60_000), // on-time
      }, { merge: true });
      console.log(`Applied ${FIX}: Walid ${wid} -> Brazil 2-1 in 90' on ${bjp.id}`);
    }
  }

  // 🔧 One-off admin correction (runs once): Alaa entered his Germany vs Paraguay
  // score backwards (1–3); he meant Germany 3–1, in 90'. Fix the exact score only;
  // team/method already say Germany in 90'. (90-min was a draw, so this changes the
  // record, not his points.)
  {
    const FIX = "fix-alaa-ger-par-2026-06-29-v2";
    const alaa = Object.entries(players).find(([, p]) => (p.name || "").trim().toLowerCase() === "alaa");
    const gpm = matches.find((m) =>
      /germany/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`) &&
      /paraguay/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`));
    if (alaa && gpm && (await claim(FIX))) {
      const [aid] = alaa;
      const gerHome = /germany/i.test(gpm.home.name);
      const side = gerHome ? "home" : "away";          // Germany's side in this fixture
      const k = gpm.kickoff.getTime();
      await db.collection("predictions").doc(`${gpm.id}_${aid}`).set({
        matchId: gpm.id,
        playerId: aid,
        home: gerHome ? 3 : 1,
        away: gerHome ? 1 : 3,
        winner: side,
        koWinner: side,
        koMethod: "reg",                               // "in 90'"
        kickoff: gpm.kickoff.toISOString(),
        lockAt: k - 15 * 60_000,
        updatedAt: admin.firestore.Timestamp.fromMillis(k - 20 * 60_000), // on-time
      }, { merge: true });
      console.log(`Applied ${FIX}: Alaa ${aid} -> Germany 3-1 in 90'`);
    }
  }

  // 🔧 One-off admin correction (runs once): Yasser's Ivory Coast vs Norway pick
  // was contradictory — score 2–1 (Ivory Coast winning) but team set to Norway.
  // His real pick was Ivory Coast 2–1 in 90'. Set the team to match the score.
  // (Ivory Coast lost, so with the team-must-match-score rule he scores 0.)
  {
    const FIX = "fix-yasser-civ-nor-2026-06-30";
    const yasser = Object.entries(players).find(([, p]) => (p.name || "").trim().toLowerCase() === "yasser");
    const icn = matches.find((m) =>
      /ivor|c[oô]te|civ/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`) &&
      /norway|nor\b/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`));
    if (yasser && icn && (await claim(FIX))) {
      const [yid] = yasser;
      const civHome = /ivor|c[oô]te|civ/i.test(`${icn.home.name} ${icn.home.abbr}`);
      const side = civHome ? "home" : "away";          // Ivory Coast's side in this fixture
      const k = icn.kickoff.getTime();
      await db.collection("predictions").doc(`${icn.id}_${yid}`).set({
        matchId: icn.id,
        playerId: yid,
        home: civHome ? 2 : 1,
        away: civHome ? 1 : 2,
        winner: side,
        koWinner: side,                                // Ivory Coast (matches the 2–1 score)
        koMethod: "reg",                               // "in 90'"
        kickoff: icn.kickoff.toISOString(),
        lockAt: k - 15 * 60_000,
        updatedAt: admin.firestore.Timestamp.fromMillis(k - 20 * 60_000), // on-time
      }, { merge: true });
      console.log(`Applied ${FIX}: Yasser ${yid} -> Ivory Coast 2-1 in 90'`);
    }
  }

  // 🔧 One-off admin correction (runs once): set Alaa's pick on the upcoming
  // France knockout tie to France 3–1, in 90' (on request, match not started).
  {
    const FIX = "fix-alaa-france-2026-06-30";
    const alaa2 = Object.entries(players).find(([, p]) => (p.name || "").trim().toLowerCase() === "alaa");
    const frm = matches.find((m) =>
      isKnockout(m) && !m.completed &&
      /france/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`));
    if (alaa2 && frm && (await claim(FIX))) {
      const [aid] = alaa2;
      const frHome = /france/i.test(`${frm.home.name} ${frm.home.abbr}`);
      const side = frHome ? "home" : "away";           // France's side in this fixture
      const k = frm.kickoff.getTime();
      await db.collection("predictions").doc(`${frm.id}_${aid}`).set({
        matchId: frm.id,
        playerId: aid,
        home: frHome ? 3 : 1,
        away: frHome ? 1 : 3,
        winner: side,
        koWinner: side,                                // France (matches the 3–1 score)
        koMethod: "reg",                               // "in 90'"
        kickoff: frm.kickoff.toISOString(),
        lockAt: k - 15 * 60_000,
        updatedAt: admin.firestore.Timestamp.fromMillis(Math.min(Date.now(), k - 16 * 60_000)), // on-time
      }, { merge: true });
      console.log(`Applied ${FIX}: Alaa ${aid} -> France 3-1 in 90' on ${frm.id} (${frm.home.name}/${frm.away.name})`);
    }
  }

  // 🔧 One-off admin correction (runs once): Amr, Zeina & Abo alaa backed France
  // vs Sweden but their old-style picks had no method — add "in 90'" so they're
  // scored like everyone else. Only merge team/method (not timing → stays valid).
  {
    const FIX = "fix-fra-swe-add-90-2026-06-30";
    const fsm = matches.find((m) =>
      isKnockout(m) &&
      /france/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`) &&
      /sweden/i.test(`${m.home.name} ${m.away.name} ${m.home.abbr} ${m.away.abbr}`));
    if (fsm && (await claim(FIX))) {
      const side = /france/i.test(`${fsm.home.name} ${fsm.home.abbr}`) ? "home" : "away";
      for (const t of ["amr", "zeina", "abo"]) {       // "abo" → Abo alaa, not Alaa
        const entry = Object.entries(players).find(([, p]) => (p.name || "").toLowerCase().includes(t));
        if (!entry) { console.log(`FRA-SWE 90 fix: no player matched "${t}"`); continue; }
        const [pid, p] = entry;
        await db.collection("predictions").doc(`${fsm.id}_${pid}`).set(
          { koWinner: side, koMethod: "reg" }, { merge: true });
        console.log(`Applied ${FIX}: ${p.name} ${pid} -> +in 90' on ${fsm.id}`);
      }
    }
  }

  const validPredsFrom = (list, m) =>
    list
      .filter((p) => p.matchId === m.id && players[p.playerId])
      .filter((p) => isOverridden(m) || (p.updatedAt?.toMillis?.() ?? 0) <= deadlineMs(p, m))
      .map((p) => ({ ...p, name: players[p.playerId].name, emoji: players[p.playerId].emoji || "" }));
  const validPreds = async (m) => validPredsFrom(await matchPreds(m), m);

  const sendList = []; // { title, body }
  let anyFullTime = false;

  // 📣 One-off broadcast to every registered device — sent exactly once via
  // claim(). Bump `id` to send a new one; set BROADCAST to null to disable.
  const BROADCAST = {
    id: "2026-07-04-et-exact",
    title: "🆕 Extra-time exact scores now count!",
    body: "New in the knockouts: your exact score follows your pick. Call ⏱ Extra Time and you now predict the final AFTER extra time (e.g. 2–1 AET); call 🥅 Penalties and you predict the end-of-ET draw. Nail it for +3 (×round). Open the app and set your ET picks! ⚽",
  };
  if (BROADCAST && (await claim(`broadcast_${BROADCAST.id}`))) {
    sendList.push({ title: BROADCAST.title, body: BROADCAST.body });
  }

  for (const m of matches) {
    const vs = `${m.home.name} 🆚 ${m.away.name}`;
    const lock = lockMs(m);

    // ⏸ match delayed / postponed — alert everyone once
    if (isDelayed(m)) {
      if (await claim(`delay_${m.id}`)) {
        sendList.push({
          title: `⏸ Match delayed: ${vs}`,
          body: `${vs} has been delayed${m.detail ? ` (${m.detail})` : ""}. Hang tight — we'll let you know when it's back on ⚽`,
        });
      }
    }

    // ▶️ match resumed after a delay — alert once, only if it was delayed before
    if (m.state === "in" && !isDelayed(m) && !m.completed) {
      const wasDelayed = (await markers.doc(`delay_${m.id}`).get()).exists;
      if (wasDelayed && await claim(`resume_${m.id}`)) {
        sendList.push({
          title: `▶️ Back underway: ${vs}`,
          body: `${vs} has resumed after the delay${m.detail ? ` (${m.detail})` : ""} — game on! ⚽`,
        });
      }
    }

    // ⏰ betting reminder — sent ONLY to players who haven't bet on this match yet
    if (!m.completed && m.state === "pre" && lock > now && lock - now <= REMIND_WINDOW_MIN * 60_000) {
      if (await claim(`remind_${m.id}`)) {
        const betters = new Set(
          (await validPreds(m)).map((p) => p.playerId)
        );
        const target = [];
        for (const [pid, toks] of Object.entries(playerTokens)) {
          if (!betters.has(pid)) target.push(...toks);
        }
        if (target.length) {
          sendList.push({
            title: "⏰ You haven't predicted yet!",
            body: `${vs} — get your bet in before ${fmtCairo(new Date(lock))} or miss out ⚽`,
            tokens: target,
          });
        }
      }
    }

    // 🥅 kickoff: reveal everyone's picks (only for recent kickoffs, no backfill)
    if (m.state !== "pre" && now - m.kickoff.getTime() < 3 * 3_600_000) {
      if (await claim(`ko_${m.id}`)) {
        const picks = (await validPreds(m))
          .map((p) => `${p.emoji} ${p.name}: ${p.home}–${p.away}`)
          .join(" · ");
        sendList.push({
          title: `🥅 Kickoff: ${vs}`,
          body: picks ? `The bets are in 👀 ${picks}` : "Nobody bet on this one 🙈",
        });
      }
    }

    // ⚽ goal alerts: compare with the score seen on the previous run
    if (m.state === "in" && m.home.score != null) {
      const liveRef = markers.doc(`live_${m.id}`);
      const seen = await liveRef.get();
      const cur = { h: m.home.score, a: m.away.score };
      if (!seen.exists) {
        await liveRef.set(cur); // baseline, don't notify mid-game on first sight
      } else {
        const old = seen.data();
        if (old.h !== cur.h || old.a !== cur.a) {
          await liveRef.set(cur);
          const goal = cur.h + cur.a > old.h + old.a;
          const exact = (await validPreds(m))
            .filter((p) => p.home === cur.h && p.away === cur.a)
            .map((p) => `${p.emoji} ${p.name}`);
          sendList.push({
            title: goal ? `⚽ GOOOAL! ${m.home.abbr} ${cur.h}–${cur.a} ${m.away.abbr}`
                        : `📺 Score update: ${m.home.abbr} ${cur.h}–${cur.a} ${m.away.abbr}`,
            body:
              `${vs} (${m.detail})` +
              (exact.length ? ` — 🎯 exactly ${exact.join(" & ")}'s pick! Hold on...` : ""),
          });
        }
      }
    }

    // 🏁 full time + points
    if (m.completed && m.home.score != null) {
      if (await claim(`ft_${m.id}`)) {
        anyFullTime = true;
        const finished = await validPreds(m);
        const lines = finished
          .map((p) => ({ ...p, pts: matchPoints(p, m) }))
          .sort((a, b) => b.pts - a.pts)
          .map((r) => `${r.emoji} ${r.name} +${r.pts}`);
        // 🏅 only-winner callout — both phases (sole scorer), Round 2 onward
        let bonusLine = "";
        if (m.kickoff.getTime() >= BONUS_FROM_MS) {
          const scorers = finished.filter((p) => matchPoints(p, m) > 0);
          if (scorers.length === 1) bonusLine += ` · 🏅 ${scorers[0].emoji} ${scorers[0].name} ONLY winner +${ONLY_WINNER_BONUS}!`;
        }
        // 🐺 underdog bonus callout — both phases (knockout uses the advancer)
        if (m.kickoff.getTime() >= BONUS_FROM_MS) {
          const ko = isKnockout(m);
          const upset = ko ? koUpsetSide(m) : upsetWinSide(m);
          if (upset) {
            const dogs = finished.filter((p) => (ko ? koWinnerPick(p) : predWinner(p)) === upset)
              .map((p) => `${p.emoji} ${p.name}`);
            if (dogs.length) bonusLine += ` · 🐺 underdog +${UNDERDOG_BONUS}: ${dogs.join(", ")}`;
          }
        }
        // ⚽ goal rush callout (Round 3 onward & knockout): 0-point pick, right total goals
        if (m.kickoff.getTime() >= ROUND3_FROM_MS) {
          const rushers = finished.filter((p) =>
            matchPoints(p, m) === 0 &&
            (p.home + p.away) === (m.home.score + m.away.score)
          ).map((p) => `${p.emoji} ${p.name}`);
          if (rushers.length) bonusLine += ` · ⚽ goal rush +${GOAL_RUSH}: ${rushers.join(", ")}`;
        }
        sendList.push({
          title: `🏁 FT: ${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name}`,
          body: lines.length ? `Points: ${lines.join(" · ")}${bonusLine}` : "Nobody predicted this one 🙈",
        });

        // 🎯 exact-score celebration: flagged for 1 hour after full time,
        // shown with fireworks (+ names) to everyone who opens the app.
        const exactPreds = finished
          .filter((p) => p.home === m.home.score && p.away === m.away.score);
        const exact = exactPreds.map((p) => `${p.emoji} ${p.name}`);
        if (exact.length) {
          const exactPts = matchPoints(exactPreds[0], m); // group = 7; knockout = (3+3)×round
          await db.collection("health").doc("celebration").set({
            id: `exact_${m.id}`,
            title: "🎯 EXACT SCORE!",
            body: `${exact.join(" & ")} nailed ${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name} for +${exactPts}! 🎆 Who's next?`,
            until: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
            at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }
  }

  // 👑 leader change (only worth checking when a result just landed)
  if (anyFullTime) {
    // a result just landed — fetch the full history once for the standings
    const allPreds = (await db.collection("predictions").get()).docs.map((d) => d.data());
    const totals = {};
    for (const name of Object.values(players).map((p) => p.name)) {
      totals[name] = bonusFor(name);
    }
    for (const m of matches) {
      if (!m.completed || m.home.score == null) continue;
      for (const p of validPredsFrom(allPreds, m)) {
        totals[p.name] = (totals[p.name] || 0) + matchPoints(p, m) + finalGambleDelta(p, m, p.playerId);
      }
    }
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (ranked.length && ranked[0][1] > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
      const [name, pts] = ranked[0];
      const leaderRef = markers.doc("state_leader");
      const prev = await leaderRef.get();
      if (!prev.exists || prev.data().name !== name) {
        await leaderRef.set({ name, pts });
        sendList.push({
          title: `👑 New leader: ${name}!`,
          body: `${name} tops the table with ${pts} pts — check the standings 🏆`,
        });
      }
    }

    // 📊 rank snapshot for the standings movement arrows (same tiebreak as the app)
    const stat = {};
    for (const [id, p] of Object.entries(players)) {
      stat[id] = { pts: bonusFor(p.name), exact: 0, outcomes: 0, name: p.name };
    }
    for (const m of matches) {
      if (!m.completed || m.home.score == null) continue;
      const ko = isKnockout(m);
      const bonusEligible = ko || m.kickoff.getTime() >= BONUS_FROM_MS; // both phases
      const upset = bonusEligible ? (ko ? koUpsetSide(m) : upsetWinSide(m)) : null;
      const scorers = [];
      for (const pr of allPreds) {
        if (pr.matchId !== m.id || !players[pr.playerId]) continue;
        if (!(isOverridden(m) || (pr.updatedAt?.toMillis?.() ?? 0) <= deadlineMs(pr, m))) continue;
        const s = stat[pr.playerId];
        const pts = matchPoints(pr, m);
        s.pts += pts + finalGambleDelta(pr, m, pr.playerId);
        if (pts > 0) scorers.push(pr.playerId);
        const isExact = pr.home === m.home.score && pr.away === m.away.score;
        if (isExact) s.exact++;
        if (isExact || predWinner(pr) === resultOf(m.home.score, m.away.score)) s.outcomes++;
        if (upset && (ko ? koWinnerPick(pr) : predWinner(pr)) === upset) s.pts += UNDERDOG_BONUS; // 🐺 underdog
        // ⚽ goal rush (Round 3 onward & knockout): consolation for a 0-point
        // pick that still nailed the total goals
        if (m.kickoff.getTime() >= ROUND3_FROM_MS && pts === 0 &&
            (pr.home + pr.away) === (m.home.score + m.away.score)) {
          s.pts += GOAL_RUSH;
        }
      }
      // 🏅 only-winner bonus (sole scorer) — group Round 2 onward AND knockout
      if (bonusEligible && scorers.length === 1) stat[scorers[0]].pts += ONLY_WINNER_BONUS;
    }
    // 🤝 perfect pair — group (Round 3) and knockout (simultaneous ties)
    for (const ko of [false, true]) {
      const ppb = perfectPairBonuses(matches, allPreds, players, ko);
      for (const [id, b] of Object.entries(ppb)) if (stat[id]) stat[id].pts += b;
    }

    // 🤝 Perfect Pair callout — announce once per group pair as it completes
    const r3pairs = {};
    for (const m of matches) {
      if (!m.completed || m.home.score == null || m.kickoff.getTime() < ROUND3_FROM_MS) continue;
      const g = groupOf(m.home.name);
      if (!g || groupOf(m.away.name) !== g) continue;
      const key = `${g}@${m.kickoff.getTime()}`;
      (r3pairs[key] = r3pairs[key] || []).push(m);
    }
    for (const key of Object.keys(r3pairs)) {
      const pair = r3pairs[key];
      if (pair.length !== 2) continue;
      if (!(await claim(`pairdone_${key}`))) continue;   // once per pair
      const winners = [];
      for (const [pid, p] of Object.entries(players)) {
        let allOutcome = true, allExact = true;
        for (const m of pair) {
          const pr = allPreds.find((x) => x.matchId === m.id && x.playerId === pid);
          const valid = pr && (isOverridden(m) || (pr.updatedAt?.toMillis?.() ?? 0) <= deadlineMs(pr, m));
          if (!valid) { allOutcome = false; break; }
          const exact = pr.home === m.home.score && pr.away === m.away.score;
          if (!(exact || predWinner(pr) === resultOf(m.home.score, m.away.score))) allOutcome = false;
          if (!exact) allExact = false;
        }
        if (allOutcome) {
          winners.push(`${p.emoji || ""} ${p.name} (+${allExact ? PERFECT_PAIR_EXACT : PERFECT_PAIR_OUTCOME})`);
        }
      }
      const g = key.split("@")[0];
      if (winners.length) {
        sendList.push({
          title: `🤝 Perfect Pair — Group ${g}!`,
          body: `Both Group ${g} matches nailed: ${winners.join(" · ")} 🔥`,
        });
      }
    }
    const order = Object.keys(stat).sort((a, b) =>
      stat[b].pts - stat[a].pts || stat[b].exact - stat[a].exact ||
      stat[b].outcomes - stat[a].outcomes || stat[a].name.localeCompare(stat[b].name));
    const ranks = {};
    order.forEach((id, i) => (ranks[id] = i + 1));
    const standRef = db.collection("health").doc("standings");
    const prevStand = await standRef.get();
    const prevRanks = prevStand.exists ? (prevStand.data().ranks || ranks) : ranks;
    await standRef.set({ ranks, prevRanks, at: admin.firestore.FieldValue.serverTimestamp() });
  }

  if (!sendList.length) {
    console.log("Nothing to send this run.");
    await heartbeat({ devices: tokens.length, messages: 0, ...coverage });
    return;
  }

  let failures = 0;
  for (const item of sendList) {
    const dest = item.tokens || tokens;          // targeted (reminders) or broadcast
    if (!dest.length) continue;
    const resp = await admin.messaging().sendEachForMulticast({
      tokens: dest,
      // DATA-only so the service worker displays it once, reliably
      data: {
        title: item.title,
        body: item.body,
        link: APP_URL,
        icon: `${APP_URL}group.jpg`,
      },
      webpush: { fcmOptions: { link: APP_URL } },
    });
    failures += resp.failureCount;
    console.log(`Sent "${item.title}" — to ${dest.length}, ok: ${resp.successCount}, failed: ${resp.failureCount}`);
    // Prune dead tokens so the list stays clean
    await Promise.all(
      resp.responses.map((r, i) =>
        !r.success && r.error?.code === "messaging/registration-token-not-registered"
          ? db.collection("tokens").doc(dest[i]).delete()
          : null
      )
    );
  }

  await heartbeat({ devices: tokens.length, messages: sendList.length, failures, ...coverage });
}

// Log errors but exit 0 so a transient failure (e.g. a quota blip or ESPN
// hiccup) doesn't mark the run red and spam failure emails. The in-app health
// pill still surfaces a stale notifier if something is genuinely wrong.
main().catch((err) => { console.error("notify run error (non-fatal):", err?.message || err); });
