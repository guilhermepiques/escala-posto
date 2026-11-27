import { addDays, toISO } from './dates';
import type { Holiday, ISODate, MonthKey } from './types';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

/** Feriados nacionais e do Estado de SP. Municipais devem ser cadastrados nas configurações. */
export function builtInHolidays(year: number): Holiday[] {
  const fixed: Array<[string, string]> = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['07-09', 'Revolução Constitucionalista (SP)'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  const list: Holiday[] = fixed.map(([md, name]) => ({ date: `${year}-${md}`, name }));
  list.push({ date: addDays(easter(year), -2), name: 'Sexta-feira Santa' });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidaysForMonth(month: MonthKey, custom: Holiday[]): Map<ISODate, string> {
  const year = Number(month.slice(0, 4));
  const map = new Map<ISODate, string>();
  for (const h of [...builtInHolidays(year), ...custom]) {
    if (h.date.startsWith(month)) map.set(h.date, h.name);
  }
  return map;
}
