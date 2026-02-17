// ============================================
// Aid Connect - Authentication (Email/Password)
// ============================================

let selectedRole = null;
let isRegisterMode = false;

window.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
});

function checkAuthState() {
  if (typeof firebase === 'undefined') {
    setTimeout(checkAuthState, 100);
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (doc.exists) {
        window.location.href = 'app.html';
      } else {
        document.getElementById('user-name').value = user.displayName || '';
        goToStep('profile');
      }
    } else {
      goToStep('login');
    }
  });
}

function goToStep(step) {
  document.querySelectorAll('.login-step').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`step-${step}`);
  if (el) el.classList.add('active');
  hideError();
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('login-error').style.display = 'none';
}

// Toggle between Login and Register
function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  const title = document.getElementById('auth-title');
  const btn = document.getElementById('btn-auth-submit');
  const toggle = document.getElementById('auth-toggle');
  const nameGroup = document.getElementById('auth-name-group');

  if (isRegisterMode) {
    title.textContent = 'הרשמה';
    btn.innerHTML = '<span class="material-icons-round">person_add</span> הרשמה';
    toggle.innerHTML = 'כבר יש לך חשבון? <a href="#" onclick="toggleAuthMode(); return false;">התחבר</a>';
    nameGroup.style.display = '';
  } else {
    title.textContent = 'התחברות';
    btn.innerHTML = '<span class="material-icons-round">login</span> התחברות';
    toggle.innerHTML = 'אין לך חשבון? <a href="#" onclick="toggleAuthMode(); return false;">הרשם</a>';
    nameGroup.style.display = 'none';
  }
  hideError();
}

// Sign In or Register
async function submitAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-display-name')?.value.trim();

  if (!email) { showError('נא להזין כתובת מייל'); return; }
  if (!password) { showError('נא להזין סיסמה'); return; }
  if (password.length < 6) { showError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
  if (isRegisterMode && !name) { showError('נא להזין שם מלא'); return; }

  const btn = document.getElementById('btn-auth-submit');
  btn.disabled = true;

  try {
    if (isRegisterMode) {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      // checkAuthState will redirect to profile step
    } else {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      // checkAuthState will redirect to app
    }
  } catch (error) {
    console.error('Auth error:', error);

    // Auto-switch: if login fails with "user not found", switch to register
    if (!isRegisterMode && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
      toggleAuthMode();
      showError('המשתמש לא נמצא - עבר למצב הרשמה. הזן שם מלא ולחץ הרשמה');
      btn.disabled = false;
      return;
    }

    // Auto-switch: if register fails with "already exists", switch to login
    if (isRegisterMode && error.code === 'auth/email-already-in-use') {
      toggleAuthMode();
      showError('המייל כבר רשום - עבר למצב התחברות. לחץ התחברות');
      btn.disabled = false;
      return;
    }

    const messages = {
      'auth/invalid-email': 'כתובת מייל לא תקינה',
      'auth/wrong-password': 'סיסמה שגויה',
      'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
      'auth/weak-password': 'הסיסמה חלשה מדי. השתמש בלפחות 6 תווים'
    };
    showError(messages[error.code] || 'שגיאה: ' + error.message);
  } finally {
    btn.disabled = false;
  }
}

// Password reset
async function resetPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { showError('הזן מייל כדי לאפס סיסמה'); return; }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showError('נשלח מייל לאיפוס סיסמה ✉️');
    document.getElementById('login-error').style.color = 'var(--primary)';
  } catch (error) {
    showError('שגיאה בשליחת מייל איפוס');
  }
}

// Role Selection
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.setAttribute('aria-checked', 'false');
  });
  const selected = document.querySelector(`.role-btn[data-role="${role}"]`);
  selected.classList.add('selected');
  selected.setAttribute('aria-checked', 'true');
  document.getElementById('btn-save-profile').disabled = false;

  // Show/hide admin code field
  const adminCodeGroup = document.getElementById('admin-code-group');
  if (adminCodeGroup) {
    adminCodeGroup.style.display = role === 'admin' ? '' : 'none';
  }
}

// Save Profile
async function saveProfile() {
  const name = document.getElementById('user-name').value.trim();
  const phone = document.getElementById('user-phone').value.trim();

  if (!name) { showError('נא להזין שם'); return; }
  if (!selectedRole) { showError('נא לבחור תפקיד'); return; }

  // Admin code verification (before creating profile)
  let isFirstAdmin = false;
  if (selectedRole === 'admin') {
    const adminCode = document.getElementById('admin-code')?.value.trim();
    try {
      const orgDoc = await firebase.firestore().collection('settings').doc('org').get();
      const savedCode = orgDoc.exists ? orgDoc.data().adminCode : null;
      if (savedCode && adminCode !== savedCode) {
        showError('קוד מנהל שגוי'); return;
      }
      if (!savedCode) isFirstAdmin = true;
    } catch (e) {
      isFirstAdmin = true;
    }
  }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';

  try {
    const user = firebase.auth().currentUser;

    // Step 1: Create user profile FIRST (so Firestore rules can verify role)
    await firebase.firestore().collection('users').doc(user.uid).set({
      name: name,
      email: user.email || '',
      phone: phone,
      role: selectedRole,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      tasksTaken: 0,
      tasksCompleted: 0,
      tasksCreated: 0,
      fcmToken: null,
      active: true
    });

    // Step 2: If first admin, set default org settings (now profile exists so rules pass)
    if (isFirstAdmin) {
      try {
        await firebase.firestore().collection('settings').doc('org').set({
          name: 'Aid Connect',
          description: 'שיגור משימות לקהילה',
          adminCode: 'admin123',
          phone: ''
        });
      } catch(e) {
        console.log('Could not set initial org settings:', e);
      }
    }

    // Update display name
    await user.updateProfile({ displayName: name });
    window.location.href = 'app.html';
  } catch (error) {
    console.error('Profile Error:', error);
    showError('שגיאה בשמירת הפרופיל');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">check_circle</span> כניסה';
  }
}

// Handle Enter key in auth form
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('step-login')?.classList.contains('active')) {
    submitAuth();
  }
});
