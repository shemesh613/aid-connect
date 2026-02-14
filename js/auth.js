// ============================================
// Aid Connect - Authentication
// ============================================

let confirmationResult = null;
let selectedRole = null;

// Initialize reCAPTCHA
window.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  checkAuthState();
});

function checkAuthState() {
  // Wait for Firebase to init
  if (typeof firebase === 'undefined') {
    setTimeout(checkAuthState, 100);
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      // Check if user has a profile
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (doc.exists) {
        // User has profile, redirect to app
        window.location.href = 'app.html';
      } else {
        // User authenticated but no profile - show profile setup
        goToStep('profile');
      }
    } else {
      goToStep('phone');
    }
  });
}

function goToStep(step) {
  document.querySelectorAll('.login-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
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

// Format phone number
function formatPhone(phone) {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (!cleaned.startsWith('+972')) {
    cleaned = '+972' + cleaned;
  }
  return cleaned;
}

// Step 1: Send OTP
async function sendOTP() {
  const phoneInput = document.getElementById('phone').value.trim();
  if (!phoneInput || phoneInput.length < 9) {
    showError('נא להזין מספר טלפון תקין');
    return;
  }

  const phone = formatPhone(phoneInput);
  const btn = document.getElementById('btn-send-otp');
  btn.disabled = true;
  btn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';

  try {
    // Setup reCAPTCHA
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: () => {}
      });
    }

    confirmationResult = await firebase.auth().signInWithPhoneNumber(phone, window.recaptchaVerifier);
    goToStep('otp');
  } catch (error) {
    console.error('OTP Error:', error);
    let msg = 'שגיאה בשליחת קוד האימות';
    if (error.code === 'auth/too-many-requests') {
      msg = 'יותר מדי ניסיונות. נסה שוב מאוחר יותר';
    } else if (error.code === 'auth/invalid-phone-number') {
      msg = 'מספר טלפון לא תקין';
    }
    showError(msg);
    // Reset reCAPTCHA
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">send</span> שליחת קוד אימות';
  }
}

// Step 2: Verify OTP
async function verifyOTP() {
  const otp = document.getElementById('otp').value.trim();
  if (!otp || otp.length < 4) {
    showError('נא להזין את קוד האימות');
    return;
  }

  const btn = document.getElementById('btn-verify-otp');
  btn.disabled = true;
  btn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';

  try {
    const result = await confirmationResult.confirm(otp);
    const user = result.user;

    // Check if user has profile
    const doc = await firebase.firestore().collection('users').doc(user.uid).get();
    if (doc.exists) {
      window.location.href = 'app.html';
    } else {
      goToStep('profile');
    }
  } catch (error) {
    console.error('Verify Error:', error);
    let msg = 'קוד אימות שגוי';
    if (error.code === 'auth/code-expired') {
      msg = 'הקוד פג תוקף. שלח קוד חדש';
    }
    showError(msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">verified</span> אימות';
  }
}

// Step 3: Role Selection
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('selected');
  document.getElementById('btn-save-profile').disabled = false;
}

// Step 3: Save Profile
async function saveProfile() {
  const name = document.getElementById('user-name').value.trim();
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
      phone: user.phoneNumber,
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
