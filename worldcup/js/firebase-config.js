/*
 * Gang Cup 2026 — group configuration
 * ====================================
 * 1) GROUP_CODE: the secret code your friends type to join. Change it!
 * 2) FIREBASE_CONFIG: paste your Firebase project config here.
 *    Full 5-minute walkthrough in worldcup/README.md.
 *
 * Until FIREBASE_CONFIG is set, the app runs in "scores only" mode:
 * live World Cup scores work, but predictions/leaderboard are disabled.
 */

window.GROUP_CODE = "GANG2026";

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-mPxIfqPWxd6Xo1qNFPGrlp7IL3xt3-A",
  authDomain: "gang-cup-2026.firebaseapp.com",
  projectId: "gang-cup-2026",
  storageBucket: "gang-cup-2026.firebasestorage.app",
  messagingSenderId: "618744827340",
  appId: "1:618744827340:web:4d74f6a8af830ae0f92169",
  measurementId: "G-H5JY1CMNM3"
};

// Maximum number of players allowed to join
window.MAX_PLAYERS = 40;

// Manual point adjustments, added to the leaderboard totals.
// "*" applies to every player without an explicit entry.
// Grace: +2 to everyone who couldn't bet on the first match (Alaa earned his).
// Counts toward totals (folded into "base") but not shown as its own chip.
window.BONUS_POINTS = { "*": 2, "Alaa": 0 };

// Web push notifications (Firebase Cloud Messaging).
window.VAPID_KEY = "BJeCjL3Ge6h9UzWfSzM0hFIgO5EBvwdyY2ADVkBjwqXfdyQfBA4304ljAFb1hDx-pYcEFjXtoR6B3HIELHgG11o";

// Clean public link used in WhatsApp invite/share messages.
window.APP_LINK = "https://tinyurl.com/El3eshaWC26";

// Current app version (shown at the bottom of the Rules tab). Bump on updates.
window.APP_VERSION = "2.3";

// Scoring rules / bonuses. `bonusFrom` / `round3From` (fixed UTC moments) are
// when new bonuses start counting, so earlier rounds aren't changed retroactively.
window.RULES = {
  onlyWinnerBonus: 2,                    // +2 to the SOLE player who scored on a match
  underdogBonus: 2,                      // +2 for correctly backing the lower-ranked team to win
  bonusFrom: "2026-06-18T00:00:00Z",     // Round 2 onward

  // Round 3 (final group round) challenges — both group matches kick off together.
  perfectPairOutcome: 3,                 // +3 (once) for both outcomes in a group's simultaneous pair
  perfectPairExact: 6,                   // +6 (once) if BOTH are exact scores
  goalRush: 1,                           // +1 for nailing total goals when the exact score is missed
  round3From: "2026-06-24T19:00:00Z",    // Round 3 kicks off 22:00 Cairo (EEST, UTC+3)
};

// Knockout stage — "Road to WC26 Final". Lights up automatically once ESPN lists
// matches on/after `from`. Scoring per match: correctly pick who ADVANCES
// (penalties/extra time included) + the exact 90-minute score, then multiplied by
// the round (escalating, so later rounds are worth more). Knockout runs on its
// own fresh-from-zero leaderboard (the Table tab gets a Group/Knockout/Overall toggle).
window.KNOCKOUT = {
  from: "2026-06-28T00:00:00Z",                          // Round of 32 begins
  advancePts: 3,                                         // correct "who goes through" pick
  exactPts: 3,                                           // exact 90-minute score (on top → 6 total)
  mult: { R32: 1, R16: 2, QF: 3, SF: 4, "3P": 4, F: 5 }, // escalating per round
};
// ALL bonus cards carry into the knockout stage (through the final), each on the
// knockout's own fresh leaderboard: 🏅 Only-Winner (sole correct advancer),
// 🐺 Underdog (back the lower-ranked team to advance), 🤝 Perfect Pair (nail both
// ties kicking off simultaneously) and ⚽ Goal Rush (0 points but right total
// goals). Bonuses are flat — only the advancer + exact points get the round mult.

// Exact-score celebrations are now AUTOMATIC: the notifier flags every
// exact-score win at full time (health/celebration in Firestore) and the app
// shows the fireworks + winners' names on open for one hour after the match.
// This is an optional MANUAL override for a custom announcement (null = off).
// `until` replays it on every open until that time; set null to switch off.
window.ANNOUNCEMENT = {
  id: "update-2026-06-24-round3",
  version: "2.3",
  emoji: "🤝",
  body: "ROUND 3 CHALLENGES! 🤝 PERFECT PAIR: nail BOTH of a group's simultaneous matches → +3 (or +6 if both are exact!). ⚽ GOAL RUSH: miss the exact score but call the total goals → +1. These stack on top of your normal points! 🏆",
  until: "2026-06-27T22:00:00Z",
};

// -----------------------------------------------------------------------------
// Sponsor (set to null to hide all sponsor branding everywhere).
//   name    : shown in the strip, splash, WhatsApp footer
//   tagline : short one-liner under the name (optional)
//   logo    : image filename placed in the worldcup/ folder (optional)
//   link    : tapped destination — a website or a wa.me/<number> link
//   cta     : button text (e.g. "Book now")
//   prize   : line shown in Rules → Winning (the sponsor's prize)
// -----------------------------------------------------------------------------
window.SPONSOR = {
  name: "Euro Car",
  tagline: "Premium Car Rental",   // ← confirm/replace with their real tagline
  logo: "sponsor.png",
  link: "https://wa.me/201001186668",
  cta: "Book now",
  prize: "🏆 Prizes will be announced in rolling updates — stay tuned!",
};
