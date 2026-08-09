# Deploy to Bluehost (sharmzad.com)

Static site — no PHP, no database. Just copy the files into your public directory.

## Files to upload

```
sharmzad.com/
├─ index.html           # hub landing (2 cards → Tours / Diving)
├─ tours.html           # one-shot tours (Combo 80€ + 6 experiences)
├─ diving.html          # 5 Repack packages (3 Sharm + 2 Wadi Lahami) + info
├─ assets/
│  ├─ site.css
│  └─ site.js
├─ images/              # all authentic Sharmzad photos (~1.5 MB)
├─ qr-sharmzad.svg      # standalone QR code for print/handouts
└─ favicon.ico          # (optional, add later)
```

Skip these — they were sources for the standalone PDF flyer:
`brochure.html`, `flyer.html`, `sharmzad-flyer.pdf`, `script.js`, `styles.css`

---

## Option A — cPanel File Manager (easiest, no software)

1. Login to **bluehost.com** → **Advanced** → **File Manager**
2. Open `public_html/` (that's your `sharmzad.com` root)
3. Click **Upload** — select the three HTML files, the `assets/` folder, the `images/` folder, and `qr-sharmzad.svg`
4. Open `sharmzad.com` in a browser — done.

To upload folders, zip locally first, upload the zip, then right-click → **Extract**.

## Option B — FTP (bulk upload)

1. In cPanel → **FTP Accounts** — create one or use your main account
2. Use FileZilla / Cyberduck / Transmit with these settings:
   - Host: `ftp.sharmzad.com` (or IP from cPanel)
   - Username / password from step 1
   - Port `21` (or `22` for SFTP)
3. Drag the whole project directory contents into `/public_html/`

## Option C — Git deploy (if your Bluehost plan allows SSH)

```bash
ssh you@sharmzad.com
cd public_html
git clone -b claude/sharmzad-landing-page-italian-xI290 https://github.com/sharmzad/https-sharmzad.squarespace.com-template.git .
```

Later updates: `git pull`.

---

## Repack Travel images

`diving.html` currently **hotlinks** the 5 package images directly from
`repacktravelmktg.com`. Two options for the long term:

### Keep hotlinking (works today, no extra step)
Nothing to do. When a visitor opens `sharmzad.com/diving.html`, their
browser fetches the images straight from Repack's server. As long as
both sites are yours and you don't disable hotlink protection on
Repack, this is fine.

### Self-host on sharmzad.com (recommended eventually)
Run this **once from your PC** (needs `curl` and `bash`):

```bash
mkdir -p images/repack && cd images/repack
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/Sharm-El-Sheikh-Trips-pack-9-600x600.jpg
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/Main-Home-2-600x600.jpeg
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/DSC09760-600x600.jpg
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/51204456163_dd3fd31de1_b-600x600.jpg
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/51204440253_f01cb7b087_b-600x600.jpg
curl -O https://repacktravelmktg.com/wp-content/uploads/2024/05/Marsa-Alam-diving-packages-1.jpg
```

Then find-and-replace every `https://repacktravelmktg.com/wp-content/uploads/2024/05/`
in `diving.html` with `images/repack/`.

---

## Redirect the Squarespace domain

If you're keeping the Squarespace subdomain
(`https-sharmzad.squarespace.com`) alongside `sharmzad.com`:
- **Preferred:** in Squarespace, set the primary domain to `sharmzad.com` so
  everything redirects to your Bluehost site.
- Or add a 301 redirect in Squarespace pointing to
  `https://www.sharmzad.com`.

## HTTPS

Bluehost auto-provisions Let's Encrypt SSL. Enable **Force HTTPS** in
cPanel → **SSL/TLS Status**.

## Cache

Add a `.htaccess` in `public_html/` for browser caching:

```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
    ExpiresByType text/css "access plus 1 week"
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType text/html "access plus 1 hour"
</IfModule>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml
</IfModule>
```

## Contact form

The booking form on `tours.html` and `diving.html` opens WhatsApp with a
pre-filled message — no backend needed. Works on Bluehost, GitHub Pages,
Netlify, or any static host.
