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

// scripts/notify.js sends DATA-only messages, so we display them explicitly
// here. This guarantees exactly one notification AND that it actually shows
// (relying on the browser's auto-display of notification payloads was
// unreliable and silently dropped pushes).
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "El 3eshّa WC26", {
    body: d.body || "",
    icon: d.icon || "group.jpg",
    badge: "group.jpg",
    tag: d.tag || undefined,
    data: { url: d.link || "./" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "./"));
});
