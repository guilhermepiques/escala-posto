import { beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig, Employee, Schedule } from '../domain/types';
import { defaultConfig } from '../domain/defaults';
import { backupFileName, makeBackup, parseBackup } from './backup';
import { createLocalStore, HISTORY_LIMIT, SCHEMA_VERSION, splitMeta, stamp } from './store';

// localStorage simples para rodar no Node.
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const emp = (id: string, name: string): Employee => ({ id, name, female: false, team: 'dia', active: true, absences: [] });
const sched = (month: string, n: number): Schedule => ({
  month,
  assignments: { a: Object.fromEntries(Array.from({ length: n }, (_, i) => [`${month}-${String(i + 1).padStart(2, '0')}`, 'M'])) },
  locked: {},
});
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe('informações de controle', () => {
  it('grava a versão e o autor e separa na leitura', () => {
    const s = stamp({ x: 1, updatedAt: 5 }, { email: 'a@b.com', name: 'Ana' });
    expect(s).toMatchObject({ x: 1, schemaVersion: SCHEMA_VERSION, updatedBy: 'a@b.com', updatedByName: 'Ana' });
    const { data, meta } = splitMeta<{ x: number }>(s as unknown as Record<string, unknown>);
    expect(data).toEqual({ x: 1, updatedAt: 5 });
    expect(meta).toEqual({ schemaVersion: SCHEMA_VERSION, updatedBy: 'a@b.com', updatedByName: 'Ana', updatedAt: 5 });
  });

  it('avisa quando o dado veio de uma versão mais nova do app', () => {
    let tooNew = false;
    splitMeta({ schemaVersion: SCHEMA_VERSION + 1 }, () => (tooNew = true));
    expect(tooNew).toBe(true);
    tooNew = false;
    splitMeta({ schemaVersion: SCHEMA_VERSION }, () => (tooNew = true));
    splitMeta({}, () => (tooNew = true));
    expect(tooNew).toBe(false);
  });
});

describe('backup em arquivo', () => {
  const data = { config: { ...defaultConfig(), businessName: 'Posto São João' }, employees: [emp('a', 'Ana')], schedules: [sched('2026-12', 3), sched('2026-11', 2)] };

  it('ida e volta', () => {
    const b = makeBackup(data, '1.2.3', Date.UTC(2026, 10, 27, 12));
    const back = parseBackup(JSON.stringify(b));
    expect(back.employees).toEqual(data.employees);
    expect(back.schedules.map((s) => s.month)).toEqual(['2026-11', '2026-12']);
    expect(back.config?.businessName).toBe('Posto São João');
    expect(backupFileName(b)).toMatch(/^EscalApp-backup-Posto-Sao-Joao-2026-11-2\d\.json$/);
  });

  it('recusa arquivos que não são backup ou estão com defeito', () => {
    expect(() => parseBackup('isso não é json')).toThrow(/não é um backup/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/não é um backup/);
    const ok = makeBackup(data, '1');
    expect(() => parseBackup(JSON.stringify({ ...ok, schemaVersion: SCHEMA_VERSION + 1 }))).toThrow(/versão mais nova/);
    expect(() => parseBackup(JSON.stringify({ ...ok, employees: [{ id: 1 }] }))).toThrow(/funcionários/);
    expect(() => parseBackup(JSON.stringify({ ...ok, employees: [emp('a', 'A'), emp('a', 'B')] }))).toThrow(/repetido/);
    expect(() => parseBackup(JSON.stringify({ ...ok, schedules: [{ month: 'dez', assignments: {} }] }))).toThrow(/escalas/);
    expect(() => parseBackup(JSON.stringify({ ...ok, config: { shifts: 'x' } }))).toThrow(/turnos/);
  });
});

