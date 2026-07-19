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
  advancePts: 3,                                         // correct team to advance ("who")
  methodPts: 3,                                          // correct way decided ("how": 90'/ET/Pen)
  exactPts: 3,                                           // exact 90-minute score
  mult: { R32: 1, R16: 2, QF: 3, SF: 4, "3P": 4, F: 5 }, // escalating per round
};
// -----------------------------------------------------------------------------
// 🎰 THE FINAL GAMBLE — only on the Final (Spain vs Argentina). On top of the
// normal who + how + exact pick (base ×5), three luck-and-nerve layers turn the
// last game into a shootout:
//   🎰 The Stake — bank your base final points at ×1 safe / ×2 bold / ×3 all-in.
//        Nail the core pick → it's multiplied. Miss it (0 base) → you PAY the
//        penalty for that stake (×1 never loses). Insurance (wheel) cancels it.
//   🃏 The Joker — pick ONE side-prop for a flat +jokerPts. The wheel's Double
//        segment doubles it.
//   🎡 The Wheel — everyone spins ONCE. The outcome is locked to the player
//        (deterministic hash of playerId+matchId → identical on every device,
//        no re-rolls, no cheating). `add` = flat bonus; kind:"dblJoker" doubles
//        the Joker; kind:"insure" cancels the stake penalty.
// Set enabled:false to switch the whole thing off. `mult` for the Final still
// comes from KNOCKOUT.mult.F (×5) — the Stake multiplies THAT.
// -----------------------------------------------------------------------------
window.FINAL_GAMBLE = {
  enabled: true,
  stakes: [1, 2, 3],                       // ×1 safe · ×2 bold · ×3 all-in
  penalty: { 2: 5, 3: 10 },                // points LOST on a 0-base miss (×1 never loses)
  jokerPts: 5,                             // flat reward for a correct Joker prop
  jokers: [                                // pick exactly one (3 either/or markets)
    { id: "odd",     emoji: "🔢", label: "Odd total goals",  hint: "Total goals is 1, 3, 5, 7…" },
    { id: "even",    emoji: "⚖️", label: "Even total goals", hint: "Total goals is 0, 2, 4, 6…" },
    { id: "btts_y",  emoji: "⚔️", label: "Both teams score", hint: "Both sides score at least once" },
    { id: "btts_n",  emoji: "🧤", label: "A clean sheet",    hint: "At least one team is kept scoreless" },
    { id: "margin2", emoji: "💥", label: "Won by 2+ goals",  hint: "The winner wins by two or more" },
    { id: "close",   emoji: "😰", label: "1-goal game / draw", hint: "Decided by a single goal, or level" },
  ],
  // Weighted luck wheel (weights need not sum to 100 — they're relative).
  wheel: [
    { id: "p5",      emoji: "➕",  label: "+5",           add: 5,  weight: 30 },
    { id: "p8",      emoji: "🔥",  label: "+8",           add: 8,  weight: 22 },
    { id: "p10",     emoji: "⭐",  label: "+10",          add: 10, weight: 14 },
    { id: "jackpot", emoji: "💎",  label: "JACKPOT +15",  add: 15, weight: 8  },
    { id: "dbl",     emoji: "2️⃣",  label: "Double Joker", kind: "dblJoker",  weight: 14 },
    { id: "ins",     emoji: "🛡️",  label: "Insurance",    kind: "insure",    weight: 12 },
  ],
};

// 🎤 HALFTIME SHOW BONUS — a live micro-bet that appears ONLY while the Final is
// at half-time (the extended 30-min concert break). The prop is built from the
// real first-half score the app is showing live: pick how the Final will be won
// (leader holds / comeback / extra time or pens). Locks when the 2nd half starts;
// right call = `points`, resolved automatically from the final result.
window.HALFTIME_PROP = {
  enabled: true,
  points: 6,
};

// ALL bonus cards carry into the knockout stage (through the final), each on the
// knockout's own fresh leaderboard: 🏅 Only-Winner (sole correct advancer),
// 🐺 Underdog (back the lower-ranked team to advance), 🤝 Perfect Pair (nail both
// ties kicking off simultaneously) and ⚽ Goal Rush (0 points but right total
// goals). Bonuses are flat — only the advancer + exact points get the round mult.

// Exact-score celebrations are AUTOMATIC: the notifier flags every exact-score
// win at full time (health/celebration in Firestore) and the app shows the
// fireworks + winners' names on open for one hour after the match. That is the
// ONLY announcement we want now — fired per game, then it expires on its own.
// This optional MANUAL override is OFF (null); leaving it set would also clobber
// the per-game celebration body, so keep it null.
window.ANNOUNCEMENT = null;

// First-open "how to bet the knockouts" walkthrough. Shows up to `repeat` times
// per device on open (a Skip still counts as one view) until `until`, then never
// again. Bump `id` to restart the count for everyone; set to null to switch off.
window.TUTORIAL = {
  id: "final-gamble-2026-07-19-x3",
  until: "2026-07-19T19:00:00Z",   // 22:00 Cairo — stops exactly at Final kickoff
  repeat: 3,                       // show up to 3 times per device, even if skipped
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
