// config/firebase.js
const admin = require('firebase-admin');
const path = require('path');

let firebaseApp = null;
let firestoreInstance = null;

// Fungsi initialize Firebase Admin SDK
const initializeFirebase = async () => {
  try {
    // Jangan initialize ulang jika sudah ada
    if (firebaseApp) {
      console.log('Firebase already initialized');
      return firebaseApp;
    }

    let credential;
    
    // Cek apakah menggunakan service account file atau environment variables
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Menggunakan service account file
      const serviceAccountPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('Loading service account from:', serviceAccountPath);
      
      // Cek apakah file ada
      const fs = require('fs');
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account file not found: ${serviceAccountPath}`);
      }
      
      const serviceAccount = require(serviceAccountPath);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      // Menggunakan environment variables
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };
      credential = admin.credential.cert(serviceAccount);
    } else {
      throw new Error('Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or Firebase environment variables');
    }

    // Initialize Firebase Admin SDK
    firebaseApp = admin.initializeApp({
      credential: credential,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('Firebase initialized successfully');
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('Database ID:', process.env.FIRESTORE_DATABASE_ID);
    
    return firebaseApp;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

// Fungsi untuk mendapatkan instance Firestore dengan database ID yang spesifik
const getFirestore = () => {
  try {
    if (!firestoreInstance) {
      if (!firebaseApp) {
        throw new Error('Firebase not initialized. Call initializeFirebase() first.');
      }
      
      // Gunakan getFirestore dari firebase-admin/firestore dengan database ID
      const { getFirestore: getFS } = require('firebase-admin/firestore');
      
      // Jika ada FIRESTORE_DATABASE_ID, gunakan database tersebut
      if (process.env.FIRESTORE_DATABASE_ID && process.env.FIRESTORE_DATABASE_ID !== '(default)') {
        firestoreInstance = getFS(firebaseApp, process.env.FIRESTORE_DATABASE_ID);
        console.log(`Using Firestore database: ${process.env.FIRESTORE_DATABASE_ID}`);
      } else {
        firestoreInstance = getFS(firebaseApp);
        console.log('Using default Firestore database');
      }
      
      // Set beberapa settings untuk Firestore
      firestoreInstance.settings({
        ignoreUndefinedProperties: true
      });
    }
    
    return firestoreInstance;
  } catch (error) {
    console.error('Firestore initialization error:', error);
    throw new Error(`Firestore initialization failed: ${error.message}`);
  }
};

// Fungsi untuk test koneksi Firestore
const testFirestoreConnection = async () => {
  try {
    const db = getFirestore();
    
    // Test dengan membaca collection yang sederhana
    const testCollection = await db.collection('_test').limit(1).get();
    console.log('Firestore connection test successful');
    
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};

// Fungsi untuk membuat collection USER jika belum ada
const ensureUserCollection = async () => {
  try {
    const db = getFirestore();
    
    // Cek apakah collection USER sudah ada dengan mencoba query
    const userCollection = await db.collection('USER').limit(1).get();
    
    if (userCollection.empty) {
      console.log('USER collection is empty, this is normal for new databases');
    } else {
      console.log('USER collection exists and has data');
    }
    
    return true;
  } catch (error) {
    console.error('Error checking USER collection:', error);
    
    // Jika error adalah NOT_FOUND, mungkin collection belum ada
    if (error.code === 5) {
      console.log('USER collection might not exist yet, will be created on first write');
    }
    
    return false;
  }
};

module.exports = { 
  initializeFirebase, 
  getFirestore, 
  testFirestoreConnection,
  ensureUserCollection 
};