import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, query, where, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyC-_c45ORNlmAT3dlGOBXjOjkwrT6yx5F4",
    authDomain: "cuycitogo-app.firebaseapp.com",
    projectId: "cuycitogo-app",
    storageBucket: "cuycitogo-app.firebasestorage.app",
    messagingSenderId: "528964293797",
    appId: "1:528964293797:web:1c5ef6e8dbbeddc614a94c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
    app, auth, db, storage, 
    signInWithEmailAndPassword, onAuthStateChanged, signOut, 
    collection, getDocs, getDoc, query, where, doc, setDoc, deleteDoc, 
    ref, uploadBytes, getDownloadURL 
};