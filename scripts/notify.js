/*
 * 3am El Sheikh Etman — push notification sender
 *
 * Run by .github/workflows/notify.yml on a 15-minute cron. Sends two kinds
 * of FCM web-push notifications to every registered device token:
 *   1. "Betting closes soon" — when a match's lock time is within ~75 min
 *   2. Full-time result + points earned by each player
 * Firestore `notifications/{key}` docs deduplicate sends across runs.
 *
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
const predWinner = (pred) => pred.winner || resultOf(pred.home, pred.away);

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
    completed: !!status.type?.completed,
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

  const res = await fetch(ESPN_URL);
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  const matches = ((await res.json()).events || []).map(normalizeEvent);
  const now = Date.now();

  const queue = []; // { key, title, body }

  for (const m of matches) {
    const lock = lockMs(m);
    if (!m.completed && lock > now && lock - now <= REMIND_WINDOW_MIN * 60_000) {
      queue.push({
        key: `remind_${m.id}`,
        title: "⏰ Betting closes soon!",
        body: `${m.home.name} 🆚 ${m.away.name} — get your bet in before ${fmtCairo(new Date(lock))} ⚽`,
      });
    }
    if (m.completed && m.home.score != null) {
      queue.push({ key: `ft_${m.id}`, match: m });
    }
  }

  if (!queue.length) { console.log("Nothing to send this run."); return; }

  // Deduplicate: create() fails if the marker doc already exists.
  const toSend = [];
  for (const item of queue) {
    try {
      await db.collection("notifications").doc(item.key).create({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      toSend.push(item);
    } catch {
      /* already sent on a previous run */
    }
  }
  if (!toSend.length) { console.log("All candidates were already sent."); return; }

  // Full-time messages need predictions + player names for the points line.
  let players = null, predictions = null;
  for (const item of toSend) {
    if (!item.match) continue;
    if (!players) {
      players = Object.fromEntries(
        (await db.collection("players").get()).docs.map((d) => [d.id, d.data()])
      );
      predictions = (await db.collection("predictions").get()).docs.map((d) => d.data());
    }
    const m = item.match;
    const lock = lockMs(m);
    const lines = predictions
      .filter((p) => p.matchId === m.id && players[p.playerId])
      .filter((p) => isOverridden(m) || (p.updatedAt?.toMillis?.() ?? 0) <= lock)
      .map((p) => {
        const pts = scorePrediction(p, m.home.score, m.away.score);
        return { name: players[p.playerId].name, emoji: players[p.playerId].emoji || "", pts };
      })
      .sort((a, b) => b.pts - a.pts)
      .map((r) => `${r.emoji} ${r.name} +${r.pts}`);
    item.title = `🏁 FT: ${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name}`;
    item.body = lines.length ? `Points: ${lines.join(" · ")}` : "Nobody predicted this one 🙈";
  }

  const tokenDocs = (await db.collection("tokens").get()).docs;
  const tokens = tokenDocs.map((d) => d.id);
  if (!tokens.length) { console.log("No registered devices yet."); return; }

  for (const item of toSend) {
    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: item.title, body: item.body },
      webpush: {
        fcmOptions: { link: APP_URL },
        notification: { icon: `${APP_URL}group.jpg`, badge: `${APP_URL}group.jpg` },
      },
    });
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
}

main().catch((err) => { console.error(err); process.exit(1); });
