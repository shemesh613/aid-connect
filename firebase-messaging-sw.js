// Firebase Messaging Service Worker
// This file must be named exactly "firebase-messaging-sw.js" at the root
// It imports the main service worker which handles both caching and FCM

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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || 'Aid Connect - קריאה חדשה!';
  const options = {
    body: notification.body || 'קריאה חדשה ממתינה לך',
    icon: '/aid-connect/icons/icon-192.png',
    badge: '/aid-connect/icons/icon-192.png',
    tag: data.taskId || 'new-task',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: data,
    dir: 'rtl',
    lang: 'he',
    actions: [
      { action: 'take', title: 'אני לוקח!' },
      { action: 'view', title: 'צפה' }
    ]
  };

  return self.registration.showNotification(title, options);
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const taskId = event.notification.data?.taskId;
  let url = '/aid-connect/app.html';

  if (event.action === 'take' && taskId) {
    url = `/aid-connect/app.html?action=take&task=${taskId}`;
  } else if (taskId) {
    url = `/aid-connect/app.html?task=${taskId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes('app.html') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
