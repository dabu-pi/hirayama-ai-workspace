// Minimal service worker — Phase 2.7
// Purpose: enable PWA install / display:standalone on iOS & Android.
// No aggressive caching. All network requests pass through to the browser default.
// Cache strategies will be added in a later phase if needed.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// No fetch handler — requests are not intercepted.
