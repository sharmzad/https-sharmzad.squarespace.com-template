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
index.html               # car-rental landing page markup
assets/css/style.css     # car-rental styles
assets/js/app.js         # car-rental interactivity + WhatsApp booking logic

measure.html             # 👣 Shoe Size Scanner — measure feet with the phone camera
assets/css/measure.css   # scanner styles
assets/js/measure.js     # scanner logic (card-reference measurement + EU sizing)
```

## 👣 Shoe Size Scanner

A self-contained, mobile-first tool that finds a shopper's **EU shoe size** from a
phone photo — no backend, no dependencies, and the photo never leaves the device.

**How it works:** the customer places a standard **bank/credit card**
(ISO/IEC 7810 ID-1, long edge = 85.60 mm) flat on the floor beside their bare foot
and shoots from directly above. They drag two markers onto the card's long edge to
calibrate the **pixels → millimetres** scale, then drag two markers to their **heel**
and **longest toe**. The measured foot length is converted to an EU size using the
Paris-point system (`EU = (footLength_mm + 16.7) / 6.667`), with UK / US (M & W)
estimates shown for reference.

> Tune the toe ease (`TOE_ALLOWANCE_MM`) or card constant (`CARD_LONG_MM`) in
> `assets/js/measure.js` if you need to match a specific brand's last.

### Embed it in an e-commerce store

Host the folder and drop the scanner into any product/size-guide page via an iframe
(e.g. a Squarespace **Code** block):

```html
<iframe src="https://YOUR-DOMAIN/measure.html"
        style="width:100%;height:1200px;border:0" loading="lazy"
        allow="camera"></iframe>
```

## 🚀 Run locally

Open `index.html` (or `measure.html`) in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/measure.html
```

> The camera capture works over `https://` or `http://localhost`. Some mobile
> browsers require a secure (HTTPS) origin to open the camera.
