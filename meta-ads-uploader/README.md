# 🚀 Meta Ads Bulk Uploader

Publish **dozens of Facebook + Instagram ads in minutes**, straight through the
Meta Marketing API. Drag and drop your creatives, connect your live Meta
account, pick a campaign + ad set, and launch the whole batch in one shot.

- **No backend.** A single static page that calls `graph.facebook.com` directly.
- **No subscription.** A free alternative to the $99/month bulk-upload SaaS tools.
- **No more one-by-one clicking** in Ads Manager.

> ⚠️ **This is a real publishing tool.** With an `ACTIVE` status it creates live
> ads that can spend money. Start with **Paused** until you trust your setup.

---

## What it does

| Feature | Detail |
|---|---|
| Drag & drop | Dozens of images **and** videos at once |
| Multi-copy | Multiple primary texts, headlines & descriptions per batch (cycled across ads) |
| Live account | Pulls your ad accounts, Pages, Instagram accounts, campaigns & ad sets |
| Clone ad set | Duplicate a winning ad set with one click |
| Full creative control | Custom video thumbnails, CTA button, ad-name template, Standard Enhancements |
| Safe launch | Publish **Paused** or **Active** |

---

## Run it

It's a static site — no build step.

```bash
cd meta-ads-uploader
python3 -m http.server 8000
# open http://localhost:8000
```

Or just host the `meta-ads-uploader/` folder on GitHub Pages / any static host
and open `index.html`.

---

## Getting an access token

You need a token with the **`ads_management`** permission (plus `ads_read`,
`pages_show_list`, `pages_read_engagement`, `business_management`,
`instagram_basic`).

**Fastest way (Graph API Explorer):**

1. Go to **[developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)**.
2. Pick your app (create a basic "Business" app first if you don't have one).
3. Under **Permissions**, add: `ads_management`, `ads_read`, `pages_show_list`,
   `pages_read_engagement`, `business_management`, `instagram_basic`.
4. Click **Generate Access Token** and approve.
5. Copy the token into the app's **Access token** field.

Short-lived tokens expire in ~1–2 hours. For something longer-lived, exchange it
for a long-lived token or use a **System User token** from
**Business Settings → Users → System Users** (recommended for repeated use).

> 🔒 **Your token stays in your browser.** It's used only for direct requests to
> `graph.facebook.com`. "Remember token" saves it to this browser's
> `localStorage` — leave it unchecked on shared machines.

---

## How a batch is built

For each creative you drop, the tool:

1. Uploads the media (`/act_<id>/adimages` or `/advideos`, waiting for video
   processing to finish).
2. Builds an **ad creative** (`/adcreatives`) with your Page identity, optional
   Instagram identity, copy, CTA, thumbnail and Standard Enhancements setting.
3. Creates the **ad** (`/ads`) in your chosen ad set with your selected status.

Copy variations are **cycled**: ad #1 uses the 1st primary text/headline/
description, ad #2 the 2nd, and so on (wrapping around). One creative → one ad —
ideal for high-volume creative testing.

**Ad-name tokens:** `{date}` `{n}` `{file}` `{adset}`.

---

## Notes & limits

- Calls run in your browser. The Graph API supports CORS for these endpoints, so
  no proxy is required.
- Large video batches take time — each video must finish Meta-side processing
  before its ad can be created. Progress is shown per item in the log.
- The campaign objective must support the ad/creative type you're uploading
  (e.g. don't push a website-link creative into an engagement-only ad set).
- API version is configurable at the top of the page (default `v23.0`); bump it
  if Meta deprecates a version.

Built 100% in Claude Code.
