import type { AppConfig, Demand, Employee, Rules, Shift } from './types';

export const DEFAULT_SHIFTS: Shift[] = [
  { id: 'M', code: 'M', name: 'Manhã', start: '06:00', end: '14:00', breakMinutes: 30, team: 'dia', color: '#f59e0b' },
  { id: 'T', code: 'T', name: 'Tarde', start: '14:00', end: '22:00', breakMinutes: 30, team: 'dia', color: '#0ea5e9' },
  // Madrugada com 1h de intervalo: com 30 min a semana passaria de 42h por causa da hora noturna reduzida.
  { id: 'N', code: 'N', name: 'Madrugada', start: '22:00', end: '06:00', breakMinutes: 60, team: 'noite', color: '#6366f1' },
];

/**
 * Demanda padrão pensada para 13 funcionários: 10 na equipe do dia (rodízio entre manhã e tarde,
 * 50 turnos por semana) e 3 na madrugada (15 turnos por semana).
 * Manhã e tarde: domingo, terça e quarta com 3; demais dias com 4 (= 50 turnos).
 * Madrugada: sempre 2 (14 turnos; sobra 1 turno por semana como reforço).
 */
function buildDefaultDemand(): Demand {
  const d: Demand = {};
  for (let wd = 0; wd < 7; wd++) {
    const lighter = wd === 0 || wd === 2 || wd === 3;
    d[wd] = {
      M: { ideal: lighter ? 3 : 4, min: 2 },
      T: { ideal: lighter ? 3 : 4, min: 2 },
      N: { ideal: 2, min: 2 },
    };
  }
  return d;
}

export const DEFAULT_RULES: Rules = {
  weeklyHoursLimit: 42,
  dailyHoursLimit: 8,
  dailyHoursHardLimit: 10,
  minRestHours: 11,
  restDaysPerWeek: 2,
  maxConsecutiveDays: 5,
  sundayEveryWeeks: 3,
  sundayEveryWeeksWomen: 2,
  forbidDayNightMix: true,
  restAfterDayOff: 'sumula110',
  rotation: 'semanal',
  alsoSundayWeeks: true,
  rotationEveryWeeks: 2,
  rotationStartWeekday: 4,
};

export function defaultConfig(): AppConfig {
  return {
    shifts: DEFAULT_SHIFTS.map((s) => ({ ...s })),
    demand: buildDefaultDemand(),
    rules: { ...DEFAULT_RULES },
    customHolidays: [],
  };
}

/** Limite semanal vigente na data (42h a partir de 16/12/2026; 40h a partir de 16/12/2027). */
export function legalWeeklyLimit(date: string): number {
  if (date >= '2027-12-16') return 40;
  if (date >= '2026-12-16') return 42;
  return 44;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function sampleEmployees(): Employee[] {
  const names = [
    'Funcionário 1', 'Funcionário 2', 'Funcionário 3', 'Funcionário 4', 'Funcionário 5',
    'Funcionário 6', 'Funcionário 7', 'Funcionário 8', 'Funcionário 9', 'Funcionário 10',
    'Funcionário 11', 'Funcionário 12', 'Funcionário 13',
  ];
  return names.map((name, i) => ({
    id: newId(),
    name,
    female: false,
    team: i < 10 ? 'dia' : 'noite',
    active: true,
    absences: [],
  }));
}
