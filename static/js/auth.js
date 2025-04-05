// Initialize Firebase with your config
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

// Session duration in milliseconds (1 hour)
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Store session start time
function setSessionStartTime() {
  localStorage.setItem("sessionStartTime", Date.now().toString());
}

// Check if session is expired
function isSessionExpired() {
  const sessionStartTime = parseInt(localStorage.getItem("sessionStartTime"));
  if (!sessionStartTime) return true;

  const currentTime = Date.now();
  const sessionDuration = currentTime - sessionStartTime;
  return sessionDuration > SESSION_DURATION;
}

// Handle session expiry
function handleSessionExpiry() {
  if (isSessionExpired()) {
    // Clear session data
    localStorage.removeItem("sessionStartTime");

    // Sign out user
    firebase
      .auth()
      .signOut()
      .then(() => {
        // Show session expired message
        alert("Your session has expired. Please sign in again.");
        window.location.href = "/login";
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });

    return true;
  }
  return false;
}

// Periodic session check (every minute)
setInterval(() => {
  if (firebase.auth().currentUser) {
    handleSessionExpiry();
  }
}, 60 * 1000); // Check every minute

// Auth state observer
function initializeAuth() {
  firebase.auth().onAuthStateChanged((user) => {
    const currentPath = window.location.pathname;

    if (user) {
      // Get the user's ID token
      user
        .getIdToken(true)
        .then((token) => {
          // Check token expiry
          const tokenData = JSON.parse(atob(token.split(".")[1])); // Decode JWT
          const expirationTime = tokenData.exp * 1000; // Convert to milliseconds

          if (Date.now() >= expirationTime) {
            handleSessionExpiry();
            return;
          }

          // Set session start time on successful login
          setSessionStartTime();

          // If on login page, redirect to home
          if (currentPath === "/login") {
            window.location.href = "/";
          }
        })
        .catch((error) => {
          console.error("Error getting ID token:", error);
          handleSessionExpiry();
        });
    } else {
      // User is not signed in
      if (currentPath !== "/login") {
        // If not on login page, redirect to login
        window.location.href = "/login";
      }
    }
  });

  // Add token refresh listener
  setInterval(() => {
    const user = firebase.auth().currentUser;
    if (user) {
      user
        .getIdToken(true) // Force token refresh
        .then(() => {
          console.log("Token refreshed");
        })
        .catch((error) => {
          console.error("Error refreshing token:", error);
          handleSessionExpiry();
        });
    }
  }, 45 * 60 * 1000); // Refresh token every 45 minutes
}

// Sign out function
function signOut() {
  // Clear session data
  localStorage.removeItem("sessionStartTime");

  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "/login";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
      alert("Error signing out: " + error.message);
    });
}

// Add activity monitoring to extend session
function setupActivityMonitoring() {
  const resetSessionTimer = () => {
    if (firebase.auth().currentUser && !isSessionExpired()) {
      setSessionStartTime();
    }
  };

  // Monitor user activity
  ["mousedown", "keydown", "scroll", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, resetSessionTimer, true);
  });
}

// Initialize auth and activity monitoring when the script loads
initializeAuth();
setupActivityMonitoring();

// Export functions for use in other scripts
window.auth = {
  signOut,
  isSessionExpired,
  handleSessionExpiry,
};
