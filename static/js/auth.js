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

function showAuthUI(user) {
  if (user) {
    // User is signed in
    if (userInfo) {
      userInfo.classList.remove("d-none");
      if (userAvatar) {
        // Default avatar as a data URI (a simple user icon)
        const defaultAvatar =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

        // Set the avatar source with error handling
        if (user.photoURL) {
          userAvatar.src = user.photoURL;
        } else {
          userAvatar.src = defaultAvatar;
        }

        userAvatar.alt = user.displayName || "User Avatar";

        // Add error handling for the image
        userAvatar.onerror = function (e) {
          this.src = defaultAvatar;
        };

        // Add load success handler
        userAvatar.onload = function () {
          console.log("Image loaded successfully");
        };
      }
      if (userFirstName) {
        // Get first name from display name or email
        const firstName = user.displayName
          ? user.displayName.split(" ")[0]
          : user.email.split("@")[0];
        userFirstName.textContent = firstName;
      }
    }
    if (mainContent) mainContent.classList.remove("d-none");
    resetSessionTimeout();
  } else {
    if (userInfo) userInfo.classList.add("d-none");
    if (mainContent) mainContent.classList.add("d-none");
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
  }
}

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
