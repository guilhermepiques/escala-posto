import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  checkAdmin,
  createFirebaseStore,
  editorsOf,
  firebaseEnabled,
  loadPostos,
  logOut,
  normEmail,
  saveAccess,
  signIn,
  watchPlatform,
  watchPosto,
  watchUser,
  type PlatformInfo,
  type PostoInfo,
} from './data/firebase';
import { createLocalStore, SCHEMA_VERSION, type Store } from './data/store';
import { defaultConfig } from './domain/defaults';
import type { AppConfig, Employee } from './domain/types';

/** Por que a pessoa não pode editar agora. */
export type ReadOnlyReason = 'viewer' | 'outdated' | null;

interface AppState {
  store: Store;
  config: AppConfig;
  employees: Employee[];
  user: User | null;
  /** Posto atual (só no modo Firebase). */
  posto: PostoInfo | null;
  /** Todos os postos a que o usuário tem acesso (o administrador vê todos). */
  postos: PostoInfo[];
  /** Pode mudar escala, funcionários e configurações. */
  canEdit: boolean;
  readOnlyReason: ReadOnlyReason;
  isOwner: boolean;
  /** Administrador da plataforma (dono do EscalApp). */
  isAdmin: boolean;
  platform: PlatformInfo;
  switchPosto: (id: string) => void;
  updateAccess: (members: string[], editors: string[]) => Promise<void>;
  saveConfig: (c: AppConfig) => Promise<void>;
  saveEmployee: (e: Employee) => Promise<void>;
  deleteEmployee: (e: Employee) => Promise<void>;
  logOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}

/** Garante campos novos em configurações salvas por versões antigas. */
export function migrateConfig(c: AppConfig | null): AppConfig {
  const def = defaultConfig();
  if (!c) return def;
  // Versões antigas permitiam 6 dias seguidos; o padrão agora é 5 com folgas também de domingo a sábado.
  const old = c.rules && (c.rules as Partial<AppConfig['rules']>).alsoSundayWeeks === undefined;
  return {
    ...def,
    ...c,
    rules: { ...def.rules, ...c.rules, ...(old ? { maxConsecutiveDays: Math.min(c.rules.maxConsecutiveDays ?? 5, 5) } : {}) },
    customHolidays: c.customHolidays ?? [],
    restrictions: c.restrictions ?? [],
    movement: { ...def.movement, ...(c.movement ?? {}) },
    minPerShift: { ...def.minPerShift, ...(c.minPerShift ?? {}) },
  };
}

/** Cadastros antigos (com turno fixo obrigatório) viram equipe dia/madrugada. */
export function migrateEmployee(e: Employee & { shiftId?: string }): Employee {
  if (e.team) return e;
  const { shiftId, ...rest } = e;
  return { ...rest, team: shiftId === 'N' ? 'noite' : 'dia' };
}

const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });

