# Zaki (زكي) — AI Dining Advisor for Sobhy Kaber, Sharm El Sheikh

**Zaki** is a fast, self-contained AI concierge chat widget for the Sobhy Kaber
restaurant website. The name is a wordplay Egyptians will smile at: *Zaki* is a
real Egyptian name that sounds like both **زاكي** ("delicious") and **ذكي**
("smart") — exactly what a restaurant advisor should be.

The icon is a chef's toque with a spark on an ember-orange badge
(`assets/zaki-icon.svg`), matching the charcoal-grill brand.

## What Zaki does

| Capability | How |
|---|---|
| 🍽️ **Menu advisor** | Recommends dishes from guest preferences — meat / chicken / seafood / vegetarian, spicy, light, hearty, kids-friendly, budget |
| 🧠 **Smart sales, never pushy** | One gentle pairing suggestion per recommendation (e.g. tahina with the mixed grill), a signature-dish nudge after booking — never a wall of upsells |
| 📅 **Table booking** | Guided flow (name → guests → date → time → confirm) ending in a one-tap WhatsApp handoff with a pre-filled reservation message |
| 🌍 **Bilingual** | Full English + Egyptian Arabic, auto-detected from the guest's typing, with proper RTL layout; manual toggle in the header |
| ⚡ **Instant** | The advisor engine runs 100% in the browser — replies in ~0.5 s with a natural typing animation. No backend, no API key, no cold starts |
| 📍 **Practical answers** | Hours, address, Google Maps link, direct WhatsApp handoff to a human |

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

Open `sobhy-kaber-chat/index.html` in any browser — no build step, no server
needed (a local server like `python3 -m http.server` is only needed for the
SVG favicon to load).

## Install on Squarespace (or any site)

The widget is one script. Host `zaki-widget.js` somewhere public (GitHub
Pages, the Squarespace file manager, any CDN), then in Squarespace go to
**Settings → Advanced → Code Injection → Footer** and add:

```html
<script src="https://YOUR-HOST/zaki-widget.js" defer></script>
```

That's it — the floating chat button appears on every page.

## Customize (all in `zaki-widget.js`)

1. **`CONFIG` block (top of file)** — ⚠️ set the real restaurant details:
   - `whatsappNumber` — currently a `201000000000` placeholder. Replace with
     the restaurant's WhatsApp number (country code, no `+`).
   - `hours`, `address`, `mapsUrl` — verify against the actual branch.
2. **`MENU` array** — the menu is sample data written in Sobhy Kaber's style.
   Replace names/prices with the real menu. Each item has bilingual
   name/description, a price, a category (`starter | grill | main | dessert |
   drink`), preference `tags`, and an optional `pair` (the item Zaki softly
   suggests alongside it).
3. **Personality / copy** — all strings live in the `T` dictionary (`en` + `ar`).

## Optional: upgrade to a real LLM

Set `CONFIG.aiEndpoint` to a backend URL that accepts
`POST { lang, messages: [{role, content}, …] }` and returns `{ reply: "…" }`
(e.g. a small serverless function calling the Claude API — never put an API
key in this client-side file). Zaki will use it for open-ended questions and
**automatically falls back to the instant local engine** if the endpoint is
slow (>6 s) or errors, so the chat never feels broken. The booking flow always
runs locally so reservations stay reliable.

## Notes

- Menu items, prices, hours and address are **placeholders** pending the real
  branch details — flagged inline with TODOs where critical.
- The widget guards against double-loading (`window.__zakiLoaded`) and escapes
  all guest input before rendering.
