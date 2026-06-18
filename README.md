# Easy Move Car Rental — Sharm El Sheikh Landing Page

A high-conversion, mobile-first **"semi-app"** landing page for **Easy Move Car Rental**,
the 1st car rental destination in Sharm El Sheikh.

## ✨ Highlights

- **Sticky glass navbar** with scroll progress bar and mobile slide-in menu
- **Hero** with animated floating *Instant Quote* card and call-to-action buttons
- **Live WhatsApp booking flow** — both quote forms build a pre-filled message and open
  `wa.me/201006690316` in one tap (no backend needed)
- **Animated counters**, scroll-reveal animations and a scrolling benefits marquee
- **Services / call-outs**: Airport Meet & Greet, Full Insurance, Zero Hidden Fees,
  Flexible & Long-Term, 24/7 Support, Best Price Guarantee
- **Fleet showcase**: Economy, Sedan, SUV, 4x4, Luxury (with "Reserve" buttons that
  pre-select the car type in the booking form)
- **Why Us**, **How It Works (3 steps)**, **Reviews**, and a final **Booking** section
- **Floating WhatsApp button** with pulse animation
- Fully responsive, accessible, and self-contained (no build step, no dependencies)

## 📞 Business details used

- **Phone / WhatsApp / Viber:** +20 100 669 0316
- **Instagram:** [@easymove.rentacar](https://www.instagram.com/easymove.rentacar/)
- **Facebook:** [EasyMove Car Rental](https://www.facebook.com/61584094574471/)
- **Location:** Sharm El Sheikh, Egypt

> Update the `WHATSAPP` constant in `assets/js/app.js` and the `tel:`/`wa.me` links in
> `index.html` if the contact number changes. Indicative fleet prices live in `index.html`.

## 🗂 Structure

```
index.html              # page markup
assets/css/style.css    # all styles
assets/js/app.js         # interactivity + WhatsApp booking logic
worldcup/               # 🏆 Gang Cup 2026 — World Cup prediction game (see worldcup/README.md)
meta-ads-uploader/      # 🚀 Meta Ads Bulk Uploader (see meta-ads-uploader/README.md)
```

## 🏆 Gang Cup 2026

A private World Cup 2026 prediction game for the WhatsApp gang group lives in
[`worldcup/`](worldcup/) — live scores, automatic points, leaderboard and
one-tap WhatsApp updates. Setup guide: [`worldcup/README.md`](worldcup/README.md).

## 🚀 Meta Ads Bulk Uploader

A backend-free tool to bulk-publish Facebook + Instagram ads directly through
the Meta Marketing API lives in [`meta-ads-uploader/`](meta-ads-uploader/) —
drag-and-drop creatives, connect your live Meta account, pick a campaign + ad
set (or clone one), and launch dozens of ads at once. Setup guide:
[`meta-ads-uploader/README.md`](meta-ads-uploader/README.md).

## 🚀 Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
