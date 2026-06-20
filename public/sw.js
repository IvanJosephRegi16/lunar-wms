// Simple dummy service worker to satisfy PWA install requirements
self.addEventListener('install', () => {
  console.log('[SW] Install');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Activate');
});

self.addEventListener('fetch', (event) => {
  // We do not intercept any requests, just passing them through.
  // The mere presence of this fetch listener satisfies Chrome's PWA criteria.
  return;
});
