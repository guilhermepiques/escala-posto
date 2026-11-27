import type { ISODate, MonthKey } from './types';

// Todas as contas de data usam UTC para não sofrer com horário de verão/fuso.

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

/** Diferença em dias (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** 0 = domingo ... 6 = sábado */
export function weekday(d: ISODate): number {
  return parseISO(d).getUTCDay();
}

/** Segunda-feira da semana (semana de segunda a domingo). */
export function weekStart(d: ISODate): ISODate {
  const wd = weekday(d);
  const back = wd === 0 ? 6 : wd - 1;
  return addDays(d, -back);
}

export function monthDays(month: MonthKey): ISODate[] {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function monthOf(d: ISODate): MonthKey {
  return d.slice(0, 7);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return toISO(dt).slice(0, 7);
}

export function currentMonth(): MonthKey {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function inRange(d: ISODate, start: ISODate, end: ISODate): boolean {
  return d >= start && d <= end;
}

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const weekdayShort = (wd: number) => WEEKDAYS_SHORT[wd];
export const weekdayLong = (wd: number) => WEEKDAYS_LONG[wd];

export function formatMonth(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} de ${y}`;
}

export function formatDate(d: ISODate): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function formatDateShort(d: ISODate): string {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

/** Data e hora local de um timestamp, ex.: "26/11/2026 às 14:05". */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "HH:MM" -> minutos desde 00:00 */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToHM(min: number): string {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
}
