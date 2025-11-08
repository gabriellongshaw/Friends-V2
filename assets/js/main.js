function applySystemTheme() {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    function updateTheme(e) {
        if (e.matches) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }
    
    updateTheme(darkQuery);
    
    darkQuery.addEventListener('change', updateTheme);
}

applySystemTheme();

const firebaseConfig = {
    apiKey: "AIzaSyC4IC6KmL7r4hQMaJpwxXcF9ag_8DPJjWg",
    authDomain: "friends-login-system.firebaseapp.com",
    projectId: "friends-login-system",
    storageBucket: "friends-login-system.firebasestorage.app",
    messagingSenderId: "349783620959",
    appId: "1:349783620959:web:9fe0ccd397d8b232bb8aea",
    measurementId: "G-T8CE5LTRS7"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const authContainer = document.getElementById('auth-container');
const protectedContent = document.getElementById('protected-content');
const authErrorMessage = document.getElementById('auth-error-message');
const logoutTimerDisplay = document.getElementById('logout-timer-display');

const controlsContainer = document.querySelector('.controls');

const SESSION_DURATION_MS = 300000;

const LOCAL_STORAGE_EXPIRY_KEY = 'autoLogoutExpiry';
let logoutTimer;
let countdownInterval;

function formatTime(ms) {
    
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    
    return `${paddedMinutes}:${paddedSeconds}`;
}

function startLogoutTimer(initialTimeRemaining = SESSION_DURATION_MS) {
    
    clearTimeout(logoutTimer);
    clearInterval(countdownInterval);
    
    const expiryTime = Date.now() + initialTimeRemaining;
    
    localStorage.setItem(LOCAL_STORAGE_EXPIRY_KEY, expiryTime);
    
    let timeRemaining = initialTimeRemaining;
    
    const updateCountdown = () => {
        timeRemaining -= 1000;
        
        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            logoutTimerDisplay.textContent = 'Auto Logout in: 00:00';
            
            if (auth.currentUser) {
                auth.signOut().then(() => {
                    console.log("Auto-logout triggered by timer expiration.");
                    alert("Your session has expired due to inactivity. Please log in again.");
                });
            }
            
            localStorage.removeItem(LOCAL_STORAGE_EXPIRY_KEY);
            return;
        }
        
        const timeString = formatTime(timeRemaining);
        logoutTimerDisplay.textContent = `Auto Logout in: ${timeString}`;
    };
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
    
    logoutTimer = setTimeout(() => {
        
        console.log("Fallback logout timeout reached.");
    }, initialTimeRemaining);
    
    const durationMinutes = initialTimeRemaining / 60000;
    console.log(`New auto-logout timer set for ${durationMinutes.toFixed(2)} minutes.`);
}

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error("Failed to set local persistence:", error);
    });

document.addEventListener('mousemove', resetLogoutTimer);
document.addEventListener('keypress', resetLogoutTimer);
document.addEventListener('scroll', resetLogoutTimer);

function resetLogoutTimer() {
    if (auth.currentUser) {
        
        startLogoutTimer(SESSION_DURATION_MS);
        const now = new Date().toLocaleTimeString();
        console.log(`User activity detected at ${now}. Auto-logout timer reset.`);
    }
}

function updateUI(user) {
    if (user) {
        authContainer.style.display = 'none';
        protectedContent.style.display = 'block';
        controlsContainer.classList.add('visible');
        console.log("User signed in:", user.email);
        document.body.classList.remove('login-page');
        
        const storedExpiryTime = localStorage.getItem(LOCAL_STORAGE_EXPIRY_KEY);
        let timeToStartFrom = SESSION_DURATION_MS;
        
        if (storedExpiryTime) {
            const timeRemaining = storedExpiryTime - Date.now();
            
            if (timeRemaining > 1000) {
                timeToStartFrom = timeRemaining;
                console.log(`Resuming timer from ${formatTime(timeRemaining)} after refresh.`);
            } else {
                
                console.log("Session expired during refresh. Forcing logout.");
                localStorage.removeItem(LOCAL_STORAGE_EXPIRY_KEY);
                auth.signOut();
                return;
            }
        } else {
            console.log("Starting new timer (no local expiry found).");
        }
        
        startLogoutTimer(timeToStartFrom);
        
    } else {
        authContainer.style.display = 'block';
        protectedContent.style.display = 'none';
        controlsContainer.classList.remove('visible');
        
        authErrorMessage.textContent = '';
        console.log("User signed out.");
        clearTimeout(logoutTimer);
        clearInterval(countdownInterval);
        localStorage.removeItem(LOCAL_STORAGE_EXPIRY_KEY);
        document.body.classList.add('login-page');
    }
}

auth.onAuthStateChanged(updateUI);

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputUsername = loginForm.querySelector('#login-username').value.toLowerCase();
        const password = loginForm.querySelector('#login-password').value;
        
        const FIXED_USERNAME_DOC = 'friends.secureaccess';
        
        authErrorMessage.textContent = '';
        const loginBtn = document.getElementById('login-button');
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verifying...';
        
        try {
            if (inputUsername !== FIXED_USERNAME_DOC) {
                throw { code: 'custom/username-mismatch', message: 'Invalid username or password.' };
            }
            
            const userRef = db.collection('usernames').doc(FIXED_USERNAME_DOC);
            const doc = await userRef.get();
            
            if (!doc.exists) {
                throw { code: 'custom/db-error', message: 'Configuration error: Cannot find access key.' };
            }
            
            const userData = doc.data();
            const firebaseEmail = userData.email;
            
            loginBtn.textContent = 'Signing in...';
            
            await auth.signInWithEmailAndPassword(firebaseEmail, password);
            console.log("Login successful!");
            
        } catch (error) {
            console.error("Login failed:", error.code, error.message);
            
            let message;
            if (error.code.startsWith('custom/')) {
                message = 'Invalid username or password.';
            } else {
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        message = 'Invalid username or password.';
                        break;
                    case 'auth/invalid-email':
                        message = 'An internal error occurred.';
                        break;
                    case 'auth/too-many-requests':
                        message = 'Access temporarily blocked.';
                        break;
                    default:
                        message = 'An unknown login error occurred. Please try again.';
                }
            }
            authErrorMessage.textContent = message;
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log("Logout successful!");
        }).catch((error) => {
            console.error("Logout failed:", error);
            alert("Logout failed: " + error.message);
        });
    });
}