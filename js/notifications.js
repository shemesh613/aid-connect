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
      showNotificationGuide();
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    showNotificationGuide();
  }
}

// Save FCM token to Firestore
async function saveFCMToken() {
  try {
    if (!messaging) {
      console.log('Messaging not available');
      return;
    }

    // Register the firebase-messaging service worker explicitly
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        console.log('FCM SW registered:', swRegistration.scope);
      } catch (e) {
        console.error('FCM SW registration failed:', e);
      }
    }

    const tokenOptions = { vapidKey: VAPID_KEY };
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    const token = await messaging.getToken(tokenOptions);
    if (token) {
      const user = auth.currentUser;
      if (user) {
        await db.collection('users').doc(user.uid).update({
          fcmToken: token,
          fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('FCM Token saved:', token.slice(0, 20) + '...');
      }
    } else {
      console.log('No FCM token received');
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
    showNotificationGuide();
  } else if (status === 'unsupported') {
    showNotificationGuide();
  } else {
    requestNotificationPermission();
  }
}

// ==========================================
// NOTIFICATION GUIDE MODAL
// ==========================================

function showNotificationGuide() {
  // Detect platform
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !isChrome;
  const isFirefox = /firefox/i.test(navigator.userAgent);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  let guideHTML = '';

  if (isIOS && isSafari) {
    guideHTML = buildIOSGuide(isPWA);
  } else if (isAndroid && isChrome) {
    guideHTML = buildAndroidChromeGuide();
  } else if (isChrome) {
    guideHTML = buildDesktopChromeGuide();
  } else if (isFirefox) {
    guideHTML = buildFirefoxGuide();
  } else {
    guideHTML = buildGenericGuide();
  }

  // Create or update modal
  let modal = document.getElementById('modal-notification-guide');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-notification-guide';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.onclick = (e) => { if (e.target === modal) closeNotificationGuide(); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()" style="max-height:85vh; overflow-y:auto;">
      <div class="modal-handle"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="display:flex; align-items:center; gap:8px; margin:0;">
          <span class="material-icons-round" style="color:var(--primary);">notifications_active</span>
          הפעלת התראות
        </h3>
        <button onclick="closeNotificationGuide()" style="background:none; border:none; cursor:pointer; padding:4px;">
          <span class="material-icons-round" style="color:var(--text-light);">close</span>
        </button>
      </div>
      ${guideHTML}
    </div>
  `;

  modal.classList.add('active');
}

function closeNotificationGuide() {
  const modal = document.getElementById('modal-notification-guide');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// PLATFORM-SPECIFIC GUIDES
// ==========================================

function buildAndroidChromeGuide() {
  return `
    <div class="notif-guide">
      <div class="notif-guide-status denied">
        <span class="material-icons-round">block</span>
        <span>ההתראות חסומות כרגע</span>
      </div>

      <p style="font-weight:600; margin:16px 0 8px;">כדי לקבל התראות על קריאות חדשות:</p>

      <div class="notif-step">
        <div class="notif-step-num">1</div>
        <div class="notif-step-content">
          <strong>לחץ על סמל המנעול 🔒</strong>
          <span>בשורת הכתובת למעלה (ליד הכתובת של האתר)</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">2</div>
        <div class="notif-step-content">
          <strong>לחץ "הרשאות" או "Permissions"</strong>
          <span>בתפריט שנפתח</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">3</div>
        <div class="notif-step-content">
          <strong>מצא "התראות" (Notifications)</strong>
          <span>שנה מ"חסימה" ל<strong>"אישור"</strong></span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">4</div>
        <div class="notif-step-content">
          <strong>רענן את הדף</strong>
          <span>לחץ על הכפתור למטה</span>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="location.reload()" style="margin-top:16px;">
        <span class="material-icons-round">refresh</span>
        רענן עכשיו
      </button>

      <div class="notif-alt-method">
        <strong>דרך נוספת:</strong>
        <ol style="margin:8px 0 0 0; padding-right:20px;">
          <li>פתח הגדרות Chrome (⋮ למעלה)</li>
          <li>הגדרות אתר → התראות</li>
          <li>מצא את Aid Connect ושנה ל"אישור"</li>
        </ol>
      </div>
    </div>
  `;
}

function buildDesktopChromeGuide() {
  return `
    <div class="notif-guide">
      <div class="notif-guide-status denied">
        <span class="material-icons-round">block</span>
        <span>ההתראות חסומות כרגע</span>
      </div>

      <p style="font-weight:600; margin:16px 0 8px;">כדי לקבל התראות על קריאות חדשות:</p>

      <div class="notif-step">
        <div class="notif-step-num">1</div>
        <div class="notif-step-content">
          <strong>לחץ על סמל המנעול 🔒</strong>
          <span>בשורת הכתובת, משמאל לכתובת האתר</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">2</div>
        <div class="notif-step-content">
          <strong>מצא "Notifications" / "התראות"</strong>
          <span>ברשימת ההרשאות</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">3</div>
        <div class="notif-step-content">
          <strong>שנה ל-"Allow" / "אישור"</strong>
          <span>הדף יתרענן אוטומטית</span>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="location.reload()" style="margin-top:16px;">
        <span class="material-icons-round">refresh</span>
        רענן אחרי שינוי ההגדרה
      </button>

      <div class="notif-alt-method">
        <strong>דרך ישירה:</strong> הקלד בשורת הכתובת:<br>
        <code style="background:#f0f0f0; padding:4px 8px; border-radius:4px; font-size:0.85rem; direction:ltr; display:inline-block; margin-top:4px;">chrome://settings/content/notifications</code>
      </div>
    </div>
  `;
}

function buildIOSGuide(isPWA) {
  if (!isPWA) {
    return `
      <div class="notif-guide">
        <div class="notif-guide-status warning">
          <span class="material-icons-round">phone_iphone</span>
          <span>באייפון, התראות עובדות רק מהאפליקציה המותקנת</span>
        </div>

        <p style="font-weight:600; margin:16px 0 8px;">שלב 1: התקן את האפליקציה</p>

        <div class="notif-step">
          <div class="notif-step-num">1</div>
          <div class="notif-step-content">
            <strong>לחץ על כפתור השיתוף</strong>
            <span>הריבוע עם החץ למעלה (⬆️) בתחתית Safari</span>
          </div>
        </div>

        <div class="notif-step">
          <div class="notif-step-num">2</div>
          <div class="notif-step-content">
            <strong>בחר "הוסף למסך הבית"</strong>
            <span>Add to Home Screen</span>
          </div>
        </div>

        <div class="notif-step">
          <div class="notif-step-num">3</div>
          <div class="notif-step-content">
            <strong>פתח את האפליקציה מהמסך הראשי</strong>
            <span>ואז אשר התראות כשתתבקש</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="notif-guide">
      <div class="notif-guide-status denied">
        <span class="material-icons-round">block</span>
        <span>ההתראות חסומות כרגע</span>
      </div>

      <p style="font-weight:600; margin:16px 0 8px;">כדי להפעיל התראות:</p>

      <div class="notif-step">
        <div class="notif-step-num">1</div>
        <div class="notif-step-content">
          <strong>פתח את "הגדרות" של האייפון</strong>
          <span>⚙️ Settings</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">2</div>
        <div class="notif-step-content">
          <strong>גלול למטה ומצא "Aid Connect"</strong>
          <span>ברשימת האפליקציות</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">3</div>
        <div class="notif-step-content">
          <strong>הפעל "Notifications" / "התראות"</strong>
          <span>ובחר סגנון התראה</span>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="location.reload()" style="margin-top:16px;">
        <span class="material-icons-round">refresh</span>
        רענן אחרי שינוי ההגדרה
      </button>
    </div>
  `;
}

function buildFirefoxGuide() {
  return `
    <div class="notif-guide">
      <div class="notif-guide-status denied">
        <span class="material-icons-round">block</span>
        <span>ההתראות חסומות כרגע</span>
      </div>

      <p style="font-weight:600; margin:16px 0 8px;">כדי לקבל התראות:</p>

      <div class="notif-step">
        <div class="notif-step-num">1</div>
        <div class="notif-step-content">
          <strong>לחץ על סמל המנעול 🔒</strong>
          <span>בשורת הכתובת</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">2</div>
        <div class="notif-step-content">
          <strong>מחק את "חסימת התראות"</strong>
          <span>לחץ על ה-X ליד "Send Notifications - Blocked"</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">3</div>
        <div class="notif-step-content">
          <strong>רענן ואשר מחדש</strong>
          <span>Firefox ישאל שוב - לחץ "אישור"</span>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="location.reload()" style="margin-top:16px;">
        <span class="material-icons-round">refresh</span>
        רענן עכשיו
      </button>
    </div>
  `;
}

function buildGenericGuide() {
  return `
    <div class="notif-guide">
      <div class="notif-guide-status warning">
        <span class="material-icons-round">info</span>
        <span>ההתראות לא פעילות</span>
      </div>

      <p style="font-weight:600; margin:16px 0 8px;">כדי לקבל התראות:</p>

      <div class="notif-step">
        <div class="notif-step-num">1</div>
        <div class="notif-step-content">
          <strong>פתח את הגדרות הדפדפן</strong>
          <span>חפש "Notifications" או "התראות"</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">2</div>
        <div class="notif-step-content">
          <strong>מצא את האתר הזה</strong>
          <span>ואשר קבלת התראות</span>
        </div>
      </div>

      <div class="notif-step">
        <div class="notif-step-num">3</div>
        <div class="notif-step-content">
          <strong>רענן את הדף</strong>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="location.reload()" style="margin-top:16px;">
        <span class="material-icons-round">refresh</span>
        רענן עכשיו
      </button>
    </div>
  `;
}
