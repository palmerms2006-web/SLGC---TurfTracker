// Service worker for Spring Lakes Golf Club Turf Tracker — handles push notifications.
// Must be hosted at your site's root (e.g. https://yoursite.com/sw.js) so its scope
// covers the whole app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Reapplication due soon', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Reapplication due soon';
  const options = {
    body: data.body || '',
    tag: data.tag || 'reapply',
    data: { url: data.url || '/' },
    requireInteraction: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
