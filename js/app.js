// ============================================
// Aid Connect - Main App Logic
// ============================================

let currentUser = null;
let currentUserData = null;
let currentView = null;
let deferredInstallPrompt = null;

// ==========================================
// APP INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Check auth
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    currentUser = user;

    // Load user profile
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      window.location.href = 'index.html';
      return;
    }

    currentUserData = doc.data();
    setupUI();
    setupRealTimeListeners();
    setupForegroundMessaging();
    checkNotificationStatus();
    registerServiceWorker();
    setupInstallPrompt();
  });
}

// ==========================================
// UI SETUP
// ==========================================

function setupUI() {
  const role = currentUserData.role;

  // Show correct navigation
  if (role === 'admin') {
    document.getElementById('nav-admin').style.display = 'flex';
    document.getElementById('nav-volunteer').style.display = 'none';
    document.getElementById('fab-create').style.display = 'flex';
    navigateTo('dashboard');
  } else {
    document.getElementById('nav-volunteer').style.display = 'flex';
    document.getElementById('nav-admin').style.display = 'none';
    document.getElementById('fab-create').style.display = 'none';
    navigateTo('tasks');
  }

  // Update profile UI
  updateProfileUI();

  // Show org settings button for admins
  if (currentUserData.role === 'admin') {
    const orgBtn = document.getElementById('btn-org-settings');
    if (orgBtn) orgBtn.style.display = '';
  }

  // Load org settings
  loadOrgSettings();
}

function updateProfileUI() {
  if (!currentUserData) return;

  const nameEl = document.getElementById('profile-name');
  const roleEl = document.getElementById('profile-role');
  const avatarEl = document.getElementById('profile-avatar');
  const takenEl = document.getElementById('profile-tasks-taken');
  const completedEl = document.getElementById('profile-tasks-completed');
  const createdEl = document.getElementById('profile-tasks-created');

  if (nameEl) nameEl.textContent = currentUserData.name;
  if (roleEl) roleEl.textContent = currentUserData.role === 'admin' ? 'מנהל' : 'מתנדב';
  if (avatarEl) avatarEl.textContent = (currentUserData.name || '?').charAt(0);
  if (takenEl) takenEl.textContent = currentUserData.tasksTaken || 0;
  if (completedEl) completedEl.textContent = currentUserData.tasksCompleted || 0;
  if (createdEl) createdEl.textContent = currentUserData.tasksCreated || 0;
}

// ==========================================
// NAVIGATION
// ==========================================

function navigateTo(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Show target view
  const view = document.getElementById(`view-${viewName}`);
  if (view) {
    view.classList.add('active');
    currentView = viewName;
  }

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  // Show/hide FAB on admin
  const fab = document.getElementById('fab-create');
  if (fab && currentUserData?.role === 'admin') {
    fab.style.display = (viewName === 'dashboard' || viewName === 'volunteers' || viewName === 'map') ? 'flex' : 'none';
  }

  // Initialize map when navigating to it
  if (viewName === 'map') {
    onMapView();
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

// ==========================================
// REAL-TIME LISTENERS
// ==========================================

function setupRealTimeListeners() {
  const role = currentUserData.role;

  if (role === 'volunteer') {
    listenToTasks();
    listenToMyTasks(currentUser.uid);
  } else if (role === 'admin') {
    listenToAllTasks();
    listenToVolunteers();
  }

  // Listen to own profile changes
  db.collection('users').doc(currentUser.uid).onSnapshot((doc) => {
    if (doc.exists) {
      currentUserData = doc.data();
      updateProfileUI();
    }
  });
}

// ==========================================
// VOLUNTEERS MANAGEMENT (Admin)
// ==========================================

function listenToVolunteers() {
  db.collection('users')
    .where('role', '==', 'volunteer')
    .where('active', '==', true)
    .onSnapshot((snapshot) => {
      const volunteers = [];
      snapshot.forEach(doc => {
        volunteers.push({ id: doc.id, ...doc.data() });
      });
      renderVolunteers(volunteers);
    });
}

function renderVolunteers(volunteers) {
  const container = document.getElementById('volunteers-list');
  const counter = document.getElementById('volunteers-count');

  if (counter) counter.textContent = volunteers.length;

  if (volunteers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">group_off</span>
        <p>אין מתנדבים רשומים עדיין</p>
      </div>`;
    return;
  }

  container.innerHTML = volunteers.map(vol => `
    <div class="task-card" style="border-right-color: var(--completed);">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="profile-avatar" style="width:44px; height:44px; font-size:1.2rem; margin:0;">
          ${(vol.name || '?').charAt(0)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;">${escapeHtml(vol.name)}</div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">${vol.phone || ''}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.3rem; font-weight:700; color:var(--primary);">${vol.tasksCompleted || 0}</div>
          <div style="font-size:0.7rem; color:var(--text-light);">הושלמו</div>
        </div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==========================================
// PWA INSTALL
// ==========================================

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show install banner after 3 seconds
    setTimeout(() => {
      const banner = document.getElementById('install-banner');
      if (banner && !localStorage.getItem('install-dismissed')) {
        banner.classList.add('show');
      }
    }, 3000);
  });
}

async function installApp() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;

  if (result.outcome === 'accepted') {
    showToast('האפליקציה הותקנה! 📱');
  }

  deferredInstallPrompt = null;
  dismissInstallBanner();
}

function dismissInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
  localStorage.setItem('install-dismissed', 'true');
}

