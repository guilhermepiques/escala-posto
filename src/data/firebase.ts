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
  query,
  setDoc,
  updateDoc,
  where,
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

/**
 * Cada posto é um "espaço" separado: postos/{postoId}, com a lista de e-mails que têm acesso.
 * Quem cria a conta vira dono; o dono libera outros e-mails em Configurações.
 */
export interface PostoInfo {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  members: string[];
  createdAt?: number;
}

export const normEmail = (e: string) => e.trim().toLowerCase();

/** Postos aos quais o usuário tem acesso. Se não tiver nenhum, cria o dele. */
export async function loadPostos(user: User): Promise<PostoInfo[]> {
  const { db } = init();
  const email = normEmail(user.email ?? '');
  const snap = await getDocs(query(collection(db, 'postos'), where('members', 'array-contains', email)));
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostoInfo, 'id'>) }));
  if (list.length > 0) return list;
  const mine: Omit<PostoInfo, 'id'> = { ownerUid: user.uid, ownerEmail: email, members: [email], createdAt: Date.now() };
  await setDoc(doc(db, 'postos', user.uid), mine);
  return [{ id: user.uid, ...mine }];
}

export async function saveMembers(postoId: string, members: string[]): Promise<void> {
  const { db } = init();
  await updateDoc(doc(db, 'postos', postoId), { members: [...new Set(members.map(normEmail))] });
}

export function createFirebaseStore(postoId: string): Store {
  const { db } = init();
  const root = `postos/${postoId}`;
  return {
    kind: 'firebase',
    async getConfig() {
      const snap = await getDoc(doc(db, `${root}/meta/config`));
      return snap.exists() ? (snap.data() as AppConfig) : null;
    },
    async saveConfig(c) {
      await setDoc(doc(db, `${root}/meta/config`), clean(c));
    },
    async listEmployees() {
      const snap = await getDocs(collection(db, `${root}/employees`));
      return snap.docs.map((d) => d.data() as Employee);
    },
    async saveEmployee(e) {
      await setDoc(doc(db, `${root}/employees/${e.id}`), clean(e));
    },
    async deleteEmployee(id) {
      await deleteDoc(doc(db, `${root}/employees/${id}`));
    },
    async getSchedule(month) {
      const snap = await getDoc(doc(db, `${root}/schedules/${month}`));
      return snap.exists() ? (snap.data() as Schedule) : null;
    },
    async saveSchedule(s) {
      await setDoc(doc(db, `${root}/schedules/${s.month}`), clean(s));
    },
  };
}
