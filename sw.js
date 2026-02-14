// ============================================
// Aid Connect - Service Worker
// Push Notifications + Offline Cache
// ============================================

const CACHE_NAME = 'aid-connect-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/css/style.css',
  '/js/auth.js',
  '/js/tasks.js',
  '/js/notifications.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ==========================================
// INSTALL - Cache static assets
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ==========================================
// ACTIVATE - Clean old caches
// ==========================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ==========================================
// FETCH - Network first, fallback to cache
// ==========================================
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase/API requests
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then(response => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { notification: { title: 'Aid Connect', body: event.data?.text() || 'משימה חדשה!' } };
  }

  const notification = data.notification || {};
  const taskData = data.data || {};

  const title = notification.title || 'Aid Connect - משימה חדשה!';
  const options = {
    body: notification.body || 'משימה חדשה ממתינה לך',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: taskData.taskId || 'new-task',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: taskData,
    dir: 'rtl',
    lang: 'he',
    actions: [
      { action: 'take', title: 'אני לוקח!' },
      { action: 'view', title: 'צפה' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ==========================================
// NOTIFICATION CLICK
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const taskId = event.notification.data?.taskId;
  let url = '/app.html';

  if (event.action === 'take' && taskId) {
    url = `/app.html?action=take&task=${taskId}`;
  } else if (taskId) {
    url = `/app.html?task=${taskId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url.includes('app.html') && 'focus' in client) {
            client.postMessage({ type: 'TASK_NOTIFICATION', taskId, action: event.action });
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// ==========================================
// FIREBASE MESSAGING (Background)
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAiX5hNA0nHE5Ose3XoHY84n3y99pdL4F8",
  authDomain: "aid-connect-2059d.firebaseapp.com",
  projectId: "aid-connect-2059d",
  storageBucket: "aid-connect-2059d.firebasestorage.app",
  messagingSenderId: "214156347220",
  appId: "1:214156347220:web:bbde9a71c36119b1db6ac1"
});

const bgMessaging = firebase.messaging();

bgMessaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  // Push event handler above will show the notification
});
