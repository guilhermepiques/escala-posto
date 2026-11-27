import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { createFirebaseStore, firebaseEnabled, logOut, signIn, watchUser } from './data/firebase';
import { createLocalStore, type Store } from './data/store';
import { defaultConfig } from './domain/defaults';
import type { AppConfig, Employee } from './domain/types';

interface AppState {
  store: Store;
  config: AppConfig;
  employees: Employee[];
  user: User | null;
  saveConfig: (c: AppConfig) => Promise<void>;
  saveEmployee: (e: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}

/** Garante campos novos em configurações salvas por versões antigas. */
function migrateConfig(c: AppConfig | null): AppConfig {
  const def = defaultConfig();
  if (!c) return def;
  // Versões antigas permitiam 6 dias seguidos; o padrão agora é 5 com folgas também de domingo a sábado.
  const old = c.rules && (c.rules as Partial<AppConfig['rules']>).alsoSundayWeeks === undefined;
  return {
    ...def,
    ...c,
    rules: { ...def.rules, ...c.rules, ...(old ? { maxConsecutiveDays: Math.min(c.rules.maxConsecutiveDays ?? 5, 5) } : {}) },
    customHolidays: c.customHolidays ?? [],
  };
}

/** Cadastros antigos (com turno fixo obrigatório) viram equipe dia/madrugada. */
function migrateEmployee(e: Employee & { shiftId?: string }): Employee {
  if (e.team) return e;
  const { shiftId, ...rest } = e;
  return { ...rest, team: shiftId === 'N' ? 'noite' : 'dia' };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [store, setStore] = useState<Store | null>(firebaseEnabled ? null : createLocalStore());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return watchUser((u) => {
      setUser(u);
      setAuthReady(true);
      setStore(u ? createFirebaseStore() : null);
      setConfig(null);
      setEmployees(null);
      setError(null);
    });
  }, []);

  useEffect(() => {
    if (!store) return;
    let alive = true;
    (async () => {
      try {
        const [c, e] = await Promise.all([store.getConfig(), store.listEmployees()]);
        if (!alive) return;
        const cfg = migrateConfig(c);
        if (!c) await store.saveConfig(cfg);
        setConfig(cfg);
        setEmployees(e.map(migrateEmployee).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })));
      } catch (err) {
        if (!alive) return;
        const msg = (err as Error).message ?? String(err);
        setError(
          msg.includes('permission')
            ? 'Esta conta do Google não tem permissão para acessar a escala. Entre com a conta autorizada.'
            : `Não foi possível carregar os dados: ${msg}`,
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [store]);

  const saveConfig = useCallback(
    async (c: AppConfig) => {
      const next = { ...c, updatedAt: Date.now() };
      setConfig(next);
      await store!.saveConfig(next);
    },
    [store],
  );

  const saveEmployee = useCallback(
    async (e: Employee) => {
      setEmployees((prev) =>
        [...(prev ?? []).filter((x) => x.id !== e.id), e].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
      );
      await store!.saveEmployee(e);
    },
    [store],
  );

  const deleteEmployee = useCallback(
    async (id: string) => {
      setEmployees((prev) => (prev ?? []).filter((x) => x.id !== id));
      await store!.deleteEmployee(id);
    },
    [store],
  );

  const value = useMemo<AppState | null>(
    () =>
      store && config && employees
        ? { store, config, employees, user, saveConfig, saveEmployee, deleteEmployee, logOut }
        : null,
    [store, config, employees, user, saveConfig, saveEmployee, deleteEmployee],
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
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Escala do Posto</h1>
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