describe('modo local', () => {
  it('avisa as mudanças em tempo real', async () => {
    const store = createLocalStore();
    const seen: number[] = [];
    const unsub = store.watchEmployees((l) => seen.push(l.length), () => undefined);
    await tick();
    await store.saveEmployee(emp('a', 'Ana'));
    await store.saveEmployee(emp('b', 'Bia'));
    unsub();
    await store.saveEmployee(emp('c', 'Caio'));
    expect(seen).toEqual([0, 1, 2]);
  });

  it('excluir manda para a lixeira e dá para restaurar', async () => {
    const store = createLocalStore({ author: { email: 'mae@x.com', name: 'Mãe' } });
    await store.saveEmployee(emp('a', 'Ana'));
    await store.deleteEmployee(emp('a', 'Ana'));
    let list: Employee[] = [];
    store.watchEmployees((l) => (list = l), () => undefined);
    await tick();
    expect(list).toEqual([]);
    const trash = await store.listTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatchObject({ employee: { name: 'Ana' }, by: 'mae@x.com', byName: 'Mãe' });
    await store.restoreEmployee('a');
    expect(list.map((e) => e.name)).toEqual(['Ana']);
    expect(await store.listTrash()).toEqual([]);
  });

  it('histórico guarda as mais novas primeiro e só as últimas 30', async () => {
    const store = createLocalStore();
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) await store.addHistory('schedule', '2026-12', `v${i}`, sched('2026-12', 1));
    const h = await store.listHistory<Schedule>('schedule', '2026-12');
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[0].reason).toBe(`v${HISTORY_LIMIT + 5}`);
    expect(await store.listHistory('schedule', '2027-01')).toEqual([]);
  });

  it('restaurar backup substitui tudo sem perder o que havia', async () => {
    const store = createLocalStore();
    const cfgOld: AppConfig = { ...defaultConfig(), businessName: 'Antigo' };
    await store.saveConfig(cfgOld);
    await store.saveEmployee(emp('a', 'Ana'));
    await store.saveEmployee(emp('z', 'Zé'));
    await store.saveSchedule(sched('2026-12', 5));
    await store.saveSchedule(sched('2027-01', 4));

    const b = parseBackup(
      JSON.stringify(makeBackup({ config: { ...defaultConfig(), businessName: 'Novo' }, employees: [emp('a', 'Ana Paula'), emp('b', 'Bia')], schedules: [sched('2026-12', 2)] }, '1')),
    );
    await store.importAll(b);

    let cfg: AppConfig | null = null;
    let emps: Employee[] = [];
    let dez: Schedule | null = null;
    let jan: Schedule | null = null;
    store.watchConfig((c) => (cfg = c), () => undefined);
    store.watchEmployees((l) => (emps = l), () => undefined);
    store.watchSchedule('2026-12', (s) => (dez = s), () => undefined);
    store.watchSchedule('2027-01', (s) => (jan = s), () => undefined);
    await tick();

    expect(cfg!.businessName).toBe('Novo');
    expect(emps.map((e) => e.name).sort()).toEqual(['Ana Paula', 'Bia']);
    expect(Object.keys(dez!.assignments.a)).toHaveLength(2);
    expect(Object.keys(jan!.assignments.a)).toHaveLength(4); // mês fora do arquivo fica como estava
    expect((await store.listTrash()).map((t) => t.employee.name)).toEqual(['Zé']);
    const hd = await store.listHistory<Schedule>('schedule', '2026-12');
    expect(Object.keys(hd[0].data.assignments.a)).toHaveLength(5);
    const hc = await store.listHistory<AppConfig>('config', 'config');
    expect(hc[0].data.businessName).toBe('Antigo');
  });

  it('marca o app como desatualizado ao ler dado de versão mais nova', async () => {
    localStorage.setItem(
      'escala-posto:v1',
      JSON.stringify({ config: { ...defaultConfig(), schemaVersion: SCHEMA_VERSION + 1 }, employees: {}, schedules: {} }),
    );
    let tooNew = false;
    const store = createLocalStore({ author: { email: 'x' }, onTooNew: () => (tooNew = true) });
    store.watchConfig(() => undefined, () => undefined);
    await tick();
    expect(tooNew).toBe(true);
  });
});
