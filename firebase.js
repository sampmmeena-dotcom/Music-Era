// Import Firebase SDK
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNAu1Ig5Piwfh96mht6JD2usaSvlVctqc",
  authDomain: "studio-2215202512-895cc.firebaseapp.com",
  projectId: "studio-2215202512-895cc",
  storageBucket: "studio-2215202512-895cc.firebasestorage.app",
  messagingSenderId: "397538808539",
  appId: "1:397538808539:web:05a12ff51e08e8b83272fe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
const auth = getAuth(app);

// Export auth so server.js can use it
module.exports = { auth };
