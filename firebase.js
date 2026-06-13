import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  get,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuNbEcsm_aiXIUXxsVq6vkMDBZNPexH88",
  authDomain: "bingovicky-ebad1.firebaseapp.com",
  databaseURL: "https://bingovicky-ebad1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bingovicky-ebad1",
  storageBucket: "bingovicky-ebad1.firebasestorage.app",
  messagingSenderId: "69770922572",
  appId: "1:69770922572:web:23509243d16bae088942e9",
  measurementId: "G-KTB33J64VQ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.FirebaseGame = {
  db,
  ref,
  set,
  update,
  onValue,
  get,
  push,
  serverTimestamp
};