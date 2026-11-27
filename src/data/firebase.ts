import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { AppConfig, Employee, Schedule } from '../domain/types';
import { clean, type Store } from './store';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/** Todos os dados ficam debaixo deste documento. */
const ROOT = 'postos/principal';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!firebaseEnabled) throw new Error('Firebase não configurado');
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Cache local: continua funcionando se a internet cair por um momento.
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  }
  return { auth: auth!, db: db! };
}

export function watchUser(cb: (u: User | null) => void): () => void {
  const { auth } = init();
  return onAuthStateChanged(auth, cb);
}

export async function signIn(): Promise<void> {
  const { auth } = init();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logOut(): Promise<void> {
  const { auth } = init();
  await signOut(auth);
}

export function createFirebaseStore(): Store {
  const { db } = init();
  return {
    kind: 'firebase',
    async getConfig() {
      const snap = await getDoc(doc(db, `${ROOT}/meta/config`));
      return snap.exists() ? (snap.data() as AppConfig) : null;
    },
    async saveConfig(c) {
      await setDoc(doc(db, `${ROOT}/meta/config`), clean(c));
    },
    async listEmployees() {
      const snap = await getDocs(collection(db, `${ROOT}/employees`));
      return snap.docs.map((d) => d.data() as Employee);
    },
    async saveEmployee(e) {
      await setDoc(doc(db, `${ROOT}/employees/${e.id}`), clean(e));
    },
    async deleteEmployee(id) {
      await deleteDoc(doc(db, `${ROOT}/employees/${id}`));
    },
    async getSchedule(month) {
      const snap = await getDoc(doc(db, `${ROOT}/schedules/${month}`));
      return snap.exists() ? (snap.data() as Schedule) : null;
    },
    async saveSchedule(s) {
      await setDoc(doc(db, `${ROOT}/schedules/${s.month}`), clean(s));
    },
  };
}
