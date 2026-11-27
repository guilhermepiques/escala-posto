import type { AppConfig, Employee, MonthKey, Schedule } from '../domain/types';
import type { BackupData } from './backup';

/**
 * Versão do FORMATO dos dados que este app grava. Suba este número só quando mudar o jeito de guardar
 * (ex.: renomear um campo). Um app mais velho que encontra dados de formato mais novo para de salvar,
 * e o banco recusa gravações de apps abaixo da "versão mínima" definida pelo administrador.
 */
export const SCHEMA_VERSION = 1;

/** Quantas versões anteriores guardar por escala (e das configurações). */
export const HISTORY_LIMIT = 30;

/** Quem está gravando (vai junto em cada gravação). */
export interface Author {
  email: string;
  name?: string;
}

/** Informações de controle gravadas junto com cada documento. */
export interface DocMeta {
  schemaVersion?: number;
  updatedAt?: number;
  updatedBy?: string;
  updatedByName?: string;
}

export type Unsub = () => void;
export type HistoryKind = 'schedule' | 'config';

export interface HistoryEntry<T> {
  id: string;
  at: number;
  by?: string;
  byName?: string;
  reason: string;
  data: T;
}

export interface TrashedEmployee {
  employee: Employee;
  deletedAt: number;
  by?: string;
  byName?: string;
}

/** Onde os dados ficam guardados. A tela não sabe se é Firebase ou o navegador. */
export interface Store {
  kind: 'local' | 'firebase';
  /** Avisa sempre que a configuração mudar (inclusive por outra pessoa). `null` = ainda não existe. */
  watchConfig(cb: (c: AppConfig | null) => void, onError: (e: Error) => void): Unsub;
  saveConfig(c: AppConfig): Promise<void>;
  watchEmployees(cb: (list: Employee[]) => void, onError: (e: Error) => void): Unsub;
  saveEmployee(e: Employee): Promise<void>;
  /** Não apaga de vez: o cadastro vai para a lixeira e pode ser restaurado. */
  deleteEmployee(e: Employee): Promise<void>;
  listTrash(): Promise<TrashedEmployee[]>;
  restoreEmployee(id: string): Promise<void>;
  watchSchedule(month: MonthKey, cb: (s: Schedule | null, meta: DocMeta | null) => void, onError: (e: Error) => void): Unsub;
  listSchedules(): Promise<Schedule[]>;
  saveSchedule(s: Schedule): Promise<void>;
  /** Guarda uma cópia (versão anterior). `key` = mês da escala ou 'config'. */
  addHistory<T>(kind: HistoryKind, key: string, reason: string, data: T): Promise<void>;
  listHistory<T>(kind: HistoryKind, key: string): Promise<HistoryEntry<T>[]>;
  /** Restaura um backup: substitui configurações, funcionários e as escalas que estão no arquivo. */
  importAll(b: BackupData): Promise<void>;
}

export interface StoreOptions {
  author: Author;
  /** Chamado quando aparece um dado gravado por uma versão mais nova do app. */
  onTooNew?: () => void;
}

/** Firestore não aceita `undefined`; isto limpa o objeto. */
export function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const META_KEYS = ['schemaVersion', 'updatedBy', 'updatedByName'] as const;

/** Acrescenta as informações de controle antes de gravar. */
export function stamp<T extends object>(v: T, author: Author): T & DocMeta {
  return clean({ ...v, schemaVersion: SCHEMA_VERSION, updatedBy: author.email, updatedByName: author.name });
}

/** Separa os dados das informações de controle ao ler. */
export function splitMeta<T>(raw: Record<string, unknown>, onTooNew?: () => void): { data: T; meta: DocMeta } {
  const data: Record<string, unknown> = { ...raw };
  const meta: DocMeta = {};
  for (const k of META_KEYS) {
    if (k in data) {
      (meta as Record<string, unknown>)[k] = data[k];
      delete data[k];
    }
  }
  if (typeof raw.updatedAt === 'number') meta.updatedAt = raw.updatedAt;
  if ((meta.schemaVersion ?? 0) > SCHEMA_VERSION) onTooNew?.();
  return { data: data as T, meta };
}

const KEY = 'escala-posto:v1';

interface LocalData {
  config: (AppConfig & DocMeta) | null;
  employees: Record<string, Employee & DocMeta>;
  schedules: Record<string, Schedule & DocMeta>;
  trash?: Record<string, TrashedEmployee>;
  history?: Record<string, HistoryEntry<unknown>[]>;
}

