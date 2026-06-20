/* ============================================================
   ZAKI (زكي) — AI Dining Advisor for Sobhy Kaber, Sharm El Sheikh
   ------------------------------------------------------------
   Self-contained chat widget: drop this single <script> into any
   page (Squarespace code injection works) and it renders a floating
   chat button + full concierge experience.

   - Instant, fully client-side advisor engine (no backend needed)
   - Bilingual: English + Arabic (auto-detects from guest input)
   - Menu recommendations from guest preferences
   - Gentle upselling (pairings, signature dishes) — never pushy
   - Table booking flow with WhatsApp handoff
   - Optional: point CONFIG.aiEndpoint at an LLM proxy to upgrade
     answers; the local engine remains as an instant fallback.
   ============================================================ */
(function () {
  "use strict";
  if (window.__zakiLoaded) return;
  window.__zakiLoaded = true;

  /* ----------------------------------------------------------
     CONFIG — edit these values for the restaurant
     ---------------------------------------------------------- */
  var CONFIG = {
    restaurantName: "Sobhy Kaber",
    city: "Sharm El Sheikh",
    // Reservation line published on sobhykabersharm.com: +20 1101107542
    whatsappNumber: "201101107542",
    phoneDisplay: "+20 110 110 7542",
    hours: {
      en: "Open daily until late — call or WhatsApp us to confirm today's hours",
      ar: "مفتوح يوميًا حتى وقت متأخر — اتصل أو ابعتلنا واتساب للتأكد من مواعيد اليوم"
    },
    address: {
      en: "Old Market (the souk), facing Al Sahaba Mosque, Sharm El Sheikh",
      ar: "السوق القديم، أمام مسجد الصحابة، شرم الشيخ"
    },
    mapsUrl: "https://maps.google.com/?q=Sobhy+Kaber+Restaurant+Old+Market+Sharm+El+Sheikh",
    currency: { en: "EGP", ar: "ج.م" },
    // Optional LLM upgrade: URL of a backend that accepts
    // POST {messages:[{role,content}...]} and returns {reply:"..."}.
    // Leave null to use the built-in instant engine only.
    aiEndpoint: null,
    typingDelayMs: [350, 700] // min/max "thinking" delay — feels alive, stays fast
  };

  // Allow a host page (e.g. the WordPress plugin) to override config —
  // most importantly CONFIG.aiEndpoint — without editing this file.
  if (window.ZAKI_CONFIG && typeof window.ZAKI_CONFIG === "object") {
    for (var _k in window.ZAKI_CONFIG) {
      if (Object.prototype.hasOwnProperty.call(window.ZAKI_CONFIG, _k)) {
        CONFIG[_k] = window.ZAKI_CONFIG[_k];
      }
    }
  }

  /* ----------------------------------------------------------
     MENU DATA — real items & prices from sobhykabersharm.com
     (retrieved June 2026; re-check after price updates).
     price: smallest-portion price (number). portions: full
     portion pricing shown on the card (¼ / ⅓ / ½ / kilo).
     tags: beef, lamb, chicken, pigeon, veg, light, hearty,
           kids, signature, bestseller, budget
     pair: id of a smart upsell companion
     ---------------------------------------------------------- */
  var MENU = [
    // Mashawy — charcoal grills, the house specialty
    { id: "kofta", cat: "grill", price: 330, tags: ["beef", "hearty", "bestseller", "kids"], pair: "molokhia_plain",
      portions: { en: "¼ 330 · ⅓ 450 · ½ 650 · 1kg 1300", ar: "ربع 330 · ثلث 450 · نص 650 · كيلو 1300" },
      name: { en: "Kofta", ar: "كفتة" },
      desc: { en: "Hand-minced premium beef over real charcoal — the Sobhy Kaber classic.", ar: "لحم مفروم فاخر على فحم حقيقي — كلاسيكية صبحي كابر." } },
    { id: "kebab", cat: "grill", price: 400, tags: ["beef", "hearty"], pair: "torly",
      portions: { en: "¼ 400 · ⅓ 535 · ½ 800 · 1kg 1600", ar: "ربع 400 · ثلث 535 · نص 800 · كيلو 1600" },
      name: { en: "Kebab", ar: "كباب" },
      desc: { en: "Tender chunks of meat char-grilled over open flame.", ar: "قطع لحم طرية مشوية على نار الفحم." } },
    { id: "tarb", cat: "grill", price: 350, tags: ["beef", "hearty", "signature"], pair: "molokhia_plain",
      portions: { en: "¼ 350 · ⅓ 465 · ½ 700 · 1kg 1400", ar: "ربع 350 · ثلث 465 · نص 700 · كيلو 1400" },
      name: { en: "Tarb (Fat-Wrapped Kofta)", ar: "طرب" },
      desc: { en: "Kofta wrapped in lamb fat and grilled until smoky and juicy — a connoisseur's choice.", ar: "كفتة ملفوفة في شحم الضأن ومشوية حتى تتدخن — اختيار الذوّيقة." } },
    { id: "neefa", cat: "grill", price: 400, tags: ["beef", "hearty"], pair: "freekh",
      portions: { en: "¼ 400 · ⅓ 550 · ½ 800 · 1kg 1600", ar: "ربع 400 · ثلث 550 · نص 800 · كيلو 1600" },
      name: { en: "Veal Cutlets (Neefa)", ar: "نيفة بتلو" },
      desc: { en: "Premium veal cutlets grilled over charcoal.", ar: "قطع بتلو فاخرة مشوية على الفحم." } },
    { id: "reesh", cat: "grill", price: 450, tags: ["lamb", "hearty", "signature", "bestseller"], pair: "freekh",
      portions: { en: "¼ 450 · ⅓ 600 · ½ 900 · 1kg 1800", ar: "ربع 450 · ثلث 600 · نص 900 · كيلو 1800" },
      name: { en: "Lamb Chops (Reesh)", ar: "ريش ضاني" },
      desc: { en: "Our signature lamb chops — smoky, tender, straight off the charcoal.", ar: "ريشنا المميزة — مدخنة وطرية من على الفحم مباشرة." } },
    { id: "tawook", cat: "grill", price: 170, tags: ["chicken", "light", "kids", "budget"], pair: "molokhia_plain",
      portions: { en: "¼ 170 · ⅓ 190 · ½ 290 · 1kg 550", ar: "ربع 170 · ثلث 190 · نص 290 · كيلو 550" },
      name: { en: "Shish Tawook", ar: "شيش طاووق" },
      desc: { en: "Marinated chicken skewers, juicy and lightly charred.", ar: "أسياخ دجاج متبلة، طرية ومشوية بخفة." } },
    { id: "sausage", cat: "grill", price: 250, tags: ["beef", "budget", "hearty"], pair: "molokhia_plain",
      portions: { en: "¼ 250 · ⅓ 335 · ½ 500 · 1kg 1000", ar: "ربع 250 · ثلث 335 · نص 500 · كيلو 1000" },
      name: { en: "Grilled Sausage (Sogo')", ar: "سجق مشوي" },
      desc: { en: "Spiced Egyptian sausage, char-grilled.", ar: "سجق مصري متبل على الفحم." } },
    { id: "grilledpigeon", cat: "grill", price: 230, tags: ["pigeon", "light"], pair: "molokhia_plain",
      name: { en: "Grilled Pigeon", ar: "حمام مشوي" },
      desc: { en: "Whole pigeon flattened and grilled over charcoal.", ar: "حمام كامل مفرود ومشوي على الفحم." } },
    { id: "stuffedpigeon", cat: "grill", price: 230, tags: ["pigeon", "signature", "bestseller", "hearty"], pair: "molokhia_plain",
      name: { en: "Stuffed Pigeon (Hamam Mahshi)", ar: "حمام محشي" },
      desc: { en: "Whole pigeon stuffed with seasoned grain — a true Egyptian delicacy.", ar: "حمام محشي حبوب متبلة — أكلة مصرية أصيلة." } },
    { id: "hawawshi", cat: "grill", price: 130, tags: ["beef", "budget", "kids"], pair: "molokhia_plain",
      name: { en: "Hawawshi", ar: "حواوشي" },
      desc: { en: "Baladi bread packed with spiced minced meat, baked until crisp.", ar: "عيش بلدي محشي لحمة مفرومة متبلة ومخبوز حتى يقرمش." } },

    // Mixed Grill Meals — built for sharing
    { id: "mix_kkt", cat: "mixed", price: 370, tags: ["beef", "chicken", "hearty", "bestseller", "kids"], pair: "molokhia_plain",
      portions: { en: "⅓ 370 · ½ 550 · 1kg 1100", ar: "ثلث 370 · نص 550 · كيلو 1100" },
      name: { en: "Mixed Kebab, Kofta & Shish Tawook", ar: "مشكل كباب وكفتة وشيش طاووق" },
      desc: { en: "The crowd-pleaser trio — something for everyone at the table.", ar: "الثلاثي اللي يرضي كل الأذواق على الترابيزة." } },
    { id: "mix_kt", cat: "mixed", price: 315, tags: ["beef", "chicken", "budget", "kids"], pair: "molokhia_plain",
      portions: { en: "⅓ 315 · ½ 465 · 1kg 925", ar: "ثلث 315 · نص 465 · كيلو 925" },
      name: { en: "Mixed Kofta & Shish Tawook", ar: "مشكل كفتة وشيش طاووق" },
      desc: { en: "The friendly duo — great value for smaller tables.", ar: "الثنائي الجميل — قيمة ممتازة للترابيزات الصغيرة." } },
    { id: "mix_kkl", cat: "mixed", price: 530, tags: ["beef", "lamb", "hearty", "signature"], pair: "freekh",
      portions: { en: "⅓ 530 · ½ 800 · 1kg 1580", ar: "ثلث 530 · نص 800 · كيلو 1580" },
      name: { en: "Mixed Kebab, Kofta & Lamb Chops", ar: "مشكل كباب وكفتة وريش" },
      desc: { en: "The premium platter — crowned with our signature lamb chops.", ar: "الطبق الفاخر — متوّج بريشنا المميزة." } },
    { id: "mix_tkk", cat: "mixed", price: 495, tags: ["beef", "hearty"], pair: "torly",
      portions: { en: "⅓ 495 · ½ 730 · 1kg 1460", ar: "ثلث 495 · نص 730 · كيلو 1460" },
      name: { en: "Mixed Tarb, Kofta & Kebab", ar: "مشكل طرب وكفتة وكباب" },
      desc: { en: "For serious meat lovers — smoky tarb leads this platter.", ar: "لعشاق اللحمة الحقيقيين — الطرب المدخن نجم الطبق." } },

    // From the oven — casseroles & Egyptian classics
    { id: "molokhia_plain", cat: "main", price: 130, tags: ["veg", "light", "budget"], pair: null,
      name: { en: "Molokhia Casserole (Plain)", ar: "طاجن ملوخية سادة" },
      desc: { en: "Silky green molokhia with sizzling garlic ta'leya, served bubbling hot.", ar: "ملوخية خضراء بالتقلية، تتقدم وهي بتغلي." } },
    { id: "molokhia_meat", cat: "main", price: 400, tags: ["beef", "hearty"], pair: null,
      name: { en: "Molokhia Casserole with Meat", ar: "طاجن ملوخية باللحمة" },
      desc: { en: "Our molokhia crowned with slow-cooked chunks of meat.", ar: "ملوخيتنا متوّجة بقطع لحمة متسبكة." } },
    { id: "torly", cat: "main", price: 400, tags: ["veg", "hearty"], pair: null,
      name: { en: "Torly Casserole (Mixed Vegetables)", ar: "طاجن تورلي خضار" },
      desc: { en: "Mixed vegetables slow-baked in rich tomato sauce.", ar: "خضار مشكل في صلصة طماطم غنية من الفرن." } },
    { id: "freekh", cat: "main", price: 400, tags: ["hearty"], pair: null,
      name: { en: "Freekh Casserole", ar: "طاجن فريك" },
      desc: { en: "Toasted green wheat baked in the oven — earthy and comforting.", ar: "فريك محمص من الفرن — طعم بلدي أصيل." } }
  ];

  var byId = {};
  MENU.forEach(function (m) { byId[m.id] = m; });

  /* ----------------------------------------------------------
     I18N strings
     ---------------------------------------------------------- */
  var T = {
    en: {
      botName: "Zaki",
      botTag: "Your taste guide at Sobhy Kaber",
      online: "Online — replies instantly",
      inputPlaceholder: "Ask Zaki anything… (e.g. \"something spicy for 2\")",
      send: "Send",
      greeting: "Ahlan wa sahlan! 👋 I'm <b>Zaki</b>, your dining advisor at <b>Sobhy Kaber {city}</b>.<br>Tell me what you're craving and I'll find your perfect plate — or I can book you a table right now.",
      chipsHome: [
        { t: "🔥 Bestsellers", v: "bestsellers" },
        { t: "🍽️ Help me choose", v: "help me choose" },
        { t: "🌿 Vegetarian", v: "vegetarian options" },
        { t: "📅 Book a table", v: "book a table" },
        { t: "📍 Hours & location", v: "hours and location" }
      ],
      chipsAfterRec: [
        { t: "More options", v: "more options" },
        { t: "🍰 Dessert ideas", v: "dessert" },
        { t: "📅 Book a table", v: "book a table" }
      ],
      askPrefs: "Happy to! Quick question so I nail it: are you in the mood for <b>charcoal grills</b>, a <b>mixed platter</b> to share, or an <b>oven casserole</b>? Light or hearty?",
      from: "from",
      recIntro: "Great taste coming up. Based on what you told me, I'd go for:",
      recBestsellers: "These are the plates our regulars cross the city for:",
      recVeg: "From our oven — these are meat-free and wonderful:",
      noSeafood: "We're charcoal-grill specialists, so no seafood here — but if you'd like something lighter off the fire, these are beautiful:",
      recLight: "Something light and lovely:",
      recMore: "A few more gems you might love:",
      upsell: "Small tip: a <b>{item}</b> ({price} {cur}) on the side goes beautifully with that. Most guests don't regret it. 😉",
      signatureNudge: "And if you're celebrating something, the <b>{item}</b> is our signature — worth knowing about.",
      dessertReply: "Desserts and fresh drinks rotate daily at the restaurant — ask our team when you're seated and they'll spoil you. Meanwhile, shall I pick your main event? 🍢",
      drinksReply: "Fresh drinks vary daily — our team will walk you through them at the table. Want me to sort out the food side?",
      noMatch: "I couldn't find an exact match, but here's what's closest — or tell me more about what you like:",
      hours: "🕐 <b>Hours:</b> {hours}<br>📍 <b>Find us:</b> {address}<br><a href='{maps}' target='_blank' rel='noopener'>Open in Google Maps ↗</a>",
      human: "Of course! You can reach our team directly on WhatsApp — tap below and we'll take care of you. 💬",
      humanBtn: "Chat with our team on WhatsApp",
      thanks: "It's a pleasure! If you need anything else — a recommendation or a table — I'm right here. 🙌",
      bye: "Ma'a salama! We hope to see you at Sobhy Kaber soon. 🌙",
      fallback: "I want to get this right for you. I can recommend dishes by your taste, share the menu's stars, or <b>book your table</b>. What sounds good?",
      // Booking flow
      bookStart: "Excellent choice — let's get you a table! 🎉 First, what name should I put the reservation under?",
      bookGuests: "Lovely, <b>{name}</b>! How many guests will be joining?",
      bookDate: "Got it — a table for <b>{n}</b>. Which day works for you?",
      bookTime: "And what time should we expect you?",
      bookConfirm: "Here's your reservation — does everything look right?",
      bookSummary: "👤 <b>{name}</b><br>👥 {n} guests<br>📅 {date}<br>🕐 {time}",
      bookYes: "✅ Confirm & send",
      bookEdit: "✏️ Start over",
      bookDone: "Perfect! Tap below to send your reservation to our team on WhatsApp — they'll confirm within minutes. 🙏",
      bookWhatsBtn: "📲 Send reservation via WhatsApp",
      bookAfter: "While you wait — shall I suggest what to pre-order? The <b>{item}</b> needs a little prep time and is absolutely worth it.",
      bookCancel: "No problem, reservation cancelled. Anything else I can help with?",
      bookGuestsInvalid: "Just a number works best — how many guests? (e.g. 4)",
      chipsGuests: [{ t: "2", v: "2" }, { t: "4", v: "4" }, { t: "6", v: "6" }, { t: "8+", v: "8" }],
      chipsDate: [{ t: "Tonight", v: "Tonight" }, { t: "Tomorrow", v: "Tomorrow" }, { t: "This weekend", v: "This weekend" }],
      chipsTime: [{ t: "7:00 PM", v: "7:00 PM" }, { t: "8:00 PM", v: "8:00 PM" }, { t: "9:00 PM", v: "9:00 PM" }, { t: "10:00 PM", v: "10:00 PM" }],
      waBooking: "Hello Sobhy Kaber {city}! 🌟 I'd like to reserve a table:\n\n• Name: {name}\n• Guests: {n}\n• Date: {date}\n• Time: {time}\n\n(Sent via Zaki, the website advisor)",
      cancelWords: ["cancel", "stop", "never mind", "nevermind", "back"]
    },
    ar: {
      botName: "زكي",
      botTag: "دليلك للأكل في صبحي كابر",
      online: "متصل — يرد فورًا",
      inputPlaceholder: "اسأل زكي أي حاجة… (مثلًا: حاجة حارة لشخصين)",
      send: "إرسال",
      greeting: "أهلًا وسهلًا! 👋 أنا <b>زكي</b>، مستشارك للأكل في <b>صبحي كابر {city}</b>.<br>قولّي نفسك في إيه وأنا هلاقيلك أحلى طبق — أو أحجزلك ترابيزة حالًا.",
      chipsHome: [
        { t: "🔥 الأكثر طلبًا", v: "الأكثر طلبا" },
        { t: "🍽️ ساعدني أختار", v: "ساعدني اختار" },
        { t: "🌿 نباتي", v: "اكل نباتي" },
        { t: "📅 احجز ترابيزة", v: "احجز ترابيزة" },
        { t: "📍 المواعيد والعنوان", v: "المواعيد والعنوان" }
      ],
      chipsAfterRec: [
        { t: "اقتراحات تانية", v: "اقتراحات تانية" },
        { t: "🍰 حلويات", v: "حلويات" },
        { t: "📅 احجز ترابيزة", v: "احجز ترابيزة" }
      ],
      askPrefs: "من عنيا! سؤال سريع عشان أظبطك: نفسك في <b>مشويات فحم</b>، <b>مشكل للقسمة</b>، ولا <b>طاجن من الفرن</b>؟ خفيف ولا دسم؟",
      from: "يبدأ من",
      recIntro: "ذوقك عالي. على حسب كلامك، أنا أرشحلك:",
      recBestsellers: "دي الأطباق اللي الزباين بييجوا من آخر الدنيا عشانها:",
      recVeg: "من الفرن — دول من غير لحمة وطعمهم جميل:",
      noSeafood: "إحنا متخصصين مشويات فحم، فمفيش سي فود عندنا — بس لو عايز حاجة أخف من على النار، دول حلوين جدًا:",
      recLight: "حاجة خفيفة وجميلة:",
      recMore: "كمان شوية جواهر ممكن تعجبك:",
      upsell: "نصيحة صغيرة: <b>{item}</b> ({price} {cur}) جنبها بيظبط جدًا. محدش ندم. 😉",
      signatureNudge: "ولو بتحتفلوا بحاجة، <b>{item}</b> هو طبقنا المميز — يستاهل تعرفه.",
      dessertReply: "الحلويات والمشروبات الفريش بتتغير يوميًا في المطعم — اسأل الفريق وانت قاعد وهيدلعوك. في الوقت ده، أختارلك الطبق الرئيسي؟ 🍢",
      drinksReply: "المشروبات الفريش بتتغير يوميًا — الفريق هيقولك عليها على الترابيزة. أظبطلك ناحية الأكل؟",
      noMatch: "ملقتش حاجة مطابقة بالظبط، بس دول الأقرب — أو قولّي أكتر عن ذوقك:",
      hours: "🕐 <b>المواعيد:</b> {hours}<br>📍 <b>العنوان:</b> {address}<br><a href='{maps}' target='_blank' rel='noopener'>افتح في خرائط جوجل ↗</a>",
      human: "أكيد! تقدر تكلم فريقنا مباشرة على واتساب — دوس تحت وإحنا في خدمتك. 💬",
      humanBtn: "كلمنا على واتساب",
      thanks: "العفو! لو احتجت أي حاجة — ترشيح أو حجز — أنا موجود. 🙌",
      bye: "مع السلامة! مستنيينك في صبحي كابر. 🌙",
      fallback: "عايز أظبطك صح. أقدر أرشحلك أكل على ذوقك، أقولك على نجوم المنيو، أو <b>أحجزلك ترابيزة</b>. تحب إيه؟",
      bookStart: "اختيار ممتاز — يلا نحجزلك ترابيزة! 🎉 الحجز يكون باسم مين؟",
      bookGuests: "تشرفنا يا <b>{name}</b>! هتكونوا كام فرد؟",
      bookDate: "تمام — ترابيزة لـ <b>{n}</b>. تحبوا تيجوا يوم إيه؟",
      bookTime: "ومستنيينكم الساعة كام؟",
      bookConfirm: "ده ملخص الحجز — كله تمام؟",
      bookSummary: "👤 <b>{name}</b><br>👥 {n} أفراد<br>📅 {date}<br>🕐 {time}",
      bookYes: "✅ تأكيد وإرسال",
      bookEdit: "✏️ ابدأ من الأول",
      bookDone: "تمام! دوس تحت عشان تبعت الحجز لفريقنا على واتساب — هيأكدوا في دقايق. 🙏",
      bookWhatsBtn: "📲 ابعت الحجز على واتساب",
      bookAfter: "وانت مستني — أقولك على حاجة تطلبها قبل ما توصل؟ <b>{item}</b> محتاج وقت تحضير وبجد يستاهل.",
      bookCancel: "ولا يهمك، اتلغى الحجز. أقدر أساعدك في حاجة تانية؟",
      bookGuestsInvalid: "اكتبلي رقم بس — هتكونوا كام؟ (مثلًا ٤)",
      chipsGuests: [{ t: "٢", v: "2" }, { t: "٤", v: "4" }, { t: "٦", v: "6" }, { t: "٨+", v: "8" }],
      chipsDate: [{ t: "النهارده", v: "النهارده" }, { t: "بكره", v: "بكره" }, { t: "الويك إند", v: "الويك إند" }],
      chipsTime: [{ t: "٧ مساءً", v: "7:00 PM" }, { t: "٨ مساءً", v: "8:00 PM" }, { t: "٩ مساءً", v: "9:00 PM" }, { t: "١٠ مساءً", v: "10:00 PM" }],
      waBooking: "السلام عليكم صبحي كابر {city}! 🌟 عايز أحجز ترابيزة:\n\n• الاسم: {name}\n• عدد الأفراد: {n}\n• اليوم: {date}\n• الساعة: {time}\n\n(مرسلة عن طريق زكي، مستشار الموقع)",
      cancelWords: ["الغاء", "إلغاء", "الغي", "بطل", "ارجع", "كنسل"]
    }
  };

  /* ----------------------------------------------------------
     Intent keywords (en + ar handled together; lang only affects
     reply language)
     ---------------------------------------------------------- */
  var KW = {
    greeting: ["hello", "hi ", "hey", "ahlan", "salam", "اهلا", "أهلا", "السلام", "هاي", "مرحبا", "ازيك"],
    bestsellers: ["bestseller", "best seller", "popular", "famous", "most ordered", "top", "signature", "recommend the best", "الأكثر", "الاكثر", "مشهور", "أشهر", "اشهر", "الافضل", "الأفضل", "اكتر حاجة"],
    veg: ["vegetarian", "vegan", "no meat", "veggie", "plant", "نباتي", "من غير لحمة", "بدون لحم"],
    seafood: ["seafood", "fish", "shrimp", "prawn", "sea bass", "calamari", "سمك", "جمبري", "سي فود", "قاروص", "مأكولات بحرية"],
    chicken: ["chicken", "tawook", "poultry", "فراخ", "دجاج", "طاووق"],
    meat: ["beef", "meat", "lamb", "veal", "kofta", "kebab", "steak", "ribs", "chops", "لحمة", "لحم", "كفتة", "كباب", "ضاني", "بتلو", "ريش"],
    spicy: ["spicy", "hot ", "chili", "حار", "حراق", "سبايسي"],
    light: ["light", "healthy", "diet", "not heavy", "small", "خفيف", "دايت", "صحي"],
    hearty: ["hearty", "heavy", "big", "hungry", "starving", "feast", "دسم", "جعان", "جوعان", "وليمة", "أكل كتير"],
    kids: ["kid", "child", "family", "اطفال", "أطفال", "عيال", "عائلي"],
    budget: ["cheap", "budget", "affordable", "not expensive", "رخيص", "اقتصادي", "مش غالي", "في المتناول"],
    dessert: ["dessert", "sweet", "konafa", "om ali", "حلو", "حلويات", "كنافة", "ام علي", "أم علي", "تحلية"],
    drinks: ["drink", "juice", "tea", "coffee", "beverage", "مشروب", "عصير", "شاي", "قهوة"],
    menu: ["menu", "what do you have", "what do you serve", "المنيو", "القائمة", "عندكم ايه", "عندكو ايه"],
    booking: ["book", "reserve", "reservation", "table", "حجز", "احجز", "إحجز", "ترابيزة", "طاولة"],
    hours: ["hour", "open", "close", "location", "address", "where", "map", "مواعيد", "فاتحين", "بتقفلوا", "عنوان", "فين", "مكان", "الموقع"],
    human: ["human", "person", "staff", "someone", "agent", "call", "whatsapp", "واتساب", "حد أكلمه", "موظف", "اكلم حد", "أكلم حد"],
    help: ["help me choose", "choose", "suggest", "recommend", "advise", "what should i", "ساعدني", "اختار", "اقترح", "رشح", "ترشح", "انصحني"],
    more: ["more", "other", "else", "another", "تانية", "تاني", "كمان", "غيرها"],
    thanks: ["thank", "thx", "شكرا", "شكرًا", "متشكر", "تسلم"],
    bye: ["bye", "goodbye", "see you", "مع السلامة", "باي", "سلام "]
  };

  /* ----------------------------------------------------------
     State
     ---------------------------------------------------------- */
  var state = {
    lang: "en",
    open: false,
    booking: null,           // {step, name, guests, date, time}
    shownIds: {},            // avoid repeating recommendations
    lastPrefTags: [],
    history: []              // for optional aiEndpoint
  };

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  function t(key) {
    var s = T[state.lang][key];
    if (s === undefined) s = T.en[key];
    return s;
  }
  function fmt(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] !== undefined ? vars[k] : "{" + k + "}";
    });
  }
  function isArabic(text) { return /[؀-ۿ]/.test(text); }
  function norm(text) { return " " + text.toLowerCase().trim() + " "; }
  function hasAny(text, words) {
    for (var i = 0; i < words.length; i++) {
      if (text.indexOf(words[i]) !== -1) return true;
    }
    return false;
  }
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function rand(min, max) { return Math.floor(min + Math.random() * (max - min)); }

  /* ----------------------------------------------------------
     ICON — Zaki's face: a white chef's toque with a gold spark
     on the brick-red sign gradient from the Sobhy Kaber logo.
     Used for the launcher and the avatar.
     ---------------------------------------------------------- */
  var ICON_SVG =
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="zkg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ba4940"/><stop offset="1" stop-color="#c66746"/>' +
    '</linearGradient></defs>' +
    '<circle cx="32" cy="32" r="32" fill="url(#zkg)"/>' +
    '<circle cx="32" cy="32" r="30" fill="none" stroke="#e5aa56" stroke-width="1.6" opacity=".9"/>' +
    // chef toque
    '<path d="M20 38v-5.5c-3.3-.9-5.5-3.6-5.5-7 0-4 3.2-7.2 7.2-7.2.6 0 1.2.1 1.8.2C25 15.6 28.2 14 32 14s7 1.6 8.5 4.5c.6-.1 1.2-.2 1.8-.2 4 0 7.2 3.2 7.2 7.2 0 3.4-2.2 6.1-5.5 7V38H20z" fill="#fdf6ec"/>' +
    '<rect x="20" y="40" width="24" height="6" rx="2" fill="#fdf6ec"/>' +
    '<line x1="27" y1="33" x2="27" y2="38" stroke="#e3cdb2" stroke-width="1.6" stroke-linecap="round"/>' +
    '<line x1="32" y1="33" x2="32" y2="38" stroke="#e3cdb2" stroke-width="1.6" stroke-linecap="round"/>' +
    '<line x1="37" y1="33" x2="37" y2="38" stroke="#e3cdb2" stroke-width="1.6" stroke-linecap="round"/>' +
    // gold spark
    '<path d="M48 10l1.5 3.5L53 15l-3.5 1.5L48 20l-1.5-3.5L43 15l3.5-1.5z" fill="#e5aa56"/>' +
    '</svg>';

  /* ----------------------------------------------------------
     Styles
     ---------------------------------------------------------- */
  /* Sobhy Kaber brand palette — sampled from the official logo:
     brick-red sign #ba4940→#c66746, golden letters #e5aa56,
     cream #f4e0d0, skewer black. */
  var CSS = [
    ":root{--zk-red:#b4483c;--zk-red2:#c66746;--zk-reddark:#9c3c30;--zk-gold:#e5aa56;--zk-golddark:#a8731f;--zk-cream:#faf3e9;--zk-ink:#2b1d16;}",
    "#zaki-launcher{position:fixed;bottom:22px;right:22px;z-index:99990;width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;padding:0;background:transparent;box-shadow:0 8px 28px rgba(180,72,60,.5);transition:transform .2s ease;}",
    "#zaki-launcher:hover{transform:scale(1.08);}",
    "#zaki-launcher svg{width:100%;height:100%;display:block;border-radius:50%;}",
    "#zaki-launcher .zk-pulse{position:absolute;inset:0;border-radius:50%;animation:zkPulse 2.4s ease-out infinite;border:2px solid rgba(180,72,60,.55);}",
    "@keyframes zkPulse{0%{transform:scale(1);opacity:.8}70%{transform:scale(1.45);opacity:0}100%{opacity:0}}",
    "#zaki-launcher .zk-badge{position:absolute;top:-2px;right:-2px;background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;}",
    "#zaki-panel{position:fixed;bottom:96px;right:22px;z-index:99991;width:382px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:var(--zk-cream);border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(60,25,18,.4);opacity:0;transform:translateY(16px) scale(.97);pointer-events:none;transition:opacity .22s ease,transform .22s ease;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;}",
    "#zaki-panel.zk-open{opacity:1;transform:none;pointer-events:auto;}",
    "@media (max-width:480px){#zaki-panel{right:12px;left:12px;width:auto;bottom:90px;height:76vh;}}",
    ".zk-head{display:flex;align-items:center;gap:12px;padding:14px 16px;background:linear-gradient(135deg,var(--zk-reddark),var(--zk-red2));color:#fff;flex-shrink:0;border-bottom:3px solid var(--zk-gold);}",
    ".zk-head .zk-avatar{width:44px;height:44px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 2px rgba(229,170,86,.85);}",
    ".zk-head .zk-avatar svg{width:100%;height:100%;display:block;border-radius:50%;}",
    ".zk-head-info{flex:1;min-width:0;}",
    ".zk-head-info .zk-name{font-weight:700;font-size:16px;letter-spacing:.2px;}",
    ".zk-head-info .zk-status{font-size:11.5px;opacity:.9;display:flex;align-items:center;gap:5px;margin-top:2px;}",
    ".zk-head-info .zk-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;}",
    ".zk-head button{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:9px;cursor:pointer;font-size:13px;padding:6px 10px;transition:background .15s;}",
    ".zk-head button:hover{background:rgba(255,255,255,.3);}",
    ".zk-msgs{flex:1;overflow-y:auto;padding:16px 14px 8px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;}",
    ".zk-msgs::-webkit-scrollbar{width:5px}.zk-msgs::-webkit-scrollbar-thumb{background:rgba(60,25,18,.18);border-radius:3px}",
    ".zk-row{display:flex;margin-bottom:10px;animation:zkIn .25s ease both;}",
    "@keyframes zkIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
    ".zk-row.zk-bot{justify-content:flex-start}.zk-row.zk-user{justify-content:flex-end}",
    ".zk-bub{max-width:84%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;color:var(--zk-ink);word-wrap:break-word;}",
    ".zk-bot .zk-bub{background:#fff;border-bottom-left-radius:5px;box-shadow:0 1px 4px rgba(60,25,18,.08);}",
    ".zk-user .zk-bub{background:linear-gradient(135deg,var(--zk-red),var(--zk-red2));color:#fff;border-bottom-right-radius:5px;}",
    ".zk-bub a{color:var(--zk-red);font-weight:600;}",
    "[dir=rtl] .zk-bot .zk-bub{border-radius:16px;border-bottom-right-radius:5px;}",
    "[dir=rtl] .zk-user .zk-bub{border-radius:16px;border-bottom-left-radius:5px;}",
    ".zk-card{background:#fff;border:1px solid rgba(180,72,60,.35);border-radius:14px;padding:10px 12px;margin:8px 0 2px;max-width:88%;box-shadow:0 1px 5px rgba(60,25,18,.07);animation:zkIn .25s ease both;}",
    ".zk-card .zk-card-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;}",
    ".zk-card .zk-card-name{font-weight:700;font-size:13.5px;color:var(--zk-reddark);}",
    ".zk-card .zk-card-price{font-weight:700;font-size:13px;color:var(--zk-golddark);white-space:nowrap;}",
    ".zk-card .zk-card-desc{font-size:12.5px;color:#6f5b4e;margin-top:3px;line-height:1.45;}",
    ".zk-card .zk-card-portions{font-size:11.5px;color:var(--zk-golddark);margin-top:5px;font-weight:600;border-top:1px dashed rgba(229,170,86,.6);padding-top:5px;}",
    ".zk-chips{display:flex;flex-wrap:wrap;gap:7px;padding:4px 14px 10px;flex-shrink:0;}",
    ".zk-chip{background:#fff;border:1.5px solid rgba(180,72,60,.5);color:var(--zk-reddark);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;animation:zkIn .3s ease both;}",
    ".zk-chip:hover{background:var(--zk-red);border-color:var(--zk-red);color:#fff;transform:translateY(-1px);}",
    ".zk-cta{display:inline-block;margin-top:8px;background:#25d366;color:#fff!important;font-weight:700;font-size:13px;border-radius:11px;padding:10px 14px;text-decoration:none;box-shadow:0 4px 14px rgba(37,211,102,.35);transition:transform .15s;}",
    ".zk-cta:hover{transform:translateY(-1px);}",
    ".zk-typing{display:inline-flex;gap:4px;padding:12px 16px;background:#fff;border-radius:16px;border-bottom-left-radius:5px;box-shadow:0 1px 4px rgba(60,25,18,.08);}",
    ".zk-typing span{width:7px;height:7px;border-radius:50%;background:var(--zk-gold);animation:zkDots 1.1s infinite;}",
    ".zk-typing span:nth-child(2){animation-delay:.18s}.zk-typing span:nth-child(3){animation-delay:.36s}",
    "@keyframes zkDots{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}",
    ".zk-input{display:flex;gap:8px;padding:10px 12px 12px;background:#fff;border-top:1px solid rgba(60,25,18,.08);flex-shrink:0;}",
    ".zk-input input{flex:1;border:1.5px solid rgba(60,25,18,.14);border-radius:12px;padding:11px 13px;font-size:14px;outline:none;background:var(--zk-cream);color:var(--zk-ink);transition:border-color .15s;min-width:0;}",
    ".zk-input input:focus{border-color:var(--zk-red2);}",
    ".zk-input button{background:linear-gradient(135deg,var(--zk-red),var(--zk-red2));color:#fff;border:none;border-radius:12px;width:46px;cursor:pointer;font-size:17px;flex-shrink:0;transition:transform .15s;display:flex;align-items:center;justify-content:center;}",
    ".zk-input button:hover{transform:scale(1.06);}",
    ".zk-foot{text-align:center;font-size:10px;color:#ab9482;padding:0 0 7px;background:#fff;flex-shrink:0;}"
  ].join("\n");

  /* ----------------------------------------------------------
     DOM
     ---------------------------------------------------------- */
  var el = {};

  function buildDom() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    el.launcher = document.createElement("button");
    el.launcher.id = "zaki-launcher";
    el.launcher.setAttribute("aria-label", "Chat with Zaki, our dining advisor");
    el.launcher.innerHTML = '<span class="zk-pulse"></span>' + ICON_SVG + '<span class="zk-badge"></span>';
    document.body.appendChild(el.launcher);

    el.panel = document.createElement("div");
    el.panel.id = "zaki-panel";
    el.panel.setAttribute("role", "dialog");
    el.panel.setAttribute("aria-label", "Zaki dining advisor chat");
    el.panel.innerHTML =
      '<div class="zk-head">' +
      '  <span class="zk-avatar">' + ICON_SVG + '</span>' +
      '  <div class="zk-head-info">' +
      '    <div class="zk-name"></div>' +
      '    <div class="zk-status"><span class="zk-dot"></span><span class="zk-status-text"></span></div>' +
      '  </div>' +
      '  <button type="button" class="zk-lang" title="عربي / English"></button>' +
      '  <button type="button" class="zk-close" aria-label="Close chat">✕</button>' +
      '</div>' +
      '<div class="zk-msgs"></div>' +
      '<div class="zk-chips"></div>' +
      '<div class="zk-input">' +
      '  <input type="text" autocomplete="off" />' +
      '  <button type="button" class="zk-send" aria-label="Send">➤</button>' +
      '</div>' +
      '<div class="zk-foot">Zaki · Sobhy Kaber dining advisor</div>';
    document.body.appendChild(el.panel);

    el.msgs = el.panel.querySelector(".zk-msgs");
    el.chips = el.panel.querySelector(".zk-chips");
    el.field = el.panel.querySelector(".zk-input input");
    el.name = el.panel.querySelector(".zk-name");
    el.statusText = el.panel.querySelector(".zk-status-text");
    el.langBtn = el.panel.querySelector(".zk-lang");

    el.launcher.addEventListener("click", togglePanel);
    el.panel.querySelector(".zk-close").addEventListener("click", togglePanel);
    el.panel.querySelector(".zk-send").addEventListener("click", submit);
    el.field.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    el.langBtn.addEventListener("click", function () {
      setLang(state.lang === "en" ? "ar" : "en");
      botSay(fmt(t("greeting"), { city: CONFIG.city }), t("chipsHome"));
    });

    applyLangUi();
  }

  function setLang(lang) {
    if (state.lang === lang) return;
    state.lang = lang;
    applyLangUi();
  }

  function applyLangUi() {
    var ar = state.lang === "ar";
    el.panel.setAttribute("dir", ar ? "rtl" : "ltr");
    el.name.textContent = t("botName") + " · " + CONFIG.restaurantName;
    el.statusText.textContent = t("online");
    el.field.placeholder = t("inputPlaceholder");
    el.langBtn.textContent = ar ? "English" : "عربي";
  }

  function togglePanel() {
    state.open = !state.open;
    el.panel.classList.toggle("zk-open", state.open);
    if (state.open) {
      el.field.focus();
      if (!state.greeted) {
        state.greeted = true;
        botSay(fmt(t("greeting"), { city: CONFIG.city }), t("chipsHome"));
      }
    }
  }

  /* ----------------------------------------------------------
     Rendering
     ---------------------------------------------------------- */
  function addRow(html, who) {
    var row = document.createElement("div");
    row.className = "zk-row zk-" + who;
    var bub = document.createElement("div");
    bub.className = "zk-bub";
    bub.innerHTML = html;
    row.appendChild(bub);
    el.msgs.appendChild(row);
    scrollDown();
    return row;
  }

  function addCard(item) {
    var card = document.createElement("div");
    card.className = "zk-card";
    var priceLabel = item.portions
      ? t("from") + " " + item.price + " " + CONFIG.currency[state.lang]
      : item.price + " " + CONFIG.currency[state.lang];
    card.innerHTML =
      '<div class="zk-card-top">' +
      '<span class="zk-card-name">' + escapeHtml(item.name[state.lang]) + '</span>' +
      '<span class="zk-card-price">' + priceLabel + '</span>' +
      '</div>' +
      '<div class="zk-card-desc">' + escapeHtml(item.desc[state.lang]) + '</div>' +
      (item.portions
        ? '<div class="zk-card-portions">' + escapeHtml(item.portions[state.lang]) + " " + CONFIG.currency[state.lang] + '</div>'
        : "");
    el.msgs.appendChild(card);
    scrollDown();
  }

  function setChips(chips) {
    el.chips.innerHTML = "";
    (chips || []).forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "zk-chip";
      b.style.animationDelay = (i * 50) + "ms";
      b.textContent = c.t;
      b.addEventListener("click", function () { handleUserText(c.v, c.t); });
      el.chips.appendChild(b);
    });
  }

  function scrollDown() { el.msgs.scrollTop = el.msgs.scrollHeight; }

  function showTyping() {
    var row = document.createElement("div");
    row.className = "zk-row zk-bot zk-typing-row";
    row.innerHTML = '<div class="zk-typing"><span></span><span></span><span></span></div>';
    el.msgs.appendChild(row);
    scrollDown();
    return row;
  }

  // Queue bot output behind a short typing animation so replies feel
  // alive but never slow.
  function botSay(html, chips, items, ctaHtml) {
    setChips([]);
    var typing = showTyping();
    setTimeout(function () {
      typing.remove();
      addRow(html, "bot");
      (items || []).forEach(addCard);
      if (ctaHtml) {
        var wrap = document.createElement("div");
        wrap.className = "zk-row zk-bot";
        wrap.innerHTML = '<div class="zk-bub">' + ctaHtml + "</div>";
        el.msgs.appendChild(wrap);
      }
      setChips(chips);
      scrollDown();
      state.history.push({ role: "assistant", content: html.replace(/<[^>]+>/g, " ") });
    }, rand(CONFIG.typingDelayMs[0], CONFIG.typingDelayMs[1]));
  }

  /* ----------------------------------------------------------
     Recommendation engine
     ---------------------------------------------------------- */
  function extractTags(text) {
    var tags = [];
    if (hasAny(text, KW.veg)) tags.push("veg");
    if (hasAny(text, KW.seafood)) tags.push("seafood");
    if (hasAny(text, KW.chicken)) tags.push("chicken");
    if (hasAny(text, KW.meat)) tags.push("beef", "lamb");
    if (hasAny(text, KW.spicy)) tags.push("spicy");
    if (hasAny(text, KW.light)) tags.push("light");
    if (hasAny(text, KW.hearty)) tags.push("hearty");
    if (hasAny(text, KW.kids)) tags.push("kids");
    if (hasAny(text, KW.budget)) tags.push("budget");
    return tags;
  }

  function pickItems(opts) {
    var tags = opts.tags || [];
    var cats = opts.cats || ["grill", "mixed", "main"];
    var n = opts.n || 3;
    var scored = MENU
      .filter(function (m) { return cats.indexOf(m.cat) !== -1; })
      .map(function (m) {
        var score = 0;
        tags.forEach(function (tg) { if (m.tags.indexOf(tg) !== -1) score += 2; });
        if (m.tags.indexOf("bestseller") !== -1) score += 0.6;
        if (m.tags.indexOf("signature") !== -1) score += 0.3;
        if (state.shownIds[m.id]) score -= 1.5; // freshness: prefer unshown items
        return { m: m, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });

    // If the guest gave preferences, require at least one tag match
    var pool = scored;
    if (tags.length) {
      var matched = scored.filter(function (s) {
        return tags.some(function (tg) { return s.m.tags.indexOf(tg) !== -1; });
      });
      if (matched.length) pool = matched;
      else return { items: [], exact: false };
    }
    var items = pool.slice(0, n).map(function (s) { return s.m; });
    items.forEach(function (m) { state.shownIds[m.id] = true; });
    return { items: items, exact: true };
  }

  function recommend(text, introKey) {
    var tags = extractTags(text);
    if (tags.length) state.lastPrefTags = tags;
    else if (state.lastPrefTags.length) tags = state.lastPrefTags;

    var res = pickItems({ tags: tags });
    var intro;
    if (!res.items.length) {
      res = pickItems({ tags: [] });
      intro = t("noMatch");
    } else {
      intro = t(introKey || (tags.length ? "recIntro" : "recBestsellers"));
    }

    // Gentle upsell: pair the top pick with its companion once.
    var cta = null;
    var top = res.items[0];
    if (top && top.pair && byId[top.pair] && !state.shownIds[top.pair + "_upsold"]) {
      state.shownIds[top.pair + "_upsold"] = true;
      var p = byId[top.pair];
      cta = fmt(t("upsell"), {
        item: p.name[state.lang],
        price: p.price,
        cur: CONFIG.currency[state.lang]
      });
    }
    botSay(intro, t("chipsAfterRec"), res.items, cta);
  }

  /* ----------------------------------------------------------
     Booking flow
     ---------------------------------------------------------- */
  function startBooking() {
    state.booking = { step: "name" };
    botSay(t("bookStart"), []);
  }

  function bookingStep(text) {
    var b = state.booking;
    var lower = norm(text);
    if (hasAny(lower, T.en.cancelWords) || hasAny(lower, T.ar.cancelWords)) {
      state.booking = null;
      botSay(t("bookCancel"), t("chipsHome"));
      return;
    }
    if (b.step === "name") {
      b.name = text.trim().slice(0, 60);
      b.step = "guests";
      botSay(fmt(t("bookGuests"), { name: escapeHtml(b.name) }), t("chipsGuests"));
    } else if (b.step === "guests") {
      var num = (text.match(/\d+/) || [])[0];
      // Eastern Arabic numerals
      if (!num) {
        var east = text.replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); });
        num = (east.match(/\d+/) || [])[0];
      }
      if (!num || +num < 1 || +num > 100) {
        botSay(t("bookGuestsInvalid"), t("chipsGuests"));
        return;
      }
      b.guests = num;
      b.step = "date";
      botSay(fmt(t("bookDate"), { n: num }), t("chipsDate"));
    } else if (b.step === "date") {
      b.date = text.trim().slice(0, 40);
      b.step = "time";
      botSay(t("bookTime"), t("chipsTime"));
    } else if (b.step === "time") {
      b.time = text.trim().slice(0, 30);
      b.step = "confirm";
      botSay(
        t("bookConfirm") + "<br><br>" +
        fmt(t("bookSummary"), { name: escapeHtml(b.name), n: b.guests, date: escapeHtml(b.date), time: escapeHtml(b.time) }),
        [
          { t: t("bookYes"), v: "__confirm_booking__" },
          { t: t("bookEdit"), v: "__restart_booking__" }
        ]
      );
    }
  }

  function confirmBooking() {
    var b = state.booking;
    state.booking = null;
    var msg = fmt(t("waBooking"), {
      city: CONFIG.city, name: b.name, n: b.guests, date: b.date, time: b.time
    });
    var url = "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(msg);
    var cta = '<a class="zk-cta" href="' + url + '" target="_blank" rel="noopener">' + t("bookWhatsBtn") + "</a>";
    // Smart, soft post-booking suggestion: signature dish that needs prep time
    var sig = byId.stuffedpigeon;
    var after = fmt(t("bookAfter"), { item: sig.name[state.lang] });
    botSay(t("bookDone") + "<br>" + cta + "<br><br>" + after, t("chipsAfterRec"));
  }

  /* ----------------------------------------------------------
     Brain — local intent router (instant)
     ---------------------------------------------------------- */
  function respond(text) {
    var lower = norm(text);

    if (state.booking) { bookingStep(text); return; }

    if (hasAny(lower, KW.booking)) { startBooking(); return; }

    if (hasAny(lower, KW.hours)) {
      botSay(fmt(t("hours"), {
        hours: CONFIG.hours[state.lang],
        address: CONFIG.address[state.lang],
        maps: CONFIG.mapsUrl
      }), t("chipsHome"));
      return;
    }

    if (hasAny(lower, KW.human)) {
      var url = "https://wa.me/" + CONFIG.whatsappNumber;
      botSay(t("human") + '<br><a class="zk-cta" href="' + url + '" target="_blank" rel="noopener">' + t("humanBtn") + "</a>", t("chipsHome"));
      return;
    }

    // Desserts and drinks aren't on the published menu — be honest
    // and steer back to the food instead of inventing items.
    if (hasAny(lower, KW.dessert)) {
      botSay(t("dessertReply"), t("chipsHome").slice(0, 4));
      return;
    }

    if (hasAny(lower, KW.drinks)) {
      botSay(t("drinksReply"), t("chipsHome").slice(0, 4));
      return;
    }

    if (hasAny(lower, KW.veg)) {
      var v = pickItems({ tags: ["veg"], cats: ["main"], n: 3 });
      botSay(t("recVeg"), t("chipsAfterRec"), v.items);
      return;
    }

    // No seafood at Sobhy Kaber — say so and offer light grills instead
    if (hasAny(lower, KW.seafood)) {
      var s = pickItems({ tags: ["light"], cats: ["grill", "main"], n: 3 });
      botSay(t("noSeafood"), t("chipsAfterRec"), s.items);
      return;
    }

    if (hasAny(lower, KW.bestsellers) || hasAny(lower, KW.menu)) {
      var best = MENU.filter(function (m) { return m.tags.indexOf("bestseller") !== -1 || m.tags.indexOf("signature") !== -1; }).slice(0, 4);
      best.forEach(function (m) { state.shownIds[m.id] = true; });
      botSay(t("recBestsellers"), t("chipsAfterRec"), best);
      return;
    }

    if (hasAny(lower, KW.more)) { recommend(lower, "recMore"); return; }

    // Preference-driven recommendation (meat/chicken/spicy/light/etc.)
    var tags = extractTags(lower);
    if (tags.length) {
      recommend(lower, tags.indexOf("light") !== -1 && tags.length === 1 ? "recLight" : "recIntro");
      return;
    }

    if (hasAny(lower, KW.help)) { botSay(t("askPrefs"), t("chipsHome").slice(0, 3)); return; }
    if (hasAny(lower, KW.thanks)) { botSay(t("thanks"), t("chipsHome")); return; }
    if (hasAny(lower, KW.bye)) { botSay(t("bye"), []); return; }
    if (hasAny(lower, KW.greeting)) { botSay(fmt(t("greeting"), { city: CONFIG.city }), t("chipsHome")); return; }

    botSay(t("fallback"), t("chipsHome"));
  }

  /* ----------------------------------------------------------
     Optional LLM endpoint — tries the backend, falls back to the
     instant local engine on any error or slow response.
     ---------------------------------------------------------- */
  function respondViaAi(text) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 6000);
    fetch(CONFIG.aiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({ lang: state.lang, messages: state.history.concat([{ role: "user", content: text }]) })
    }).then(function (r) { return r.json(); }).then(function (data) {
      clearTimeout(timer);
      if (data && data.reply) botSay(escapeHtml(data.reply).replace(/\n/g, "<br>"), t("chipsHome"));
      else respond(text);
    }).catch(function () {
      clearTimeout(timer);
      respond(text);
    });
  }

  /* ----------------------------------------------------------
     Input handling
     ---------------------------------------------------------- */
  function handleUserText(value, display) {
    if (!value) return;

    if (value === "__confirm_booking__") {
      addRow(escapeHtml(display || value), "user");
      confirmBooking();
      return;
    }
    if (value === "__restart_booking__") {
      addRow(escapeHtml(display || value), "user");
      startBooking();
      return;
    }

    // Auto language switch from guest's writing (not during the name step,
    // where an Arabic name shouldn't flip an English conversation)
    if (!(state.booking && state.booking.step === "name")) {
      if (isArabic(value)) setLang("ar");
    }

    addRow(escapeHtml(display || value), "user");
    state.history.push({ role: "user", content: value });
    if (state.history.length > 24) state.history = state.history.slice(-24);

    if (CONFIG.aiEndpoint && !state.booking) respondViaAi(value);
    else respond(value);
  }

  function submit() {
    var v = el.field.value.trim();
    if (!v) return;
    el.field.value = "";
    handleUserText(v);
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildDom);
  } else {
    buildDom();
  }
})();
