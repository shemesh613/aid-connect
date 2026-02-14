// ============================================
// Aid Connect - Push Notifications (FCM)
// ============================================

// Request notification permission and get FCM token
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await saveFCMToken();
      showToast('התראות הופעלו! 🔔');
      document.getElementById('notification-prompt').style.display = 'none';
    } else {
      showToast('התראות לא אושרו', 'error');
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    showToast('שגיאה בהפעלת התראות', 'error');
  }
}

// Save FCM token to Firestore
async function saveFCMToken() {
  try {
    if (!messaging) return;

    const token = await messaging.getToken({ vapidKey: VAPID_KEY });
    if (token) {
      const user = auth.currentUser;
      if (user) {
        await db.collection('users').doc(user.uid).update({
          fcmToken: token,
          fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('FCM Token saved');
      }
    }
  } catch (error) {
    console.error('FCM Token error:', error);
  }
}

// Handle foreground messages
function setupForegroundMessaging() {
  if (!messaging) return;

  messaging.onMessage((payload) => {
    console.log('Foreground message:', payload);

    const { title, body } = payload.notification || {};
    const taskId = payload.data?.taskId;

    // Show in-app notification
    showToast(body || title || 'משימה חדשה!');

    // Play notification sound
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGjmO0NzIZTUaOY7Q3MhlNRo=');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch(e) {}

    // Vibrate if available
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    // Refresh tasks if viewing tasks
    if (taskId) {
      // Tasks will auto-refresh via Firestore listener
    }
  });
}

// Check if notifications are enabled
function checkNotificationStatus() {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    // Already granted, ensure token is saved
    saveFCMToken();
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Show prompt to enable
  const prompt = document.getElementById('notification-prompt');
  if (prompt) prompt.style.display = '';
  return 'default';
}

// Toggle notification settings
function toggleNotifications() {
  const status = checkNotificationStatus();
  if (status === 'granted') {
    showToast('התראות כבר מופעלות ✅');
  } else if (status === 'denied') {
    showToast('התראות חסומות. שנה בהגדרות הדפדפן', 'error');
  } else if (status === 'unsupported') {
    showToast('הדפדפן לא תומך בהתראות', 'error');
  } else {
    requestNotificationPermission();
  }
}