/** Modo local: guarda no navegador. Usado enquanto o Firebase não está configurado. */
export function createLocalStore(opts: StoreOptions = { author: { email: '' } }): Store {
  const { author, onTooNew } = opts;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const read = (): LocalData => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignora */
    }
    return { config: null, employees: {}, schedules: {} };
  };
  const write = (d: LocalData) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignora */
    }
    notify();
  };
  /** Chama `emit` agora e a cada mudança (nesta aba ou em outra aba do navegador). */
  const watch = (emit: () => void): Unsub => {
    const onStorage = (ev: StorageEvent) => ev.key === KEY && emit();
    listeners.add(emit);
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    queueMicrotask(emit);
    return () => {
      listeners.delete(emit);
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  };
  const histKey = (kind: HistoryKind, key: string) => `${kind}:${key}`;

  const store: Store = {
    kind: 'local',
    watchConfig(cb) {
      return watch(() => {
        const c = read().config;
        cb(c ? splitMeta<AppConfig>(c as unknown as Record<string, unknown>, onTooNew).data : null);
      });
    },
    async saveConfig(c) {
      const d = read();
      d.config = stamp(c, author);
      write(d);
    },
    watchEmployees(cb) {
      return watch(() =>
        cb(Object.values(read().employees).map((e) => splitMeta<Employee>(e as unknown as Record<string, unknown>, onTooNew).data)),
      );
    },
    async saveEmployee(e) {
      const d = read();
      d.employees[e.id] = stamp(e, author);
      write(d);
    },
    async deleteEmployee(e) {
      const d = read();
      delete d.employees[e.id];
      d.trash = { ...(d.trash ?? {}), [e.id]: clean({ employee: e, deletedAt: Date.now(), by: author.email, byName: author.name }) };
      write(d);
    },
    async listTrash() {
      return Object.values(read().trash ?? {}).sort((a, b) => b.deletedAt - a.deletedAt);
    },
    async restoreEmployee(id) {
      const d = read();
      const t = d.trash?.[id];
      if (!t) return;
      d.employees[id] = stamp(t.employee, author);
      delete d.trash![id];
      write(d);
    },
    watchSchedule(month, cb) {
      return watch(() => {
        const s = read().schedules[month];
        if (!s) return cb(null, null);
        const { data, meta } = splitMeta<Schedule>(s as unknown as Record<string, unknown>, onTooNew);
        cb(data, meta);
      });
    },
    async listSchedules() {
      return Object.values(read().schedules).map((s) => splitMeta<Schedule>(s as unknown as Record<string, unknown>).data);
    },
    async saveSchedule(s) {
      const d = read();
      d.schedules[s.month] = stamp(s, author);
      write(d);
    },
    async addHistory(kind, key, reason, data) {
      const d = read();
      const k = histKey(kind, key);
      const entry: HistoryEntry<unknown> = clean({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        by: author.email,
        byName: author.name,
        reason,
        data,
      });
      d.history = { ...(d.history ?? {}), [k]: [entry, ...(d.history?.[k] ?? [])].slice(0, HISTORY_LIMIT) };
      write(d);
    },
    async listHistory<T>(kind: HistoryKind, key: string) {
      return (read().history?.[histKey(kind, key)] ?? []) as HistoryEntry<T>[];
    },
    async importAll(b) {
      // Guarda o que existe hoje no histórico antes de substituir.
      const before = read();
      if (before.config && b.config) await store.addHistory('config', 'config', 'Antes de restaurar um backup', splitMeta(before.config as unknown as Record<string, unknown>).data);
      for (const s of b.schedules) {
        const old = before.schedules[s.month];
        if (old) await store.addHistory('schedule', s.month, 'Antes de restaurar um backup', splitMeta(old as unknown as Record<string, unknown>).data);
      }
      const d = read();
      const keep = new Set(b.employees.map((e) => e.id));
      for (const e of Object.values(d.employees)) {
        if (!keep.has(e.id)) {
          const emp = splitMeta<Employee>(e as unknown as Record<string, unknown>).data;
          d.trash = { ...(d.trash ?? {}), [e.id]: clean({ employee: emp, deletedAt: Date.now(), by: author.email, byName: author.name }) };
          delete d.employees[e.id];
        }
      }
      for (const e of b.employees) d.employees[e.id] = stamp(e, author);
      if (b.config) d.config = stamp(b.config, author);
      for (const s of b.schedules) d.schedules[s.month] = stamp(s, author);
      write(d);
    },
  };
  return store;
}
