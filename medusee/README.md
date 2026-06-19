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
Designed in the same clean, airy "link-hub" style as the sharmsites.com reference,
restyled in a Red Sea aqua/teal palette:
- **Logo** + name "Medusee Excursions" / "Meduse Water Sport Club" / "Your adventure — our sea"
- **Trust pills**: Sharm El Sheikh · 20 Years Experience
- **Feature cards**: Free Hotel Pickup · 10% Online Discount (code 22TOURS10)
- **GET IN TOUCH**: WhatsApp `+20 109 880 0394`, Website, Email — white cards with chevrons
- **WHAT WE OFFER**: Parasailing · Water Sports · Banana Boat · Sofa Boat · Glass Boat · Sea Trips
- **FOLLOW US**: Instagram, a second Instagram (icon only, no label), Facebook
- **FIND US**: "Open in Google Maps" location card (taps through to your exact pin)
- **Thank-you footer** with 5 stars
- Location: Sharm El Sheikh, Egypt

## Add your logo
The page ships with a placeholder. To show the real logo:
1. WordPress → **Media** → **Add New** → upload the logo → copy its **File URL**.
2. In the HTML, replace `LOGO_URL_HERE` with that URL.

Until you do, a drawn jellyfish (méduse) mark shows automatically as a fallback.

## Map
The **FIND US** card opens your exact Google Maps location
(`https://maps.app.goo.gl/NpXAXWCQks6cybZV9`) in one tap. To change it, edit that
`href`. (A live embedded map was removed — the keyless Google embed rendered as a
blank box, and the tap-through card is more reliable.)

## Editing later
Open the HTML and change the values marked in the links:
- WhatsApp number lives in the `wa.me/201098800394` link (digits only, country code first).
- Swap any URL/email/text directly in the matching `<a href="...">`.
