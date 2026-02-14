// ============================================
// Aid Connect - Push Notification Sender
// Runs via GitHub Actions when a task is created/updated
// ============================================

const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const fcm = admin.messaging();

const TASK_TYPES = {
  medical: '🏥 רפואה / עזרה ראשונה',
  transport: '🚗 הסעה / שינוע',
  shopping: '🛒 קניות / משלוחים',
  general: '🤝 עזרה כללית'
};

const URGENCY_LABELS = {
  high: '🔴 דחוף!',
  medium: '🟠 בינוני',
  low: '🟢 רגיל'
};

async function sendTaskNotification(payload) {
  const { eventType, taskId, taskData } = payload;

  if (eventType === 'task_created') {
    await notifyVolunteers(taskId, taskData);
  } else if (eventType === 'task_taken') {
    await notifyAdmin(taskId, taskData, 'taken');
  } else if (eventType === 'task_completed') {
    await notifyAdmin(taskId, taskData, 'completed');
  }
}

async function notifyVolunteers(taskId, task) {
  const title = `${URGENCY_LABELS[task.urgency] || ''} משימה חדשה!`;
  const body = `${TASK_TYPES[task.type] || ''} - ${task.title}`;

  // Get all volunteer FCM tokens
  const volunteersSnapshot = await db.collection('users')
    .where('role', '==', 'volunteer')
    .where('active', '==', true)
    .get();

  const tokens = [];
  volunteersSnapshot.forEach(doc => {
    const token = doc.data().fcmToken;
    if (token) tokens.push(token);
  });

  if (tokens.length === 0) {
    console.log('No volunteer tokens found');
    return;
  }

  console.log(`Sending to ${tokens.length} volunteers...`);

  const message = {
    notification: { title, body },
    data: {
      taskId: taskId || '',
      type: task.type || 'general',
      urgency: task.urgency || 'low',
      click_action: 'OPEN_TASK'
    },
    webpush: {
      notification: {
        icon: 'https://shemesh613.github.io/aid-connect/icons/icon-192.png',
        badge: 'https://shemesh613.github.io/aid-connect/icons/icon-192.png',
        dir: 'rtl',
        lang: 'he',
        vibrate: [200, 100, 200, 100, 200],
        tag: taskId || 'new-task',
        renotify: true
      }
    },
    tokens: tokens
  };

  const response = await fcm.sendEachForMulticast(message);
  console.log(`Sent: ${response.successCount}/${tokens.length}`);

  // Clean up invalid tokens
  if (response.failureCount > 0) {
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      const batch = db.batch();
      for (const token of invalidTokens) {
        const snap = await db.collection('users').where('fcmToken', '==', token).get();
        snap.forEach(doc => batch.update(doc.ref, { fcmToken: null }));
      }
      await batch.commit();
      console.log(`Cleaned ${invalidTokens.length} invalid tokens`);
    }
  }
}

async function notifyAdmin(taskId, task, type) {
  if (!task.createdBy) return;

  const adminDoc = await db.collection('users').doc(task.createdBy).get();
  if (!adminDoc.exists) return;

  const adminData = adminDoc.data();
  if (!adminData.fcmToken) return;

  const titles = {
    taken: '✅ משימה נלקחה!',
    completed: '🎉 משימה הושלמה!'
  };

  const bodies = {
    taken: `${task.takenByName || 'מתנדב'} לקח את: ${task.title}`,
    completed: `${task.takenByName || 'מתנדב'} סיים את: ${task.title}`
  };

  const message = {
    notification: {
      title: titles[type],
      body: bodies[type]
    },
    data: { taskId: taskId || '', type: `task_${type}` },
    token: adminData.fcmToken
  };

  await fcm.send(message);
  console.log(`Admin notified: ${type}`);
}

// Main
(async () => {
  try {
    const payload = JSON.parse(process.env.NOTIFICATION_PAYLOAD || '{}');
    console.log('Processing notification:', payload.eventType);
    await sendTaskNotification(payload);
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
