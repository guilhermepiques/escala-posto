import type { AppConfig, Employee, Schedule } from '../domain/types';
import { SCHEMA_VERSION } from './store';

/** O conteúdo de um posto: o que vai para o arquivo de backup. */
export interface BackupData {
  config: AppConfig | null;
  employees: Employee[];
  schedules: Schedule[];
}

export interface BackupFile extends BackupData {
  app: 'EscalApp';
  type: 'backup';
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  businessName?: string;
}

export function makeBackup(data: BackupData, appVersion: string, now = Date.now()): BackupFile {
  return {
    app: 'EscalApp',
    type: 'backup',
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    businessName: data.config?.businessName,
    config: data.config,
    employees: data.employees,
    schedules: [...data.schedules].sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/** Nome do arquivo: "EscalApp-backup-Posto-Central-2026-11-27.json". */
export function backupFileName(b: BackupFile): string {
  const d = new Date(b.exportedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const name = (b.businessName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `EscalApp-backup${name ? `-${name}` : ''}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Lê e confere um arquivo de backup. Lança um erro com mensagem amigável se algo estiver errado. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um backup do EscalApp (não foi possível ler o conteúdo).');
  }
  if (!isObj(raw) || raw.app !== 'EscalApp' || raw.type !== 'backup') {
    throw new Error('O arquivo não é um backup do EscalApp.');
  }
  const ver = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (ver > SCHEMA_VERSION) {
    throw new Error('Este backup foi feito por uma versão mais nova do EscalApp. Atualize o app antes de restaurar.');
  }
  if (raw.config !== null && !isObj(raw.config)) throw new Error('Backup com defeito: configurações inválidas.');
  if (isObj(raw.config) && !Array.isArray(raw.config.shifts)) throw new Error('Backup com defeito: configurações sem turnos.');
  if (!Array.isArray(raw.employees) || !raw.employees.every((e) => isObj(e) && typeof e.id === 'string' && typeof e.name === 'string')) {
    throw new Error('Backup com defeito: lista de funcionários inválida.');
  }
  if (
    !Array.isArray(raw.schedules) ||
    !raw.schedules.every((s) => isObj(s) && typeof s.month === 'string' && /^\d{4}-\d{2}$/.test(s.month) && isObj(s.assignments))
  ) {
    throw new Error('Backup com defeito: escalas inválidas.');
  }
  const ids = new Set<string>();
  for (const e of raw.employees as Employee[]) {
    if (ids.has(e.id)) throw new Error('Backup com defeito: funcionário repetido.');
    ids.add(e.id);
  }
  return raw as unknown as BackupFile;
}
