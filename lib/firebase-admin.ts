import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

function getAdminApp() {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = serviceAccountJson
    ? cert(JSON.parse(serviceAccountJson))
    : applicationDefault();

  return initializeApp({
    credential,
    projectId: firebaseConfig.projectId,
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp(), firebaseConfig.firestoreDatabaseId);
}

export async function verifyFirebaseIdToken(idToken: string) {
  return getAuth(getAdminApp()).verifyIdToken(idToken);
}
