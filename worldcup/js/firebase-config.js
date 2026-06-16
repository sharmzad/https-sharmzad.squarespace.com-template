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
  appId: "1:618744827340:web:4d74f6a8af830ae0f92169"
};

// Maximum number of players allowed to join
window.MAX_PLAYERS = 40;

// Manual point adjustments, added to the leaderboard totals.
// "*" applies to every player without an explicit entry.
// Grace: +2 to everyone who couldn't bet on the first match (Alaa earned his).
window.BONUS_POINTS = { "*": 2, "Alaa": 0 };

// Web push notifications (Firebase Cloud Messaging).
window.VAPID_KEY = "BJeCjL3Ge6h9UzWfSzM0hFIgO5EBvwdyY2ADVkBjwqXfdyQfBA4304ljAFb1hDx-pYcEFjXtoR6B3HIELHgG11o";

// Clean public link used in WhatsApp invite/share messages.
window.APP_LINK = "https://tinyurl.com/El3eshaWC26";

// Exact-score celebrations are now AUTOMATIC: the notifier flags every
// exact-score win at full time (health/celebration in Firestore) and the app
// shows the fireworks + winners' names on open for one hour after the match.
// This is an optional MANUAL override for a custom announcement (null = off).
window.ANNOUNCEMENT = null;

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
