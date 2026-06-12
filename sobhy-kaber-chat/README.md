# Zaki (زكي) — AI Dining Advisor for Sobhy Kaber, Sharm El Sheikh

**Zaki** is a fast, self-contained AI concierge chat widget for the Sobhy Kaber
restaurant website ([sobhykabersharm.com](https://sobhykabersharm.com)). The
name is a wordplay Egyptians will smile at: *Zaki* is a real Egyptian name that
sounds like both **زاكي** ("delicious") and **ذكي** ("smart") — exactly what a
restaurant advisor should be.

## Branding

Colors are **sampled directly from the official Sobhy Kaber logo**
(`assets/sobhy-kaber-logo.png` — the brick-red kebab sign with golden
lettering and the black skewer):

| Token | Value | Sampled from | Used for |
|---|---|---|---|
| `--zk-red` | `#b4483c` | Sign field (avg `#bc4e40`) | User bubbles, chips, send button, links |
| `--zk-red2` | `#c66746` | Sign gradient light end | Gradient partner for red surfaces |
| `--zk-reddark` | `#9c3c30` | Sign gradient dark end | Header, headings |
| `--zk-gold` | `#e5aa56` | "SOBHY KABER" letters | Accents, spark, typing dots, avatar ring |
| `--zk-golddark` | `#a8731f` | — (darkened for contrast) | Prices, portion lines on white |
| `--zk-cream` | `#faf3e9` | Logo cream text | Chat background |

All tokens live in one `:root` line at the top of the `CSS` block in
`zaki-widget.js`. The icon (`assets/zaki-icon.svg`) is a white chef's toque
with a gold spark on the logo's red sign gradient, ringed in gold. The demo
page hero displays the actual logo PNG.

## Real restaurant data (from sobhykabersharm.com, June 2026)

- **Location:** Old Market (the souk), facing Al Sahaba Mosque, Sharm El Sheikh
- **Reservations / WhatsApp:** +20 110 110 7542
- **Menu:** real items and EGP prices with the restaurant's portion system
  (¼ / ⅓ / ½ / kilo) — Kofta, Kebab, Tarb, Veal Cutlets (Neefa), Lamb Chops
  (Reesh), Shish Tawook, Sausage, Grilled/Stuffed Pigeon, Hawawshi, four Mixed
  Grill platters, and oven casseroles (Molokhia plain/with meat, Torly, Freekh)
- Desserts and drinks aren't published on the site, so Zaki answers those
  questions honestly ("rotate daily — ask the team") instead of inventing items
- Opening hours aren't published either; Zaki points guests to call/WhatsApp

Re-check prices after the restaurant updates its menu — they're all in the
`MENU` array in `zaki-widget.js`.

## What Zaki does

| Capability | How |
|---|---|
| 🍽️ **Menu advisor** | Recommends dishes from guest preferences — meat / chicken / pigeon, light, hearty, kids-friendly, budget, meat-free |
| 🧠 **Smart sales, never pushy** | One gentle pairing suggestion per recommendation (e.g. a molokhia casserole beside the kofta), a signature-dish nudge after booking |
| 📅 **Table booking** | Guided flow (name → guests → date → time → confirm) ending in a one-tap WhatsApp handoff to +20 110 110 7542 with a pre-filled reservation message |
| 🌍 **Bilingual** | Full English + Egyptian Arabic, auto-detected from the guest's typing, with proper RTL layout; manual toggle in the header |
| ⚡ **Instant** | The advisor engine runs 100% in the browser — replies in ~0.5 s with a natural typing animation. No backend, no API key, no cold starts |
| 📍 **Practical answers** | Address, Google Maps link, direct WhatsApp handoff to a human |

## Files

```
sobhy-kaber-chat/
├── index.html               # Demo / landing page with the widget installed
├── assets/
│   ├── zaki-widget.js       # The entire widget (CSS + UI + engine + data)
│   └── zaki-icon.svg        # Zaki's icon (favicon / branding use)
└── README.md
```

## Quick start

Open `sobhy-kaber-chat/index.html` in any browser — no build step needed.

## Install on Squarespace (or any site)

The widget is one script. Host `zaki-widget.js` somewhere public (GitHub
Pages, the Squarespace file manager, any CDN), then in Squarespace go to
**Settings → Advanced → Code Injection → Footer** and add:

```html
<script src="https://YOUR-HOST/zaki-widget.js" defer></script>
```

That's it — the floating chat button appears on every page.

## Customize (all in `zaki-widget.js`)

1. **`CONFIG` block (top of file)** — restaurant name, WhatsApp number,
   address, maps link, hours copy.
2. **`MENU` array** — each item has bilingual name/description, a base price,
   optional `portions` pricing string, a category (`grill | mixed | main`),
   preference `tags`, and an optional `pair` (the item Zaki softly suggests
   alongside it).
3. **Personality / copy** — all strings live in the `T` dictionary (`en` + `ar`).
4. **Colors** — the `:root` line at the top of the `CSS` block.

## Optional: upgrade to a real LLM

Set `CONFIG.aiEndpoint` to a backend URL that accepts
`POST { lang, messages: [{role, content}, …] }` and returns `{ reply: "…" }`
(e.g. a small serverless function calling the Claude API — never put an API
key in this client-side file). Zaki will use it for open-ended questions and
**automatically falls back to the instant local engine** if the endpoint is
slow (>6 s) or errors, so the chat never feels broken. The booking flow always
runs locally so reservations stay reliable.

## Notes

- The widget guards against double-loading (`window.__zakiLoaded`) and escapes
  all guest input before rendering.
