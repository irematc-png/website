import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQ5jZBEPmippdUOA6idWrtLOjkZ1LZCKU",
  authDomain: "drealimaportal.firebaseapp.com",
  projectId: "drealimaportal",
  storageBucket: "drealimaportal.firebasestorage.app",
  messagingSenderId: "893935662898",
  appId: "1:893935662898:web:028b18573ae5f9aefd492b"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

await setPersistence(auth, browserLocalPersistence);

export {
    app,
    auth,
    db
};