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
    // TODO: replace with the restaurant's real WhatsApp number (country code, no +)
    whatsappNumber: "201000000000",
    phoneDisplay: "+20 100 000 0000",
    hours: { en: "Daily 12:00 PM – 2:00 AM", ar: "يوميًا من ١٢ ظهرًا حتى ٢ صباحًا" },
    address: {
      en: "Sobhy Kaber, Naama Bay area, Sharm El Sheikh, South Sinai",
      ar: "صبحي كابر، منطقة خليج نعمة، شرم الشيخ، جنوب سيناء"
    },
    mapsUrl: "https://maps.google.com/?q=Sobhy+Kaber+Sharm+El+Sheikh",
    currency: { en: "EGP", ar: "ج.م" },
    // Optional LLM upgrade: URL of a backend that accepts
    // POST {messages:[{role,content}...]} and returns {reply:"..."}.
    // Leave null to use the built-in instant engine only.
    aiEndpoint: null,
    typingDelayMs: [350, 700] // min/max "thinking" delay — feels alive, stays fast
  };

  /* ----------------------------------------------------------
     MENU DATA — sample menu, edit freely.
     tags: beef, lamb, chicken, pigeon, seafood, veg, spicy,
           light, hearty, kids, signature, bestseller, budget
     pair: id of a smart upsell companion
     ---------------------------------------------------------- */
  var MENU = [
    // Starters
    { id: "tahina", cat: "starter", price: 45, tags: ["veg", "light", "budget"], pair: "mixedgrill",
      name: { en: "Tahina & Fresh Baladi Bread", ar: "طحينة وعيش بلدي" },
      desc: { en: "Creamy sesame dip, the classic opener to any grill feast.", ar: "طحينة كريمي، البداية الكلاسيكية لأي وليمة مشويات." } },
    { id: "babaganoush", cat: "starter", price: 60, tags: ["veg", "light", "budget"], pair: "kofta",
      name: { en: "Baba Ghanoush", ar: "بابا غنوج" },
      desc: { en: "Smoky roasted eggplant with tahini, garlic and lemon.", ar: "باذنجان مشوي مدخن مع طحينة وثوم وليمون." } },
    { id: "vineleaves", cat: "starter", price: 90, tags: ["veg", "light"], pair: "lemonmint",
      name: { en: "Stuffed Vine Leaves (Warak Enab)", ar: "ورق عنب محشي" },
      desc: { en: "Hand-rolled vine leaves with herbed rice, slow-cooked.", ar: "ورق عنب ملفوف يدويًا بأرز بالأعشاب، مطهو ببطء." } },
    { id: "lentilsoup", cat: "starter", price: 70, tags: ["veg", "light", "budget", "kids"], pair: "halfchicken",
      name: { en: "Egyptian Lentil Soup", ar: "شوربة عدس مصرية" },
      desc: { en: "Golden lentils with cumin, served with crispy bread.", ar: "عدس أصفر بالكمون، يقدم مع عيش محمص." } },
    { id: "salad", cat: "starter", price: 50, tags: ["veg", "light", "budget", "kids"], pair: "mixedgrill",
      name: { en: "Oriental Salad", ar: "سلطة شرقية" },
      desc: { en: "Fresh tomato, cucumber and herbs with lemon dressing.", ar: "طماطم وخيار وأعشاب طازجة بتتبيلة الليمون." } },
    { id: "taameya", cat: "starter", price: 80, tags: ["veg", "budget"], pair: "karkadeh",
      name: { en: "Taameya Plate (Egyptian Falafel)", ar: "طبق طعمية" },
      desc: { en: "Crispy fava-bean falafel with tahina and pickles.", ar: "طعمية مقرمشة من الفول مع طحينة ومخلل." } },

    // Grills — the house specialty
    { id: "mixedgrill", cat: "grill", price: 450, tags: ["beef", "lamb", "chicken", "hearty", "bestseller", "signature"], pair: "tahina",
      name: { en: "Sobhy Kaber Mixed Grill Platter", ar: "مشكل مشويات صبحي كابر" },
      desc: { en: "Kofta, kebab, shish tawook and lamb over charcoal — the house legend.", ar: "كفتة وكباب وشيش طاووق وضأن على الفحم — أسطورة المحل." } },
    { id: "kofta", cat: "grill", price: 280, tags: ["beef", "hearty", "bestseller", "kids"], pair: "babaganoush",
      name: { en: "Charcoal Kofta", ar: "كفتة على الفحم" },
      desc: { en: "Hand-minced spiced beef, grilled the Sobhy Kaber way.", ar: "لحم مفروم متبل على الطريقة الأصلية." } },
    { id: "kebab", cat: "grill", price: 320, tags: ["beef", "hearty"], pair: "salad",
      name: { en: "Veal Kebab Skewers", ar: "كباب بتلو" },
      desc: { en: "Tender veal cubes char-grilled over open flame.", ar: "مكعبات بتلو طرية مشوية على نار الفحم." } },
    { id: "tawook", cat: "grill", price: 260, tags: ["chicken", "kids", "light"], pair: "lemonmint",
      name: { en: "Shish Tawook", ar: "شيش طاووق" },
      desc: { en: "Marinated chicken skewers, juicy and lightly charred.", ar: "أسياخ دجاج متبلة، طرية ومشوية بخفة." } },
    { id: "lambchops", cat: "grill", price: 480, tags: ["lamb", "hearty", "signature"], pair: "vineleaves",
      name: { en: "Lamb Chops (Riyash)", ar: "ريش ضاني" },
      desc: { en: "Premium lamb ribs, smoky and tender off the charcoal.", ar: "ريش ضاني فاخرة، مدخنة وطرية من على الفحم." } },
    { id: "pigeon", cat: "grill", price: 300, tags: ["pigeon", "signature", "hearty"], pair: "lentilsoup",
      name: { en: "Grilled Stuffed Pigeon (Hamam Mahshi)", ar: "حمام محشي مشوي" },
      desc: { en: "Whole pigeon stuffed with seasoned freek — a true Egyptian delicacy.", ar: "حمام محشي فريك متبل — أكلة مصرية أصيلة." } },
    { id: "mombar", cat: "grill", price: 150, tags: ["beef", "budget", "hearty"], pair: "karkadeh",
      name: { en: "Mombar (Stuffed Sausage)", ar: "ممبار" },
      desc: { en: "Crispy stuffed sausage with spiced rice — a beloved street classic.", ar: "ممبار مقرمش محشي أرز متبل — أكلة شعبية محبوبة." } },
    { id: "halfchicken", cat: "grill", price: 200, tags: ["chicken", "budget", "kids", "light"], pair: "salad",
      name: { en: "Charcoal Half Chicken", ar: "نص فرخة على الفحم" },
      desc: { en: "Half chicken in our secret marinade, flame-grilled.", ar: "نص فرخة بتتبيلتنا السرية على الفحم." } },

    // Mains & Egyptian classics
    { id: "fattah", cat: "main", price: 380, tags: ["beef", "hearty", "signature", "bestseller"], pair: "salad",
      name: { en: "Fattah with Veal Shank (Moza)", ar: "فتة بالموزة البتلو" },
      desc: { en: "Layers of rice, crispy bread and garlic-vinegar sauce crowned with slow-cooked veal shank.", ar: "طبقات أرز وعيش محمص وصلصة خل بالثوم مع موزة بتلو متسبكة." } },
    { id: "molokhia", cat: "main", price: 250, tags: ["chicken", "hearty", "kids"], pair: "halfchicken",
      name: { en: "Molokhia with Chicken", ar: "ملوخية بالفراخ" },
      desc: { en: "Silky green molokhia with garlic ta'leya, served with rice.", ar: "ملوخية خضراء بالتقلية، تقدم مع الأرز." } },
    { id: "mahshi", cat: "main", price: 180, tags: ["veg", "hearty", "budget"], pair: "karkadeh",
      name: { en: "Mixed Mahshi (Stuffed Vegetables)", ar: "محشي مشكل" },
      desc: { en: "Zucchini, peppers and cabbage stuffed with herbed rice.", ar: "كوسة وفلفل وكرنب محشي أرز بالأعشاب." } },
    { id: "seabass", cat: "main", price: 420, tags: ["seafood", "light", "signature"], pair: "salad",
      name: { en: "Grilled Red Sea Bass", ar: "قاروص البحر الأحمر مشوي" },
      desc: { en: "Local catch grilled whole with lemon, garlic and herbs.", ar: "صيد محلي مشوي بالليمون والثوم والأعشاب." } },
    { id: "shrimp", cat: "main", price: 550, tags: ["seafood", "signature"], pair: "lemonmint",
      name: { en: "Jumbo Red Sea Shrimp", ar: "جمبري جامبو البحر الأحمر" },
      desc: { en: "Char-grilled jumbo shrimp with our spiced butter.", ar: "جمبري جامبو مشوي بزبدة متبلة." } },

    // Desserts
    { id: "omali", cat: "dessert", price: 95, tags: ["bestseller", "kids"], pair: "tea",
      name: { en: "Om Ali", ar: "أم علي" },
      desc: { en: "Warm bread pudding with milk, nuts and cream — baked to order.", ar: "أم علي ساخنة باللبن والمكسرات والقشطة." } },
    { id: "ricepudding", cat: "dessert", price: 70, tags: ["kids", "light", "budget"], pair: "tea",
      name: { en: "Rice Pudding (Roz bel Laban)", ar: "أرز باللبن" },
      desc: { en: "Creamy chilled rice pudding with cinnamon.", ar: "أرز باللبن كريمي بارد بالقرفة." } },
    { id: "konafa", cat: "dessert", price: 110, tags: ["bestseller"], pair: "coffee",
      name: { en: "Konafa with Cream", ar: "كنافة بالقشطة" },
      desc: { en: "Golden crispy konafa filled with fresh cream and syrup.", ar: "كنافة ذهبية مقرمشة بالقشطة والشربات." } },

    // Drinks
    { id: "mango", cat: "drink", price: 75, tags: ["kids"], pair: null,
      name: { en: "Fresh Mango Juice", ar: "عصير مانجو طازج" },
      desc: { en: "Thick Egyptian mango, blended fresh.", ar: "مانجو مصري طازج." } },
    { id: "lemonmint", cat: "drink", price: 60, tags: ["light", "budget"], pair: null,
      name: { en: "Fresh Lemon Mint", ar: "ليمون بالنعناع" },
      desc: { en: "Iced fresh lemon with mint — perfect next to the grill.", ar: "ليمون طازج مثلج بالنعناع — مثالي مع المشويات." } },
    { id: "karkadeh", cat: "drink", price: 50, tags: ["light", "budget"], pair: null,
      name: { en: "Karkadeh (Hibiscus)", ar: "كركديه" },
      desc: { en: "Chilled hibiscus, lightly sweet and refreshing.", ar: "كركديه مثلج منعش." } },
    { id: "tea", cat: "drink", price: 35, tags: ["budget"], pair: null,
      name: { en: "Mint Tea", ar: "شاي بالنعناع" },
      desc: { en: "Egyptian black tea with fresh mint.", ar: "شاي أسود بالنعناع الطازج." } },
    { id: "coffee", cat: "drink", price: 45, tags: ["budget"], pair: null,
      name: { en: "Turkish Coffee", ar: "قهوة تركي" },
      desc: { en: "Rich Turkish coffee, made to your taste.", ar: "قهوة تركي على ذوقك." } }
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
      askPrefs: "Happy to! Quick question so I nail it: are you in the mood for <b>charcoal grills</b>, <b>Egyptian classics</b>, <b>seafood</b>, or something <b>vegetarian</b>? Light or hearty?",
      recIntro: "Great taste coming up. Based on what you told me, I'd go for:",
      recBestsellers: "These are the plates our regulars cross the city for:",
      recVeg: "Plenty of green goodness here — these are my favorites:",
      recSeafood: "Fresh from the Red Sea this morning:",
      recLight: "Something light and lovely:",
      recMore: "A few more gems you might love:",
      upsell: "Small tip: <b>{item}</b> ({price} {cur}) goes beautifully with that. Most guests don't regret it. 😉",
      signatureNudge: "And if you're celebrating something, the <b>{item}</b> is our signature — worth knowing about.",
      dessertIntro: "Save room — these are dangerous:",
      drinksIntro: "To drink, I'd suggest:",
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
      askPrefs: "من عنيا! سؤال سريع عشان أظبطك: نفسك في <b>مشويات فحم</b>، <b>أكل مصري أصيل</b>، <b>سي فود</b>، ولا <b>أكل نباتي</b>؟ خفيف ولا دسم؟",
      recIntro: "ذوقك عالي. على حسب كلامك، أنا أرشحلك:",
      recBestsellers: "دي الأطباق اللي الزباين بييجوا من آخر الدنيا عشانها:",
      recVeg: "عندنا خير نباتي كتير — دول المفضلين عندي:",
      recSeafood: "طازة من البحر الأحمر النهارده الصبح:",
      recLight: "حاجة خفيفة وجميلة:",
      recMore: "كمان شوية جواهر ممكن تعجبك:",
      upsell: "نصيحة صغيرة: <b>{item}</b> ({price} {cur}) بيظبط معاها جدًا. محدش ندم. 😉",
      signatureNudge: "ولو بتحتفلوا بحاجة، <b>{item}</b> هو طبقنا المميز — يستاهل تعرفه.",
      dessertIntro: "سيب مكان للحلو — دول خطر:",
      drinksIntro: "للمشروبات، أرشحلك:",
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
     ICON — Zaki's face: a chef's toque with a spark, on an ember
     gradient badge. Used for the launcher and the avatar.
     ---------------------------------------------------------- */
  var ICON_SVG =
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="zkg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#f0a04b"/><stop offset="1" stop-color="#e8722a"/>' +
    '</linearGradient></defs>' +
    '<circle cx="32" cy="32" r="32" fill="url(#zkg)"/>' +
    // chef toque
    '<path d="M20 38v-5.5c-3.3-.9-5.5-3.6-5.5-7 0-4 3.2-7.2 7.2-7.2.6 0 1.2.1 1.8.2C25 15.6 28.2 14 32 14s7 1.6 8.5 4.5c.6-.1 1.2-.2 1.8-.2 4 0 7.2 3.2 7.2 7.2 0 3.4-2.2 6.1-5.5 7V38H20z" fill="#fff8ef"/>' +
    '<rect x="20" y="40" width="24" height="6" rx="2" fill="#fff8ef"/>' +
    '<line x1="27" y1="33" x2="27" y2="38" stroke="#e8c9a8" stroke-width="1.6" stroke-linecap="round"/>' +
    '<line x1="32" y1="33" x2="32" y2="38" stroke="#e8c9a8" stroke-width="1.6" stroke-linecap="round"/>' +
    '<line x1="37" y1="33" x2="37" y2="38" stroke="#e8c9a8" stroke-width="1.6" stroke-linecap="round"/>' +
    // spark
    '<path d="M48 10l1.5 3.5L53 15l-3.5 1.5L48 20l-1.5-3.5L43 15l3.5-1.5z" fill="#fff" opacity=".95"/>' +
    '</svg>';

  /* ----------------------------------------------------------
     Styles
     ---------------------------------------------------------- */
  var CSS = [
    ":root{--zk-ember:#e8722a;--zk-amber:#f0a04b;--zk-char:#1c1410;--zk-cream:#faf3e7;--zk-ink:#2b2118;}",
    "#zaki-launcher{position:fixed;bottom:22px;right:22px;z-index:99990;width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;padding:0;background:transparent;box-shadow:0 8px 28px rgba(232,114,42,.45);transition:transform .2s ease;}",
    "#zaki-launcher:hover{transform:scale(1.08);}",
    "#zaki-launcher svg{width:100%;height:100%;display:block;border-radius:50%;}",
    "#zaki-launcher .zk-pulse{position:absolute;inset:0;border-radius:50%;animation:zkPulse 2.4s ease-out infinite;border:2px solid rgba(232,114,42,.5);}",
    "@keyframes zkPulse{0%{transform:scale(1);opacity:.8}70%{transform:scale(1.45);opacity:0}100%{opacity:0}}",
    "#zaki-launcher .zk-badge{position:absolute;top:-2px;right:-2px;background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;}",
    "#zaki-panel{position:fixed;bottom:96px;right:22px;z-index:99991;width:382px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:var(--zk-cream);border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(28,20,16,.35);opacity:0;transform:translateY(16px) scale(.97);pointer-events:none;transition:opacity .22s ease,transform .22s ease;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;}",
    "#zaki-panel.zk-open{opacity:1;transform:none;pointer-events:auto;}",
    "@media (max-width:480px){#zaki-panel{right:12px;left:12px;width:auto;bottom:90px;height:76vh;}}",
    ".zk-head{display:flex;align-items:center;gap:12px;padding:14px 16px;background:linear-gradient(135deg,var(--zk-char),#3a2417);color:#fff;flex-shrink:0;}",
    ".zk-head .zk-avatar{width:44px;height:44px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 2px rgba(240,160,75,.6);}",
    ".zk-head .zk-avatar svg{width:100%;height:100%;display:block;border-radius:50%;}",
    ".zk-head-info{flex:1;min-width:0;}",
    ".zk-head-info .zk-name{font-weight:700;font-size:16px;letter-spacing:.2px;}",
    ".zk-head-info .zk-status{font-size:11.5px;opacity:.85;display:flex;align-items:center;gap:5px;margin-top:2px;}",
    ".zk-head-info .zk-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;}",
    ".zk-head button{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:9px;cursor:pointer;font-size:13px;padding:6px 10px;transition:background .15s;}",
    ".zk-head button:hover{background:rgba(255,255,255,.25);}",
    ".zk-msgs{flex:1;overflow-y:auto;padding:16px 14px 8px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;}",
    ".zk-msgs::-webkit-scrollbar{width:5px}.zk-msgs::-webkit-scrollbar-thumb{background:rgba(28,20,16,.18);border-radius:3px}",
    ".zk-row{display:flex;margin-bottom:10px;animation:zkIn .25s ease both;}",
    "@keyframes zkIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
    ".zk-row.zk-bot{justify-content:flex-start}.zk-row.zk-user{justify-content:flex-end}",
    ".zk-bub{max-width:84%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;color:var(--zk-ink);word-wrap:break-word;}",
    ".zk-bot .zk-bub{background:#fff;border-bottom-left-radius:5px;box-shadow:0 1px 4px rgba(28,20,16,.08);}",
    ".zk-user .zk-bub{background:linear-gradient(135deg,var(--zk-ember),var(--zk-amber));color:#fff;border-bottom-right-radius:5px;}",
    ".zk-bub a{color:var(--zk-ember);font-weight:600;}",
    "[dir=rtl] .zk-bot .zk-bub{border-radius:16px;border-bottom-right-radius:5px;}",
    "[dir=rtl] .zk-user .zk-bub{border-radius:16px;border-bottom-left-radius:5px;}",
    ".zk-card{background:#fff;border:1px solid rgba(232,114,42,.22);border-radius:14px;padding:10px 12px;margin:8px 0 2px;max-width:88%;box-shadow:0 1px 5px rgba(28,20,16,.07);animation:zkIn .25s ease both;}",
    ".zk-card .zk-card-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;}",
    ".zk-card .zk-card-name{font-weight:700;font-size:13.5px;color:var(--zk-char);}",
    ".zk-card .zk-card-price{font-weight:700;font-size:13px;color:var(--zk-ember);white-space:nowrap;}",
    ".zk-card .zk-card-desc{font-size:12.5px;color:#6b5a4a;margin-top:3px;line-height:1.45;}",
    ".zk-chips{display:flex;flex-wrap:wrap;gap:7px;padding:4px 14px 10px;flex-shrink:0;}",
    ".zk-chip{background:#fff;border:1.5px solid rgba(232,114,42,.45);color:var(--zk-char);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;animation:zkIn .3s ease both;}",
    ".zk-chip:hover{background:var(--zk-ember);border-color:var(--zk-ember);color:#fff;transform:translateY(-1px);}",
    ".zk-cta{display:inline-block;margin-top:8px;background:#25d366;color:#fff!important;font-weight:700;font-size:13px;border-radius:11px;padding:10px 14px;text-decoration:none;box-shadow:0 4px 14px rgba(37,211,102,.35);transition:transform .15s;}",
    ".zk-cta:hover{transform:translateY(-1px);}",
    ".zk-typing{display:inline-flex;gap:4px;padding:12px 16px;background:#fff;border-radius:16px;border-bottom-left-radius:5px;box-shadow:0 1px 4px rgba(28,20,16,.08);}",
    ".zk-typing span{width:7px;height:7px;border-radius:50%;background:var(--zk-amber);animation:zkDots 1.1s infinite;}",
    ".zk-typing span:nth-child(2){animation-delay:.18s}.zk-typing span:nth-child(3){animation-delay:.36s}",
    "@keyframes zkDots{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}",
    ".zk-input{display:flex;gap:8px;padding:10px 12px 12px;background:#fff;border-top:1px solid rgba(28,20,16,.08);flex-shrink:0;}",
    ".zk-input input{flex:1;border:1.5px solid rgba(28,20,16,.14);border-radius:12px;padding:11px 13px;font-size:14px;outline:none;background:var(--zk-cream);color:var(--zk-ink);transition:border-color .15s;min-width:0;}",
    ".zk-input input:focus{border-color:var(--zk-amber);}",
    ".zk-input button{background:linear-gradient(135deg,var(--zk-ember),var(--zk-amber));color:#fff;border:none;border-radius:12px;width:46px;cursor:pointer;font-size:17px;flex-shrink:0;transition:transform .15s;display:flex;align-items:center;justify-content:center;}",
    ".zk-input button:hover{transform:scale(1.06);}",
    ".zk-foot{text-align:center;font-size:10px;color:#a08a72;padding:0 0 7px;background:#fff;flex-shrink:0;}"
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
    card.innerHTML =
      '<div class="zk-card-top">' +
      '<span class="zk-card-name">' + escapeHtml(item.name[state.lang]) + '</span>' +
      '<span class="zk-card-price">' + item.price + " " + CONFIG.currency[state.lang] + '</span>' +
      '</div>' +
      '<div class="zk-card-desc">' + escapeHtml(item.desc[state.lang]) + '</div>';
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
    var cats = opts.cats || ["grill", "main"];
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
    var sig = byId.fattah;
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

    if (hasAny(lower, KW.dessert)) {
      var d = pickItems({ tags: extractTags(lower), cats: ["dessert"], n: 3 });
      botSay(t("dessertIntro"), t("chipsAfterRec"), d.items);
      return;
    }

    if (hasAny(lower, KW.drinks)) {
      var dr = pickItems({ tags: extractTags(lower), cats: ["drink"], n: 3 });
      botSay(t("drinksIntro"), t("chipsAfterRec"), dr.items);
      return;
    }

    if (hasAny(lower, KW.veg)) {
      var v = pickItems({ tags: ["veg"], cats: ["starter", "main"], n: 4 });
      botSay(t("recVeg"), t("chipsAfterRec"), v.items);
      return;
    }

    if (hasAny(lower, KW.seafood)) {
      var s = pickItems({ tags: ["seafood"], cats: ["main"], n: 3 });
      botSay(t("recSeafood"), t("chipsAfterRec"), s.items);
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
