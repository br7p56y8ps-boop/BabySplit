import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the exact databaseId from the config
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId);

// Authenticate anonymously if enabled, or catch gracefully
signInAnonymously(auth).catch((error) => {
  console.warn("Anonymous auth restricted or disabled in Firebase settings, falling back to local session user ID:", error.message);
});

// Connection validation check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'spaces', 'public'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
