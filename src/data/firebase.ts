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
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { AppConfig, Employee, Schedule } from '../domain/types';
import {
  clean,
  HISTORY_LIMIT,
  splitMeta,
  stamp,
  type HistoryEntry,
  type HistoryKind,
  type Store,
  type StoreOptions,
  type TrashedEmployee,
} from './store';

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
    // Cache local: continua funcionando se a internet cair por um momento (e com várias abas abertas).
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
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
 * Cada posto é um "espaço" separado: postos/{postoId}.
 * - members: e-mails que podem ENTRAR (ver).
 * - editors: e-mails que podem MUDAR a escala, funcionários e configurações (sempre dentro de members).
 * Postos antigos não têm `editors`: aí todos de `members` podem editar (como era antes).
 */
export interface PostoInfo {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  members: string[];
  editors?: string[];
  createdAt?: number;
}

export const normEmail = (e: string) => e.trim().toLowerCase();

/** Quem pode editar neste posto. */
export const editorsOf = (p: PostoInfo) => p.editors ?? p.members;

/** Configuração geral da plataforma (só o administrador muda). */
export interface PlatformInfo {
  /** Apps com formato de dados abaixo deste número ficam só para ver (e o banco recusa a gravação). */
  minSchemaVersion: number;
  /** Mensagem opcional mostrada para todos (ex.: "atualize o app"). */
  message?: string;
  updatedAt?: number;
}

/** O administrador da plataforma é marcado no Console do Firebase: coleção "admins", documento com o UID da conta. */
export async function checkAdmin(user: User): Promise<boolean> {
  const { db } = init();
  try {
    return (await getDoc(doc(db, 'admins', user.uid))).exists();
  } catch {
    return false;
  }
}

export function watchPlatform(cb: (p: PlatformInfo) => void): () => void {
  const { db } = init();
  return onSnapshot(
    doc(db, 'plataforma', 'app'),
    (snap) => {
      const d = snap.data() as Partial<PlatformInfo> | undefined;
      cb({ minSchemaVersion: typeof d?.minSchemaVersion === 'number' ? d.minSchemaVersion : 0, message: d?.message, updatedAt: d?.updatedAt });
    },
    () => cb({ minSchemaVersion: 0 }),
  );
}

export async function savePlatform(p: PlatformInfo): Promise<void> {
  const { db } = init();
  await setDoc(doc(db, 'plataforma', 'app'), clean({ ...p, updatedAt: Date.now() }));
}

/** Postos aos quais o usuário tem acesso (o administrador vê todos). Se não tiver nenhum próprio nem convite, cria o dele. */
export async function loadPostos(user: User, admin: boolean): Promise<PostoInfo[]> {
  const { db } = init();
  const email = normEmail(user.email ?? '');
  const toInfo = (d: { id: string; data: () => unknown }) => ({ id: d.id, ...(d.data() as Omit<PostoInfo, 'id'>) });
  const mineSnap = await getDocs(query(collection(db, 'postos'), where('members', 'array-contains', email)));
  let list = mineSnap.docs.map(toInfo);
  if (list.length === 0) {
    const mine: Omit<PostoInfo, 'id'> = { ownerUid: user.uid, ownerEmail: email, members: [email], editors: [email], createdAt: Date.now() };
    await setDoc(doc(db, 'postos', user.uid), mine);
    list = [{ id: user.uid, ...mine }];
  }
  if (admin) {
    const all = (await getDocs(collection(db, 'postos'))).docs.map(toInfo);
    const ids = new Set(list.map((p) => p.id));
    list = [...list, ...all.filter((p) => !ids.has(p.id))];
  }
  return list;
}

/** Acompanha o posto (lista de acesso) em tempo real. */
export function watchPosto(postoId: string, cb: (p: PostoInfo | null) => void, onError: (e: Error) => void): () => void {
  const { db } = init();
  return onSnapshot(
    doc(db, 'postos', postoId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<PostoInfo, 'id'>) } : null),
    onError,
  );
}

/** Só o dono muda: quem entra (members) e quem edita (editors). */
export async function saveAccess(postoId: string, members: string[], editors: string[]): Promise<void> {
  const { db } = init();
  const m = [...new Set(members.map(normEmail))];
  const e = [...new Set(editors.map(normEmail))].filter((x) => m.includes(x));
  await updateDoc(doc(db, 'postos', postoId), { members: m, editors: e });
}

/** Nome do posto (para a lista do administrador). */
export async function getBusinessName(postoId: string): Promise<string | undefined> {
  const { db } = init();
  try {
    const snap = await getDoc(doc(db, `postos/${postoId}/meta/config`));
    return (snap.data() as AppConfig | undefined)?.businessName;
  } catch {
    return undefined;
  }
}

type Op = (b: ReturnType<typeof writeBatch>) => void;

/**
 * Avisa também quando só muda a origem (cache → servidor). Sem isto, uma lista vazia lida do cache e confirmada
 * vazia pelo servidor nunca gera um segundo aviso — e a tela ficava em "Carregando dados…" para sempre.
 */
const WITH_SERVER_CONFIRMATION = { includeMetadataChanges: true } as const;

