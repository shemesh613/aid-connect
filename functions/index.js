// ============================================
// Aid Connect - Firebase Cloud Functions
// ============================================
// Deploy: firebase deploy --only functions
// ============================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

// ==========================================
// Task Type Labels
// ==========================================
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

// ==========================================
// TRIGGER: New Task Created
// Send push notification to all volunteers
// ==========================================
exports.onTaskCreated = functions.firestore
  .document('tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const task = snap.data();
    const taskId = context.params.taskId;

    // Build notification
    const title = `${URGENCY_LABELS[task.urgency] || ''} משימה חדשה!`;
    const body = `${TASK_TYPES[task.type] || ''}\n${task.title}`;

    // Get all volunteer FCM tokens
    const volunteersSnapshot = await db.collection('users')
      .where('role', '==', 'volunteer')
      .where('active', '==', true)
      .where('fcmToken', '!=', null)
      .get();

    const tokens = [];
    volunteersSnapshot.forEach(doc => {
      const token = doc.data().fcmToken;
      if (token) tokens.push(token);
    });

    if (tokens.length === 0) {
      console.log('No volunteer tokens found');
      return null;
    }

    // Send to all volunteers
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: {
        taskId: taskId,
        type: task.type || 'general',
        urgency: task.urgency || 'low',
        click_action: 'OPEN_TASK'
      },
      tokens: tokens
    };

    try {
      const response = await fcm.sendEachForMulticast(message);
      console.log(`Notifications sent: ${response.successCount}/${tokens.length}`);

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(tokens[idx]);
          }
        });

        // Clean up invalid tokens
        if (invalidTokens.length > 0) {
          const batch = db.batch();
          const snapshot = await db.collection('users')
            .where('fcmToken', 'in', invalidTokens)
            .get();
          snapshot.forEach(doc => {
            batch.update(doc.ref, { fcmToken: null });
          });
          await batch.commit();
          console.log(`Cleaned ${invalidTokens.length} invalid tokens`);
        }
      }

      return response;
    } catch (error) {
      console.error('FCM send error:', error);
      return null;
    }
  });

// ==========================================
// TRIGGER: Task Taken
// Notify admin that a volunteer took the task
// ==========================================
exports.onTaskTaken = functions.firestore
  .document('tasks/{taskId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const taskId = context.params.taskId;

    // Only trigger when status changes to 'taken'
    if (before.status === 'taken' || after.status !== 'taken') return null;

    // Notify the admin who created the task
    const adminDoc = await db.collection('users').doc(after.createdBy).get();
    if (!adminDoc.exists) return null;

    const adminData = adminDoc.data();
    if (!adminData.fcmToken) return null;

    const message = {
      notification: {
        title: '✅ משימה נלקחה!',
        body: `${after.takenByName || 'מתנדב'} לקח את: ${after.title}`
      },
      data: {
        taskId: taskId,
        type: 'task_taken'
      },
      token: adminData.fcmToken
    };

    try {
      await fcm.send(message);
      console.log('Admin notified about taken task');
    } catch (error) {
      console.error('Admin notification error:', error);
    }

    return null;
  });

// ==========================================
// TRIGGER: Task Completed
// Notify admin that task was completed
// ==========================================
exports.onTaskCompleted = functions.firestore
  .document('tasks/{taskId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const taskId = context.params.taskId;

    // Only trigger when status changes to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') return null;

    // Notify the admin who created the task
    const adminDoc = await db.collection('users').doc(after.createdBy).get();
    if (!adminDoc.exists) return null;

    const adminData = adminDoc.data();
    if (!adminData.fcmToken) return null;

    const message = {
      notification: {
        title: '🎉 משימה הושלמה!',
        body: `${after.takenByName || 'מתנדב'} סיים את: ${after.title}`
      },
      data: {
        taskId: taskId,
        type: 'task_completed'
      },
      token: adminData.fcmToken
    };

    try {
      await fcm.send(message);
      console.log('Admin notified about completed task');
    } catch (error) {
      console.error('Admin notification error:', error);
    }

    return null;
  });
