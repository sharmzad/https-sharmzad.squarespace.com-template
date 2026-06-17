/*
 * 3am El Sheikh Etman — push notification sender
 *
 * Run by .github/workflows/notify.yml on a cron. Sends FCM web-push to every
 * registered device:
 *   ⏰ "Betting closes soon"        — lock within ~75 min
 *   🥅 Kickoff + everyone's picks   — when a match goes live
 *   ⚽ Goal alerts                  — live score changed since last run
 *   🏁 Full-time result + points    — with each player's score
 *   👑 New leaderboard leader       — after results land
 *   ✍️ Bet placed/updated           — before lock, score kept secret
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
const LOCK_MINUTES = 60;
const GRACE_DAY = "2026-06-12"; // Egypt local date, lock = KO + 50 min
const GRACE_AFTER_MIN = 50;
const OPEN_OVERRIDES = [["KOR", "CZE"]];
const REMIND_WINDOW_MIN = 75; // notify when lock is at most this far away
// Keep in sync with BONUS_POINTS in worldcup/js/firebase-config.js
const BONUS_POINTS = { "*": 2, "Alaa": 0 };
const bonusFor = (name) =>
  BONUS_POINTS[name] !== undefined ? BONUS_POINTS[name] : (BONUS_POINTS["*"] || 0);

function dayKeyCairo(d) {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

function lockMs(m) {
  if (dayKeyCairo(m.kickoff) === GRACE_DAY) {
    return m.kickoff.getTime() + GRACE_AFTER_MIN * 60_000;
  }
  return m.kickoff.getTime() - LOCK_MINUTES * 60_000;
}

const isOverridden = (m) =>
  OPEN_OVERRIDES.some((pair) =>
    pair.every((t) =>
      [m.home.abbr, m.home.name, m.away.abbr, m.away.name].some(
        (n) => n && n.toLowerCase().includes(t.toLowerCase())
      )
    )
  );

const resultOf = (hs, as) => (hs > as ? "home" : hs < as ? "away" : "draw");
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

function normalizeEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const status = comp.status || ev.status || {};
  const side = (ha) => {
    const c = (comp.competitors || []).find((x) => x.homeAway === ha) || {};
    return {
      name: c.team?.shortDisplayName || c.team?.displayName || "TBD",
      abbr: c.team?.abbreviation || "TBD",
      score: c.score != null ? Number(c.score) : null,
    };
  };
  return {
    id: ev.id,
    kickoff: new Date(ev.date),
    state: status.type?.state || "pre", // pre | in | post
    completed: !!status.type?.completed,
    detail: status.type?.shortDetail || "",
    home: side("home"),
    away: side("away"),
  };
}

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

  // No devices yet? Do nothing, so no event gets burned.
  const tokens = (await db.collection("tokens").get()).docs.map((d) => d.id);
  if (!tokens.length) {
    console.log("No registered devices yet.");
    await heartbeat({ devices: 0, messages: 0 });
    return;
  }

  const res = await fetch(ESPN_URL);
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const matches = ((await res.json()).events || []).map(normalizeEvent);
  const now = Date.now();

  const players = Object.fromEntries(
    (await db.collection("players").get()).docs.map((d) => [d.id, d.data()])
  );

  // Only fetch predictions for matches today's features can touch — live ones,
  // recent finishes, and upcoming unlocked fixtures — to keep Firestore reads
  // well inside the free quota even with frequent cron runs.
  const relevantIds = matches
    .filter((m) =>
      m.state === "in" ||
      (m.completed && now - m.kickoff.getTime() < 24 * 3_600_000) ||
      (m.state === "pre" && lockMs(m) > now && m.kickoff.getTime() - now < 48 * 3_600_000)
    )
    .map((m) => m.id);
  const predictions = [];
  for (let i = 0; i < relevantIds.length; i += 30) {
    const snap = await db
      .collection("predictions")
      .where("matchId", "in", relevantIds.slice(i, i + 30))
      .get();
    predictions.push(...snap.docs.map((d) => d.data()));
  }

  // claim() returns true exactly once per key across all runs
  const claim = async (key) => {
    try {
      await markers.doc(key).create({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return true;
    } catch { return false; }
  };

  const validPredsFrom = (list, m) =>
    list
      .filter((p) => p.matchId === m.id && players[p.playerId])
      .filter((p) => isOverridden(m) || (p.updatedAt?.toMillis?.() ?? 0) <= lockMs(m))
      .map((p) => ({ ...p, name: players[p.playerId].name, emoji: players[p.playerId].emoji || "" }));
  const validPreds = (m) => validPredsFrom(predictions, m);

  const sendList = []; // { title, body }
  let anyFullTime = false;

  for (const m of matches) {
    const vs = `${m.home.name} 🆚 ${m.away.name}`;
    const lock = lockMs(m);

    // ⏰ betting reminder
    if (!m.completed && m.state === "pre" && lock > now && lock - now <= REMIND_WINDOW_MIN * 60_000) {
      if (await claim(`remind_${m.id}`)) {
        sendList.push({
          title: "⏰ Betting closes soon!",
          body: `${vs} — get your bet in before ${fmtCairo(new Date(lock))} ⚽`,
        });
      }
    }

    // 🥅 kickoff: reveal everyone's picks (only for recent kickoffs, no backfill)
    if (m.state !== "pre" && now - m.kickoff.getTime() < 3 * 3_600_000) {
      if (await claim(`ko_${m.id}`)) {
        const picks = validPreds(m)
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
          const exact = validPreds(m)
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
        const finished = validPreds(m);
        const lines = finished
          .map((p) => ({ ...p, pts: scorePrediction(p, m.home.score, m.away.score) }))
          .sort((a, b) => b.pts - a.pts)
          .map((r) => `${r.emoji} ${r.name} +${r.pts}`);
        sendList.push({
          title: `🏁 FT: ${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name}`,
          body: lines.length ? `Points: ${lines.join(" · ")}` : "Nobody predicted this one 🙈",
        });

        // 🎯 exact-score celebration: flagged for 1 hour after full time,
        // shown with fireworks (+ names) to everyone who opens the app.
        const exact = finished
          .filter((p) => p.home === m.home.score && p.away === m.away.score)
          .map((p) => `${p.emoji} ${p.name}`);
        if (exact.length) {
          await db.collection("health").doc("celebration").set({
            id: `exact_${m.id}`,
            title: "🎯 EXACT SCORE!",
            body: `${exact.join(" & ")} nailed ${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name} for +7! 🎆 Who's next?`,
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
        totals[p.name] = (totals[p.name] || 0) + scorePrediction(p, m.home.score, m.away.score);
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
      for (const pr of allPreds) {
        if (pr.matchId !== m.id || !players[pr.playerId]) continue;
        if (!(isOverridden(m) || (pr.updatedAt?.toMillis?.() ?? 0) <= lockMs(m))) continue;
        const s = stat[pr.playerId];
        s.pts += scorePrediction(pr, m.home.score, m.away.score);
        if (pr.home === m.home.score && pr.away === m.away.score) s.exact++;
        if (predWinner(pr) === resultOf(m.home.score, m.away.score)) s.outcomes++;
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

  // ✍️ bet placed/updated on upcoming matches (score stays secret until lock)
  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));
  for (const p of predictions) {
    const m = matchById[p.matchId];
    const t = p.updatedAt?.toMillis?.();
    if (!m || !t || !players[p.playerId]) continue;
    if (lockMs(m) <= now) continue; // match locked — kickoff alert covers reveals
    if (await claim(`pred_${p.matchId}_${p.playerId}_${t}`)) {
      const who = players[p.playerId];
      sendList.push({
        title: `✍️ ${who.emoji || ""} ${who.name} placed a bet!`,
        body: `${m.home.name} 🆚 ${m.away.name} — the pick stays secret until lock 🤫`,
      });
    }
  }

  if (!sendList.length) {
    console.log("Nothing to send this run.");
    await heartbeat({ devices: tokens.length, messages: 0 });
    return;
  }

  let failures = 0;
  for (const item of sendList) {
    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: item.title, body: item.body },
      webpush: {
        fcmOptions: { link: APP_URL },
        notification: { icon: `${APP_URL}group.jpg`, badge: `${APP_URL}group.jpg` },
      },
    });
    failures += resp.failureCount;
    console.log(`Sent "${item.title}" — ok: ${resp.successCount}, failed: ${resp.failureCount}`);
    // Prune dead tokens so the list stays clean
    await Promise.all(
      resp.responses.map((r, i) =>
        !r.success && r.error?.code === "messaging/registration-token-not-registered"
          ? db.collection("tokens").doc(tokens[i]).delete()
          : null
      )
    );
  }

  await heartbeat({ devices: tokens.length, messages: sendList.length, failures });
}

main().catch((err) => { console.error(err); process.exit(1); });
