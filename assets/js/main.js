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

const SESSION_DURATION_MS = 600000;
let logoutTimer;

function startLogoutTimer() {
    
    clearTimeout(logoutTimer);
    
    logoutTimer = setTimeout(() => {
        auth.signOut().then(() => {
            console.log("Auto-logout successful after 10 minutes of inactivity.");
            alert("Your session has expired. Please log in again.");
        }).catch((error) => {
            console.error("Auto-logout failed:", error);
        });
    }, SESSION_DURATION_MS);
    
    console.log(`New logout timer set for ${SESSION_DURATION_MS / 60000} minutes.`);
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
        startLogoutTimer();
    }
}

function updateUI(user) {
    if (user) {
        authContainer.style.display = 'none';
        protectedContent.style.display = 'block';
        console.log("User signed in:", user.email);
        startLogoutTimer();
        document.body.classList.remove('login-page');
    } else {
        authContainer.style.display = 'block';
        protectedContent.style.display = 'none';
        authErrorMessage.textContent = '';
        console.log("User signed out.");
        clearTimeout(logoutTimer);
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