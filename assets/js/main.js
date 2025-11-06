const firebaseConfig = {
    apiKey: "AIzaSyC4IC6KmL7r4hQMaJpwxXcF9ag_8DPJjWg",
    authDomain: "friends-login-system.firebaseapp.com",
    projectId: "friends-login-system",
    storageBucket: "friends-login-system.firebasestorage.app",
    messagingSenderId: "349783620959",
    appId: "1:349783620959:web:9fe0ccd397d8b232bb8aea",
    measurementId: "G-T8CE5LTRS7"
};

// Initialize Firebase services
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions(); 

// Global variables for session management
const SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes (600,000 milliseconds)
let sessionTimeout;
let timerInterval;
let isPasscodeRequired = false; // Flag for 10-minute lock

// --- THEME LOGIC (FIXED) ---
function applySystemTheme() {
    // Check if the user prefers dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Check if the body already has the dark class (e.g., from a previous manual toggle, though we are sticking to system preference here)
    
    if (prefersDark) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

// --- UI Toggle Functions ---

function showPasscodeScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('passcode-screen').classList.remove('hidden');
    document.getElementById('passcode-error').textContent = '';
    // Ensure the main auth box transition happens smoothly
    document.getElementById('passcode-screen').style.opacity = '1'; 
}

function showLoginScreen() {
    document.getElementById('passcode-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('auth-error').textContent = '';
    // Ensure the main auth box transition happens smoothly
    document.getElementById('login-screen').style.opacity = '1';
}

// --- CORE VIEW MANAGEMENT FUNCTIONS ---

function updateUI(user) {
    const lockContainer = document.getElementById('lock-container');
    const loginScreen = document.getElementById('login-screen');
    const passcodeScreen = document.getElementById('passcode-screen');
    const protectedScreen = document.getElementById('protected-screen');

    document.getElementById('auth-error').textContent = '';
    document.getElementById('passcode-error').textContent = '';

    // 1. User is Logged In
    if (user) {
        if (isPasscodeRequired) {
            // State: Locked by timer -> Show Passcode screen
            lockContainer.classList.remove('hidden');
            loginScreen.classList.add('hidden');
            passcodeScreen.classList.remove('hidden');
            protectedScreen.classList.add('hidden');
            stopSessionTimer(); 
        } 
        else {
            // State: Authenticated -> Hide lock screen
            lockContainer.classList.add('hidden');
            protectedScreen.classList.remove('hidden');
            startSessionTimer();
        }
    } 
    // 2. User is Logged Out
    else {
        // State: Logged out -> Show default Login screen
        stopSessionTimer();
        isPasscodeRequired = false;
        
        lockContainer.classList.remove('hidden');
        loginScreen.classList.remove('hidden');
        passcodeScreen.classList.add('hidden');
        protectedScreen.classList.add('hidden');
    }
}

// Listener to update UI whenever auth state changes
auth.onAuthStateChanged(updateUI);

// --- FIREBASE AUTH HANDLERS (Login functions are fixed by restoring config) ---

function fullSignOut() {
    auth.signOut().then(() => {
        console.log("User signed out.");
    }).catch((error) => {
        document.getElementById('auth-error').textContent = `Sign out error: ${error.message}`;
        console.error("Sign out error:", error);
    });
}

function signUpWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            alert("Account created! Set a secure passcode hash for this user in Firestore/Cloud Functions for re-auth.");
            isPasscodeRequired = false;
        })
        .catch((error) => {
            document.getElementById('auth-error').textContent = error.message;
        });
}

function signInWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            isPasscodeRequired = false;
        })
        .catch((error) => {
            document.getElementById('auth-error').textContent = error.message;
        });
}

// --- 10-MINUTE SESSION LOGIC ---

function startSessionTimer() {
    stopSessionTimer(); 
    document.getElementById('timer-status').classList.remove('hidden');

    sessionTimeout = setTimeout(() => {
        console.log("10 minutes expired. Forcing re-authentication.");
        isPasscodeRequired = true;
        updateUI(auth.currentUser); 
    }, SESSION_DURATION_MS);

    let endTime = Date.now() + SESSION_DURATION_MS;
    timerInterval = setInterval(() => {
        const remainingTime = endTime - Date.now();
        const minutes = Math.floor(remainingTime / (60 * 1000));
        const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
        
        if (remainingTime <= 0) {
            document.getElementById('timer-status').textContent = 'Time expired!';
            clearInterval(timerInterval);
        } else {
            const minDisplay = minutes < 10 ? '0' + minutes : minutes;
            const secDisplay = seconds < 10 ? '0' + seconds : seconds;
            document.getElementById('timer-status').textContent = `Re-auth in: ${minDisplay}:${secDisplay}`;
        }
    }, 1000);
}

function stopSessionTimer() {
    clearTimeout(sessionTimeout);
    clearInterval(timerInterval);
    document.getElementById('timer-status').textContent = 'Session Inactive';
}


// --- PASSCODE LOGIC (CALLS CLOUD FUNCTION) ---

function signInWithPasscode() {
    const passcode = document.getElementById('passcode-input').value;
    const user = auth.currentUser;
    
    if (!user) {
        document.getElementById('passcode-error').textContent = "No active user. Please sign in fully.";
        return;
    }
    
    // Call the Cloud Function to verify the passcode securely on the server
    const verifyPasscode = functions.httpsCallable('verifyPasscode');
    
    verifyPasscode({ passcode: passcode, uid: user.uid })
        .then((result) => {
            if (result.data.success) {
                console.log("Passcode verified. Session refreshed.");
                isPasscodeRequired = false;
                document.getElementById('passcode-input').value = ''; 
                updateUI(user); 
            } else {
                document.getElementById('passcode-error').textContent = "Invalid passcode. Try again.";
            }
        })
        .catch((error) => {
            console.error("Cloud Function error:", error);
            document.getElementById('passcode-error').textContent = "A security error occurred during verification.";
        });
}
