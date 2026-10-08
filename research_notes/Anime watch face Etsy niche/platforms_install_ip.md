# Alternative Watch-Face Marketplaces, Redmi Watch 5 Lite Install Constraints, and Anime-Art IP Risk (2024–2026)

Research date: 2026-10-08. Note: several fetches failed with DNS errors (developer.samsung.com, forum.developer.samsung.com, codeberg.org/gadgetbridge.org, valueaddedresource.net). Some findings below therefore rest on search-result snippets rather than full page reads. Each one says so.

## Q1. Samsung Galaxy Store (Watch Face Studio): fees, seller requirements, countries (incl. Egypt), earnings

### Takeaway
For international sellers, Galaxy Store is no longer a real channel for Galaxy Watch faces. Tizen distribution is discontinued, and Wear OS faces built in Watch Face Studio are sold through Google Play outside China. Selling paid faces on Galaxy Store needs "commercial seller" status, which people report is slow and inconsistent to get. I found no official revenue split and no country list (including Egypt).

### Cited Findings
- Samsung's developer pages carry the banner "Distribution of Tizen-based watch apps has been discontinued." — [Samsung Developer](https://developer.samsung.com/galaxy-watch/design/watch-designer/gear-watch-dev-trial)
- Samsung Developer Relations, on the forum: for most of the world, apps for Wear OS powered by Samsung are distributed on Play Store. If you choose an Android-based watch in Seller Portal, "only China is enabled as a selling country." This is a forum statement, not formal policy (from a search snippet). — [Samsung forum](https://forum.developer.samsung.com/t/wear-os-watch-faces-on-samsung-galaxy-store/15017)
- Paid watch faces on Galaxy Store require commercial-seller status, covered in a separate "Commercial Seller Request Guide." — [Samsung blog, Try and Buy](https://developer.samsung.com/sdp/blog/en/2020/04/29/galaxy-watch-face-try-and-buy)
- Onboarding goes Samsung account → Seller Portal → commercial seller application. The Seller Portal country must match the country of your bank. Changing country means deleting the Seller Portal account and registering again. — [Samsung: Galaxy Store prepare](https://developer.samsung.com/galaxy-store/prepare.html); [Samsung forum](https://forum.developer.samsung.com/t/upload-an-android-app-game-as-a-private-seller/41239)
- A third-party onboarding guide says commercial seller status requires a D-U-N-S number plus bank or PayPal details. — [RevenueCat docs](https://www.revenuecat.com/docs/platform-resources/galaxy-platform-resources/galaxy-store-onboarding)
- Paid services are available in "over 120" countries. Local payment methods are excluded in several Middle Eastern countries. The authoritative country list is inside Seller Portal. — [Samsung IAP FAQ](https://developer.samsung.com/iap/faq.html)
- Anecdote: a seller says commercial-seller applications "always get rejected – almost always without an email notification or a reason." — [Samsung forum](https://forum.developer.samsung.com/t/my-frustrations-with-seller-office-commercial-seller-status-and-1-1-support-from-samsung/5439)
- There is a forum thread titled "Sales are very low" about Galaxy Store watch-face sales. I could not load its contents. — [Samsung forum](https://forum.developer.samsung.com/t/sales-are-very-low/8457)

### Inferences
- An Egypt-based designer making Wear OS faces in Watch Face Studio should treat Google Play as the actual storefront. Galaxy Store matters mainly for China.
- The D-U-N-S requirement plus the bank/country match is a real hurdle for an individual in Egypt.

### Gaps
- Galaxy Store revenue share. My unverified recollection is a 70/30 split, but I found no 2024–2026 source.
- Whether Egypt is an eligible commercial-seller country.
- Typical Galaxy Store prices and earnings in 2024–2026. The forum pages could not be fetched.

## Q2. Google Play watch faces (Wear OS, WFF, $25 fee, 15%/30%)

### Takeaway
Since January 2025, new Play watch faces must use Watch Face Format. Since January 14, 2026, Play will not install or monetize legacy faces at all. WFF is required on all Wear OS devices, and Watch Face Studio 1.8.7+ produces compliant bundles. Google's fee is 15% on the first $1M a year (enrolment in that tier is required) and 30% above that. Public data on indie earnings is essentially absent.

### Cited Findings
- From January 14, 2026, users cannot install legacy (AndroidX/Wearable Support Library) watch faces from Play on any Wear OS device. Developers cannot update or monetize them, and existing subscriptions will not renew. Faces already installed keep working. Watch Face Studio users had to resubmit with WFS 1.8.7 or later and remove old bundles from every track. — [Android Developers Blog, June 2025](https://android-developers.googleblog.com/2025/06/upcoming-changes-to-wear-os-watch-faces.html?m=1); [9to5Google](https://9to5google.com/2025/06/12/wear-os-legacy-watch-face/)
- "As of January 2026, the Watch Face Format is required for installing watch faces on all Wear OS devices." — [Android Developers: WFF](https://developer.android.com/training/wearables/wff)
- New watch faces have had to use WFF since January 2025. Sources disagree on the exact day; Google's post gives January 27, 2025. — [9to5Google](https://9to5google.com/2025/06/12/wear-os-legacy-watch-face/); [Android Developers Blog](https://android-developers.googleblog.com/2025/06/upcoming-changes-to-wear-os-watch-faces.html?m=1)
- Service fee: 15% on the first $1M (USD) a developer earns each year, 30% above $1M, and 15% on auto-renewing subscriptions. The 15% tier requires a payments profile, an account group, and accepting the tier's terms. — [Play Console Help: service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en); [Play Console Help: 15% tier enrolment](https://support.google.com/googleplay/android-developer/answer/10632485?hl=en-AU)
- On AppBrain, watch-face developers publish large catalogs. One has 167 apps, all in "Personalization," which suggests a volume strategy. AppBrain shows downloads, not revenue. — [AppBrain: Singular Dials](https://www.appbrain.com/dev/Singular+Dials+watchfaces/)

### Inferences
- The WFF mandate made Watch Face Studio (free, WFF output) the default indie toolchain. It also removed many old faces, which may have opened space for new listings.
- Play's 15% tier makes it cheaper than Etsy plus a third-party install path, but the product must be a Wear OS face. It cannot reach Redmi or Mi Fitness watches.

### Gaps
- I did not verify the $25 one-time registration fee in this session (it is widely known, but not re-sourced here). I also found nothing on Egypt merchant-account or payout availability.
- I found no credible, sourced figures for typical downloads or monthly revenue of indie Wear OS face designers. Reddit returned nothing.
- Newer Play rules for personal accounts (12 testers for 14 days before production) were not researched.

## Q3. Other channels: Facer, Gumroad/Ko-fi, Zepp/Amazfit, Xiaomi designer program, Huawei Themes, Garmin Connect IQ

### Takeaway
Facer pays creators through an invite-only Partner tier with an unpublished revenue split. Garmin added paid faces in August 2024, with a $4.99 suggested price. Zepp/Amazfit has a store of 6,000+ faces with free and paid ones, but I found no designer revenue terms. I found no public, internationally open Xiaomi designer program for the Mi Fitness store. Huawei Themes, Gumroad, and Ko-fi were not covered with sources this session.

### Cited Findings
- **Facer:** creators earn when users sync paid faces through Facer Premium or buy them individually. Earnings are calculated monthly. The Creator Partner tier, formerly the "Premium Designer Program," is invite-only and quality-reviewed. The lower tiers are Facer Creator (free) and Creator Pro. — [Facer Creator Partner](https://www.facer.io/creator/partner); [Facer news, $1M payouts](https://news.facer.io/celebrating-1-million-in-designer-payouts-and-launching-our-first-facer-creator-partner-program/)
- Facer has passed $1M in total designer payouts (c. 2021). Facer says "a number of them are generating thousands of dollars in revenue every month." In 2025 it said "a lot of our top designers quit their day jobs." These are platform claims. — [Facer news](https://news.facer.io/celebrating-1-million-in-designer-payouts-and-launching-our-first-facer-creator-partner-program/); [Facer community, 2025 Awards](https://community.facer.io/t/2025-facer-awards-winners-announced-and-an-invite-to-designers/102394)
- Facer designers on the forum say the revenue-share terms are not published. — [Facer community thread](https://community.facer.io/t/premium-designer-program-admission-rankings-and-revenue-sharing-terms/25147)
- **Garmin Connect IQ:** paid apps and faces have been purchasable via Garmin Pay since August 2024, "to reward third-party developers." The suggested price for premium faces is reported as $4.99. Garmin's commission was not found. — [the5krunner](https://the5krunner.com/2024/08/07/garmin-connect-iq-store-allows-paid-for-apps-using-garmin-pay/); [Advnture](https://www.advnture.com/news/garmin-launches-paid-for-apps-watch-faces-disney-marvel); [Garmin PR via Seeking Alpha](https://seekingalpha.com/pr/19808336-garmin-enables-premium-app-purchases-in-the-connect-iq-store-and-unveils-fun-new-watch-faces)
- **Zepp/Amazfit:** more than 6,000 watch faces in the Zepp app, some free and some paid, with over 72 million downloads (March 2025). Zepp provides a Watch Face Maker tool with QR-code install for previewing on a real device. — [Alimarket (ES)](https://www.alimarket.es/electro/noticia/r549403/amazfit-revela-las-esferas-de-reloj-favoritas-de-sus-usuarios); [Zepp docs: watchface tools](https://docs.zepp.com/docs/guides/tools/watchface/overview/)
- **Xiaomi:** official FAQs describe a "market" of more than 200 online faces inside Mi Fitness for the Redmi Watch 5 Lite. They do not say who makes these faces or how designers can submit. The search found only Xiaomi's internal Wearable Design Team. — [Mi.com FAQ](https://www.mi.com/global/support/faq/details/KA-485425/); [Red Dot: Xiaomi Wearable Design Team](https://red-dot.org/siegerprofile/xiaomi-wearable-design-team)
- The EasyFace README tells face creators to contact @mi_watch_int on Telegram to be added to the community database. That is an unofficial community channel, not a Xiaomi program. — [m0tral/EasyFace GitHub](https://github.com/m0tral/EasyFace)

### Inferences
- An independent designer has no sanctioned, paid storefront that reaches Redmi Watch 5 Lite owners directly. That gap is why Etsy plus a manual install guide exists as a niche.
- Facer and Wear OS/Play are the most established paid channels for indie designers. Garmin is an option for a higher-priced, fitness-oriented audience.

### Gaps
- Huawei Themes designer program terms, Zepp designer revenue share, Garmin commission, and Gumroad/Ko-fi fees were not verified this session.
- Whether Xiaomi runs a designer program in China (for example through a Xiaomi theme or designer portal) and whether it accepts international designers. No evidence found either way.

## Q4. Redmi Watch 5 Lite / 5 Active: OS, third-party install paths, popularity

### Takeaway
The Redmi Watch 5 Lite runs Xiaomi HyperOS, an RTOS-class system on a SiFli SF32LB523 chip, not Wear OS. The only official way to get faces is the Mi Fitness cloud catalog of 200+ faces, plus a photo-background "Custom" face. The only third-party route found is unofficial: build faces in m0tral's Windows-only EasyFace editor, then install them through a modded Android-only Mi Fitness app. That app is distributed through a Telegram chat, and access to the online face database is tied to the watch's MAC address and granted manually by an admin. I found no evidence of Gadgetbridge, Zepp, or Notify support for loading faces on this model. Xiaomi was the No. 2 to No. 3 wrist-worn vendor in 2025, at roughly 19% share.

### Cited Findings
- The Redmi Watch 5 Lite runs Xiaomi HyperOS. Launch coverage cites over 200 cloud faces, more than 50 of them customizable and 30 designed for AOD. (Seen in a search snippet; the page was not fetched in full.) — [GSMArena](https://m.gsmarena.com/redmi_watch_5_lite_features_price_sale_date-amp-64681.php)
- The launch price was about $50 (Sept 2024). — [ProPakistani](https://propakistani.pk/2024/09/25/redmi-watch-5-lite-costs-50-with-display-upgrades-and-more/amp/)
- Xiaomi's FAQ lists the platform as the SF32LB523 chip. — [Mi.com Product Overview](https://www.mi.com/global/support/faq/details/KA-483618/)
- Official path: the watch comes with 3 preset faces, and "more than 200 online watch faces can be downloaded and applied" in Mi Fitness via Device → Manage watch faces. A Custom/photo-background face is supported. — [Mi.com FAQ KA-485425](https://www.mi.com/global/support/faq/details/KA-485425/); [Mi.com FAQ KA-485427](https://www.mi.com/uk/support/faq/details/KA-485427/)
- Redmi Watch 5 Active: 200+ market faces and 3 preinstalled. Users can add up to 3 more cloud faces via Mi Fitness, and it supports a custom background. — [Mi.com FAQ KA-484712](https://www.mi.com/global/support/faq/details/KA-484712/); [Mi.com FAQ KA-484713](https://www.mi.com/uk/support/faq/details/KA-484713/)
- **EasyFace (m0tral):** described as a "Xiaomi watchfaces editor." Models released after 2021, including "Redmi Watch 5 Active/Lite," 5, and 6 (the Russian section also mentions Redmi Watch 7 and Mi Band 11), need replacement files from the release archive. Setup is Windows-only: EasyFace_setup.msi, the VS2015 x86 redistributable, then run easyface_en.exe as administrator. The compiler pushes faces to an emulator. — [m0tral/EasyFace GitHub](https://github.com/m0tral/EasyFace)
- **Installing on the watch (EasyFace README):** "install latest version of MiFitness mod application (apk, under Android only)," obtained with the #latestapp command in the Telegram chat t.me/mi_watch_int (news channel t.me/mi_watch_news). The user then opens the online watchface list and installs a face. "Access to the online watchface database is restricted by watch MAC address," granted by sending the MAC to a chat admin. Adding editors to the database is manual. The GitHub Releases section was empty when I fetched it. — [m0tral/EasyFace GitHub](https://github.com/m0tral/EasyFace)
- Gadgetbridge: three searches found no source confirming Gadgetbridge support (pairing or face upload) for the Redmi Watch 5 Lite or 5 Active. The Gadgetbridge wiki could not be reached because of DNS failure. — (no source; see Gaps)
- **Market size:** IDC reports Xiaomi shipped 8.7M wrist-worn units in Q1 2025 (19.0% share, up from 6.1M and 14.7%), behind Huawei at 10.0M and 21.9%. — [IDC press release, June 2025](https://www.idc.com/resource-center/press-releases/idc-global-wrist-worn-device-shipments-grew-10-5-in-q1-2025/)
- Q2 2025: Xiaomi shipped 9.5M (+61% YoY) against Huawei's 9.9M and Apple's 7.4M, in a market of 49.2M. My arithmetic gives Xiaomi about 19%. Some coverage misattributes the 2024 shares to 2025. — [iThinkDiff](https://www.ithinkdiff.com/apple-watch-q2-2025-market-share/); [9to5Mac](https://9to5mac.com/?p=1018994)
- Full-year 2025: wristbands grew 14.7%, "largely driven by Xiaomi." Huawei shipped 25.5M smartwatches. Xiaomi was the fastest-growing top-5 smartwatch vendor in the first three quarters of 2025. — [IDC wearable vendor results 2025](https://www.idc.com/promo/wearablevendor/vendor)

### Inferences
- Buyers of a Redmi Watch 5 Lite face from Etsy cannot install a file directly with official tools. They need Android plus the modded Mi Fitness, and possibly MAC-gated database access. iPhone users appear to be locked out, since the mod is Android-only. Expect high buyer friction, support load, and refund or complaint risk.
- A modded Mi Fitness APK from Telegram carries security and account risk. A seller who tells buyers to install it may face Etsy complaints, and Xiaomi app updates may break it.
- An EasyFace face is probably distributed as a compiled watch-face binary (.bin) pushed by the modded app. This is unconfirmed; the README does not mention .bin.
- No sales figure for the Redmi Watch 5 Lite specifically was found. Xiaomi's roughly 9M wrist-worn units per quarter (mostly bands) suggest a large but price-sensitive base, consistent with a $50 watch.

### Gaps
- Model-specific confirmation that EasyFace-built faces install on the 5 Lite (it is only grouped under "Active/Lite"). Current status of the modded Mi Fitness after 2025–2026 app or firmware updates.
- Whether the Telegram database actually allows sideloading a user-supplied face file, or only faces published to the community database. This affects whether a seller can deliver a file at all.
- Gadgetbridge, Notify for Xiaomi, and Zepp compatibility: unverified.
- Unit sales of the Redmi Watch 5 Lite or 5 Active: not found. 4PDA and XDA threads were not reached.

## Q5. IP risk: Etsy takedowns, anime fan art, original anime-style art, Japanese text, AI disclosure

### Takeaway
Etsy enforces IP on a notice-and-takedown basis. A listing is removed when a rights holder reports it, repeat notices can get a shop disabled, and the counter-notice route is slow. Unlicensed fan art of named anime characters is infringement, not fair use, and is high-risk. Original characters drawn in an anime style are not infringing in themselves. Etsy allows AI-assisted items but requires disclosure under its 2024 Creativity Standards. I found no source on Japanese text specifically or on Galaxy Store AI rules.

### Cited Findings
- Process: by the time a seller gets Etsy's notice, the listing has already been taken down. A counter-notice gives the complainant 10 business days to start legal action. Repeat notices can lead to shop suspension. — [Cohn Legal Group](https://www.cohnlg.com/how-to-avoid-etsy-copyright-infringement/); [Marmalead](https://blog.marmalead.com/etsy-copyright-infringement/)
- Enforcement is mostly reactive, triggered by reports from rights holders or other shops. — [eRank](https://help.erank.com/blog/can-you-sell-fan-art-on-etsy/); [Outfy 2026](https://www.outfy.com/blog/etsy-copyright-infringement-explained/)
- Fan art is copyright and trademark infringement unless licensed. Changing costumes or colors still produces a derivative work. — [Harper James](https://harperjames.co.uk/article/etsy-copyright-infringement/); [Made Urban](https://www.madeurban.com/blog/how-to-avoid-etsy-copyright-infringement/)
- Scale: Etsy's 2024 Transparency Report says it removed 25% fewer listings for policy violations than in 2023, citing 70% better enforcement precision. It removed 22% more listings and suspended 1.5x more sellers under the Creativity Standards and Handmade policy. The claim of "over 1.5 million listings removed for IP in 2024" comes only from third-party blogs and is unverified. — [Etsy 2024 Transparency Report (PDF)](https://investors.etsy.com/_assets/_e32f867ccece97e0d02eac116945d814/etsy/db/1016/9831/pdf/2024_Transparency_Report_Digital.pdf); [Outfy](https://www.outfy.com/blog/etsy-copyright-infringement-explained/)
- Historical comparison: Etsy's first transparency report recorded 176,137 listings removed across 42,526 sellers after IP notices. — [SlashGear](https://www.slashgear.com/etsys-first-transparency-report-details-its-crafty-neerdowells-15392990)
- **AI:** Etsy's July 2024 Creativity Standards added "made / designed / sourced / handpicked" labels and addressed AI for the first time. The "Designed" category covers items made with AI or other digital tools. Disclosure of AI use is expected, and selling AI prompts is prohibited. Etsy's House Rules explicitly allow "digital art generated with innovative technologies." — [TechCrunch](https://techcrunch.com/2024/07/09/etsy-new-seller-policy-2024-generative-ai); [Etsy Creativity Standards](https://etsy.com/legal/creativity); [CO/AI](https://getcoai.com/news/etsy-balances-ai-and-authenticity-with-new-creativity-standards-for-sellers)
- Unverified community claim: Etsy's automated systems flag AI sellers who are compliant. — [aimetadatacleaner blog](https://aimetadatacleaner.com/blog/why-cant-sell-ai-art-etsy-without-getting-flagged-2025)

### Inferences
- The safest product is original characters in an anime style, with no franchise names, logos, signature costumes, or recognizable designs in images, titles, or tags. Using franchise names as keywords invites trademark reports even when the art is original.
- Watch faces are digital listings, so a takedown costs little per listing. The cumulative risk is shop suspension, which matters most for a single-shop business.
- Generic Japanese text (for example 時, 月, kanji numerals) is unlikely to be an IP issue on its own. Character names, series titles, or trademarked catchphrases in Japanese carry the same risk as English. This is an inference with no source.
- If art is AI-generated, disclose it in the listing and under the "Designed" attribute. AI output that closely resembles a specific copyrighted character is still infringing.

### Gaps
- Exact IP takedown counts in Etsy's 2024 report (the IP section was not readable from snippets).
- How often anime fan art in particular gets removed, and which Japanese rights holders (Toei, Shueisha, Aniplex and others) actively file on Etsy. No sourced data.
- Galaxy Store and Google Play AI-content disclosure rules for watch faces: not researched or found.
- Legal guidance on using Japanese text: no source found.
