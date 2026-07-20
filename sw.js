// Spring Lakes Golf Club Turf Tracker service worker
// Place this file beside index.html in the GitHub repository.

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
  } catch (error) {
    data = {
      title: 'Reapplication due soon',
      body: event.data ? event.data.text() : ''
    };
  }

  const title = data.title || 'Reapplication due soon';

  const options = {
    body: data.body || 'Open Turf Tracker for details.',
    tag: data.tag || `reapplication-${data.applicationId || 'alert'}`,
    data: {
      url: data.url || './?tab=applications'
    },
    requireInteraction: false,
    renotify: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const storedUrl =
    event.notification.data?.url || './?tab=applications';

  // Resolves relative URLs inside the GitHub Pages project folder.
  const destinationUrl = new URL(
    storedUrl,
    self.registration.scope
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(async (clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url);

          if (
            clientUrl.origin === new URL(destinationUrl).origin &&
            clientUrl.pathname.startsWith(
              new URL(self.registration.scope).pathname
            )
          ) {
            if ('navigate' in client) {
              await client.navigate(destinationUrl);
            }

            if ('focus' in client) {
              return client.focus();
            }
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl);
        }
      })
  );
});
