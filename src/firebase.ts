import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey:            "AIzaSyC-jKcNYybqiExdKmpWCL1F5E77JyXBLMc",
  authDomain:        "kubasa.firebaseapp.com",
  projectId:         "kubasa",
  storageBucket:     "kubasa.firebasestorage.app",
  messagingSenderId: "969629472426",
  appId:             "1:969629472426:web:be9c17daef70e19d5d22d3"
};

// Initialize Firebase compat app
try {
  firebase.app();
} catch {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

// Connect emulators in local development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  try {
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8080);
    storage.useEmulator('127.0.0.1', 9199);
  } catch (e) {
    // Emulator configuration already set
  }
}

export { firebase, auth, db, storage };
