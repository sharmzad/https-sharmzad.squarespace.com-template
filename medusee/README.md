# Medusee Excursions — QR Landing / Link Hub

A simple, mobile-first "linktree-style" page for QR codes placed on site. One tap
takes guests to WhatsApp reservations, the website, email and the social profiles.

## Files
- **`wordpress-custom-html.html`** — paste-ready block for WordPress (recommended).
- **`index.html`** — full standalone page (host anywhere / point the QR at it).

## How to add it in WordPress (Custom HTML block)
1. Pages → **Add New** → give it a title (e.g. *Contact / Reservations*).
2. Click **+** → search **Custom HTML** → add the block.
3. Open `wordpress-custom-html.html`, copy **everything**, paste into the block.
4. **Publish**, then point your QR code at that page's URL.

> The CSS is scoped under `.medusee-lp`, so it will not affect the rest of your
> theme. For a clean full-screen look, use a blank/canvas page template if your
> theme offers one.

## What's on the page
- **WhatsApp Reservation** (main button) → `+20 109 880 0394` (pre-filled message)
- **Website** → https://meduseexcursions.com
- **Email** → beheryahmed75@gmail.com
- **Instagram** (two profiles, second shown as an icon only)
- **Facebook** → https://www.facebook.com/medusesport/
- Promo badge: code **22TOURS10** for 10% off
- Location: Sharm El Sheikh, Egypt

## Editing later
Open the HTML and change the values marked in the links:
- WhatsApp number lives in the `wa.me/201098800394` link (digits only, country code first).
- Swap any URL/email/text directly in the matching `<a href="...">`.
