# Connecting Zaki to nano-gpt on WordPress — step by step

This guide takes you from zero to a live, AI-powered Zaki on **sobhykabersharm** (WordPress).
You install **one plugin**, paste your nano-gpt key and model, and you're done. The plugin both
shows Zaki on the site **and** keeps your API key safe on the server (it is never visible to visitors).

If the AI is ever slow or unreachable, Zaki automatically falls back to its **free built-in engine**,
so the chat never breaks.

---

## Before you start

You need:
- A nano-gpt account with an API key (the screen in your screenshot, step 1 "Create API Key").
- Admin access to the WordPress dashboard (`sobhykabersharm.com/wp-admin`).

---

## Step 1 — Get your nano-gpt API key

1. In nano-gpt, click **Create API Key** and copy the key.
   In their cURL example it is the part after `Bearer ` — copy only that key, not the word "Bearer".
2. Decide which **model** to use. Open nano-gpt's model list and copy the exact model id.
   Good cheap, multilingual choices for a Sharm tourist crowd (Arabic + Russian + European):
   - a **Gemini Flash** id (best "just works"),
   - a **Qwen2.5** id (best value), or
   - `gpt-4o-mini` (safe and reliable).
   Keep this id handy — you'll paste it in Step 3. (If unsure, start with `gpt-4o-mini`.)

---

## Step 2 — Install the plugin

1. In WordPress: **Plugins → Add New → Upload Plugin**.
2. Choose the file **`zaki-ai.zip`** (provided with this guide) and click **Install Now**.
3. Click **Activate**.

That's it — Zaki's red chat button now appears on every page of the site, already working on its
free engine. The next steps switch on the smarter AI replies.

> Prefer not to use a zip? Upload the `zaki-ai` folder to `wp-content/plugins/` via FTP, then activate
> it from the Plugins screen. Same result.

---

## Step 3 — Connect your key and model

1. Go to **Settings → Zaki AI**.
2. Tick **Enable AI replies**.
3. Paste your nano-gpt **API key**.
4. In **Model**, paste the model id you chose in Step 1 (e.g. `gpt-4o-mini`).
5. Click **Save Changes**.

---

## Step 4 — Test it

1. Open `sobhykabersharm.com` in a normal browser tab.
2. Click the red **Zaki** button in the corner.
3. Ask something open-ended, e.g. *"what do you recommend for 4 people?"* or in Russian/German.
   - A written, conversational answer = the AI is connected. 🎉
   - A menu-card style answer = it fell back to the free engine (check the key/model in Step 3).

---

## How your key stays safe

- The key lives **only** on your WordPress server, inside the plugin settings.
- Visitors' browsers call **your own site** (`/wp-json/zaki/v1/chat`), never nano-gpt directly.
- The plugin adds your menu + Zaki's personality on the server, then calls nano-gpt with the key.
- For extra security you can instead put the key in `wp-config.php`:
  ```php
  define('ZAKI_NANOGPT_KEY', 'your-key-here');
  ```
  If you do that, leave the key field on the settings page blank — the constant always wins.

---

## Costs & safeguards

- Your menu is small, so each chat sends only a little text — typically a fraction of a cent per
  conversation on the cheap models above.
- The plugin caps each reply length and limits requests to **20 per minute per visitor** to prevent abuse.
- Turn the AI off any time by un-ticking **Enable AI replies** — Zaki keeps working for free.

---

## Updating the menu, offers, or hours later

The menu Zaki quotes to the AI lives in **`zaki-ai.php`** (the `zaki_ai_system_prompt` function).
To add appetisers, desserts, drinks, opening hours, or a seasonal offer, edit that text and re-save the
file (or send me the new items and I'll update it for you). The free built-in engine's menu lives in
`assets/zaki-widget.js`.