const permissionMsg = (err: unknown) => {
  const msg = (err as Error)?.message ?? String(err);
  return msg.includes('permission') || msg.includes('insufficient')
    ? 'Esta conta do Google não tem (mais) permissão para acessar esta escala. Entre com a conta autorizada.'
    : `Não foi possível carregar os dados: ${msg}`;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tooNew, setTooNew] = useState(false);
  const [store, setStore] = useState<Store | null>(
    firebaseEnabled ? null : createLocalStore({ author: { email: '' }, onTooNew: () => setTooNew(true) }),
  );
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postos, setPostos] = useState<PostoInfo[]>([]);
  const [postoId, setPostoId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformInfo>({ minSchemaVersion: 0 });

  useEffect(() => {
    if (!firebaseEnabled) return;
    return watchUser(async (u) => {
      setUser(u);
      setConfig(null);
      setEmployees(null);
      setError(null);
      setStore(null);
      setTooNew(false);
      if (!u) {
        setPostos([]);
        setPostoId(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      try {
        const admin = await checkAdmin(u);
        setIsAdmin(admin);
        const list = await loadPostos(u, admin);
        setPostos(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem('escala:posto');
        } catch {
          /* ignora */
        }
        const email = normEmail(u.email ?? '');
        const mine = list.filter((p) => p.members.includes(email));
        // Prefere o último posto usado; senão, um posto para o qual a pessoa foi convidada.
        const chosen = list.find((p) => p.id === saved) ?? mine.find((p) => p.ownerUid !== u.uid) ?? mine[0] ?? list[0];
        setPostoId(chosen.id);
      } catch (err) {
        setError(`Não foi possível abrir a conta: ${(err as Error).message}`);
      }
      setAuthReady(true);
    });
  }, []);

  // Versão mínima do app (definida pelo administrador), em tempo real.
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    return watchPlatform(setPlatform);
  }, [user]);

  // Lista de acesso do posto em tempo real (se o dono mudar algo, vale na hora).
  useEffect(() => {
    if (!postoId) return;
    return watchPosto(
      postoId,
      (p) => p && setPostos((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p])),
      (err) => setError(permissionMsg(err)),
    );
  }, [postoId]);

  useEffect(() => {
    if (!postoId || !user) return;
    setConfig(null);
    setEmployees(null);
    setTooNew(false);
    setStore(
      createFirebaseStore(postoId, {
        author: { email: normEmail(user.email ?? ''), name: user.displayName ?? undefined },
        onTooNew: () => setTooNew(true),
      }),
    );
    try {
      localStorage.setItem('escala:posto', postoId);
    } catch {
      /* ignora */
    }
  }, [postoId, user]);

  const posto = postos.find((p) => p.id === postoId) ?? null;
  const email = normEmail(user?.email ?? '');
  const outdated = tooNew || SCHEMA_VERSION < platform.minSchemaVersion;
  const isEditor = !firebaseEnabled || (!!posto && editorsOf(posto).includes(email));
  const canEdit = isEditor && !outdated;
  const readOnlyReason: ReadOnlyReason = outdated ? 'outdated' : !isEditor ? 'viewer' : null;
  const isOwner = !!posto && posto.ownerUid === user?.uid;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const updateAccess = useCallback(
    async (members: string[], editors: string[]) => {
      if (!posto) return;
      await saveAccess(posto.id, members, editors);
    },
    [posto],
  );

  // Configurações e funcionários em tempo real.
  useEffect(() => {
    if (!store) return;
    let alive = true;
    const onError = (err: Error) => alive && setError(permissionMsg(err));
    const unsubConfig = store.watchConfig((c) => {
      if (!alive) return;
      const cfg = migrateConfig(c);
      // Posto novo: grava a configuração padrão (só quem pode editar).
      if (!c && canEditRef.current) store.saveConfig(cfg).catch(() => undefined);
      setConfig(cfg);
    }, onError);
    const unsubEmps = store.watchEmployees((list) => {
      if (alive) setEmployees(list.map(migrateEmployee).sort(byName));
    }, onError);
    return () => {
      alive = false;
      unsubConfig();
      unsubEmps();
    };
  }, [store]);

  const guard = useCallback(() => {
    if (!canEditRef.current) throw new Error('Você não tem permissão para editar.');
  }, []);

  const saveConfig = useCallback(
    async (c: AppConfig) => {
      guard();
      const next = { ...c, updatedAt: Date.now() };
      setConfig(next);
      await store!.saveConfig(next);
    },
    [store, guard],
  );

  const saveEmployee = useCallback(
    async (e: Employee) => {
      guard();
      setEmployees((prev) => [...(prev ?? []).filter((x) => x.id !== e.id), e].sort(byName));
      await store!.saveEmployee(e);
    },
    [store, guard],
  );

  const deleteEmployee = useCallback(
    async (e: Employee) => {
      guard();
      setEmployees((prev) => (prev ?? []).filter((x) => x.id !== e.id));
      await store!.deleteEmployee(e);
    },
    [store, guard],
  );

  const value = useMemo<AppState | null>(
    () =>
      store && config && employees
        ? {
            store,
            config,
            employees,
            user,
            posto,
            postos,
            canEdit,
            readOnlyReason,
            isOwner,
            isAdmin,
            platform,
            switchPosto: setPostoId,
            updateAccess,
            saveConfig,
            saveEmployee,
            deleteEmployee,
            logOut,
          }
        : null,
    [store, config, employees, user, posto, postos, canEdit, readOnlyReason, isOwner, isAdmin, platform, updateAccess, saveConfig, saveEmployee, deleteEmployee],
  );

  if (!authReady) return <FullScreen>Carregando…</FullScreen>;
  if (firebaseEnabled && !user) return <LoginScreen />;
  if (error)
    return (
      <FullScreen>
        <p className="mb-4 text-red-700">{error}</p>
        {firebaseEnabled && (
          <button className="btn" onClick={() => logOut()}>
            Sair e entrar com outra conta
          </button>
        )}
      </FullScreen>
    );
  if (!value) return <FullScreen>Carregando dados…</FullScreen>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-700">
      <div>{children}</div>
    </div>
  );
}

function LoginScreen() {
  const [err, setErr] = useState<string | null>(null);
  return (
    <FullScreen>
      <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <img src="/favicon.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
        <h1 className="mb-2 text-2xl font-bold text-slate-900">EscalApp</h1>
        <p className="mb-6 text-slate-600">Entre com a conta do Google autorizada para montar a escala.</p>
        <button
          className="btn btn-primary w-full"
          onClick={() => signIn().catch((e) => setErr((e as Error).message))}
        >
          Entrar com Google
        </button>
        {err && <p className="mt-4 text-sm text-red-700">{err}</p>}
      </div>
    </FullScreen>
  );
}