/** Grava em lotes (o Firestore aceita até 500 operações por lote). */
async function commitAll(db: Firestore, ops: Op[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

export function createFirebaseStore(postoId: string, opts: StoreOptions): Store {
  const { db } = init();
  const { author, onTooNew } = opts;
  const root = `postos/${postoId}`;
  const configRef = doc(db, `${root}/meta/config`);
  const empRef = (id: string) => doc(db, `${root}/employees/${id}`);
  const trashRef = (id: string) => doc(db, `${root}/trash/${id}`);
  const schedRef = (month: string) => doc(db, `${root}/schedules/${month}`);
  const histCol = (kind: HistoryKind, key: string) =>
    collection(db, kind === 'config' ? `${root}/meta/config/history` : `${root}/schedules/${key}/history`);
  const trashEntry = (e: Employee): TrashedEmployee & ReturnType<typeof stamp> =>
    stamp({ employee: e, deletedAt: Date.now(), by: author.email, byName: author.name }, author);
  const histEntry = (reason: string, data: unknown) =>
    stamp({ at: Date.now(), by: author.email, byName: author.name, reason, data: clean(data) }, author);

  /** Mantém só as últimas HISTORY_LIMIT versões. */
  const prune = async (kind: HistoryKind, key: string) => {
    const snap = await getDocs(query(histCol(kind, key), orderBy('at', 'desc')));
    const extra = snap.docs.slice(HISTORY_LIMIT);
    if (extra.length) await commitAll(db, extra.map((d) => (b) => b.delete(d.ref)));
  };

  const store: Store = {
    kind: 'firebase',
    watchConfig(cb, onError) {
      return onSnapshot(
        configRef,
        WITH_SERVER_CONFIRMATION,
        (snap) => {
          // Sem o documento no cache local, espera a resposta do servidor antes de concluir que não existe.
          if (!snap.exists()) return snap.metadata.fromCache ? undefined : cb(null);
          cb(splitMeta<AppConfig>(snap.data(), onTooNew).data);
        },
        onError,
      );
    },
    async saveConfig(c) {
      await setDoc(configRef, stamp(c, author));
    },
    watchEmployees(cb, onError) {
      return onSnapshot(
        collection(db, `${root}/employees`),
        WITH_SERVER_CONFIRMATION,
        (snap) => {
          if (snap.empty && snap.metadata.fromCache) return;
          cb(snap.docs.map((d) => splitMeta<Employee>(d.data(), onTooNew).data));
        },
        onError,
      );
    },
    async saveEmployee(e) {
      await setDoc(empRef(e.id), stamp(e, author));
    },
    async deleteEmployee(e) {
      await commitAll(db, [(b) => b.set(trashRef(e.id), trashEntry(e)), (b) => b.delete(empRef(e.id))]);
    },
    async listTrash() {
      const snap = await getDocs(collection(db, `${root}/trash`));
      return snap.docs
        .map((d) => splitMeta<TrashedEmployee>(d.data()).data)
        .sort((a, b) => b.deletedAt - a.deletedAt);
    },
    async restoreEmployee(id) {
      const snap = await getDoc(trashRef(id));
      if (!snap.exists()) return;
      const t = splitMeta<TrashedEmployee>(snap.data()).data;
      await commitAll(db, [(b) => b.set(empRef(id), stamp(t.employee, author)), (b) => b.delete(trashRef(id))]);
    },
    watchSchedule(month, cb, onError) {
      return onSnapshot(
        schedRef(month),
        WITH_SERVER_CONFIRMATION,
        (snap) => {
          if (!snap.exists()) return snap.metadata.fromCache ? undefined : cb(null, null);
          const { data, meta } = splitMeta<Schedule>(snap.data(), onTooNew);
          cb(data, meta);
        },
        onError,
      );
    },
    async listSchedules() {
      const snap = await getDocs(collection(db, `${root}/schedules`));
      return snap.docs.map((d) => splitMeta<Schedule>(d.data()).data);
    },
    async saveSchedule(s) {
      await setDoc(schedRef(s.month), stamp(s, author));
    },
    async addHistory(kind, key, reason, data) {
      await addDoc(histCol(kind, key), histEntry(reason, data));
      await prune(kind, key).catch(() => undefined);
    },
    async listHistory<T>(kind: HistoryKind, key: string) {
      const snap = await getDocs(query(histCol(kind, key), orderBy('at', 'desc'), limit(HISTORY_LIMIT)));
      return snap.docs.map((d) => ({ ...splitMeta<Omit<HistoryEntry<T>, 'id'>>(d.data()).data, id: d.id }));
    },
    async importAll(b) {
      const ops: Op[] = [];
      // 1) O que existe hoje vai para o histórico/lixeira antes de ser substituído.
      if (b.config) {
        const cur = await getDoc(configRef);
        if (cur.exists()) {
          const data = splitMeta(cur.data()).data;
          ops.push((bt) => bt.set(doc(histCol('config', 'config')), histEntry('Antes de restaurar um backup', data)));
        }
      }
      const curSchedules = await getDocs(collection(db, `${root}/schedules`));
      const inFile = new Set(b.schedules.map((s) => s.month));
      for (const d of curSchedules.docs) {
        if (!inFile.has(d.id)) continue;
        const data = splitMeta(d.data()).data;
        ops.push((bt) => bt.set(doc(histCol('schedule', d.id)), histEntry('Antes de restaurar um backup', data)));
      }
      const curEmps = await getDocs(collection(db, `${root}/employees`));
      const keep = new Set(b.employees.map((e) => e.id));
      for (const d of curEmps.docs) {
        if (keep.has(d.id)) continue;
        const e = splitMeta<Employee>(d.data()).data;
        ops.push((bt) => bt.set(trashRef(d.id), trashEntry(e)));
        ops.push((bt) => bt.delete(d.ref));
      }
      // 2) Grava o conteúdo do arquivo.
      for (const e of b.employees) ops.push((bt) => bt.set(empRef(e.id), stamp(e, author)));
      if (b.config) {
        const c = b.config;
        ops.push((bt) => bt.set(configRef, stamp(c, author)));
      }
      for (const s of b.schedules) ops.push((bt) => bt.set(schedRef(s.month), stamp(s, author)));
      await commitAll(db, ops);
    },
  };
  return store;
}
