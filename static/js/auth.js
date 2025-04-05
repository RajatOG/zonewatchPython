// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfYexFLimLxMM2cpCunMnTfBfvzho56Kk",
  authDomain: "zonewatch-94cd3.firebaseapp.com",
  projectId: "zonewatch-94cd3",
  storageBucket: "zonewatch-94cd3.firebasestorage.app",
  messagingSenderId: "846154989012",
  appId: "1:846154989012:web:4493f85984d1d32a21ea41",
  measurementId: "G-05LW9BP00V",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Set session persistence to LOCAL
// This will maintain the user's session even after browser restart
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Session timeout (1 hour)
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
let sessionTimeoutId;

// DOM Elements
const userInfo = document.getElementById("userInfo");
const userEmail = document.getElementById("userEmail");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const mainContent = document.getElementById("mainContent");

// Check if current page requires authentication
function checkPageAuth() {
  const currentPath = window.location.pathname;
  const protectedPages = ["/", "/index.html"];
  return protectedPages.includes(currentPath);
}

// Auth state observer
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    showAuthUI(user);
    if (checkPageAuth()) {
      // User is on a protected page and is authenticated
      return;
    } else {
      // User is on login page but is authenticated
      window.location.href = "/";
    }
  } else {
    // User is signed out
    showAuthUI(null);
    if (checkPageAuth()) {
      // User is on a protected page but is not authenticated
      window.location.href = "/login";
    }
  }
});

// Show UI elements based on auth state
function showAuthUI(user) {
  if (user) {
    // User is signed in
    if (userInfo) {
      userInfo.classList.remove("d-none");
      if (userEmail) userEmail.textContent = user.email;
    }
    if (mainContent) mainContent.classList.remove("d-none");
    resetSessionTimeout();
  } else {
    // User is signed out
    if (userInfo) userInfo.classList.add("d-none");
    if (mainContent) mainContent.classList.add("d-none");
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
  }
}

// Reset session timeout
function resetSessionTimeout() {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }
  sessionTimeoutId = setTimeout(() => {
    firebase.auth().signOut();
  }, SESSION_TIMEOUT);
}

// Event Listeners
if (googleSignInBtn) {
  googleSignInBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase
      .auth()
      .signInWithPopup(provider)
      .catch((error) => {
        alert(error.message);
      });
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", () => {
    firebase
      .auth()
      .signOut()
      .then(() => {
        window.location.href = "/login";
      })
      .catch((error) => {
        alert(error.message);
      });
  });
}

// Reset session timeout on user activity
document.addEventListener("click", resetSessionTimeout);
document.addEventListener("keypress", resetSessionTimeout);
document.addEventListener("mousemove", resetSessionTimeout);

// Check if user is authenticated
function isAuthenticated() {
  return !!firebase.auth().currentUser;
}

// Initialize page authentication check
document.addEventListener("DOMContentLoaded", function () {
  // Check if page requires authentication
  checkPageAuth();
});

// Export functions for use in other modules
window.authModule = {
  isAuthenticated: isAuthenticated,
  resetSessionTimeout: resetSessionTimeout,
};
