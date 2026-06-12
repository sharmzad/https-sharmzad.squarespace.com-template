# 🏆 Gang Cup 2026 — World Cup Prediction Game

A private World Cup 2026 score-prediction game for your WhatsApp group (6–10 players).
Everything runs on **free services** — no servers, no costs.

**Live app (after merging to `master`):**
`https://sharmzad.github.io/https-sharmzad.squarespace.com-template/worldcup/`

---

## 🎯 How the game works

| Rule | Detail |
|---|---|
| Predictions | **Two per match**: who wins (1X2) **and** the exact final score |
| 🔒 Lock | Betting closes **60 minutes before kickoff** (enforced by server timestamps). Launch day (June 12, 2026) only: open until 5 min after kickoff |
| ✅ Correct winner/draw pick | **2 points** |
| 🎯 Exact final score | **+5 points bonus** |
| 👑 Both right | **7 points** max per match |
| ❌ Wrong | 0 points 😅 |
| Reveal | Everyone's picks are hidden until lock time, then shown |
| Live scores | Auto-refresh every 60 seconds during matches |
| Tiebreakers | Most exact scores 🎯, then most correct results |
| Knockout games | Score **after extra time** counts (shootouts excluded) |

## 🧩 What powers it (all free)

- **Live & final scores:** ESPN public scoreboard API — free, no API key, no signup,
  works directly from the browser. Only current/final results are used, exactly as requested.
- **Shared predictions & players:** Firebase Firestore **Spark (free) plan** — way more
  than enough for 10 friends for a whole tournament.
- **Hosting:** your existing GitHub Pages site.
- **WhatsApp:** one-tap share buttons that generate beautiful formatted messages.

---

## ⚙️ Setup (one time, ~5 minutes)

### 1. Create the free Firebase database

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   (e.g. `gang-cup-2026`). Disable Analytics — not needed.
2. In the project: **Build → Firestore Database → Create database** → choose
   **Start in production mode** → pick a region (e.g. `eur3`).
3. Open the **Rules** tab and paste:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /players/{id} {
         allow read, create: if true;
       }
       match /predictions/{id} {
         allow read: if true;
         // server timestamp required, so the lock check can't be faked
         allow create, update: if request.resource.data.updatedAt == request.time;
       }
     }
   }
   ```

   Click **Publish**.
4. Back on the project overview, click the **`</>` (Web)** icon → register an app
   (no hosting needed) → copy the `firebaseConfig` object it shows you.

### 2. Paste the config into the app

Edit [`js/firebase-config.js`](js/firebase-config.js):

```js
window.GROUP_CODE = "GANG2026";   // ← change this! Your gang's secret join code

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",            // ← paste YOUR values here
  authDomain: "gang-cup-2026.firebaseapp.com",
  projectId: "gang-cup-2026",
  storageBucket: "gang-cup-2026.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

Commit & push — GitHub Pages redeploys automatically.

> ℹ️ The Firebase web config is **not a secret** (it's public in every Firebase web app);
> the security rules + your group code are what keep randoms out.

### 3. Invite the gang

Open the app → **📲 WhatsApp tab → Invite link → Share on WhatsApp**.
Each friend joins with the group code, their name, and a 4-digit PIN
(the PIN lets them log in from any device and stops teammates editing each other's picks 😄).

---

## 📲 Sending updates to the WhatsApp group

The **WhatsApp tab** has one-tap buttons that open WhatsApp with a ready-made message:

- **📅 Today's matches** — fixtures + kickoff times + when betting closes
- **🔴 Live & results** — current live scores and today's finished matches
- **🏅 Leaderboard** — standings with 🥇🥈🥉 medals

Tap → pick the gang group → send. Two seconds.

### Optional: fully automatic messages

WhatsApp has no free official way to post into a group automatically, but two decent options:

1. **CallMeBot** (free, personal use): each player activates it once, then a simple
   `GET https://api.callmebot.com/whatsapp.php?phone=...&text=...&apikey=...` sends them a
   WhatsApp message. You could trigger it from a free [cron-job.org](https://cron-job.org) job.
2. **WhatsApp Cloud API** (Meta, official): free tier exists but requires a Meta business
   account + can only message individuals who opted in — overkill for 8 friends.

Honestly: the one-tap share buttons are the sweet spot — zero setup, and the daily
"place your bets!" message coming from a real human keeps the banter alive 😁

---

## 🔧 Notes & maintenance

- **Scores API:** `site.api.espn.com/.../soccer/fifa.world/scoreboard?dates=20260611-20260719`.
  If ESPN ever changes things, [football-data.org](https://www.football-data.org) has a free
  tier that covers the World Cup (needs a free API key + a tiny proxy for CORS).
- **Remove a player / fix a typo:** Firebase console → Firestore → `players` collection.
- **Anti-cheat:** predictions are stamped with Firestore *server* time; anything saved after
  lock time is marked **late ⛔** and scores 0. Picks are hidden in the UI until lock.
- **Scoring config:** tweak `POINTS` and `LOCK_MINUTES` at the top of [`js/app.js`](js/app.js).