// ==========================================
// SERVICE WORKER
// ==========================================

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker registered:', registration.scope);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

// ==========================================
// SHARE APP
// ==========================================

async function shareApp() {
  const shareData = {
    title: 'Aid Connect',
    text: 'הצטרף/י לקהילת Aid Connect - שיגור משימות וסיוע לקהילה',
    url: window.location.origin
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback - copy to clipboard
      await navigator.clipboard.writeText(shareData.url);
      showToast('הקישור הועתק ✅');
    }
  } catch(e) {
    console.log('Share cancelled');
  }
}

// ==========================================
// LOGOUT
// ==========================================

async function logout() {
  if (!confirm('להתנתק?')) return;

  try {
    // Remove FCM token
    if (currentUser) {
      await db.collection('users').doc(currentUser.uid).update({
        fcmToken: null
      });
    }

    await auth.signOut();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = 'index.html';
  }
}

// ==========================================
// ORG SETTINGS (Admin)
// ==========================================

async function loadOrgSettings() {
  try {
    const doc = await db.collection('settings').doc('org').get();
    if (doc.exists) {
      const data = doc.data();
      // Update header title
      if (data.name) {
        const titleEl = document.querySelector('.header-title h1');
        if (titleEl) titleEl.textContent = data.name;
      }
    }
  } catch (e) {
    console.log('No org settings yet');
  }
}

async function openOrgSettings() {
  // Load current values
  try {
    const doc = await db.collection('settings').doc('org').get();
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('org-name').value = data.name || '';
      document.getElementById('org-desc').value = data.description || '';
      document.getElementById('org-phone').value = data.phone || '';
      const adminCodeEl = document.getElementById('org-admin-code');
      if (adminCodeEl) adminCodeEl.value = data.adminCode || '';
    }
  } catch (e) {}

  document.getElementById('modal-org-settings').classList.add('active');
}

function closeOrgSettings(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-org-settings').classList.remove('active');
}

async function saveOrgSettings() {
  const name = document.getElementById('org-name').value.trim();
  const desc = document.getElementById('org-desc').value.trim();
  const phone = document.getElementById('org-phone').value.trim();

  if (!name) {
    showToast('נא להזין שם ארגון', 'error');
    return;
  }

  try {
    const adminCode = document.getElementById('org-admin-code')?.value.trim() || 'admin123';
    await db.collection('settings').doc('org').set({
      name: name,
      description: desc,
      phone: phone,
      adminCode: adminCode,
      updatedBy: currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update header immediately
    const titleEl = document.querySelector('.header-title h1');
    if (titleEl) titleEl.textContent = name;

    closeOrgSettings();
    showToast('הגדרות הארגון נשמרו ✅');
  } catch (error) {
    console.error('Save org settings error:', error);
    showToast('שגיאה בשמירה', 'error');
  }
}
