import type { AppConfig, Employee, MonthKey, Schedule } from '../domain/types';

/** Onde os dados ficam guardados. A tela não sabe se é Firebase ou o navegador. */
export interface Store {
  kind: 'local' | 'firebase';
  getConfig(): Promise<AppConfig | null>;
  saveConfig(c: AppConfig): Promise<void>;
  listEmployees(): Promise<Employee[]>;
  saveEmployee(e: Employee): Promise<void>;
  deleteEmployee(id: string): Promise<void>;
  getSchedule(month: MonthKey): Promise<Schedule | null>;
  saveSchedule(s: Schedule): Promise<void>;
}

/** Firestore não aceita `undefined`; isto limpa o objeto. */
export function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const KEY = 'escala-posto:v1';

interface LocalData {
  config: AppConfig | null;
  employees: Record<string, Employee>;
  schedules: Record<string, Schedule>;
}

/** Modo local: guarda no navegador. Usado enquanto o Firebase não está configurado. */
export function createLocalStore(): Store {
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
  };
  return {
    kind: 'local',
    async getConfig() {
      return read().config;
    },
    async saveConfig(c) {
      const d = read();
      d.config = clean(c);
      write(d);
    },
    async listEmployees() {
      return Object.values(read().employees);
    },
    async saveEmployee(e) {
      const d = read();
      d.employees[e.id] = clean(e);
      write(d);
    },
    async deleteEmployee(id) {
      const d = read();
      delete d.employees[id];
      write(d);
    },
    async getSchedule(month) {
      return read().schedules[month] ?? null;
    },
    async saveSchedule(s) {
      const d = read();
      d.schedules[s.month] = clean(s);
      write(d);
    },
  };
}
