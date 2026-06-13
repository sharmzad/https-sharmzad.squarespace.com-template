/*
 * Firebase Cloud Messaging service worker — displays push notifications
 * when the app is closed. Must live next to index.html.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA-mPxIfqPWxd6Xo1qNFPGrlp7IL3xt3-A",
  authDomain: "gang-cup-2026.firebaseapp.com",
  projectId: "gang-cup-2026",
  storageBucket: "gang-cup-2026.firebasestorage.app",
  messagingSenderId: "618744827340",
  appId: "1:618744827340:web:4d74f6a8af830ae0f92169",
});

// Messages sent by scripts/notify.js carry a `notification` payload, which
// the browser displays automatically — displaying it here too would show
// every notification twice. We only keep messaging initialized for token
// management and handle taps below.
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
