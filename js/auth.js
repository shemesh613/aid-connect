// ============================================
// Aid Connect - Authentication (Google Sign-In)
// ============================================

let selectedRole = null;

// Initialize
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
      // Check if user has a profile
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (doc.exists) {
        window.location.href = 'app.html';
      } else {
        // Pre-fill name from Google account
        const nameInput = document.getElementById('user-name');
        if (nameInput && user.displayName) {
          nameInput.value = user.displayName;
        }
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

// Google Sign In
async function signInWithGoogle() {
  const btn = document.getElementById('btn-google-login');
  btn.disabled = true;

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.auth().signInWithPopup(provider);
    // onAuthStateChanged will handle the redirect
  } catch (error) {
    console.error('Google sign-in error:', error);
    let msg = 'שגיאה בהתחברות';
    if (error.code === 'auth/popup-closed-by-user') {
      msg = 'ההתחברות בוטלה';
    } else if (error.code === 'auth/popup-blocked') {
      msg = 'חלון ההתחברות נחסם. אפשר חלונות קופצים';
    }
    showError(msg);
  } finally {
    btn.disabled = false;
  }
}

// Role Selection
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('selected');
  document.getElementById('btn-save-profile').disabled = false;
}

// Save Profile
async function saveProfile() {
  const name = document.getElementById('user-name').value.trim();
  const phone = document.getElementById('user-phone').value.trim();

  if (!name) {
    showError('נא להזין שם');
    return;
  }
  if (!selectedRole) {
    showError('נא לבחור תפקיד');
    return;
  }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';

  try {
    const user = firebase.auth().currentUser;
    await firebase.firestore().collection('users').doc(user.uid).set({
      name: name,
      email: user.email || '',
      phone: phone,
      photoURL: user.photoURL || '',
      role: selectedRole,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      tasksTaken: 0,
      tasksCompleted: 0,
      tasksCreated: 0,
      fcmToken: null,
      active: true
    });

    window.location.href = 'app.html';
  } catch (error) {
    console.error('Profile Error:', error);
    showError('שגיאה בשמירת הפרופיל');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">check_circle</span> כניסה';
  }
}
