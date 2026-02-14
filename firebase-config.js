// ============================================
// Aid Connect - Firebase Configuration
// ============================================
// הוראות הגדרה:
// 1. היכנס ל-https://console.firebase.google.com
// 2. צור פרויקט חדש בשם "aid-connect"
// 3. הפעל: Authentication (Phone), Firestore, Cloud Messaging, Hosting
// 4. העתק את ההגדרות מ-Project Settings → General → Your apps → Web app
// 5. החלף את הערכים למטה

const firebaseConfig = {
  apiKey: "AIzaSyAiX5hNA0nHE5Ose3XoHY84n3y99pdL4F8",
  authDomain: "aid-connect-2059d.firebaseapp.com",
  projectId: "aid-connect-2059d",
  storageBucket: "aid-connect-2059d.firebasestorage.app",
  messagingSenderId: "214156347220",
  appId: "1:214156347220:web:bbde9a71c36119b1db6ac1",
  measurementId: "G-EFGWRRGVJ4"
};

// VAPID Key for Push Notifications (FCM)
// מ-Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = "BCLj0E0no-V4aMHDFT3JaOGJG4FODd3GWMdYTdHyaP0jhkjHxxPItV9cJdB6b-Qszn1y6h7E7wNPWkLwfJWspQg";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// Auth language - Hebrew
auth.languageCode = 'he';

// Firestore settings
db.settings({ timestampsInSnapshots: true });

export { auth, db, messaging, VAPID_KEY, firebaseConfig };
